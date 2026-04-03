from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Header, Depends
from app.core.database import get_db
from app.core.security import decode_token
from app.game.engine import GameEngine
from app.routers.game import award_game_result, award_ranked_match_result
from app.game.ranked_penalties import apply_ranked_quit_penalty, record_ranked_match_completed_clean, user_ranked_allowed
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
_rb_autostart_tasks: dict[str, asyncio.Task] = {}
_lb_phase_tasks: dict[str, asyncio.Task] = {}
_rules_sheet_timeout_tasks: dict[str, asyncio.Task] = {}
RULES_SHEET_TIMEOUT_SECONDS = 60.0
DISCONNECT_GRACE_SECONDS = 3.0


def _reset_rules_gate_runtime(room_code: str) -> None:
    rt = _room_runtime.get(room_code)
    if rt is not None:
        rt["levelup_ready"] = {"P1": False, "P2": False}


def _cancel_rb_autostart(room_code: str) -> None:
    task = _rb_autostart_tasks.pop(room_code, None)
    if task and not task.done():
        task.cancel()


def _cancel_lb_phase_task(room_code: str) -> None:
    task = _lb_phase_tasks.pop(room_code, None)
    if task and not task.done():
        task.cancel()


def _cancel_rules_sheet_timeout(room_code: str) -> None:
    task = _rules_sheet_timeout_tasks.pop(room_code, None)
    if task and not task.done():
        task.cancel()


async def _rules_sheet_timeout_worker(db, room_code: str) -> None:
    """After RULES_SHEET_TIMEOUT_SECONDS, force rules sheet completion (5x5 / 6x6 / 7x7) if gate still active."""
    try:
        await asyncio.sleep(RULES_SHEET_TIMEOUT_SECONDS)
        room = await db.rooms.find_one({"room_code": room_code})
        if not room:
            return
        bm = _effective_board_mode(room)
        gate_5 = bool(room.get("awaiting_5x5_rules_ready")) and bm == "5x5"
        gate_6 = bool(room.get("awaiting_6x6_rules_ready")) and bm == "6x6"
        gate_7 = bool(room.get("awaiting_7x7_rules_ready")) and bm == "7x7"
        if not gate_5 and not gate_6 and not gate_7:
            return
        rt = _room_runtime.get(room_code)
        if rt is not None:
            rt["levelup_ready"] = {"P1": False, "P2": False}
        clear_doc: dict = {}
        if gate_5:
            clear_doc["awaiting_5x5_rules_ready"] = False
        if gate_6:
            clear_doc["awaiting_6x6_rules_ready"] = False
        if gate_7:
            clear_doc["awaiting_7x7_rules_ready"] = False
        await db.rooms.update_one({"room_code": room_code}, {"$set": clear_doc})
        for slot, ws in _room_connections.get(room_code, {}).items():
            try:
                await ws.send_json({"type": "levelup_start"})
            except Exception:
                pass
    except asyncio.CancelledError:
        raise
    finally:
        _rules_sheet_timeout_tasks.pop(room_code, None)


def _schedule_rules_sheet_timeout(db, room_code: str) -> None:
    _cancel_rules_sheet_timeout(room_code)
    _rules_sheet_timeout_tasks[room_code] = asyncio.create_task(
        _rules_sheet_timeout_worker(db, room_code)
    )


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
        "selected_patterns_p1": room.get("selected_patterns_p1"),
        "selected_patterns_p2": room.get("selected_patterns_p2"),
        "current_player": room.get("current_player", "P1"),
        "moves_played":   room.get("moves_played", 0),
        "winner":         room.get("winner"),
        "game_status":    room.get("game_status", "waiting"),
        "game_number":    room.get("game_number", 1),
        "match_history":  room.get("match_history", []),
        "move_log":       room.get("move_log", []),
        "p1_series_points": room.get("p1_series_points", 0),
        "p2_series_points": room.get("p2_series_points", 0),
        "series_winner":  room.get("series_winner"),
        "awaiting_rulebreaker": room.get("awaiting_rulebreaker", False),
        "phase": room.get("phase"),
        "segment_start_index": room.get("segment_start_index", 0),
        "history_display_start_index": room.get("history_display_start_index", 0),
        "awaiting_5x5_rules_ready": room.get("awaiting_5x5_rules_ready", False),
        "awaiting_6x6_rules_ready": room.get("awaiting_6x6_rules_ready", False),
        "awaiting_7x7_rules_ready": room.get("awaiting_7x7_rules_ready", False),
        "board_mode_full": room.get("board_mode_full"),
        "ranked_triple_leg": room.get("ranked_triple_leg", False),
        "p1_legs_won": room.get("p1_legs_won", 0),
        "p2_legs_won": room.get("p2_legs_won", 0),
        "extra_turns": room.get("extra_turns", 0),
        "c3_blocked": room.get("c3_blocked", False),
        "suppress_center_opening": room.get("suppress_center_opening", False),
        "rb_extra_turn_token_holder": room.get("rb_extra_turn_token_holder"),
        "rb_extra_turn_token_used": room.get("rb_extra_turn_token_used", False),
        "rb_hide_banned_from_slot": room.get("rb_hide_banned_from_slot"),
        "rb_patterns_pre_ban": room.get("rb_patterns_pre_ban"),
        "rb_banned_patterns": room.get("rb_banned_patterns", []),
        "rb_banned_pattern":  room.get("rb_banned_pattern"),
        "rb_toss_winner": room.get("rb_toss_winner"),
        "rb_coin_result": room.get("rb_coin_result"),
        "rb_phase_payload": room.get("rb_phase_payload"),
        "rb_summary_started_at_ms": room.get("rb_summary_started_at_ms"),
        "rb_auto_start_due_ms": room.get("rb_auto_start_due_ms"),
        "rb6_special_cell": room.get("rb6_special_cell"),
        "rb6_timer_owner": room.get("rb6_timer_owner"),
        "protocolbreaker_pending": room.get("protocolbreaker_pending", False),
        "pb_toss_winner": room.get("pb_toss_winner"),
        "pb_bans": room.get("pb_bans") or [],
        "protocolbreaker_final": room.get("protocolbreaker_final", False),
        "pb_p1_aggregate": room.get("pb_p1_aggregate"),
        "pb_p2_aggregate": room.get("pb_p2_aggregate"),
        "limitbreaker_pending": room.get("protocolbreaker_pending", False),
        "limitbreaker_final": room.get("protocolbreaker_final", False),
        "lb_phase": room.get("pb_phase"),
        "lb_choice": room.get("pb_choice"),
        "lb_first_player": room.get("pb_first_player"),
        "lb_next_slot": room.get("pb_next_slot"),
        "lb_first_ban_slot": room.get("pb_first_ban_slot"),
        "lb_second_ban_slot": room.get("pb_second_ban_slot"),
        "lb_coin_due_ms": room.get("pb_coin_due_ms"),
    }


def compute_segment_points(history: list, segment_start: int = 0) -> tuple[float, float]:
    """
    Points in match history for first-to-5: win = 1, draw = 0.5 each.
    Handles string winners and rich history objects ({'winner': 'P1'|'P2'|'DRAW'}).
    """
    p1 = 0.0
    p2 = 0.0
    for item in history[segment_start:]:
        w = item["winner"] if isinstance(item, dict) else item
        if w == "P1":
            p1 += 1.0
        elif w == "P2":
            p2 += 1.0
        elif w == "DRAW":
            p1 += 0.5
            p2 += 0.5
    return p1, p2


def compute_series_winner(history: list, start_index: int = 0, target_points: int = 5) -> str | None:
    """
    First-to-5 total points wins instantly (wins + draw halves).
    If all 9 games are played, the player with the most points wins.
    If points are equal at 9 games, returns None (Protocolbreaker).
    """
    _EPS = 1e-9
    p1_pts, p2_pts = compute_segment_points(history, start_index)
    if p1_pts + _EPS >= target_points:
        return "P1"
    if p2_pts + _EPS >= target_points:
        return "P2"

    seg = history[start_index:]
    if len(seg) >= 9:
        if p1_pts > p2_pts + _EPS:
            return "P1"
        if p2_pts > p1_pts + _EPS:
            return "P2"
        return None  # Protocolbreaker tie

    return None


def compute_awaiting_rulebreaker(history: list, segment_start: int) -> bool:
    """
    After each completed *pair* of games in the segment, Rulebreaker is required
    before the next game unless the match has already reached its win condition.
    """
    if segment_start > len(history):
        return False
    seg = history[segment_start:]
    
    # Extract winners for logic
    winners = [item["winner"] if isinstance(item, dict) else item for item in seg]
    
    p1_total, p2_total = compute_segment_points(history)
    # If someone already has 5, no more Rulebreaker
    if p1_total >= 5 or p2_total >= 5:
        return False

    if len(seg) >= 3 and all(w == "DRAW" for w in winners):
        return False
    if len(seg) < 2 or len(seg) % 2 != 0:
        return False
        
    # We always play Rulebreaker after Game 2, Game 4, Game 6... unless the match is over.
    return True


def _starting_board_mode(mode: str) -> str:
    """Extract the first board size from a compound mode (e.g. '5x5_7x7' -> '5x5')."""
    return mode.split("_")[0]


def _effective_board_mode(room: dict) -> str:
    bm = room.get("board_mode", "5x5")
    if bm in ("5x5", "6x6", "7x7"):
        return bm
    return _starting_board_mode(bm)


def should_auto_upgrade_7x7_after_5x5_game3(
    new_history: list,
    segment_start: int,
    board_mode: str,
    game_number: int,
) -> bool:
    """
    After 3 games on 5x5, if the match isn't won, we unconditionally 
    transition to the next board (6x6 or 7x7 depending on flow).
    """
    start_mode = _starting_board_mode(board_mode)
    if start_mode != "5x5" or game_number != 3:
        return False
    # If no one has 5 wins yet (and we played 3/6/9 games), we move to next board
    if compute_series_winner(new_history) is None:
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
        "selected_patterns_p1": list(PATTERN_NAMES_7),
        "selected_patterns_p2": list(PATTERN_NAMES_7),
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
        "awaiting_7x7_rules_ready": True,
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

    await asyncio.sleep(2.0)

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
        "selected_patterns_p1": list(PATTERN_NAMES_7),
        "selected_patterns_p2": list(PATTERN_NAMES_7),
        "c3_blocked": False,
        "from_5x5_level_up": True,
        "from_5x5_draw_upgrade": True,
        "awaiting_7x7_rules_ready": True,
        "preserve_rb_hide": False,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr_payload)
        except:
            pass

    _schedule_rules_sheet_timeout(db, room_code)

    game_dict = {
        "player1_id": room["player1_id"],
        "player2_id": room["player2_id"],
        "format":     room["format"],
        "source":     room.get("source", "matchmaking"),
        "mode":       "multiplayer",
    }
    if not room.get("ranked_triple_leg"):
        asyncio.create_task(award_game_result(db, game_dict, outcome))


def should_auto_upgrade_7x7_after_6x6_game3(
    new_history: list,
    segment_start: int,
    board_mode: str,
    game_number: int,
) -> bool:
    """
    After 3 games on 6x6, if the match isn't won, we unconditionally 
    transition to 7x7.
    """
    if board_mode != "6x6" or game_number != 3:
        return False
    if compute_series_winner(new_history) is None:
        return True
    return False


async def _apply_5x5_to_6x6_upgrade(
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
    rt = _room_runtime.get(room_code)
    if rt is not None:
        rt["levelup_ready"] = {"P1": False, "P2": False}

    patch = dict(game1_patch or {})
    g1f = room.get("game1_first_player") or "P1"
    first_6 = "P2" if g1f == "P1" else "P1"
    seg_new = len(new_history)
    ss = compute_series_state(new_history, seg_new)
    hist_display_start = len(new_history)

    upgrade_update = {
        **patch,
        "board": [[None] * 6 for _ in range(6)],
        "board_mode": "6x6",
        "selected_patterns": None,
        "selected_patterns_p1": None,
        "selected_patterns_p2": None,
        "current_player": first_6,
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
        "awaiting_5x5_rules_ready": False,
        "awaiting_6x6_rules_ready": True,
        "awaiting_7x7_rules_ready": False,
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
        "auto_6x6_upgrade_follows": True,
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

    await asyncio.sleep(2.0)

    gr_payload = {
        "type": "game_reset",
        "first_player": first_6,
        "game_number": 1,
        "board_mode": "6x6",
        "segment_start_index": seg_new,
        "history_display_start_index": hist_display_start,
        "p1_series_points": ss["p1_series_points"],
        "p2_series_points": ss["p2_series_points"],
        "c3_blocked": False,
        "from_5x5_level_up": True,
        "awaiting_6x6_rules_ready": True,
        "preserve_rb_hide": False,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr_payload)
        except:
            pass

    _schedule_rules_sheet_timeout(db, room_code)


async def _apply_6x6_to_7x7_upgrade(
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
    seg_new = len(new_history)
    ss = compute_series_state(new_history, seg_new)
    hist_display_start = len(new_history)

    upgrade_update = {
        **patch,
        "board": [[None] * 7 for _ in range(7)],
        "board_mode": "7x7",
        "selected_patterns": list(PATTERN_NAMES_7),
        "selected_patterns_p1": list(PATTERN_NAMES_7),
        "selected_patterns_p2": list(PATTERN_NAMES_7),
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
        "suppress_center_opening": False,
        "awaiting_rulebreaker": False,
        "awaiting_6x6_rules_ready": False,
        "awaiting_7x7_rules_ready": True,
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

    await asyncio.sleep(2.0)

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
        "selected_patterns_p1": list(PATTERN_NAMES_7),
        "selected_patterns_p2": list(PATTERN_NAMES_7),
        "c3_blocked": False,
        "from_6x6_level_up": True,
        "awaiting_7x7_rules_ready": True,
        "preserve_rb_hide": False,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr_payload)
        except:
            pass

    _schedule_rules_sheet_timeout(db, room_code)


async def _award_match_series_and_notify(
    db,
    room_code: str,
    room: dict,
    update: dict,
    match_winner: str,
    *,
    record_clean_streak: bool = True,
    surrendered_by: str | None = None,
):
    """General match series outcome (First-to-5) for Ranked, Unranked, and Custom."""
    hist = list(update.get("match_history") or room.get("match_history") or [])
    room_fresh = await db.rooms.find_one({"room_code": room_code}) or room
    pb_played = bool(room_fresh.get("protocolbreaker_final"))

    if room_fresh.get("protocolbreaker_pending"):
        return

    effective = match_winner
    if room_fresh.get("protocolbreaker_final"):
        if effective not in ("P1", "P2", "DRAW"):
            return
        await db.rooms.update_one(
            {"room_code": room_code},
            {"$unset": {"protocolbreaker_final": ""}},
        )
    else:
        agg = compute_series_winner(hist, 0, 5)
        if agg is not None:
            effective = agg
        else:
            # Check if Protocolbreaker should trigger (Score tied at end of 9 rounds)
            if len(hist) >= 9:
                 p1p, p2p = compute_segment_points(hist)
                 if p1p == p2p:
                     await _broadcast_protocolbreaker_tie(db, room_code, room, hist)
                     return
            effective = match_winner # Fallback

    game_dict = {
        "player1_id": room["player1_id"],
        "player2_id": room["player2_id"],
        "format": room["format"],
        "source": room.get("source", "matchmaking"),
        "mode": "multiplayer",
        "board_mode": room.get("board_mode"),
        "match_rounds": hist,
        "board_mode_full": room.get("board_mode_full"),
        "protocolbreaker_played": pb_played,
    }
    
    p1_id, p2_id = room.get("player1_id"), room.get("player2_id")
    u1 = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    u2 = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None
    
    # Snapshot ELO for UI report
    elo1_before = u1.get("elo", 500) if u1 else 500
    elo2_before = u2.get("elo", 500) if u2 else 500
    rr1_before = int(u1.get("ranked_rating", elo1_before)) if u1 else elo1_before
    rr2_before = int(u2.get("ranked_rating", elo2_before)) if u2 else elo2_before

    career_ids = await award_ranked_match_result(
        db, game_dict, effective, record_clean_streak=record_clean_streak, surrendered_by=surrendered_by
    )

    u1a = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    u2a = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None
    
    payload = {
        "type": "match_series_complete",
        "series_winner": effective,
        "format": room["format"],
        "p1": {
            "name": u1.get("username", "P1") if u1 else "P1",
            "elo_before": elo1_before,
            "elo_after": u1a.get("elo", elo1_before) if u1a else elo1_before,
            "rr_before": rr1_before,
            "rr_after": int(u1a.get("ranked_rating", rr1_before)) if u1a else rr1_before,
            "xp_before": u1.get("xp", 0) if u1 else 0,
            "xp_after": u1a.get("xp", 0) if u1a else 0,
        },
        "p2": {
            "name": u2.get("username", "P2") if u2 else "P2",
            "elo_before": elo2_before,
            "elo_after": u2a.get("elo", elo2_before) if u2a else elo2_before,
            "rr_before": rr2_before,
            "rr_after": int(u2a.get("ranked_rating", rr2_before)) if u2a else rr2_before,
            "xp_before": u2.get("xp", 0) if u2 else 0,
            "xp_after": u2a.get("xp", 0) if u2a else 0,
        },
        "p1_career_entry_id": (career_ids or {}).get("p1_career_entry_id"),
        "p2_career_entry_id": (career_ids or {}).get("p2_career_entry_id"),
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except:
            pass


# Ranked triple-leg reuses the same series award + notify implementation.
_award_ranked_triple_and_notify = _award_match_series_and_notify


def _aggregate_decisive_games(history: list) -> tuple[int, int]:
    """Count P1 vs P2 wins across the full match_history (DRAW ignored)."""
    p1 = sum(1 for w in history if w == "P1")
    p2 = sum(1 for w in history if w == "P2")
    return p1, p2


def _aggregate_match_winner(history: list) -> str | None:
    """
    Uses the match-wide point system. 
    Returns P1/P2 if they hit 5 wins or have majority after 9.
    None if Protocolbreaker is needed.
    """
    return compute_series_winner(history)


async def _start_protocolbreaker_final_game(
    db,
    room_code: str,
    room: dict,
    banned: list[str],
    first_player: str,
) -> None:
    """After Limitbreaker choices resolve, play the decisive surviving-board game."""
    from app.core.patterns7 import PATTERN_NAMES_7

    ALL = ["5x5", "6x6", "7x7"]
    remaining = [m for m in ALL if m not in banned]
    if len(remaining) != 1:
        return
    mode = remaining[0]
    sp = sp1 = sp2 = None
    if mode == "7x7":
        sp = list(PATTERN_NAMES_7)
        sp1 = list(PATTERN_NAMES_7)
        sp2 = list(PATTERN_NAMES_7)
    engine = GameEngine(
        board_mode=mode,
        selected_pattern_ids=sp,
        selected_pattern_ids_p1=sp1 if mode == "7x7" else None,
        selected_pattern_ids_p2=sp2 if mode == "7x7" else None,
    )
    first = first_player if first_player in ("P1", "P2") else "P1"
    gn = len(room.get("match_history") or []) + 1
    seg_new = room.get("segment_start_index", 0)
    p1p, p2p = compute_segment_points(room.get("match_history", []), seg_new)
    patch = {
        "board": engine.board,
        "board_mode": mode,
        "current_player": first,
        "moves_played": 0,
        "extra_turns": 0,
        "winner": None,
        "game_status": "playing",
        "status": "active",
        "game_number": gn,
        "segment_start_index": seg_new,
        "p1_series_points": p1p,
        "p2_series_points": p2p,
        "series_winner": None,
        "awaiting_rulebreaker": False,
        "protocolbreaker_pending": False,
        "protocolbreaker_final": True,
        "pb_bans": banned,
        "pb_phase": None,
        "pb_choice": None,
        "pb_first_player": first,
        "pb_next_slot": None,
        "pb_first_ban_slot": None,
        "pb_second_ban_slot": None,
        "pb_coin_due_ms": None,
        "awaiting_5x5_rules_ready": False,
        "awaiting_6x6_rules_ready": False,
        "awaiting_7x7_rules_ready": False,
        "selected_patterns": sp,
        "selected_patterns_p1": sp1,
        "selected_patterns_p2": sp2,
        "c3_blocked": False,
        "suppress_center_opening": False,
        "rb_extra_turn_token_holder": None,
        "rb_extra_turn_token_used": False,
        "rb_hide_banned_from_slot": None,
        "rb_patterns_pre_ban": None,
        "rb_banned_pattern": None,
    }
    await db.rooms.update_one(
        {"room_code": room_code},
        {"$set": patch, "$unset": {"pb_toss_winner": ""}},
    )
    gr = {
        "type": "game_reset",
        "first_player": first,
        "game_number": gn,
        "board_mode": mode,
        "segment_start_index": seg_new,
        "history_display_start_index": room.get("history_display_start_index", 0),
        "p1_series_points": p1p,
        "p2_series_points": p2p,
        "protocolbreaker_final": True,
        "limitbreaker_final": True,
        "pb_bans": banned,
        "c3_blocked": False,
        "preserve_rb_hide": False,
    }
    if mode == "7x7" and sp is not None:
        gr["selected_patterns"] = sp
        gr["selected_patterns_p1"] = sp1
        gr["selected_patterns_p2"] = sp2
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr)
        except Exception:
            pass


async def _broadcast_protocolbreaker_tie(
    db,
    room_code: str,
    room: dict,
    history: list,
) -> None:
    """Aggregate tie on triple-leg ranked — start Limitbreaker."""
    tw = random.choice(["P1", "P2"])
    p1a, p2a = _aggregate_decisive_games(history)
    due_ms = int(datetime.utcnow().timestamp() * 1000) + 3500
    await db.rooms.update_one(
        {"room_code": room_code},
        {
            "$set": {
                "protocolbreaker_pending": True,
                "pb_toss_winner": tw,
                "pb_bans": [],
                "pb_p1_aggregate": p1a,
                "pb_p2_aggregate": p2a,
                "pb_phase": "coin",
                "pb_choice": None,
                "pb_first_player": None,
                "pb_next_slot": tw,
                "pb_first_ban_slot": None,
                "pb_second_ban_slot": None,
                "pb_coin_due_ms": due_ms,
            }
        },
    )
    payload = {
        "type": "limitbreaker_start",
        "toss_winner": tw,
        "p1_aggregate": p1a,
        "p2_aggregate": p2a,
        "match_history_snapshot": history,
        "phase": "coin",
        "next_slot": tw,
        "coin_due_ms": due_ms,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except Exception:
            pass
    _cancel_lb_phase_task(room_code)
    _lb_phase_tasks[room_code] = asyncio.create_task(
        _advance_limitbreaker_coin(db, room_code, due_ms)
    )


async def _broadcast_limitbreaker_update(room_code: str, room: dict) -> None:
    payload = {
        "type": "limitbreaker_update",
        "phase": room.get("pb_phase"),
        "toss_winner": room.get("pb_toss_winner"),
        "p1_aggregate": room.get("pb_p1_aggregate", 0),
        "p2_aggregate": room.get("pb_p2_aggregate", 0),
        "bans": room.get("pb_bans") or [],
        "choice": room.get("pb_choice"),
        "first_player": room.get("pb_first_player"),
        "next_slot": room.get("pb_next_slot"),
        "first_ban_slot": room.get("pb_first_ban_slot"),
        "second_ban_slot": room.get("pb_second_ban_slot"),
        "coin_due_ms": room.get("pb_coin_due_ms"),
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except Exception:
            pass


async def _advance_limitbreaker_coin(db, room_code: str, due_ms: int) -> None:
    try:
        wait_ms = max(0, due_ms - int(datetime.utcnow().timestamp() * 1000))
        if wait_ms > 0:
            await asyncio.sleep(wait_ms / 1000)
        room = await db.rooms.find_one({"room_code": room_code})
        if not room or not room.get("protocolbreaker_pending"):
            return
        if room.get("pb_phase") != "coin":
            return
        await db.rooms.update_one(
            {"room_code": room_code},
            {
                "$set": {
                    "pb_phase": "choice",
                    "pb_next_slot": room.get("pb_toss_winner"),
                    "pb_coin_due_ms": None,
                }
            },
        )
        room = await db.rooms.find_one({"room_code": room_code})
        if room:
            await _broadcast_limitbreaker_update(room_code, room)
    except asyncio.CancelledError:
        raise
    finally:
        _lb_phase_tasks.pop(room_code, None)


def compute_series_state(history: list, segment_start: int = 0) -> dict:
    p1_pts, p2_pts = compute_segment_points(history)
    series_winner = compute_series_winner(history, segment_start, 5)
    
    awaiting_rulebreaker = False
    breaker_type = None
    
    if not series_winner:
        lh = len(history)
        if lh == 2:
            awaiting_rulebreaker = True
            breaker_type = "RULEBREAKER"
        elif lh == 5:
            awaiting_rulebreaker = True
            breaker_type = "TIMEBREAKER"
        elif lh == 8:
            awaiting_rulebreaker = True
            breaker_type = "MINDBREAKER"
        elif lh == 9:
            # Game 9 ended, still no winner -> Limitbreaker
            awaiting_rulebreaker = True
            breaker_type = "LIMITBREAKER"

    return {
        "p1_series_points": p1_pts,
        "p2_series_points": p2_pts,
        "series_winner": series_winner,
        "awaiting_rulebreaker": awaiting_rulebreaker,
        "breaker_type": breaker_type,
    }

async def _broadcast_rulebreaker_start(db, room_code: str, room: dict, history: list):
    """Transition to Rulebreaker splash screen & start coin toss/pattern selection."""
    p1a, p2a = _aggregate_decisive_games(history)
    lh = len(history)
    bm = _effective_board_mode(room)
    
    # Randomly pick toss winner for the rulebreaker
    tw = random.choice(["P1", "P2"])
    
    # Update room state for rulebreaker phase
    update = {
        "phase": "rb_splash",
        "awaiting_rulebreaker": False, # Reset now that we started it
        "rb_toss_winner": tw,
        "rb_coin_result": None,
        "rb_phase_payload": {},
        "rb_summary_started_at_ms": None,
        "rb_auto_start_due_ms": None,
        "p1_ready": False,
        "p2_ready": False,
    }
    
    # For 6x6 (Game 6) -> TIMEBREAKER
    # For 5x5 (Game 3) -> RULEBREAKER
    # For 7x7 (Game 9) -> MINDBREAKER
    
    await db.rooms.update_one({"room_code": room_code}, {"$set": update})
    
    payload = {
        "type": "rulebreaker_start",
        "toss_winner": tw,
        "lh": lh,
        "board_mode": bm,
        "p1_aggregate": p1a,
        "p2_aggregate": p2a,
    }
    
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except:
            pass


async def _finalize_rulebreaker_start(
    db,
    room_code: str,
    room: dict,
    msg: dict,
) -> None:
    hist = room.get("match_history", [])
    seg_start = room.get("segment_start_index", 0)
    p1p, p2p = compute_segment_points(hist, seg_start)

    if bool(msg.get("resolve_series_only")):
        if not room.get("awaiting_rulebreaker"):
            return
        leader = compute_series_winner(hist, seg_start, 5)
        if leader is None:
            return
        await db.rooms.update_one(
            {"room_code": room_code},
            {
                "$set": {
                    "series_winner": leader,
                    "awaiting_rulebreaker": False,
                    "game_status": "finished",
                    "status": "finished",
                    "phase": None,
                    "rb_phase_payload": None,
                    "rb_summary_started_at_ms": None,
                    "rb_auto_start_due_ms": None,
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
        room_fresh = await db.rooms.find_one({"room_code": room_code}) or room
        asyncio.create_task(
            _award_match_series_and_notify(
                db, room_code, room_fresh, {"match_history": list(hist)}, str(leader)
            )
        )
        return

    if bool(msg.get("resolve_series_draw")):
        if room.get("board_mode", "5x5") != "7x7":
            return
        if not room.get("awaiting_rulebreaker"):
            return
        if p1p != p2p:
            return
        await db.rooms.update_one(
            {"room_code": room_code},
            {
                "$set": {
                    "series_winner": "DRAW",
                    "awaiting_rulebreaker": False,
                    "game_status": "finished",
                    "status": "finished",
                    "phase": None,
                    "rb_phase_payload": None,
                    "rb_summary_started_at_ms": None,
                    "rb_auto_start_due_ms": None,
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
        room_fresh = await db.rooms.find_one({"room_code": room_code}) or room
        asyncio.create_task(
            _award_match_series_and_notify(
                db, room_code, room_fresh, {"match_history": list(hist)}, "DRAW"
            )
        )
        return

    # `first_player` should be authoritative, but tolerate incomplete messages by
    # falling back to earlier stored selections.
    first_player = msg.get("first_player")
    if first_player not in ("P1", "P2"):
        rb_phase_payload = room.get("rb_phase_payload")
        if isinstance(rb_phase_payload, dict):
            fp = rb_phase_payload.get("firstPlayerChosen")
            if fp in ("P1", "P2"):
                first_player = fp
        if first_player not in ("P1", "P2"):
            toss_winner = room.get("rb_toss_winner")
            first_player = toss_winner if toss_winner in ("P1", "P2") else "P1"
    c3_blocked = msg.get("c3_blocked", False)
    bm = room.get("board_mode", "5x5")
    sel_patterns = msg.get("selected_patterns")
    sel_patterns_p1 = msg.get("selected_patterns_p1")
    sel_patterns_p2 = msg.get("selected_patterns_p2")
    if not isinstance(sel_patterns_p1, list):
        sel_patterns_p1 = None
    if not isinstance(sel_patterns_p2, list):
        sel_patterns_p2 = None
    suppress_center = bool(msg.get("suppress_center_opening", False))
    token_holder = msg.get("rb_extra_turn_token_holder")
    if token_holder not in ("P1", "P2"):
        token_holder = None

    hide_slot = msg.get("rb_hide_banned_from_slot")
    if hide_slot not in ("P1", "P2"):
        hide_slot = None
    pre_ban = msg.get("rb_patterns_pre_ban")
    if not isinstance(pre_ban, list):
        pre_ban = None
    banned_pats = msg.get("rb_banned_patterns")
    if not isinstance(banned_pats, list):
        banned_pats = []
    banned_pat = msg.get("rb_banned_pattern")
    if not isinstance(banned_pat, str) or not banned_pat.strip():
        banned_pat = None
    if banned_pat and banned_pat not in banned_pats:
        banned_pats.append(banned_pat)

    def _valid_rb6_cell(d) -> bool:
        if not isinstance(d, dict):
            return False
        owner = d.get("owner")
        row = d.get("r")
        col = d.get("c")
        return owner in ("P1", "P2") and isinstance(row, int) and isinstance(col, int)

    msg_cell = msg.get("rb6_special_cell")
    room_cell = room.get("rb6_special_cell")
    if bm == "6x6":
        rb6_cell_resolved = (
            msg_cell if _valid_rb6_cell(msg_cell) else (room_cell if _valid_rb6_cell(room_cell) else None)
        )
    else:
        rb6_cell_resolved = None

    msg_to = msg.get("rb6TimerOwner")
    room_to = room.get("rb6_timer_owner")
    if bm == "6x6":
        rb6_to_resolved = (
            msg_to
            if msg_to in ("P1", "P2")
            else (room_to if room_to in ("P1", "P2") else None)
        )
    else:
        rb6_to_resolved = None

    gn = room.get("game_number", 1)
    next_gn = gn + 1
    gs = 7 if bm == "7x7" else 5

    seg_pts = compute_segment_points(hist, seg_start)
    gs = 5
    if bm == "7x7":
        gs = 7
    elif bm == "6x6":
        gs = 6
    reset = {
        "board": [[None] * gs for _ in range(gs)],
        "current_player": first_player,
        "moves_played": 0,
        "extra_turns": 0,
        "winner": None,
        "game_status": "playing",
        "status": "active",
        "p1_ready": False,
        "p2_ready": False,
        "game_number": next_gn,
        "c3_blocked": c3_blocked,
        "awaiting_rulebreaker": False,
        "p1_series_points": seg_pts[0],
        "p2_series_points": seg_pts[1],
        "phase": None,
        "rb_phase_payload": None,
        "rb_summary_started_at_ms": None,
        "rb_auto_start_due_ms": None,
        "suppress_center_opening": True if (bm == "7x7" and next_gn == 3) else (suppress_center if bm == "7x7" else False),
        "rb_extra_turn_token_holder": token_holder if bm == "7x7" else None,
        "rb_extra_turn_token_used": False,
        "rb6_special_cell": rb6_cell_resolved,
        "rb6_timer_owner": rb6_to_resolved,
    }
    if bm == "7x7" and isinstance(sel_patterns, list) and len(sel_patterns) > 0:
        reset["selected_patterns"] = sel_patterns
    if bm == "7x7":
        reset["rb_hide_banned_from_slot"] = hide_slot
        reset["rb_patterns_pre_ban"] = pre_ban
        reset["rb_banned_patterns"] = banned_pats
        reset["rb_banned_pattern"] = None
        if (
            sel_patterns_p1 is not None
            and sel_patterns_p2 is not None
            and len(sel_patterns_p1) > 0
            and len(sel_patterns_p2) > 0
        ):
            reset["selected_patterns_p1"] = sel_patterns_p1
            reset["selected_patterns_p2"] = sel_patterns_p2
        else:
            reset["selected_patterns_p1"] = None
            reset["selected_patterns_p2"] = None
    else:
        reset["rb_hide_banned_from_slot"] = None
        reset["rb_patterns_pre_ban"] = None
        reset["rb_banned_patterns"] = []
        reset["rb_banned_pattern"] = None
        reset["selected_patterns_p1"] = None
        reset["selected_patterns_p2"] = None

    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})

    merged = {**room, **reset}
    sp_out = merged.get("selected_patterns")
    gr_payload = {
        "type": "game_reset",
        "first_player": first_player,
        "game_number": next_gn,
        "c3_blocked": c3_blocked,
        "board_mode": bm,
        "segment_start_index": merged.get("segment_start_index", 0),
        "p1_series_points": seg_pts[0],
        "p2_series_points": seg_pts[1],
        "suppress_center_opening": reset["suppress_center_opening"],
        "rb_extra_turn_token_holder": reset["rb_extra_turn_token_holder"],
        "rb_extra_turn_token_used": False,
        "rb6_special_cell": reset.get("rb6_special_cell"),
        "rb6_timer_owner": reset.get("rb6_timer_owner"),
    }
    if sp_out is not None:
        gr_payload["selected_patterns"] = sp_out
    if (
        bm == "7x7"
        and merged.get("selected_patterns_p1") is not None
        and merged.get("selected_patterns_p2") is not None
    ):
        gr_payload["selected_patterns_p1"] = merged.get("selected_patterns_p1")
        gr_payload["selected_patterns_p2"] = merged.get("selected_patterns_p2")
    preserve_hide = bool(
        bm == "7x7"
        and hide_slot
        and isinstance(pre_ban, list)
        and len(pre_ban) > 0
    )
    gr_payload["preserve_rb_hide"] = preserve_hide
    if preserve_hide or (bm == "7x7" and (banned_pats or banned_pat)):
        gr_payload["rb_hide_banned_from_slot"] = reset.get("rb_hide_banned_from_slot")
        gr_payload["rb_patterns_pre_ban"] = reset.get("rb_patterns_pre_ban")
        gr_payload["rb_banned_patterns"] = reset.get("rb_banned_patterns", [])
        gr_payload["rb_banned_pattern"] = reset.get("rb_banned_pattern")

    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(gr_payload)
        except:
            pass


async def _auto_finalize_rulebreaker_toss(db, room_code: str, due_ms: int) -> None:
    try:
        wait_ms = max(0, due_ms - int(datetime.utcnow().timestamp() * 1000))
        if wait_ms > 0:
            await asyncio.sleep(wait_ms / 1000)
        room = await db.rooms.find_one({"room_code": room_code})
        if not room:
            return
        if room.get("phase") != "toss_summary" or room.get("game_status") != "finished":
            return
        payload = room.get("rb_phase_payload") or {}
        if not isinstance(payload, dict):
            payload = {}
        hist = room.get("match_history", [])
        seg_start = room.get("segment_start_index", 0)
        p1p, p2p = compute_segment_points(hist, seg_start)
        series_already_decided = (p1p >= 5 and p1p > p2p) or (p2p >= 5 and p2p > p1p)
        auto_msg = {
            "resolve_series_only": series_already_decided,
            "resolve_series_draw": room.get("board_mode", "5x5") == "7x7" and p1p == p2p and not series_already_decided,
            "first_player": payload.get("firstPlayerChosen") or room.get("rb_toss_winner") or "P1",
            "c3_blocked": bool(payload.get("rbC3Blocked", False)),
            "selected_patterns": room.get("selected_patterns"),
            "selected_patterns_p1": room.get("selected_patterns_p1"),
            "selected_patterns_p2": room.get("selected_patterns_p2"),
            "suppress_center_opening": bool(payload.get("winnerPickedRule") == "extra_turn"),
            "rb_extra_turn_token_holder": room.get("rb_toss_winner") if payload.get("winnerPickedRule") == "extra_turn" else None,
            "rb_hide_banned_from_slot": payload.get("rbHideBannedPatternFromSlot") or room.get("rb_hide_banned_from_slot"),
            "rb_patterns_pre_ban": payload.get("rbPatternsPreBan") or room.get("rb_patterns_pre_ban"),
            "rb_banned_patterns": payload.get("rb_banned_patterns") or room.get("rb_banned_patterns") or [],
        }
        await _finalize_rulebreaker_start(db, room_code, room, auto_msg)
    except asyncio.CancelledError:
        raise
    finally:
        _rb_autostart_tasks.pop(room_code, None)

class JoinRoomRequest(BaseModel):
    room_code: str

class QueueRequest(BaseModel):
    format: str = "unranked"
    board_mode: str = "5x5_6x6_7x7"
    selected_patterns: Optional[list[str]] = None

class CreateRoomRequest(BaseModel):
    format: str = "unranked"
    board_mode: str = "5x5_6x6_7x7"
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

RANKED_TRIPLE_BOARD_MODE = "5x5_6x6_7x7"
# Ranked matchmaking: only pair players within this Elo window (inclusive).
RANKED_ELO_MATCH_RANGE = 500


def _is_ranked_triple_leg_room(room: dict) -> bool:
    return room.get("format") == "ranked" and (
        room.get("ranked_triple_leg") is True or room.get("board_mode_full") == RANKED_TRIPLE_BOARD_MODE
    )


def _series_g1_had_any_move(room: dict | None) -> bool:
    """
    True after any stone was played in game 1 (first 5×5 game of the match).
    Void abort (no career) only applies when this is False — surrendering later
    in G2+ or on 6×6/7×7 without moves still counts as surrender if G1 had moves.
    """
    if not room:
        return False
    if room.get("series_g1_move_played"):
        return True
    mh = room.get("match_history") or []
    if len(mh) > 0:
        return True
    gn = int(room.get("game_number") or 1)
    if gn > 1:
        return True
    return int(room.get("moves_played") or 0) > 0


@router.post("/queue/join")
async def queue_join(data: QueueRequest, user_id: str = Depends(get_current_user)):
    db  = get_db()
    fmt = data.format

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    if fmt == "ranked":
        ok, reason = user_ranked_allowed(user)
        if not ok:
            raise HTTPException(403, reason or "Ranked queue unavailable")
    player_name = user.get("username", "Player")

    # ── Clean up stale waiting rooms for this user before doing anything ──
    await _cleanup_stale_rooms(db, user_id)

    # Remove any existing queue entry for this user (idempotent re-queue)
    await db.matchmaking_queue.delete_many({"user_id": user_id, "format": fmt})

    user_elo = int(user.get("elo", 500))

    # Try to find an opponent already waiting (MongoDB-persisted queue)
    # MUST match on board_mode to ensure queue isolation!
    # Ranked: also require Elo within ±RANKED_ELO_MATCH_RANGE (queue rows store "elo").
    queue_query: dict = {"format": fmt, "board_mode": data.board_mode, "user_id": {"$ne": user_id}}
    if fmt == "ranked":
        queue_query["elo"] = {
            "$gte": user_elo - RANKED_ELO_MATCH_RANGE,
            "$lte": user_elo + RANKED_ELO_MATCH_RANGE,
        }
    opponent_entry = await db.matchmaking_queue.find_one_and_delete(queue_query)

    if opponent_entry:
        opponent_id = opponent_entry["user_id"]
        room_code   = opponent_entry["room_code"]

        # Verify the waiting room still exists
        waiting_room = await db.rooms.find_one({"room_code": room_code, "status": "waiting"})
        if not waiting_room:
            # Opponent's room disappeared — fall through to create a new one
            opponent_entry = None
        else:
            p1_elo_room = int(waiting_room.get("player1_elo", 500))
            if fmt == "ranked" and abs(p1_elo_room - user_elo) > RANKED_ELO_MATCH_RANGE:
                # Legacy or inconsistent row — put opponent back in queue and keep searching
                await db.matchmaking_queue.insert_one({
                    "user_id": opponent_id,
                    "room_code": room_code,
                    "format": fmt,
                    "board_mode": opponent_entry.get("board_mode", data.board_mode),
                    "elo": p1_elo_room,
                    "created_at": datetime.utcnow(),
                })
                opponent_entry = None
            else:
                _ = await db.users.find_one({"_id": ObjectId(opponent_id)})
                bm = waiting_room.get("board_mode", "5x5")
                match_update = {
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
                    "awaiting_5x5_rules_ready": _starting_board_mode(bm) == "5x5",
                    "awaiting_7x7_rules_ready": False,
                }
                # Atomic match: only if room is still waiting, P1 unchanged, no P2 yet.
                # If the opponent cancelled (or deleted the room) between queue steal and here, matched_count is 0 — re-queue this joiner.
                match_filter = {
                    "room_code": room_code,
                    "status": "waiting",
                    "player1_id": opponent_id,
                    "$or": [{"player2_id": None}, {"player2_id": {"$exists": False}}],
                }
                result = await db.rooms.update_one(match_filter, {"$set": match_update})
                if result.matched_count == 0:
                    opponent_entry = None
                else:
                    _reset_rules_gate_runtime(room_code)
                    room = await db.rooms.find_one({"room_code": room_code})
                    if match_update.get("awaiting_5x5_rules_ready"):
                        _schedule_rules_sheet_timeout(db, room_code)

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

    # For compound multiplayer, randomize patterns if not provided (if starting on 7x7)
    full_board_mode = data.board_mode or "5x5"
    start_mode = _starting_board_mode(full_board_mode)
    selected_patterns = data.selected_patterns
    if start_mode == "7x7" and not selected_patterns:
        from app.core.patterns7 import PATTERN_NAMES_7
        selected_patterns = list(PATTERN_NAMES_7)

    # Initialize Engine with STARTING board size (e.g. 5x5 for 5x5_7x7)
    engine = GameEngine(board_mode=start_mode, selected_pattern_ids=selected_patterns)
    room = {
        "room_code":      code,
        "status":         "waiting",
        "format":         fmt,
        "board_mode":     full_board_mode,
        "selected_patterns": selected_patterns,
        **(
            {
                "selected_patterns_p1": selected_patterns,
                "selected_patterns_p2": selected_patterns,
            }
            if start_mode == "7x7"
            else {}
        ),
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
        "move_log":       [],
        "series_winner":  None,
        "p1_series_points": 0,
        "p2_series_points": 0,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
        "awaiting_5x5_rules_ready": False,
        "awaiting_6x6_rules_ready": False,
        "awaiting_7x7_rules_ready": False,
        "board_mode_full": full_board_mode,
        "ranked_triple_leg": fmt == "ranked" and full_board_mode == RANKED_TRIPLE_BOARD_MODE,
        "p1_legs_won": 0,
        "p2_legs_won": 0,
        "series_g1_move_played": False,
        "created_at":     datetime.utcnow(),
    }
    await db.rooms.insert_one(room)

    # Persist queue entry in MongoDB with TTL (ensure TTL index exists — see main.py startup)
    qrow = {
        "user_id":    user_id,
        "room_code":  code,
        "format":     fmt,
        "board_mode": full_board_mode,
        "created_at": datetime.utcnow(),
    }
    if fmt == "ranked":
        qrow["elo"] = user_elo
    await db.matchmaking_queue.insert_one(qrow)

    return {"matched": False, "room_code": code, "player_slot": "P1", "room": serialize_room(room)}


@router.post("/queue/leave")
async def queue_leave(data: QueueRequest, user_id: str = Depends(get_current_user)):
    """
    Leave matchmaking. Always clears ALL queue rows for this user+format (every board_mode).

    Also deletes solo matchmaking waiting rooms owned by this user. That covers the race where
    another player already consumed this user's queue row (find_one_and_delete) before leave ran,
    so find_one would have matched nothing and the waiting room would otherwise stay behind.
    """
    db  = get_db()
    fmt = data.format
    await db.matchmaking_queue.delete_many({"user_id": user_id, "format": fmt})
    await db.rooms.delete_many(
        {
            "player1_id": user_id,
            "format": fmt,
            "status": "waiting",
            "source": "matchmaking",
            "$or": [{"player2_id": None}, {"player2_id": {"$exists": False}}],
        }
    )
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

    full_board_mode = data.board_mode or "5x5"
    start_mode = _starting_board_mode(full_board_mode)
    selected_patterns = data.selected_patterns
    if start_mode == "7x7" and not selected_patterns:
        from app.core.patterns7 import PATTERN_NAMES_7
        selected_patterns = list(PATTERN_NAMES_7)

    engine = GameEngine(board_mode=start_mode, selected_pattern_ids=selected_patterns)
    creator_slot = random.choice(["P1", "P2"])
    room = {
        "room_code":       code,
        "status":          "waiting",
        "format":          data.format,
        "board_mode":      full_board_mode,
        "selected_patterns": selected_patterns,
        **(
            {
                "selected_patterns_p1": selected_patterns,
                "selected_patterns_p2": selected_patterns,
            }
            if start_mode == "7x7"
            else {}
        ),
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
        "move_log":        [],
        "series_winner":   None,
        "p1_series_points": 0,
        "p2_series_points": 0,
        "awaiting_rulebreaker": False,
        "segment_start_index": 0,
        "history_display_start_index": 0,
        "awaiting_5x5_rules_ready": False,
        "awaiting_6x6_rules_ready": False,
        "awaiting_7x7_rules_ready": False,
        "board_mode_full": full_board_mode,
        "ranked_triple_leg": data.format == "ranked" and full_board_mode == RANKED_TRIPLE_BOARD_MODE,
        "p1_legs_won": 0,
        "p2_legs_won": 0,
        "series_g1_move_played": False,
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

    bm_join = any_room.get("board_mode", "5x5")
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
        "awaiting_5x5_rules_ready": _starting_board_mode(bm_join) == "5x5",
        "awaiting_7x7_rules_ready": False,
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
    _reset_rules_gate_runtime(code)
    room = await db.rooms.find_one({"room_code": code})
    if update_fields.get("awaiting_5x5_rules_ready"):
        _schedule_rules_sheet_timeout(db, code)

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
            bm0 = _effective_board_mode(room)
            need_sync = (
                (room.get("awaiting_5x5_rules_ready") and bm0 == "5x5")
                or (room.get("awaiting_6x6_rules_ready") and bm0 == "6x6")
                or (room.get("awaiting_7x7_rules_ready") and bm0 == "7x7")
            )
            if need_sync:
                rt = _room_runtime.get(room_code) or {}
                lu = rt.get("levelup_ready") or {"P1": False, "P2": False}
                await websocket.send_json(
                    {
                        "type": "levelup_sync",
                        "p1_ready": bool(lu.get("P1")),
                        "p2_ready": bool(lu.get("P2")),
                    }
                )

        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)

            if msg["type"] == "move":
                row = msg["row"]
                col = msg["col"]

                room = await db.rooms.find_one({"room_code": room_code})
                if not room or room["game_status"] != "playing":
                    continue

                bm0 = room.get("board_mode", "5x5")
                if (
                    (room.get("awaiting_5x5_rules_ready") and bm0 == "5x5")
                    or (room.get("awaiting_6x6_rules_ready") and bm0 == "6x6")
                    or (room.get("awaiting_7x7_rules_ready") and bm0 == "7x7")
                ):
                    await websocket.send_json(
                        {"type": "error", "message": "Confirm rules screen first"}
                    )
                    continue

                if player_slot != room["current_player"]:
                    await websocket.send_json({"type": "error", "message": "Not your turn"})
                    continue

                eff_bm = _effective_board_mode(room)
                if eff_bm == "6x6":
                    # #region agent log
                    open("debug-6fad40.log","a",encoding="utf-8").write(json.dumps({"sessionId":"6fad40","runId":"run1","hypothesisId":"H3","location":"backend/app/routers/room.py:1745","message":"before 6x6 deploy","data":{"player_slot":player_slot,"current_player":room.get("current_player"),"moves_played":room.get("moves_played",0),"rb6_special_cell":room.get("rb6_special_cell"),"row":row,"col":col},"timestamp":int(datetime.utcnow().timestamp()*1000)})+"\n")
                    # #endregion
                engine = GameEngine(
                    board_mode=eff_bm,
                    selected_pattern_ids=room.get("selected_patterns"),
                    selected_pattern_ids_p1=room.get("selected_patterns_p1"),
                    selected_pattern_ids_p2=room.get("selected_patterns_p2"),
                    rb6_special_cell=room.get("rb6_special_cell"),
                )
                engine.board          = room["board"]
                engine.current_player = room["current_player"]
                engine.moves_played   = room["moves_played"]
                engine.extra_turns    = room.get("extra_turns", 0)
                engine.c3_blocked     = room.get("c3_blocked", False)
                engine.suppress_center_opening = bool(
                    room.get("suppress_center_opening", False)
                )

                result      = engine.deploy(row, col)
                if eff_bm == "6x6":
                    played_owner = None
                    if 0 <= row < len(engine.board) and 0 <= col < len(engine.board[row]):
                        played_owner = engine.board[row][col]
                    # #region agent log
                    open("debug-6fad40.log","a",encoding="utf-8").write(json.dumps({"sessionId":"6fad40","runId":"run1","hypothesisId":"H3","location":"backend/app/routers/room.py:1762","message":"after 6x6 deploy","data":{"player_slot":player_slot,"played_owner":played_owner,"next_player":engine.current_player,"extra_turns":engine.extra_turns,"winner":result.get("winner"),"rb6_special_cell":room.get("rb6_special_cell")},"timestamp":int(datetime.utcnow().timestamp()*1000)})+"\n")
                    # #endregion
                is_finished = bool(result.get("winner"))
                career_rb_meta = None

                # ── Record Move Log ──
                move_log = list(room.get("move_log") or [])
                move_log.append({"row": row, "col": col, "player": player_slot, "ext": result.get("extra_turns", 0)})

                game1_patch: dict = {}
                if (
                    room.get("game_number", 1) == 1
                    and room.get("moves_played", 0) == 0
                ):
                    game1_patch["game1_first_player"] = player_slot
                    game1_patch["series_g1_move_played"] = True

                update = {
                    "board":          engine.board,
                    "current_player": engine.current_player,
                    "moves_played":   engine.moves_played,
                    "extra_turns":    engine.extra_turns,
                    "winner":         result.get("winner"),
                    "game_status":    "finished" if is_finished else "playing",
                    "status":         "finished" if is_finished else "active",
                    "move_log":       move_log,
                    **game1_patch,
                }

                if is_finished:
                    outcome = result.get("winner")
                    history = room.get("match_history", [])
                    seg_start = room.get("segment_start_index", 0)
                    gn = room.get("game_number", 1)
                    bm = _effective_board_mode(room)

                    # ── Create Rich Round Record ──
                    round_record = {
                        "winner": outcome,
                        "board": [list(r) for r in engine.board],
                        "moves": move_log,
                        "board_mode": bm,
                        "game_number": gn,
                    }
                    new_history = history + [round_record]
                    update["match_history"] = new_history
                    update["move_log"] = [] # Clear for next round

                    if room.get("protocolbreaker_final") and is_finished:
                        # Protocolbreaker is a single decisive round (sudden death).
                        sw_pb = outcome if outcome in ("P1", "P2") else "DRAW"
                        p1p_new, p2p_new = compute_segment_points(new_history, seg_start)
                        update.update(
                            {
                                "match_history": new_history,
                                "series_winner": sw_pb,
                                "p1_series_points": p1p_new,
                                "p2_series_points": p2p_new,
                                "awaiting_rulebreaker": False,
                                "game_number": gn,
                            }
                        )
                        await db.rooms.update_one({"room_code": room_code}, {"$set": update})
                        # ... (broadcast logic follows)
                        broadcast_pb = {
                            "type": "move_made",
                            "row": row,
                            "col": col,
                            "board": engine.board,
                            "current_player": engine.current_player,
                            "moves_played": engine.moves_played,
                            "winner": result.get("winner"),
                            "win_line": [[r, c] for r, c in engine.winner_line]
                            if engine.winner_line
                            else [],
                            "game_status": "finished" if sw_pb else "playing",
                            "extra_turns": result.get("extra_turns", 0),
                            "connectionScores": result.get("connectionScores"),
                            "match_history": update["match_history"],
                            "p1_series_points": update["p1_series_points"],
                            "p2_series_points": update["p2_series_points"],
                            "series_winner": update["series_winner"],
                            "awaiting_rulebreaker": update["awaiting_rulebreaker"],
                            "segment_start_index": update.get(
                                "segment_start_index", room.get("segment_start_index", 0)
                            ),
                            "history_display_start_index": update.get(
                                "history_display_start_index",
                                room.get("history_display_start_index", 0),
                            ),
                        }
                        for slot, ws in _room_connections.get(room_code, {}).items():
                            try:
                                await ws.send_json(broadcast_pb)
                            except Exception:
                                pass
                        if sw_pb:
                            asyncio.create_task(
                                _award_match_series_and_notify(
                                    db, room_code, room, update, str(sw_pb)
                                )
                            )
                        continue
                    # ── Match-wide Pipeline Logic ──
                    lh = len(new_history)
                    s_state = compute_series_state(new_history, 0)
                    sw_found = s_state["series_winner"]

                    is_triple_leg = room.get("ranked_triple_leg") or \
                                   room.get("board_mode_full") == "5x5_6x6_7x7" or \
                                   room.get("board_mode") == "5x5_6x6_7x7"

                    if sw_found:
                        # Match is over - skip upgrades and resolve series
                        update.update({
                            "match_history": new_history,
                            **s_state
                        })
                    elif lh == 2 and bm == "5x5" and is_triple_leg:
                        # After Game 2, indicate Game 3 is Rulebreaker
                        update.update({
                            "match_history": new_history,
                            "awaiting_rulebreaker": True,
                            **s_state
                        })
                    elif lh == 3 and bm == "5x5" and is_triple_leg:
                        # After Game 3 (Rulebreaker), level up to 6x6
                        finished_5 = [list(r) for r in engine.board]
                        await _apply_5x5_to_6x6_upgrade(
                            db, room_code, room, new_history, outcome,
                            game1_patch=game1_patch, finished_board=finished_5,
                            row=row, col=col, moves_played=engine.moves_played,
                            current_player=engine.current_player,
                            win_line=[[r,c] for r,c in engine.winner_line] if engine.winner_line else [],
                            extra_turns=result.get("extra_turns", 0),
                            connection_scores=result.get("connectionScores"),
                        )
                        continue
                    elif lh == 5 and bm == "6x6" and is_triple_leg:
                        # After Game 5, indicate Game 6 is Timebreaker
                        update.update({
                            "match_history": new_history,
                            "awaiting_rulebreaker": True,
                            **s_state
                        })
                    elif lh == 6 and bm == "6x6" and is_triple_leg:
                        # After Game 6 (Timebreaker), level up to 7x7
                        finished_6 = [list(r) for r in engine.board]
                        await _apply_6x6_to_7x7_upgrade(
                            db, room_code, room, new_history, outcome,
                            game1_patch=game1_patch, finished_board=finished_6,
                            row=row, col=col, moves_played=engine.moves_played,
                            current_player=engine.current_player,
                            win_line=[[r,c] for r,c in engine.winner_line] if engine.winner_line else [],
                            extra_turns=result.get("extra_turns", 0),
                            connection_scores=result.get("connectionScores"),
                        )
                        continue
                    elif lh == 8 and bm == "7x7" and is_triple_leg:
                        # After Game 8, indicate Game 9 is Mindbreaker
                        update.update({
                            "match_history": new_history,
                            "awaiting_rulebreaker": True,
                            **s_state
                        })
                    elif lh >= 9 and not sw_found:
                         # Score tied after 9 rounds -> Protocolbreaker
                         await _broadcast_protocolbreaker_tie(db, room_code, room, new_history)
                         continue
                    else:
                        update.update({
                            "match_history": new_history,
                            **s_state
                        })
                    update["rb_patterns_pre_ban"] = None
                    update["rb_banned_pattern"] = None
                    update["rb_banned_patterns"] = []

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

                if is_finished and update.get("series_winner") is not None:
                    asyncio.create_task(
                        _award_match_series_and_notify(
                            db,
                            room_code,
                            room,
                            update,
                            str(update["series_winner"]),
                        )
                    )

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
                        await _broadcast_rulebreaker_start(db, room_code, room, room.get("match_history", []))
                        continue

                    current_game = room.get("game_number", 1)
                    bm = room.get("board_mode", "5x5")
                    eff_bm = _effective_board_mode(room)
                    sp = room.get("selected_patterns")
                    sp1 = room.get("selected_patterns_p1")
                    sp2 = room.get("selected_patterns_p2")
                    new_engine = GameEngine(
                        board_mode=eff_bm,
                        selected_pattern_ids=sp,
                        selected_pattern_ids_p1=sp1 if eff_bm == "7x7" else None,
                        selected_pattern_ids_p2=sp2 if eff_bm == "7x7" else None,
                    )
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
                        "suppress_center_opening": bool(next_game == 9 and eff_bm == "7x7"),
                        "rb_extra_turn_token_holder": None,
                        "rb_extra_turn_token_used": False,
                        "rb_hide_banned_from_slot": None,
                        "rb_patterns_pre_ban": None,
                        "rb_banned_patterns": [],
                        "rb_banned_pattern": None,
                        "rb6_special_cell": None,
                        "rb6_timer_owner": None,
                    }

                    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})

                    gr_payload = {
                        "type":         "game_reset",
                        "first_player": reset["current_player"],
                        "game_number":  reset["game_number"],
                        "board_mode":   eff_bm,
                        "suppress_center_opening": False,
                        "rb_extra_turn_token_used": False,
                        "preserve_rb_hide": False,
                    }
                    if sp is not None:
                        gr_payload["selected_patterns"] = sp
                    if (
                        bm == "7x7"
                        and sp1 is not None
                        and sp2 is not None
                    ):
                        gr_payload["selected_patterns_p1"] = sp1
                        gr_payload["selected_patterns_p2"] = sp2
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(gr_payload)
                        except:
                            pass

            elif msg["type"] == "levelup_ready":
                room = await db.rooms.find_one({"room_code": room_code})
                if not room:
                    continue
                bm = _effective_board_mode(room)
                gate_5 = bool(room.get("awaiting_5x5_rules_ready")) and bm == "5x5"
                gate_6 = bool(room.get("awaiting_6x6_rules_ready")) and bm == "6x6"
                gate_7 = bool(room.get("awaiting_7x7_rules_ready")) and bm == "7x7"
                if not gate_5 and not gate_6 and not gate_7:
                    continue
                rt = _room_runtime.get(room_code)
                if not rt:
                    continue
                if "levelup_ready" not in rt:
                    rt["levelup_ready"] = {"P1": False, "P2": False}
                ready_val = bool(msg.get("ready", True))
                rt["levelup_ready"][player_slot] = ready_val

                # If 7x7 pattern selection is provided, persist it to the room
                if bm == "7x7" and msg.get("selected_patterns"):
                    sp_field = "selected_patterns_p1" if player_slot == "P1" else "selected_patterns_p2"
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": {sp_field: msg["selected_patterns"]}}
                    )

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
                    _cancel_rules_sheet_timeout(room_code)
                    rt["levelup_ready"] = {"P1": False, "P2": False}
                    clear_doc = {}
                    if gate_5:
                        clear_doc["awaiting_5x5_rules_ready"] = False
                    if gate_6:
                        clear_doc["awaiting_6x6_rules_ready"] = False
                    if gate_7:
                        clear_doc["awaiting_7x7_rules_ready"] = False
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": clear_doc},
                    )
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
                        "selected_patterns_p1": None,
                        "selected_patterns_p2": None,
                        "awaiting_5x5_rules_ready": True,
                        "awaiting_6x6_rules_ready": False,
                        "awaiting_7x7_rules_ready": False,
                        "suppress_center_opening": False,
                        "rb_extra_turn_token_holder": None,
                        "rb_extra_turn_token_used": False,
                        "rb_hide_banned_from_slot": None,
                        "rb_patterns_pre_ban": None,
                        "rb_banned_patterns": [],
                        "rb_banned_pattern": None,
                        "rb6_special_cell": None,
                        "rb6_timer_owner": None,
                        "series_g1_move_played": False,
                    }

                    await db.rooms.update_one({"room_code": room_code}, {"$set": reset})
                    _reset_rules_gate_runtime(room_code)

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
                                "awaiting_5x5_rules_ready": True,
                                "preserve_rb_hide": False,
                            })
                        except:
                            pass

                    _schedule_rules_sheet_timeout(db, room_code)

            elif msg["type"] == "quit_match":
                room_q = await db.rooms.find_one({"room_code": room_code})
                quitter_slot = msg.get("slot") or player_slot
                void_no_play = (
                    room_q
                    and room_q.get("game_status") == "playing"
                    and not _series_g1_had_any_move(room_q)
                )
                if void_no_play:
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": {"game_status": "disbanded"}},
                    )
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(
                                {
                                    "type": "match_aborted_no_play",
                                    "aborted_by": quitter_slot,
                                }
                            )
                        except:
                            pass
                elif (
                    room_q
                    and room_q.get("format") == "ranked"
                    and _is_ranked_triple_leg_room(room_q)
                    and room_q.get("game_status") == "playing"
                ):
                    qid = room_q.get("player1_id") if quitter_slot == "P1" else room_q.get("player2_id")
                    if qid:
                        await apply_ranked_quit_penalty(db, qid)
                    win_slot = "P2" if quitter_slot == "P1" else "P1"
                    await _award_ranked_triple_and_notify(
                        db,
                        room_code,
                        room_q,
                        {"series_winner": win_slot},
                        win_slot,
                        record_clean_streak=False,
                        surrendered_by=quitter_slot,
                    )
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": {"game_status": "disbanded"}},
                    )
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json({"type": "match_disbanded"})
                        except:
                            pass
                else:
                    # Unranked or other mode quit - also award series to opponent
                    win_slot = "P2" if quitter_slot == "P1" else "P1"
                    await _award_match_series_and_notify(
                        db,
                        room_code,
                        room_q,
                        {"series_winner": win_slot},
                        win_slot,
                        record_clean_streak=True,
                        surrendered_by=quitter_slot,
                    )
                    if room_q:
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": {"game_status": "disbanded"}},
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

                room = await db.rooms.find_one({"room_code": room_code})
                if room:
                    phase_patch = {}
                    if action == "start_rb":
                        phase_patch = {
                            "phase": "rb_splash",
                            "rb_phase_payload": payload if isinstance(payload, dict) else {},
                            "rb_summary_started_at_ms": None,
                            "rb_auto_start_due_ms": None,
                        }
                    elif action == "coin_result":
                        phase_patch = {
                            "phase": "rb_coin",
                            "rb_toss_winner": payload.get("toss_winner"),
                            "rb_coin_result": payload.get("result"),
                            "rb_phase_payload": payload if isinstance(payload, dict) else {},
                        }
                    elif action == "phase_choice" and isinstance(payload, dict) and payload.get("phase"):
                        # Preserve earlier rulebreaker selections (e.g. `firstPlayerChosen`)
                        # across later phase payloads which may omit those keys (e.g. toss_summary).
                        existing_rb_phase_payload = room.get("rb_phase_payload")
                        if not isinstance(existing_rb_phase_payload, dict):
                            existing_rb_phase_payload = {}
                        merged_rb_phase_payload = {**existing_rb_phase_payload, **payload}
                        phase_patch = {
                            "phase": payload.get("phase"),
                            "rb_phase_payload": merged_rb_phase_payload,
                            "rb_summary_started_at_ms": None,
                            "rb_auto_start_due_ms": None,
                        }
                        if payload.get("phase") == "toss_summary":
                            due_ms = int(datetime.utcnow().timestamp() * 1000) + 3500
                            phase_patch["rb_summary_started_at_ms"] = due_ms - 3500
                            phase_patch["rb_auto_start_due_ms"] = due_ms
                            _cancel_rb_autostart(room_code)
                            _rb_autostart_tasks[room_code] = asyncio.create_task(
                                _auto_finalize_rulebreaker_toss(db, room_code, due_ms)
                            )
                    if phase_patch:
                        await db.rooms.update_one({"room_code": room_code}, {"$set": phase_patch})

                # Persist Timebreaker 6x6 special cell/timer as soon as they are chosen.
                if action == "phase_choice" and isinstance(payload, dict):
                    rb6_cell = payload.get("rb6_special_cell")
                    rb6_timer_owner = payload.get("rb6TimerOwner")
                    timer_patch = {}
                    if isinstance(rb6_cell, dict):
                        owner = rb6_cell.get("owner")
                        row = rb6_cell.get("r")
                        col = rb6_cell.get("c")
                        if owner in ("P1", "P2") and isinstance(row, int) and isinstance(col, int):
                            timer_patch["rb6_special_cell"] = {"r": row, "c": col, "owner": owner}
                    if rb6_timer_owner in ("P1", "P2"):
                        timer_patch["rb6_timer_owner"] = rb6_timer_owner
                    if timer_patch:
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": timer_patch}
                        )

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(broadcast)
                    except:
                        pass

            elif msg["type"] == "limitbreaker_action":
                room_pb = await db.rooms.find_one({"room_code": room_code})
                if not room_pb or not room_pb.get("protocolbreaker_pending"):
                    continue
                phase = room_pb.get("pb_phase")
                choice = msg.get("choice")
                chosen_first = msg.get("first_player")
                ban_mode = msg.get("board_mode") or msg.get("ban")
                bans = list(room_pb.get("pb_bans") or [])
                tw = room_pb.get("pb_toss_winner")
                other = "P2" if tw == "P1" else "P1"
                next_slot = room_pb.get("pb_next_slot")
                if next_slot in ("P1", "P2") and player_slot != next_slot:
                    continue

                if phase == "choice":
                    if player_slot != tw:
                        continue
                    if choice not in ("choose_first_player", "ban_first"):
                        continue
                    patch = {
                        "pb_choice": choice,
                        "pb_phase": "choose_first_player" if choice == "choose_first_player" else "ban_first",
                        "pb_next_slot": tw,
                        "pb_first_ban_slot": other if choice == "choose_first_player" else tw,
                        "pb_second_ban_slot": tw if choice == "choose_first_player" else other,
                    }
                    await db.rooms.update_one({"room_code": room_code}, {"$set": patch})
                    room_pb = await db.rooms.find_one({"room_code": room_code})
                    if room_pb:
                        await _broadcast_limitbreaker_update(room_code, room_pb)
                elif phase == "choose_first_player":
                    if chosen_first not in ("P1", "P2"):
                        continue
                    pb_choice = room_pb.get("pb_choice")
                    patch = {"pb_first_player": chosen_first}
                    if pb_choice == "choose_first_player":
                        patch["pb_phase"] = "ban_first"
                        patch["pb_next_slot"] = room_pb.get("pb_first_ban_slot")
                    else:
                        patch["pb_phase"] = "ban_second"
                        patch["pb_next_slot"] = room_pb.get("pb_second_ban_slot")
                    await db.rooms.update_one({"room_code": room_code}, {"$set": patch})
                    room_pb = await db.rooms.find_one({"room_code": room_code})
                    if room_pb:
                        await _broadcast_limitbreaker_update(room_code, room_pb)
                elif phase in ("ban_first", "ban_second"):
                    if ban_mode not in ("5x5", "6x6", "7x7"):
                        continue
                    if ban_mode in bans:
                        continue
                    bans.append(ban_mode)
                    if len(bans) >= 2:
                        first_player = room_pb.get("pb_first_player") or "P1"
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": {"pb_bans": bans}},
                        )
                        room_pb["pb_bans"] = bans
                        _cancel_lb_phase_task(room_code)
                        await _start_protocolbreaker_final_game(
                            db, room_code, room_pb, bans, first_player
                        )
                    else:
                        patch = {"pb_bans": bans}
                        if room_pb.get("pb_choice") == "ban_first":
                            patch["pb_phase"] = "choose_first_player"
                            patch["pb_next_slot"] = other
                        else:
                            patch["pb_phase"] = "ban_second"
                            patch["pb_next_slot"] = room_pb.get("pb_second_ban_slot")
                        await db.rooms.update_one({"room_code": room_code}, {"$set": patch})
                        room_pb = await db.rooms.find_one({"room_code": room_code})
                        if room_pb:
                            await _broadcast_limitbreaker_update(room_code, room_pb)

            elif msg["type"] == "rb_start_game":
                room = await db.rooms.find_one({"room_code": room_code})
                if not room:
                    continue
                # Only from a completed game (avoids mid-game abuse / double rb_start).
                if room.get("game_status") != "finished":
                    continue
                _cancel_rb_autostart(room_code)
                await _finalize_rulebreaker_start(db, room_code, room, msg)

            elif msg["type"] == "rb_use_extra_turn":
                room = await db.rooms.find_one({"room_code": room_code})
                if not room or room.get("game_status") != "playing":
                    continue
                if room.get("winner"):
                    continue
                if room.get("board_mode", "5x5") != "7x7":
                    continue
                if player_slot != room.get("current_player"):
                    await websocket.send_json(
                        {"type": "error", "message": "Not your turn"}
                    )
                    continue
                if room.get("rb_extra_turn_token_holder") != player_slot:
                    continue
                if room.get("rb_extra_turn_token_used"):
                    continue
                if room.get("extra_turns", 0) != 0:
                    continue
                new_et = room.get("extra_turns", 0) + 2
                await db.rooms.update_one(
                    {"room_code": room_code},
                    {
                        "$set": {
                            "extra_turns": new_et,
                            "rb_extra_turn_token_used": True,
                        }
                    },
                )
                payload = {
                    "type": "rb_extra_turn_update",
                    "extra_turns": new_et,
                    "rb_extra_turn_token_used": True,
                }
                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(payload)
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
                bm = _effective_board_mode(room)

                if room.get("protocolbreaker_final"):
                    sw_to = winner if winner in ("P1", "P2", "DRAW") else "DRAW"
                    update_pb = {
                        "winner": winner,
                        "game_status": "finished",
                        "status": "finished",
                        "match_history": new_history,
                        "series_winner": sw_to,
                        "p1_series_points": 1 if winner == "P1" else 0,
                        "p2_series_points": 1 if winner == "P2" else 0,
                        "awaiting_rulebreaker": False,
                    }
                    await db.rooms.update_one(
                        {"room_code": room_code}, {"$set": update_pb}
                    )
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(
                                {
                                    "type": "move_made",
                                    "winner": winner,
                                    "board": room.get("board", []),
                                    "current_player": room.get("current_player", "P1"),
                                    "moves_played": room.get("moves_played", 0),
                                    "win_line": [],
                                    "game_status": "finished",
                                    "extra_turns": 0,
                                    "match_history": new_history,
                                    "p1_series_points": update_pb["p1_series_points"],
                                    "p2_series_points": update_pb["p2_series_points"],
                                    "series_winner": update_pb["series_winner"],
                                    "awaiting_rulebreaker": False,
                                    "segment_start_index": seg_start,
                                }
                            )
                        except Exception:
                            pass
                    asyncio.create_task(
                        _award_match_series_and_notify(
                            db, room_code, room, update_pb, str(sw_to)
                        )
                    )
                    continue

                if should_auto_upgrade_7x7_after_6x6_game3(
                    new_history, seg_start, bm, gn
                ) and room.get("ranked_triple_leg"):
                    fb = room.get("board", [])
                    finished = [list(r) for r in fb] if fb else []
                    await _apply_6x6_to_7x7_upgrade(
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

                if should_auto_upgrade_7x7_after_5x5_game3(
                    new_history, seg_start, bm, gn
                ) and room.get("ranked_triple_leg"):
                    fb = room.get("board", [])
                    finished = [list(r) for r in fb] if fb else []
                    await _apply_5x5_to_6x6_upgrade(
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
                # No-one won yet? Just proceed.
                pass

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
                # Award or Tiebreaker trigger
                should_award = update.get("series_winner") is not None
                is_full_9_tie = (len(new_history) >= 9 and update.get("series_winner") is None)
                
                if should_award or is_full_9_tie:
                    asyncio.create_task(
                        _award_match_series_and_notify(
                            db, room_code, room, update, str(update.get("series_winner") or "DRAW")
                        )
                    )

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
                room_d = await db.rooms.find_one({"room_code": room_code})
                if (
                    room_d
                    and room_d.get("player1_id")
                    and room_d.get("player2_id")
                    and room_d.get("game_status") not in ("disbanded",)
                    and room_d.get("series_winner") is None
                ):
                    void_no_play = room_d.get("game_status") == "playing" and not _series_g1_had_any_move(room_d)
                    if void_no_play:
                        await db.rooms.update_one(
                            {"room_code": room_code},
                            {"$set": {"game_status": "disbanded"}},
                        )
                        for slot, ws in peers.items():
                            try:
                                await ws.send_json(
                                    {
                                        "type": "match_aborted_no_play",
                                        "aborted_by": player_slot,
                                    }
                                )
                            except:
                                pass
                        return
                    winner_slot = "P2" if player_slot == "P1" else "P1"
                    if room_d.get("format") == "ranked" and _is_ranked_triple_leg_room(room_d):
                        quitter_id = room_d.get("player1_id") if player_slot == "P1" else room_d.get("player2_id")
                        if quitter_id:
                            await apply_ranked_quit_penalty(db, quitter_id)
                        await _award_ranked_triple_and_notify(
                            db,
                            room_code,
                            room_d,
                            {"series_winner": winner_slot},
                            winner_slot,
                            record_clean_streak=False,
                            surrendered_by=player_slot,
                        )
                    else:
                        await _award_match_series_and_notify(
                            db,
                            room_code,
                            room_d,
                            {"series_winner": winner_slot},
                            winner_slot,
                            record_clean_streak=True,
                            surrendered_by=player_slot,
                        )
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": {"game_status": "disbanded"}},
                    )
                    for slot, ws in peers.items():
                        try:
                            await ws.send_json({"type": "match_disbanded"})
                        except:
                            pass
                    return
                for slot, ws in peers.items():
                    try:
                        await ws.send_json({"type": "opponent_disconnected"})
                    except:
                        pass