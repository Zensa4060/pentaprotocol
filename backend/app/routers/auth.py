from fastapi import APIRouter, HTTPException, Header, Depends
from app.models.user import UserRegister
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from datetime import datetime, timedelta
from pydantic import BaseModel
from bson import ObjectId
import re, secrets, hashlib, pyotp, qrcode, io, base64, os
import resend

router = APIRouter()

resend.api_key = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = "noreply@pentaprotocol.com"

_reset_codes: dict = {}
_pending_2fa: dict = {}

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    new_password: str

class TwoFAVerifySetup(BaseModel):
    code: str

class TwoFALoginCheck(BaseModel):
    temp_token: str
    code: str

class TwoFADisable(BaseModel):
    code: str

def validate_username(username: str):
    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(username) > 16:
        raise HTTPException(400, "Username must be at most 16 characters")
    if username.startswith(" ") or username.endswith(" "):
        raise HTTPException(400, "Username cannot start or end with a space")
    if re.search(r"\s{2,}", username):
        raise HTTPException(400, "Only single spaces allowed")
    if re.search(r"[^\w\s]", username):
        raise HTTPException(400, "No special characters allowed")

def serialize_user(user):
    return {
        "id":                  str(user["_id"]),
        "username":            user["username"],
        "email":               user.get("email", ""),
        "level":               user.get("level", 1),
        "xp":                  user.get("xp", 0),
        "coins":               user.get("coins", 0),
        "elo":                 user.get("elo", 500),
        "wins":                user.get("wins", 0),
        "losses":              user.get("losses", 0),
        "draws":               user.get("draws", 0),
        "totp_enabled":        user.get("totp_enabled", False),
        "shards":              user.get("shards", 0),
        "protocredits":        user.get("protocredits", 0),
        "bio":                 user.get("bio", ""),
        "avatar":              user.get("avatar", None),
        "username_changed_at": user.get("username_changed_at", None),
        "purchased_items":     user.get("purchased_items", []),
    }

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        raise HTTPException(401, "Invalid token")

# ── REGISTER ──────────────────────────────────────────────────────────────────
@router.post("/register")
async def register(data: UserRegister):
    db = get_db()
    validate_username(data.username)
    if await db.users.find_one({"username": data.username}):
        raise HTTPException(400, "Username already taken")
    if await db.users.find_one({"email": data.email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "username":            data.username,
        "email":               data.email,
        "password":            hash_password(data.password),
        "level":               1,
        "xp":                  0,
        "coins":               0,
        "elo":                 100,
        "wins":                0,
        "losses":              0,
        "draws":               0,
        "totp_enabled":        False,
        "totp_secret":         None,
        "shards":              0,
        "protocredits":        0,
        "bio":                 "",
        "avatar":              None,
        "username_changed_at": None,
        "created_at":          datetime.utcnow(),
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    token = create_access_token({"sub": str(result.inserted_id)})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
class UserLogin(BaseModel):
    username:     str
    password:     str
    device_token: str | None = None

@router.post("/login")
async def login(data: UserLogin):
    db   = get_db()
    user = await db.users.find_one({"username": data.username})
    if not user:
        user = await db.users.find_one({"email": data.username})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")

    if user.get("totp_enabled") and user.get("totp_secret"):
        skip_2fa = False
        if data.device_token:
            now        = datetime.utcnow()
            token_list = user.get("device_tokens_list", [])
            for t in token_list:
                if t.get("token") == data.device_token and t.get("expires_at", now) > now:
                    skip_2fa = True
                    break

        if not skip_2fa:
            temp_token = secrets.token_hex(32)
            _pending_2fa[temp_token] = {
                "user_id":    str(user["_id"]),
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
            return {"requires_2fa": True, "temp_token": temp_token}

    token = create_access_token({"sub": str(user["_id"])})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}

# ── 2FA: SETUP ────────────────────────────────────────────────────────────────
@router.post("/2fa/setup")
async def setup_2fa(user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("totp_enabled"):
        raise HTTPException(400, "2FA is already enabled")

    secret = pyotp.random_base32()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"totp_secret": secret, "totp_enabled": False}}
    )

    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user["email"], issuer_name="PentaProtocol"
    )
    qr  = qrcode.make(totp_uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return {"secret": secret, "qr_code": qr_b64,
            "message": "Scan the QR code in Google Authenticator or Authy, then verify with a code."}

# ── 2FA: CONFIRM SETUP ───────────────────────────────────────────────────────
@router.post("/2fa/confirm")
async def confirm_2fa(data: TwoFAVerifySetup, user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("totp_secret"):
        raise HTTPException(400, "2FA setup not initiated")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid code — check your authenticator app")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"totp_enabled": True}}
    )
    return {"detail": "2FA enabled successfully"}

# ── 2FA: LOGIN CHECK ──────────────────────────────────────────────────────────
@router.post("/2fa/login")
async def login_2fa(data: TwoFALoginCheck):
    db    = get_db()
    entry = _pending_2fa.get(data.temp_token)
    if not entry:
        raise HTTPException(400, "Invalid or expired session — please sign in again")
    if datetime.utcnow() > entry["expires_at"]:
        del _pending_2fa[data.temp_token]
        raise HTTPException(400, "Session expired — please sign in again")

    user = await db.users.find_one({"_id": ObjectId(entry["user_id"])})
    if not user:
        raise HTTPException(404, "User not found")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid authenticator code")

    del _pending_2fa[data.temp_token]
    token = create_access_token({"sub": str(user["_id"])})

    device_token = secrets.token_hex(32)
    expiry       = datetime.utcnow() + timedelta(days=30)
    now          = datetime.utcnow()
    existing     = [t for t in user.get("device_tokens_list", []) if t.get("expires_at", now) > now]
    existing.append({"token": device_token, "expires_at": expiry})
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"device_tokens_list": existing}}
    )

    return {"access_token": token, "token_type": "bearer",
            "user": serialize_user(user), "device_token": device_token}

# ── 2FA: DISABLE ──────────────────────────────────────────────────────────────
@router.post("/2fa/disable")
async def disable_2fa(data: TwoFADisable, user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if not user.get("totp_enabled"):
        raise HTTPException(400, "2FA is not enabled")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid code — confirm with your authenticator app")

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"totp_enabled": False, "totp_secret": None}}
    )
    return {"detail": "2FA disabled"}

# ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    db   = get_db()
    user = await db.users.find_one({"email": data.email})
    if not user:
        return {"detail": "If that email is registered, a reset code has been sent."}

    code       = str(secrets.randbelow(900000) + 100000)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    _reset_codes[data.email] = {
        "hashed":     hashlib.sha256(code.encode()).hexdigest(),
        "expires_at": expires_at,
    }

    resend.Emails.send({
        "from": FROM_EMAIL,
        "to": data.email,
        "subject": "PentaProtocol — Your Password Reset Code",
        "text": (
            f"Your PentaProtocol reset code is: {code}\n\n"
            "This code expires in 15 minutes.\n"
            "If you didn't request this, ignore this email."
        )
    })

    return {"detail": "If that email is registered, a reset code has been sent."}

# ── RESET PASSWORD ────────────────────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest):
    db    = get_db()
    entry = _reset_codes.get(data.email)
    if not entry:
        raise HTTPException(400, "No reset request found — please request a new code")
    if datetime.utcnow() > entry["expires_at"]:
        del _reset_codes[data.email]
        raise HTTPException(400, "Code has expired — please request a new one")
    if hashlib.sha256(data.code.strip().encode()).hexdigest() != entry["hashed"]:
        raise HTTPException(400, "Invalid code — check and try again")
    if len(data.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    del _reset_codes[data.email]
    return {"detail": "Password reset successfully"}