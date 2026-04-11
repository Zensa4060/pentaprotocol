"""
Ranked quit/forfeit penalties: RR loss, escalating bans, clean-match reset.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId

# RR penalty per ranked quit/forfeit (separate from ELO)
RR_QUIT_PENALTY = 25

# Ban durations (seconds)
BAN_1_MIN = 60
BAN_1_HOUR = 3600
BAN_1_DAY = 86400

# Consecutive quit streak → ban (approximates: 3→1min, +2→1h, +5→1d)
STREAK_BAN_1MIN = 3
STREAK_BAN_1HOUR = 5
STREAK_BAN_1DAY = 10

# Clean matches to reset streak / ban tier
CLEAN_MATCHES_TO_RESET = 30


def _now() -> datetime:
    return datetime.utcnow()


async def apply_ranked_quit_penalty(db, user_id: str) -> dict[str, Any]:
    """
    Apply RR penalty, increment quit streak, set ban if thresholds hit.
    Returns dict with ban_until (iso or None), rr_after, ranked_quit_streak.
    """
    uid = ObjectId(user_id)
    user = await db.users.find_one({"_id": uid})
    if not user:
        return {}

    rr = int(user.get("ranked_rating") or user.get("elo") or 500)
    streak = int(user.get("ranked_quit_streak") or 0) + 1
    new_rr = max(0, rr - RR_QUIT_PENALTY)

    ban_until: datetime | None = user.get("ranked_ban_until")
    if isinstance(ban_until, datetime) and ban_until < _now():
        ban_until = None

    new_ban: datetime | None = None
    if streak == STREAK_BAN_1MIN:
        new_ban = _now() + timedelta(seconds=BAN_1_MIN)
    elif streak == STREAK_BAN_1HOUR:
        new_ban = _now() + timedelta(seconds=BAN_1_HOUR)
    elif streak >= STREAK_BAN_1DAY:
        new_ban = _now() + timedelta(seconds=BAN_1_DAY)

    if new_ban is not None:
        ban_until = new_ban

    await db.users.update_one(
        {"_id": uid},
        {
            "$set": {
                "ranked_rating": new_rr,
                "ranked_quit_streak": streak,
                "ranked_ban_until": ban_until,
            }
        },
    )

    bu = ban_until.isoformat() + "Z" if isinstance(ban_until, datetime) else None
    return {
        "ranked_quit_streak": streak,
        "ranked_rating": new_rr,
        "ranked_ban_until": bu,
    }


async def record_ranked_match_completed_clean(db, user_id: str) -> None:
    """Increment clean counter; reset quit streak at CLEAN_MATCHES_TO_RESET."""
    uid = ObjectId(user_id)
    user = await db.users.find_one({"_id": uid})
    if not user:
        return
    clean = int(user.get("ranked_clean_matches") or 0) + 1
    update: dict[str, Any] = {"ranked_clean_matches": clean}
    if clean >= CLEAN_MATCHES_TO_RESET:
        update["ranked_clean_matches"] = 0
        update["ranked_quit_streak"] = 0
        update["ranked_ban_tier_1h"] = False
        update["ranked_ban_tier_1d"] = False
        update["ranked_ban_until"] = None
    await db.users.update_one({"_id": uid}, {"$set": update})


def user_ranked_allowed(user: dict) -> tuple[bool, str | None]:
    """Returns (allowed, reason_if_blocked)."""
    bu = user.get("ranked_ban_until")
    if isinstance(bu, datetime) and bu > _now():
        return False, f"Ranked banned until {bu.isoformat()}Z"
    return True, None
