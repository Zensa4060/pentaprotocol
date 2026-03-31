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
DISCONNECT_GRACE_SECONDS = 3.0


def _reset_rules_gate_runtime(room_code: str) -> None:
    rt = _room_runtime.get(room_code)
    if rt is not None:
        rt["levelup_ready"] = {"P1": False, "P2": False}


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
        "protocolbreaker_pending": room.get("protocolbreaker_pending", False),
        "pb_toss_winner": room.get("pb_toss_winner"),
        "pb_bans": room.get("pb_bans") or [],
        "protocolbreaker_final": room.get("protocolbreaker_final", False),
        "pb_p1_aggregate": room.get("pb_p1_aggregate"),
        "pb_p2_aggregate": room.get("pb_p2_aggregate"),
    }


def compute_segment_points(history: list, segment_start: int = 0) -> tuple[int, int]:
    """
    Wins in the full match history for the current first-to-5 flow.
    Handles both string winners ('P1') and rich history objects ({'winner': 'P1'}).
    """
    p1 = 0
    p2 = 0
    for item in history:
        w = item["winner"] if isinstance(item, dict) else item
        if w == "P1": p1 += 1
        elif w == "P2": p2 += 1
    return p1, p2


def compute_series_winner(history: list, segment_start: int = 0, win_cap: int = 5) -> str | None:
    """
    First-to-5 total points wins instantly.
    If all 9 games are played, the player with the most points wins.
    If points are equal at 9 games (4-4, 3-3, etc.), returns None (Protocolbreaker).
    """
    p1_pts, p2_pts = compute_segment_points(history)
    if p1_pts >= win_cap:
        return "P1"
    if p2_pts >= win_cap:
        return "P2"
    
    # If the history reaches or exceeds 9, we MUST decide or trigger Protocolbreaker.
    if len(history) >= 9:
        if p1_pts > p2_pts:
            return "P1"
        if p2_pts > p1_pts:
            return "P2"
        return None # Protocolbreaker tie
        
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


async def _award_match_series_and_notify(
    db,
    room_code: str,
    room: dict,
    update: dict,
    match_winner: str,
    *,
    record_clean_streak: bool = True,
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
        agg = compute_series_winner(hist)
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

    await award_ranked_match_result(
        db, game_dict, effective, record_clean_streak=record_clean_streak
    )

    u1a = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    u2a = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None
    
    payload = {
        "type": "match_series_complete",
        "series_winner": effective,
        "format": room["format"],
        "p1": {
            "elo_before": elo1_before,
            "elo_after": u1a.get("elo", elo1_before) if u1a else elo1_before,
            "rr_before": rr1_before,
            "rr_after": int(u1a.get("ranked_rating", rr1_before)) if u1a else rr1_before,
        },
        "p2": {
            "elo_before": elo2_before,
            "elo_after": u2a.get("elo", elo2_before) if u2a else elo2_before,
            "rr_before": rr2_before,
            "rr_after": int(u2a.get("ranked_rating", rr2_before)) if u2a else rr2_before,
        },
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except:
            pass


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
) -> None:
    """After two bans, play one decisive game on the surviving board."""
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
    first = "P1"
    seg_new = len(room.get("match_history") or [])
    p1p, p2p = compute_segment_points(room.get("match_history") or [])
    patch = {
        "board": engine.board,
        "board_mode": mode,
        "current_player": first,
        "moves_played": 0,
        "extra_turns": 0,
        "winner": None,
        "game_status": "playing",
        "status": "active",
        "game_number": room.get("game_number", 1), # Keep board number same? No, incrementing matches.
        "segment_start_index": seg_new,
        "p1_series_points": p1p,
        "p2_series_points": p2p,
        "series_winner": None,
        "awaiting_rulebreaker": False,
        "protocolbreaker_pending": False,
        "protocolbreaker_final": True,
        "pb_bans": banned,
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
        "game_number": room.get("game_number", 1),
        "board_mode": mode,
        "segment_start_index": seg_new,
        "history_display_start_index": room.get("history_display_start_index", 0),
        "p1_series_points": p1p,
        "p2_series_points": p2p,
        "protocolbreaker_final": True,
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
    """Aggregate tie on triple-leg ranked — start board-ban tiebreaker (PROTOCOLBREAKER)."""
    tw = random.choice(["P1", "P2"])
    p1a, p2a = _aggregate_decisive_games(history)
    await db.rooms.update_one(
        {"room_code": room_code},
        {
            "$set": {
                "protocolbreaker_pending": True,
                "pb_toss_winner": tw,
                "pb_bans": [],
                "pb_p1_aggregate": p1a,
                "pb_p2_aggregate": p2a,
            }
        },
    )
    payload = {
        "type": "protocolbreaker_start",
        "toss_winner": tw,
        "p1_aggregate": p1a,
        "p2_aggregate": p2a,
        "match_history_snapshot": history,
    }
    for slot, ws in _room_connections.get(room_code, {}).items():
        try:
            await ws.send_json(payload)
        except Exception:
            pass


def compute_series_state(history: list, segment_start: int = 0) -> dict:
    p1_pts, p2_pts = compute_segment_points(history)
    series_winner = compute_series_winner(history)
    # The new flow does not use the old awaiting_rulebreaker logic between boards;
    # Protocolbreaker is triggered only on DRAW ties.
    return {
        "p1_series_points": p1_pts,
        "p2_series_points": p2_pts,
        "series_winner": series_winner,
        "awaiting_rulebreaker": False,
    }

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
                await db.rooms.update_one({"room_code": room_code}, {"$set": match_update})
                _reset_rules_gate_runtime(room_code)
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
    db  = get_db()
    fmt = data.format
    filt: dict = {"user_id": user_id, "format": fmt}
    if data.board_mode:
        filt["board_mode"] = data.board_mode
    entry = await db.matchmaking_queue.find_one_and_delete(filt)
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
        "awaiting_7x7_rules_ready": False,
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
                engine = GameEngine(
                    board_mode=eff_bm,
                    selected_pattern_ids=room.get("selected_patterns"),
                    selected_pattern_ids_p1=room.get("selected_patterns_p1"),
                    selected_pattern_ids_p2=room.get("selected_patterns_p2"),
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
                        sw_pb = compute_series_winner(new_history)
                        p1p_new, p2p_new = compute_segment_points(new_history)
                        update.update(
                            {
                                "match_history": new_history,
                                "series_winner": sw_pb,
                                "p1_series_points": p1p_new,
                                "p2_series_points": p2p_new,
                                "awaiting_rulebreaker": False,
                                "game_number": gn + 1 if sw_pb is None else gn,
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
                    if should_auto_upgrade_7x7_after_6x6_game3(
                        new_history, seg_start, bm, gn
                    ) and room.get("ranked_triple_leg"):
                        finished_6 = [list(r) for r in engine.board]
                        await _apply_6x6_to_7x7_upgrade(
                            db,
                            room_code,
                            room,
                            new_history,
                            outcome,
                            game1_patch=game1_patch,
                            finished_board=finished_6,
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
                    if should_auto_upgrade_7x7_after_5x5_game3(
                        new_history, seg_start, bm, gn
                    ) and room.get("ranked_triple_leg"):
                        finished_5 = [list(r) for r in engine.board]
                        await _apply_5x5_to_6x6_upgrade(
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

                    if bm == "7x7" and (room.get("rb_banned_pattern") or room.get("rb_banned_patterns")):
                        career_rb_meta = {
                            "rb_banned_patterns_7x7": room.get("rb_banned_patterns") or ([room["rb_banned_pattern"]] if room.get("rb_banned_pattern") else []),
                            "board_mode": bm,
                            "game_number": gn,
                        }
                    update["rb_hide_banned_from_slot"] = None
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

                    # Award logic moved to the bottom of the loop to handle all series outcomes.
                    pass

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
                        "suppress_center_opening": False,
                        "rb_extra_turn_token_holder": None,
                        "rb_extra_turn_token_used": False,
                        "rb_hide_banned_from_slot": None,
                        "rb_patterns_pre_ban": None,
                        "rb_banned_patterns": [],
                        "rb_banned_pattern": None,
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
                        "awaiting_7x7_rules_ready": False,
                        "suppress_center_opening": False,
                        "rb_extra_turn_token_holder": None,
                        "rb_extra_turn_token_used": False,
                        "rb_hide_banned_from_slot": None,
                        "rb_patterns_pre_ban": None,
                        "rb_banned_patterns": [],
                        "rb_banned_pattern": None,
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

            elif msg["type"] == "quit_match":
                room_q = await db.rooms.find_one({"room_code": room_code})
                quitter_slot = msg.get("slot") or player_slot
                if (
                    room_q
                    and room_q.get("format") == "ranked"
                    and _is_ranked_triple_leg_room(room_q)
                    and room_q.get("game_status") == "playing"
                ):
                    qid = room_q.get("player1_id") if quitter_slot == "P1" else room_q.get("player2_id")
                    if qid:
                        await apply_ranked_quit_penalty(db, qid)
                    win_slot = "P2" if quitter_slot == "P1" else "P1"
                    game_dict_q = {
                        "player1_id": room_q["player1_id"],
                        "player2_id": room_q["player2_id"],
                        "format": "ranked",
                        "source": room_q.get("source", "matchmaking"),
                        "mode": "multiplayer",
                        "board_mode": "7x7",
                    }
                    asyncio.create_task(
                        _award_ranked_triple_and_notify(
                            db,
                            room_code,
                            room_q,
                            {"series_winner": win_slot},
                            win_slot,
                            record_clean_streak=False,
                        )
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

            elif msg["type"] == "protocolbreaker_ban":
                ban_mode = msg.get("board_mode") or msg.get("ban")
                if ban_mode not in ("5x5", "6x6", "7x7"):
                    continue
                room_pb = await db.rooms.find_one({"room_code": room_code})
                if not room_pb or not room_pb.get("protocolbreaker_pending"):
                    continue
                bans = list(room_pb.get("pb_bans") or [])
                tw = room_pb.get("pb_toss_winner")
                if len(bans) >= 2:
                    continue
                if len(bans) == 0:
                    if player_slot != tw:
                        continue
                else:
                    if player_slot == tw:
                        continue
                    if ban_mode == bans[0]:
                        continue
                bans.append(ban_mode)
                if len(bans) == 1:
                    await db.rooms.update_one(
                        {"room_code": room_code},
                        {"$set": {"pb_bans": bans}},
                    )
                    nxt = "P2" if tw == "P1" else "P1"
                    upd = {
                        "type": "protocolbreaker_ban_update",
                        "pb_bans": bans,
                        "next_ban_slot": nxt,
                    }
                    for slot, ws in _room_connections.get(room_code, {}).items():
                        try:
                            await ws.send_json(upd)
                        except Exception:
                            pass
                else:
                    await _start_protocolbreaker_final_game(
                        db, room_code, room_pb, bans
                    )

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

                gn = room.get("game_number", 1)
                next_gn = gn + 1
                gs = 7 if bm == "7x7" else 5

                post_seg = patch.get("segment_start_index", seg_start)
                seg_pts = compute_segment_points(hist, post_seg)
                gs = 5
                if bm == "7x7": gs = 7
                elif bm == "6x6": gs = 6
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
                    "suppress_center_opening": suppress_center if bm == "7x7" else False,
                    "rb_extra_turn_token_holder": token_holder if bm == "7x7" else None,
                    "rb_extra_turn_token_used": False,
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
                    "type":         "game_reset",
                    "first_player": first_player,
                    "game_number":  next_gn,
                    "c3_blocked":   c3_blocked,
                    "board_mode":   bm,
                    "segment_start_index": merged.get("segment_start_index", 0),
                    "p1_series_points": seg_pts[0],
                    "p2_series_points": seg_pts[1],
                    "suppress_center_opening": reset["suppress_center_opening"],
                    "rb_extra_turn_token_holder": reset["rb_extra_turn_token_holder"],
                    "rb_extra_turn_token_used": False,
                }
                if sp_out is not None:
                    gr_payload["selected_patterns"] = sp_out
                if (
                    bm == "7x7"
                    and merged.get("selected_patterns_p1") is not None
                    and merged.get("selected_patterns_p2") is not None
                ):
                    gr_payload["selected_patterns_p1"] = merged.get(
                        "selected_patterns_p1"
                    )
                    gr_payload["selected_patterns_p2"] = merged.get(
                        "selected_patterns_p2"
                    )
                preserve_hide = bool(
                    bm == "7x7"
                    and hide_slot
                    and isinstance(pre_ban, list)
                    and len(pre_ban) > 0
                )
                gr_payload["preserve_rb_hide"] = preserve_hide
                if preserve_hide or (bm == "7x7" and (banned_pats or banned_pat)):
                    gr_payload["rb_hide_banned_from_slot"] = reset.get(
                        "rb_hide_banned_from_slot"
                    )
                    gr_payload["rb_patterns_pre_ban"] = reset.get("rb_patterns_pre_ban")
                    gr_payload["rb_banned_patterns"] = reset.get("rb_banned_patterns", [])
                    gr_payload["rb_banned_pattern"] = reset.get("rb_banned_pattern")

                for slot, ws in _room_connections.get(room_code, {}).items():
                    try:
                        await ws.send_json(gr_payload)
                    except:
                        pass

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
                for slot, ws in peers.items():
                    try:
                        await ws.send_json({"type": "opponent_disconnected"})
                    except:
                        pass