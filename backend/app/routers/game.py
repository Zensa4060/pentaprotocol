from fastapi import APIRouter, HTTPException, Header, Depends
from app.models.game import CreateGame, MakeMove
from app.core.database import get_db
from app.core.security import decode_token
from app.game.engine import GameEngine
from app.game.ranked_penalties import record_ranked_match_completed_clean
from bson import ObjectId
from datetime import datetime
import math

router = APIRouter()

def xp_for_level(level: int) -> int:
    # Exponential growth: base 5000 + multiplier * (1.1^level) + linear bonus
    # This makes it increasingly difficult to level up.
    if level >= 1000: return 999_999_999 # Effective cap
    base = 5000
    curve = int(1000 * (1.1 ** (level - 1)))
    linear = (level - 1) * 500
    return base + curve + linear

def compute_level(total_xp: int) -> tuple[int, int]:
    level = 1
    remaining = total_xp
    while level < 1000 and remaining >= xp_for_level(level):
        remaining -= xp_for_level(level)
        level += 1
    return min(level, 1000), remaining

def xp_for_result(result: str, mode: str = "multiplayer", difficulty: str = "medium") -> int:
    if mode == "bot":
        return {"easy": 10, "medium": 50, "hard": 100}.get(difficulty, 50)
    if result == "win":  return 1000
    if result == "draw": return 500
    if result == "loss": return 250
    return 0


def xp_for_series_outcome(result: str, format: str, num_rounds: int) -> int:
    """
    Full-series multiplayer XP: scales with completed rounds (1–9).
    Unranked/custom: win 3000–4000, loss 1000–2000.
    Ranked: win 10000–15000, loss 5000–10000.
    Draw: flat 500 each.
    """
    r = (result or "").lower()
    n = max(1, min(9, int(num_rounds or 1)))
    t = (n - 1) / 8.0
    is_ranked = (format or "").lower() == "ranked"
    if r == "draw":
        return 500
    if is_ranked:
        if r == "win":
            return int(10000 + round(t * 5000))
        if r == "loss":
            return int(5000 + round(t * 5000))
    else:
        if r == "win":
            return int(3000 + round(t * 1000))
        if r == "loss":
            return int(1000 + round(t * 1000))
    return xp_for_result(result, "multiplayer", "medium")

def expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

def new_elo(rating: int, opponent_rating: int, score: float, k: int = 32) -> int:
    expected = expected_score(rating, opponent_rating)
    return max(0, round(rating + k * (score - expected)))

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        return None
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        return None

async def award_game_result(db, game: dict, winner: str | None):
    p1_id      = game.get("player1_id")
    p2_id      = game.get("player2_id")
    is_ranked  = game.get("format") == "ranked"
    mode       = game.get("mode", "multiplayer")
    difficulty = game.get("difficulty", "medium")
    # Solo and singleplayer games do not count toward any profile stats
    if mode in ("solo", "singleplayer", "bot"):
        return

    # Ranked vs unranked (private friend rooms use the same labels as queue when format matches)
    career_mode = "ranked" if is_ranked else "unranked"

    # Pre-fetch both players for ELO-before snapshot
    p1_user = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    p2_user = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None

    async def update_player(user_id: str, result: str, opponent_id: str | None):
        if not user_id:
            return
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return
        gained_xp    = xp_for_result(result, mode, difficulty)
        new_total_xp = user.get("xp", 0) + gained_xp
        new_level, _ = compute_level(new_total_xp)
        inc = {}
        if career_mode == "unranked":
            if result == "win":  inc["unranked_wins"]   = 1
            if result == "loss": inc["unranked_losses"] = 1
            if result == "draw": inc["draws"]           = 1
        else:
            # Ranked - Re-enabled
            if result == "win":  inc["wins"]   = 1
            if result == "loss": inc["losses"] = 1
            if result == "draw": inc["draws"]  = 1

        updates = {"xp": new_total_xp, "level": new_level}
        # ELO changes apply to ranked PvP only; unranked uses unranked_wins/losses without ELO.
        if is_ranked and opponent_id and mode != "bot":
            # Elo updates re-enabled for ranked
            opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})
            if opponent:
                score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
                updates["elo"] = new_elo(user.get("elo", 500), opponent.get("elo", 500), score)
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates, "$inc": inc})

    w = (winner or "").upper()
    if w == "P1":
        await update_player(p1_id, "win",  p2_id)
        await update_player(p2_id, "loss", p1_id)
    elif w == "P2":
        await update_player(p1_id, "loss", p2_id)
        await update_player(p2_id, "win",  p1_id)
    elif w == "DRAW":
        await update_player(p1_id, "draw", p2_id)
        await update_player(p2_id, "draw", p1_id)

    # ── Log match history for each player (multiplayer only) ──────────────
    async def log_match(user_id, opponent_id, result, user_snap, opp_snap):
        if not user_id:
            return
        user_id = str(user_id)
        opponent_id = str(opponent_id) if opponent_id else None
        if not user_snap:
            user_snap = await db.users.find_one({"_id": ObjectId(user_id)})
        if opponent_id and not opp_snap:
            opp_snap = await db.users.find_one({"_id": ObjectId(opponent_id)})
        if not user_snap:
            return
        elo_before = user_snap.get("elo", 100)
        # Re-read to get the post-update ELO
        updated = await db.users.find_one({"_id": ObjectId(user_id)})
        elo_after = updated.get("elo", elo_before) if updated else elo_before
        doc = {
            "user_id":            user_id,
            "opponent_id":        opponent_id,
            "opponent_username":  (opp_snap or {}).get("username", "Unknown"),
            "opponent_elo":       (opp_snap or {}).get("elo", 100),
            "result":             result,
            "elo_before":         elo_before,
            "elo_after":          elo_after,
            "elo_delta":          elo_after - elo_before,
            "mode":               career_mode,
            "played_at":          datetime.utcnow(),
        }
        bp = game.get("rb_banned_pattern_7x7")
        if isinstance(bp, str) and bp.strip():
            doc["banned_pattern_7x7"] = bp.strip()
            doc["board_mode"] = game.get("board_mode", "7x7")
            doc["game_number"] = game.get("game_number")
        await db.match_history.insert_one(doc)

    if w == "P1":
        await log_match(p1_id, p2_id, "win",  p1_user, p2_user)
        await log_match(p2_id, p1_id, "loss", p2_user, p1_user)
    elif w == "P2":
        await log_match(p1_id, p2_id, "loss", p1_user, p2_user)
        await log_match(p2_id, p1_id, "win",  p2_user, p1_user)
    elif w == "DRAW":
        await log_match(p1_id, p2_id, "draw", p1_user, p2_user)
        await log_match(p2_id, p1_id, "draw", p2_user, p1_user)


async def award_ranked_match_result(
    db, game: dict, winner: str | None, *, record_clean_streak: bool = True, surrendered_by: str | None = None
):
    """
    Standard match outcome for both Ranked and Unranked modes.
    Follows the "First-to-5" win condition.
    """
    p1_id = game.get("player1_id")
    p2_id = game.get("player2_id")
    fmt = game.get("format", "unranked")
    is_ranked = (fmt == "ranked")
    mode = game.get("mode", "multiplayer")
    difficulty = game.get("difficulty", "medium")
    
    p1_user = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    p2_user = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None

    rounds_list = game.get("match_rounds") or []
    num_rounds = max(1, min(9, len(rounds_list))) if isinstance(rounds_list, list) else 1

    async def update_player(user_id: str, result: str, opponent_id: str | None):
        if not user_id: return
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user: return
        
        gained_xp = xp_for_series_outcome(result, fmt, num_rounds)
        new_total_xp = user.get("xp", 0) + gained_xp
        new_level, _ = compute_level(new_total_xp)
        
        inc = {}
        if is_ranked:
            if result == "win": inc["wins"] = 1
            elif result == "loss": inc["losses"] = 1
            elif result == "draw": inc["draws"] = 1
        else:
            if result == "win": inc["unranked_wins"] = 1
            elif result == "loss": inc["unranked_losses"] = 1
            elif result == "draw": inc["draws"] = 1
        
        updates = {"xp": new_total_xp, "level": new_level}
        
        # Only update ELO/RR for ranked matches
        if is_ranked and opponent_id and mode != "bot":
            opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})
            if opponent:
                score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
                elo_old = user.get("elo", 500)
                rr_old = int(user.get("ranked_rating", elo_old))
                opp_elo = opponent.get("elo", 500)
                opp_rr = int(opponent.get("ranked_rating", opp_elo))
                updates["elo"] = new_elo(elo_old, opp_elo, score)
                updates["ranked_rating"] = new_elo(rr_old, opp_rr, score)
                
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates, "$inc": inc})

    w = (winner or "").upper()
    if w == "P1":
        await update_player(p1_id, "win", p2_id)
        await update_player(p2_id, "loss", p1_id)
    elif w == "P2":
        await update_player(p1_id, "loss", p2_id)
        await update_player(p2_id, "win", p1_id)
    elif w == "DRAW":
        await update_player(p1_id, "draw", p2_id)
        await update_player(p2_id, "draw", p1_id)

    async def log_match(user_id, opponent_id, result, user_snap, opp_snap):
        if not user_id:
            return None
        u_id_str = str(user_id)
        o_id_str = str(opponent_id) if opponent_id else None
        if not user_snap:
            user_snap = await db.users.find_one({"_id": ObjectId(u_id_str)})
        if o_id_str and not opp_snap:
            opp_snap = await db.users.find_one({"_id": ObjectId(o_id_str)})
        if not user_snap:
            return None
        
        # Ensure IDs are strings for consistent MongoDB querying (JWT uses string sub)
        elo_before = user_snap.get("elo", 500)
        updated = await db.users.find_one({"_id": ObjectId(u_id_str)})
        elo_after = updated.get("elo", elo_before) if updated else elo_before
        
        doc = {
            "user_id":            u_id_str,
            "opponent_id":        o_id_str,
            "opponent_username":  (opp_snap or {}).get("username", "Unknown"),
            "opponent_elo":       (opp_snap or {}).get("elo", 500),
            "result":             result,
            "elo_before":         elo_before,
            "elo_after":          elo_after,
            "elo_delta":          elo_after - elo_before if is_ranked else 0,
            "mode":               fmt,
            "played_at":          datetime.utcnow(),
            "my_slot":            "P1" if user_id == p1_id else "P2",
            "match_scope":        "full_match",
            "board_mode":         game.get("board_mode"),
            "board_mode_full":    game.get("board_mode_full"),
            "match_rounds":       game.get("match_rounds", []),
            "protocolbreaker_played": bool(game.get("protocolbreaker_played") or game.get("limitbreaker_played")),
            "limitbreaker_played": bool(game.get("protocolbreaker_played") or game.get("limitbreaker_played")),
            "surrendered_by":         surrendered_by,
        }
        ins = await db.match_history.insert_one(doc)
        return str(ins.inserted_id)

    p1_career_entry_id = None
    p2_career_entry_id = None
    if w == "P1":
        p1_career_entry_id = await log_match(p1_id, p2_id, "win", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "loss", p2_user, p1_user)
    elif w == "P2":
        p1_career_entry_id = await log_match(p1_id, p2_id, "loss", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "win", p2_user, p1_user)
    elif w == "DRAW":
        p1_career_entry_id = await log_match(p1_id, p2_id, "draw", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "draw", p2_user, p1_user)

    if record_clean_streak:
        if p1_id:
            await record_ranked_match_completed_clean(db, p1_id)
        if p2_id:
            await record_ranked_match_completed_clean(db, p2_id)
    elif winner in ("P1", "P2"):
        wid = p1_id if winner == "P1" else p2_id
        if wid:
            await record_ranked_match_completed_clean(db, wid)

    return {
        "p1_career_entry_id": p1_career_entry_id,
        "p2_career_entry_id": p2_career_entry_id,
    }


@router.post("/create")
async def create_game(data: CreateGame, user_id: str = Depends(get_current_user)):
    db = get_db()
    engine = GameEngine()
    game = {
        "board":          engine.board,
        "current_player": "P1",
        "status":         "active",
        "winner":         None,
        "mode":           data.mode,
        "format":         data.format,
        "difficulty":     getattr(data, "difficulty", "medium"),
        "moves_played":   0,
        "extra_turns":    0,
        "player1_id":     user_id,
        "player2_id":     None,
        "created_at":     datetime.utcnow(),
    }
    result = await db.games.insert_one(game)
    return {
        "game_id":        str(result.inserted_id),
        "board":          engine.board,
        "current_player": "P1",
        "status":         "active",
        "mode":           data.mode,
        "moves_played":   0,
        "winner":         None,
    }

@router.post("/move")
async def make_move(data: MakeMove, user_id: str = Depends(get_current_user)):
    db = get_db()
    game = await db.games.find_one({"_id": ObjectId(data.game_id)})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        return {
            "game_id":        data.game_id,
            "board":          game["board"],
            "current_player": game["current_player"],
            "moves_played":   game["moves_played"],
            "extra_turns":    game.get("extra_turns", 0),
            "status":         game["status"],
            "winner":         game["winner"],
            "mode":           game["mode"],
        }
    engine = GameEngine()
    engine.board          = game["board"]
    engine.current_player = game["current_player"]
    engine.moves_played   = game["moves_played"]
    engine.extra_turns    = game.get("extra_turns", 0)
    result = engine.deploy(data.row, data.col)
    is_finished = bool(result["winner"])
    update = {
        "board":          engine.board,
        "current_player": engine.current_player,
        "moves_played":   engine.moves_played,
        "extra_turns":    engine.extra_turns,
        "status":         "finished" if is_finished else "active",
        "winner":         result.get("winner"),
    }
    await db.games.update_one({"_id": ObjectId(data.game_id)}, {"$set": update})
    if is_finished:
        await award_game_result(db, game, result.get("winner"))
    return {"game_id": data.game_id, **update, "mode": game["mode"]}

@router.get("/{game_id}")
async def get_game(game_id: str):
    db = get_db()
    game = await db.games.find_one({"_id": ObjectId(game_id)})
    if not game:
        raise HTTPException(404, "Game not found")
    return {
        "game_id":        str(game["_id"]),
        "board":          game["board"],
        "current_player": game["current_player"],
        "status":         game["status"],
        "winner":         game["winner"],
        "mode":           game["mode"],
        "moves_played":   game["moves_played"],
        "extra_turns":    game.get("extra_turns", 0),
    }