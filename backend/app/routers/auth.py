from fastapi import APIRouter, HTTPException, Depends, Request, Response, Cookie
from app.models.user import UserRegister
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.connections import manager as ws_manager
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
from bson.errors import InvalidId
from app.core.ids import user_object_id
# Shared auth dependency — cookie-first with Authorization-header
# fallback (Phase 3 / review finding F-03). Replaces the per-router
# copies that each decoded the token and checked the session id.
from app.core.auth_dep import get_current_user
from app.core.session_cookies import (
    ACCESS_TOKEN_COOKIE,
    DEVICE_TOKEN_COOKIE,
    set_session_cookies,
    clear_session_cookies,
)

from app.core.rate_limit import (
    build_rate_key,
    enforce_rate_limit,
    enforce_tier,
    TIER_FAST,
    TIER_SENSITIVE,
    TIER_POLL,
)
from app.core import auth_state
from app.core import security_audit as audit
from app.core import abuse as abuse_detect
from app.core.client_ip import get_client_ip
import base64
import re, secrets, hashlib, pyotp, qrcode, io, os
import resend
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@pentaprotocol.com")

# NOTE: password-reset codes and 2FA pending-login tickets are stored in
# Redis via ``app.core.auth_state`` — a previous in-memory implementation
# silently lost state across workers / redeploys. Do not reintroduce local
# dicts here without understanding the horizontal-scale implications.

# Current policy document version. Bump when any of Terms / Privacy / Refund
# changes materially; legacy acceptances below this require a re-accept.
CURRENT_LEGAL_VERSION = 3


def _fingerprint_from_request(request: Request) -> str:
    """Collect the header-only fingerprint the abuse detector needs.

    Kept deliberately minimal — see app.core.abuse.compute_fingerprint
    for the privacy rationale."""
    h = request.headers if request else {}
    return abuse_detect.compute_fingerprint(
        user_agent=h.get("user-agent", "") if h else "",
        accept_language=h.get("accept-language", "") if h else "",
        accept_encoding=h.get("accept-encoding", "") if h else "",
    )


def _hash_device_token(token: str) -> str:
    """One-way SHA-256 of a trusted-device token.

    Security-review finding F-03: device tokens (which bypass 2FA for
    30 days) are stored in browser localStorage and were previously
    persisted server-side in plaintext. If the database were ever
    leaked, every stored token would be directly usable to skip 2FA.
    We now store the hash and compare hashes on the login path, so a
    DB leak yields tokens that are not directly usable against a live
    account (attacker still needs the raw token from the user's
    browser). The token returned to the client is unchanged.

    SHA-256 is appropriate here because the input has 128 bits of
    entropy (``secrets.token_hex(32)`` = 32 bytes = 64 hex chars) — it
    is not a user-chosen secret, so a fast hash is fine and a slow KDF
    (bcrypt/argon2) would only add CPU cost for no real gain."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _device_token_matches(stored_entry: dict, presented_token: str) -> bool:
    """Check a presented device token against a stored token record.

    Supports both the new hashed storage (``token_hash``) and legacy
    plaintext storage (``token``) so existing trusted devices keep
    working across the migration. Legacy plaintext entries will age
    out naturally as the 30-day device-token lifetime expires; at
    that point the ``token`` field becomes dead code and can be
    removed."""
    if not isinstance(stored_entry, dict):
        return False
    token_hash = stored_entry.get("token_hash")
    if isinstance(token_hash, str) and token_hash:
        try:
            presented_hash = _hash_device_token(presented_token)
        except Exception:
            return False
        return secrets.compare_digest(token_hash, presented_hash)
    legacy = stored_entry.get("token")
    if isinstance(legacy, str) and legacy:
        return secrets.compare_digest(legacy, presented_token)
    return False


def _user_needs_policy_gate(user: dict) -> bool:
    """True iff this user must accept the legal bundle before gameplay.

    Only accounts that have *never* accepted (`legal_accepted` false) are
    gated. Existing players who already accepted an earlier policy bundle are
    not forced through the modal again on version bumps.
    """
    return not _safe_bool(user.get("legal_accepted"), False)


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
        "google_linked":       bool(user.get("google_id")),
        "legal_accepted":      user.get("legal_accepted", False),
        "legal_accepted_version": int(user.get("legal_accepted_version", 0) or 0),
        # Onboarding tutorial state: "none" | "skipped" | "completed".
        # New users start at "none"; the frontend shows the tutorial gate
        # once policy acceptance completes. Legacy accounts (missing field)
        # are reported as "completed" so we don't surprise existing players
        # with an onboarding flow they never opted into.
        "onboarding_tutorial":  user.get("onboarding_tutorial") or "completed",
    }

async def require_legal_accepted(user_id: str = Depends(get_current_user)) -> str:
    """Dependency for gameplay / store endpoints: requires an authenticated
    user who has accepted the *current* legal bundle (Terms / Privacy /
    Refund).

    This exists because the policy gate cannot be a client-only concern
    — a user who skips the modal (modified client, direct API call)
    would otherwise happily play and pay while technically never having
    agreed to anything. A ``403 legal_required`` from the server makes
    the client fall back through the same gate.
    """
    db = get_db()
    user = await db.users.find_one(
        {"_id": user_object_id(user_id)},
        {"legal_accepted": 1, "legal_accepted_version": 1},
    )
    if not user:
        raise HTTPException(401, "Invalid token")
    if _user_needs_policy_gate(user):
        raise HTTPException(
            status_code=403,
            detail="legal_required",
        )
    return user_id

# ── SESSION: ME / LOGOUT ──────────────────────────────────────────────────────
# Post-migration the frontend boots without a JWT in hand (the JWT lives
# in the HttpOnly pp_token cookie). ``/auth/me`` lets it pull the current
# user record using the cookie so the in-memory auth store can
# populate on reload. ``/auth/logout`` clears all three session cookies.
@router.get("/me")
async def me(user_id: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = user_object_id(user_id)
    except Exception:
        raise HTTPException(401, "Invalid session")
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")
    return {"user": serialize_user(user)}


@router.post("/logout")
async def logout(response: Response):
    # Deliberately does not require auth — a user with an expired or
    # invalid cookie should still be able to call /auth/logout to have
    # the browser clean up any stale cookies.
    clear_session_cookies(response)
    return {"ok": True}


# ── REGISTER ──────────────────────────────────────────────────────────────────
@router.post("/register")
async def register(data: UserRegister, request: Request, response: Response):
    # Per-IP + per-email registration throttle. Without this a single host can
    # mass-create accounts to farm missions / bypass bans. The per-account
    # companion key (identifier = email) also catches VPN rotations.
    client_ip = get_client_ip(request)
    await enforce_tier(
        scope="auth_register",
        ip=client_ip,
        identifier=str(data.email),
        tier=TIER_FAST,
        detail="Too many registration attempts.",
    )
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
        "onboarding_tutorial": "none",
        "created_at":          datetime.utcnow(),
    }
    result = await db.users.insert_one(user)
    user["_id"] = result.inserted_id
    token = create_access_token({"sub": str(result.inserted_id)})
    audit.log_event(
        event_type=audit.EVENT_REGISTER,
        user_id=str(result.inserted_id),
        ip=client_ip,
        email=data.email,
    )
    # Abuse signal: register is the biggest farming surface. Record the
    # (ip, fingerprint) -> account_id edge so we can warn on fanout.
    await abuse_detect.note_account_activity(
        user_id=str(result.inserted_id),
        ip=client_ip,
        fingerprint=_fingerprint_from_request(request),
        source="register",
    )
    # F-03: set HttpOnly session cookie. Response still includes the
    # JWT for a short transitional period so older cached clients keep
    # working; new clients ignore the body field and rely on the cookie.
    set_session_cookies(response, access_token=token)
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}

# ── LOGIN ─────────────────────────────────────────────────────────────────────
class UserLogin(BaseModel):
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1, max_length=256)
    device_token: str | None = Field(default=None, max_length=256)

@router.post("/login")
async def login(
    data: UserLogin,
    request: Request,
    response: Response,
    pp_device_token_cookie: str | None = Cookie(default=None, alias=DEVICE_TOKEN_COOKIE),
):
    client_ip = get_client_ip(request)
    ident = data.username.strip().lower()
    # 5 per minute per (IP, username) and 15 per minute per username across IPs.
    await enforce_tier(
        scope="auth_login",
        ip=client_ip,
        identifier=ident,
        tier=TIER_FAST,
        detail="Too many login attempts.",
    )
    db   = get_db()
    user = await db.users.find_one({"username": data.username})
    if not user:
        user = await db.users.find_one({"email": data.username})
        
    if not user:
        # Log failed login with the identifier the attacker tried — helpful
        # for detecting credential-stuffing patterns without ever storing
        # plaintext usernames (hashed in audit).
        audit.log_event(
            event_type=audit.EVENT_LOGIN_FAIL,
            severity=audit.SEVERITY_WARN,
            ip=client_ip,
            email=ident,
            meta={"reason": "unknown_account"},
        )
        raise HTTPException(401, "Invalid credentials")

    # If this account is a Google account with no password, prompt to use Google Sign-In
    if user.get("google_id") and not user.get("password"):
        raise HTTPException(401, "This account is linked to Google. Please Sign In with Google.")

    if not verify_password(data.password, user.get("password", "")):
        audit.log_event(
            event_type=audit.EVENT_LOGIN_FAIL,
            severity=audit.SEVERITY_WARN,
            user_id=str(user["_id"]),
            ip=client_ip,
            email=ident,
            meta={"reason": "bad_password"},
        )
        raise HTTPException(401, "Invalid credentials")

    # Enforce admin-issued hard bans (Phase 2.7). Distinct from
    # ranked_ban_until, which only blocks the ranked queue — banned_until
    # blocks login entirely.
    bu = user.get("banned_until")
    if isinstance(bu, datetime) and bu > datetime.utcnow():
        audit.log_event(
            event_type=audit.EVENT_LOGIN_FAIL,
            severity=audit.SEVERITY_ALERT,
            user_id=str(user["_id"]),
            ip=client_ip,
            meta={"reason": "banned", "until": bu.isoformat() + "Z"},
        )
        raise HTTPException(
            403,
            "Account suspended. Contact support if you believe this is a mistake.",
        )

    totp_enabled = _safe_bool(user.get("totp_enabled"), False)
    if totp_enabled and user.get("totp_secret"):
        skip_2fa = False
        # Prefer the HttpOnly cookie over any body field. ``data.device_token``
        # remains in the schema for transitional clients still shipping the
        # legacy localStorage-based flow; once the cookie is available we
        # treat it as authoritative.
        presented_device_token = pp_device_token_cookie or data.device_token
        if presented_device_token:
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
                if (
                    isinstance(exp, datetime)
                    and exp > now
                    and _device_token_matches(t, presented_device_token)
                ):
                    skip_2fa = True
                    break

        if not skip_2fa:
            temp_token = secrets.token_hex(32)
            await auth_state.store_pending_2fa(temp_token, str(user["_id"]))
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
    audit.log_event(
        event_type=audit.EVENT_LOGIN_SUCCESS,
        user_id=str(user["_id"]),
        ip=client_ip,
    )
    await abuse_detect.note_account_activity(
        user_id=str(user["_id"]),
        ip=client_ip,
        fingerprint=_fingerprint_from_request(request),
        source="login",
    )
    set_session_cookies(response, access_token=token)
    return {"access_token": token, "token_type": "bearer", "user": serialize_user(user)}


# ── GOOGLE OAUTH ───────────────────────────────────────────────────────────────
class GoogleAuthRequest(BaseModel):
    credential: str  # Can be ID Token (JWT) or Access Token
    user_info: dict | None = None  # Optional user info from frontend
    confirm_merge: bool = False


class ClientAuthDebugEvent(BaseModel):
    stage: str = Field(min_length=1, max_length=80)
    ts_ms: int | None = None
    details: dict | None = None
    page: str | None = Field(default=None, max_length=200)


@router.post("/client-debug")
async def client_auth_debug(event: ClientAuthDebugEvent, request: Request):
    """Temporary mobile-auth diagnostics visible in Railway logs.

    This endpoint is intentionally unauthenticated so users who fail to
    establish a session cookie can still report client-side auth stages.
    Remove once mobile-login investigation is complete.
    """
    ip = get_client_ip(request)
    ua = request.headers.get("user-agent", "")
    logger.warning(
        "auth_client_debug stage=%s ts_ms=%s ip=%s ua=%s page=%s details=%s",
        event.stage,
        event.ts_ms,
        ip,
        ua[:220],
        event.page,
        event.details,
    )
    return {"ok": True}


@router.post("/google")
async def google_auth(data: GoogleAuthRequest, request: Request, response: Response):
    """
    Verify the Google token server-side and issue a JWT.
    Supports both ID Tokens (standard GIS) and Access Tokens (custom JS flow).
    """
    # Fast-tier throttle by IP. We don't know the account until after Google
    # verification, so the per-account companion gate runs once we have `email`.
    client_ip = get_client_ip(request)
    await enforce_rate_limit(
        key=build_rate_key("auth_google_ip", client_ip, ""),
        max_attempts=int(TIER_FAST["max_attempts"]) * 2,  # a page full of OAuth retries
        window_seconds=int(TIER_FAST["window_seconds"]),
        detail="Too many Google sign-in attempts.",
    )
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
            "onboarding_tutorial": "none", # First-run tutorial gate state
        }
        result = await db.users.insert_one(new_user_doc)
        user = await db.users.find_one({"_id": result.inserted_id})
    else:
        # Existing Google user - update avatar if missing
        if picture_url and not user.get("avatar"):
            await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": picture_url}})
            user = await db.users.find_one({"_id": user["_id"]}) or user

    requires_policy_gate = _user_needs_policy_gate(user)

    # Phase 2.7 — enforce admin-issued hard ban on the Google login path too.
    bu = user.get("banned_until")
    if isinstance(bu, datetime) and bu > datetime.utcnow():
        audit.log_event(
            event_type=audit.EVENT_LOGIN_FAIL,
            severity=audit.SEVERITY_ALERT,
            user_id=str(user["_id"]),
            ip=client_ip,
            meta={"reason": "banned", "via": "google", "until": bu.isoformat() + "Z"},
        )
        raise HTTPException(
            403,
            "Account suspended. Contact support if you believe this is a mistake.",
        )

    # ── Session Management ─────────────────────────────────────────────────
    new_sid = secrets.token_hex(32)
    await ws_manager.kick_user(str(user["_id"]))
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"current_session_id": new_sid}},
    )
    token = create_access_token({"sub": str(user["_id"])}, sid=new_sid)

    audit.log_event(
        event_type=audit.EVENT_LOGIN_SUCCESS,
        user_id=str(user["_id"]),
        ip=client_ip,
        meta={"via": "google"},
    )
    await abuse_detect.note_account_activity(
        user_id=str(user["_id"]),
        ip=client_ip,
        fingerprint=_fingerprint_from_request(request),
        source="google",
    )

    set_session_cookies(response, access_token=token)
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
async def login_2fa(data: TwoFALoginCheck, request: Request, response: Response):
    client_ip = get_client_ip(request)
    # 2FA is the final step in an auth chain, so tight limits are safe.
    await enforce_tier(
        scope="auth_2fa_login",
        ip=client_ip,
        identifier=data.temp_token,
        tier=TIER_FAST,
        detail="Too many 2FA attempts.",
        per_account=False,  # temp_token already identifies the attempt
    )
    db    = get_db()
    entry = await auth_state.get_pending_2fa(data.temp_token)
    if not entry:
        # Redis TTL already evicted the entry, or it never existed.
        raise HTTPException(400, "Invalid or expired session — please sign in again")

    try:
        pending_oid = ObjectId(entry["user_id"])
    except InvalidId:
        await auth_state.consume_pending_2fa(data.temp_token)
        raise HTTPException(400, "Invalid or expired session — please sign in again")

    user = await db.users.find_one({"_id": pending_oid})
    if not user:
        raise HTTPException(404, "User not found")

    totp = pyotp.TOTP(user["totp_secret"])
    if not totp.verify(data.code, valid_window=1):
        audit.log_event(
            event_type=audit.EVENT_LOGIN_2FA_FAIL,
            severity=audit.SEVERITY_WARN,
            user_id=str(user["_id"]),
            ip=client_ip,
        )
        raise HTTPException(400, "Invalid authenticator code")

    await auth_state.consume_pending_2fa(data.temp_token)

    # Phase 2.7 — enforce admin-issued hard ban at the tail of the 2FA chain.
    bu = user.get("banned_until")
    if isinstance(bu, datetime) and bu > datetime.utcnow():
        audit.log_event(
            event_type=audit.EVENT_LOGIN_FAIL,
            severity=audit.SEVERITY_ALERT,
            user_id=str(user["_id"]),
            ip=client_ip,
            meta={"reason": "banned", "via": "2fa", "until": bu.isoformat() + "Z"},
        )
        raise HTTPException(
            403,
            "Account suspended. Contact support if you believe this is a mistake.",
        )

    # ── Single-session enforcement ──────────────────────────────────────────
    new_sid = secrets.token_hex(32)
    await ws_manager.kick_user(str(user["_id"]))

    # ── Trusted-device token issuance ────────────────────────────────────
    # Security-review finding F-03: persist only the SHA-256 of the
    # device token — never the raw value — so a DB leak does not hand
    # the attacker a ready-to-use 2FA-bypass credential. The raw token
    # is then written to the browser as an HttpOnly cookie
    # (pp_device_token) by set_session_cookies() below, so JavaScript
    # running in the page origin cannot exfiltrate it via an XSS
    # primitive. Clients still receive ``device_token`` in the JSON
    # response for transitional compatibility but should ignore it —
    # the cookie is authoritative.
    device_token      = secrets.token_hex(32)
    device_token_hash = _hash_device_token(device_token)
    expiry            = datetime.utcnow() + timedelta(days=30)
    now               = datetime.utcnow()
    existing          = [t for t in user.get("device_tokens_list", []) if t.get("expires_at", now) > now]
    existing.append({"token_hash": device_token_hash, "expires_at": expiry})
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"device_tokens_list": existing, "current_session_id": new_sid}}
    )
    audit.log_event(
        event_type=audit.EVENT_LOGIN_SUCCESS,
        user_id=str(user["_id"]),
        ip=client_ip,
        meta={"via": "2fa"},
    )
    await abuse_detect.note_account_activity(
        user_id=str(user["_id"]),
        ip=client_ip,
        fingerprint=_fingerprint_from_request(request),
        source="login_2fa",
    )

    token = create_access_token({"sub": str(user["_id"])}, sid=new_sid)
    set_session_cookies(response, access_token=token, device_token=device_token)
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
    client_ip = get_client_ip(request)
    # Destructive flow — tight 5/15min cap with per-account companion.
    await enforce_tier(
        scope="auth_forgot_password",
        ip=client_ip,
        identifier=str(data.email),
        tier=TIER_SENSITIVE,
        detail="Too many reset requests.",
    )
    db   = get_db()
    user = await db.users.find_one({"email": data.email})
    if not user:
        return {"detail": "If that email is registered, a reset code has been sent."}

    code = str(secrets.randbelow(900000) + 100000)
    await auth_state.store_reset_code(
        data.email,
        hashlib.sha256(code.encode()).hexdigest(),
    )
    audit.log_event(
        event_type=audit.EVENT_PASSWORD_RESET_REQ,
        user_id=str(user["_id"]),
        ip=client_ip,
        email=data.email,
    )

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
    client_ip = get_client_ip(request)
    await enforce_tier(
        scope="auth_reset_password",
        ip=client_ip,
        identifier=str(data.email),
        tier=TIER_SENSITIVE,
        detail="Too many password reset attempts.",
    )
    db    = get_db()
    entry = await auth_state.get_reset_code(data.email)
    # TTL expiry is implicit: if the 15-minute window passed, Redis already
    # evicted the key and we land here with entry=None.
    if not entry:
        audit.log_event(
            event_type=audit.EVENT_PASSWORD_RESET_FAIL,
            severity=audit.SEVERITY_WARN,
            ip=client_ip,
            email=data.email,
            meta={"reason": "no_request"},
        )
        raise HTTPException(400, "No reset request found — please request a new code")
    if hashlib.sha256(data.code.strip().encode()).hexdigest() != entry["hashed"]:
        audit.log_event(
            event_type=audit.EVENT_PASSWORD_RESET_FAIL,
            severity=audit.SEVERITY_WARN,
            ip=client_ip,
            email=data.email,
            meta={"reason": "bad_code"},
        )
        raise HTTPException(400, "Invalid code — check and try again")
    if len(data.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")

    await db.users.update_one(
        {"email": data.email},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    await auth_state.consume_reset_code(data.email)
    audit.log_event(
        event_type=audit.EVENT_PASSWORD_RESET_OK,
        ip=client_ip,
        email=data.email,
    )
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
        "ip_address": get_client_ip(request),
        "user_agent": request.headers.get("user-agent", "unknown"),
        "accepted_at": datetime.utcnow(),
    })
    
    # Also update the user document for persistent gate bypass, and stamp the
    # exact version that was accepted so that future policy bumps can force a
    # re-accept without losing the boolean convenience flag.
    await db.users.update_one(
        {"_id": user_object_id(user_id)},
        {"$set": {
            "legal_accepted": True,
            "legal_accepted_version": data.version,
            "legal_accepted_at": datetime.utcnow(),
        }},
    )
    audit.log_event(
        event_type=audit.EVENT_LEGAL_ACCEPTED,
        user_id=user_id,
        ip=get_client_ip(request),
        meta={"version": data.version},
    )

    return {"detail": "Legal acceptance recorded"}

# ── DELETE ACCOUNT (self-service) ─────────────────────────────────────────────
class DeleteAccountRequest(BaseModel):
    password: Optional[str] = Field(None, min_length=1, max_length=256)

@router.post("/delete-account")
async def delete_account(data: DeleteAccountRequest, request: Request, user_id: str = Depends(get_current_user)):
    # Irreversible + destructive — tight sensitive-tier cap per account so an
    # attacker who steals a session token can't burn through password guesses.
    client_ip = get_client_ip(request)
    await enforce_tier(
        scope="auth_delete_account",
        ip=client_ip,
        identifier=user_id,
        tier=TIER_SENSITIVE,
        detail="Too many account deletion attempts.",
    )
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

    # Log BEFORE wiping so the audit retains the actor identity even after
    # the user record disappears. The audit row's own TTL handles retention.
    audit.log_event(
        event_type=audit.EVENT_ACCOUNT_DELETE,
        severity=audit.SEVERITY_ALERT,
        user_id=user_id,
        ip=client_ip,
        email=user.get("email"),
    )

    # Purge user-owned data. The set of collections below was audited
    # against every `insert_one` / `user_id` / `player?_id` / `creator_id`
    # reference in the backend. If you add a new collection that stores
    # PII or can be traced back to a user, add it here too.
    #
    # Collections intentionally NOT hard-deleted:
    #   * security_events — anonymised instead (audit trail must survive
    #     a deletion to support abuse investigations on repeat offenders).
    #   * rooms / games    — these carry opponent data too, so we blank
    #     only the deleting user's slot rather than deleting the whole
    #     room document; the opponent's match history stays intact.
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

    # Blank the deleting user's slot on any rooms they were part of so
    # opponents still see a valid match record ("Unknown Player") instead
    # of a dangling ObjectId pointing at a deleted user.
    try:
        await db.rooms.update_many(
            {"player1_id": user_id},
            {"$set": {"player1_id": None, "player1_name": "Deleted Player"}},
        )
        await db.rooms.update_many(
            {"player2_id": user_id},
            {"$set": {"player2_id": None, "player2_name": "Deleted Player"}},
        )
    except Exception:
        pass

    # Same idea for the standalone games collection (solo / bot / early
    # PvP games stored outside rooms).
    try:
        await db.games.update_many(
            {"player1_id": user_id},
            {"$set": {"player1_id": None}},
        )
        await db.games.update_many(
            {"player2_id": user_id},
            {"$set": {"player2_id": None}},
        )
    except Exception:
        pass

    # Anonymise — not delete — security audit rows. We want the ability
    # to notice "same device hash that got a previous account banned
    # created a new one", which means we cannot simply drop the history.
    # Clearing user_id + email_hash breaks the personal link while
    # preserving the behavioural signal.
    try:
        await db.security_events.update_many(
            {"user_id": user_id},
            {"$set": {"user_id": None, "email_hash": None}},
        )
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

