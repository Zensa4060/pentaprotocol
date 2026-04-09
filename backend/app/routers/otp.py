from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel, EmailStr, Field
from app.core.database import get_db
from app.core.security import hash_password, decode_token, verify_password
from bson import ObjectId
import resend
import redis
import json
import os
import secrets
from app.core.rate_limit import build_rate_key, enforce_rate_limit
from bson.errors import InvalidId

router = APIRouter()

# ─── CONFIG ───────────────────────────────────────────────
resend.api_key = os.environ.get("RESEND_API_KEY")
FROM_EMAIL     = os.environ.get("FROM_EMAIL", "noreply@pentaprotocol.com")
OTP_EXPIRY     = 600  # 10 minutes

# ─── REDIS ────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379").strip()
r = redis.Redis.from_url(REDIS_URL)

# ─── AUTH HELPER ──────────────────────────────────────────
async def get_current_user(authorization: str = Header(...)):
    try:
        token   = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        raise HTTPException(401, "Invalid token")

# ─── REQUEST MODELS ───────────────────────────────────────
class EmailRequest(BaseModel):
    email: EmailStr

class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp:   str = Field(min_length=6, max_length=6)

class ChangeEmailRequest(BaseModel):
    new_email: EmailStr

class ChangeEmailVerifyRequest(BaseModel):
    new_email: EmailStr
    otp:       str = Field(min_length=6, max_length=6)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password:     str = Field(min_length=8, max_length=128)
    otp:              str = Field(min_length=6, max_length=6)

# ─── OTP HELPERS ──────────────────────────────────────────
def generate_otp():
    return str(secrets.randbelow(900000) + 100000)

def send_otp_email(to_email: str, otp: str, purpose: str):
    subjects = {
        "signup":          "Verify your email - PentaProtocol",
        "change_password": "Confirm password change - PentaProtocol",
        "change_email":    "Verify your new email - PentaProtocol",
    }
    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": to_email,
        "subject": subjects.get(purpose, "Your OTP - PentaProtocol"),
        "text": (
            f"Your PentaProtocol OTP is: {otp}\n\n"
            "This code expires in 10 minutes.\n"
            "If you didn't request this, ignore this email."
        )
    })

def store_otp(email: str, purpose: str, otp: str):
    key = f"otp:{purpose}:{email}"
    r.setex(key, OTP_EXPIRY, json.dumps({"otp": otp}))

def check_otp(email: str, purpose: str, otp: str) -> bool:
    key  = f"otp:{purpose}:{email}"
    data = r.get(key)
    if not data:
        return False
    if json.loads(data)["otp"] == otp:
        r.delete(key)
        return True
    return False

# ─── SIGNUP ───────────────────────────────────────────────
@router.post("/signup/send")
async def signup_send_otp(req: EmailRequest, request: Request):
    # Lightweight anti-abuse cap on OTP generation requests.
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_signup_send", client_ip, req.email),
        detail="Too many OTP requests.",
    )
    db = get_db()
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    otp = generate_otp()
    store_otp(req.email, "signup", otp)
    send_otp_email(req.email, otp, "signup")
    return {"detail": "OTP sent to your email"}

@router.post("/signup/verify")
async def signup_verify_otp(req: OTPVerifyRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_signup_verify", client_ip, req.email),
        detail="Too many OTP verification attempts.",
    )
    if not check_otp(req.email, "signup", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    return {"detail": "Email verified, proceed with signup"}

# ─── CHANGE EMAIL ─────────────────────────────────────────
@router.post("/change-email/send")
async def change_email_send(req: ChangeEmailRequest, request: Request, user_id: str = Depends(get_current_user)):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_change_email_send", client_ip, req.new_email),
        detail="Too many OTP requests.",
    )
    db = get_db()
    existing = await db.users.find_one({"email": req.new_email})
    if existing:
        raise HTTPException(400, "Email already in use")
    otp = generate_otp()
    store_otp(req.new_email, "change_email", otp)
    send_otp_email(req.new_email, otp, "change_email")
    return {"detail": "OTP sent to your new email"}

@router.post("/change-email/verify")
async def change_email_verify(req: ChangeEmailVerifyRequest, request: Request, user_id: str = Depends(get_current_user)):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_change_email_verify", client_ip, req.new_email),
        detail="Too many OTP verification attempts.",
    )
    if not check_otp(req.new_email, "change_email", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    db = get_db()
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Malformed user id")
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"email": req.new_email}}
    )
    return {"detail": "Email updated successfully"}

# ─── CHANGE PASSWORD ──────────────────────────────────────
@router.post("/change-password/send")
async def change_password_send(request: Request, user_id: str = Depends(get_current_user)):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_change_password_send", client_ip, user_id),
        detail="Too many OTP requests.",
    )
    db   = get_db()
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Malformed user id")
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")
    otp = generate_otp()
    store_otp(user["email"], "change_password", otp)
    send_otp_email(user["email"], otp, "change_password")
    return {"detail": "OTP sent to your email"}

@router.post("/change-password/verify")
async def change_password_verify(req: ChangePasswordRequest, request: Request, user_id: str = Depends(get_current_user)):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("otp_change_password_verify", client_ip, user_id),
        detail="Too many password change attempts.",
    )
    db   = get_db()
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(400, "Malformed user id")
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")
    if not verify_password(req.current_password, user["password"]):
        raise HTTPException(400, "Current password is incorrect")
    if not check_otp(user["email"], "change_password", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    if len(req.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"password": hash_password(req.new_password)}}
    )
    return {"detail": "Password changed successfully"}