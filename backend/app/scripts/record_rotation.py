"""CLI to mark a secret as rotated.

Usage::

    python -m app.scripts.record_rotation SECRET_KEY --by=yagya --notes="90d rotation"

The caller is responsible for actually rotating the secret in the
relevant dashboard (Railway / Atlas / Resend / etc.) BEFORE running
this command. The ledger records intent, not action — you can lie to
it. The mitigation is the matching ``check_secret_ages`` alert which
will scream again if the real underlying secret still works with the
old value.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.rotation_ledger import ROTATION_SCHEDULE, record_rotation

logger = logging.getLogger("pentaprotocol.rotation.cli")


async def _run(name: str, by: str | None, notes: str | None) -> None:
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not uri:
        logger.error("MONGO_URI is not set; cannot record rotation.")
        sys.exit(2)
    db_name = os.getenv("DATABASE_NAME", "pentaprotocol")
    client = AsyncIOMotorClient(uri)
    try:
        db = client[db_name]
        doc = await record_rotation(db, name=name, rotated_by=by, notes=notes)
        logger.info("Recorded rotation: %s", doc)
    finally:
        client.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Record a secret rotation in the ledger.")
    parser.add_argument(
        "name",
        help=f"Secret name. Known: {sorted(ROTATION_SCHEDULE)}",
    )
    parser.add_argument("--by", default=None, help="Actor id / email for the audit.")
    parser.add_argument("--notes", default=None, help="Free-form note for context.")
    args = parser.parse_args()
    asyncio.run(_run(args.name, args.by, args.notes))


if __name__ == "__main__":
    main()
