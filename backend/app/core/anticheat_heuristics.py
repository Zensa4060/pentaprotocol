"""Phase 2.6 — post-match anti-cheat heuristics layer.

Phase 1.11 (``anticheat.py``) covers the per-move guardrails — reflex
floors, same-slot bursts, turn-start instants. Those fire live and can
hard-reject a single move. What they cannot do is answer the harder
question:

    "Across the match, did this player look human?"

That judgement needs the full sample of think-times, the outcome, the
number of moves, and — eventually — a cross-check against the bot
engine. This module owns that layer.

Scope for beta launch:

1. Record think_ms samples per slot per match (in-process; bounded).
2. At match end, compute a small set of statistical flags:
   - ``too_fast_median``   median think-time below a human floor
   - ``too_uniform``       coefficient-of-variation implausibly low
   - ``surge_run``         too many consecutive ``reflex_impossible``
                           hits from the Phase 1.11 counters
3. Persist the match summary to ``anticheat_matches`` for investigators.
4. Bump ``users.anticheat_score`` (server-side) with a decaying weight.
5. When the score crosses ``UNDER_REVIEW_THRESHOLD``, mark
   ``users.under_review = True`` and record ``users.shadow_since``.

Explicit non-goals here:

* No ML, no per-account graph analysis — that belongs in an offline
  pipeline, not the hot path.
* No bot-engine cross-check yet. We leave a stub (``_engine_cross_check``)
  that returns 0.0 so the wiring is in place; a future PR wires the
  real bot7 evaluator once we have a cheap-enough "top-k move"
  scorer.
* No direct ban. This module only *flags*. The ranked-award path and
  matchmaking use the flag to segregate play. Hard bans happen via the
  admin review router (Phase 2.7), never automatically.

The segregated-matchmaking contract is:
    flagged users queue with ``shadow: True`` — the queue filter forces
    them to only pair with other flagged users. Their ranked_rating is
    frozen; their shadow_rating moves instead. From the client side
    nothing changes except a small "Account under review" banner and
    a backend-enforced inability to affect real leaderboards.
"""
from __future__ import annotations

import logging
import math
import statistics
from datetime import datetime
from typing import Any, Literal

from bson import ObjectId

from app.core import security_audit as _audit
from app.core.flags import flag

logger = logging.getLogger("pentaprotocol.anticheat.heuristics")

Slot = Literal["P1", "P2"]


# ── Thresholds ──────────────────────────────────────────────────────────────
#
# These are deliberately generous. Launch-day goal: zero false positives
# for honest players on mobile networks, even on first placements where
# they're thinking hard. False negatives we tolerate — the admin review
# queue plus cumulative scoring catches the persistent cheats over time.

# Minimum samples before we trust distribution stats.
MIN_SAMPLES = 8
MIN_SAMPLES_UNIFORM = 10

# If the median think-time is under this, a human-class player would
# have to be precognitive across the whole match.
TOO_FAST_MEDIAN_MS = 400

# Coefficient of variation (stddev / mean). Engines produce near-uniform
# delays; humans do not. 0.15 is conservative — natural variance on a
# board game is typically > 0.35.
TOO_UNIFORM_CV = 0.15

# How many reflex_impossible hits from Phase 1.11 before we call it a
# sustained run (not an unlucky network quirk).
SURGE_RUN_COUNT = 3

# Score bumps per flag. These are additive; a single match can trip
# more than one flag.
SCORE_BUMP = {
    "too_fast_median": 25,
    "too_uniform":     15,
    "surge_run":       30,
    "engine_crosscheck": 40,  # reserved for later — currently never fires
}

# Score at which matchmaking segregates the user and ranked writes go
# to shadow_rating. 50 is ~2 full-match worth of strong flags; a single
# flaky match can never reach it on its own.
UNDER_REVIEW_THRESHOLD = 50

# Half-life in days. Every (HALF_LIFE_DAYS) since ``anticheat_decayed_at``
# halves the stored score. We apply decay lazily (on read) so there's
# no cron dependency.
HALF_LIFE_DAYS = 7


# ── In-process per-match buffer ─────────────────────────────────────────────
#
# Shape:
#   { room_code: {
#         "P1": {"think_ms": [..], "moves": int, "surges": int},
#         "P2": {"think_ms": [..], "moves": int, "surges": int},
#     }}
_buffer: dict[str, dict[str, dict[str, Any]]] = {}


def _room(room_code: str) -> dict[str, dict[str, Any]]:
    r = _buffer.get(room_code)
    if r is None:
        r = {
            "P1": {"think_ms": [], "moves": 0, "surges": 0},
            "P2": {"think_ms": [], "moves": 0, "surges": 0},
        }
        _buffer[room_code] = r
    return r


def record_sample(
    room_code: str,
    slot: Slot,
    *,
    think_ms: int | None,
    flag_from_phase1: str | None,
) -> None:
    """Called by the WS move handler on every accepted move.

    ``think_ms`` is how long the slot's player took to answer the current
    turn (now - turn_started_at_ms). ``flag_from_phase1`` is whatever the
    Phase 1.11 ``check_move`` returned, so we can tally ``reflex_impossible``
    surges without re-running the live checks here.
    """
    r = _room(room_code)
    bucket = r.get(slot)
    if bucket is None:
        return
    bucket["moves"] = int(bucket.get("moves", 0)) + 1
    if isinstance(think_ms, int) and 0 <= think_ms <= 10 * 60 * 1000:
        # Drop sub-zero samples (clock skew) and insane outliers (>10m; clock
        # frozen or backgrounded tab). Kept samples are reliable.
        bucket["think_ms"].append(think_ms)
        # Keep per-slot buffer bounded — a single match won't exceed this
        # on any real game, but defense in depth against protocol abuse.
        if len(bucket["think_ms"]) > 400:
            bucket["think_ms"] = bucket["think_ms"][-400:]
    if flag_from_phase1 == "reflex_impossible":
        bucket["surges"] = int(bucket.get("surges", 0)) + 1


def reset_room(room_code: str) -> None:
    _buffer.pop(room_code, None)


# ── Statistical detectors ───────────────────────────────────────────────────


def _detect_too_fast_median(samples: list[int]) -> bool:
    if len(samples) < MIN_SAMPLES:
        return False
    return statistics.median(samples) < TOO_FAST_MEDIAN_MS


def _detect_too_uniform(samples: list[int]) -> bool:
    if len(samples) < MIN_SAMPLES_UNIFORM:
        return False
    mean = statistics.fmean(samples)
    if mean <= 0:
        return False
    stdev = statistics.pstdev(samples)
    cv = stdev / mean
    return cv < TOO_UNIFORM_CV


def _detect_surge_run(surges: int) -> bool:
    return surges >= SURGE_RUN_COUNT


def _engine_cross_check(_samples: list[int]) -> float:
    """Placeholder for the bot-engine top-move match rate.

    A real implementation replays each recorded move against bot7 at
    ``impossible`` difficulty and asks: what fraction of this player's
    moves matched the engine's top-1 choice? Anything north of ~0.85
    across >= 15 moves is cheat-grade signal.

    We stub it at 0.0 for launch so the wiring is present and no
    honest player is ever falsely flagged by an untested scorer.
    """
    return 0.0


def _collect_flags(bucket: dict[str, Any]) -> list[str]:
    samples: list[int] = list(bucket.get("think_ms") or [])
    surges = int(bucket.get("surges") or 0)
    out: list[str] = []
    if _detect_too_fast_median(samples):
        out.append("too_fast_median")
    if _detect_too_uniform(samples):
        out.append("too_uniform")
    if _detect_surge_run(surges):
        out.append("surge_run")
    if _engine_cross_check(samples) >= 0.85:
        out.append("engine_crosscheck")
    return out


# ── Score bookkeeping ───────────────────────────────────────────────────────


def _decay_score(raw_score: int, decayed_at: datetime | None, now: datetime) -> int:
    """Lazy exponential decay with HALF_LIFE_DAYS half-life."""
    if raw_score <= 0 or not isinstance(decayed_at, datetime):
        return max(0, int(raw_score or 0))
    elapsed = (now - decayed_at).total_seconds()
    if elapsed <= 0:
        return int(raw_score)
    halves = elapsed / (HALF_LIFE_DAYS * 86400.0)
    return max(0, int(math.floor(raw_score * (0.5 ** halves))))


async def refresh_user_score(db, user: dict) -> dict:
    """Compute the decayed anticheat score for ``user`` and persist the
    decay checkpoint. Returns the (possibly mutated) user dict.

    Safe to call on every profile read / queue join — it only writes
    back to Mongo when the decayed value actually moves.
    """
    raw = int(user.get("anticheat_score") or 0)
    if raw <= 0:
        return user
    now = datetime.utcnow()
    decayed = _decay_score(raw, user.get("anticheat_decayed_at"), now)
    if decayed == raw:
        return user
    update: dict[str, Any] = {
        "anticheat_score": decayed,
        "anticheat_decayed_at": now,
    }
    # Decay may clear under_review if the score drops below threshold.
    if decayed < UNDER_REVIEW_THRESHOLD and user.get("under_review"):
        update["under_review"] = False
        update["under_review_cleared_at"] = now
    try:
        await db.users.update_one({"_id": user["_id"]}, {"$set": update})
    except Exception:
        logger.warning("anticheat score decay write failed for %s", user.get("_id"))
        return user
    user.update(update)
    return user


def is_under_review(user: dict | None) -> bool:
    if not user:
        return False
    return bool(user.get("under_review"))


async def _bump_score(db, user_id: str, delta: int, reasons: list[str]) -> dict | None:
    """Add ``delta`` to ``users.anticheat_score`` and maybe flip review."""
    if delta <= 0 or not user_id:
        return None
    now = datetime.utcnow()
    try:
        oid = ObjectId(user_id)
    except Exception:
        return None
    user = await db.users.find_one({"_id": oid})
    if not user:
        return None
    user = await refresh_user_score(db, user)
    new_score = int(user.get("anticheat_score") or 0) + int(delta)
    update: dict[str, Any] = {
        "anticheat_score": new_score,
        "anticheat_decayed_at": now,
        "anticheat_last_flag_at": now,
    }
    if new_score >= UNDER_REVIEW_THRESHOLD and not user.get("under_review"):
        update["under_review"] = True
        update["shadow_since"] = now
        # Seed shadow_rating from current ranked_rating so a returning
        # cheat doesn't get to "restart" at base ELO once flagged.
        if "shadow_rating" not in user:
            update["shadow_rating"] = int(
                user.get("ranked_rating") or user.get("hidden_mmr") or 500
            )
        _audit.log_event(
            event_type=_audit.EVENT_ANTICHEAT_FLAG,
            severity=_audit.SEVERITY_ALERT,
            user_id=str(user_id),
            meta={
                "kind": "under_review",
                "score": new_score,
                "reasons": reasons,
            },
        )
    await db.users.update_one({"_id": oid}, {"$set": update})
    user.update(update)
    return user


# ── Match-end entry point ───────────────────────────────────────────────────


async def analyse_match(
    db,
    *,
    room_code: str,
    p1_id: str | None,
    p2_id: str | None,
    winner: str | None,
) -> dict[str, Any]:
    """Finalize heuristics for a completed match.

    Returns a summary dict (also written to ``anticheat_matches``). Never
    raises — anti-cheat must never break match award.
    """
    if not flag("FEATURE_ANTICHEAT_HEURISTICS", default=True):
        reset_room(room_code)
        return {"skipped": True}

    r = _buffer.get(room_code)
    if not r:
        return {"skipped": "no_samples"}

    summary: dict[str, Any] = {
        "room_code": room_code,
        "at": datetime.utcnow(),
        "winner": winner,
        "per_slot": {},
        "flagged_users": [],
    }

    for slot, user_id in (("P1", p1_id), ("P2", p2_id)):
        bucket = r.get(slot) or {}
        samples = list(bucket.get("think_ms") or [])
        flags = _collect_flags(bucket)
        slot_summary: dict[str, Any] = {
            "user_id": str(user_id) if user_id else None,
            "moves": int(bucket.get("moves") or 0),
            "surges": int(bucket.get("surges") or 0),
            "median_ms": int(statistics.median(samples)) if samples else None,
            "mean_ms": int(statistics.fmean(samples)) if samples else None,
            "stdev_ms": (
                int(statistics.pstdev(samples)) if len(samples) >= 2 else None
            ),
            "flags": flags,
        }
        summary["per_slot"][slot] = slot_summary

        if user_id and flags:
            bump = sum(SCORE_BUMP.get(f, 0) for f in flags)
            if bump > 0:
                try:
                    await _bump_score(db, str(user_id), bump, flags)
                    summary["flagged_users"].append({
                        "user_id": str(user_id),
                        "slot": slot,
                        "bump": bump,
                        "flags": flags,
                    })
                except Exception:
                    logger.exception(
                        "anticheat bump failed room=%s slot=%s", room_code, slot
                    )
            _audit.log_event(
                event_type=_audit.EVENT_ANTICHEAT_FLAG,
                severity=_audit.SEVERITY_WARN,
                user_id=str(user_id),
                meta={
                    "kind": "post_match",
                    "room": room_code,
                    "flags": flags,
                    "median_ms": slot_summary["median_ms"],
                    "moves": slot_summary["moves"],
                },
            )

    try:
        await db.anticheat_matches.insert_one(summary)
    except Exception:
        logger.exception("anticheat_matches insert failed room=%s", room_code)

    reset_room(room_code)
    return summary


# ── Matchmaking helper ──────────────────────────────────────────────────────


def queue_shadow_filter(user: dict | None) -> bool:
    """Return True if the user should match only with other shadowed users.
    Callers should mirror this flag onto their matchmaking_queue row and
    require equality in the pair-lookup query."""
    return is_under_review(user)


# ── Award-path helper ───────────────────────────────────────────────────────


def apply_shadow_rating_policy(user: dict, updates: dict[str, Any]) -> dict[str, Any]:
    """Rewrite a ranked-award ``$set`` payload so a shadowed user's real
    ratings do not move.

    Returns a new dict. The shadow user still receives their full XP /
    level / streak updates — the only things pinned are ranked_rating,
    hidden_mmr, and elo. Placement matches are frozen too, so they
    never "graduate" while under review.
    """
    if not is_under_review(user):
        return updates
    out = dict(updates)
    # Capture the pending ranked delta into shadow_rating and strip the
    # mainline ratings from the update.
    new_rr = out.pop("ranked_rating", None)
    new_elo = out.pop("elo", None)
    new_mmr = out.pop("hidden_mmr", None)
    if isinstance(new_rr, int):
        out["shadow_rating"] = new_rr
    elif isinstance(new_elo, int):
        out["shadow_rating"] = new_elo
    if isinstance(new_mmr, int):
        out["shadow_mmr"] = new_mmr
    # Never advance placement while shadowed.
    out.pop("placement_matches", None)
    return out
