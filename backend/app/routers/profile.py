from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, ConfigDict, Field
from app.core.database import get_db
from app.core.ids import user_object_id
from app.core.security import decode_token
from app.core.mission_xp import mission_xp_for_mission_id
from app.core.bot_rewards import (
    ALL_BOT_IDS,
    BOT_XP_REWARD,
    all_bots_defeated,
    is_bot_unlocked,
    is_valid_bot_id,
)
from app.game.ranked_penalties import user_ranked_allowed
from app.routers.game import add_xp
from datetime import datetime

# Banner IDs eligible for the free-banner reward after clearing all AI bots.
# Must match `STORE_BANNERS`/`BANNERS` in the frontend; kept here as a literal
# set so we don't have to reach out to another module at request time.
_ELIGIBLE_REWARD_BANNERS: set[str] = {
    "default", "void_rift", "blood_moon", "phantom_strike", "solar_flare",
    "cryo_storm", "neon_circuit", "static_glitch", "golden_nexus",
    "plasma_core", "toxic_spill", "storm_protocol", "arctic_veil",
    "starfield", "digital_rain", "inferno",
}

router = APIRouter()

def get_rank(elo: int) -> str:
    if elo < 500:  return "NOVICE"
    if elo < 1000: return "ADVANCED"
    if elo < 1500: return "PROFESSIONAL"
    if elo < 2000: return "EMERALD"
    if elo < 2500: return "MASTER"
    return "LEGEND"

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        raise HTTPException(401, "Invalid token")

def _serialize_user(user: dict) -> dict:
    """Single source of truth for what the profile response looks like."""
    return {
        "id":                  str(user["_id"]),
        "username":            user["username"],
        "email":               user.get("email", ""),
        "level":               user.get("level", 1),
        "xp":                  user.get("xp", 0),
        "shards":              user.get("shards", 0),
        "protocredits":        user.get("protocredits", 0),
        "elo":                 user.get("elo"),
        "ranked_rating":       user.get("ranked_rating"),
        "rank":                get_rank(user.get("elo") if user.get("elo") is not None else 0),
        "ranked_ban_until":   (
            user.get("ranked_ban_until").isoformat() + "Z"
            if isinstance(user.get("ranked_ban_until"), datetime)
            else None
        ),
        "ranked_allowed":      user_ranked_allowed(user)[0],
        "wins":                user.get("wins", 0),
        "losses":              user.get("losses", 0),
        "draws":               user.get("draws", 0),
        "placement_matches":   user.get("placement_matches", 0),
        "is_placement":        user.get("placement_matches", 0) < 5,
        "rb_wins":             user.get("rb_wins", 0),
        "totp_enabled":        user.get("totp_enabled", False),
        "google_linked":       bool(user.get("google_id")),
        "bio":                 user.get("bio", ""),
        "avatar":              user.get("avatar", None),
        "username_changed_at": user.get("username_changed_at"),
        # ── cosmetics ──────────────────────────────────────────────────────
        "banner":              user.get("banner", "default"),
        "border_style":        user.get("border_style", "none"),
        "board_style":         user.get("board_style", "default"),
        "title":               user.get("title", "newcomer"),
        "purchased_items":     user.get("purchased_items", []),
        "legal_accepted":      user.get("legal_accepted", False),
        # ── AI bot progression ────────────────────────────────────────────
        # `bot_defeats` is a dict of { bot_id: true } for every bot that has
        # awarded its first-time XP prize. `bot_banner_reward` cycles through
        # None → "pending" (all bots cleared) → "claimed" (reward consumed).
        "bot_defeats":         user.get("bot_defeats") or {},
        "bot_banner_reward":   user.get("bot_banner_reward"),
    }


class ClaimMissionBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    period: str
    period_key: str = Field(..., alias="periodKey")
    mission_id: str = Field(..., alias="missionId")


@router.post("/claim-mission")
async def claim_mission_reward(data: ClaimMissionBody, user_id: str = Depends(get_current_user)):
    if data.period not in ("daily", "weekly", "permanent"):
        raise HTTPException(400, "Invalid period")
    if not (data.period_key or "").strip() or not (data.mission_id or "").strip():
        raise HTTPException(400, "periodKey and missionId required")

    xp_gain = mission_xp_for_mission_id(data.mission_id)
    if xp_gain is None:
        raise HTTPException(400, "Invalid mission id")

    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    claim_key = f"{data.period}:{data.period_key}:{data.mission_id}"
    claims = user.get("mission_claims") or {}
    if not isinstance(claims, dict):
        claims = {}

    if claims.get(claim_key):
        fresh = await db.users.find_one({"_id": oid}) or user
        return {
            "already_claimed": True,
            "xp_awarded": 0,
            "profile": _serialize_user(fresh),
        }

    prev_level = int(user.get("level", 1) or 1)
    prev_xp = int(user.get("xp", 0) or 0)
    new_level, new_xp = add_xp(prev_level, prev_xp, xp_gain)

    update_doc = {"$set": {"xp": new_xp, "level": new_level, f"mission_claims.{claim_key}": True}}
    if data.mission_id == "perm_rank_legend":
        update_doc["$inc"] = {"shards": 10000}

    await db.users.update_one({"_id": oid}, update_doc)
    fresh = await db.users.find_one({"_id": oid}) or user
    return {
        "already_claimed": False,
        "xp_awarded": xp_gain,
        "profile": _serialize_user(fresh),
    }


@router.get("/me")
async def get_profile(user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_object_id(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    return _serialize_user(user)


@router.get("/career")
async def get_career(user_id: str = Depends(get_current_user)):
    db = get_db()
    # Support both string and ObjectId for user_id to handle legacy data/migration
    oid = user_object_id(user_id)
    query = {"user_id": {"$in": [user_id, oid]}}
    cursor = db.match_history.find(query).sort("played_at", -1).limit(10)
    matches = []

    def _normalize_rounds(raw_rounds):
        if not isinstance(raw_rounds, list):
            return []
        normalized = []
        for round_item in raw_rounds:
            if not isinstance(round_item, dict):
                continue
            board = round_item.get("board")
            moves = round_item.get("moves")
            normalized.append(
                {
                    "winner": round_item.get("winner"),
                    "board": board if isinstance(board, list) else [],
                    "moves": moves if isinstance(moves, list) else [],
                    "board_mode": round_item.get("board_mode"),
                    "game_number": round_item.get("game_number"),
                }
            )
        return normalized

    async for doc in cursor:
        row = {
            "id": str(doc["_id"]) if doc.get("_id") is not None else "",
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
        }
        if doc.get("my_slot") in ("P1", "P2"):
            row["my_slot"] = doc["my_slot"]
        if doc.get("surrendered_by") in ("P1", "P2"):
            row["surrendered_by"] = doc["surrendered_by"]
        if doc.get("match_scope"):
            row["match_scope"] = doc["match_scope"]
        if doc.get("banned_pattern_7x7"):
            bp = doc["banned_pattern_7x7"]
            if bp == "H": bp = "Y"
            row["banned_pattern_7x7"] = bp
        if doc.get("board_mode"):
            row["board_mode"] = doc["board_mode"]
        if doc.get("game_number") is not None:
            row["game_number"] = doc["game_number"]
        if doc.get("match_rounds") is not None:
            row["match_rounds"] = _normalize_rounds(doc.get("match_rounds"))
        if doc.get("board_mode_full"):
            row["board_mode_full"] = doc["board_mode_full"]
        if doc.get("protocolbreaker_played") is not None:
            row["protocolbreaker_played"] = doc["protocolbreaker_played"]
        if doc.get("limitbreaker_played") is not None:
            row["limitbreaker_played"] = doc["limitbreaker_played"]
        if doc.get("p1_time_used_ms") is not None:
            row["p1_time_used_ms"] = int(doc.get("p1_time_used_ms") or 0)
        if doc.get("p2_time_used_ms") is not None:
            row["p2_time_used_ms"] = int(doc.get("p2_time_used_ms") or 0)
        matches.append(row)
    return matches


@router.get("/leaderboard")
async def leaderboard():
    db = get_db()
    players = []
    async for u in db.users.find({"elo": {"$ne": None, "$exists": True}}).sort("elo", -1).limit(20):
        is_p = u.get("placement_matches", 0) < 5
        players.append({
            "username": u["username"],
            "elo":      "?" if is_p else u.get("elo"),
            "rank":     "PLACEMENT" if is_p else get_rank(u.get("elo") if u.get("elo") is not None else 0),
            "wins":     u.get("wins", 0),
            "is_placement": is_p
        })
    return players


from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import re

BAD_WORDS = [
    "fuck","shit","ass","bitch","cunt","dick","cock","pussy","bastard",
    "nigger","nigga","faggot","fag","retard","rape","porn","nude",
]

def contains_profanity(text: str) -> bool:
    lower = re.sub(r'[^a-z0-9\s]', '', text.lower())
    return any(re.search(rf'\b{w}\b', lower) for w in BAD_WORDS)

# ── Valid cosmetic IDs (must match frontend definitions) ──────────────────────
VALID_BANNERS = {
    "default", "crimson", "emerald", "ocean", "void", "gold", "aurora", "nebula",
    "void_rift", "blood_moon", "phantom_strike", "solar_flare", "cryo_storm", "neon_circuit",
    "static_glitch", "golden_nexus",
    "plasma_core",
    "toxic_spill",
    "storm_protocol",
    "arctic_veil",
    "starfield",
    "digital_rain",
    "inferno",
}
VALID_BORDERS = {
    "none", "silver", "blue_pulse", "emerald_veil",
    "crimson_flame", "violet_arc", "gold_sovereign", "rainbow_halo",
}
VALID_BOARD_STYLES = [
    "default",
    "marble",
    "forest",
    "void",
    "gold",
    "ice",
    "red_grid",
    "ice_grid",
    "glacier_grid",
    "bloodmoon_grid",
    "egypt_grid",
    "synthwave_grid",
    "matrix_grid",
    "arcane_grid",
    "bio_grid",
    "forge_grid",
    "void_grid",
    "tokyo_grid",
    "space_grid",
    "pixel_grid",
]
VALID_TITLES = {
    "newcomer", "sharpshooter", "strategist", "gladiator", "emerald_eye",
    "penta_master", "the_legend", "centurion", "unbreakable", "veteran",
    "protocol", "architect",
}


class UpdateProfileRequest(BaseModel):
    # profile tab
    bio:          Optional[str] = None
    username:     Optional[str] = None
    avatar:       Optional[str] = None   # Supabase CDN URL only
    # cosmetics tabs
    banner:       Optional[str] = None
    border_style: Optional[str] = None
    board_style:  Optional[str] = None
    title:        Optional[str] = None


@router.put("/me")
async def update_profile(
    data: UpdateProfileRequest,
    user_id: str = Depends(get_current_user),
):
    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    updates = {}

    # ── Bio ──────────────────────────────────────────────────────────────────
    if data.bio is not None:
        if len(data.bio) > 200:
            raise HTTPException(400, "Bio must be under 200 characters")
        if contains_profanity(data.bio):
            raise HTTPException(400, "Bio contains inappropriate content")
        updates["bio"] = data.bio

    # ── Username ─────────────────────────────────────────────────────────────
    if data.username is not None:
        u = data.username.strip()
        if len(u) < 3:
            raise HTTPException(400, "Username must be at least 3 characters")
        if len(u) > 12:
            raise HTTPException(400, "Username must be at most 12 characters")
        if not re.match(r'^[\w@]+$', u):
            raise HTTPException(400, "Only letters, numbers, @ and _ are allowed")
        if re.search(r'[^\x00-\x7F]', u):
            raise HTTPException(400, "Emojis are not allowed in usernames")
        if contains_profanity(u):
            raise HTTPException(400, "Username contains inappropriate content")
        if await db.users.find_one({"username": u, "_id": {"$ne": oid}}):
            raise HTTPException(400, "Username already taken")
        last_change = user.get("username_changed_at")
        if last_change:
            cooldown_end = last_change + timedelta(days=90)
            if datetime.utcnow() < cooldown_end:
                days_left = (cooldown_end - datetime.utcnow()).days + 1
                raise HTTPException(400, f"Username can only be changed every 90 days. {days_left} days remaining.")
        updates["username"] = u
        updates["username_changed_at"] = datetime.utcnow()

    # ── Avatar ───────────────────────────────────────────────────────────────
    if data.avatar is not None:
        # Preferred format: Supabase/public URL.
        is_http_url = data.avatar.startswith("https://") or data.avatar.startswith("http://")
        is_base64 = bool(re.match(r'^data:image/(jpeg|png|webp);base64,', data.avatar))

        if is_http_url:
            # Optional hard guard: reject unexpectedly long URLs.
            if len(data.avatar) > 2048:
                raise HTTPException(400, "Avatar URL is too long")
            updates["avatar"] = data.avatar
        elif is_base64:
            # Backward compatibility: do NOT store base64 blobs in MongoDB.
            # Ignore this field so profile updates can still succeed from stale clients.
            pass
        else:
            raise HTTPException(400, "Avatar must be a valid URL")

    # ── Banner ───────────────────────────────────────────────────────────────
    if data.banner is not None:
        if data.banner not in VALID_BANNERS:
            raise HTTPException(400, "Invalid banner")
        updates["banner"] = data.banner

    # ── Border style ─────────────────────────────────────────────────────────
    if data.border_style is not None:
        if data.border_style not in VALID_BORDERS:
            raise HTTPException(400, "Invalid border style")
        updates["border_style"] = data.border_style

    # ── Board style ──────────────────────────────────────────────────────────
    if data.board_style is not None:
        if data.board_style not in VALID_BOARD_STYLES:
            raise HTTPException(400, "Invalid board style")
        updates["board_style"] = data.board_style

    # ── Title ────────────────────────────────────────────────────────────────
    if data.title is not None:
        if data.title not in VALID_TITLES:
            raise HTTPException(400, "Invalid title")
        updates["title"] = data.title

    if not updates:
        # No-op update (e.g. stale client sent base64 avatar we intentionally ignored).
        # Return current profile instead of failing the request.
        return _serialize_user(user)

    await db.users.update_one({"_id": oid}, {"$set": updates})
    user = await db.users.find_one({"_id": oid})
    return _serialize_user(user)


# ── AI bot defeat claim ──────────────────────────────────────────────────────
# Client calls this once on the first ever series win against a given bot. The
# endpoint is idempotent: claiming an already-defeated bot returns the current
# profile with `xp_awarded = 0` and does not error.
class ClaimBotDefeatBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    bot_id: str = Field(..., alias="botId")


@router.post("/claim-bot-defeat")
async def claim_bot_defeat(
    data: ClaimBotDefeatBody,
    user_id: str = Depends(get_current_user),
):
    bot_id = (data.bot_id or "").strip().lower()
    if not is_valid_bot_id(bot_id):
        raise HTTPException(400, "Unknown bot id")

    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    defeats = user.get("bot_defeats") or {}
    if not isinstance(defeats, dict):
        defeats = {}

    # Server-side unlock gate: the client UI already hides locked bots, but we
    # re-check so a tampered request can't skip the chain.
    if not is_bot_unlocked(defeats, bot_id):
        raise HTTPException(400, "Bot is not unlocked yet")

    # Idempotent: already claimed → return current profile untouched.
    if defeats.get(bot_id):
        return {
            "already_claimed": True,
            "xp_awarded": 0,
            "banner_reward_unlocked": user.get("bot_banner_reward") == "pending",
            "profile": _serialize_user(user),
        }

    xp_gain = BOT_XP_REWARD.get(bot_id, 0)
    prev_level = int(user.get("level", 1) or 1)
    prev_xp = int(user.get("xp", 0) or 0)
    new_level, new_xp = add_xp(prev_level, prev_xp, xp_gain)

    new_defeats = {**defeats, bot_id: True}
    set_doc = {
        "xp": new_xp,
        "level": new_level,
        f"bot_defeats.{bot_id}": True,
    }
    # Promote the banner reward state only on the transition from incomplete
    # → complete, and never overwrite a "claimed" state back to "pending".
    banner_reward_unlocked_now = False
    if all_bots_defeated(new_defeats) and not user.get("bot_banner_reward"):
        set_doc["bot_banner_reward"] = "pending"
        banner_reward_unlocked_now = True

    await db.users.update_one({"_id": oid}, {"$set": set_doc})
    fresh = await db.users.find_one({"_id": oid}) or user
    return {
        "already_claimed": False,
        "xp_awarded": xp_gain,
        "banner_reward_unlocked": banner_reward_unlocked_now or fresh.get("bot_banner_reward") == "pending",
        "profile": _serialize_user(fresh),
    }


# ── Free banner redemption (one-time, after all bots defeated) ───────────────
class ClaimBotBannerBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    banner_id: str = Field(..., alias="bannerId")


@router.post("/claim-bot-banner-reward")
async def claim_bot_banner_reward(
    data: ClaimBotBannerBody,
    user_id: str = Depends(get_current_user),
):
    banner_id = (data.banner_id or "").strip().lower()
    if banner_id not in _ELIGIBLE_REWARD_BANNERS:
        raise HTTPException(400, "Unknown banner id")

    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    # Must have cleared every bot AND have a pending (never-claimed) reward.
    defeats = user.get("bot_defeats") or {}
    if not isinstance(defeats, dict) or not all_bots_defeated(defeats):
        raise HTTPException(400, "Defeat every AI bot to unlock this reward")
    if user.get("bot_banner_reward") != "pending":
        raise HTTPException(400, "Banner reward already claimed")

    owned = set(user.get("purchased_items") or [])
    update_doc: dict = {
        "$set": {"bot_banner_reward": "claimed"},
    }
    # Only add to the owned set if the player doesn't already own the banner.
    # If they do, the reward is still consumed (the user explicitly chose it).
    if banner_id not in owned:
        update_doc["$addToSet"] = {"purchased_items": banner_id}

    await db.users.update_one({"_id": oid}, update_doc)
    fresh = await db.users.find_one({"_id": oid}) or user
    return {"ok": True, "profile": _serialize_user(fresh)}