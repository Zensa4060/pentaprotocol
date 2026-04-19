"""Phase 3 — in-game economy anomaly detection.

Why
===

Payment integrity (``payments`` collection idempotency, webhook
signature verification, nightly reconciliation) protects the
money-in side. This module protects the **value-out** side: the
currencies and XP that accrue *inside* the game from gameplay,
missions, and gifts.

Threat model
------------

1. **Sudden currency spikes.** A bug in a mission or an exploited
   endpoint credits 10× the intended amount. We want to notice
   within hours, not when the monthly economy report is run.

2. **Reward farming loops.** A scripted client rapidly finishes
   low-effort matches (e.g. against bots, or AFK opponents) to
   harvest XP / shards. The per-match cap already limits damage,
   but a 24-hour rolling view catches accounts that stay just under
   the per-match line forever.

3. **Multi-account funnelling.** One human runs N throwaway
   accounts, farms value on all of them, then gifts / trades it to
   a primary account. Even without a gifting feature today, we
   want the detection scaffolding in place so that when trading
   ships the signal is already there.

What this is NOT
----------------

This is a detection layer, not an enforcement gate. We log
``security_events`` and let the admin console / alerts drive
action. Enforcing a ceiling inside a match-end flow would risk
dropping real XP on a transient Mongo hiccup, which is a worse
bug than occasional late-noticed abuse.

Collection
----------

``economy_events``:
    user_id        str (hex) — indexed
    at             datetime — TTL 90 days
    kind           str — one of KINDS below
    source         str — free-form label, e.g. "match_win", "upi"
    amount         int — positive for credits, negative for spends
    balance_after  int | null — best-effort snapshot after the inc
    ip_hash        str | null
    device_hash    str | null
    meta           dict — free-form context (room_code, package_id, ...)

Indexed on ``user_id`` + ``at`` and on ``ip_hash`` + ``at``. TTL on
``at`` drops anything older than 90 days.
"""
from __future__ import annotations

import hashlib
import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.core import security_audit as audit
from app.core.flags import flag

logger = logging.getLogger("pentaprotocol.economy")

# ── Kinds ─────────────────────────────────────────────────────────────────

KIND_PROTOCREDITS_PAID = "protocredits_paid"       # purchased
KIND_PROTOCREDITS_EARNED = "protocredits_earned"   # gift / mission / bug
KIND_PROTOCREDITS_SPENT = "protocredits_spent"
KIND_SHARDS_PAID = "shards_paid"
KIND_SHARDS_EARNED = "shards_earned"
KIND_SHARDS_SPENT = "shards_spent"
KIND_XP_EARNED = "xp_earned"

_EARNED_KINDS = {
    KIND_PROTOCREDITS_EARNED,
    KIND_SHARDS_EARNED,
    KIND_XP_EARNED,
}

# ── Ceilings (24h rolling, per user, for EARNED kinds only) ───────────────
#
# These are intentionally generous. A player grinding all day on a
# phone can plausibly hit 50k XP. We flag when they exceed these
# lines by >= 1.5x, which is effectively "no human plays that much
# unless something is broken".
#
# Values sanity-check against current in-game payouts
# (game.update_player, profile.py mission rewards):
#
#   XP_EARNED: ranked match ≈ 500–1200 XP; 50 matches = 25k–60k XP.
#              Flag at 100k.
#   SHARDS_EARNED: matches pay out ~50 each; missions can one-shot 10k.
#                  Flag at 30k.
#   PROTOCREDITS_EARNED: matches pay 0. Any earned > 0 is either a
#                        mission, a gift, or an exploit. Flag any
#                        single-day total > 0 with severity WARN so
#                        staff can verify it's a legit mission payout.

_DAILY_CEILING_FLAG_AT = {
    KIND_XP_EARNED: 100_000,
    KIND_SHARDS_EARNED: 30_000,
    KIND_PROTOCREDITS_EARNED: 1,  # any non-zero is worth a look
}

# Cross-account funnel: if ≥ N distinct user_ids receive earned
# value from the same ip_hash within 24h, that's suspicious.
_FUNNEL_ACCOUNTS_PER_IP_24H = 5
_FUNNEL_ACCOUNTS_PER_DEVICE_24H = 3


# ── Helpers ───────────────────────────────────────────────────────────────


def _hash(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    salt = (os.getenv("SECURITY_AUDIT_SALT") or "pentaprotocol-audit").encode()
    return hashlib.sha256(salt + value.encode()).hexdigest()[:32]


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ── Public API ────────────────────────────────────────────────────────────


async def record_award(
    db,
    *,
    user_id: str,
    kind: str,
    amount: int,
    source: str,
    balance_after: Optional[int] = None,
    ip: Optional[str] = None,
    device_fingerprint: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Record a currency/XP delta and run anomaly checks.

    Safe to await inline from a hot path — the analysis queries are
    lightweight (both indexed) and the function never raises in the
    normal path; worst case it logs and returns.

    ``amount`` should be positive for credits (earned / paid / spent)
    — the ``kind`` carries the direction. This keeps queries simple
    when we want to sum "earned shards today" without dealing with
    sign flips.
    """
    if not flag("FEATURE_ECONOMY_WATCH", default=True):
        return
    if amount <= 0:
        # Zero-amount events are not interesting; negative amounts are
        # always a bug in the caller.
        if amount < 0:
            logger.warning("economy.record_award: negative amount=%s kind=%s", amount, kind)
        return

    ip_hash = _hash(ip)
    device_hash = _hash(device_fingerprint)
    now = _now()

    doc = {
        "user_id": user_id,
        "at": now,
        "kind": kind,
        "source": source,
        "amount": int(amount),
        "balance_after": balance_after,
        "ip_hash": ip_hash,
        "device_hash": device_hash,
        "meta": meta or {},
    }

    try:
        await db.economy_events.insert_one(doc)
    except Exception:
        # Detection must never break the caller. Log and move on.
        logger.exception("economy.record_award insert failed user=%s kind=%s", user_id, kind)
        return

    # Only do analysis on EARNED kinds — paid kinds are governed by
    # the payment integrity pipeline, and spends are user-initiated
    # (and rate-limited at the route layer).
    if kind not in _EARNED_KINDS:
        return

    try:
        await _check_ceiling(db, user_id=user_id, kind=kind)
        await _check_funnel(db, user_id=user_id, ip_hash=ip_hash, device_hash=device_hash)
    except Exception:
        logger.exception("economy.analysis failed user=%s kind=%s", user_id, kind)


async def _check_ceiling(db, *, user_id: str, kind: str) -> None:
    ceiling = _DAILY_CEILING_FLAG_AT.get(kind)
    if ceiling is None:
        return
    since = _now() - timedelta(hours=24)

    agg = await db.economy_events.aggregate([
        {"$match": {"user_id": user_id, "kind": kind, "at": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "n": {"$sum": 1}}},
    ]).to_list(length=1)

    if not agg:
        return
    total = int(agg[0].get("total", 0))
    n = int(agg[0].get("n", 0))
    if total < ceiling:
        return

    # Dedup: don't fire a new alert every award. Look for an existing
    # ceiling alert for this user/kind in the last 12h.
    twelve_h = _now() - timedelta(hours=12)
    dup = await db.security_events.find_one({
        "event_type": "economy.ceiling_breach",
        "user_id": user_id,
        "at": {"$gte": twelve_h},
        "meta.kind": kind,
    })
    if dup:
        return

    audit.log_event(
        event_type=audit.EVENT_ECONOMY_CEILING,
        severity=audit.SEVERITY_WARN,
        user_id=user_id,
        meta={
            "kind": kind,
            "daily_total": total,
            "ceiling": ceiling,
            "events_24h": n,
        },
    )


async def _check_funnel(
    db,
    *,
    user_id: str,
    ip_hash: Optional[str],
    device_hash: Optional[str],
) -> None:
    """Detect same-IP / same-device funnelling of earned value."""
    since = _now() - timedelta(hours=24)

    for field, h, limit, label in (
        ("ip_hash", ip_hash, _FUNNEL_ACCOUNTS_PER_IP_24H, "ip"),
        ("device_hash", device_hash, _FUNNEL_ACCOUNTS_PER_DEVICE_24H, "device"),
    ):
        if not h:
            continue
        cursor = db.economy_events.aggregate([
            {"$match": {field: h, "kind": {"$in": list(_EARNED_KINDS)}, "at": {"$gte": since}}},
            {"$group": {"_id": "$user_id", "total": {"$sum": "$amount"}}},
            {"$sort": {"total": -1}},
            {"$limit": limit + 5},
        ])
        docs = await cursor.to_list(length=limit + 5)
        unique_users = {str(d["_id"]) for d in docs if d.get("_id")}
        if len(unique_users) < limit:
            continue

        # Dedup against a recent alert for the same bucket.
        six_h = _now() - timedelta(hours=6)
        dup = await db.security_events.find_one({
            "event_type": "economy.funnel_detected",
            "at": {"$gte": six_h},
            f"meta.{label}_hash": h,
        })
        if dup:
            continue

        audit.log_event(
            event_type=audit.EVENT_ECONOMY_FUNNEL,
            severity=audit.SEVERITY_ALERT,
            user_id=user_id,
            meta={
                "bucket": label,
                f"{label}_hash": h,
                "account_count_24h": len(unique_users),
                "sample_users": sorted(unique_users)[:10],
            },
        )


# ── Convenience wrappers ──────────────────────────────────────────────────


async def record_match_reward(
    db,
    *,
    user_id: str,
    xp: int,
    shards: int,
    room_code: Optional[str] = None,
    ip: Optional[str] = None,
) -> None:
    """One call per match winner/loser to keep the caller terse."""
    meta = {"room_code": room_code} if room_code else None
    if xp > 0:
        await record_award(
            db,
            user_id=user_id,
            kind=KIND_XP_EARNED,
            amount=xp,
            source="match",
            ip=ip,
            meta=meta,
        )
    if shards > 0:
        await record_award(
            db,
            user_id=user_id,
            kind=KIND_SHARDS_EARNED,
            amount=shards,
            source="match",
            ip=ip,
            meta=meta,
        )
