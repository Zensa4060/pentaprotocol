"""Pydantic schemas for inbound WebSocket frames (Phase 2.3).

We *do not* try to schema-validate every single message type the room
WS handler understands — there are ~20 of them and most are
gameplay-flavor frames with bespoke, low-risk payloads. Instead we
enforce schemas on the ones where a malformed or malicious payload
has security impact:

* ``move``          — row/col injection, think_ms spoofing
* ``chat``          — length + content
* ``quit_match``    — client-supplied slot was an exploit (Phase 1.3)
* ``timeout``       — client-supplied winner was an exploit (Phase 1.3)
* ``toss_action``   — choice string injection
* ``limitbreaker_action`` / ``rb_*`` — structured action fields

Everything else is protected only by the envelope + rate/replay guard.

Each model inherits from ``WsEnvelope`` which carries the three fields
every frame must have post-Phase-2.3:

    type            str     — message type (kept for routing)
    seq             int ≥ 0 — client-side monotonic counter
    client_msg_id   str     — random, unique per frame, used for
                              replay ring detection on the server

Older clients won't send seq/client_msg_id until the frontend rollout
completes. The guard tolerates missing values (counts it as a strike
but does not reject) so we avoid a hard cutover.
"""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated


# ── Envelope ─────────────────────────────────────────────────────────────────

class WsEnvelope(BaseModel):
    """Base for every frame. Handlers should always at least validate
    this much before touching the payload."""

    model_config = ConfigDict(extra="allow")  # other keys are type-specific

    type: Annotated[str, StringConstraints(min_length=1, max_length=40)]
    seq: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)
    client_msg_id: Optional[Annotated[str, StringConstraints(min_length=1, max_length=64)]] = None


# ── Gameplay-critical payloads ───────────────────────────────────────────────

class MoveMsg(WsEnvelope):
    type: Literal["move"]
    # Board coordinates. We support 5x5/6x6/7x7 so the wide bound is 0..6.
    # Engine-level bounds checking also runs but fail-fast here gives us
    # cleaner audit logs and stops the handler wasting a DB roundtrip.
    row: int = Field(ge=0, le=6)
    col: int = Field(ge=0, le=6)
    # Client-advisory think time. We clamp to 5 minutes; anything
    # beyond that is either clock skew or malice and is already
    # overridden by server-side elapsed calculation (anti-cheat 1.11).
    think_ms: Optional[int] = Field(default=None, ge=0, le=300_000)


class ChatMsg(WsEnvelope):
    type: Literal["chat"]
    # Hard cap enforced here so the existing len() check in room.py
    # becomes belt-and-suspenders. 300 chars is the previously agreed
    # per-message cap from Phase 1.3.
    text: Annotated[str, StringConstraints(min_length=1, max_length=300)]


class QuitMatchMsg(WsEnvelope):
    type: Literal["quit_match"]
    # `slot` is intentionally absent — Phase 1.3 made outcomes
    # server-authoritative using the authenticated slot. If a client
    # still sends it, we ignore it downstream.
    reason: Optional[Annotated[str, StringConstraints(max_length=200)]] = None


class TimeoutMsg(WsEnvelope):
    type: Literal["timeout"]
    # Pre-Phase-1.3, clients sent `winner` here. We no longer trust it;
    # the field is not declared, so Pydantic silently ignores it
    # (extra="allow" at the envelope level).


# ── Exported registry ────────────────────────────────────────────────────────

# Map of type -> strict model. Handlers use this via ``validate_strict``
# to get a typed payload with all the field constraints enforced. For
# any other type we return a plain ``WsEnvelope`` so seq/client_msg_id
# are still checked.
STRICT_MODELS: dict[str, type[WsEnvelope]] = {
    "move":       MoveMsg,
    "chat":       ChatMsg,
    "quit_match": QuitMatchMsg,
    "timeout":    TimeoutMsg,
}


def validate_envelope(raw: Any) -> Optional[WsEnvelope]:
    """Best-effort envelope parse. Returns None on failure; never raises."""
    try:
        return WsEnvelope.model_validate(raw)
    except Exception:
        return None


def validate_strict(raw: Any, msg_type: str) -> Optional[WsEnvelope]:
    """If ``msg_type`` has a strict model, run it. Otherwise fall back
    to envelope-only validation. Returns the parsed model or None."""
    cls = STRICT_MODELS.get(msg_type)
    if cls is None:
        return validate_envelope(raw)
    try:
        return cls.model_validate(raw)
    except Exception:
        return None
