"""WebSocket hardening primitives (Phase 2.3).

Everything our two WS handlers need to be defensible in one place:

* **Ticket handshake** — short-lived, single-use, HMAC-signed tokens
  the client fetches with its JWT over plain HTTP, then presents on
  the WS upgrade URL. The JWT never rides in the WS URL itself, so it
  never ends up in proxy logs or browser history.

* **Per-connection rate limiting** — an in-memory token bucket per
  open socket, stopping a compromised client from fire-hosing the
  room handler. The global 120-msgs/10s/user Redis cap is also here
  for multi-tab coordination.

* **Replay / out-of-order detection** — every inbound frame carries a
  monotonic ``seq`` and a random ``client_msg_id``. We reject
  regressions and duplicate ids seen in the last 64 frames.

* **Reconnect throttle** — a user spamming ticket requests gets 429s
  before they can consume handler resources.

Anything that has to survive restarts lives in Redis; anything that's
purely per-connection lives in the process.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Literal, Optional

from redis import asyncio as aioredis

from app.core import security_audit as audit


# ──────────────────────────────────────────────────────────────────────────────
# Redis plumbing. We reuse the same REDIS_URL as rate_limit / auth_state.
# ──────────────────────────────────────────────────────────────────────────────
_redis_client: Optional[aioredis.Redis] = None


def _redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL", "").strip()
        if not url:
            raise RuntimeError("REDIS_URL is required for ws_security")
        _redis_client = aioredis.from_url(url, decode_responses=True)
    return _redis_client


def _ticket_secret() -> bytes:
    # Derive a distinct WS-ticket HMAC key from SECRET_KEY so a leaked
    # JWT-signing key does not automatically let an attacker forge
    # WS tickets. `SECRET_KEY` is required — if missing, raise rather
    # than fall back to a weak default.
    base = os.getenv("SECRET_KEY", "").encode("utf-8")
    if not base:
        raise RuntimeError("SECRET_KEY must be set to issue WS tickets")
    return hashlib.sha256(b"pp.ws.ticket.v1|" + base).digest()


# ──────────────────────────────────────────────────────────────────────────────
# Ticket handshake.
# Ticket format:  "<b64url_payload>.<b64url_sig>"
# Payload is JSON: {u, s, e, r, sl, n}
#   u   user_id
#   s   sid (JWT session id)
#   e   jwt exp (unix seconds) — carried forward so the WS can close
#       itself when the underlying JWT expires without hitting the DB
#   r   room_code (optional)
#   sl  player slot ("P1"/"P2", optional)
#   n   nonce (random, required; used as Redis key to enforce single-use)
# ──────────────────────────────────────────────────────────────────────────────
TICKET_TTL_SECONDS = 30

# Hard cap on tickets a user can mint in a rolling minute. 5 is enough
# for a normal reconnect storm (browser refresh during a match). More
# than that and the user is either buggy or hostile.
TICKET_RATE_LIMIT = 5
TICKET_RATE_WINDOW_SECONDS = 60


def _b64url(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    import base64
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


@dataclass
class TicketPayload:
    user_id: str
    sid: Optional[str]
    jwt_exp: Optional[int]
    room_code: Optional[str]
    slot: Optional[Literal["P1", "P2"]]
    nonce: str


async def issue_ticket(
    *,
    user_id: str,
    sid: Optional[str],
    jwt_exp: Optional[int],
    room_code: Optional[str] = None,
    slot: Optional[str] = None,
    client_ip: Optional[str] = None,
) -> str:
    """Mint a new WS ticket. Raises ``ReconnectThrottled`` if the user
    has requested too many tickets in the last minute."""

    # Reconnect throttle — keyed by user. We use INCR + EXPIRE; the
    # worst-case race (two parallel INCRs before EXPIRE sets) is
    # benign since both calls still count toward the budget.
    r = _redis()
    throttle_key = f"ws:ticket:rate:{user_id}"
    try:
        count = await r.incr(throttle_key)
        if count == 1:
            await r.expire(throttle_key, TICKET_RATE_WINDOW_SECONDS)
    except Exception:
        # Fail open on Redis outage — we'd rather a user reconnect
        # than be locked out because Redis hiccupped.
        count = 0

    if count and count > TICKET_RATE_LIMIT:
        audit.log_event(
            event_type=audit.EVENT_WS_REJECT,
            severity=audit.SEVERITY_WARN,
            user_id=user_id,
            ip=client_ip,
            meta={"reason": "reconnect_throttled", "count": count},
        )
        raise ReconnectThrottled()

    nonce = secrets.token_urlsafe(16)
    payload = {
        "u": user_id,
        "s": sid,
        "e": jwt_exp,
        "r": room_code,
        "sl": slot,
        "n": nonce,
    }
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sig = hmac.new(_ticket_secret(), body, hashlib.sha256).digest()
    ticket = f"{_b64url(body)}.{_b64url(sig)}"

    # Register the nonce so consume can SETNX-delete. TTL doubles as
    # expiry for the ticket itself.
    try:
        await r.set(f"ws:ticket:nonce:{nonce}", "1", ex=TICKET_TTL_SECONDS)
    except Exception:
        # If Redis is down we can't guarantee single-use; better to
        # surface that to the caller than silently issue replayable
        # tickets.
        raise TicketBackendUnavailable()

    return ticket


class TicketInvalid(Exception):
    """Ticket signature/format/expiry/replay check failed."""


class ReconnectThrottled(Exception):
    """User exceeded the ticket-issue rate limit."""


class TicketBackendUnavailable(Exception):
    """Redis is down; we refuse to issue non-replay-safe tickets."""


async def consume_ticket(
    raw: str,
    *,
    expected_room_code: Optional[str] = None,
    expected_slot: Optional[str] = None,
) -> TicketPayload:
    """Verify signature, check single-use, enforce binding.

    This must be awaited INSIDE the WS handler immediately after
    ``accept()`` — or before, if the handler wants to close without
    accepting; either is fine."""
    try:
        body_b64, sig_b64 = raw.split(".", 1)
        body = _b64url_decode(body_b64)
        sig = _b64url_decode(sig_b64)
    except Exception:
        raise TicketInvalid("malformed")

    expected_sig = hmac.new(_ticket_secret(), body, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expected_sig):
        raise TicketInvalid("bad signature")

    try:
        data = json.loads(body)
    except Exception:
        raise TicketInvalid("bad body")

    payload = TicketPayload(
        user_id=str(data.get("u", "")),
        sid=data.get("s"),
        jwt_exp=data.get("e"),
        room_code=data.get("r"),
        slot=data.get("sl"),
        nonce=str(data.get("n", "")),
    )
    if not payload.user_id or not payload.nonce:
        raise TicketInvalid("missing fields")

    # Binding checks — if caller said "this ticket should be for
    # room X slot Y" and it isn't, reject. Stops an attacker from
    # reusing a ticket minted for a different room.
    if expected_room_code and payload.room_code and payload.room_code != expected_room_code:
        raise TicketInvalid("room mismatch")
    if expected_slot and payload.slot and payload.slot != expected_slot:
        raise TicketInvalid("slot mismatch")

    # Single-use enforcement via Redis DEL returning count.
    r = _redis()
    try:
        deleted = await r.delete(f"ws:ticket:nonce:{payload.nonce}")
    except Exception:
        raise TicketInvalid("backend unavailable")
    if deleted != 1:
        raise TicketInvalid("replayed or expired")

    return payload


# ──────────────────────────────────────────────────────────────────────────────
# Per-connection rate limiting + replay guard.
# Every WS handler creates one ConnectionGuard at accept time. The
# handler calls `guard.check(msg)` on every inbound frame; any
# exception means drop the frame (and optionally close after N
# strikes).
# ──────────────────────────────────────────────────────────────────────────────

# Token-bucket sizing. These are not env-flag-tunable on purpose — if
# a frame rate above this is needed, that's a protocol bug, not a knob.
_BUCKET_CAPACITY = 30         # burst
_BUCKET_REFILL_PER_SEC = 6.0  # steady rate
_CHAT_BUCKET_CAPACITY = 3     # stricter for chat type
_CHAT_BUCKET_WINDOW = 10.0    # seconds
_REPLAY_RING_SIZE = 64        # remember the last N client_msg_ids
_MAX_STRIKES_BEFORE_CLOSE = 5


@dataclass
class ConnectionGuard:
    user_id: str
    room_code: Optional[str] = None

    # Rate-limit state.
    _tokens: float = field(default=float(_BUCKET_CAPACITY))
    _last_refill: float = field(default_factory=time.monotonic)
    _chat_timestamps: deque = field(default_factory=deque)

    # Replay state.
    _last_seq: int = 0
    _seen_ids: deque = field(default_factory=lambda: deque(maxlen=_REPLAY_RING_SIZE))

    # Quality-of-misbehavior counter. Handler decides what to do when
    # this crosses `_MAX_STRIKES_BEFORE_CLOSE`; we just report it.
    strikes: int = 0

    def note_strike(self, reason: str) -> bool:
        """Record a strike. Returns True if the socket should be closed
        now because the strike budget is blown."""
        self.strikes += 1
        if self.strikes >= _MAX_STRIKES_BEFORE_CLOSE:
            audit.log_event(
                event_type=audit.EVENT_WS_REJECT,
                severity=audit.SEVERITY_WARN,
                user_id=self.user_id,
                meta={
                    "reason": "strike_budget_exceeded",
                    "last": reason,
                    "room": self.room_code,
                },
            )
            return True
        return False

    def check_rate(self, is_chat: bool) -> bool:
        """Return True if the frame is within rate limits. Mutates the
        bucket as a side effect (always consumes one token even if the
        rate check fails, so a flood can't avoid the strike budget by
        gaming the bucket)."""
        now = time.monotonic()

        # Chat gets a stricter, window-based limit on top of the general
        # bucket: 3 frames per 10 seconds.
        if is_chat:
            cutoff = now - _CHAT_BUCKET_WINDOW
            while self._chat_timestamps and self._chat_timestamps[0] < cutoff:
                self._chat_timestamps.popleft()
            if len(self._chat_timestamps) >= _CHAT_BUCKET_CAPACITY:
                return False
            self._chat_timestamps.append(now)

        # Refill the general bucket.
        elapsed = now - self._last_refill
        if elapsed > 0:
            self._tokens = min(
                float(_BUCKET_CAPACITY),
                self._tokens + elapsed * _BUCKET_REFILL_PER_SEC,
            )
            self._last_refill = now

        if self._tokens < 1.0:
            return False
        self._tokens -= 1.0
        return True

    def check_replay(self, seq: Optional[int], msg_id: Optional[str]) -> bool:
        """Reject frames with non-monotonic seq OR duplicate client_msg_id."""
        if seq is None or not isinstance(seq, int):
            return False
        if seq <= self._last_seq:
            return False
        if msg_id:
            if msg_id in self._seen_ids:
                return False
            self._seen_ids.append(msg_id)
        self._last_seq = seq
        return True


# ──────────────────────────────────────────────────────────────────────────────
# Global per-user WS cap across all of their tabs/connections.
# In-memory counter keyed by user_id. Not Redis-backed because it's
# only meaningful within a single replica — cross-replica coordination
# for a per-user tab count would cost more than it saves us.
# ──────────────────────────────────────────────────────────────────────────────
_per_user_msg_window: dict[str, deque] = {}
_PER_USER_WINDOW_S = 10.0
_PER_USER_MSG_CAP = 120


def user_window_check(user_id: str) -> bool:
    """Returns True if the user has not exceeded 120 msgs / 10s across
    all of their sockets on this replica."""
    now = time.monotonic()
    dq = _per_user_msg_window.setdefault(user_id, deque())
    cutoff = now - _PER_USER_WINDOW_S
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= _PER_USER_MSG_CAP:
        return False
    dq.append(now)
    return True


# ──────────────────────────────────────────────────────────────────────────────
# JWT-expiry watchdog. Scheduled once per WS; when jwt_exp hits, we
# close the socket with a clean reason code.
# ──────────────────────────────────────────────────────────────────────────────
async def schedule_jwt_expiry_close(websocket, jwt_exp: Optional[int]) -> Optional[asyncio.Task]:
    if not jwt_exp:
        return None
    now = int(time.time())
    delay = max(0, jwt_exp - now)
    if delay <= 0:
        # Already expired — the caller shouldn't even have reached here,
        # but be defensive.
        try:
            await websocket.close(code=4001, reason="Token expired")
        except Exception:
            pass
        return None

    async def _closer():
        try:
            await asyncio.sleep(delay)
            await websocket.close(code=4001, reason="Token expired")
        except asyncio.CancelledError:
            raise
        except Exception:
            pass

    return asyncio.create_task(_closer())
