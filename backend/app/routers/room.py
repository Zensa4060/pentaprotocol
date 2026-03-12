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

# ── In-memory WebSocket connection store ──────────────────────────────────────
# room_code -> { "P1": WebSocket, "P2": WebSocket }
_room_connections: dict[str, dict] = {}

# ── In-memory matchmaking queue ───────────────────────────────────────────────
# format -> list of { user_id, room_code }
_matchmaking_queue: dict[str, list] = {
    "ranked":   [],
    "unranked": [],
}

# ── Auth helper ───────────────────────────────────────────────────────────────

async def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = decode_token(token)
        return payload["sub"]
    except:
        raise HTTPException(401, "Invalid token")

# ── Helpers ───────────────────────────────────────────────────────────────────

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

# ── Pydantic models ───────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    format: str = "unranked"

class JoinRoomRequest(BaseModel):
    room_code: str

class QueueRequest(BaseModel):
    format: str = "unranked"   # "ranked" or "unranked"

class QueueStatusRequest(BaseModel):
    format: str

# ── Matchmaking queue endpoints ───────────────────────────────────────────────

@router.post("/queue/join")
async def queue_join(data: QueueRequest, user_id: str = Depends(get_current_user)):
    """
    Add the player to the matchmaking queue for the given format.
    - If another player is already waiting, instantly create a room and match them.
    - If not, create a waiting room and add to queue.
    Returns { matched: bool, room_code, player_slot }
    """
    db = get_db()
    fmt = data.format

    # Remove any stale entry for this user in this queue (re-queue safe)
    _matchmaking_queue[fmt] = [
        e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id
    ]

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    player_name = user.get("username", "Player")

    # Check if someone is already waiting
    queue = _matchmaking_queue[fmt]
    if queue:
        # Match with the first waiting player
        opponent_entry = queue.pop(0)
        opponent_id    = opponent_entry["user_id"]
        room_code      = opponent_entry["room_code"]

        # Update the waiting room: add P2
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

        # Notify P1 via WebSocket that P2 joined
        conns = _room_connections.get(room_code, {})
        p1_ws = conns.get("P1")
        if p1_ws:
            try:
                await p1_ws.send_json({
                    "type": "player_joined",
                    "room": serialize_room(room),
                })
            except:
                pass

        return {
            "matched":     True,
            "room_code":   room_code,
            "player_slot": "P2",
            "room":        serialize_room(room),
        }

    # No one waiting — create a new room and add to queue
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

    return {
        "matched":     False,
        "room_code":   code,
        "player_slot": "P1",
        "room":        serialize_room(room),
    }


@router.post("/queue/leave")
async def queue_leave(data: QueueRequest, user_id: str = Depends(get_current_user)):
    """Remove the player from the matchmaking queue and delete their waiting room."""
    db  = get_db()
    fmt = data.format

    entry = next((e for e in _matchmaking_queue[fmt] if e["user_id"] == user_id), None)
    if entry:
        _matchmaking_queue[fmt] = [
            e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id
        ]
        db.rooms.delete_one({"room_code": entry["room_code"], "status": "waiting"})

    return {"ok": True}


@router.get("/queue/status/{room_code}")
async def queue_status(room_code: str):
    """Poll endpoint — returns current room state. Frontend polls this until game_status == 'playing'."""
    db   = get_db()
    room = db.rooms.find_one({"room_code": room_code.upper()})
    if not room:
        raise HTTPException(404, "Room not found")
    return serialize_room(room)


# ── REST endpoints (private rooms) ────────────────────────────────────────────

@router.post("/create")
async def create_room(data: CreateRoomRequest, user_id: str = Depends(get_current_user)):
    db = get_db()

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    # Level check only for ranked private rooms
    if data.format == "ranked":
        if user.get("level", 1) < 1:
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
    db = get_db()
    room = db.rooms.find_one({"room_code": data.room_code.upper(), "status": "waiting"})
    if not room:
        raise HTTPException(404, "Room not found or already full")
    if str(room["player1_id"]) == user_id:
        raise HTTPException(400, "You cannot join your own room")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    # Level check only for ranked
    if room["format"] == "ranked":
        if user.get("level", 1) < 1:
            raise HTTPException(403, "Cannot join ranked room")

    player_name = user.get("username", "Player 2")

    db.rooms.update_one(
        {"room_code": data.room_code.upper()},
        {"$set": {
            "player2_id":   user_id,
            "player2_name": player_name,
            "status":       "active",
            "game_status":  "playing",
        }}
    )
    room = db.rooms.find_one({"room_code": data.room_code.upper()})

    # Notify P1 via WebSocket
    conns = _room_connections.get(data.room_code.upper(), {})
    p1_ws = conns.get("P1")
    if p1_ws:
        try:
            await p1_ws.send_json({
                "type": "player_joined",
                "room": serialize_room(room),
            })
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