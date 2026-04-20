"""Friends system router.

Handles the full social graph: friend codes, friend requests, friend list,
online presence, friend-only unranked invites (rate-limited 5/24h),
reports, blocks, public profile/career views, and DMs between friends.

Data model extensions on the `users` document (lazy-added as needed):
    friend_code      str   — 8-char unique code users share to add each other
    friends          list  — list of user_id strings that are mutual friends
    blocked          list  — list of user_id strings this user has blocked
    friend_invites_used  list of ISO-timestamp strings in the last 24h

Collections:
    friend_requests  { from_user, to_user, created_at, status }
    friend_invites   { from_user, to_user, room_code, format, board_mode,
                       selected_patterns, created_at, expires_at, status }
    player_reports   { from_user, to_user, reason, category, context,
                       created_at, room_code }
    dm_messages      { from_user, to_user, text, created_at, read_at }

Security notes:
- All routes require auth via `Depends(get_current_user)`.
- Block prevents matchmaking in either direction (filter lives in
  room.queue_join) and silently drops any social traffic from the blocker.
- Report payloads flow through the same Resend pipeline as security
  alerts (see app/core/alerting.py) so moderation sees them in the ops
  inbox alongside automated alerts.
"""
from __future__ import annotations

import asyncio
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.core.connections import manager as ws_manager
from app.core.database import get_db
from app.core.ids import user_object_id
from app.core.security import decode_token

router = APIRouter()
_dm_ws_connections: dict[str, set[WebSocket]] = {}


def _id_to_str(value: object) -> str:
    """Normalize user-id-like values to plain string ids."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _same_user(a: object, b: object) -> bool:
    return _id_to_str(a) == _id_to_str(b)


def _dm_ws_register(user_id: str, ws: WebSocket) -> None:
    _dm_ws_connections.setdefault(user_id, set()).add(ws)


def _dm_ws_unregister(user_id: str, ws: WebSocket) -> None:
    conns = _dm_ws_connections.get(user_id)
    if not conns:
        return
    conns.discard(ws)
    if not conns:
        _dm_ws_connections.pop(user_id, None)


async def _dm_ws_broadcast(user_id: str, payload: dict) -> None:
    conns = list(_dm_ws_connections.get(user_id, set()))
    for ws in conns:
        try:
            await ws.send_json(payload)
        except Exception:
            _dm_ws_unregister(user_id, ws)


async def _push_social_event(user_id: str, payload: dict) -> None:
    """Send a social event to all active sockets for a user."""
    sockets = list(getattr(ws_manager, "_connections", {}).get(user_id, set()))
    for ws in sockets:
        try:
            await ws.send_json(payload)
        except Exception:
            pass

# ── Auth helper (same contract as profile.get_current_user) ──────────────────


async def get_current_user(authorization: str = Header(...)) -> str:
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except Exception:
        raise HTTPException(401, "Invalid token")


async def _ws_auth(websocket: WebSocket) -> Optional[tuple[str, Optional[str], Optional[int]]]:
    """Authenticate websocket via ticket (preferred) or legacy token."""
    from app.core import ws_security

    ticket = websocket.query_params.get("ticket", "")
    if ticket:
        try:
            info = await ws_security.consume_ticket(ticket)
        except ws_security.TicketInvalid:
            await websocket.close(code=1008, reason="Bad ticket")
            return None
        return (info.user_id, info.sid, info.jwt_exp)

    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=1008, reason="Missing auth credential")
        return None
    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid auth token")
        return None
    user_id = str(payload.get("sub", ""))
    if not user_id:
        await websocket.close(code=1008, reason="Invalid auth token")
        return None
    return (user_id, payload.get("sid"), payload.get("exp"))


# ── Rank lookup (local copy to avoid circular import with profile.py) ────────


def _rank_for_elo(elo: int) -> str:
    if elo < 500:
        return "ROOKIE"
    if elo < 1000:
        return "SKILLED"
    if elo < 1500:
        return "ELITE"
    if elo < 2000:
        return "MYTHIC"
    if elo < 2500:
        return "CRACKED"
    return "CHRONICLE"


# ── Friend code management ───────────────────────────────────────────────────

_CODE_ALPHABET = string.ascii_uppercase + string.digits  # 36^8 ≈ 2.8e12 space
_CODE_LEN = 8


def _generate_friend_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LEN))


async def _ensure_friend_code(db, user_doc: dict) -> str:
    existing = user_doc.get("friend_code")
    if isinstance(existing, str) and len(existing) == _CODE_LEN:
        return existing
    # Generate a unique code with a handful of retries. Collisions in a
    # 36^8 space are astronomically unlikely but we'd rather loop than
    # crash a fresh account creation.
    for _ in range(8):
        code = _generate_friend_code()
        clash = await db.users.find_one({"friend_code": code}, {"_id": 1})
        if clash is None:
            await db.users.update_one(
                {"_id": user_doc["_id"]},
                {"$set": {"friend_code": code}},
            )
            return code
    # Extreme fallback — random collision-free enough to ship.
    code = _generate_friend_code() + secrets.token_hex(2).upper()
    await db.users.update_one(
        {"_id": user_doc["_id"]}, {"$set": {"friend_code": code}}
    )
    return code


# ── Helpers ──────────────────────────────────────────────────────────────────


def _public_user_slice(user: dict, online: bool) -> dict:
    """Minimal, public-facing projection of a user document.

    Exposes only cosmetic / profile-surface fields that are already
    visible to any opponent in matchmaking — no email, no totp, no
    rating internals, no legal flags, no anticheat signals.
    """
    elo = int(user.get("elo") or 0)
    return {
        "id":                 str(user["_id"]),
        "username":           user.get("username", ""),
        "level":              int(user.get("level") or 1),
        "elo":                elo,
        "rank":               _rank_for_elo(elo),
        "avatar":             user.get("avatar"),
        "banner":             user.get("banner", "default"),
        "border_style":       user.get("border_style", "none"),
        "title":              user.get("title", "newcomer"),
        "placement_matches":  int(user.get("placement_matches") or 0),
        "bio":                user.get("bio", ""),
        "online":             bool(online),
    }


async def _load_user(db, user_id: str) -> Optional[dict]:
    try:
        uid = _id_to_str(user_id)
        return await db.users.find_one({"_id": user_object_id(uid)})
    except Exception:
        return None


async def _is_blocked_either_way(db, a: str, b: str) -> bool:
    """True if either user has blocked the other. Cheap: one Mongo
    round-trip per side, but we only need to read the (small) blocked
    arrays on each doc."""
    a_id = _id_to_str(a)
    b_id = _id_to_str(b)
    docs = db.users.find(
        {"_id": {"$in": [user_object_id(a_id), user_object_id(b_id)]}},
        {"blocked": 1, "_id": 1},
    )
    async for doc in docs:
        blocked = {_id_to_str(x) for x in (doc.get("blocked") or [])}
        uid = str(doc["_id"])
        other = b_id if uid == a_id else a_id
        if other in blocked:
            return True
    return False


# ── Schemas ──────────────────────────────────────────────────────────────────


class FriendRequestBody(BaseModel):
    friend_code: str = Field(..., min_length=4, max_length=24)


class FriendInviteBody(BaseModel):
    friend_id: str
    board_mode: str = "5x5_6x6_7x7"


class ReportBody(BaseModel):
    user_id: str
    reason: str = Field(..., min_length=4, max_length=400)
    category: str = Field(default="abuse", min_length=2, max_length=48)
    room_code: Optional[str] = None


class BlockBody(BaseModel):
    user_id: str


class MessageBody(BaseModel):
    to_user: str
    text: str = Field(..., min_length=1, max_length=500)


class InviteResponseBody(BaseModel):
    invite_id: str


# ── Endpoints: friend code ───────────────────────────────────────────────────


@router.get("/me/code")
async def get_my_friend_code(user_id: str = Depends(get_current_user)):
    db = get_db()
    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")
    code = await _ensure_friend_code(db, me)
    return {"friend_code": code}


# ── Endpoints: list + presence ───────────────────────────────────────────────


@router.get("/list")
async def list_friends(user_id: str = Depends(get_current_user)):
    db = get_db()
    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")

    friends_ids: list[str] = [_id_to_str(x) for x in (me.get("friends") or [])]
    blocked_ids: list[str] = [_id_to_str(x) for x in (me.get("blocked") or [])]

    out: list[dict] = []
    if friends_ids:
        oids = []
        for fid in friends_ids:
            try:
                oids.append(ObjectId(fid))
            except Exception:
                continue
        cursor = db.users.find(
            {"_id": {"$in": oids}},
            {
                "_id": 1, "username": 1, "level": 1, "elo": 1,
                "avatar": 1, "banner": 1, "border_style": 1,
                "title": 1, "placement_matches": 1, "bio": 1,
            },
        )
        async for doc in cursor:
            uid = str(doc["_id"])
            online = ws_manager.has_active_connections(uid)
            out.append(_public_user_slice(doc, online))
        # Sort: online first, then alphabetical
        out.sort(key=lambda r: (not r["online"], r["username"].lower()))

    # Invite budget — 5 per rolling 24h
    used = me.get("friend_invites_used") or []
    now = datetime.utcnow()
    recent = [t for t in used if isinstance(t, datetime) and (now - t) < timedelta(hours=24)]
    invites_remaining = max(0, 5 - len(recent))

    user_oid = None
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        user_oid = None
    to_user_values = [user_id]
    if user_oid is not None:
        to_user_values.append(user_oid)
    unread_dm_count = await db.dm_messages.count_documents({
        "to_user": {"$in": to_user_values},
        "read_at": None,
    })

    return {
        "friends":           out,
        "blocked":           blocked_ids,
        "invites_remaining": invites_remaining,
        "invites_limit":     5,
        "unread_dm_count":   int(unread_dm_count or 0),
    }


# ── Endpoints: requests ──────────────────────────────────────────────────────


@router.post("/request")
async def send_friend_request(
    body: FriendRequestBody, user_id: str = Depends(get_current_user)
):
    db = get_db()
    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")

    code = (body.friend_code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Friend code required")

    target = await db.users.find_one({"friend_code": code})
    if not target:
        raise HTTPException(404, "No player found for that friend code")

    target_id = str(target["_id"])
    if target_id == user_id:
        raise HTTPException(400, "You cannot add yourself")

    # Already friends?
    if target_id in (me.get("friends") or []):
        return {"ok": True, "status": "already_friends"}

    # Blocked in either direction → pretend it worked but do nothing,
    # to avoid leaking the block state. (Same UX as most social apps.)
    if await _is_blocked_either_way(db, user_id, target_id):
        return {"ok": True, "status": "pending"}

    # Reverse request already pending? Auto-accept both sides.
    reverse = await db.friend_requests.find_one({
        "from_user": target_id,
        "to_user":   user_id,
        "status":    "pending",
    })
    if reverse:
        await _accept_mutual(db, target_id, user_id, reverse["_id"])
        return {"ok": True, "status": "accepted"}

    # Existing outgoing request?
    existing = await db.friend_requests.find_one({
        "from_user": user_id,
        "to_user":   target_id,
        "status":    "pending",
    })
    if existing:
        return {"ok": True, "status": "pending"}

    await db.friend_requests.insert_one({
        "from_user":  user_id,
        "to_user":    target_id,
        "created_at": datetime.utcnow(),
        "status":     "pending",
    })
    await _push_social_event(target_id, {
        "type": "friend_request_created",
        "from_user": user_id,
    })
    return {"ok": True, "status": "pending"}


async def _accept_mutual(db, from_id: str, to_id: str, request_id) -> None:
    """Add each user to the other's friends list and close the request."""
    # Capped friends list (500 per side). Anyone hitting that is almost
    # certainly abusing the system.
    for a, b in ((from_id, to_id), (to_id, from_id)):
        await db.users.update_one(
            {"_id": user_object_id(a)},
            {"$addToSet": {"friends": b}},
        )
    await db.friend_requests.update_one(
        {"_id": request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.utcnow()}},
    )


@router.post("/peer-request")
async def send_peer_request_from_match(
    user_id: str = Depends(get_current_user),
    body: dict = None,  # {"opponent_id": "..."}  # flexible shape
):
    """In-match friend request. The client sends this when the player
    clicks "Add Friend" on the opponent card during a live multiplayer
    game. We deliberately do not require a friend code — the opponent_id
    is pulled from the authenticated room state the frontend already
    has. The receiving side will see this request when they next reach
    a calm screen (home / lobby / career) after the current match ends.
    """
    db = get_db()
    opp_id = ((body or {}).get("opponent_id") or "").strip()
    if not opp_id:
        raise HTTPException(400, "opponent_id required")
    if opp_id == user_id:
        raise HTTPException(400, "Cannot send to self")

    opp = await _load_user(db, opp_id)
    if not opp:
        raise HTTPException(404, "Opponent not found")

    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")

    if opp_id in (me.get("friends") or []):
        return {"ok": True, "status": "already_friends"}

    if await _is_blocked_either_way(db, user_id, opp_id):
        return {"ok": True, "status": "pending"}

    # Dedup: at most one pending request in a given direction.
    existing = await db.friend_requests.find_one({
        "from_user": user_id,
        "to_user":   opp_id,
        "status":    "pending",
    })
    if existing:
        return {"ok": True, "status": "pending"}

    reverse = await db.friend_requests.find_one({
        "from_user": opp_id,
        "to_user":   user_id,
        "status":    "pending",
    })
    if reverse:
        await _accept_mutual(db, opp_id, user_id, reverse["_id"])
        return {"ok": True, "status": "accepted"}

    await db.friend_requests.insert_one({
        "from_user":   user_id,
        "to_user":     opp_id,
        "created_at":  datetime.utcnow(),
        "status":      "pending",
        "source":      "in_match",
    })
    await _push_social_event(opp_id, {
        "type": "friend_request_created",
        "from_user": user_id,
        "source": "in_match",
    })
    return {"ok": True, "status": "pending"}


@router.get("/requests")
async def list_friend_requests(user_id: str = Depends(get_current_user)):
    """Incoming pending friend requests for this user."""
    db = get_db()
    cursor = db.friend_requests.find(
        {"to_user": user_id, "status": "pending"}
    ).sort("created_at", -1).limit(50)

    rows: list[dict] = []
    async for doc in cursor:
        from_id = doc.get("from_user")
        user = await _load_user(db, from_id) if from_id else None
        if not user:
            continue
        rows.append({
            "id":         str(doc["_id"]),
            "from":       _public_user_slice(user, ws_manager.has_active_connections(str(user["_id"]))),
            "created_at": doc.get("created_at").isoformat() + "Z" if isinstance(doc.get("created_at"), datetime) else None,
            "source":     doc.get("source", "direct"),
        })
    return {"requests": rows}


@router.post("/requests/{req_id}/accept")
async def accept_friend_request(req_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(req_id)
    except Exception:
        raise HTTPException(400, "Invalid request id")
    doc = await db.friend_requests.find_one({"_id": oid})
    if not doc or not _same_user(doc.get("to_user"), user_id) or doc.get("status") != "pending":
        raise HTTPException(404, "Request not found")
    from_id = _id_to_str(doc["from_user"])
    await _accept_mutual(db, from_id, user_id, oid)
    await _push_social_event(user_id, {"type": "friend_request_updated", "status": "accepted"})
    await _push_social_event(from_id, {"type": "friend_request_updated", "status": "accepted"})
    return {"ok": True}


@router.post("/requests/{req_id}/decline")
async def decline_friend_request(req_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(req_id)
    except Exception:
        raise HTTPException(400, "Invalid request id")
    try:
        before = await db.friend_requests.find_one({"_id": oid}, {"from_user": 1})
    except Exception:
        before = None
    res = await db.friend_requests.update_one(
        {"_id": oid, "to_user": user_id, "status": "pending"},
        {"$set": {"status": "declined", "declined_at": datetime.utcnow()}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Request not found")
    from_id = _id_to_str((before or {}).get("from_user") or "")
    await _push_social_event(user_id, {"type": "friend_request_updated", "status": "declined"})
    if from_id:
        await _push_social_event(from_id, {"type": "friend_request_updated", "status": "declined"})
    return {"ok": True}


# ── Endpoints: remove + block ────────────────────────────────────────────────


@router.delete("/{friend_id}")
async def remove_friend(friend_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    # Defensive: validate ObjectId shape of the friend id even though
    # we store it as a string on the users doc.
    try:
        ObjectId(friend_id)
    except Exception:
        raise HTTPException(400, "Invalid friend id")
    for a, b in ((user_id, friend_id), (friend_id, user_id)):
        await db.users.update_one(
            {"_id": user_object_id(a)},
            {"$pull": {"friends": b}},
        )
    # Also clear any in-flight invites between the two.
    await db.friend_invites.update_many(
        {
            "$or": [
                {"from_user": user_id, "to_user": friend_id},
                {"from_user": friend_id, "to_user": user_id},
            ],
            "status": "pending",
        },
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}},
    )
    await _push_social_event(user_id, {"type": "friend_removed", "friend_id": friend_id})
    await _push_social_event(friend_id, {"type": "friend_removed", "friend_id": user_id})
    return {"ok": True}


@router.post("/block")
async def block_user(body: BlockBody, user_id: str = Depends(get_current_user)):
    db = get_db()
    target = (body.user_id or "").strip()
    if not target or target == user_id:
        raise HTTPException(400, "Invalid user id")
    try:
        ObjectId(target)
    except Exception:
        raise HTTPException(400, "Invalid user id")

    # Blocking also implies un-friending in both directions.
    await db.users.update_one(
        {"_id": user_object_id(user_id)},
        {
            "$addToSet": {"blocked": target},
            "$pull":     {"friends": target},
        },
    )
    await db.users.update_one(
        {"_id": user_object_id(target)},
        {"$pull": {"friends": user_id}},
    )
    # Kill any pending requests / invites either direction.
    await db.friend_requests.update_many(
        {
            "$or": [
                {"from_user": user_id, "to_user": target},
                {"from_user": target, "to_user": user_id},
            ],
            "status": "pending",
        },
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}},
    )
    await db.friend_invites.update_many(
        {
            "$or": [
                {"from_user": user_id, "to_user": target},
                {"from_user": target, "to_user": user_id},
            ],
            "status": "pending",
        },
        {"$set": {"status": "cancelled", "cancelled_at": datetime.utcnow()}},
    )
    return {"ok": True}


@router.delete("/block/{target_id}")
async def unblock_user(target_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": user_object_id(user_id)},
        {"$pull": {"blocked": target_id}},
    )
    return {"ok": True}


# ── Endpoints: invites (unranked, 5 per 24h) ─────────────────────────────────


@router.post("/invite")
async def send_friend_invite(
    body: FriendInviteBody, user_id: str = Depends(get_current_user)
):
    db = get_db()
    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")

    target_id = (body.friend_id or "").strip()
    if not target_id or target_id == user_id:
        raise HTTPException(400, "Invalid friend id")

    if target_id not in {_id_to_str(x) for x in (me.get("friends") or [])}:
        raise HTTPException(403, "You can only invite friends")

    if await _is_blocked_either_way(db, user_id, target_id):
        raise HTTPException(403, "Cannot invite — relationship is blocked")

    if not ws_manager.has_active_connections(target_id):
        raise HTTPException(409, "Your friend is offline")

    # Rate limit — 5 invites per rolling 24h.
    used = me.get("friend_invites_used") or []
    now = datetime.utcnow()
    recent = [t for t in used if isinstance(t, datetime) and (now - t) < timedelta(hours=24)]
    if len(recent) >= 5:
        raise HTTPException(429, "Daily invite limit reached (5 / 24h)")

    # Dedup — at most one pending invite at a time between two users.
    existing = await db.friend_invites.find_one({
        "from_user": user_id,
        "to_user":   target_id,
        "status":    "pending",
    })
    if existing and isinstance(existing.get("expires_at"), datetime) and existing["expires_at"] > now:
        return {"ok": True, "invite_id": str(existing["_id"]), "status": "pending"}

    doc = {
        "from_user":  user_id,
        "to_user":    target_id,
        "board_mode": body.board_mode or "5x5_6x6_7x7",
        "format":     "unranked",
        "status":     "pending",
        "created_at": now,
        "expires_at": now + timedelta(minutes=2),
    }
    result = await db.friend_invites.insert_one(doc)

    # Record the invite against the sender's rolling 24h budget.
    recent.append(now)
    await db.users.update_one(
        {"_id": user_object_id(user_id)},
        {"$set": {"friend_invites_used": recent}},
    )
    await _push_social_event(target_id, {
        "type": "friend_invite_created",
        "from_user": user_id,
        "board_mode": body.board_mode or "5x5_6x6_7x7",
    })

    return {"ok": True, "invite_id": str(result.inserted_id), "status": "pending"}


@router.get("/invites")
async def list_invites(user_id: str = Depends(get_current_user)):
    db = get_db()
    now = datetime.utcnow()
    cursor = db.friend_invites.find(
        {
            "to_user":    user_id,
            "status":     "pending",
            "expires_at": {"$gt": now},
        }
    ).sort("created_at", -1).limit(20)
    rows: list[dict] = []
    async for doc in cursor:
        sender = await _load_user(db, _id_to_str(doc.get("from_user") or ""))
        if not sender:
            continue
        rows.append({
            "id":         str(doc["_id"]),
            "from":       _public_user_slice(sender, True),
            "board_mode": doc.get("board_mode"),
            "expires_at": doc["expires_at"].isoformat() + "Z",
        })
    return {"invites": rows}


@router.post("/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, user_id: str = Depends(get_current_user)):
    """Creates a private matchmaking-style room shared by both friends.

    We lean on the existing /api/room/private flow conceptually but
    short-circuit it: because both clients are online, we write the room
    directly and return the room_code + slot so each client can open
    their websocket. To keep parity with matchmaking we set source =
    "friend_invite" which the rest of the game treats as private.
    """
    db = get_db()
    try:
        oid = ObjectId(invite_id)
    except Exception:
        raise HTTPException(400, "Invalid invite id")

    invite = await db.friend_invites.find_one({"_id": oid})
    if not invite or not _same_user(invite.get("to_user"), user_id) or invite.get("status") != "pending":
        raise HTTPException(404, "Invite not found")
    if isinstance(invite.get("expires_at"), datetime) and invite["expires_at"] < datetime.utcnow():
        await db.friend_invites.update_one({"_id": oid}, {"$set": {"status": "expired"}})
        raise HTTPException(410, "Invite expired")

    # Delegate room creation to room.py helpers without importing
    # cyclically: we construct the minimal starting doc ourselves
    # using the same public utilities room.py already uses.
    from app.routers import room as room_mod
    from app.game.engine import GameEngine  # type: ignore

    host_id = _id_to_str(invite["from_user"])
    host = await _load_user(db, host_id)
    guest = await _load_user(db, user_id)
    if not host or not guest:
        raise HTTPException(404, "Players not found")

    full_board_mode = invite.get("board_mode") or "5x5_6x6_7x7"
    start_mode = room_mod._starting_board_mode(full_board_mode)  # type: ignore[attr-defined]

    if start_mode == "5x5":
        from app.core.patterns import PATTERN_NAMES_5
        import random as _rnd
        selected = _rnd.sample(PATTERN_NAMES_5, 5)
    elif start_mode == "6x6":
        from app.core.patterns6 import PATTERN_NAMES_6
        selected = list(PATTERN_NAMES_6)
    else:
        from app.core.patterns7 import PATTERN_NAMES_7
        selected = list(PATTERN_NAMES_7)

    engine = GameEngine(board_mode=start_mode, selected_pattern_ids=selected)
    room_code = await room_mod._generate_unique_code(db)  # type: ignore[attr-defined]

    room = {
        "room_code":      room_code,
        "status":         "active",
        "format":         "unranked",
        "board_mode":     full_board_mode,
        "selected_patterns": selected,
        "source":         "friend_invite",
        "player1_id":     host_id,
        "player1_name":   host.get("username", "Host"),
        "player1_elo":    host.get("elo") or 500,
        "player1_avatar": host.get("avatar"),
        "player1_banner": host.get("banner", "default"),
        "player1_border": host.get("border_style", "none"),
        "player1_title":  host.get("title", "newcomer"),
        "player1_level":  int(host.get("level") or 1),
        "player1_placement_matches": int(host.get("placement_matches", 0)),
        "player2_id":     user_id,
        "player2_name":   guest.get("username", "Guest"),
        "player2_elo":    guest.get("elo") or 500,
        "player2_avatar": guest.get("avatar"),
        "player2_banner": guest.get("banner", "default"),
        "player2_border": guest.get("border_style", "none"),
        "player2_title":  guest.get("title", "newcomer"),
        "player2_level":  int(guest.get("level") or 1),
        "player2_placement_matches": int(guest.get("placement_matches", 0)),
        "board":          engine.board,
        "current_player": "P1",
        "moves_played":   0,
        "game_status":    "playing",
        "game_number":    1,
        "match_history":  [],
        "move_log":       [],
        "series_winner":  None,
        "p1_series_points": 0,
        "p2_series_points": 0,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
        "awaiting_5x5_rules_ready": start_mode == "5x5",
        "awaiting_6x6_rules_ready": False,
        "awaiting_7x7_rules_ready": False,
        "board_mode_full": full_board_mode,
        "p1_legs_won": 0,
        "p2_legs_won": 0,
        "series_g1_move_played": False,
        "p1_time_used_ms": 0,
        "p2_time_used_ms": 0,
        "turn_started_at_ms": int(datetime.utcnow().timestamp() * 1000),
        "created_at":     datetime.utcnow(),
    }
    await db.rooms.insert_one(room)

    await db.friend_invites.update_one(
        {"_id": oid},
        {"$set": {
            "status": "accepted",
            "accepted_at": datetime.utcnow(),
            "room_code": room_code,
        }},
    )
    await _push_social_event(user_id, {"type": "friend_invite_updated", "status": "accepted"})
    await _push_social_event(host_id, {"type": "friend_invite_updated", "status": "accepted"})

    # Nudge the host: if their socket is up, push a `friend_invite_accepted`
    # message so their client can jump straight into the match-found flow.
    for sockets in list(getattr(ws_manager, "_connections", {}).get(host_id, set())):
        try:
            await sockets.send_json({
                "type":       "friend_invite_accepted",
                "room_code":  room_code,
                "slot":       "P1",
                "board_mode": full_board_mode,
                "opponent":   _public_user_slice(guest, True),
            })
        except Exception:
            pass

    return {
        "ok":         True,
        "room_code":  room_code,
        "player_slot": "P2",
        "board_mode": full_board_mode,
    }


@router.post("/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(invite_id)
    except Exception:
        raise HTTPException(400, "Invalid invite id")
    try:
        before = await db.friend_invites.find_one({"_id": oid}, {"from_user": 1})
    except Exception:
        before = None
    res = await db.friend_invites.update_one(
        {"_id": oid, "to_user": user_id, "status": "pending"},
        {"$set": {"status": "declined", "declined_at": datetime.utcnow()}},
    )
    if res.modified_count == 0:
        raise HTTPException(404, "Invite not found")
    from_id = _id_to_str((before or {}).get("from_user") or "")
    await _push_social_event(user_id, {"type": "friend_invite_updated", "status": "declined"})
    if from_id:
        await _push_social_event(from_id, {"type": "friend_invite_updated", "status": "declined"})
    return {"ok": True}


# ── Endpoints: report ────────────────────────────────────────────────────────


@router.post("/report")
async def report_player(body: ReportBody, user_id: str = Depends(get_current_user)):
    db = get_db()
    target = (body.user_id or "").strip()
    if not target or target == user_id:
        raise HTTPException(400, "Invalid user id")
    try:
        ObjectId(target)
    except Exception:
        raise HTTPException(400, "Invalid user id")

    target_doc = await _load_user(db, target)
    if not target_doc:
        raise HTTPException(404, "User not found")

    reason = (body.reason or "").strip()
    category = (body.category or "abuse").strip().lower()
    room_code = (body.room_code or "").strip().upper() or None

    doc = {
        "from_user":  user_id,
        "to_user":    target,
        "reason":     reason[:400],
        "category":   category[:48],
        "room_code":  room_code,
        "created_at": datetime.utcnow(),
    }
    await db.player_reports.insert_one(doc)

    # Fire an ops email through the existing alerting pipeline. We use
    # severity "warn" + a dedicated event type so the Redis dedup bucket
    # is sensible (same attacker reported many times still pages once
    # per throttle window, which is what we want).
    try:
        from app.core import alerting as _alerting
        alert_doc = {
            "event_type": "user.report",
            "severity":   "alert",  # force send; bypasses the warn allowlist
            "at":         doc["created_at"],
            "user_id":    target,  # the REPORTED user — ops needs to review them
            "meta": {
                "reporter_id": user_id,
                "reported_id": target,
                "reason":      reason[:300],
                "category":    category[:48],
                "room_code":   room_code or "",
            },
        }
        _alerting.maybe_alert(alert_doc)
    except Exception:
        pass

    return {"ok": True}


# ── Endpoints: public profile / career (friends-only) ────────────────────────


async def _assert_friend_view(db, viewer: str, target: str) -> dict:
    """Guard for read-only friend views. Friends or self can view;
    blocked-either-way gets a generic 404."""
    if viewer != target:
        viewer_doc = await _load_user(db, viewer)
        if not viewer_doc:
            raise HTTPException(404, "User not found")
        if target not in (viewer_doc.get("friends") or []):
            raise HTTPException(403, "Only friends can view this profile")
        if await _is_blocked_either_way(db, viewer, target):
            raise HTTPException(404, "User not found")
    target_doc = await _load_user(db, target)
    if not target_doc:
        raise HTTPException(404, "User not found")
    return target_doc


@router.get("/profile/{target_id}")
async def friend_profile(target_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    target = await _assert_friend_view(db, user_id, target_id)
    online = ws_manager.has_active_connections(target_id)
    slice_ = _public_user_slice(target, online)
    # A few extra fields that are fine to share with friends:
    slice_["wins"]   = int(target.get("wins") or 0)
    slice_["losses"] = int(target.get("losses") or 0)
    slice_["draws"]  = int(target.get("draws") or 0)
    return {"profile": slice_}


@router.get("/career/{target_id}")
async def friend_career(target_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    await _assert_friend_view(db, user_id, target_id)
    # Re-use the match_history projection used in profile.py/get_career
    # but scoped to this target's user_id.
    try:
        oid = user_object_id(target_id)
    except Exception:
        raise HTTPException(400, "Invalid user id")
    query = {"user_id": {"$in": [target_id, oid]}}
    cursor = db.match_history.find(query).sort("played_at", -1).limit(10)
    matches = []
    async for doc in cursor:
        matches.append({
            "id":                str(doc["_id"]) if doc.get("_id") is not None else "",
            "opponent_username": doc.get("opponent_username", "Unknown"),
            "opponent_elo":      doc.get("opponent_elo", 100),
            "result":            doc.get("result", "loss"),
            "elo_before":        doc.get("elo_before", 100),
            "elo_after":         doc.get("elo_after", 100),
            "elo_delta":         doc.get("elo_delta", 0),
            "mode":              doc.get("mode", "unranked"),
            "played_at":         doc.get("played_at", "").isoformat() if doc.get("played_at") else "",
            "was_placement":     doc.get("was_placement", False),
            "placement_matches": doc.get("placement_matches", 0),
        })
    return {"history": matches}


# ── Endpoints: DMs ───────────────────────────────────────────────────────────


@router.post("/messages")
async def send_message(body: MessageBody, user_id: str = Depends(get_current_user)):
    db = get_db()
    target = (body.to_user or "").strip()
    if not target or target == user_id:
        raise HTTPException(400, "Invalid recipient")

    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")
    if target not in (me.get("friends") or []):
        raise HTTPException(403, "You can only message friends")
    if await _is_blocked_either_way(db, user_id, target):
        raise HTTPException(403, "Cannot message — relationship is blocked")

    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "Message required")

    now = datetime.utcnow()
    await db.dm_messages.insert_one({
        "from_user":  user_id,
        "to_user":    target,
        "text":       text[:500],
        "created_at": now,
        "read_at":    None,
    })

    payload = {
        "type": "dm_message",
        "message": {
            "from_user": user_id,
            "to_user": target,
            "text": text[:500],
            "created_at": now.isoformat() + "Z",
        },
    }
    await _dm_ws_broadcast(user_id, payload)
    await _dm_ws_broadcast(target, payload)
    await _push_social_event(target, {
        "type": "friend_dm_received",
        "from_user": user_id,
    })
    await _push_social_event(user_id, {
        "type": "friend_dm_sent",
        "to_user": target,
    })
    return {"ok": True}


@router.get("/messages/{target_id}")
async def list_messages(target_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    me = await _load_user(db, user_id)
    if not me:
        raise HTTPException(404, "User not found")
    if target_id not in {_id_to_str(x) for x in (me.get("friends") or [])}:
        raise HTTPException(403, "You can only read messages from friends")

    user_oid = None
    target_oid = None
    try:
        user_oid = ObjectId(user_id)
    except Exception:
        user_oid = None
    try:
        target_oid = ObjectId(target_id)
    except Exception:
        target_oid = None

    from_user_values = [user_id]
    to_user_values = [target_id]
    if user_oid is not None:
        from_user_values.append(user_oid)
        to_user_values.append(user_oid)
    if target_oid is not None:
        from_user_values.append(target_oid)
        to_user_values.append(target_oid)

    cursor = db.dm_messages.find({
        "$or": [
            {"from_user": {"$in": from_user_values}, "to_user": {"$in": to_user_values}},
            {"from_user": {"$in": to_user_values}, "to_user": {"$in": from_user_values}},
        ],
    }).sort("created_at", 1).limit(200)

    rows: list[dict] = []
    async for doc in cursor:
        rows.append({
            "from_user":  _id_to_str(doc.get("from_user")),
            "to_user":    _id_to_str(doc.get("to_user")),
            "text":       doc.get("text", ""),
            "created_at": doc["created_at"].isoformat() + "Z" if isinstance(doc.get("created_at"), datetime) else None,
        })

    # Mark inbound messages as read in the background.
    # Motor may return a Future-like awaitable here; wrap it inside a real
    # coroutine so asyncio.create_task receives a coroutine object.
    async def _mark_inbound_read() -> None:
        await db.dm_messages.update_many(
            {
                "from_user": {"$in": to_user_values},
                "to_user": {"$in": from_user_values},
                "read_at": None,
            },
            {"$set": {"read_at": datetime.utcnow()}},
        )

    asyncio.create_task(_mark_inbound_read())
    return {"messages": rows}


@router.websocket("/ws/dm")
async def dm_websocket(websocket: WebSocket):
    from app.core import ws_security

    auth_res = await _ws_auth(websocket)
    if auth_res is None:
        return
    ws_user_id, token_sid, jwt_exp = auth_res

    await websocket.accept()
    db = get_db()

    if token_sid:
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(ws_user_id)}, {"current_session_id": 1})
        except Exception:
            user_doc = None
        if not user_doc or user_doc.get("current_session_id") != token_sid:
            await websocket.send_json({"type": "duplicate_session", "reason": "Token no longer valid"})
            await websocket.close(code=4001)
            return

    jwt_watchdog = await ws_security.schedule_jwt_expiry_close(websocket, jwt_exp)
    _dm_ws_register(ws_user_id, websocket)
    ws_manager.register(ws_user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 2048:
                await websocket.close(code=1009, reason="Frame too large")
                break
            if data.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        _dm_ws_unregister(ws_user_id, websocket)
        ws_manager.unregister(ws_user_id, websocket)
        if jwt_watchdog and not jwt_watchdog.done():
            jwt_watchdog.cancel()
