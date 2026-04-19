# backend/app/core/anticheat.py
"""Anti-cheat foundations.

This module keeps gameplay-integrity heuristics in ONE place so that the
room / game / bot routers can call into them without duplicating thresholds.

Current layer (Phase 1.11):
    * minimum human move interval per slot per match
    * elapsed-time sanity check against server clock
    * per-match suspicion counter

Heavier layers (perfect-play cross-check, shadow-ban, cross-account pattern
matching) live in Phase 2.6 and are intentionally NOT here yet so we can
ship the baseline without coupling to the bot engine.

The counters are kept in-process only — this is fine at current scale
(single FastAPI worker). When we scale out we move the counters to Redis;
nothing in this file is serialisation-hostile.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Literal

logger = logging.getLogger("pentaprotocol.anticheat")

# Absolute floor for human reaction time from the instant the opponent
# commits their move. Anything faster than this is reflex-impossible on a
# board UI, so we flag and throttle. 120 ms is deliberately conservative —
# top-1% human reaction is ~150 ms, and network jitter already costs us a
# frame or two.
MIN_HUMAN_MOVE_MS = 120

# Soft ceiling on the gap between two consecutive moves by the SAME slot.
# This catches "turbo" cheats where a bot replies faster than physiologically
# possible even after accounting for alternating turns.
MIN_SAME_SLOT_GAP_MS = 250

# How many suspicious events we tolerate per match before escalating.
SUSPICION_THRESHOLD = 5

# In-process per-room runtime. Shape:
#   { room_code: {
#         "last_move_ms_P1": int | None,
#         "last_move_ms_P2": int | None,
#         "last_any_move_ms": int | None,
#         "suspicion": int,
#         "flags": list[dict],
#     } }
_state: dict[str, dict] = {}


def _now_ms() -> int:
    return int(datetime.utcnow().timestamp() * 1000)


def reset_room(room_code: str) -> None:
    """Called at match end / disband."""
    _state.pop(room_code, None)


def _ensure_room(room_code: str) -> dict:
    rt = _state.get(room_code)
    if rt is None:
        rt = {
            "last_move_ms_P1": None,
            "last_move_ms_P2": None,
            "last_any_move_ms": None,
            "suspicion": 0,
            "flags": [],
        }
        _state[room_code] = rt
    return rt


def check_move(
    room_code: str,
    slot: Literal["P1", "P2"],
    *,
    turn_started_at_ms: int | None,
) -> dict:
    """Evaluate a single incoming move for anti-cheat flags.

    Returns a dict:
        {
            "ok": bool,            # whether the move should be accepted
            "flag": str | None,    # short flag label if suspicious
            "suspicion": int,      # running counter for this match
            "delta_any_ms": int | None,
            "delta_same_ms": int | None,
            "since_turn_start_ms": int | None,
        }

    The caller decides how to act on a flag: reject the move, log a
    security event, attach a suspicion counter to the match log, etc.
    Phase 1.11 simply records the flag and lets the move through unless
    it is impossibly fast (below MIN_HUMAN_MOVE_MS). We don't want to
    hard-fail legitimate lucky-fast plays — we want an audit trail.
    """
    rt = _ensure_room(room_code)
    now_ms = _now_ms()

    delta_any = None
    if rt["last_any_move_ms"] is not None:
        delta_any = now_ms - rt["last_any_move_ms"]

    same_key = f"last_move_ms_{slot}"
    delta_same = None
    if rt[same_key] is not None:
        delta_same = now_ms - rt[same_key]

    since_turn_start = None
    if turn_started_at_ms:
        since_turn_start = max(0, now_ms - int(turn_started_at_ms))

    flag: str | None = None
    ok = True

    # Absolute floor — reflex-impossible reply to opponent move.
    if delta_any is not None and delta_any < MIN_HUMAN_MOVE_MS:
        flag = "reflex_impossible"
        ok = False
    elif delta_same is not None and delta_same < MIN_SAME_SLOT_GAP_MS:
        flag = "same_slot_burst"
        # Not a hard reject — we warn and throttle via suspicion.
    elif since_turn_start is not None and since_turn_start < MIN_HUMAN_MOVE_MS:
        # Turn-start window: if the server-side turn clock just started and the
        # client already replied, that's a red flag too.
        flag = "turn_start_instant"

    if flag:
        rt["suspicion"] += 1
        rt["flags"].append(
            {
                "slot": slot,
                "flag": flag,
                "delta_any_ms": delta_any,
                "delta_same_ms": delta_same,
                "since_turn_start_ms": since_turn_start,
                "ts_ms": now_ms,
            }
        )
        # Keep the flag log bounded — long matches don't need to grow unboundedly.
        if len(rt["flags"]) > 50:
            rt["flags"] = rt["flags"][-50:]
        logger.info(
            "anticheat.flag room=%s slot=%s flag=%s delta_any=%s delta_same=%s tss=%s suspicion=%d",
            room_code,
            slot,
            flag,
            delta_any,
            delta_same,
            since_turn_start,
            rt["suspicion"],
        )
        # Mirror the flag into security_events so investigators don't need
        # to tail stdout. Severity escalates past the suspicion threshold.
        try:
            from app.core import security_audit as _audit
            sev = (
                _audit.SEVERITY_ALERT
                if rt["suspicion"] >= SUSPICION_THRESHOLD
                else _audit.SEVERITY_WARN
            )
            _audit.log_event(
                event_type=_audit.EVENT_ANTICHEAT_FLAG,
                severity=sev,
                meta={
                    "room": room_code,
                    "slot": slot,
                    "flag": flag,
                    "delta_any_ms": delta_any,
                    "delta_same_ms": delta_same,
                    "since_turn_start_ms": since_turn_start,
                    "suspicion": rt["suspicion"],
                },
            )
        except Exception:
            pass

    # Always update counters AFTER evaluation so deltas reflect the previous move.
    rt[same_key] = now_ms
    rt["last_any_move_ms"] = now_ms

    return {
        "ok": ok,
        "flag": flag,
        "suspicion": rt["suspicion"],
        "delta_any_ms": delta_any,
        "delta_same_ms": delta_same,
        "since_turn_start_ms": since_turn_start,
    }


def snapshot(room_code: str) -> dict:
    rt = _state.get(room_code)
    if not rt:
        return {"suspicion": 0, "flags": []}
    return {"suspicion": rt["suspicion"], "flags": list(rt["flags"])}


def over_threshold(room_code: str) -> bool:
    rt = _state.get(room_code)
    if not rt:
        return False
    return rt["suspicion"] >= SUSPICION_THRESHOLD
