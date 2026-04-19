"""Phase 3 — secret rotation ledger.

The written procedure in ``docs/SECRETS.md`` describes *how* to
rotate. Humans forget to actually do it. This module records *when*
each secret last rotated, computes whether it's overdue against the
published cadence, and exposes a tiny CLI for ops to mark a rotation
as complete.

A scheduled job (``app.scripts.check_secret_ages``) reads this ledger
once a day and fires a ``security.rotation_overdue`` alert for every
secret past its cadence — so forgetting stops being silent.

Collection
----------

``secrets_ledger``:

    name        str (unique)   — matches the canonical name in SECRETS.md
    rotated_at  datetime       — last known rotation
    rotated_by  str | null     — actor id / email (free-form)
    cadence_days int
    sensitivity str           — "critical" | "high" | "medium" | "low"
    notes       str | null

We deliberately do NOT store the secret value itself here (that
would defeat the entire point of rotation).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Optional

logger = logging.getLogger("pentaprotocol.rotation")


# The canonical rotation schedule. Kept in code (not just in
# SECRETS.md) so the staleness checker has a single source of truth
# and won't drift from documentation. When updating a cadence here,
# update the markdown in the same PR.
ROTATION_SCHEDULE: dict[str, dict[str, Any]] = {
    "SECRET_KEY":             {"cadence_days": 90,  "sensitivity": "critical"},
    "MONGO_URI":              {"cadence_days": 180, "sensitivity": "critical"},
    "REDIS_URL":              {"cadence_days": 180, "sensitivity": "high"},
    "RESEND_API_KEY":         {"cadence_days": 180, "sensitivity": "high"},
    "OTP_GMAIL_APP_PASSWORD": {"cadence_days": 90,  "sensitivity": "high"},
    "GOOGLE_CLIENT_SECRET":   {"cadence_days": 180, "sensitivity": "high"},
    "UPI_BANK_QR_IMAGE":      {"cadence_days": 365, "sensitivity": "medium"},
    "ATLAS_DB_USER_PASSWORD": {"cadence_days": 180, "sensitivity": "critical"},
    "ATLAS_ROOT_PASSWORD":    {"cadence_days": 90,  "sensitivity": "critical"},
    "RAILWAY_ACCOUNT":        {"cadence_days": 180, "sensitivity": "critical"},
    "VERCEL_ACCOUNT":         {"cadence_days": 180, "sensitivity": "critical"},
    "CLOUDFLARE_ACCOUNT":     {"cadence_days": 180, "sensitivity": "critical"},
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def record_rotation(
    db,
    *,
    name: str,
    rotated_by: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Mark a secret as rotated now.

    Upserts ``secrets_ledger`` keyed by ``name``. Returns the updated
    row. Unknown names are allowed — they're stored with the
    sensitivity/cadence of "unknown" so operators can retroactively
    define new entries in code.
    """
    spec = ROTATION_SCHEDULE.get(name, {"cadence_days": 180, "sensitivity": "medium"})
    doc = {
        "name": name,
        "rotated_at": _now(),
        "rotated_by": rotated_by,
        "cadence_days": int(spec["cadence_days"]),
        "sensitivity": spec["sensitivity"],
        "notes": notes,
    }
    await db.secrets_ledger.update_one(
        {"name": name},
        {"$set": doc},
        upsert=True,
    )
    logger.info("rotation_ledger: recorded rotation of %s by=%s", name, rotated_by or "-")
    return doc


async def list_overdue(db, *, as_of: Optional[datetime] = None) -> list[dict[str, Any]]:
    """Return the full overdue list.

    A secret is overdue if:

      * it has no row in the ledger, OR
      * ``rotated_at + cadence_days < now``

    Missing rows are reported with ``rotated_at=None`` so the caller
    can differentiate "never rotated since we started tracking" from
    "rotated long ago, now stale".
    """
    now = as_of or _now()
    existing: dict[str, dict[str, Any]] = {}
    async for row in db.secrets_ledger.find({}):
        existing[row["name"]] = row

    overdue: list[dict[str, Any]] = []
    for name, spec in ROTATION_SCHEDULE.items():
        row = existing.get(name)
        cadence = int(spec["cadence_days"])
        if row is None:
            overdue.append({
                "name": name,
                "rotated_at": None,
                "cadence_days": cadence,
                "age_days": None,
                "sensitivity": spec["sensitivity"],
                "reason": "never_recorded",
            })
            continue
        rotated_at = row.get("rotated_at")
        if not isinstance(rotated_at, datetime):
            overdue.append({
                "name": name,
                "rotated_at": None,
                "cadence_days": cadence,
                "age_days": None,
                "sensitivity": spec["sensitivity"],
                "reason": "bad_ledger_row",
            })
            continue
        if rotated_at.tzinfo is None:
            # Motor returns naive UTC datetimes by default; treat as UTC.
            rotated_at = rotated_at.replace(tzinfo=timezone.utc)
        age_days = (now - rotated_at).days
        if age_days > cadence:
            overdue.append({
                "name": name,
                "rotated_at": rotated_at,
                "cadence_days": cadence,
                "age_days": age_days,
                "sensitivity": spec["sensitivity"],
                "reason": "past_cadence",
            })
    return overdue


def all_secret_names() -> Iterable[str]:
    return ROTATION_SCHEDULE.keys()
