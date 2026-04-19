# PentaProtocol — Operations Runbook

This doc is the playbook for the on-call during beta launch. Keep it short,
keep it current. If something here is wrong after an incident, fix it in the
same PR as the bugfix.

---

## 1. Backups

### MongoDB (primary datastore)

**Automated:** MongoDB Atlas continuous backups must be enabled on the
production cluster. Settings:

- **Snapshot cadence:** every 6 hours
- **Retention:** 7 daily + 4 weekly
- **Point-in-time restore window:** 24 hours (minimum)

Verify monthly by opening Atlas → Backup → Snapshots and confirming the
most recent snapshot is < 6 h old.

**Manual (before a risky migration):** from a trusted laptop:

```bash
mongodump --uri "$MONGO_URI" --out "./dumps/$(date +%F-%H%M)"
```

Store the tarball in the personal encrypted drive, not in git. Delete
after the migration is confirmed stable (≥ 7 days).

### Redis (ephemeral)

Redis holds rate-limit counters, OTP codes, pending 2FA tickets, abuse
fanout sets. **We deliberately do not back this up** — everything there
is by design recoverable or short-lived. If Redis is wiped:

- Users mid-OTP / mid-2FA must restart the flow. Safe.
- Rate-limit counters reset. Safe (worst case: a burst gets a free pass
  for 60 seconds).
- Abuse fanout sets reset. Safe (we'll re-detect within the hour).

### Secrets

See `docs/SECRETS.md`.

---

## 2. Rollback procedure

### Backend (Railway)

1. Railway dashboard → service → **Deployments** tab.
2. Find the last deploy whose commit SHA matches a known-good release
   (check `#launch` channel or the `main` branch tag).
3. Click the three-dot menu → **Redeploy**.
4. Wait for health check `/api/health` to return 200.
5. Verify in a private browser tab that login + a single matchmaking
   round works.

**Target time from "abort decision" to "previous build live": < 5 min.**

If a migration changed the Mongo schema in a non-backward-compatible
way, the rollback requires a Mongo restore too — see §3.

### Frontend (Vercel)

1. Vercel dashboard → project → **Deployments**.
2. Filter to `Production` environment.
3. On the last known-good deployment, click **Promote to Production**.

Target time: < 2 min. Vercel handles this atomically; no data migration
concerns.

---

## 3. Mongo restore

Only needed if a migration corrupted data or a destructive query ran.

1. Atlas → Backup → Snapshots → pick the last good snapshot.
2. **Restore to a new cluster** (never overwrite production in-place on
   the first try). Name it `pentaprotocol-restore-YYYYMMDD`.
3. Point a staging backend at the restored cluster and run the smoke
   test (§5).
4. If the smoke test passes, either:
   - Flip `MONGO_URI` on the production backend to the restored cluster
     (fastest), then schedule a clean re-migration to a named prod
     cluster during low-traffic hours; or
   - Atlas → Restore to existing cluster (overwrites) once you're
     confident.

---

## 4. Feature flags

All flags live in `backend/app/core/flags.py`. They are env-var driven,
so toggling one requires a redeploy — this is intentional (a redeploy
is fast, and it avoids a remote-config service becoming a SPOF).

Flags you'll actually use during an incident:

| Env var                    | Default | What it does                                    |
|----------------------------|---------|-------------------------------------------------|
| `FEATURE_ANTICHEAT`        | on      | Disable to stop anti-cheat suspicion counters.  |
| `FEATURE_ANTICHEAT_HEURISTICS` | on  | Freeze Phase 2.6 score bumps + shadow-ban flips. |
| `FEATURE_ABUSE_DETECT`     | on      | Disable to stop IP/fingerprint fanout writes.   |
| `FEATURE_LEGAL_GATE`       | on      | Emergency-bypass the server-side policy check.  |
| `FEATURE_SECURITY_AUDIT`   | on      | Disable if Mongo can't keep up with audit load. |
| `FEATURE_ALERTING`         | on      | Stop outbound alert emails (logs still emitted). |
| `FEATURE_ECONOMY_WATCH`    | on      | Disable economy anomaly detection + recording.   |
| `LIMIT_WS_FRAMES_PER_10S`  | 30      | Tighten if a WS-flood is detected.              |

After flipping a flag, redeploy and verify via the smoke test.

---

## 5. Smoke test

Before promoting a new backend build to production, and after any
rollback, run this end-to-end check. Keep it under 90 seconds.

1. **Health:** `GET /api/health` → 200, body `{"ok": true}`.
2. **Register → login:** register a throwaway account via the UI, log
   out, log back in. Should land on the lobby.
3. **Legal gate:** if a new policy version shipped, the gate appears on
   first login and goes away after acceptance.
4. **Matchmaking vs. bot:** start a 5×5 bot match, make 3 moves, resign.
   Rating should update; match history should show the game.
5. **Multiplayer:** in two private windows, queue and connect; play one
   move each; verify each side sees the opponent's ELO (not `?`).
6. **Payment (UPI):** `POST /api/store/upi-submit` with a valid JWT
   and a fake UTR. Should return the "submitted for verification"
   message, and the row should appear in `upi_payments` with
   `status: "pending"`. Delete the test row afterwards.
7. **Security audit:** Mongo → `security_events` collection, confirm at
   least one `login_success` document from step 2 within the last 5
   minutes.

If any step fails, **do not promote**. Open an incident, roll back.

---

## 6. Incident response quick-sheet

| Symptom                               | First action                                       |
|---------------------------------------|----------------------------------------------------|
| Auth endpoints 500ing                 | Check Redis reachability; fall-back auth_state.    |
| Mongo connection storms               | Scale Atlas tier +1, check for a runaway job.      |
| Flood of `login_fail` audit events    | Likely credential-stuffing; enable reCAPTCHA.      |
| Spike in `abuse.ip_fanout` audits     | One IP farming accounts; block at Cloudflare.      |
| Spike in `anticheat_flag` severity=4  | Investigate the specific match in room logs.       |
| Payment `replay` events > 5/min       | Immediately disable the gateway via feature flag.  |
| Bad deploy detected                   | Roll back (§2). Write post-mortem before re-try.   |

---

## 7. UPI / bank-QR payment ops

PentaProtocol uses only the operator-verified UPI / bank-QR flow.
No third-party gateway is integrated — which means there is nothing
to reconcile *against*; the bank's transaction ledger and our
`upi_payments` collection are the two sources of truth.

### Flow summary

1. User scans the posted bank QR in the store UI.
2. User pays with any UPI app.
3. User returns to the store and submits the bank UTR via
   `POST /api/store/upi-submit`. Row lands in `upi_payments` with
   `status: "pending"`.
4. Ops periodically (recommended: once an hour during active hours,
   once daily otherwise) exports the bank transaction log, matches
   UTRs, and credits users manually via the admin endpoints
   (Phase 2.7) or a one-off Mongo update.
5. On match, flip the `upi_payments` row's `status` to `"paid"` to
   mark the queue handled; any row with `status != "paid"` older
   than 7 days should be investigated or cancelled.

### Nothing to reconcile automatically

Because there is no gateway API to poll against, the reconciliation
script from earlier phases has been removed. The detection path for
fraud on the UPI flow is:

- `UPI_DUPLICATE_UTR` — enforced by a unique DB index; attacker
  can't reuse someone else's UTR to collect free credits.
- Amount mismatch — `/api/store/upi-submit` rejects a client-claimed
  amount that doesn't match the canonical package price (also
  logged as `payment.fail`).
- Economy ceiling / funnel (Phase 3) — if someone manages to credit
  themselves via the manual-approval path, the per-user 24h
  ceilings and same-IP funnel detector still fire.

### Investigating a disputed payment

```js
// In Mongo shell
db.upi_payments.find({utr: "<the UTR>"})
db.security_events.find({"meta.reference": "<the UTR>"}).sort({at: -1})
db.payments.find({user_id: "<user_id>"}).sort({created_at: -1}).limit(10)
```

If the UTR appears in the bank statement but not in `upi_payments`,
the user never actually submitted through the app — don't credit
without further evidence. If the UTR appears in `upi_payments` but
the user claims they never paid, check whether the row was
manually created by a staff error.

---

## 8. Security alerting (Phase 2.8)

### What triggers an email

Any `security_events` write at severity `alert` fires immediately.
A small allowlist of `warn` events (`payment.fail`,
`payment.replay_blocked`) also pages. Everything else stays in the
audit log only.

### How dedup works

For each `(event_type, severity, user_bucket, ip_bucket)` tuple we
send at most one email per `ALERT_THROTTLE_SECONDS` (default 10 min).
Everything else in that window is dropped silently. Per event_type
there is an additional hard cap of `ALERT_MAX_PER_HOUR` (default 6)
that applies across all buckets — this prevents a pathological
regression from flooding the inbox even if the dedup key is wrong.

### Burst detector cron (required)

Single-bucket dedup cannot see cross-account patterns. Schedule the
burst detector on Railway → **Cron**:

```
*/5 * * * *  python -m app.scripts.alert_burst_detector --window 5
```

It queries `security_events` for the last 5 minutes, aggregates per
event_type, and sends **one** rollup email if any event_type crosses
its threshold. Thresholds live in
`backend/app/scripts/alert_burst_detector.py` — tune after week 1.

### Required env

| Var                       | Required? | Purpose                                      |
|---------------------------|-----------|----------------------------------------------|
| `RESEND_API_KEY`          | yes       | Shared with OTP flow; one key is fine.       |
| `ALERT_EMAILS`            | yes       | Comma-separated recipient list.              |
| `ALERT_FROM_EMAIL`        | no        | Override sender. Defaults to `FROM_EMAIL`.   |
| `ALERT_THROTTLE_SECONDS`  | no        | Dedup window (default 600).                  |
| `ALERT_MAX_PER_HOUR`      | no        | Hourly cap per event_type (default 6).       |
| `FEATURE_ALERTING`        | no        | Set to `0` to disable the whole module.      |

### Testing the pipeline

From a backend shell (or via the admin denial path from curl):

```python
from app.core import security_audit as audit
audit.log_event(
    event_type="admin.access.denied",
    severity=audit.SEVERITY_ALERT,
    meta={"test": True},
)
```

Within ~10 seconds the `ALERT_EMAILS` recipients should receive one
message. Subsequent identical calls within `ALERT_THROTTLE_SECONDS`
are silent — that's the dedup working.

---

## 9. Edge (Cloudflare WAF + rate limiting)

See `docs/EDGE.md` for the full configuration that must be in place
before public launch:

* WAF rule blocking requests missing `CF-Connecting-IP` on
  `api.pentaprotocol.com` (origin protection).
* Per-IP rate limits on `/api/auth/*`, `/api/otp/*`, `/api/store/*`,
  and `/api/room/ws-ticket`.
* `TRUSTED_PROXY_CIDRS` env var set in Railway — defaults to
  Cloudflare + Railway internal ranges. MUST be updated if we ever
  switch off Cloudflare, otherwise the app will trust spoofed
  `X-Forwarded-For` headers from direct attackers.

Verify after any Cloudflare change using the three curl commands in
`docs/EDGE.md` §4.

---

## 10. Economy anomaly detection (Phase 3)

`backend/app/core/economy_watch.py` records every XP / shard /
protocredit delta to the `economy_events` collection and fires
`security_events` when:

* A single user exceeds a 24-hour rolling ceiling for earned value
  (`economy.ceiling_breach`, severity `warn`).
* Five distinct accounts receive earned value from the same IP
  hash (or three accounts from the same device fingerprint) within
  24 h (`economy.funnel_detected`, severity `alert`).

Neither event blocks a request — both are pure detection. Staff
investigate via the admin console (`GET /api/admin/events`).

**Investigation steps for a ceiling breach:**

1. Pull the user's recent `match_history` rows. Are they playing at
   superhuman pace?
2. Check `anticheat_matches` for the same user over the same window.
3. If both look clean, the ceiling may need raising in
   `_DAILY_CEILING_FLAG_AT`.

**Investigation steps for a funnel:**

1. `GET /api/admin/events?event_type=economy.funnel_detected` lists
   the sample user_ids.
2. Look for the common signals: registration time clustering,
   shared payment card, shared fingerprint.
3. If confirmed, use `/api/admin/users/{id}/ban` per account and
   open a review ticket.

Feature flag: `FEATURE_ECONOMY_WATCH=1` (on by default). Set to
`0` to disable; disables both recording and analysis.

---

## 11. Secret rotation automation (Phase 3)

Ledger lives in the `secrets_ledger` Mongo collection. Written
procedure is `docs/SECRETS.md`; this section covers the automation.

**Record a rotation:**

```bash
python -m app.scripts.record_rotation SECRET_KEY --by=yagya --notes="quarterly"
```

Canonical secret names are defined in
`backend/app/core/rotation_ledger.py::ROTATION_SCHEDULE`. Unknown
names are accepted but default to 180-day cadence.

**Daily staleness check (required cron):**

```
0 9 * * *  python -m app.scripts.check_secret_ages
```

Reads the ledger, compares to the cadence per secret, and emits
`security.rotation_overdue` events for anything past its window.
Those events are on the alerting allowlist, so staff get an email.

`--dry-run` prints the overdue list without alerting — useful when
introducing a new secret you haven't rotated yet.

---

## 12. Chaos drills

See `docs/CHAOS.md`. Four drills are defined (Redis outage, WS
flood, payment webhook replay, Mongo latency). Run on staging
before each public release and quarterly thereafter. Write results
to `docs/DRILLS.md`.

Required Railway cron summary:

| Schedule | Command | Purpose |
| --- | --- | --- |
| `*/5 * * * *` | `python -m app.scripts.alert_burst_detector --window 5` | Burst detection (Phase 2.8) |
| `0 9 * * *`   | `python -m app.scripts.check_secret_ages`              | Secret staleness (Phase 3) |
