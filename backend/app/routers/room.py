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

# Runtime (in-memory) per-room sync state (not persisted)
_room_runtime: dict[str, dict] = {}
DISCONNECT_GRACE_SECONDS = 3.0


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
        "player1_elo":    room.get("player1_elo"),
        "player2_elo":    room.get("player2_elo"),
        "player1_avatar": room.get("player1_avatar"),
        "player2_avatar": room.get("player2_avatar"),
        "player1_banner": room.get("player1_banner"),
        "player2_banner": room.get("player2_banner"),
        "player1_border": room.get("player1_border"),
        "player2_border": room.get("player2_border"),
        "player1_title":  room.get("player1_title"),
        "player2_title":  room.get("player2_title"),
        "player1_level":  room.get("player1_level"),
        "player2_level":  room.get("player2_level"),
        "board":          room.get("board"),
        "board_mode":     room.get("board_mode", "5x5"),
        "selected_patterns": room.get("selected_patterns", []),
        "current_player": room.get("current_player", "P1"),
        "moves_played":   room.get("moves_played", 0),
        "winner":         room.get("winner"),
        "game_status":    room.get("game_status", "waiting"),
        "game_number":    room.get("game_number", 1),
        "match_history":  room.get("match_history", []),
        "p1_series_points": room.get("p1_series_points", 0),
        "p2_series_points": room.get("p2_series_points", 0),
        "series_winner":  room.get("series_winner"),
        "awaiting_rulebreaker": room.get("awaiting_rulebreaker", False),
        "segment_start_index": room.get("segment_start_index", 0),
        "history_display_start_index": room.get("history_display_start_index", 0),
    }


def compute_segment_points(history: list, segment_start: int) -> tuple[int, int]:
    """Wins in the current board segment only; DRAW adds nothing."""
    if segment_start > len(history):
        return 0, 0
    seg = history[segment_start:]
    p1 = sum(1 for w in seg if w == "P1")
    p2 = sum(1 for w in seg if w == "P2")
    return p1, p2


def compute_series_winner(history: list, segment_start: int, win_cap: int = 2) -> str | None:
    """
    First-to-two decisive wins, plus DRAW → win → DRAW (three games): the middle winner
    wins the segment (e.g. G1 draw, G2 P1, G3 draw → P1 wins the series).
    """
    if segment_start > len(history):
        return None
    seg = history[segment_start:]
    p1_pts, p2_pts = compute_segment_points(history, segment_start)

    if p1_pts >= win_cap and p1_pts > p2_pts:
        return "P1"
    if p2_pts >= win_cap and p2_pts > p1_pts:
        return "P2"

    if len(seg) == 3 and seg[0] == "DRAW" and seg[2] == "DRAW":
        mid = seg[1]
        if mid == "P1" and p2_pts == 0:
            return "P1"
        if mid == "P2" and p1_pts == 0:
            return "P2"

    if len(seg) == 3 and seg[0] == "DRAW" and seg[1] == "DRAW" and seg[2] in ("P1", "P2"):
        return seg[2]
    return None


def compute_awaiting_rulebreaker(history: list, segment_start: int) -> bool:
    """
    After each completed *pair* of games in the segment, Rulebreaker is required
    before the next game **unless** that pair was a two-game sweep (same player won both).

    The only cases with no Rulebreaker after two games are P1,P1 or P2,P2.

    After three games at 1–1 (or triple draw pending upgrade), never require a second
    Rulebreaker on the same grid — the move handler upgrades 5×5→7×7 or the segment ends.
    """
    if segment_start > len(history):
        return False
    seg = history[segment_start:]
    p1w = sum(1 for w in seg if w == "P1")
    p2w = sum(1 for w in seg if w == "P2")
    if len(seg) >= 3 and p1w == 1 and p2w == 1:
        return False
    if len(seg) >= 3 and all(w == "DRAW" for w in seg):
        return False
    if len(seg) < 2 or len(seg) % 2 != 0:
        return False
    g1, g2 = seg[-2], seg[-1]
    if g1 == g2 and g1 in ("P1", "P2"):
        return False
    return True


def should_auto_upgrade_7x7_after_5x5_game3(
    new_history: list,
    segment_start: int,
    board_mode: str,
    game_number: int,
) -> bool:
    """
    After game 3 on 5×5, if the segment is still undecided and either tied 1–1 in wins
    or all three games were draws, open the 7×7 leg (no second 5×5 Rulebreaker).
    """
    if board_mode != "5x5" or game_number != 3:
        return False
    if segment_start > len(new_history):
        return False
    seg = new_history[segment_start:]
    if len(seg) != 3:
        return False
    if compute_series_winner(new_history, segment_start, 2) is not None:
        return False
    p1p, p2p = compute_segment_points(new_history, segment_start)
    if p1p == 1 and p2p == 1:
        return True
    if all(w == "DRAW" for w in seg):
        return True
    return False


async def _apply_5x5_to_7x7_upgrade(
    db,
    room_code: str,
    room: dict,
    new_history: list,
    outcome,
    *,
    game1_patch: dict | None = None,
    finished_board: list,
    row: int | None = None,
    col: int | None = None,
    moves_played: int | None = None,
    current_player: str | None = None,
    win_line: list | None = None,
    extra_turns: int = 0,
    connection_scores=None,
) -> None:
    from app.core.patterns7 import PATTERN_NAMES_7

    rt = _room_runtime.get(room_code)
    if rt is not None:
        rt["levelup_ready"] = {"P1": False, "P2": False}

    patch = dict(game1_patch or {})
    g1f = room.get("game1_first_player") or "P1"
    first_7 = "P2" if g1f == "P1" else "P1"
    # Start a fresh 7x7 segment: score and G1/G2/G3 should reset.
    seg_new = len(new_history)
    ss = compute_series_state(new_history, seg_new)
    hist_display_start = len(new_history)

    upgrade_update = {
        **patch,
        "board": [[None] * 7 for _ in range(7)],
        "board_mode": "7x7",
        "selected_patterns": list(PATTERN_NAMES_7),
        "current_player": first_7,
        "moves_played": 0,
        "extra_turns": 0,
        "winner": None,
        "game_status": "playing",
        "status": "active",
        "match_history": new_history,
        "segment_start_index": seg_new,
        "history_display_start_index": hist_display_start,
        "game_number": 1,
        "game1_first_player": None,
        "c3_blocked": False,
        "awaiting_rulebreaker": False,
        "p1_series_points": ss["p1_series_points"],
        "p2_series_points": ss["p2_series_points"],
        "series_winner": ss["series_winner"],
    }
    await db.rooms.update_one({"room_code": room_code}, {"$set": upgrade_update})

    move_broadcast = {
        "type": "move_made",
        "board": finished_board,
        "winner": outcome,
        "win_line": win_line or [],
        "game_status": "finished",
        "extra_turns": extra_turns,
        "match_history": new_history,
        "p1_series_points": ss["p1_series_points"],
        "p2_series_points": ss["p2_series_points"],
        "series_winner": ss["series_winner"],
        "awaiting_rulebreaker": False,
        "segment_start_index": seg_new,
        "history_display_start_index": hist_display_start,
        "auto_7x7_upgrade_follows": True,
    }
    if row is not None and col is not None:
        move_broadcast["row"] = row
        move_broadcast["col"] = col
    if moves_played is not None:
        move_broadcast["moves_played"] = moves_played
    if current_player is not None:
        move_broadcast["current_player"] = current_player
    if connection_scores is not None:
        move_broadcast["connectionScores"] = connection_scores

    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(move_broadcast)
        except:
            pass

    gr_payload = {
        "type": "game_reset",
        "first_player": first_7,
        "game_number": 1,
        "board_mode": "7x7",
        "segment_start_index": seg_new,
        "history_display_start_index": hist_display_start,
        "p1_series_points": ss["p1_series_points"],
        "p2_series_points": ss["p2_series_points"],
        "selected_patterns": list(PATTERN_NAMES_7),
        "c3_blocked": False,
        "from_5x5_level_up": True,
        "from_5x5_draw_upgrade": True,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr_payload)
        except:
            pass

    game_dict = {
        "player1_id": room["player1_id"],
        "player2_id": room["player2_id"],
        "format":     room["format"],
        "source":     room.get("source", "matchmaking"),
        "mode":       "multiplayer",
    }
    asyncio.create_task(award_game_result(db, game_dict, outcome))


def compute_series_state(history: list, segment_start: int) -> dict:
    p1_pts, p2_pts = compute_segment_points(history, segment_start)
    series_winner = compute_series_winner(history, segment_start, 2)
    awaiting_rb = False if series_winner else compute_awaiting_rulebreaker(history, segment_start)
    return {
        "p1_series_points": p1_pts,
        "p2_series_points": p2_pts,
        "series_winner": series_winner,
        "awaiting_rulebreaker": awaiting_rb,
    }

class JoinRoomRequest(BaseModel):
    room_code: str

class QueueRequest(BaseModel):
    format: str = "unranked"
    board_mode: str = "5x5"
    selected_patterns: Optional[list[str]] = None

class CreateRoomRequest(BaseModel):
    format: str = "unranked"
    board_mode: str = "5x5"
    selected_patterns: Optional[list[str]] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _generate_unique_code(db) -> str:
    """Generate a room code guaranteed not to collide with any active waiting room."""
    for _ in range(20):
        code = generate_room_code()
        existing = await db.rooms.find_one({"room_code": code, "status": "waiting"})
        if not existing:
            return code
    # Extremely unlikely fallback — timestamp suffix
    return generate_room_code() + str(int(datetime.utcnow().timestamp()))[-2:]


async def _cleanup_stale_rooms(db, user_id: str):
    """
    Delete any waiting/active rooms that belong to this user but have no
    opponent yet AND are older than 5 minutes (clearly abandoned).
    Also removes their matchmaking_queue entries.
    """
    cutoff = datetime.utcnow().timestamp() - 300  # 5 minutes ago
    stale_rooms = await db.rooms.find({
        "$or": [{"player1_id": user_id}, {"player2_id": user_id}],
        "status": "waiting",
    }).to_list(length=50)

    for room in stale_rooms:
        created = room.get("created_at")
        if created and created.timestamp() < cutoff:
            await db.rooms.delete_one({"room_code": room["room_code"]})
            await db.matchmaking_queue.delete_many({"room_code": room["room_code"]})


# ── Matchmaking queue ─────────────────────────────────────────────────────────

@router.post("/queue/join")
async def queue_join(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    player_name = user.get("username", "Player")

    # ── Clean up stale waiting rooms for this user before doing anything ──
    await _cleanup_stale_rooms(db, user_id)

    # Remove any existing queue entry for this user (idempotent re-queue)
    await db.matchmaking_queue.delete_many({"user_id": user_id, "format": fmt})

    # Try to find an opponent already waiting (MongoDB-persisted queue)
    opponent_entry = await db.matchmaking_queue.find_one_and_delete(
        {"format": fmt, "user_id": {"$ne": user_id}}
    )

    if opponent_entry:
        opponent_id = opponent_entry["user_id"]
        room_code   = opponent_entry["room_code"]

        # Verify the waiting room still exists
        waiting_room = await db.rooms.find_one({"room_code": room_code, "status": "waiting"})
        if not waiting_room:
            # Opponent's room disappeared — fall through to create a new one
            opponent_entry = None
        else:
            opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})

            await db.rooms.update_one(
                {"room_code": room_code},
                {"$set": {
                    "player2_id":     user_id,
                    "player2_name":   player_name,
                    "player2_elo":    user.get("elo", 100),
                    "player2_avatar": user.get("avatar"),
                    "player2_banner": user.get("banner", "default"),
                    "player2_border": user.get("border_style", "none"),
                    "player2_title":  user.get("title", "newcomer"),
                    "player2_level":  user.get("level", 1),
                    "status":         "active",
                    "game_status":    "playing",
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

    # No valid opponent — create a new waiting room
    code = await _generate_unique_code(db)

    # For 7x7 multiplayer, randomize patterns if not provided
    board_mode = data.board_mode or "5x5"
    selected_patterns = data.selected_patterns
    if board_mode == "7x7" and not selected_patterns:
        from app.core.patterns7 import PATTERN_NAMES_7
        selected_patterns = list(PATTERN_NAMES_7)

    engine = GameEngine(board_mode=board_mode, selected_pattern_ids=selected_patterns)
    room = {
        "room_code":      code,
        "status":         "waiting",
        "format":         fmt,
        "board_mode":     board_mode,
        "selected_patterns": selected_patterns,
        "source":         "matchmaking",
        "player1_id":     user_id,
        "player1_name":   player_name,
        "player1_elo":    user.get("elo", 100),
        "player1_avatar": user.get("avatar"),
        "player1_banner": user.get("banner", "default"),
        "player1_border": user.get("border_style", "none"),
        "player1_title":  user.get("title", "newcomer"),
        "player1_level":  user.get("level", 1),
        "board":          engine.board,
        "current_player": "P1",
        "moves_played":   0,
        "game_status":    "waiting",
        "game_number":    1,
        "match_history":  [],
        "series_winner":  None,
        "p1_series_points": 0,
        "p2_series_points": 0,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
        "created_at":     datetime.utcnow(),
    }
    await db.rooms.insert_one(room)

    # Persist queue entry in MongoDB with TTL (ensure TTL index exists — see main.py startup)
    await db.matchmaking_queue.insert_one({
        "user_id":    user_id,
        "room_code":  code,
        "format":     fmt,
        "created_at": datetime.utcnow(),
    })

    return {"matched": False, "room_code": code, "player_slot": "P1", "room": serialize_room(room)}


@router.post("/queue/leave")
async def queue_leave(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format
    entry = await db.matchmaking_queue.find_one_and_delete(
        {"user_id": user_id, "format": fmt}
    )
    if entry:
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

    # ── Clean up any stale waiting rooms for this user first ──
    await _cleanup_stale_rooms(db, user_id)

    player_name = user.get("username", "Player 1")
    code = await _generate_unique_code(db)

    # For 7x7 multiplayer, randomize patterns if not provided
    board_mode = data.board_mode or "5x5"
    selected_patterns = data.selected_patterns
    if board_mode == "7x7" and not selected_patterns:
        from app.core.patterns7 import PATTERN_NAMES_7
        selected_patterns = list(PATTERN_NAMES_7)

    engine = GameEngine(board_mode=board_mode, selected_pattern_ids=selected_patterns)
    creator_slot = random.choice(["P1", "P2"])
    room = {
        "room_code":       code,
        "status":          "waiting",
        "format":          data.format,
        "board_mode":      board_mode,
        "selected_patterns": selected_patterns,
        "source":          "private",
        "player1_id":      user_id if creator_slot == "P1" else None,
        "player2_id":      user_id if creator_slot == "P2" else None,
        "player1_name":    player_name if creator_slot == "P1" else None,
        "player2_name":    player_name if creator_slot == "P2" else None,
        "player1_elo":     user.get("elo", 100)  if creator_slot == "P1" else None,
        "player2_elo":     user.get("elo", 100)  if creator_slot == "P2" else None,
        "player1_avatar":  user.get("avatar")     if creator_slot == "P1" else None,
        "player2_avatar":  user.get("avatar")     if creator_slot == "P2" else None,
        "player1_banner":  user.get("banner", "default") if creator_slot == "P1" else None,
        "player2_banner":  user.get("banner", "default") if creator_slot == "P2" else None,
        "player1_border":  user.get("border_style", "none") if creator_slot == "P1" else None,
        "player2_border":  user.get("border_style", "none") if creator_slot == "P2" else None,
        "player1_title":   user.get("title", "newcomer") if creator_slot == "P1" else None,
        "player2_title":   user.get("title", "newcomer") if creator_slot == "P2" else None,
        "player1_level":   user.get("level", 1)  if creator_slot == "P1" else None,
        "player2_level":   user.get("level", 1)  if creator_slot == "P2" else None,
        "creator_slot":    creator_slot,
        "board":           engine.board,
        "current_player":  "P1",
        "moves_played":    0,
        "winner":          None,
        "game_status":     "waiting",
        "game_number":     1,
        "match_history":   [],
        "series_winner":   None,
        "p1_series_points": 0,
        "p2_series_points": 0,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
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
            result = serialize_room(any_room)
            creator_slot = any_room.get("creator_slot", "P1")
            result["player_slot"] = "P1" if user_id == p1 else "P2"
            return result
        if any_room["status"] == "finished":
            raise HTTPException(400, "This game has already ended")
        raise HTTPException(400, "Room is already full")

    # Check if this user is the creator (in either slot)
    p1_id = str(any_room.get("player1_id") or "")
    p2_id = str(any_room.get("player2_id") or "")
    if user_id in (p1_id, p2_id):
        # User is already in this room as the creator — return their slot
        result = serialize_room(any_room)
        result["player_slot"] = "P1" if user_id == p1_id else "P2"
        return result

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")

    if any_room["format"] == "ranked" and user.get("level", 1) < 1:
        raise HTTPException(403, "Cannot join ranked room")

    player_name = user.get("username", "Player 2")

    creator_slot = any_room.get("creator_slot", "P1")
    joiner_slot  = "P2" if creator_slot == "P1" else "P1"

    update_fields = {
        "status":       "active",
        "game_status":  "playing",
        "game_number":  1,
        "match_history": [],
        "p1_series_points": 0,
        "p2_series_points": 0,
        "series_winner": None,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
        "game1_first_player": None,
    }
    if joiner_slot == "P1":
        update_fields["player1_id"]     = user_id
        update_fields["player1_name"]   = player_name
        update_fields["player1_elo"]    = user.get("elo", 100)
        update_fields["player1_avatar"] = user.get("avatar")
        update_fields["player1_banner"] = user.get("banner", "default")
        update_fields["player1_border"] = user.get("border_style", "none")
        update_fields["player1_title"]  = user.get("title", "newcomer")
        update_fields["player1_level"]  = user.get("level", 1)
    else:
        update_fields["player2_id"]     = user_id
        update_fields["player2_name"]   = player_name
        update_fields["player2_elo"]    = user.get("elo", 100)
        update_fields["player2_avatar"] = user.get("avatar")
        update_fields["player2_banner"] = user.get("banner", "default")
        update_fields["player2_border"] = user.get("border_style", "none")
        update_fields["player2_title"]  = user.get("title", "newcomer")
        update_fields["player2_level"]  = user.get("level", 1)

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
    _room_connections[room_code][player_slot] = websocket

    db = get_db()
    if room_code not in _room_runtime:
        _room_runtime[room_code] = {
            "match_ready": {"P1": False, "P2": False},
            "levelup_ready": {"P1": False, "P2": False},
            "ready_since_ms": None,
            "start_at_ms": None,
            "rtt_ms": {"P1": None, "P2": None},
        }

    try:
        room = await db.rooms.find_one({"room_code": room_code})
        if room:
            await websocket.send_json({"type": "room_state", "room": serialize_room(room)})

        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)

            if msg["type"] == "move":
                row = msg["row"]
                col = msg["col"]

                room = await db.rooms.find_one({"room_code": room_code})
                if not room or room["game_status"] != "playing":
                    continue

                if player_slot != room["current_player"]:
                    await websocket.send_json({"type": "error", "message": "Not your turn"})
                    continue

                engine = GameEngine(
                    board_mode=room.get("board_mode", "5x5"),
                    selected_pattern_ids=room.get("selected_patterns")
                )
                engine.board          = room["board"]
                engine.current_player = room["current_player"]
                engine.moves_played   = room["moves_played"]
                engine.extra_turns    = room.get("extra_turns", 0)
                engine.c3_blocked     = room.get("c3_blocked", False)

                result      = engine.deploy(row, col)
                is_finished = bool(result.get("winner"))

                game1_patch: dict = {}
                if (
                    room.get("game_number", 1) == 1
                    and room.get("moves_played", 0) == 0
                ):
                    game1_patch["game1_first_player"] = player_slot

                update = {
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "extra_turns":    engine.extra_turns,
                    "winner":         result.get("winner"),
                    "game_status":    "finished" if is_finished else "playing",
                    "status":         "finished" if is_finished else "active",
                    **game1_patch,
                }

                if is_finished:
                    outcome = result.get("winner")
                    history = room.get("match_history", [])
                    seg_start = room.get("segment_start_index", 0)
                    gn = room.get("game_number", 1)
                    bm = room.get("board_mode", "5x5")

                    new_history = history + [outcome]
                    if should_auto_upgrade_7x7_after_5x5_game3(
                        new_history, seg_start, bm, gn
                    ):
                        finished_5 = [list(r) for r in engine.board]
                        await _apply_5x5_to_7x7_upgrade(
                            db,
                            room_code,
                            room,
                            new_history,
                            outcome,
                            game1_patch=game1_patch,
                            finished_board=finished_5,
                            row=row,
                            col=col,
                            moves_played=engine.moves_played,
                            current_player=engine.current_player,
                            win_line=[[r, c] for r, c in engine.winner_line]
                            if engine.winner_line
                            else [],
                            extra_turns=result.get("extra_turns", 0),
                            connection_scores=result.get("connectionScores"),
                        )
                        continue

                    update.update(
                        {
                            "match_history": new_history,
                            **compute_series_state(new_history, seg_start),
                        }
                    )
                    # 7x7 final game rule: after Game 3, tied points means full match DRAW.
                    if (
                        bm == "7x7"
                        and gn >= 3
                        and update.get("series_winner") is None
                        and not update.get("awaiting_rulebreaker", False)
                        and update.get("p1_series_points") == update.get("p2_series_points")
                    ):
                        update["series_winner"] = "DRAW"

                await db.rooms.update_one({"room_code": room_code}, {"$set": update})

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
                    "connectionScores": result.get("connectionScores"),
                }
                if is_finished:
                    broadcast["match_history"] = update["match_history"]
                    broadcast["p1_series_points"] = update["p1_series_points"]
                    broadcast["p2_series_points"] = update["p2_series_points"]
                    broadcast["series_winner"] = update["series_winner"]
                    broadcast["awaiting_rulebreaker"] = update["awaiting_rulebreaker"]
                    broadcast["segment_start_index"] = update.get(
                        "segment_start_index", room.get("segment_start_index", 0)
                    )
                    broadcast["history_display_start_index"] = update.get(
                        "history_display_start_index",
                        room.get("history_display_start_index", 0),
                    )

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

                if is_finished:
                    game_dict = {
                        "player1_id": room["player1_id"],
                        "player2_id": room["player2_id"],
                        "format":     room["format"],
                        "source":     room.get("source", "matchmaking"),
                        "mode":       "multiplayer",
                    }
                    asyncio.create_task(award_game_result(db, game_dict, result.get("winner")))

            elif msg["type"] == "ready":
                ready_val   = msg.get("ready", True)
                ready_field = "p1_ready" if player_slot == "P1" else "p2_ready"

                await db.rooms.update_one(
                    {"room_code": room_code},
                    {"$set": {ready_field: ready_val}}
                )

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

                room = await db.rooms.find_one({"room_code": room_code})
                if room and room.get("p1_ready") and room.get("p2_ready"):
                    if room.get("series_winner"):
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": {"p1_ready": False, "p2_ready": False}},
                        )
                        continue

                    if room.get("awaiting_rulebreaker"):
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": {"p1_ready": False, "p2_ready": False}},
                        )
                        continue

                    current_game = room.get("game_number", 1)
                    bm = room.get("board_mode", "5x5")
                    sp = room.get("selected_patterns")
                    new_engine = GameEngine(board_mode=bm, selected_pattern_ids=sp)
                    next_game = current_game + 1
                    g1f = room.get("game1_first_player") or "P1"
                    first_next = g1f if next_game % 2 == 1 else ("P2" if g1f == "P1" else "P1")

                    reset = {
                        "board":          new_engine.board,
                        "current_player": first_next,
                        "moves_played":   0,
                        "extra_turns":    0,
                        "winner":         None,
                        "game_status":    "playing",
                        "status":         "active",
                        "p1_ready":       False,
                        "p2_ready":       False,
                        "game_number":    next_game,
                    }

                    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})

                    gr_payload = {
                        "type":         "game_reset",
                        "first_player": reset["current_player"],
                        "game_number":  reset["game_number"],
                        "board_mode":   bm,
                    }
                    if sp is not None:
                        gr_payload["selected_patterns"] = sp
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(gr_payload)
                        except:
                            pass

            elif msg["type"] == "levelup_ready":
                rt = _room_runtime.get(room_code)
                if not rt:
                    continue
                if "levelup_ready" not in rt:
                    rt["levelup_ready"] = {"P1": False, "P2": False}
                ready_val = bool(msg.get("ready", True))
                rt["levelup_ready"][player_slot] = ready_val

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(
                            {
                                "type": "levelup_ready_update",
                                "player": player_slot,
                                "ready": ready_val,
                            }
                        )
                    except:
                        pass

                if rt["levelup_ready"].get("P1") and rt["levelup_ready"].get("P2"):
                    rt["levelup_ready"] = {"P1": False, "P2": False}
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({"type": "levelup_start"})
                        except:
                            pass

            elif msg["type"] == "chat":
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
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "match_over"})
                    except:
                        pass

            elif msg["type"] == "rematch":
                rematch_field = "p1_rematch" if player_slot == "P1" else "p2_rematch"

                await db.rooms.update_one(
                    {"room_code": room_code},
                    {"$set": {rematch_field: True}}
                )

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "rematch_request", "from": player_slot})
                    except:
                        pass

                room = await db.rooms.find_one({"room_code": room_code})
                if room and room.get("p1_rematch") and room.get("p2_rematch"):
                    last_series = {
                        "winner":  room.get("series_winner"),
                        "history": room.get("match_history", []),
                    }

                    bm = "5x5"
                    sp = None
                    new_engine = GameEngine(board_mode=bm, selected_pattern_ids=sp)

                    reset = {
                        "board":          new_engine.board,
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
                        "match_history":  [],
                        "series_winner":  None,
                        "c3_blocked":     False,
                        "p1_series_points": 0,
                        "p2_series_points": 0,
                        "awaiting_rulebreaker": False,
                        "segment_start_index": 0,
                        "history_display_start_index": 0,
                        "game1_first_player": None,
                        "board_mode": "5x5",
                        "selected_patterns": None,
                    }

                    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})

                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({
                                "type":         "game_reset",
                                "first_player": "P1",
                                "game_number":  1,
                                "board_mode": "5x5",
                                "selected_patterns": [],
                                "history_display_start_index": 0,
                                "last_series":  last_series,
                            })
                        except:
                            pass

            elif msg["type"] == "quit_match":
                await db.rooms.update_one(
                    {"room_code": room_code},
                    {"$set": {"game_status": "disbanded"}}
                )
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({"type": "match_disbanded"})
                    except:
                        pass

            elif msg["type"] == "match_found_ready":
                rt = _room_runtime.get(room_code)
                if not rt:
                    continue
                rt["match_ready"][player_slot] = True
                if rt["ready_since_ms"] is None:
                    rt["ready_since_ms"] = int(datetime.utcnow().timestamp() * 1000)

                if rt["match_ready"].get("P1") and rt["match_ready"].get("P2") and rt["start_at_ms"] is None:
                    now_ms = int(datetime.utcnow().timestamp() * 1000)
                    rt["start_at_ms"] = now_ms + 3000
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({"type": "match_start", "start_at_ms": rt["start_at_ms"]})
                        except:
                            pass

                if rt["start_at_ms"] is None and rt["ready_since_ms"] is not None:
                    now_ms = int(datetime.utcnow().timestamp() * 1000)
                    if now_ms - rt["ready_since_ms"] >= 60000:
                        await db.rooms.update_one({"room_code": room_code}, {"$set": {"game_status": "disbanded"}})
                        for slot, ws in _room_connections.get(room_code, {}).items():
                            try:
                                await ws.send_json({"type": "match_disbanded"})
                            except:
                                pass

            elif msg["type"] == "net_report":
                rt = _room_runtime.get(room_code)
                if not rt:
                    continue
                rtt = msg.get("rtt_ms")
                try:
                    rtt = float(rtt)
                except:
                    rtt = None
                if rtt is not None:
                    rt["rtt_ms"][player_slot] = rtt
                    payload = {"type": "net_update", "p1_rtt_ms": rt["rtt_ms"].get("P1"), "p2_rtt_ms": rt["rtt_ms"].get("P2")}
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(payload)
                        except:
                            pass

            elif msg["type"] == "toss_action":
                action  = msg.get("action")
                payload = msg.get("payload", {})
                broadcast = {"type": "toss_action", "action": action, "payload": payload, "from": player_slot}
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

            elif msg["type"] == "rb_start_game":
                room = await db.rooms.find_one({"room_code": room_code})
                if not room:
                    continue
                # Only from a completed game (avoids mid-game abuse / double rb_start).
                if room.get("game_status") != "finished":
                    continue

                hist = room.get("match_history", [])
                seg_start = room.get("segment_start_index", 0)
                p1p, p2p = compute_segment_points(hist, seg_start)

                # After Rulebreaker toss: only end the match if first-to-two is already decided
                # (e.g. rare edge case). If e.g. segment is 1-0 after DRAW+win, play the next game (G3).
                if bool(msg.get("resolve_series_only")):
                    if not room.get("awaiting_rulebreaker"):
                        continue
                    leader = compute_series_winner(hist, seg_start, 2)
                    if leader is None:
                        continue
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {
                            "$set": {
                                "series_winner": leader,
                                "awaiting_rulebreaker": False,
                                "game_status": "finished",
                                "status": "finished",
                            }
                        },
                    )
                    done = {
                        "type": "series_resolved",
                        "series_winner": leader,
                        "match_history": hist,
                        "p1_series_points": p1p,
                        "p2_series_points": p2p,
                        "segment_start_index": seg_start,
                    }
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(done)
                        except:
                            pass
                    continue

                # 7×7: after Rulebreaker toss, tied segment score → entire match is a draw (no further game).
                if bool(msg.get("resolve_series_draw")):
                    if room.get("board_mode", "5x5") != "7x7":
                        continue
                    if not room.get("awaiting_rulebreaker"):
                        continue
                    if p1p != p2p:
                        continue
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {
                            "$set": {
                                "series_winner": "DRAW",
                                "awaiting_rulebreaker": False,
                                "game_status": "finished",
                                "status": "finished",
                            }
                        },
                    )
                    done = {
                        "type": "series_resolved",
                        "series_winner": "DRAW",
                        "match_history": hist,
                        "p1_series_points": p1p,
                        "p2_series_points": p2p,
                        "segment_start_index": seg_start,
                        "full_match_draw": True,
                    }
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(done)
                        except:
                            pass
                    continue

                first_player = msg.get("first_player", "P1")
                c3_blocked   = msg.get("c3_blocked", False)

                patch: dict = {}
                bm = room.get("board_mode", "5x5")
                if bm == "7x7":
                    c3_blocked = False

                gn = room.get("game_number", 1)
                next_gn = gn + 1
                gs = 7 if bm == "7x7" else 5

                post_seg = patch.get("segment_start_index", seg_start)
                seg_pts = compute_segment_points(hist, post_seg)
                reset = {
                    **patch,
                    "board":          [[None] * gs for _ in range(gs)],
                    "current_player": first_player,
                    "moves_played":   0,
                    "extra_turns":    0,
                    "winner":         None,
                    "game_status":    "playing",
                    "status":         "active",
                    "p1_ready":       False,
                    "p2_ready":       False,
                    "game_number":    next_gn,
                    "c3_blocked":     c3_blocked,
                    "awaiting_rulebreaker": False,
                    "p1_series_points": seg_pts[0],
                    "p2_series_points": seg_pts[1],
                }

                await db.rooms.update_one({"room_code": room_code}, {"$set": reset})

                merged = {**room, **reset}
                sp_out = merged.get("selected_patterns")
                gr_payload = {
                    "type":         "game_reset",
                    "first_player": first_player,
                    "game_number":  next_gn,
                    "c3_blocked":   c3_blocked,
                    "board_mode":   bm,
                    "segment_start_index": merged.get("segment_start_index", 0),
                    "p1_series_points": seg_pts[0],
                    "p2_series_points": seg_pts[1],
                }
                if sp_out is not None:
                    gr_payload["selected_patterns"] = sp_out

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(gr_payload)
                    except:
                        pass

            elif msg["type"] == "timeout":
                winner = msg.get("winner")
                if winner not in ("P1", "P2"):
                    continue
                room = await db.rooms.find_one({"room_code": room_code})
                if not room or room.get("game_status") != "playing":
                    continue
                if room.get("winner"):
                    continue
                current_history = room.get("match_history", [])
                new_history     = current_history + [winner]
                seg_start       = room.get("segment_start_index", 0)
                gn = room.get("game_number", 1)
                bm = room.get("board_mode", "5x5")

                if should_auto_upgrade_7x7_after_5x5_game3(
                    new_history, seg_start, bm, gn
                ):
                    fb = room.get("board", [])
                    finished = [list(r) for r in fb] if fb else []
                    await _apply_5x5_to_7x7_upgrade(
                        db,
                        room_code,
                        room,
                        new_history,
                        winner,
                        game1_patch={},
                        finished_board=finished,
                        row=None,
                        col=None,
                        moves_played=room.get("moves_played", 0),
                        current_player=room.get("current_player", "P1"),
                        win_line=[],
                        extra_turns=0,
                        connection_scores=None,
                    )
                    continue

                update = {
                    "winner":      winner,
                    "game_status": "finished",
                    "status":      "finished",
                    "match_history": new_history,
                    **compute_series_state(new_history, seg_start),
                }

                await db.rooms.update_one({"room_code": room_code}, {"$set": update})

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json({
                            "type": "move_made",
                            "winner": winner,
                            "board": room.get("board", []),
                            "current_player": room.get("current_player", "P1"),
                            "moves_played": room.get("moves_played", 0),
                            "win_line": [],
                            "game_status": "finished",
                            "extra_turns": 0,
                            "match_history": new_history,
                            "p1_series_points": update["p1_series_points"],
                            "p2_series_points": update["p2_series_points"],
                            "series_winner": update["series_winner"],
                            "awaiting_rulebreaker": update["awaiting_rulebreaker"],
                            "segment_start_index": seg_start,
                        })
                    except:
                        pass

                game_dict = {
                    "player1_id": room["player1_id"],
                    "player2_id": room["player2_id"],
                    "format":     room["format"],
                    "source":     room.get("source", "matchmaking"),
                    "mode":       "multiplayer",
                }
                asyncio.create_task(award_game_result(db, game_dict, winner))

            elif msg["type"] == "ping":
                ts = msg.get("ts")
                await websocket.send_json({"type": "pong", "ts": ts})

    except WebSocketDisconnect:
        current_ws = _room_connections.get(room_code, {}).get(player_slot)
        if current_ws is websocket:
            _room_connections[room_code].pop(player_slot, None)
            if not _room_connections.get(room_code):
                _room_connections.pop(room_code, None)
                _room_runtime.pop(room_code, None)
            else:
                await asyncio.sleep(DISCONNECT_GRACE_SECONDS)
                # Suppress false disconnects if the same player quickly reconnects.
                if _room_connections.get(room_code, {}).get(player_slot) is not None:
                    return
                peers = _room_connections.get(room_code, {})
                if not peers:
                    _room_runtime.pop(room_code, None)
                    return
                for slot, ws in peers.items():
                    try:
                        await ws.send_json({"type": "opponent_disconnected"})
                    except:
                        pass