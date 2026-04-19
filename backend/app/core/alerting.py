"""Phase 2.8 — Resend-backed security alerting.

When a security event is logged at severity ``alert``, ops wants to know
*now*, not the next morning when they check the audit collection. This
module is the "now" path.

Design requirements:

1. **Non-blocking.** Auth / payment / WS handlers cannot pay a synchronous
   SMTP round-trip. Every send is scheduled on the running loop via
   ``asyncio.create_task`` and never awaited by the caller.
2. **Dedup + throttle.** One bad login storm can produce thousands of
   ``login.fail`` events — we must never page the founders thousands of
   times. A Redis-backed counter per (event_type, severity, user_bucket)
   with a 10-minute TTL collapses bursts into a single email that
   includes a count.
3. **Fail-safe.** If Resend / Redis are down, alerting silently falls
   back to a log line. Losing an alert must never break the request
   that produced the event.
4. **Cheap.** We only alert on ``alert`` severity (and optionally a
   curated subset of ``warn`` for events a human should eyeball, like
   ``payment.fail``). Info and the rest of warn stay in the audit log.

Contract with ``security_audit.log_event``:
    When ``severity == "alert"`` the auditor invokes
    ``alerting.maybe_alert(doc)`` synchronously. This function does not
    block — it schedules the send and returns.

Env vars (documented in ``backend/.env.example``):
    ALERT_EMAILS          comma-separated list of recipients
    ALERT_FROM_EMAIL      sender address (defaults to FROM_EMAIL)
    ALERT_THROTTLE_SECONDS  dedup window in seconds (default 600)
    ALERT_MAX_PER_HOUR    hard cap per event_type (default 6)
    FEATURE_ALERTING      "0" to disable the whole module
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
from datetime import datetime
from typing import Any

from redis import asyncio as aioredis

logger = logging.getLogger("pentaprotocol.alerting")

# ── Configuration ──────────────────────────────────────────────────────────
#
# All values are read lazily so a test-harness can monkey-patch env vars
# before the first alert fires.


def _recipients() -> list[str]:
    raw = (os.getenv("ALERT_EMAILS") or "").strip()
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip() and "@" in p]


def _from_email() -> str:
    return (
        os.getenv("ALERT_FROM_EMAIL")
        or os.getenv("FROM_EMAIL")
        or "noreply@pentaprotocol.com"
    )


def _throttle_seconds() -> int:
    try:
        return max(30, int(os.getenv("ALERT_THROTTLE_SECONDS", "600")))
    except ValueError:
        return 600


def _max_per_hour() -> int:
    try:
        return max(1, int(os.getenv("ALERT_MAX_PER_HOUR", "6")))
    except ValueError:
        return 6


def _enabled() -> bool:
    # Match the FEATURE_ convention used elsewhere; default ON so a
    # forgotten flag never silently disables alerting in production.
    raw = (os.getenv("FEATURE_ALERTING") or "1").strip().lower()
    return raw in ("1", "true", "yes", "on", "y", "t")


# ── Events we always alert on ──────────────────────────────────────────────
#
# Every ``alert`` severity event runs through ``maybe_alert`` by default,
# but we give ops the ability to opt a specific low-noise ``warn`` event
# into alerting too (e.g. payment.fail). Keep this set small — anything
# broader belongs in the burst detector script, not in the hot path.

WARN_ALERT_ALLOWLIST = {
    "payment.fail",
    "payment.replay_blocked",
    "economy.ceiling_breach",
    "secret.rotation_overdue",
}


# ── Redis plumbing ─────────────────────────────────────────────────────────

_redis: aioredis.Redis | None = None


def _client() -> aioredis.Redis | None:
    """Return a Redis client or None if REDIS_URL is missing. Alerting
    is advisory — no Redis means we fall back to "no dedup, always try
    to send", which is still better than failing silently."""
    global _redis
    if _redis is not None:
        return _redis
    url = (os.getenv("REDIS_URL") or "").strip()
    if not url:
        return None
    try:
        _redis = aioredis.from_url(url, decode_responses=True)
    except Exception:
        logger.warning("alerting: REDIS_URL present but aioredis init failed")
        _redis = None
    return _redis


# ── Dedup key ──────────────────────────────────────────────────────────────


def _bucket(doc: dict[str, Any]) -> str:
    """Compact, PII-free dedup bucket.

    Shape: ``<event_type>|<severity>|<user_bucket>|<ip_bucket>``
    where each component is either a 12-char sha256 slice (for PII)
    or a literal safe string. Keeps the burst detector robust against
    attacker IP rotation (same user_id buckets them together).
    """
    et = str(doc.get("event_type") or "unknown")
    sev = str(doc.get("severity") or "info")
    uid = str(doc.get("user_id") or "")
    iph = str(doc.get("ip_hash") or "")
    uid_b = hashlib.sha256(uid.encode()).hexdigest()[:12] if uid else "-"
    ip_b = iph[:12] if iph else "-"
    return f"{et}|{sev}|{uid_b}|{ip_b}"


# ── Resend send ────────────────────────────────────────────────────────────


async def _send_via_resend(subject: str, text: str) -> bool:
    to = _recipients()
    if not to:
        logger.info("alerting.send skipped: ALERT_EMAILS not configured")
        return False
    try:
        import resend  # Imported lazily — the otp router already pins the lib
    except ImportError:
        logger.warning("alerting.send skipped: resend package not installed")
        return False
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        logger.warning("alerting.send skipped: RESEND_API_KEY not configured")
        return False
    resend.api_key = api_key
    try:
        # Run the blocking SDK call off the event loop so we don't stall
        # every other coroutine on a slow TLS handshake.
        await asyncio.to_thread(
            resend.Emails.send,
            {
                "from":    _from_email(),
                "to":      to,
                "subject": subject,
                "text":    text,
            },
        )
        return True
    except Exception as e:
        logger.error("alerting.send failed via resend: %s", type(e).__name__)
        return False


# ── Formatters ─────────────────────────────────────────────────────────────


def _format_subject(doc: dict[str, Any], collapse_count: int) -> str:
    sev = str(doc.get("severity") or "info").upper()
    et = str(doc.get("event_type") or "event")
    if collapse_count > 1:
        return f"[PentaProtocol] {sev} x{collapse_count} — {et}"
    return f"[PentaProtocol] {sev} — {et}"


def _format_body(doc: dict[str, Any], collapse_count: int) -> str:
    when = doc.get("at") or datetime.utcnow()
    if isinstance(when, datetime):
        when = when.isoformat(timespec="seconds") + "Z"
    lines: list[str] = [
        f"Event:    {doc.get('event_type')}",
        f"Severity: {doc.get('severity')}",
        f"When:     {when}",
    ]
    if collapse_count > 1:
        lines.append(
            f"Count:    {collapse_count} occurrences of this bucket in the "
            f"last {_throttle_seconds() // 60} minute(s)"
        )
    if doc.get("user_id"):
        lines.append(f"User id:  {doc['user_id']}")
    if doc.get("ip_hash"):
        lines.append(f"IP hash:  {doc['ip_hash']}")
    if doc.get("email_hash"):
        lines.append(f"Email#:   {doc['email_hash']}")
    meta = doc.get("meta") or {}
    if isinstance(meta, dict) and meta:
        lines.append("")
        lines.append("Meta:")
        for k, v in sorted(meta.items()):
            # Trim giant values so a runaway meta field doesn't bloat
            # an alert email past reasonable inbox limits.
            sv = str(v)
            if len(sv) > 300:
                sv = sv[:300] + "…"
            lines.append(f"  {k}: {sv}")
    lines.append("")
    lines.append("Open the admin dashboard or Mongo security_events to investigate.")
    lines.append("Throttled: future instances of this same bucket are silenced")
    lines.append(
        f"for {_throttle_seconds() // 60} minute(s); the next email will "
        "include a rollup count."
    )
    return "\n".join(lines)


# ── Public entrypoint ──────────────────────────────────────────────────────


async def _process(doc: dict[str, Any]) -> None:
    sev = str(doc.get("severity") or "info")
    et = str(doc.get("event_type") or "")
    if sev != "alert" and et not in WARN_ALERT_ALLOWLIST:
        return

    client = _client()

    if client is not None:
        bucket = _bucket(doc)
        throttle_key = f"alert:throttle:{bucket}"
        hourly_key = f"alert:hourly:{et}"
        try:
            # Increment the throttle counter. We only email on the FIRST
            # hit in the window; subsequent hits are silently collapsed.
            # The burst-detector cron (below) is what rolls up large
            # cross-account patterns — this path is for single-bucket
            # noise suppression.
            count = await client.incr(throttle_key)
            if count == 1:
                await client.expire(throttle_key, _throttle_seconds())
            else:
                return

            # Hourly cap per event_type — prevents a pathological
            # regression (e.g. a broken detector firing on every
            # request) from spamming ops into muting us.
            hourly = await client.incr(hourly_key)
            if hourly == 1:
                await client.expire(hourly_key, 3600)
            if hourly > _max_per_hour():
                logger.warning(
                    "alerting.capped event_type=%s hourly=%d cap=%d",
                    et, hourly, _max_per_hour(),
                )
                return
        except Exception:
            # Redis went weird — fall through and send anyway. Better
            # a duplicate alert than a missed one.
            logger.exception("alerting: redis path failed, sending un-deduped")

    subject = _format_subject(doc, 1)
    body = _format_body(doc, 1)

    sent = await _send_via_resend(subject, body)
    if not sent:
        # Belt-and-braces: we always log the subject so ops can grep
        # Railway even when email is down.
        logger.warning("alerting.email_unsent subject=%r", subject)


def maybe_alert(doc: dict[str, Any]) -> None:
    """Fire-and-forget entry point called from ``security_audit.log_event``.

    Safe to call from sync code: if there is no running loop we skip
    silently (the background reconciliation scripts and CLI tooling
    path through this case).
    """
    if not _enabled():
        return
    sev = str(doc.get("severity") or "info")
    et = str(doc.get("event_type") or "")
    if sev != "alert" and et not in WARN_ALERT_ALLOWLIST:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(_process(doc))


# ── Burst detector (Phase 2.8 cron) ────────────────────────────────────────
#
# The online dedup above collapses a single bursting bucket into one
# email every 10 minutes. That's right for latency-sensitive events
# (admin.ban, anticheat.flag on a single user) but insufficient for
# broad cross-user patterns like "50 accounts hit login.fail from 12
# different IPs in 5 minutes — credential stuffing".
#
# The ``alert_burst_detector`` script (see
# ``backend/app/scripts/alert_burst_detector.py``) queries
# ``security_events`` on a schedule, aggregates by event_type over a
# short window, and sends a SINGLE summary email if any event_type
# crosses a configured count. It uses a separate Redis key namespace
# so it never collides with the online dedup above.


async def send_burst_summary(event_type: str, count: int, window_minutes: int,
                             sample: list[dict[str, Any]]) -> None:
    """Used by the burst detector cron. One email per burst — the
    hourly cap still applies."""
    client = _client()
    if client is not None:
        try:
            hourly_key = f"alert:burst:hourly:{event_type}"
            hourly = await client.incr(hourly_key)
            if hourly == 1:
                await client.expire(hourly_key, 3600)
            if hourly > _max_per_hour():
                logger.warning(
                    "burst alert capped event_type=%s hourly=%d", event_type, hourly,
                )
                return
        except Exception:
            pass

    subject = f"[PentaProtocol] BURST x{count} — {event_type}"
    lines = [
        f"Detected {count} occurrences of {event_type!r} in the last "
        f"{window_minutes} minute(s).",
        "",
        "Sample rows (most recent 5):",
    ]
    for row in (sample or [])[:5]:
        at = row.get("at")
        if isinstance(at, datetime):
            at = at.isoformat(timespec="seconds") + "Z"
        lines.append(
            f"  {at}  user={row.get('user_id') or '-'}  "
            f"ip#={row.get('ip_hash') or '-'}  meta={row.get('meta') or {}}"
        )
    lines.append("")
    lines.append("Query in Mongo for the full window:")
    lines.append(
        f"  db.security_events.find({{event_type:'{event_type}', "
        f"at:{{$gte: new Date(Date.now() - {window_minutes}*60*1000)}}}})"
    )
    await _send_via_resend(subject, "\n".join(lines))
