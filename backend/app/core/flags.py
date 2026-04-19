"""Lightweight feature flags.

We intentionally avoid a full flag platform (LaunchDarkly, Unleash, …)
at this scale — they'd be overkill and add a runtime dependency on an
external service during our hottest code paths. Instead, every risky
feature reads a plain environment variable and falls back to a safe
default. A deploy-and-go flip is a redeploy on Railway, which is fast
enough for everything we plan to toggle at beta launch.

Naming convention:
    FEATURE_<AREA>_<NAME>   -> bool     ("1"/"true"/"yes" == on)
    LIMIT_<AREA>_<NAME>     -> int      ("0" disables cleanly)

Any module that reads one of these flags must document a SAFE DEFAULT
for when the env var is missing. We never silently enable anything
that wasn't the previous production behaviour.
"""
from __future__ import annotations

import os
from functools import lru_cache


_TRUTHY = {"1", "true", "yes", "on", "y", "t"}


def _get(name: str, default: str = "") -> str:
    return (os.getenv(name, default) or default).strip()


@lru_cache(maxsize=None)
def flag(name: str, *, default: bool = False) -> bool:
    """Read a boolean flag. Cached per-process because flags should not
    flip mid-request; a redeploy is required to change them."""
    raw = _get(name)
    if not raw:
        return default
    return raw.lower() in _TRUTHY


@lru_cache(maxsize=None)
def int_flag(name: str, *, default: int) -> int:
    raw = _get(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# ── Canonical flag list ──────────────────────────────────────────────────────
# Callers should use these accessors (not raw os.getenv) so every flag is
# discoverable in one file and can be audited before launch.

def anticheat_enabled() -> bool:
    """Global kill switch for the Phase 1.11 anti-cheat heuristics.
    Default ON. Flip OFF via FEATURE_ANTICHEAT=0 if a false-positive
    flood is eating legitimate matches."""
    return flag("FEATURE_ANTICHEAT", default=True)


def anticheat_heuristics_enabled() -> bool:
    """Phase 2.6 post-match heuristics + shadow-ban policy. Default ON.
    Disabling stops writing anticheat_matches and freezes the
    anticheat_score, but does not roll back existing shadow bans —
    those require an explicit admin action."""
    return flag("FEATURE_ANTICHEAT_HEURISTICS", default=True)


def abuse_detect_enabled() -> bool:
    """Kill switch for abuse-detection fanout counters. Default ON.
    Disabling stops writing to Redis sets, so the audit events stop
    firing but no user is ever blocked."""
    return flag("FEATURE_ABUSE_DETECT", default=True)


def legal_gate_enabled() -> bool:
    """Server-side policy-version gate. Default ON. If a post-launch
    policy bump is found to have a bug that blocks legitimate users,
    flip this off with FEATURE_LEGAL_GATE=0 while fixing and re-bumping."""
    return flag("FEATURE_LEGAL_GATE", default=True)


def security_audit_enabled() -> bool:
    """Whether security_events writes are attempted. Default ON.
    Disabling is only useful during a Mongo outage — we'd rather drop
    the audit than fail the login."""
    return flag("FEATURE_SECURITY_AUDIT", default=True)


def alerting_enabled() -> bool:
    """Phase 2.8 Resend alerting. Default ON. Disabling stops outbound
    emails but still logs every intended alert via Python logging so
    ops can tail Railway during an incident."""
    return flag("FEATURE_ALERTING", default=True)


def economy_watch_enabled() -> bool:
    """Phase 3 economy anomaly detection. Default ON. Disabling stops
    writing to ``economy_events`` AND stops firing ceiling / funnel
    alerts. Use only if a detection bug is drowning ops in noise;
    prefer raising the specific threshold instead."""
    return flag("FEATURE_ECONOMY_WATCH", default=True)


def ws_frame_rate_limit() -> int:
    """Per-connection frame rate limit for the global-notify WS.
    Default 30 frames / 10s. Lower if we see an abuse spike."""
    return int_flag("LIMIT_WS_FRAMES_PER_10S", default=30)
