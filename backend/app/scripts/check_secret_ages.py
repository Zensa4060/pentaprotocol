"""Phase 3 — daily scheduled job that reports overdue secret rotations.

Run as::

    python -m app.scripts.check_secret_ages

Fires one ``security.rotation_overdue`` event per overdue secret,
which the alerting pipeline will collapse and email to the staff
distribution list (``ALERT_EMAILS``).

Schedule recommendation (Railway cron):

    0 9 * * * python -m app.scripts.check_secret_ages

One run per day is enough — secrets don't suddenly go stale intraday.
Running in the morning gives the on-call person the whole working
day to act before the cadence SLA pressure builds.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from app.core import security_audit as audit
from app.core.rotation_ledger import list_overdue

logger = logging.getLogger("pentaprotocol.rotation.check")


async def _run(dry_run: bool) -> int:
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not uri:
        logger.error("MONGO_URI missing; aborting.")
        return 2
    db_name = os.getenv("DATABASE_NAME", "pentaprotocol")
    client = AsyncIOMotorClient(uri)
    try:
        db = client[db_name]
        overdue = await list_overdue(db)
        if not overdue:
            logger.info("All secrets within rotation cadence.")
            return 0

        # Severity scales with the worst sensitivity in the batch.
        worst = max(
            _sev_rank(row["sensitivity"]) for row in overdue
        )
        severity = audit.SEVERITY_ALERT if worst >= 3 else audit.SEVERITY_WARN

        for row in overdue:
            meta: dict[str, Any] = {
                "name": row["name"],
                "cadence_days": row["cadence_days"],
                "age_days": row["age_days"],
                "sensitivity": row["sensitivity"],
                "reason": row["reason"],
            }
            if dry_run:
                logger.warning("[dry-run] overdue: %s", meta)
                continue
            audit.log_event(
                event_type=audit.EVENT_SECRET_STALE,
                severity=severity,
                meta=meta,
            )

        logger.warning("Reported %d overdue secret(s).", len(overdue))
        return 1
    finally:
        client.close()


def _sev_rank(sev: str) -> int:
    return {"low": 0, "medium": 1, "high": 2, "critical": 3}.get(sev, 1)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    p = argparse.ArgumentParser(description="Check secret rotation ledger for overdue entries.")
    p.add_argument("--dry-run", action="store_true", help="Print overdue list without alerting.")
    args = p.parse_args()
    rc = asyncio.run(_run(dry_run=args.dry_run))
    raise SystemExit(rc)


if __name__ == "__main__":
    main()
