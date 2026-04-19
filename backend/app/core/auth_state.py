"""Short-lived auth / sensitive-flow state stored in Redis.

Everything here used to live in module-level dicts inside ``auth.py``:

* ``_reset_codes[email] -> {hashed, expires_at}``
* ``_pending_2fa[temp_token] -> {user_id, expires_at}``

In-memory state works fine on a single FastAPI worker but silently breaks
the second you scale horizontally (gunicorn workers, Railway replicas) or
redeploy — the user's in-flight reset code is on worker A, their next
request hits worker B, they get *"Invalid or expired session"* for no
reason. Worse: an attacker can spray requests across workers to hunt for
weak handling, and we lose every short-lived secret on every redeploy.

Redis fixes all of that by giving us a single, TTL-aware key-value store
shared by every worker. We also:

* **Hash the lookup key** (email / temp_token) so a casual Redis browse
  can't reveal user emails or session tokens.
* **Hash the 2FA temp_token** on write so stealing a Redis snapshot does
  not give an attacker working session tickets.
* **Fail fast on Redis outage** for these flows (unlike rate limits
  where we fail open). Auth state loss is safer than a silent bypass.

Key layout:
    authstate:reset:<sha256(email)[:32]>   -> JSON {"hashed": "...", "email": "..."}
    authstate:pending2fa:<sha256(tok)[:32]> -> JSON {"user_id": "..."}

TTLs are enforced by ``SET ... EX``; there is no separate cleanup job.
"""
from __future__ import annotations

import hashlib
import json
import os
from typing import Optional

from redis import asyncio as aioredis

_redis_client: Optional[aioredis.Redis] = None


def _url() -> str:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        raise RuntimeError("REDIS_URL is required for auth_state")
    return url


def _client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(_url(), decode_responses=True)
    return _redis_client


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:32]


# ── Password reset codes ─────────────────────────────────────────────────────
# TTL must match the UX copy in the reset email ("expires in 15 minutes").
RESET_TTL_SECONDS = 15 * 60


def _reset_key(email: str) -> str:
    return f"authstate:reset:{_digest(email.strip().lower())}"


async def store_reset_code(email: str, hashed_code: str) -> None:
    payload = json.dumps({"hashed": hashed_code, "email": email.strip().lower()})
    await _client().set(_reset_key(email), payload, ex=RESET_TTL_SECONDS)


async def get_reset_code(email: str) -> Optional[dict]:
    raw = await _client().get(_reset_key(email))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        # Corrupt entry — treat as absent and drop it so the user can retry.
        await _client().delete(_reset_key(email))
        return None


async def consume_reset_code(email: str) -> None:
    await _client().delete(_reset_key(email))


# ── 2FA pending login tickets ────────────────────────────────────────────────
# TTL must match the login UX ("finish 2FA within 5 minutes"). Storing only
# the hash of the temp_token means even a full Redis compromise does not
# let an attacker complete a pending 2FA flow; they'd still need the
# original random token we returned to the caller.
PENDING_2FA_TTL_SECONDS = 5 * 60


def _pending2fa_key(temp_token: str) -> str:
    return f"authstate:pending2fa:{_digest(temp_token)}"


async def store_pending_2fa(temp_token: str, user_id: str) -> None:
    payload = json.dumps({"user_id": user_id})
    await _client().set(_pending2fa_key(temp_token), payload, ex=PENDING_2FA_TTL_SECONDS)


async def get_pending_2fa(temp_token: str) -> Optional[dict]:
    raw = await _client().get(_pending2fa_key(temp_token))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        await _client().delete(_pending2fa_key(temp_token))
        return None


async def consume_pending_2fa(temp_token: str) -> None:
    await _client().delete(_pending2fa_key(temp_token))
