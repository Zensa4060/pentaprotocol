"""Phase 2.7 — internal admin / moderator review endpoints.

Scope:

* Pull the list of users flagged by the anti-cheat heuristics.
* Show the evidence we have on a specific user (score, recent matches,
  recent security events).
* Let a staff member clear a flag, ban, or unban an account.

Design decisions:

* Role is ``users.role ∈ {"admin", "mod"}``. A bootstrap fallback via
  the ``ADMIN_USER_IDS`` env var lets the first admin exist before any
  user has ``role`` set. Admins can grant ``mod`` via
  ``POST /api/admin/users/{id}/role``.
* Every state-changing call records a ``security_events`` row with
  ``actor_id`` in meta so there's a full audit trail. We deliberately
  never silently mutate — even a clear-flag is a logged incident.
* Read-only endpoints are ``mod``-accessible; destructive ones require
  ``admin``. Hard bans are ``admin``-only.
* All endpoints live under ``/api/admin`` and are rate-limited the same
  as other sensitive tooling — there is no scenario where a human ops
  person needs more than a few calls a minute.
* These endpoints are deliberately NOT exposed through the frontend for
  normal users. We expect staff to hit them with a local CLI / curl /
  Postman using a long-lived admin token. A future iteration can bolt
  a tiny /admin web surface on top of this same API.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.core import security_audit as audit
from app.core.client_ip import get_client_ip
from app.core.database import get_db
from app.core.rate_limit import TIER_SENSITIVE, enforce_tier
from app.core.security import decode_token

logger = logging.getLogger("pentaprotocol.admin")

router = APIRouter()


# ── Role helpers ────────────────────────────────────────────────────────────


def _env_admin_ids() -> set[str]:
    """Bootstrap allowlist — comma-separated ObjectId strings.

    Keeping this in env (not in the DB) avoids the chicken-and-egg
    problem of "how does the first admin log in to promote anyone?"
    and lets us kill/rotate the bootstrap set without a DB migration.
    """
    raw = (os.getenv("ADMIN_USER_IDS") or "").strip()
    if not raw:
        return set()
    return {p.strip() for p in raw.split(",") if p.strip()}


def _user_has_role(user: dict, *, required: str) -> bool:
    role = str(user.get("role") or "").lower()
    if required == "mod":
        return role in ("mod", "admin")
    return role == "admin"


async def _resolve_caller(authorization: str | None, pp_token: str | None = None) -> dict:
    # F-03: accept session cookie as well as Authorization header.
    from app.core.auth_dep import extract_session_token
    token = extract_session_token(authorization, pp_token)
    if not token:
        raise HTTPException(401, "Missing token")
    try:
        payload = decode_token(token)
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")
    db = get_db()
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


def require_mod():
    async def _dep(
        request: Request,
        authorization: str | None = Header(default=None, alias="Authorization"),
        pp_token: str | None = Cookie(default=None, alias="pp_token"),
    ) -> dict:
        caller = await _resolve_caller(authorization, pp_token)
        caller_id = str(caller["_id"])
        is_bootstrap = caller_id in _env_admin_ids()
        if not (is_bootstrap or _user_has_role(caller, required="mod")):
            # Log the rejection — probing the admin surface is itself
            # interesting signal for forensics.
            audit.log_event(
                event_type="admin.access.denied",
                severity=audit.SEVERITY_WARN,
                user_id=caller_id,
                ip=(get_client_ip(request)),
                meta={"role": caller.get("role"), "path": str(request.url.path)},
            )
            raise HTTPException(403, "Staff access required")
        # Rate-limit the whole admin surface per caller.
        await enforce_tier(
            scope="admin_call",
            ip=(get_client_ip(request)),
            identifier=caller_id,
            tier=TIER_SENSITIVE,
            detail="Admin rate limit hit.",
        )
        return caller

    return _dep


def require_admin():
    async def _dep(
        request: Request,
        authorization: str | None = Header(default=None, alias="Authorization"),
        pp_token: str | None = Cookie(default=None, alias="pp_token"),
    ) -> dict:
        caller = await _resolve_caller(authorization, pp_token)
        caller_id = str(caller["_id"])
        is_bootstrap = caller_id in _env_admin_ids()
        if not (is_bootstrap or _user_has_role(caller, required="admin")):
            audit.log_event(
                event_type="admin.access.denied",
                severity=audit.SEVERITY_WARN,
                user_id=caller_id,
                ip=(get_client_ip(request)),
                meta={
                    "role": caller.get("role"),
                    "path": str(request.url.path),
                    "needed": "admin",
                },
            )
            raise HTTPException(403, "Admin access required")
        await enforce_tier(
            scope="admin_call",
            ip=(get_client_ip(request)),
            identifier=caller_id,
            tier=TIER_SENSITIVE,
            detail="Admin rate limit hit.",
        )
        return caller

    return _dep


# ── Serialization ───────────────────────────────────────────────────────────


def _safe_user(u: dict) -> dict:
    """Subset of the users doc that is safe for an admin UI. We still
    never hand out password_hash, totp_secret, google_id raw, etc."""
    return {
        "id": str(u["_id"]),
        "username": u.get("username"),
        "email": u.get("email"),
        "level": int(u.get("level") or 1),
        "elo": u.get("elo"),
        "hidden_mmr": u.get("hidden_mmr"),
        "ranked_rating": u.get("ranked_rating"),
        "shadow_rating": u.get("shadow_rating"),
        "shadow_mmr": u.get("shadow_mmr"),
        "under_review": bool(u.get("under_review")),
        "shadow_since": (
            u["shadow_since"].isoformat() + "Z"
            if isinstance(u.get("shadow_since"), datetime)
            else None
        ),
        "anticheat_score": int(u.get("anticheat_score") or 0),
        "anticheat_last_flag_at": (
            u["anticheat_last_flag_at"].isoformat() + "Z"
            if isinstance(u.get("anticheat_last_flag_at"), datetime)
            else None
        ),
        "banned_until": (
            u["banned_until"].isoformat() + "Z"
            if isinstance(u.get("banned_until"), datetime)
            else None
        ),
        "ranked_ban_until": (
            u["ranked_ban_until"].isoformat() + "Z"
            if isinstance(u.get("ranked_ban_until"), datetime)
            else None
        ),
        "role": u.get("role") or "user",
        "created_at": (
            u["created_at"].isoformat() + "Z"
            if isinstance(u.get("created_at"), datetime)
            else None
        ),
    }


def _oid_or_400(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except (InvalidId, TypeError):
        raise HTTPException(400, "Invalid user id")


# ── Endpoints: read ─────────────────────────────────────────────────────────


@router.get("/flagged-users")
async def list_flagged_users(
    _: dict = Depends(require_mod()),
    limit: int = Query(50, ge=1, le=500),
    min_score: int = Query(1, ge=0, le=10_000),
):
    """Users with any anticheat_score or under_review=True, newest first."""
    db = get_db()
    q = {
        "$or": [
            {"under_review": True},
            {"anticheat_score": {"$gte": int(min_score)}},
        ]
    }
    cursor = (
        db.users.find(q)
        .sort("anticheat_last_flag_at", -1)
        .limit(int(limit))
    )
    rows = [_safe_user(u) async for u in cursor]
    return {"count": len(rows), "users": rows}


@router.get("/users/{user_id}/review")
async def user_review(
    user_id: str,
    _: dict = Depends(require_mod()),
    match_limit: int = Query(20, ge=1, le=200),
    event_limit: int = Query(50, ge=1, le=500),
):
    """Evidence packet for a user: anti-cheat matches + recent security events."""
    db = get_db()
    oid = _oid_or_400(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(404, "User not found")

    matches_cursor = (
        db.anticheat_matches.find(
            {
                "$or": [
                    {"per_slot.P1.user_id": user_id},
                    {"per_slot.P2.user_id": user_id},
                ]
            }
        )
        .sort("at", -1)
        .limit(int(match_limit))
    )
    matches = []
    async for m in matches_cursor:
        m["_id"] = str(m["_id"])
        at = m.get("at")
        if isinstance(at, datetime):
            m["at"] = at.isoformat() + "Z"
        matches.append(m)

    events_cursor = (
        db.security_events.find({"user_id": user_id})
        .sort("at", -1)
        .limit(int(event_limit))
    )
    events = []
    async for e in events_cursor:
        e["_id"] = str(e["_id"])
        at = e.get("at")
        if isinstance(at, datetime):
            e["at"] = at.isoformat() + "Z"
        # Strip the PII hashes from the admin view — they're not useful
        # to a human operator and keep the payload compact.
        e.pop("ip_hash", None)
        e.pop("email_hash", None)
        events.append(e)

    return {
        "user": _safe_user(u),
        "anticheat_matches": matches,
        "security_events": events,
    }


@router.get("/events")
async def list_events(
    _: dict = Depends(require_mod()),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    since_hours: int = Query(24, ge=1, le=720),
    limit: int = Query(100, ge=1, le=1000),
):
    """Tail of the ``security_events`` collection. Intended for manual
    investigation. For machine-readable alerting see Phase 2.8."""
    db = get_db()
    since = datetime.utcnow() - timedelta(hours=int(since_hours))
    q: dict = {"at": {"$gte": since}}
    if event_type:
        q["event_type"] = event_type
    if severity:
        q["severity"] = severity
    cursor = db.security_events.find(q).sort("at", -1).limit(int(limit))
    out = []
    async for e in cursor:
        e["_id"] = str(e["_id"])
        at = e.get("at")
        if isinstance(at, datetime):
            e["at"] = at.isoformat() + "Z"
        out.append(e)
    return {"count": len(out), "events": out}


# ── Endpoints: write ────────────────────────────────────────────────────────


class ClearFlagBody(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/users/{user_id}/clear-flag")
async def clear_flag(
    user_id: str,
    body: ClearFlagBody,
    request: Request,
    caller: dict = Depends(require_admin()),
):
    db = get_db()
    oid = _oid_or_400(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(404, "User not found")
    await db.users.update_one(
        {"_id": oid},
        {
            "$set": {
                "under_review": False,
                "anticheat_score": 0,
                "anticheat_decayed_at": datetime.utcnow(),
                "under_review_cleared_at": datetime.utcnow(),
            }
        },
    )
    audit.log_event(
        event_type="admin.clear_flag",
        severity=audit.SEVERITY_WARN,
        user_id=user_id,
        ip=(get_client_ip(request)),
        meta={
            "actor_id": str(caller["_id"]),
            "reason": body.reason,
        },
    )
    return {"ok": True}


class BanBody(BaseModel):
    days: int = Field(..., ge=1, le=3650)
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    body: BanBody,
    request: Request,
    caller: dict = Depends(require_admin()),
):
    """Hard-ban: blocks login (ban enforcement is done in auth.py via
    ``banned_until`` check). Distinct from ranked_ban_until which only
    blocks the ranked queue."""
    db = get_db()
    oid = _oid_or_400(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(404, "User not found")
    if str(caller["_id"]) == user_id:
        raise HTTPException(400, "Cannot ban yourself")
    until = datetime.utcnow() + timedelta(days=int(body.days))
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"banned_until": until, "banned_reason": body.reason}},
    )
    audit.log_event(
        event_type="admin.ban",
        severity=audit.SEVERITY_ALERT,
        user_id=user_id,
        ip=(get_client_ip(request)),
        meta={
            "actor_id": str(caller["_id"]),
            "days": int(body.days),
            "reason": body.reason,
        },
    )
    return {"ok": True, "banned_until": until.isoformat() + "Z"}


class UnbanBody(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    body: UnbanBody,
    request: Request,
    caller: dict = Depends(require_admin()),
):
    db = get_db()
    oid = _oid_or_400(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(404, "User not found")
    await db.users.update_one(
        {"_id": oid},
        {
            "$unset": {"banned_until": "", "banned_reason": ""},
            "$set": {"unbanned_at": datetime.utcnow()},
        },
    )
    audit.log_event(
        event_type="admin.unban",
        severity=audit.SEVERITY_WARN,
        user_id=user_id,
        ip=(get_client_ip(request)),
        meta={"actor_id": str(caller["_id"]), "reason": body.reason},
    )
    return {"ok": True}


class RoleBody(BaseModel):
    role: str = Field(..., pattern=r"^(user|mod|admin)$")
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/users/{user_id}/role")
async def set_role(
    user_id: str,
    body: RoleBody,
    request: Request,
    caller: dict = Depends(require_admin()),
):
    """Promote / demote another user. A bootstrap admin (env-allowlisted)
    is the only one who can grant ``admin`` initially."""
    db = get_db()
    oid = _oid_or_400(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(404, "User not found")
    if str(caller["_id"]) == user_id and body.role != "admin":
        # Prevent an admin accidentally demoting themselves out of the
        # only remaining admin seat. Explicit demotion still works via
        # a second admin.
        raise HTTPException(400, "Cannot self-demote")
    set_doc: dict = {}
    unset_doc: dict = {}
    if body.role == "user":
        unset_doc["role"] = ""
    else:
        set_doc["role"] = body.role
    update: dict = {}
    if set_doc:
        update["$set"] = set_doc
    if unset_doc:
        update["$unset"] = unset_doc
    if update:
        await db.users.update_one({"_id": oid}, update)
    audit.log_event(
        event_type="admin.role_change",
        severity=audit.SEVERITY_ALERT,
        user_id=user_id,
        ip=(get_client_ip(request)),
        meta={
            "actor_id": str(caller["_id"]),
            "from": u.get("role") or "user",
            "to": body.role,
            "reason": body.reason,
        },
    )
    return {"ok": True, "role": body.role}


class VoidMatchBody(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/matches/{room_code}/void")
async def void_match(
    room_code: str,
    body: VoidMatchBody,
    request: Request,
    caller: dict = Depends(require_admin()),
):
    """Mark a specific match voided — does NOT reverse rating changes
    automatically (that's a separate, riskier operation). Instead it
    flags the match for manual reconciliation and prevents further
    award hooks from firing (the ``series_awarded`` flag is already
    set once awards ran; we mirror ``voided=True`` for downstream
    filters)."""
    db = get_db()
    room = await db.rooms.find_one({"room_code": room_code})
    if not room:
        raise HTTPException(404, "Room not found")
    await db.rooms.update_one(
        {"room_code": room_code},
        {
            "$set": {
                "voided": True,
                "voided_at": datetime.utcnow(),
                "voided_reason": body.reason,
            }
        },
    )
    audit.log_event(
        event_type="admin.match_void",
        severity=audit.SEVERITY_WARN,
        user_id=None,
        ip=(get_client_ip(request)),
        meta={
            "actor_id": str(caller["_id"]),
            "room_code": room_code,
            "reason": body.reason,
        },
    )
    return {"ok": True}
