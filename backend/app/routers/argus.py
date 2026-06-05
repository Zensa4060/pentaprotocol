"""Argus external analytics API.

Machine-to-machine stats for the Argus AI assistant. Protected by a
shared secret in the ``X-Argus-Key`` header (``ARGUS_API_KEY`` env).
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core import security_audit as audit
from app.core.database import get_db_dep
from app.routers.store import PACKAGES, SHARD_PACKAGES

logger = logging.getLogger("pentaprotocol.argus")

router = APIRouter()


def _package_price_inr(package_id: str, currency_type: str) -> Optional[float]:
    table = SHARD_PACKAGES if (currency_type or "").lower() == "shards" else PACKAGES
    pkg = table.get(package_id or "")
    if not pkg:
        return None
    return float(pkg["price"])


def _payment_amount_inr(doc: dict) -> Optional[float]:
    raw = doc.get("amount")
    if raw is not None:
        try:
            return float(raw)
        except (TypeError, ValueError):
            pass
    return _package_price_inr(
        str(doc.get("package_id") or ""),
        str(doc.get("currency_type") or "protocredits"),
    )


async def require_argus_key(
    x_argus_key: Optional[str] = Header(None, alias="X-Argus-Key"),
) -> None:
    expected = (os.getenv("ARGUS_API_KEY") or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Argus analytics not configured")
    provided = (x_argus_key or "").strip()
    if len(provided) != len(expected) or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")


async def _distinct_users_since(
    db,
    collection: str,
    time_field: str,
    since: datetime,
    *,
    extra_match: Optional[dict] = None,
) -> int:
    match: dict[str, Any] = {time_field: {"$gte": since}, "user_id": {"$exists": True, "$ne": None}}
    if extra_match:
        match.update(extra_match)
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$user_id"}},
        {"$count": "n"},
    ]
    rows = await db[collection].aggregate(pipeline).to_list(1)
    return int(rows[0]["n"]) if rows else 0


async def _signup_counts(db, since: datetime) -> int:
    return await db.users.count_documents({"created_at": {"$gte": since}})


async def _daily_signup_series(db, days: int = 7) -> list[dict]:
    start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    pipeline = [
        {"$match": {"created_at": {"$gte": start}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"},
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    rows = await db.users.aggregate(pipeline).to_list(days + 1)
    return [{"date": r["_id"], "signups": r["count"]} for r in rows]


async def _revenue_from_payments(db) -> dict:
    paid_cursor = db.payments.find({"status": "paid"})
    total_inr = 0.0
    known_inr = 0.0
    count = 0
    by_package: dict[str, dict] = {}
    by_currency: dict[str, dict] = {"protocredits": {"count": 0, "inr": 0.0}, "shards": {"count": 0, "inr": 0.0}}

    async for doc in paid_cursor:
        count += 1
        amt = _payment_amount_inr(doc)
        currency = str(doc.get("currency_type") or "protocredits").lower()
        package_id = str(doc.get("package_id") or "unknown")

        if currency not in by_currency:
            by_currency[currency] = {"count": 0, "inr": 0.0}
        by_currency[currency]["count"] += 1

        if amt is not None:
            total_inr += amt
            known_inr += amt
            by_currency[currency]["inr"] = round(by_currency[currency]["inr"] + amt, 2)

        bucket = by_package.setdefault(
            package_id,
            {"package_id": package_id, "currency_type": currency, "count": 0, "inr": 0.0},
        )
        bucket["count"] += 1
        if amt is not None:
            bucket["inr"] = round(bucket["inr"] + amt, 2)

    top_packages = sorted(by_package.values(), key=lambda x: x["inr"], reverse=True)[:10]

    return {
        "count": count,
        "total_inr": round(known_inr, 2),
        "inr_fully_known": count == 0 or known_inr > 0,
        "by_currency_type": by_currency,
        "top_packages": top_packages,
    }


async def _upi_payment_stats(db, since_7d: datetime, since_30d: datetime) -> dict:
    pending = await db.upi_payments.count_documents({"status": "pending"})
    paid = await db.upi_payments.count_documents({"status": "paid"})
    submitted_7d = await db.upi_payments.count_documents({"created_at": {"$gte": since_7d}})
    submitted_30d = await db.upi_payments.count_documents({"created_at": {"$gte": since_30d}})

    pending_inr = 0.0
    async for doc in db.upi_payments.find({"status": "pending"}, {"amount": 1}):
        try:
            pending_inr += float(doc.get("amount") or 0)
        except (TypeError, ValueError):
            pass

    by_status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}, "inr": {"$sum": {"$ifNull": ["$amount", 0]}}}},
    ]
    by_status_rows = await db.upi_payments.aggregate(by_status_pipeline).to_list(10)
    by_status = {
        str(r["_id"] or "unknown"): {"count": r["count"], "inr": round(float(r["inr"]), 2)}
        for r in by_status_rows
    }

    return {
        "pending_count": pending,
        "paid_count": paid,
        "submitted_last_7_days": submitted_7d,
        "submitted_last_30_days": submitted_30d,
        "pending_total_inr": round(pending_inr, 2),
        "by_status": by_status,
    }


async def _virtual_spending(db, since_30d: datetime) -> dict:
    spend_kinds = ["protocredits_spent", "shards_spent"]
    pipeline = [
        {"$match": {"at": {"$gte": since_30d}, "kind": {"$in": spend_kinds}}},
        {
            "$group": {
                "_id": {"kind": "$kind", "source": {"$ifNull": ["$source", "unknown"]}},
                "total": {"$sum": "$amount"},
                "transactions": {"$sum": 1},
            }
        },
        {"$sort": {"total": -1}},
        {"$limit": 15},
    ]
    rows = await db.economy_events.aggregate(pipeline).to_list(15)
    categories = [
        {
            "kind": r["_id"]["kind"],
            "source": r["_id"]["source"],
            "amount": int(r["total"]),
            "transactions": int(r["transactions"]),
        }
        for r in rows
    ]
    total_spent = sum(c["amount"] for c in categories)
    return {
        "available": len(categories) > 0,
        "period_days": 30,
        "total_virtual_spent": total_spent,
        "top_categories": categories,
        "note": (
            "In-game cosmetic purchases are not logged to economy_events yet; "
            "figures reflect only flows that call economy_watch.record_award."
            if not categories
            else None
        ),
    }


async def _match_engagement(db, since_7d: datetime, since_30d: datetime) -> dict:
    matches_7d = await db.match_history.count_documents({"played_at": {"$gte": since_7d}})
    matches_30d = await db.match_history.count_documents({"played_at": {"$gte": since_30d}})
    active_players_7d = await _distinct_users_since(db, "match_history", "played_at", since_7d)
    active_players_30d = await _distinct_users_since(db, "match_history", "played_at", since_30d)
    return {
        "matches_last_7_days": matches_7d,
        "matches_last_30_days": matches_30d,
        "unique_players_last_7_days": active_players_7d,
        "unique_players_last_30_days": active_players_30d,
    }


@router.get("/stats")
async def argus_stats(
    _auth: None = Depends(require_argus_key),
    db=Depends(get_db_dep),
):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    since_7d = now - timedelta(days=7)
    since_30d = now - timedelta(days=30)

    total_users = await db.users.count_documents({})
    new_7d = await _signup_counts(db, since_7d)
    new_30d = await _signup_counts(db, since_30d)
    signup_series = await _daily_signup_series(db, days=7)

    dau_login = await _distinct_users_since(
        db,
        "security_events",
        "at",
        today_start,
        extra_match={"event_type": audit.EVENT_LOGIN_SUCCESS},
    )
    dau_match = await _distinct_users_since(db, "match_history", "played_at", today_start)
    wau_login = await _distinct_users_since(
        db,
        "security_events",
        "at",
        since_7d,
        extra_match={"event_type": audit.EVENT_LOGIN_SUCCESS},
    )
    mau_login = await _distinct_users_since(
        db,
        "security_events",
        "at",
        since_30d,
        extra_match={"event_type": audit.EVENT_LOGIN_SUCCESS},
    )

    revenue = await _revenue_from_payments(db)
    upi = await _upi_payment_stats(db, since_7d, since_30d)
    virtual_spending = await _virtual_spending(db, since_30d)
    matches = await _match_engagement(db, since_7d, since_30d)

    google_users = await db.users.count_documents({"google_id": {"$exists": True, "$ne": None}})
    totp_users = await db.users.count_documents({"totp_enabled": True})

    return {
        "generated_at": now.isoformat() + "Z",
        "users": {
            "total": total_users,
            "new_last_7_days": new_7d,
            "new_last_30_days": new_30d,
            "signups_by_day_last_7_days": signup_series,
            "google_sign_in": google_users,
            "two_factor_enabled": totp_users,
        },
        "activity": {
            "daily_active_users": {
                "by_login_events": dau_login,
                "by_match_played": dau_match,
                "date_utc": today_start.strftime("%Y-%m-%d"),
            },
            "weekly_active_users_by_login": wau_login,
            "monthly_active_users_by_login": mau_login,
            "matches": matches,
            "notes": [
                "No dedicated session or DAU collection exists.",
                "login.success events in security_events are retained 90 days (forensics, not product analytics).",
                "by_match_played counts users with at least one match_history row today.",
            ],
        },
        "revenue": {
            "paid_payments": revenue,
            "upi_submissions": upi,
            "currency": "INR",
            "notes": [
                "Legacy payments collection holds operator-verified paid rows.",
                "Current flow writes upi_payments as pending until ops credits manually.",
            ],
        },
        "expenses": {
            "available": False,
            "top_categories": [],
            "note": "No expense or cost-tracking collection exists in this codebase.",
        },
        "in_game_economy": {
            "virtual_spending_last_30_days": virtual_spending,
        },
        "data_availability": {
            "user_signups": True,
            "session_tracking": False,
            "last_login_on_user_doc": False,
            "dedicated_analytics_events": False,
            "real_money_revenue": True,
            "upi_pending_queue": True,
            "expense_tracking": False,
            "in_game_purchase_ledger": False,
            "economy_events_retention_days": 90,
            "security_events_retention_days": 90,
        },
    }
