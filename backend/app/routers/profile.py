from fastapi import APIRouter, HTTPException, Header, Depends
from app.core.database import get_db
from app.core.security import decode_token
from bson import ObjectId

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
        "email":               user["email"],
        "level":               user.get("level", 1),
        "xp":                  user.get("xp", 0),
        "coins":               user.get("coins", 0),
        "shards":              user.get("shards", 0),
        "protocredits":        user.get("protocredits", 0),
        "elo":                 user.get("elo", 100),
        "rank":                get_rank(user.get("elo", 100)),
        "wins":                user.get("wins", 0),
        "losses":              user.get("losses", 0),
        "draws":               user.get("draws", 0),
        "rb_wins":             user.get("rb_wins", 0),
        "totp_enabled":        user.get("totp_enabled", False),
        "bio":                 user.get("bio", ""),
        "avatar":              user.get("avatar", None),
        "username_changed_at": user.get("username_changed_at"),
        # ── cosmetics ──────────────────────────────────────────────────────
        "banner":              user.get("banner", "default"),
        "border_style":        user.get("border_style", "none"),
        "board_style":         user.get("board_style", "default"),
        "title":               user.get("title", "newcomer"),
    }


@router.get("/me")
async def get_profile(user_id: str = Depends(get_current_user)):
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    return _serialize_user(user)


@router.get("/leaderboard")
async def leaderboard():
    db = get_db()
    players = []
    for u in db.users.find().sort("elo", -1).limit(20):
        players.append({
            "username": u["username"],
            "elo":      u.get("elo", 500),
            "rank":     get_rank(u.get("elo", 500)),
            "wins":     u.get("wins", 0),
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
    "ice_grid"

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
    avatar:       Optional[str] = None   # base64 data URI
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
    user = db.users.find_one({"_id": ObjectId(user_id)})
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
        if len(u) > 16:
            raise HTTPException(400, "Username must be at most 16 characters")
        if not re.match(r'^[\w@]+$', u):
            raise HTTPException(400, "Only letters, numbers, @ and _ are allowed")
        if re.search(r'[^\x00-\x7F]', u):
            raise HTTPException(400, "Emojis are not allowed in usernames")
        if contains_profanity(u):
            raise HTTPException(400, "Username contains inappropriate content")
        if db.users.find_one({"username": u, "_id": {"$ne": ObjectId(user_id)}}):
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
        if not re.match(r'^data:image/(jpeg|png|webp);base64,', data.avatar):
            raise HTTPException(400, "Avatar must be a JPEG, PNG or WebP image")
        approx_bytes = len(data.avatar) * 0.75
        if approx_bytes > 2 * 1024 * 1024:
            raise HTTPException(400, "Avatar must be under 2MB")
        updates["avatar"] = data.avatar

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
        raise HTTPException(400, "Nothing to update")

    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
    user = db.users.find_one({"_id": ObjectId(user_id)})
    return _serialize_user(user)