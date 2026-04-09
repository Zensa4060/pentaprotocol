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
            raise HTTPException(
                status_code=429,
                detail=f"{detail} Retry in {max(1, int(ttl if ttl and ttl > 0 else window_seconds))} seconds.",
            )
    except HTTPException:
        raise
    except Exception:
        # Fail open on transient Redis issues to avoid auth-wide outage.
        return
