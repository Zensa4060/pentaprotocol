from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends
from app.core.database import get_db
from app.core.security import decode_token
from app.game.engine import GameEngine
from app.routers.game import award_game_result
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import random
import string
import json

router = APIRouter()

_room_connections: dict[str, dict] = {}
_matchmaking_queue: dict[str, list] = {
    "ranked":   [],
    "unranked": [],
}

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        raise HTTPException(401, "Invalid token")

def generate_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

def serialize_room(room: dict) -> dict:
    return {
        "room_code":      room["room_code"],
        "status":         room["status"],
        "format":         room["format"],
        "player1_id":     room.get("player1_id"),
        "player2_id":     room.get("player2_id"),
        "player1_name":   room.get("player1_name"),
        "player2_name":   room.get("player2_name"),
        "board":          room.get("board"),
        "current_player": room.get("current_player", "P1"),
        "moves_played":   room.get("moves_played", 0),
        "winner":         room.get("winner"),
        "game_status":    room.get("game_status", "waiting"),
    }

class CreateRoomRequest(BaseModel):
    format: str = "unranked"

class JoinRoomRequest(BaseModel):
    room_code: str

class QueueRequest(BaseModel):
    format: str = "unranked"

class QueueStatusRequest(BaseModel):
    format: str

# ── Matchmaking queue ─────────────────────────────────────────────────────────

@router.post("/queue/join")
async def queue_join(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db = get_db()
    fmt = data.format
    _matchmaking_queue[fmt] = [e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id]

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    player_name = user.get("username", "Player")

    queue = _matchmaking_queue[fmt]
    if queue:
        opponent_entry = queue.pop(0)
        opponent_id    = opponent_entry["user_id"]
        room_code      = opponent_entry["room_code"]

        opponent = db.users.find_one({"_id": ObjectId(opponent_id)})
        opponent_name = opponent.get("username", "Player") if opponent else "Player"

        db.rooms.update_one(
            {"room_code": room_code},
            {"$set": {
                "player2_id":   user_id,
                "player2_name": player_name,
                "status":       "active",
                "game_status":  "playing",
            }}
        )
        room = db.rooms.find_one({"room_code": room_code})

        conns = _room_connections.get(room_code, {})
        p1_ws = conns.get("P1")
        if p1_ws:
            try:
                await p1_ws.send_json({"type": "player_joined", "room": serialize_room(room)})
            except:
                pass

        return {"matched": True, "room_code": room_code, "player_slot": "P2", "room": serialize_room(room)}

    attempts = 0
    while attempts < 10:
        code = generate_room_code()
        if not db.rooms.find_one({"room_code": code, "status": "waiting"}):
            break
        attempts += 1

    engine = GameEngine()
    room = {
        "room_code":      code,
        "status":         "waiting",
        "format":         fmt,
        "player1_id":     user_id,
        "player2_id":     None,
        "player1_name":   player_name,
        "player2_name":   None,
        "board":          engine.board,
        "current_player": "P1",
        "moves_played":   0,
        "winner":         None,
        "game_status":    "waiting",
        "created_at":     datetime.utcnow(),
    }
    db.rooms.insert_one(room)
    _matchmaking_queue[fmt].append({"user_id": user_id, "room_code": code})

    return {"matched": False, "room_code": code, "player_slot": "P1", "room": serialize_room(room)}


@router.post("/queue/leave")
async def queue_leave(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format
    entry = next((e for e in _matchmaking_queue[fmt] if e["user_id"] == user_id), None)
    if entry:
        _matchmaking_queue[fmt] = [e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id]
        db.rooms.delete_one({"room_code": entry["room_code"], "status": "waiting"})
    return {"ok": True}


@router.get("/queue/status/{room_code}")
async def queue_status(room_code: str):
    db   = get_db()
    room = db.rooms.find_one({"room_code": room_code.upper()})
    if not room:
        raise HTTPException(404, "Room not found")
    return serialize_room(room)


# ── Private rooms ─────────────────────────────────────────────────────────────

@router.post("/create")
async def create_room(data: CreateRoomRequest, user_id: str = Depends(get_current_user)):
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if data.format == "ranked" and user.get("level", 1) < 1:
        raise HTTPException(403, "Cannot create ranked room")

    player_name = user.get("username", "Player 1")
    attempts = 0
    while attempts < 10:
        code = generate_room_code()
        if not db.rooms.find_one({"room_code": code, "status": "waiting"}):
            break
        attempts += 1

    engine = GameEngine()
    room = {
        "room_code":      code,
        "status":         "waiting",
        "format":         data.format,
        "player1_id":     user_id,
        "player2_id":     None,
        "player1_name":   player_name,
        "player2_name":   None,
        "board":          engine.board,
        "current_player": "P1",
        "moves_played":   0,
        "winner":         None,
        "game_status":    "waiting",
        "created_at":     datetime.utcnow(),
    }
    db.rooms.insert_one(room)
    return serialize_room(room)


@router.post("/join")
async def join_room(data: JoinRoomRequest, user_id: str = Depends(get_current_user)):
    db   = get_db()
    code = data.room_code.upper().strip()

    # Check if room exists at all
    any_room = db.rooms.find_one({"room_code": code})
    if not any_room:
        raise HTTPException(404, "Room not found — check the code and try again")

    # If already active, allow reconnect for existing players
    if any_room["status"] in ("active", "finished"):
        p1 = str(any_room.get("player1_id", ""))
        p2 = str(any_room.get("player2_id", ""))
        if user_id in (p1, p2):
            return serialize_room(any_room)
        if any_room["status"] == "finished":
            raise HTTPException(400, "This game has already ended")
        raise HTTPException(400, "Room is already full")

    # Room is waiting — validate and join
    if str(any_room["player1_id"]) == user_id:
        raise HTTPException(400, "You cannot join your own room")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if any_room["format"] == "ranked" and user.get("level", 1) < 1:
        raise HTTPException(403, "Cannot join ranked room")

    player_name = user.get("username", "Player 2")

    db.rooms.update_one(
        {"room_code": code},
        {"$set": {
            "player2_id":   user_id,
            "player2_name": player_name,
            "status":       "active",
            "game_status":  "playing",
        }}
    )
    room = db.rooms.find_one({"room_code": code})

    # Notify P1 via WebSocket
    conns = _room_connections.get(code, {})
    p1_ws = conns.get("P1")
    if p1_ws:
        try:
            await p1_ws.send_json({"type": "player_joined", "room": serialize_room(room)})
        except:
            pass

    return serialize_room(room)


@router.get("/{room_code}")
async def get_room(room_code: str):
    db = get_db()
    room = db.rooms.find_one({"room_code": room_code.upper()})
    if not room:
        raise HTTPException(404, "Room not found")
    return serialize_room(room)


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/{room_code}/{player_slot}")
async def room_websocket(websocket: WebSocket, room_code: str, player_slot: str):
    await websocket.accept()
    room_code = room_code.upper()

    if room_code not in _room_connections:
        _room_connections[room_code] = {}
    _room_connections[room_code][player_slot] = websocket

    db = get_db()

    try:
        room = db.rooms.find_one({"room_code": room_code})
        if room:
            await websocket.send_json({"type": "room_state", "room": serialize_room(room)})

        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)

            if msg["type"] == "move":
                row = msg["row"]
                col = msg["col"]

                room = db.rooms.find_one({"room_code": room_code})
                if not room or room["game_status"] != "playing":
                    continue

                expected_slot = room["current_player"]
                if player_slot != expected_slot:
                    await websocket.send_json({"type": "error", "message": "Not your turn"})
                    continue

                engine = GameEngine()
                engine.board          = room["board"]
                engine.current_player = room["current_player"]
                engine.moves_played   = room["moves_played"]

                result      = engine.deploy(row, col)
                is_finished = bool(result.get("winner"))

                update = {
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "winner":         result.get("winner"),
                    "game_status":    "finished" if is_finished else "playing",
                    "status":         "finished" if is_finished else "active",
                }
                db.rooms.update_one({"room_code": room_code}, {"$set": update})

                if is_finished:
                    game_dict = {
                        "player1_id": room["player1_id"],
                        "player2_id": room["player2_id"],
                        "format":     room["format"],
                        "mode":       "multiplayer",
                    }
                    award_game_result(db, game_dict, result.get("winner"))

                broadcast = {
                    "type":           "move_made",
                    "row":            row,
                    "col":            col,
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "winner":         result.get("winner"),
                    "game_status":    update["game_status"],
                    "extra_turns":    result.get("extra_turns", 0),
                }
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

            elif msg["type"] == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        if room_code in _room_connections:
            _room_connections[room_code].pop(player_slot, None)
            if not _room_connections[room_code]:
                del _room_connections[room_code]

        conns = _room_connections.get(room_code, {})
        for slot, ws in conns.items():
            try:
                await ws.send_json({"type": "opponent_disconnected"})
            except:
                pass