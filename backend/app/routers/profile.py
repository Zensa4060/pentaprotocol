from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, ConfigDict, Field
from app.core.database import get_db
from app.core.ids import user_object_id
from app.core.mission_xp import mission_xp_for_mission_id
from app.core.bot_rewards import (
    ALL_BOT_IDS,
    BOT_XP_REWARD,
    MYTHOS_FIRST_DEFEAT_XP_BONUS,
    REWARD_SLOTS,
    all_bots_defeated,
    has_defeated,
    is_bot_unlocked,
    is_valid_bot_id,
    reward_slot_for_bot,
)
from app.game.ranked_penalties import user_ranked_allowed
from app.routers.game import add_xp
from datetime import datetime

# Banner IDs eligible for the free-banner reward (awarded on defeating JR).
# Must match `STORE_BANNERS`/`BANNERS` in the frontend.
_ELIGIBLE_REWARD_BANNERS: set[str] = {
    "default", "void_rift", "blood_moon", "phantom_strike", "solar_flare",
    "cryo_storm", "neon_circuit", "static_glitch", "golden_nexus",
    "plasma_core", "toxic_spill", "storm_protocol", "arctic_veil",
    "starfield", "digital_rain", "inferno",
}

# Coin-toss skin bundle IDs eligible for the free-coin-toss reward
# (awarded on defeating HIM). Currently only the Wraith-King bundle exists.
_ELIGIBLE_REWARD_COIN_TOSS: set[str] = {
    "coin_bundle_wraith_king",
}

# Board-skin IDs eligible for the free-board-skin reward (awarded on defeating
# HER). Mirrors the `boardId` field of each bundle in the frontend store.
_ELIGIBLE_REWARD_BOARD_SKINS: set[str] = {
    "red_grid", "ice_grid", "glacier_grid", "bloodmoon_grid", "egypt_grid",
    "synthwave_grid", "matrix_grid", "arcane_grid", "bio_grid", "forge_grid",
    "void_grid", "space_grid", "pixel_grid", "tokyo_grid",
}


def _normalize_bot_rewards(user: dict) -> dict:
    """Return the per-slot reward state for the given user doc.

    Keeps the legacy `bot_banner_reward` field working for users who earned
    the banner before the per-tier redesign: we mirror its value into
    `bot_rewards.banner` if the new field is missing.
    """
    raw = user.get("bot_rewards")
    rewards: dict = {slot: None for slot in REWARD_SLOTS}
    if isinstance(raw, dict):
        for slot in REWARD_SLOTS:
            val = raw.get(slot)
            if val in ("pending", "claimed"):
                rewards[slot] = val
    # Legacy shim: the old single-field system used `bot_banner_reward`
    # for the "all 9 bots defeated" banner reward. Map it onto the new
    # `banner` slot so we don't lose in-flight rewards during the rollout.
    legacy = user.get("bot_banner_reward")
    if rewards["banner"] is None and legacy in ("pending", "claimed"):
        rewards["banner"] = legacy
    return rewards

router = APIRouter()

def get_rank(elo: int) -> str:
    if elo < 500:  return "ROOKIE"
    if elo < 1000: return "SKILLED"
    if elo < 1500: return "ELITE"
    if elo < 2000: return "MYTHIC"
    if elo < 2500: return "CRACKED"
    return "CHRONICLE"

# Cookie-first shared auth dependency (review F-03). Re-exported so
# existing ``Depends(get_current_user)`` call sites in this module keep
# resolving without further changes.
from app.core.auth_dep import get_current_user  # noqa: F401 — re-exported

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
        "legal_accepted_version": int(user.get("legal_accepted_version", 0) or 0),
        # Onboarding tutorial state: "none" | "skipped" | "completed".
        # Legacy users (created before this field existed) are surfaced as
        # "completed" so the first-run gate does not trigger for them.
        "onboarding_tutorial": user.get("onboarding_tutorial") or "completed",
        # ── account review (Phase 2.6) ───────────────────────────────────
        # Surfaced so the client can render a passive "under review" banner.
        # We deliberately do not expose the raw anticheat_score — the
        # boolean is enough for UX, and the score is an internal trust
        # signal we'd rather not teach cheaters to reverse-engineer.
        "under_review":        bool(user.get("under_review")),
        # ── AI bot progression ────────────────────────────────────────────
        # `bot_defeats` is a dict of { bot_id: true } for every bot that has
        # awarded its first-time XP prize. `bot_rewards` is a per-slot map
        # { banner | coin_toss | board_skin: null | "pending" | "claimed" }
        # where each slot is promoted to "pending" on defeating JR / HIM / HER
        # respectively and "claimed" once the player consumes the reward.
        "bot_defeats":         user.get("bot_defeats") or {},
        "bot_rewards":         _normalize_bot_rewards(user),
        # Kept for backward compat with any older clients still reading the
        # single-field banner reward; equals `bot_rewards.banner`.
        "bot_banner_reward":   _normalize_bot_rewards(user)["banner"],
        # ── social (friends system) ─────────────────────────────────────
        # Surfaced on /me so the client can render the "Friend Code" copy
        # pill on the profile/friends screen without a second request.
        # Nullable for legacy accounts that haven't hit the friends
        # router yet; GET /api/friends/me/code will back-fill one.
        "friend_code":         user.get("friend_code"),
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

    try:
        from app.core import economy_watch
        if xp_gain > 0:
            await economy_watch.record_award(
                db,
                user_id=str(user_id),
                kind=economy_watch.KIND_XP_EARNED,
                amount=int(xp_gain),
                source=f"mission:{data.mission_id}",
            )
        if data.mission_id == "perm_rank_legend":
            await economy_watch.record_award(
                db,
                user_id=str(user_id),
                kind=economy_watch.KIND_SHARDS_EARNED,
                amount=10000,
                source="mission:perm_rank_legend",
            )
    except Exception:
        pass

    return {
        "already_claimed": False,
        "xp_awarded": xp_gain,
        "profile": _serialize_user(fresh),
    }


_VALID_TUTORIAL_STATES = {"none", "skipped", "completed"}


class TutorialStateBody(BaseModel):
    state: str = Field(..., description='"none" | "skipped" | "completed"')


@router.post("/tutorial-state")
async def set_tutorial_state(
    data: TutorialStateBody,
    user_id: str = Depends(get_current_user),
):
    """Record the user's first-run tutorial decision.

    The frontend calls this when the player either picks "Skip tutorial"
    on the gate screen or completes the full walkthrough. "none" is kept
    as a legal value so an admin tool could reset a user back to the
    onboarding flow, but normal clients should only send skipped/completed.
    """
    state = (data.state or "").strip().lower()
    if state not in _VALID_TUTORIAL_STATES:
        raise HTTPException(400, "Invalid tutorial state")
    db = get_db()
    oid = user_object_id(user_id)
    res = await db.users.update_one(
        {"_id": oid},
        {"$set": {
            "onboarding_tutorial": state,
            "onboarding_tutorial_updated_at": datetime.utcnow(),
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    fresh = await db.users.find_one({"_id": oid})
    return {"ok": True, "profile": _serialize_user(fresh) if fresh else None}


@router.get("/me")
async def get_profile(user_id: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"_id": user_object_id(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    # Lazy decay of the Phase 2.6 anticheat score on every profile read
    # so a user whose flags have aged out sees the banner disappear
    # without requiring admin intervention.
    try:
        from app.core import anticheat_heuristics as _ach
        user = await _ach.refresh_user_score(db, user)
    except Exception:
        pass
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


@router.get("/head-to-head/{opponent_id}")
async def head_to_head(
    opponent_id: str,
    user_id: str = Depends(get_current_user),
):
    """Return the head-to-head record between the requesting user and
    `opponent_id`. Only counts genuine player-vs-player matches — bot /
    AI rows in `match_history` are filtered out so the sidebar never
    shows bogus history against a queued opponent who happens to share
    a username with a previously played bot.

    Returns:
        {
            "wins": int,           # # times *requester* won
            "losses": int,         # # times *requester* lost
            "draws": int,
            "total": int,
            "recent": [str, ...],  # latest-first, max 5, values "win"/"loss"/"draw"
        }
    """
    db = get_db()
    if not opponent_id or opponent_id == user_id:
        return {"wins": 0, "losses": 0, "draws": 0, "total": 0, "recent": []}

    # Support both string and ObjectId IDs for legacy rows.
    user_oid = user_object_id(user_id)
    opp_oid = user_object_id(opponent_id)
    user_vals: list = [user_id]
    if user_oid is not None:
        user_vals.append(user_oid)
    opp_vals: list = [opponent_id]
    if opp_oid is not None:
        opp_vals.append(opp_oid)

    # Exclude AI / bot rows. The career writer stamps these with a
    # `bot_*` mode (e.g. "bot_unranked", "bot_singleplayer", "bot").
    query = {
        "user_id":     {"$in": user_vals},
        "opponent_id": {"$in": opp_vals},
        "$nor": [
            {"mode": {"$regex": r"^bot"}},
        ],
    }

    wins = 0
    losses = 0
    draws = 0
    recent: list[str] = []
    cursor = (
        db.match_history
          .find(query, {"result": 1, "played_at": 1})
          .sort("played_at", -1)
    )
    async for doc in cursor:
        r = (doc.get("result") or "").lower()
        if r == "win":
            wins += 1
        elif r in ("loss", "lose"):
            losses += 1
        elif r == "draw":
            draws += 1
        else:
            continue
        if len(recent) < 5:
            recent.append("draw" if r == "draw" else ("win" if r == "win" else "loss"))

    total = wins + losses + draws
    return {
        "wins":   int(wins),
        "losses": int(losses),
        "draws":  int(draws),
        "total":  int(total),
        "recent": recent,
    }


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

    rewards = _normalize_bot_rewards(user)

    # Idempotent: already defeated → return current profile untouched.
    if defeats.get(bot_id):
        return {
            "already_claimed": True,
            "xp_awarded": 0,
            "reward_unlocked": None,
            "profile": _serialize_user(user),
        }

    xp_gain = BOT_XP_REWARD.get(bot_id, 0)
    prev_level = int(user.get("level", 1) or 1)
    prev_xp = int(user.get("xp", 0) or 0)
    new_level, new_xp = add_xp(prev_level, prev_xp, xp_gain)

    set_doc: dict = {
        "xp": new_xp,
        "level": new_level,
        f"bot_defeats.{bot_id}": True,
    }

    # Capstone-bot free-item rewards: promote the matching slot to "pending"
    # on first-time defeat, never downgrading a slot that's already "claimed".
    reward_unlocked: Optional[str] = None
    slot = reward_slot_for_bot(bot_id)
    if slot and rewards.get(slot) is None:
        set_doc[f"bot_rewards.{slot}"] = "pending"
        # Mirror onto the legacy field so older clients still see the banner.
        if slot == "banner":
            set_doc["bot_banner_reward"] = "pending"
        reward_unlocked = slot

    await db.users.update_one({"_id": oid}, {"$set": set_doc})
    fresh = await db.users.find_one({"_id": oid}) or user
    return {
        "already_claimed": False,
        "xp_awarded": xp_gain,
        "reward_unlocked": reward_unlocked,
        "profile": _serialize_user(fresh),
    }


# ── Unranked queue filler-bot series claim ──────────────────────────────────
# Bots that pop out of the unranked matchmaking queue play a full first-to-5
# series (5×5 → 6×6 → 7×7, 9 games + game-10 Limitbreaker). Completing one
# grants the same XP layering as a real unranked match:
#   base: win=150 / draw=100 / loss=50
#   +   : 75 per round won / 50 per draw / 25 per round lost
# No ELO, no placement, no rank progression — these matches are flagged as
# the user's own `unranked_wins` / `unranked_losses` / `draws` and awarded
# XP + level only, mirroring `award_ranked_match_result` for the unranked
# branch. Series ids are single-use per user (idempotent replay guard).

_UNRANKED_BOT_LEVELS: set[str] = {
    "ROOKIE", "SKILLED", "MYTHIC", "CRACKED", "CHRONICLE", "MYTHOS",
}
# Standard unranked series is 9 games + a single Limitbreaker decider (game
# 10), so we accept up to 10 round entries.
_MAX_UNRANKED_BOT_ROUNDS: int = 10
# Keep the claimed-ids list on the user doc bounded — the trailing slice
# protects against a malicious client spamming junk ids that would bloat
# the user document indefinitely.
_UNRANKED_BOT_CLAIM_HISTORY: int = 200


class ClaimUnrankedBotMoveDetail(BaseModel):
    """Single stone placement inside a game. `player` is the stone's
    owner (P1 / P2), which on the 6×6 rulebreaker trap cell may differ
    from the slot that physically clicked — the career renderer colours
    cells by this field, so it has to match the final board state."""

    row: int = Field(..., ge=0, le=6)
    col: int = Field(..., ge=0, le=6)
    player: str = Field(..., min_length=1, max_length=4)


class ClaimUnrankedBotRoundDetail(BaseModel):
    """Per-game snapshot for the career `match_rounds` export. Optional —
    the server falls back to the `rounds` winner-only history if this is
    missing or malformed, so older clients still claim XP successfully."""

    model_config = ConfigDict(populate_by_name=True)
    game_number: int = Field(..., ge=1, le=_MAX_UNRANKED_BOT_ROUNDS)
    board_mode: str = Field(..., min_length=2, max_length=8)
    winner: str = Field(..., min_length=1, max_length=8)
    moves: list[ClaimUnrankedBotMoveDetail] = Field(default_factory=list, max_length=100)
    board: list[list[Optional[str]]] = Field(default_factory=list, max_length=8)


class ClaimUnrankedBotSeriesBody(BaseModel):
    """Payload for an unranked filler-bot series claim.

    `series_id` is a client-generated unique token for the match (e.g. the
    game URL's id). `rounds` is the list of per-game winners in order, each
    one of "P1" / "P2" / "DRAW". The server recomputes the series outcome
    locally from `rounds`, so the client can't forge a win.

    `round_details` is an optional per-game snapshot (board_mode / moves /
    final board state) used by the career archive to render each round's
    field + move-log. It is strictly additive: the XP grant logic ignores
    it entirely; only the `match_history` document's `match_rounds`
    field is richer when it is provided.
    """

    model_config = ConfigDict(populate_by_name=True)
    series_id: str = Field(..., alias="seriesId", min_length=4, max_length=64)
    bot_name: str = Field(..., alias="botName", min_length=1, max_length=32)
    level: str = Field(..., min_length=3, max_length=16)
    rounds: list[str] = Field(..., min_length=1, max_length=_MAX_UNRANKED_BOT_ROUNDS)
    is_mythos: bool = Field(False, alias="isMythos")
    round_details: Optional[list[ClaimUnrankedBotRoundDetail]] = Field(
        default=None,
        alias="roundDetails",
        max_length=_MAX_UNRANKED_BOT_ROUNDS,
    )


def _unranked_bot_series_outcome(rounds: list[str]) -> str:
    """Return "win" / "loss" / "draw" from the perspective of the human
    (P1). Mirrors the frontend's `checkSeriesWinner` multi-branch (first to
    5 points, 9 games max, tie → Limitbreaker game 10 decides)."""

    p1 = sum(1 for r in rounds if r == "P1")
    p2 = sum(1 for r in rounds if r == "P2")

    # Instant-win branch: 5 points reached.
    if p1 >= 5 and p1 > p2:
        return "win"
    if p2 >= 5 and p2 > p1:
        return "loss"

    # Game 10 Limitbreaker: exactly the 10th round decides if 9-game totals
    # were tied. We only honour it when a 10th game is actually present.
    if len(rounds) >= 10:
        last = rounds[9]
        if last == "P1":
            return "win"
        if last == "P2":
            return "loss"
        # Limitbreaker draw is impossible by design, but guard anyway.
        return "draw"

    # Regulation ended (up to 9 games) without a 5-point leader → totals
    # decide. Equal totals without a Limitbreaker = draw (should only
    # happen on an abbreviated / abandoned series).
    if p1 > p2:
        return "win"
    if p2 > p1:
        return "loss"
    return "draw"


@router.post("/claim-unranked-bot-series")
async def claim_unranked_bot_series(
    data: ClaimUnrankedBotSeriesBody,
    user_id: str = Depends(get_current_user),
):
    level = (data.level or "").upper().strip()
    if level not in _UNRANKED_BOT_LEVELS:
        raise HTTPException(400, "Unknown level")

    # Sanitise round entries: only "P1" / "P2" / "DRAW" are accepted. We
    # silently coerce case but reject anything else so a client can't stuff
    # in junk that would inflate the XP bonus.
    rounds: list[str] = []
    for raw in data.rounds:
        val = (raw or "").upper().strip()
        if val not in {"P1", "P2", "DRAW"}:
            raise HTTPException(400, "Invalid round winner")
        rounds.append(val)
    if not rounds:
        raise HTTPException(400, "Empty series")

    result = _unranked_bot_series_outcome(rounds)
    series_id = data.series_id.strip()

    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    # Idempotent replay guard: every series id can only ever be claimed
    # once per user.
    claimed_ids = user.get("claimed_unranked_bot_series") or []
    if not isinstance(claimed_ids, list):
        claimed_ids = []
    if series_id in claimed_ids:
        return {
            "already_claimed": True,
            "xp_awarded": 0,
            "result": result,
            "mythos_first_defeat": False,
            "mythos_xp_bonus": 0,
            "profile": _serialize_user(user),
        }

    # XP formula — intentionally identical to the unranked branch of
    # `award_ranked_match_result` so "plays just like a normal match".
    gained_xp = 150 if result == "win" else (100 if result == "draw" else 50)
    for w in rounds:
        if w == "P1":
            gained_xp += 75
        elif w == "DRAW":
            gained_xp += 50
        else:
            gained_xp += 25

    # ── MYTHOS first-defeat bonus ────────────────────────────────────────
    # Defeating MYTHOS for the FIRST TIME grants a flat +100,000 XP bonus
    # plus a free board-skin pick (the boss-tier capstone reward). The
    # bonus is layered on top of the regular unranked XP so the
    # MatchResultScreen still animates the level-up curve naturally.
    # Subsequent MYTHOS wins fall back to the standard unranked XP only.
    prior_defeats = user.get("bot_defeats") or {}
    if not isinstance(prior_defeats, dict):
        prior_defeats = {}
    mythos_first_defeat = (
        bool(data.is_mythos)
        and result == "win"
        and not bool(prior_defeats.get("mythos"))
    )
    mythos_xp_bonus = MYTHOS_FIRST_DEFEAT_XP_BONUS if mythos_first_defeat else 0
    gained_xp += mythos_xp_bonus

    prev_level = int(user.get("level", 1) or 1)
    prev_xp = int(user.get("xp", 0) or 0)
    new_level, new_xp = add_xp(prev_level, prev_xp, gained_xp)

    inc: dict = {}
    if result == "win":
        inc["unranked_wins"] = 1
    elif result == "loss":
        inc["unranked_losses"] = 1
    else:
        inc["draws"] = 1

    # MYTHOS first-defeat side-effects: flag the kill and promote the
    # `mythos_skin` reward slot to "pending" so the player can redeem the
    # free board skin from the store. We do this in the same atomic
    # update as the XP grant so the bonus, the defeat flag, and the
    # reward slot all commit together (or none at all if a concurrent
    # claim wins the race below).
    set_doc: dict = {"xp": new_xp, "level": new_level}
    if mythos_first_defeat:
        set_doc["bot_defeats.mythos"] = True
        set_doc["bot_rewards.mythos_skin"] = "pending"

    # Atomic first-writer-wins claim: if another request on the same series
    # id sneaks in concurrently, only one will modify the doc.
    claim = await db.users.update_one(
        {"_id": oid, "claimed_unranked_bot_series": {"$ne": series_id}},
        {
            "$set": set_doc,
            "$push": {
                "claimed_unranked_bot_series": {
                    "$each": [series_id],
                    "$slice": -_UNRANKED_BOT_CLAIM_HISTORY,
                }
            },
            "$inc": inc,
        },
    )

    fresh = await db.users.find_one({"_id": oid}) or user
    if claim.modified_count == 0:
        return {
            "already_claimed": True,
            "xp_awarded": 0,
            "result": result,
            "mythos_first_defeat": False,
            "mythos_xp_bonus": 0,
            "profile": _serialize_user(fresh),
        }

    # ── Match history record for career / profile match log ─────────────
    # Mirror the "custom" multiplayer series schema so bot bouts show up
    # in the player's career timeline alongside real matches. Bot opponents
    # have no user_id, so `opponent_id` is null; `opponent_username` carries
    # the bot display name and `bot_level` lets the UI badge the row. We
    # stamp `mode="bot_unranked"` so the career tab can filter / label these
    # rows distinctly from genuine unranked multiplayer matches when needed.
    history_result = "win" if result == "win" else ("loss" if result == "loss" else "draw")
    # Translate the per-round winners into the same shape ranked/unranked
    # multiplayer uses in `match_rounds` so the career row can render an
    # identical per-game breakdown. The series id doubles as the game id.
    #
    # When the client shipped `round_details` (board_mode / moves / final
    # board), merge them in so the archive dialog shows the replay. We
    # defensively index by `game_number` and only accept detail rows
    # whose winner matches the authoritative `rounds` list — a mismatch
    # means the two payloads disagree, in which case we fall back to
    # winner-only (safer than rendering a fabricated replay).
    valid_winner_codes = {"P1", "P2", "DRAW"}
    detail_by_game: dict[int, ClaimUnrankedBotRoundDetail] = {}
    if data.round_details:
        for det in data.round_details:
            det_winner = (det.winner or "").upper().strip()
            if det_winner not in valid_winner_codes:
                continue
            detail_by_game[det.game_number] = det

    match_rounds_doc: list[dict] = []
    for idx, winner in enumerate(rounds):
        game_number = idx + 1
        base: dict = {
            "game_number": game_number,
            "winner": winner,
        }
        det = detail_by_game.get(game_number)
        if det and (det.winner or "").upper().strip() == winner:
            # Normalise the move list: the career renderer only reads
            # {row, col, player}; anything else is dropped.
            base["board_mode"] = (det.board_mode or "").lower().strip() or "5x5"
            base["moves"] = [
                {"row": m.row, "col": m.col, "player": m.player}
                for m in det.moves
            ]
            # Stringify cells defensively — Mongo accepts None + strings
            # directly but rejects arbitrary classes, and we want the
            # frontend's `Array.isArray(currentRound.board)` check to
            # pass unconditionally.
            base["board"] = [
                [cell if (cell is None or isinstance(cell, str)) else str(cell)
                 for cell in row]
                for row in det.board
            ]
        match_rounds_doc.append(base)
    # Starting leg is always 5×5 for the filler ladder; we tag the full
    # board_mode_full so the history card can show "5×5 → 6×6 → 7×7".
    history_doc = {
        "user_id":            str(oid),
        "opponent_id":        None,
        "opponent_username":  (data.bot_name or "BOT").upper()[:32],
        "opponent_elo":       None,
        "result":             history_result,
        "elo_before":         int(user.get("elo", 0) or 0),
        "elo_after":          int(user.get("elo", 0) or 0),
        "elo_delta":          0,
        "was_placement":      False,
        "placement_matches":  0,
        # Bot matches still ride the "unranked" bucket so they surface in the
        # career Unranked tab alongside real unranked matches. Downstream
        # consumers can detect bot bouts via `bot_level` / `opponent_id=null`.
        "mode":               "unranked",
        "played_at":          datetime.utcnow(),
        "my_slot":            "P1",
        "match_scope":        "full_match",
        "board_mode":         "5x5",
        "board_mode_full":    "5x5_6x6_7x7",
        "match_rounds":       match_rounds_doc,
        "protocolbreaker_played": len(rounds) >= 10,
        "limitbreaker_played":    len(rounds) >= 10,
        "surrendered_by":     None,
        "bot_level":          level,
        "bot_is_mythos":      bool(data.is_mythos),
        "series_id":          series_id,
    }
    try:
        await db.match_history.insert_one(history_doc)
    except Exception:
        # Career recording is best-effort; a storage error should not prevent
        # the XP grant from succeeding (the claim has already committed).
        pass

    return {
        "already_claimed": False,
        "xp_awarded": gained_xp,
        "result": result,
        # MYTHOS-specific surface for the post-match UI. `mythos_first_defeat`
        # is True only on the very first MYTHOS win this user has ever
        # claimed; the frontend uses it to gate the boss-tier reward
        # callout (free board skin + +100k XP bonus banner) on the
        # MatchResultScreen. `mythos_xp_bonus` is the flat addition so
        # the screen can call out the chunk separately from the regular
        # unranked-match XP.
        "mythos_first_defeat": bool(mythos_first_defeat),
        "mythos_xp_bonus": int(mythos_xp_bonus),
        "profile": _serialize_user(fresh),
    }


# ── Reward redemption helpers ────────────────────────────────────────────────
async def _redeem_reward_slot(
    *,
    user_id: str,
    slot: str,
    gate_bot: str,
    gate_error: str,
    claimed_error: str,
    item_id: str,
    eligible_items: set[str],
    unknown_item_error: str,
) -> dict:
    """Shared redemption path for the three per-bot reward slots.

    - Checks the user has defeated the gating bot.
    - Checks the matching reward slot is "pending" (never-claimed).
    - Marks the slot "claimed" and grants the chosen item via purchased_items.
    - Returns the fresh serialized profile.
    """
    if item_id not in eligible_items:
        raise HTTPException(400, unknown_item_error)

    db = get_db()
    oid = user_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(404, "User not found")

    defeats = user.get("bot_defeats") or {}
    if not isinstance(defeats, dict) or not has_defeated(defeats, gate_bot):
        raise HTTPException(400, gate_error)

    rewards = _normalize_bot_rewards(user)
    if rewards.get(slot) != "pending":
        raise HTTPException(400, claimed_error)

    owned = set(user.get("purchased_items") or [])
    update_doc: dict = {"$set": {f"bot_rewards.{slot}": "claimed"}}
    if slot == "banner":
        # Keep the legacy single-field flag in sync for older clients.
        update_doc["$set"]["bot_banner_reward"] = "claimed"
    # The user explicitly picked this item; if they already own it the
    # reward is still consumed (their choice).
    if item_id not in owned:
        update_doc["$addToSet"] = {"purchased_items": item_id}

    await db.users.update_one({"_id": oid}, update_doc)
    fresh = await db.users.find_one({"_id": oid}) or user
    return {"ok": True, "profile": _serialize_user(fresh)}


# ── Free banner redemption (awarded on defeating JR) ─────────────────────────
class ClaimBotBannerBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    banner_id: str = Field(..., alias="bannerId")


@router.post("/claim-bot-banner-reward")
async def claim_bot_banner_reward(
    data: ClaimBotBannerBody,
    user_id: str = Depends(get_current_user),
):
    return await _redeem_reward_slot(
        user_id=user_id,
        slot="banner",
        gate_bot="jr",
        gate_error="Defeat JR. (5x5 final) to unlock this reward",
        claimed_error="Banner reward already claimed",
        item_id=(data.banner_id or "").strip().lower(),
        eligible_items=_ELIGIBLE_REWARD_BANNERS,
        unknown_item_error="Unknown banner id",
    )


# ── Free coin-toss-skin redemption (awarded on defeating HIM) ────────────────
class ClaimBotCoinTossBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    coin_toss_id: str = Field(..., alias="coinTossId")


@router.post("/claim-bot-coin-toss-reward")
async def claim_bot_coin_toss_reward(
    data: ClaimBotCoinTossBody,
    user_id: str = Depends(get_current_user),
):
    return await _redeem_reward_slot(
        user_id=user_id,
        slot="coin_toss",
        gate_bot="him",
        gate_error="Defeat HIM (6x6 final) to unlock this reward",
        claimed_error="Coin toss reward already claimed",
        item_id=(data.coin_toss_id or "").strip().lower(),
        eligible_items=_ELIGIBLE_REWARD_COIN_TOSS,
        unknown_item_error="Unknown coin toss id",
    )


# ── Free board-skin redemption (awarded on defeating HER) ────────────────────
class ClaimBotBoardSkinBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    board_skin_id: str = Field(..., alias="boardSkinId")


@router.post("/claim-bot-board-skin-reward")
async def claim_bot_board_skin_reward(
    data: ClaimBotBoardSkinBody,
    user_id: str = Depends(get_current_user),
):
    return await _redeem_reward_slot(
        user_id=user_id,
        slot="board_skin",
        gate_bot="her",
        gate_error="Defeat HER (7x7 final) to unlock this reward",
        claimed_error="Board skin reward already claimed",
        item_id=(data.board_skin_id or "").strip().lower(),
        eligible_items=_ELIGIBLE_REWARD_BOARD_SKINS,
        unknown_item_error="Unknown board skin id",
    )


# ── Free board-skin redemption (awarded on defeating MYTHOS) ─────────────────
# Mirrors the HER redemption above but is gated by the special `mythos`
# defeat flag instead of a chain bot. Uses its own `mythos_skin` slot so
# a player who has both the HER reward AND the MYTHOS reward can pick TWO
# free board skins independently. Eligible item pool is intentionally the
# same (`_ELIGIBLE_REWARD_BOARD_SKINS`) — both rewards grant board-style
# unlocks from the same store catalog.
class ClaimMythosBoardSkinBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    board_skin_id: str = Field(..., alias="boardSkinId")


@router.post("/claim-mythos-board-skin-reward")
async def claim_mythos_board_skin_reward(
    data: ClaimMythosBoardSkinBody,
    user_id: str = Depends(get_current_user),
):
    return await _redeem_reward_slot(
        user_id=user_id,
        slot="mythos_skin",
        gate_bot="mythos",
        gate_error="Defeat MYTHOS in the unranked queue to unlock this reward",
        claimed_error="MYTHOS board skin reward already claimed",
        item_id=(data.board_skin_id or "").strip().lower(),
        eligible_items=_ELIGIBLE_REWARD_BOARD_SKINS,
        unknown_item_error="Unknown board skin id",
    )