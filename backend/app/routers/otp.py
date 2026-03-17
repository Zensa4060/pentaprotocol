from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import hash_password, decode_token, verify_password
from bson import ObjectId
import aiosmtplib
from email.message import EmailMessage
import redis
import json
import os
import secrets

router = APIRouter()

# ─── CONFIG ───────────────────────────────────────────────
GMAIL_USER     = "yagyamishra@pentaprotocol.com"
GMAIL_PASSWORD = "etnk azkt hunr ncfx"
OTP_EXPIRY     = 600  # 10 minutes

# ─── REDIS ────────────────────────────────────────────────
r = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))

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
    otp:   str

class ChangeEmailRequest(BaseModel):
    new_email: EmailStr

class ChangeEmailVerifyRequest(BaseModel):
    new_email: EmailStr
    otp:       str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str
    otp:              str

# ─── OTP HELPERS ──────────────────────────────────────────
def generate_otp():
    return str(secrets.randbelow(900000) + 100000)

async def send_otp_email(to_email: str, otp: str, purpose: str):
    subjects = {
        "signup":          "Verify your email - PentaProtocol",
        "change_password": "Confirm password change - PentaProtocol",
        "change_email":    "Verify your new email - PentaProtocol",
    }
    msg            = EmailMessage()
    msg["From"]    = GMAIL_USER
    msg["To"]      = to_email
    msg["Subject"] = subjects.get(purpose, "Your OTP - PentaProtocol")
    msg.set_content(
        f"Your PentaProtocol OTP is: {otp}\n\n"
        "This code expires in 10 minutes.\n"
        "If you didn't request this, ignore this email."
    )
    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        username=GMAIL_USER,
        password=GMAIL_PASSWORD,
        start_tls=True,
    )

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
async def signup_send_otp(req: EmailRequest):
    otp = generate_otp()
    store_otp(req.email, "signup", otp)
    await send_otp_email(req.email, otp, "signup")
    return {"detail": "OTP sent to your email"}

@router.post("/signup/verify")
async def signup_verify_otp(req: OTPVerifyRequest):
    if not check_otp(req.email, "signup", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    return {"detail": "Email verified, proceed with signup"}

# ─── CHANGE EMAIL ─────────────────────────────────────────
@router.post("/change-email/send")
async def change_email_send(req: ChangeEmailRequest, user_id: str = Depends(get_current_user)):
    db = get_db()
    # Check if new email is already taken
    existing = await db.users.find_one({"email": req.new_email})
    if existing:
        raise HTTPException(400, "Email already in use")
    otp = generate_otp()
    store_otp(req.new_email, "change_email", otp)
    await send_otp_email(req.new_email, otp, "change_email")
    return {"detail": "OTP sent to your new email"}

@router.post("/change-email/verify")
async def change_email_verify(req: ChangeEmailVerifyRequest, user_id: str = Depends(get_current_user)):
    if not check_otp(req.new_email, "change_email", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"email": req.new_email}}
    )
    return {"detail": "Email updated successfully"}

# ─── CHANGE PASSWORD ──────────────────────────────────────
@router.post("/change-password/send")
async def change_password_send(user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    otp = generate_otp()
    store_otp(user["email"], "change_password", otp)
    await send_otp_email(user["email"], otp, "change_password")
    return {"detail": "OTP sent to your email"}

@router.post("/change-password/verify")
async def change_password_verify(req: ChangePasswordRequest, user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    # Verify current password first
    if not verify_password(req.current_password, user["password"]):
        raise HTTPException(400, "Current password is incorrect")
    if not check_otp(user["email"], "change_password", req.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    if len(req.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"password": hash_password(req.new_password)}}
    )
    return {"detail": "Password changed successfully"}