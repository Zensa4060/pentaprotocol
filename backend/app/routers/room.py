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
import asyncio

router = APIRouter()

_room_connections: dict[str, dict] = {}
_room_state: dict[str, dict] = {}  # in-memory cache — eliminates DB read on every move
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

# ── Matchmaking queue ─────────────────────────────────────────────────────────

@router.post("/queue/join")
async def queue_join(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format
    _matchmaking_queue[fmt] = [e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id]

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    player_name = user.get("username", "Player")

    queue = _matchmaking_queue[fmt]
    if queue:
        opponent_entry = queue.pop(0)
        opponent_id    = opponent_entry["user_id"]
        room_code      = opponent_entry["room_code"]

        opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})
        opponent_name = opponent.get("username", "Player") if opponent else "Player"

        await db.rooms.update_one(
            {"room_code": room_code},
            {"$set": {
                "player2_id":   user_id,
                "player2_name": player_name,
                "status":       "active",
                "game_status":  "playing",
            }}
        )
        room = await db.rooms.find_one({"room_code": room_code})

        conns = _room_connections.get(room_code, {})
        p1_ws = conns.get("P1")
        if p1_ws:
            try:
                await p1_ws.send_json({"type": "player_joined", "room": serialize_room(room)})
            except:
                pass

        return {"matched": True, "room_code": room_code, "player_slot": "P2", "room": serialize_room(room)}

    # No one waiting — create room and queue
    attempts = 0
    code = generate_room_code()
    while attempts < 10:
        if not await db.rooms.find_one({"room_code": code, "status": "waiting"}):
            break
        code = generate_room_code()
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
    await db.rooms.insert_one(room)
    _matchmaking_queue[fmt].append({"user_id": user_id, "room_code": code})

    return {"matched": False, "room_code": code, "player_slot": "P1", "room": serialize_room(room)}


@router.post("/queue/leave")
async def queue_leave(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format
    entry = next((e for e in _matchmaking_queue[fmt] if e["user_id"] == user_id), None)
    if entry:
        _matchmaking_queue[fmt] = [e for e in _matchmaking_queue[fmt] if e["user_id"] != user_id]
        await db.rooms.delete_one({"room_code": entry["room_code"], "status": "waiting"})
    return {"ok": True}


@router.get("/queue/status/{room_code}")
async def queue_status(room_code: str):
    db   = get_db()
    room = await db.rooms.find_one({"room_code": room_code.upper()})
    if not room:
        raise HTTPException(404, "Room not found")
    return serialize_room(room)


# ── Private rooms ─────────────────────────────────────────────────────────────

@router.post("/create")
async def create_room(data: CreateRoomRequest, user_id: str = Depends(get_current_user)):
    db   = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if data.format == "ranked" and user.get("level", 1) < 1:
        raise HTTPException(403, "Cannot create ranked room")

    player_name = user.get("username", "Player 1")
    attempts = 0
    code = generate_room_code()
    while attempts < 10:
        if not await db.rooms.find_one({"room_code": code, "status": "waiting"}):
            break
        code = generate_room_code()
        attempts += 1

    engine = GameEngine()
    # Randomly assign creator as P1 or P2
    creator_slot = random.choice(["P1", "P2"])
    room = {
        "room_code":       code,
        "status":          "waiting",
        "format":          data.format,
        "player1_id":      user_id if creator_slot == "P1" else None,
        "player2_id":      user_id if creator_slot == "P2" else None,
        "player1_name":    player_name if creator_slot == "P1" else None,
        "player2_name":    player_name if creator_slot == "P2" else None,
        "creator_slot":    creator_slot,
        "board":           engine.board,
        "current_player":  "P1",
        "moves_played":    0,
        "winner":          None,
        "game_status":     "waiting",
        "created_at":      datetime.utcnow(),
    }
    await db.rooms.insert_one(room)
    result = serialize_room(room)
    result["player_slot"] = creator_slot
    return result


@router.post("/join")
async def join_room(data: JoinRoomRequest, user_id: str = Depends(get_current_user)):
    db   = get_db()
    code = data.room_code.upper().strip()

    any_room = await db.rooms.find_one({"room_code": code})
    if not any_room:
        raise HTTPException(404, "Room not found — check the code and try again")

    if any_room["status"] in ("active", "finished"):
        p1 = str(any_room.get("player1_id", ""))
        p2 = str(any_room.get("player2_id", ""))
        if user_id in (p1, p2):
            return serialize_room(any_room)
        if any_room["status"] == "finished":
            raise HTTPException(400, "This game has already ended")
        raise HTTPException(400, "Room is already full")

    if str(any_room["player1_id"]) == user_id:
        raise HTTPException(400, "You cannot join your own room")

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if any_room["format"] == "ranked" and user.get("level", 1) < 1:
        raise HTTPException(403, "Cannot join ranked room")

    player_name = user.get("username", "Player 2")

    # Joiner gets the slot the creator didn't take
    creator_slot = any_room.get("creator_slot", "P1")
    joiner_slot  = "P2" if creator_slot == "P1" else "P1"

    update_fields = {
        "status":      "active",
        "game_status": "playing",
    }
    if joiner_slot == "P1":
        update_fields["player1_id"]   = user_id
        update_fields["player1_name"] = player_name
    else:
        update_fields["player2_id"]   = user_id
        update_fields["player2_name"] = player_name

    await db.rooms.update_one({"room_code": code}, {"$set": update_fields})
    room = await db.rooms.find_one({"room_code": code})

    conns = _room_connections.get(code, {})
    creator_ws = conns.get(creator_slot)
    if creator_ws:
        try:
            await creator_ws.send_json({"type": "player_joined", "room": serialize_room(room)})
        except:
            pass

    result = serialize_room(room)
    result["player_slot"] = joiner_slot
    return result


@router.get("/{room_code}")
async def get_room(room_code: str):
    db   = get_db()
    room = await db.rooms.find_one({"room_code": room_code.upper()})
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
    # Close any existing connection for this slot (prevents zombie entries)
    old_ws = _room_connections[room_code].get(player_slot)
    if old_ws and old_ws is not websocket:
        try:
            await old_ws.close()
        except:
            pass
    _room_connections[room_code][player_slot] = websocket

    db = get_db()

    try:
        room = await db.rooms.find_one({"room_code": room_code})
        if room:
            _room_state[room_code] = room  # seed cache
            await websocket.send_json({"type": "room_state", "room": serialize_room(room)})

        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)

            if msg["type"] == "move":
                row = msg["row"]
                col = msg["col"]

                # Use in-memory cache — avoids 50-150ms Atlas round-trip on every move
                room = _room_state.get(room_code)
                if not room:
                    room = await db.rooms.find_one({"room_code": room_code})
                    if room:
                        _room_state[room_code] = room
                if not room or room["game_status"] != "playing":
                    continue

                if player_slot != room["current_player"]:
                    await websocket.send_json({"type": "error", "message": "Not your turn"})
                    continue

                engine = GameEngine()
                engine.board          = room["board"]
                engine.current_player = room["current_player"]
                engine.moves_played   = room["moves_played"]
                engine.extra_turns    = room.get("extra_turns", 0)
                engine.c3_blocked     = room.get("c3_blocked", False)

                result      = engine.deploy(row, col)
                is_finished = bool(result.get("winner"))

                update = {
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "extra_turns":    engine.extra_turns,
                    "winner":         result.get("winner"),
                    "game_status":    "finished" if is_finished else "playing",
                    "status":         "finished" if is_finished else "active",
                }

                # Update in-memory cache immediately
                _room_state[room_code] = {**room, **update}

                # Broadcast immediately — no DB wait
                broadcast = {
                    "type":           "move_made",
                    "row":            row,
                    "col":            col,
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "winner":         result.get("winner"),
                    "win_line":       [[r, c] for r, c in engine.winner_line] if engine.winner_line else [],
                    "game_status":    update["game_status"],
                    "extra_turns":    result.get("extra_turns", 0),
                }
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

                # DB write in background — broadcast already done
                asyncio.create_task(db.rooms.update_one({"room_code": room_code}, {"$set": update}))

                if is_finished:
                    game_dict = {
                        "player1_id": room["player1_id"],
                        "player2_id": room["player2_id"],
                        "format":     room["format"],
                        "mode":       "multiplayer",
                    }
                    # Fire in background — don't block the WS loop
                    asyncio.create_task(award_game_result(db, game_dict, result.get("winner")))

            elif msg["type"] == "ready":
                ready_val = msg.get("ready", True)
                ready_field = "p1_ready" if player_slot == "P1" else "p2_ready"

                # Update cache immediately, fire DB write in background
                if room_code in _room_state:
                    _room_state[room_code][ready_field] = ready_val
                asyncio.create_task(db.rooms.update_one(
                    {"room_code": room_code},
                    {"$set": {ready_field: ready_val}}
                ))

                # Broadcast ready state to both players
                broadcast = {
                    "type":   "ready_update",
                    "player": player_slot,
                    "ready":  ready_val,
                }
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

                # Check if both ready — use cache
                room = _room_state.get(room_code, {})
                if room.get("p1_ready") and room.get("p2_ready"):
                    reset = {
                        "board":          [[None]*5 for _ in range(5)],
                        "current_player": "P2" if room.get("game_number", 1) % 2 == 1 else "P1",
                        "moves_played":   0,
                        "extra_turns":    0,
                        "winner":         None,
                        "game_status":    "playing",
                        "status":         "active",
                        "p1_ready":       False,
                        "p2_ready":       False,
                        "game_number":    room.get("game_number", 1) + 1,
                    }
                    # Update cache and broadcast immediately
                    _room_state[room_code] = {**room, **reset}
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({"type": "game_reset", "first_player": reset["current_player"], "game_number": reset["game_number"]})
                        except:
                            pass
                    # DB write in background
                    asyncio.create_task(db.rooms.update_one({"room_code": room_code}, {"$set": reset}))

            elif msg["type"] == "chat":
                # Broadcast chat to both players
                broadcast = {
                    "type": "chat_message",
                    "from": player_slot,
                    "text": msg.get("text", ""),
                    "ts":   msg.get("ts", 0),
                }
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

            elif msg["type"] == "match_over_notify":
                # Broadcast to both players to show rematch UI
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "match_over"})
                    except:
                        pass

            elif msg["type"] == "rematch":
                rematch_field = "p1_rematch" if player_slot == "P1" else "p2_rematch"
                await db.rooms.update_one({"room_code": room_code}, {"$set": {rematch_field: True}})
                # Notify opponent
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "rematch_request", "from": player_slot})
                    except:
                        pass
                # Check if both want rematch
                room = await db.rooms.find_one({"room_code": room_code})
                if room and room.get("p1_rematch") and room.get("p2_rematch"):
                    reset = {
                        "board":          [[None]*5 for _ in range(5)],
                        "current_player": "P1",
                        "moves_played":   0,
                        "extra_turns":    0,
                        "winner":         None,
                        "game_status":    "playing",
                        "status":         "active",
                        "p1_ready":       False,
                        "p2_ready":       False,
                        "p1_rematch":     False,
                        "p2_rematch":     False,
                        "game_number":    1,
                    }
                    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({"type": "game_reset", "first_player": "P1", "game_number": 1})
                        except:
                            pass

            elif msg["type"] == "quit_match":
                # Disband room and send both players home
                await db.rooms.update_one({"room_code": room_code}, {"$set": {"game_status": "disbanded"}})
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "match_disbanded"})
                    except:
                        pass

            elif msg["type"] == "toss_action":
                # P1 initiates toss, broadcast result to both
                action = msg.get("action")  # "start_rb", "coin_result", "phase_choice", "toss_summary"
                payload = msg.get("payload", {})
                broadcast = {"type": "toss_action", "action": action, "payload": payload, "from": player_slot}
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

            elif msg["type"] == "rb_start_game":
                # Rulebreaker game 3 start — toss winner sends this
                room = _room_state.get(room_code)
                if not room:
                    room = await db.rooms.find_one({"room_code": room_code})
                    if room:
                        _room_state[room_code] = room
                if not room:
                    continue
                # Idempotent: if game 3 already started, ignore
                if room.get("game_number") == 3 and room.get("game_status") == "playing":
                    continue
                first_player = msg.get("first_player", "P1")
                c3_blocked   = msg.get("c3_blocked", False)
                reset = {
                    "board":          [[None]*5 for _ in range(5)],
                    "current_player": first_player,
                    "moves_played":   0,
                    "extra_turns":    0,
                    "winner":         None,
                    "game_status":    "playing",
                    "status":         "active",
                    "p1_ready":       False,
                    "p2_ready":       False,
                    "game_number":    3,
                    "c3_blocked":     c3_blocked,
                }
                # Update cache and broadcast immediately
                _room_state[room_code] = {**room, **reset}
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({
                            "type":        "game_reset",
                            "first_player": first_player,
                            "game_number":  3,
                            "c3_blocked":   c3_blocked,
                        })
                    except:
                        pass
                # DB write in background
                asyncio.create_task(db.rooms.update_one({"room_code": room_code}, {"$set": reset}))

            elif msg["type"] == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        if room_code in _room_connections:
            _room_connections[room_code].pop(player_slot, None)
            if not _room_connections[room_code]:
                del _room_connections[room_code]
                _room_state.pop(room_code, None)  # clear cache when room empty

        for slot, ws in _room_connections.get(room_code, {}).items():
            try:
                await ws.send_json({"type": "opponent_disconnected"})
            except:
                pass