"""Phase 2.8 — cross-account burst detector.

The online dedup in ``app.core.alerting`` is narrow on purpose: it
collapses a single ``(event_type, user_id, ip)`` bucket. That catches
one-user storms (a cheater's account racking up anticheat_flag entries)
but cannot see broad, low-per-account patterns.

Credential stuffing and ELO-farming rings look like this:

    login.fail   user=A ip=1   at=00:00
    login.fail   user=B ip=2   at=00:01
    login.fail   user=C ip=3   at=00:02
    ... 50 distinct (user, ip) tuples in 5 minutes ...

Each individual bucket is a single entry — the online dedup sees
nothing unusual. Only by aggregating across all buckets can we spot
the pattern.

This script is meant to run every ~5 minutes. For each configured
event_type it scans ``security_events`` over a short window and emits
a single rollup alert if the count crosses a threshold. One alert per
(event_type, run) — the hourly cap in ``alerting`` further prevents
runaway sends.

Run it::

    python -m app.scripts.alert_burst_detector --window 5

Suggested schedule (Railway cron)::

    # Every 5 minutes
    */5 * * * *  python -m app.scripts.alert_burst_detector --window 5
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from datetime import datetime, timedelta

from motor.motor_asyncio import AsyncIOMotorClient

from app.core import alerting

logger = logging.getLogger("pentaprotocol.burst_detector")

# ── What we watch for ──────────────────────────────────────────────────────
#
# These thresholds are launch-day generous. We deliberately pick numbers
# that will *never* fire on honest traffic at our current scale, so the
# first page is a real page. The ops team tunes these after the first
# week of real data.

# ``window`` is the default look-back in minutes (override with --window).
# Tuple is (event_type, threshold_per_window).
WATCH_EVENTS: list[tuple[str, int]] = [
    # Credential-stuffing / brute force.
    ("login.fail",                 30),
    ("login.2fa.fail",             10),
    # Password reset abuse.
    ("password.reset.request",     15),
    ("password.reset.fail",        10),
    # Payment anomalies that dedup can't see across users.
    ("payment.fail",               10),
    ("payment.replay_blocked",      5),
    # Anti-cheat & abuse.
    ("anticheat.flag",             25),
    ("abuse.ip_fanout",             5),
    ("abuse.fp_fanout",             5),
    # Admin surface probing.
    ("admin.access.denied",         5),
    # WebSocket handshake rejections (ticket abuse, JWT replay).
    ("ws.reject",                  30),
    # Reconciliation script escalations — a burst here means a gateway
    # is dropping webhooks on us.
    ("payment.reconcile.missing_row", 3),
]


async def _run(window_minutes: int, mongo_uri: str, db_name: str) -> None:
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    since = datetime.utcnow() - timedelta(minutes=int(window_minutes))

    summary: dict[str, int] = {}

    for event_type, threshold in WATCH_EVENTS:
        try:
            count = await db.security_events.count_documents(
                {"event_type": event_type, "at": {"$gte": since}}
            )
        except Exception as e:
            logger.exception("count failed for %s: %s", event_type, e)
            continue
        summary[event_type] = count
        if count < threshold:
            continue
        # Grab the 5 most recent sample rows for the email.
        sample: list[dict] = []
        async for row in (
            db.security_events
            .find({"event_type": event_type, "at": {"$gte": since}})
            .sort("at", -1)
            .limit(5)
        ):
            row.pop("_id", None)
            sample.append(row)
        try:
            await alerting.send_burst_summary(
                event_type=event_type,
                count=count,
                window_minutes=window_minutes,
                sample=sample,
            )
            logger.info(
                "burst alert sent event_type=%s count=%d threshold=%d",
                event_type, count, threshold,
            )
        except Exception:
            logger.exception(
                "burst alert SEND FAILED event_type=%s count=%d",
                event_type, count,
            )

    # Record a run heartbeat so ops can check "did the burst cron fire?"
    try:
        await db.security_events.insert_one({
            "event_type": "burst_detector.run",
            "severity":   "info",
            "at":         datetime.utcnow(),
            "meta": {
                "window_minutes": int(window_minutes),
                "counts":         summary,
            },
        })
    except Exception:
        pass


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
    parser = argparse.ArgumentParser(description="Alert burst detector.")
    parser.add_argument("--window", type=int, default=5,
                        help="Look-back window in minutes (default: 5)")
    args = parser.parse_args()

    mongo_uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not mongo_uri:
        raise SystemExit("MONGO_URI not set")
    db_name = os.getenv("DATABASE_NAME", "pentaprotocol")
    asyncio.run(_run(args.window, mongo_uri, db_name))


if __name__ == "__main__":
    main()
