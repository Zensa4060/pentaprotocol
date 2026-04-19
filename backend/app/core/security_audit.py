"""Security event audit log.

Every security-relevant action gets a structured row in
``security_events``. The goal is forensics and alerting, not user
analytics — so we log sparingly and hash any PII that can identify
a real person (email, IP) before persistence.

Why a dedicated collection (and not just stdout logs):

* Railway / Vercel stdout logs are volatile and size-limited. We'd
  lose the audit trail on a redeploy or when the log window rotates.
* Security work frequently needs to *query* history ("show me every
  failed login for this account in the last 24h", "did this IP ever
  succeed on a different account?"). That's a database job.
* A single Mongo collection with a TTL index keeps retention bounded
  (90 days) which matches what the Privacy Policy promises.

Schema:
    _id        auto
    event_type str   - see EVENT_* constants below
    severity   str   - "info" | "warn" | "alert"
    at         datetime (utc, indexed via TTL)
    user_id    str | None  - actor when known (raw; we already control the namespace)
    ip_hash    str | None  - sha256(ip)[:24] — never raw IP
    email_hash str | None  - sha256(lower(email))[:24] — never raw email
    meta       dict   - free-form, small; MUST NOT contain raw secrets

We *intentionally* never log passwords, OTP codes, TOTP secrets,
access tokens, device tokens, or raw payment identifiers. The caller
is responsible for respecting this contract.
"""
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime
from typing import Any, Optional

from pymongo import ASCENDING, DESCENDING

from app.core.database import get_db


# ── Event type constants ─────────────────────────────────────────────────────
EVENT_LOGIN_SUCCESS        = "login.success"
EVENT_LOGIN_FAIL           = "login.fail"
EVENT_LOGIN_2FA_FAIL       = "login.2fa.fail"
EVENT_PASSWORD_RESET_REQ   = "password.reset.request"
EVENT_PASSWORD_RESET_OK    = "password.reset.success"
EVENT_PASSWORD_RESET_FAIL  = "password.reset.fail"
EVENT_PASSWORD_CHANGE      = "password.change"
EVENT_EMAIL_CHANGE         = "email.change"
EVENT_REGISTER             = "register"
EVENT_GOOGLE_LINK          = "google.link"
EVENT_ACCOUNT_DELETE       = "account.delete"
EVENT_TWOFA_ENABLED        = "2fa.enabled"
EVENT_TWOFA_DISABLED       = "2fa.disabled"
EVENT_LEGAL_ACCEPTED       = "legal.accepted"
EVENT_ANTICHEAT_FLAG       = "anticheat.flag"
EVENT_RATE_LIMIT_TRIP      = "ratelimit.trip"
EVENT_WS_REJECT            = "ws.reject"
EVENT_PAYMENT_START        = "payment.start"
EVENT_PAYMENT_SUCCESS      = "payment.success"
EVENT_PAYMENT_FAIL         = "payment.fail"
EVENT_PAYMENT_REPLAY       = "payment.replay_blocked"
EVENT_ECONOMY_CEILING      = "economy.ceiling_breach"
EVENT_ECONOMY_FUNNEL       = "economy.funnel_detected"
EVENT_SECRET_STALE         = "secret.rotation_overdue"

SEVERITY_INFO  = "info"
SEVERITY_WARN  = "warn"
SEVERITY_ALERT = "alert"


# 90 days matches the Privacy Policy retention commitment. Anything older
# is low-signal for investigations and high-risk for long-term PII bloat.
RETENTION_SECONDS = 90 * 24 * 60 * 60


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:24]


def hash_ip(ip: Optional[str]) -> Optional[str]:
    if not ip:
        return None
    return _hash(ip.strip())


def hash_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    return _hash(email.strip().lower())


async def ensure_indexes() -> None:
    """Called during app startup from database.ensure_indexes via a fire-
    and-forget helper. Safe to call multiple times (create_index is idempotent)."""
    db = get_db()
    if db is None:
        return
    try:
        await db.security_events.create_index(
            [("at", ASCENDING)],
            expireAfterSeconds=RETENTION_SECONDS,
            background=True,
        )
        await db.security_events.create_index(
            [("event_type", ASCENDING), ("at", DESCENDING)], background=True
        )
        await db.security_events.create_index(
            [("user_id", ASCENDING), ("at", DESCENDING)], background=True
        )
        await db.security_events.create_index(
            [("ip_hash", ASCENDING), ("at", DESCENDING)], background=True
        )
    except Exception as e:
        # Never raise from an index setup path — auditing stays advisory.
        import logging
        logging.getLogger("pentaprotocol.audit").warning(
            "security_events index ensure warning: %s", e,
        )


async def _write(doc: dict) -> None:
    db = get_db()
    if db is None:
        return
    try:
        await db.security_events.insert_one(doc)
    except Exception:
        # Logging must never break the request it's logging about.
        return


def log_event(
    *,
    event_type: str,
    severity: str = SEVERITY_INFO,
    user_id: Optional[str] = None,
    ip: Optional[str] = None,
    email: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    """Fire-and-forget audit write.

    This function is synchronous on purpose: callers invoke it from both
    sync and async code paths, and we never want an ``await`` on the
    happy path of e.g. a login handler. The actual Mongo write is
    scheduled on the running loop and never awaited by the caller.
    """
    # Strip any obviously-dangerous meta keys defensively. Callers
    # shouldn't pass these, but a typo here would be an unacceptable
    # security incident.
    safe_meta: dict[str, Any] = {}
    if meta:
        for k, v in meta.items():
            kl = k.lower()
            if any(bad in kl for bad in ("password", "secret", "token", "otp", "code")):
                continue
            safe_meta[k] = v

    doc = {
        "event_type": event_type,
        "severity":   severity,
        "at":         datetime.utcnow(),
        "user_id":    user_id,
        "ip_hash":    hash_ip(ip),
        "email_hash": hash_email(email),
        "meta":       safe_meta,
    }

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No loop — called from a sync script / shell. Skip silently;
        # security_events is a runtime concern, not a tooling one.
        return
    loop.create_task(_write(doc))

    # Phase 2.8 — push alert-severity events (and a curated warn subset)
    # through the Resend alerter. This is fire-and-forget; it dedups
    # and caps internally so a noisy caller cannot page ops into
    # muting the channel. Imported lazily to keep the audit log free
    # of any import dependency on the alerting plumbing.
    try:
        from app.core import alerting as _alerting  # noqa: WPS433
        _alerting.maybe_alert(doc)
    except Exception:
        # Alerting must never break the audit itself.
        return
