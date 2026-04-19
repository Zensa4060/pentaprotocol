import hashlib
import os
from typing import Optional

from fastapi import HTTPException
from redis import asyncio as aioredis

_redis_client: Optional[aioredis.Redis] = None


def _redis_url() -> str:
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        raise RuntimeError("REDIS_URL is required for rate limiting")
    return url


def _client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(_redis_url(), decode_responses=True)
    return _redis_client


def _safe_part(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def build_rate_key(scope: str, ip: str, identifier: str = "") -> str:
    base = f"rl:{scope}:{_safe_part(ip or 'unknown')}"
    if identifier:
        base += f":{_safe_part(identifier.lower().strip())}"
    return base


def build_account_rate_key(scope: str, identifier: str) -> str:
    """Per-identifier key with NO IP component — used for per-account limits
    that survive IP rotation (VPN swaps, Tor, mobile carrier cycling)."""
    return f"rlacct:{scope}:{_safe_part(identifier.lower().strip())}"


# ── Tier policy ──────────────────────────────────────────────────────────────
# Single source of truth for rate-limit shapes. Every endpoint picks a tier
# so we never scatter magic numbers across routers again.

# 5 attempts per 60 seconds. Used for "fast human action" flows: login,
# 2FA verify, OTP send / verify, register. Designed so a real human typing
# the wrong password a few times is never blocked, but brute-force attempts
# get throttled after the fifth try.
TIER_FAST = {"max_attempts": 5, "window_seconds": 60}

# 5 attempts per 15 minutes. Used for "destructive" flows: password reset,
# account deletion, email change. A legitimate user rarely does any of these
# more than once every few minutes; attackers doing mass password-reset
# floods are the target profile here.
TIER_SENSITIVE = {"max_attempts": 5, "window_seconds": 15 * 60}

# 10 attempts per 60 seconds. For idempotent status / polling endpoints that
# we still want lightly rate-limited (e.g. forgot-password request).
TIER_POLL = {"max_attempts": 10, "window_seconds": 60}


async def enforce_rate_limit(
    *,
    key: str,
    max_attempts: int = 5,
    window_seconds: int = 15 * 60,
    detail: str = "Too many attempts. Please try again later.",
) -> None:
    try:
        r = _client()
        current = await r.incr(key)
        if current == 1:
            await r.expire(key, window_seconds)
        if current > max_attempts:
            ttl = await r.ttl(key)
            # Audit only the first few trips beyond the cap to avoid the
            # audit table becoming the DoS vector itself. Current=cap+1 is
            # the "just blocked" moment; anything beyond is signal-rich in
            # aggregate but noisy per row.
            if current <= max_attempts + 3:
                try:
                    # Lazy import — rate_limit is loaded early and cannot
                    # depend on audit at module import time (would cycle).
                    from app.core import security_audit as _audit
                    _audit.log_event(
                        event_type=_audit.EVENT_RATE_LIMIT_TRIP,
                        severity=_audit.SEVERITY_WARN,
                        meta={"key_prefix": key.split(":", 2)[:2], "count": int(current)},
                    )
                except Exception:
                    pass
            raise HTTPException(
                status_code=429,
                detail=f"{detail} Retry in {max(1, int(ttl if ttl and ttl > 0 else window_seconds))} seconds.",
            )
    except HTTPException:
        raise
    except Exception:
        # Fail open on transient Redis issues to avoid auth-wide outage.
        return


async def enforce_tier(
    *,
    scope: str,
    ip: str,
    identifier: str,
    tier: dict,
    detail: str = "Too many attempts. Please try again later.",
    per_account: bool = True,
) -> None:
    """Apply the (IP, identifier) rate limit AND, if `per_account`, apply
    an identifier-only companion counter at the same shape. This means an
    attacker rotating IPs still hits a single account's cap, while
    legitimate users on a shared corporate IP aren't punished for each
    other's typos."""
    # IP + identifier gate
    await enforce_rate_limit(
        key=build_rate_key(scope, ip, identifier),
        max_attempts=int(tier["max_attempts"]),
        window_seconds=int(tier["window_seconds"]),
        detail=detail,
    )
    # Identifier-only companion gate — tripled so a single legitimate user
    # rotating devices doesn't trip it, but mass IP rotation does.
    if per_account and identifier:
        await enforce_rate_limit(
            key=build_account_rate_key(scope, identifier),
            max_attempts=int(tier["max_attempts"]) * 3,
            window_seconds=int(tier["window_seconds"]),
            detail=detail,
        )
