"""Real-client-IP extraction with trusted-proxy discipline.

Why this exists
===============

Every rate limit, audit log, abuse counter, and WebSocket reconnect
throttle in this codebase is keyed on ``request.client.host``. When
the app runs behind Railway + Cloudflare, that value is the *Railway
edge IP* — the same handful of addresses for every request. Which
means:

* Five proxy IPs share a rate-limit bucket for **every user on Earth**.
  A single credential-stuffer burns everyone's quota in the first
  minute and legitimate logins start failing.
* Abuse fanout detection groups every user under the same IP hash.
  The detector becomes useless.
* Audit logs lie. "192.168.1.5 did 400 failed logins" says nothing
  about who actually did them.

Forwarded-header spoofing
=========================

We must NOT naively trust ``X-Forwarded-For`` — any direct internet
client can set that header to whatever they want. The rule is:

1. Compile a list of trusted proxy IPs / CIDRs (Cloudflare + Railway).
2. If the immediate peer (``request.client.host``) is in that list,
   we may honour the forwarding headers. Otherwise we ignore them.
3. Prefer ``CF-Connecting-IP`` (Cloudflare-only, single value, not a
   list). Fall back to ``True-Client-IP`` (Akamai-style), then to the
   leftmost entry of ``X-Forwarded-For``. All three are still only
   honoured when the immediate peer is trusted.

Configuration
=============

``TRUSTED_PROXY_CIDRS`` env var accepts a comma-separated list of
CIDRs or single IPs. Default includes the published Cloudflare
ranges (https://www.cloudflare.com/ips-v4/) so a default deploy on
Cloudflare + Railway works immediately. Railway's own proxy network
advertises ``10.0.0.0/8`` internally — acceptable because only
Cloudflare reaches Railway in our topology.

If an operator puts Cloudflare in front AND later disables it, the
env var must be rewritten to drop Cloudflare and restrict to the new
proxy — otherwise we'd be trusting spoofed headers. There is no safe
auto-detect for this; the operator owns the topology.
"""
from __future__ import annotations

import ipaddress
import logging
import os
from functools import lru_cache
from typing import Any, Optional

logger = logging.getLogger("pentaprotocol.client_ip")


# ── Default trusted ranges ────────────────────────────────────────────────
#
# Cloudflare publishes these at https://www.cloudflare.com/ips-v4/ .
# They rotate rarely (last change was 2023). When they do rotate,
# update this list in code AND in the env var so new deploys pick up
# the change without a config push.

_CLOUDFLARE_V4 = [
    "173.245.48.0/20",
    "103.21.244.0/22",
    "103.22.200.0/22",
    "103.31.4.0/22",
    "141.101.64.0/18",
    "108.162.192.0/18",
    "190.93.240.0/20",
    "188.114.96.0/20",
    "197.234.240.0/22",
    "198.41.128.0/17",
    "162.158.0.0/15",
    "104.16.0.0/13",
    "104.24.0.0/14",
    "172.64.0.0/13",
    "131.0.72.0/22",
]

_CLOUDFLARE_V6 = [
    "2400:cb00::/32",
    "2606:4700::/32",
    "2803:f800::/32",
    "2405:b500::/32",
    "2405:8100::/32",
    "2a06:98c0::/29",
    "2c0f:f248::/32",
]

# Railway-internal addressing. Safe default because an attacker on the
# public internet cannot reach these ranges; only Cloudflare (already
# trusted) can forward from here.
_RAILWAY_INTERNAL = [
    "10.0.0.0/8",
    "100.64.0.0/10",  # Railway uses CGNAT for inter-service links
]


@lru_cache(maxsize=1)
def _trusted_networks() -> list[ipaddress._BaseNetwork]:
    raw = (os.getenv("TRUSTED_PROXY_CIDRS") or "").strip()
    if raw:
        cidrs = [p.strip() for p in raw.split(",") if p.strip()]
    else:
        cidrs = _CLOUDFLARE_V4 + _CLOUDFLARE_V6 + _RAILWAY_INTERNAL
    nets: list[ipaddress._BaseNetwork] = []
    for c in cidrs:
        try:
            nets.append(ipaddress.ip_network(c, strict=False))
        except ValueError:
            logger.warning("client_ip: ignoring invalid trusted CIDR %r", c)
    return nets


def _is_trusted(ip_str: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    for net in _trusted_networks():
        if addr in net:
            return True
    return False


# ── Header parsing ────────────────────────────────────────────────────────


def _first_xff(value: str) -> Optional[str]:
    if not value:
        return None
    # XFF may be a comma-separated chain. The leftmost entry is the
    # original client as seen by the first proxy in the chain. We
    # already gated this on peer trust, so we can trust this value.
    first = value.split(",", 1)[0].strip()
    return first or None


def _valid_ip(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        return None


# ── Public API ────────────────────────────────────────────────────────────


def get_client_ip(request: Any) -> str:
    """Return the real client IP for a FastAPI / Starlette ``Request``.

    Order of preference, each only honoured if the immediate peer is
    within ``TRUSTED_PROXY_CIDRS``:

        1. ``CF-Connecting-IP`` (Cloudflare, authoritative)
        2. ``True-Client-IP`` (Akamai / Cloudflare Enterprise)
        3. Leftmost entry of ``X-Forwarded-For``

    Falls back to ``request.client.host`` (the peer itself) when none
    of the headers are usable, and finally to ``"unknown"``.

    Always returns a non-empty string. Callers can compare to
    ``"unknown"`` when they want to gate on resolvability.
    """
    peer = getattr(getattr(request, "client", None), "host", None) or ""
    headers = getattr(request, "headers", {}) or {}

    # Headers are case-insensitive in Starlette; ``.get`` works.
    if peer and _is_trusted(peer):
        for name in ("cf-connecting-ip", "true-client-ip"):
            v = _valid_ip(headers.get(name))
            if v:
                return v
        xff = headers.get("x-forwarded-for")
        v = _valid_ip(_first_xff(xff or ""))
        if v:
            return v

    # Peer was NOT trusted (or no headers present) — return the direct
    # peer so local development and unconfigured deployments keep
    # working. Never trust forwarded headers from an untrusted peer.
    return peer or "unknown"


def request_fingerprint_ip_bucket(request: Any) -> str:
    """Short alias used by callers that already have a request object.

    Kept separate from ``get_client_ip`` so a future rollout can diverge
    (e.g. add ASN-based bucketing) without touching every call site.
    """
    return get_client_ip(request)
