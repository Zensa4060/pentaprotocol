from fastapi import APIRouter, HTTPException, Header, Depends
from app.models.game import CreateGame, MakeMove
from app.core.database import get_db
from app.core.security import decode_token
from app.engine import GameEngine
from bson import ObjectId
from datetime import datetime

router = APIRouter()

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        return None
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        return None

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
    return {"game_id": str(result.inserted_id), "board": engine.board, "current_player": "P1", "status": "active", "mode": data.mode, "moves_played": 0, "winner": None}

@router.post("/move")
async def make_move(data: MakeMove, user_id: str = Depends(get_current_user)):
    db = get_db()
    game = db.games.find_one({"_id": ObjectId(data.game_id)})
    if not game:
        raise HTTPException(404, "Game not found")
    if game["status"] != "active":
        raise HTTPException(400, "Game is already over")
    engine = GameEngine()
    engine.board = game["board"]
    engine.current_player = game["current_player"]
    engine.moves_played = game["moves_played"]
    result = engine.deploy(data.row, data.col)
    update = {
        "board":          engine.board,
        "current_player": engine.current_player,
        "moves_played":   engine.moves_played,
        "status":         "finished" if result["winner"] else "active",
        "winner":         result.get("winner"),
    }
    db.games.update_one({"_id": ObjectId(data.game_id)}, {"$set": update})
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