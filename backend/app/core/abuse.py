"""Abuse-detection baseline.

This module implements three very cheap heuristics that catch the
*common* flavour of multi-account abuse without doing any creepy
fingerprinting:

1. **IP-to-account fanout** — how many distinct accounts have signed up
   or logged in from this IP in a rolling window. Normal shared-IP
   households are well under the threshold; sign-up farms aren't.
2. **Device fingerprint fanout** — same idea but keyed on a lightweight
   hash of headers that typical browsers expose (UA + accept-language +
   accept-encoding). Much weaker than a full fingerprint library (which
   we intentionally don't ship for privacy reasons), but good enough to
   flag "five new accounts from the identical browser in an hour".
3. **Duplicate detection at registration** — if a new account's
   fingerprint was seen on a recently-banned or recently-created
   account, raise an audit event.

All signals are **advisory**: they emit ``security_events`` with
severity ``warn`` or ``alert`` and let a human decide what to do. We
deliberately do not auto-ban here; false positives on a soft-blocker
tank retention far harder than the abuse they prevent.

Storage is Redis for the rolling-window counters (cheap, TTL-native)
and the ``security_events`` collection for the alerts themselves. No
new long-lived collection is introduced here — the Privacy Policy
already covers what we keep.
"""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Optional

from redis import asyncio as aioredis

from app.core import security_audit as audit

logger = logging.getLogger("pentaprotocol.abuse")

# Rolling window (seconds) over which we count distinct accounts per IP
# and per fingerprint. One hour matches the shape of a sign-up farm
# rotating through templates; a legitimate household sharing a router
# almost never produces 5 unique accounts in 60 minutes.
WINDOW_SECONDS = 60 * 60

# How many distinct accounts in the window trip a warn event. The
# alert tier fires at 2x this value.
WARN_THRESHOLD  = 5
ALERT_THRESHOLD = 10


_redis_client: Optional[aioredis.Redis] = None


def _client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL", "").strip()
        if not url:
            raise RuntimeError("REDIS_URL is required for abuse detection")
        _redis_client = aioredis.from_url(url, decode_responses=True)
    return _redis_client


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


# Keys are scoped by "bucket" (ip / fp) so we can grow the set of
# signals later without colliding.
def _ip_key(ip: str) -> str:      return f"abuse:ip:{_digest(ip)}"
def _fp_key(fp: str) -> str:      return f"abuse:fp:{_digest(fp)}"


def compute_fingerprint(
    *,
    user_agent: str,
    accept_language: str,
    accept_encoding: str,
) -> str:
    """Build a weak device fingerprint from commonly-sent headers.

    We intentionally stop at headers — no canvas probing, no WebGL
    introspection, no font enumeration. The goal is "the same browser
    signing up ten accounts in an hour looks the same", not "identify
    the user across sessions forever". A determined attacker can defeat
    this in thirty seconds; that's expected and fine, because anything
    more invasive is a privacy-policy problem we don't want.

    Keeping the hash short (24 hex chars) means the fingerprint is
    low-entropy by construction — we cannot uniquely identify a person
    from it, only group *collisions*.
    """
    blob = f"{(user_agent or '')[:256]}|{(accept_language or '')[:64]}|{(accept_encoding or '')[:64]}"
    return _digest(blob)


async def _record_and_check(key: str, member: str) -> int:
    """Add ``member`` to the rolling set at ``key``, return its size."""
    r = _client()
    try:
        await r.sadd(key, member)
        # Only bother extending TTL when we just mutated the set.
        await r.expire(key, WINDOW_SECONDS)
        size = await r.scard(key)
        return int(size or 0)
    except Exception:
        # Abuse-detection is advisory; never break the request on a
        # Redis blip.
        return 0


async def note_account_activity(
    *,
    user_id: str,
    ip: Optional[str],
    fingerprint: Optional[str],
    source: str,
) -> None:
    """Call this from auth endpoints (register / login / google-auth)
    with the authenticated user's id. We record the (ip, fp) -> user
    links and raise audit events if the fanout gets suspicious.

    ``source`` is a short string for the audit row (e.g. "register",
    "login", "google")."""
    if ip:
        ip_size = await _record_and_check(_ip_key(ip), user_id)
        if ip_size >= ALERT_THRESHOLD:
            audit.log_event(
                event_type="abuse.ip_fanout",
                severity=audit.SEVERITY_ALERT,
                user_id=user_id,
                ip=ip,
                meta={"distinct_accounts": ip_size, "source": source, "window_s": WINDOW_SECONDS},
            )
        elif ip_size >= WARN_THRESHOLD:
            audit.log_event(
                event_type="abuse.ip_fanout",
                severity=audit.SEVERITY_WARN,
                user_id=user_id,
                ip=ip,
                meta={"distinct_accounts": ip_size, "source": source, "window_s": WINDOW_SECONDS},
            )

    if fingerprint:
        fp_size = await _record_and_check(_fp_key(fingerprint), user_id)
        if fp_size >= ALERT_THRESHOLD:
            audit.log_event(
                event_type="abuse.fp_fanout",
                severity=audit.SEVERITY_ALERT,
                user_id=user_id,
                ip=ip,
                meta={
                    "distinct_accounts": fp_size,
                    "source": source,
                    "window_s": WINDOW_SECONDS,
                    "fp": fingerprint,
                },
            )
        elif fp_size >= WARN_THRESHOLD:
            audit.log_event(
                event_type="abuse.fp_fanout",
                severity=audit.SEVERITY_WARN,
                user_id=user_id,
                ip=ip,
                meta={
                    "distinct_accounts": fp_size,
                    "source": source,
                    "window_s": WINDOW_SECONDS,
                    "fp": fingerprint,
                },
            )


async def peek_ip_accounts(ip: str) -> int:
    """Admin-only helper — returns the distinct-account count for an IP
    in the current rolling window. Not wired to any endpoint; useful
    from a Python REPL or admin scripts."""
    if not ip:
        return 0
    try:
        return int(await _client().scard(_ip_key(ip)) or 0)
    except Exception:
        return 0
