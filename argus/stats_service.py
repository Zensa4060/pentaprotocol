"""PentaProtocol live stats for Mythos via the Argus analytics API."""
from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Optional

import requests

DEFAULT_API_URL = "https://pentaprotocol-production.up.railway.app"
CACHE_TTL_SECONDS = 600
REQUEST_TIMEOUT = 20

_cache: Optional[dict[str, Any]] = None
_cache_at: float = 0.0


def _api_base_url() -> str:
    return (os.getenv("PENTAPROTOCOL_API_URL") or DEFAULT_API_URL).strip().rstrip("/")


def _stats_url() -> str:
    return f"{_api_base_url()}/api/argus/stats"


def get_pentaprotocol_stats(*, force: bool = False) -> Optional[dict[str, Any]]:
    """Fetch PentaProtocol stats JSON, cached for 10 minutes."""
    global _cache, _cache_at

    now = time.time()
    if not force and _cache is not None and (now - _cache_at) < CACHE_TTL_SECONDS:
        return _cache

    api_key = (os.getenv("ARGUS_API_KEY") or "").strip()
    if not api_key:
        print("Stats error: ARGUS_API_KEY is not set")
        return _cache

    try:
        response = requests.get(
            _stats_url(),
            headers={"X-Argus-Key": api_key},
            timeout=REQUEST_TIMEOUT,
        )
        if not response.ok:
            print(f"Stats error: HTTP {response.status_code} from {_stats_url()}")
            return _cache
        data = response.json()
        if not isinstance(data, dict):
            print("Stats error: unexpected response format")
            return _cache
        _cache = data
        _cache_at = now
        return _cache
    except requests.RequestException as exc:
        print(f"Stats error: {exc}")
        return _cache
    except ValueError as exc:
        print(f"Stats error: invalid JSON ({exc})")
        return _cache


def _format_generated_at(raw: Optional[str]) -> str:
    if not raw:
        return "unknown time"
    try:
        cleaned = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        return dt.astimezone().strftime("%Y-%m-%d %I:%M %p %Z")
    except ValueError:
        return raw


def format_pentaprotocol_stats(stats: Optional[dict[str, Any]]) -> str:
    """Turn stats JSON into readable text for the Mythos system prompt."""
    if not stats:
        return "[Project stats unavailable — API fetch failed or not configured.]"

    users = stats.get("users") or {}
    revenue = stats.get("revenue") or {}
    activity = stats.get("activity") or {}
    matches = activity.get("matches") or {}
    dau = activity.get("daily_active_users") or {}
    paid = revenue.get("paid_payments") or {}

    total_users = users.get("total", 0)
    new_week = users.get("new_last_7_days", 0)
    total_inr = paid.get("total_inr", 0)
    payment_count = paid.get("count", 0)
    matches_week = matches.get("matches_last_7_days", 0)
    unique_week = matches.get("unique_players_last_7_days", 0)
    dau_login = dau.get("by_login_events", 0)
    dau_match = dau.get("by_match_played", 0)
    when = _format_generated_at(stats.get("generated_at"))

    return (
        f"PentaProtocol Stats (as of {when}):\n"
        f"Users: {total_users} total, {new_week} new this week\n"
        f"Revenue: ₹{total_inr:,.0f} total, {payment_count} payments\n"
        f"Activity: {matches_week} matches this week, {unique_week} unique players\n"
        f"DAU: {dau_login} by login, {dau_match} by match today"
    )


def get_project_stats_text(*, force: bool = False) -> str:
    """Cached fetch + formatted stats block for the system prompt."""
    return format_pentaprotocol_stats(get_pentaprotocol_stats(force=force))
