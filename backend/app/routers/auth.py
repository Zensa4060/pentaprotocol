from fastapi import APIRouter, HTTPException, Header, Depends, Request
from app.models.user import UserRegister
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.connections import manager as ws_manager
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from bson.errors import InvalidId
from app.core.ids import user_object_id

from app.core.rate_limit import build_rate_key, enforce_rate_limit
import base64
import re, secrets, hashlib, pyotp, qrcode, io, os
import resend
import httpx

router = APIRouter()

resend.api_key = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@pentaprotocol.com")

_reset_codes: dict = {}
_pending_2fa: dict = {}


def _totp_account_label(user: dict) -> str:
    return user.get("email") or user.get("username") or str(user["_id"])


def _safe_bool(v, default=False):
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        lv = v.strip().lower()
        if lv in ("true", "1", "yes", "y"):
            return True
        if lv in ("false", "0", "no", "n"):
            return False
    if isinstance(v, (int, float)):
        return bool(v)
    return default

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

class TwoFAVerifySetup(BaseModel):
    code: str = Field(min_length=6, max_length=8)

class TwoFALoginCheck(BaseModel):
    temp_token: str = Field(min_length=16, max_length=256)
    code: str = Field(min_length=6, max_length=8)

class TwoFADisable(BaseModel):
    code: str = Field(min_length=6, max_length=8)

def validate_username(username: str):
    if len(username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(username) > 12:
        raise HTTPException(400, "Username must be at most 12 characters")
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
        "elo":                 user.get("elo", 500),
        "ranked_rating":       int(user.get("ranked_rating", user.get("elo", 500))),
        "wins":                user.get("wins", 0),
        "losses":              user.get("losses", 0),
        "draws":               user.get("draws", 0),
        "placement_matches":   user.get("placement_matches", 0),
        "is_placement":        user.get("placement_matches", 0) < 5,
        "totp_enabled":        user.get("totp_enabled", False),
        "shards":              user.get("shards", 0),
        "protocredits":        user.get("protocredits", 0),
        "bio":                 user.get("bio", ""),
        "avatar":              user.get("avatar", None),
        "username_changed_at": user.get("username_changed_at", None),
        "purchased_items":     user.get("purchased_items", []),
        "has_password":        bool(user.get("password")),
        "google_id":           user.get("google_id", None),
        "legal_accepted":      user.get("legal_accepted", False),
    }

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        user_id = payload["sub"]
        token_sid = payload.get("sid")
        # If token carries a sid, verify it still matches the DB (single-session enforcement)
        if token_sid:
            db = get_db()
            user = await db.users.find_one({"_id": user_object_id(user_id)}, {"current_session_id": 1})
            if not user or user.get("current_session_id") != token_sid:
                raise HTTPException(401, "Session replaced — please sign in again")
        return user_id
    except HTTPException:
        raise
    except Exception:
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
        "hidden_mmr":          500,
        "ranked_quit_streak":  0,
        "ranked_ban_until":    None,
        "ranked_clean_matches": 0,
        "wins":                0,
        "losses":              0,
        "draws":               0,
        "placement_matches":   0,
        "totp_enabled":        False,
        "totp_secret":         None,
        "shards":              0,
        "protocredits":        0,
        "bio":                 "",
        "avatar":              None,
        "username_changed_at": None,
        "legal_accepted":      False,
        "created_at":          datetime.utcnow(),
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    token = create_access_token({"sub": str(result.inserted_id)})
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
class UserLogin(BaseModel):
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=256)
    device_token: str | None = Field(default=None, max_length=256)

@router.post("/login")
async def login(data: UserLogin, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    ident = data.username.strip().lower()
    await enforce_rate_limit(
        key=build_rate_key("auth_login", client_ip, ident),
        detail="Too many login attempts.",
    )
    db   = get_db()
    user = await db.users.find_one({"username": data.username})
    if not user:
        user = await db.users.find_one({"email": data.username})
        
    if not user:
        raise HTTPException(401, "Invalid credentials")

    # If this account is a Google account with no password, prompt to use Google Sign-In
    if user.get("google_id") and not user.get("password"):
        raise HTTPException(401, "This account is linked to Google. Please Sign In with Google.")

    if not verify_password(data.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")

    totp_enabled = _safe_bool(user.get("totp_enabled"), False)
    if totp_enabled and user.get("totp_secret"):
        skip_2fa = False
        if data.device_token:
            now        = datetime.utcnow()
            token_list = user.get("device_tokens_list", [])
            if not isinstance(token_list, list):
                token_list = []
            for t in token_list:
                if not isinstance(t, dict):
                    continue
                exp = t.get("expires_at")
                if isinstance(exp, str):
                    try:
                        exp = datetime.fromisoformat(exp.replace("Z", "+00:00")).replace(tzinfo=None)
                    except Exception:
                        exp = None
                if isinstance(exp, datetime) and t.get("token") == data.device_token and exp > now:
                    skip_2fa = True
                    break

        if not skip_2fa:
            temp_token = secrets.token_hex(32)
            _pending_2fa[temp_token] = {
                "user_id":    str(user["_id"]),
                "expires_at": datetime.utcnow() + timedelta(minutes=5),
            }
            return {"requires_2fa": True, "temp_token": temp_token}

    # ── Single-session enforcement ──────────────────────────────────────────
    new_sid = secrets.token_hex(32)
    # Kick any existing WebSocket connections for this user immediately
    await ws_manager.kick_user(str(user["_id"]))
    # Persist the new session id so future requests can validate it
    await get_db().users.update_one(
        {"_id": user["_id"]},
        {"$set": {"current_session_id": new_sid}},
    )
    token = create_access_token({"sub": str(user["_id"])}, sid=new_sid)
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


# ── GOOGLE OAUTH ───────────────────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    credential: str  # Can be ID Token (JWT) or Access Token
    user_info: dict | None = None  # Optional user info from frontend
    confirm_merge: bool = False


@router.post("/google")
async def google_auth(data: GoogleAuthRequest):
    """
    Verify the Google token server-side and issue a JWT.
    Supports both ID Tokens (standard GIS) and Access Tokens (custom JS flow).
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(500, "Google OAuth is not configured on this server")

    google_sub = None
    email = None
    name = None
    picture_url = None

    # 1. Try to verify as ID Token (JWT)
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        id_info = google_id_token.verify_oauth2_token(
            data.credential,
            google_requests.Request(),
            client_id,
        )
        google_sub = id_info.get("sub")
        email = id_info.get("email", "").lower().strip()
        name = id_info.get("name", "")
        picture_url = id_info.get("picture")
    except Exception:
        # 2. If JWT verification fails, try as Access Token
        try:
            async with httpx.AsyncClient() as client:
                # Verify token with Google's userinfo endpoint
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {data.credential}"}
                )
                if resp.status_code != 200:
                    raise HTTPException(401, "Invalid Google access token")
                
                info = resp.json()
                google_sub = info.get("sub")
                email = info.get("email", "").lower().strip()
                name = info.get("name", "")
                picture_url = info.get("picture")
        except Exception as e:
            if isinstance(e, HTTPException): raise e
            raise HTTPException(401, f"Google verification failed: {str(e)}")

    if not google_sub or not email:
        raise HTTPException(400, "Google authentication missing required fields")

    db = get_db()

    # ── Find or create user ─────────────────────────────────────────────────
    user = await db.users.find_one({"google_id": google_sub})
    
    if not user:
        # Check if an account already exists with this email
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            if not data.confirm_merge:
                # Return a special JSON payload the frontend will intercept
                return {"requires_merge_consent": True, "email": email}
            else:
                # The user consented to merge. Link the google ID and update avatar if missing
                update_fields = {"google_id": google_sub}
                if picture_url and not existing_user.get("avatar"):
                    update_fields["avatar"] = picture_url
                await db.users.update_one({"_id": existing_user["_id"]}, {"$set": update_fields})
                user = await db.users.find_one({"_id": existing_user["_id"]})
        else:
            # Generated usernames must be <= 12 characters. Truncate base to 9 to allow for suffixes.
            base_username = re.sub(r"[^\w]", "", name.replace(" ", "_"))[:9] or "player"
            username = base_username
            suffix = 1
            while await db.users.find_one({"username": username}):
                username = f"{base_username}{suffix}"
                suffix += 1

            new_user_doc = {
                "username":          username,
                "email":             email,
                "google_id":         google_sub,
                "password":          "",
                "avatar":            picture_url,
                "level":             1,
                "xp":                0,
                "hidden_mmr":        500,
            "placement_matches": 0,
            "wins":              0,
            "losses":            0,
            "draws":             0,
            "shards":            0,
            "protocredits":      0,
            "totp_enabled":      False,
            "bio":               "",
            "created_at":        datetime.utcnow(),
            "legal_accepted":    False, # New users must accept terms
        }
        result = await db.users.insert_one(new_user_doc)
        user = await db.users.find_one({"_id": result.inserted_id})
    else:
        # Existing Google user - update avatar if missing
        if picture_url and not user.get("avatar"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": picture_url}})
            user = await db.users.find_one({"_id": user["_id"]}) or user

    # Check if policy gate is required
    requires_policy_gate = not user.get("legal_accepted", False)
    if not requires_policy_gate:
        # Also check legal_acceptances collection for consistency
        acceptance = await db.legal_acceptances.find_one({"user_id": str(user["_id"])})
        if not acceptance:
            requires_policy_gate = True

    # ── Session Management ─────────────────────────────────────────────────
    new_sid = secrets.token_hex(32)
    await ws_manager.kick_user(str(user["_id"]))
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"current_session_id": new_sid}},
    )
    token = create_access_token({"sub": str(user["_id"])}, sid=new_sid)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user),
        "requires_policy_gate": requires_policy_gate
    }



# ── 2FA: SETUP ────────────────────────────────────────────────────────────────
@router.post("/2fa/setup")
async def setup_2fa(user_id: str = Depends(get_current_user)):
    db   = get_db()
    oid  = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")
    if user.get("totp_enabled"):
        raise HTTPException(400, "2FA is already enabled")

    secret = pyotp.random_base32()
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"totp_secret": secret, "totp_enabled": False}}
    )

    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=_totp_account_label(user), issuer_name="PentaProtocol"
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
    oid  = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user or not user.get("totp_secret"):
        raise HTTPException(400, "2FA setup not initiated")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid code — check your authenticator app")

    await db.users.update_one(
        {"_id": oid},
        {"$set": {"totp_enabled": True}}
    )
    return {"detail": "2FA enabled successfully"}

# ── 2FA: LOGIN CHECK ──────────────────────────────────────────────────────────
@router.post("/2fa/login")
async def login_2fa(data: TwoFALoginCheck, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("auth_2fa_login", client_ip, data.temp_token),
        detail="Too many 2FA attempts.",
    )
    db    = get_db()
    entry = _pending_2fa.get(data.temp_token)
    if not entry:
        raise HTTPException(400, "Invalid or expired session — please sign in again")
    if datetime.utcnow() > entry["expires_at"]:
        del _pending_2fa[data.temp_token]
        raise HTTPException(400, "Session expired — please sign in again")

    try:
        pending_oid = ObjectId(entry["user_id"])
    except InvalidId:
        del _pending_2fa[data.temp_token]
        raise HTTPException(400, "Invalid or expired session — please sign in again")

    user = await db.users.find_one({"_id": pending_oid})
    if not user:
        raise HTTPException(404, "User not found")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid authenticator code")

    del _pending_2fa[data.temp_token]

    # ── Single-session enforcement ──────────────────────────────────────────
    new_sid = secrets.token_hex(32)
    await ws_manager.kick_user(str(user["_id"]))

    device_token = secrets.token_hex(32)
    expiry       = datetime.utcnow() + timedelta(days=30)
    now          = datetime.utcnow()
    existing     = [t for t in user.get("device_tokens_list", []) if t.get("expires_at", now) > now]
    existing.append({"token": device_token, "expires_at": expiry})
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"device_tokens_list": existing, "current_session_id": new_sid}}
    )

    token = create_access_token({"sub": str(user["_id"])}, sid=new_sid)
    return {"access_token": token, "token_type": "bearer",
            "user": serialize_user(user), "device_token": device_token}

# ── 2FA: DISABLE ──────────────────────────────────────────────────────────────
@router.post("/2fa/disable")
async def disable_2fa(data: TwoFADisable, user_id: str = Depends(get_current_user)):
    db   = get_db()
    oid  = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")
    if not user.get("totp_enabled"):
        raise HTTPException(400, "2FA is not enabled")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(400, "Invalid code — confirm with your authenticator app")

    await db.users.update_one(
        {"_id": oid},
        {"$set": {"totp_enabled": False, "totp_secret": None}}
    )
    return {"detail": "2FA disabled"}

# ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("auth_forgot_password", client_ip, str(data.email)),
        detail="Too many reset requests.",
    )
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
async def reset_password(data: ResetPasswordRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    await enforce_rate_limit(
        key=build_rate_key("auth_reset_password", client_ip, str(data.email)),
        detail="Too many password reset attempts.",
    )
    db    = get_db()
    entry = _reset_codes.get(data.email)
    if not entry:
        raise HTTPException(400, "No reset request found — please request a new code")
    if datetime.utcnow() > entry["expires_at"]:
        del _reset_codes[data.email]
        raise HTTPException(400, "Code has expired — please request a new one")
    if hashlib.sha256(data.code.strip().encode()).hexdigest() != entry["hashed"]:
        raise HTTPException(400, "Invalid code — check and try again")
    if len(data.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    del _reset_codes[data.email]
    return {"detail": "Password reset successfully"}

# ── ACCEPT LEGAL (server-side consent record) ─────────────────────────────────
class AcceptLegalRequest(BaseModel):
    version: int = Field(default=1, ge=1, le=100)

@router.post("/accept-legal")
async def accept_legal(data: AcceptLegalRequest, request: Request, user_id: str = Depends(get_current_user)):
    db = get_db()
    existing = await db.legal_acceptances.find_one({"user_id": user_id, "version": data.version})
    if existing:
        return {"detail": "Already accepted", "accepted_at": existing.get("accepted_at", "").isoformat() if existing.get("accepted_at") else None}

    await db.legal_acceptances.insert_one({
        "user_id":    user_id,
        "version":    data.version,
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "accepted_at": datetime.utcnow(),
    })
    
    # Also update the user document for persistent gate bypass
    await db.users.update_one({"_id": user_object_id(user_id)}, {"$set": {"legal_accepted": True}})

    return {"detail": "Legal acceptance recorded"}

# ── DELETE ACCOUNT (self-service) ─────────────────────────────────────────────
class DeleteAccountRequest(BaseModel):
    password: Optional[str] = Field(None, min_length=1, max_length=256)

@router.post("/delete-account")
async def delete_account(data: DeleteAccountRequest, request: Request, user_id: str = Depends(get_current_user)):
    db  = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    # If the user has a password set, they MUST provide it.
    # Otherwise (Google-only user), they must enter "DELETE" as a confirmation.
    has_password = bool(user.get("password"))
    if has_password:
        if not data.password or not verify_password(data.password, user["password"]):
            raise HTTPException(400, "Incorrect password")
    else:
        if not data.password or data.password.upper() != "DELETE":
            raise HTTPException(400, "Type 'DELETE' to confirm account closure")

    # Purge all user data across collections
    await db.users.delete_one({"_id": oid})
    await db.match_history.delete_many({"user_id": {"$in": [user_id, oid]}})
    await db.payments.delete_many({"user_id": user_id})
    await db.upi_payments.delete_many({"user_id": user_id})
    await db.legal_acceptances.delete_many({"user_id": user_id})

    # Clean up any active matchmaking queue entries
    try:
        await db.matchmaking_queue.delete_many({"user_id": user_id})
    except Exception:
        pass

    return {"detail": "Account and all associated data have been permanently deleted"}

# ── EXPORT DATA (GDPR data portability) ───────────────────────────────────────
@router.get("/export-data")
async def export_data(user_id: str = Depends(get_current_user)):
    db  = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    # Sanitise user doc — remove sensitive internal fields
    export_user = {}
    EXCLUDE = {"password", "totp_secret", "totp_enabled", "_id"}
    for k, v in user.items():
        if k in EXCLUDE:
            continue
        if hasattr(v, "isoformat"):
            export_user[k] = v.isoformat()
        elif isinstance(v, ObjectId):
            export_user[k] = str(v)
        else:
            export_user[k] = v
    export_user["id"] = str(user["_id"])

    # Gather match history
    match_history = []
    async for doc in db.match_history.find({"user_id": {"$in": [user_id, oid]}}):
        entry = {}
        for k, v in doc.items():
            if k == "_id":
                entry["id"] = str(v)
            elif hasattr(v, "isoformat"):
                entry[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                entry[k] = str(v)
            else:
                entry[k] = v
        match_history.append(entry)

    # Gather payments
    payments = []
    async for doc in db.payments.find({"user_id": user_id}):
        entry = {}
        for k, v in doc.items():
            if k == "_id":
                entry["id"] = str(v)
            elif hasattr(v, "isoformat"):
                entry[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                entry[k] = str(v)
            else:
                entry[k] = v
        payments.append(entry)

    # Gather legal acceptances
    acceptances = []
    async for doc in db.legal_acceptances.find({"user_id": user_id}):
        entry = {}
        for k, v in doc.items():
            if k == "_id":
                entry["id"] = str(v)
            elif hasattr(v, "isoformat"):
                entry[k] = v.isoformat()
            elif isinstance(v, ObjectId):
                entry[k] = str(v)
            else:
                entry[k] = v
        acceptances.append(entry)

    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user": export_user,
        "match_history": match_history,
        "payments": payments,
        "legal_acceptances": acceptances,
    }
