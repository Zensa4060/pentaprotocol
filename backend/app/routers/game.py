from fastapi import APIRouter, HTTPException, Header, Depends
from app.models.game import CreateGame, MakeMove
from app.core.database import get_db
from app.core.security import decode_token
from app.game.engine import GameEngine
from bson import ObjectId
from datetime import datetime
import math

router = APIRouter()

# -- XP & Level helpers --------------------------------------------------------

def xp_for_level(level: int) -> int:
    """XP required to go from level N to N+1. Starts at 5000, increases by 1000 each level."""
    return 5000 + (level - 1) * 1000

def compute_level(total_xp: int) -> tuple[int, int]:
    """Given total XP, return (current_level, xp_into_current_level)."""
    level = 1
    remaining = total_xp
    while remaining >= xp_for_level(level):
        remaining -= xp_for_level(level)
        level += 1
    return level, remaining

def xp_for_result(result: str) -> int:
    if result == "win":   return 1000
    if result == "draw":  return 500
    if result == "loss":  return 250
    return 0

# -- ELO helpers ---------------------------------------------------------------

def expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

def new_elo(rating: int, opponent_rating: int, score: float, k: int = 32) -> int:
    expected = expected_score(rating, opponent_rating)
    return max(0, round(rating + k * (score - expected)))

# -- Auth helper ---------------------------------------------------------------

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        return None
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        return None

# -- Award XP + ELO after game ends --------------------------------------------

def award_game_result(db, game: dict, winner: str | None):
    """Award XP (always) and ELO (ranked only) to both players."""
    p1_id = game.get("player1_id")
    p2_id = game.get("player2_id")
    is_ranked = game.get("format") == "ranked"

    def update_player(user_id: str, result: str, opponent_id: str | None):
        if not user_id:
            return
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return

        # -- XP & Level --------------------------------------------------
        gained_xp   = xp_for_result(result)
        new_total_xp = user.get("xp", 0) + gained_xp
        new_level, _ = compute_level(new_total_xp)

        # -- Win/Loss/Draw counters ---------------------------------------
        inc = {}
        if result == "win":  inc["wins"]   = 1
        if result == "loss": inc["losses"] = 1
        if result == "draw": inc["draws"]  = 1

        # -- ELO (ranked only) --------------------------------------------
        updates = {"xp": new_total_xp, "level": new_level}
        if is_ranked and opponent_id:
            opponent = db.users.find_one({"_id": ObjectId(opponent_id)})
            if opponent:
                score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
                updated_elo = new_elo(
                    user.get("elo", 500),
                    opponent.get("elo", 500),
                    score,
                )
                updates["elo"] = updated_elo

        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": updates, "$inc": inc},
        )

    if winner == "P1":
        update_player(p1_id, "win",  p2_id)
        update_player(p2_id, "loss", p1_id)
    elif winner == "P2":
        update_player(p1_id, "loss", p2_id)
        update_player(p2_id, "win",  p1_id)
    elif winner == "draw":
        update_player(p1_id, "draw", p2_id)
        update_player(p2_id, "draw", p1_id)

# -- Routes --------------------------------------------------------------------

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
        "moves_played":   0,
        "player1_id":     user_id,
        "player2_id":     None,
        "created_at":     datetime.utcnow(),
    }
    result = db.games.insert_one(game)
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
    game = db.games.find_one({"_id": ObjectId(data.game_id)})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        raise HTTPException(400, "Game is already over")

    engine = GameEngine()
    engine.board          = game["board"]
    engine.current_player = game["current_player"]
    engine.moves_played   = game["moves_played"]

    result = engine.deploy(data.row, data.col)

    is_finished = bool(result["winner"])
    update = {
        "board":          engine.board,
        "current_player": engine.current_player,
        "moves_played":   engine.moves_played,
        "status":         "finished" if is_finished else "active",
        "winner":         result.get("winner"),
    }
    db.games.update_one({"_id": ObjectId(data.game_id)}, {"$set": update})

    # Award XP + ELO when game ends
    if is_finished:
        award_game_result(db, game, result.get("winner"))

    return {"game_id": data.game_id, **update, "mode": game["mode"]}


@router.get("/{game_id}")
async def get_game(game_id: str):
    db = get_db()
    game = db.games.find_one({"_id": ObjectId(game_id)})
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
    }
