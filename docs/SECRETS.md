# PentaProtocol — Secrets & Rotation Policy

This doc is the source of truth for every credential PentaProtocol
depends on, where it lives, who can see it, how often it rotates, and
what to do when one leaks.

We intentionally do **not** use a third-party secrets manager (Vault,
Doppler, 1Password Secrets Automation) yet. At our scale those add a
runtime dependency that can fail closed and take us down. Instead we
rely on two first-party stores:

- **Railway environment variables** — backend secrets.
- **Vercel environment variables** — frontend secrets (only
  `NEXT_PUBLIC_*` values, which are public-by-design anyway).

An `.env.example` file in each app directory documents the *names* of
every secret; the real values live only in Railway / Vercel + a single
encrypted password-manager vault as offline backup.

---

## 1. Secret inventory

| Key                        | Location              | Audience       | Rotation  | Sensitivity |
|----------------------------|-----------------------|----------------|-----------|-------------|
| `SECRET_KEY`               | Railway               | backend only   | 90 days   | Critical    |
| `MONGO_URI`                | Railway               | backend only   | 180 days  | Critical    |
| `REDIS_URL`                | Railway               | backend only   | 180 days  | High        |
| `ADMIN_USER_IDS`           | Railway               | backend only   | on staff change | Low |
| `RESEND_API_KEY`           | Railway               | backend only   | 180 days  | High        |
| `OTP_GMAIL_APP_PASSWORD`   | Railway               | backend only   | 90 days   | High        |
| `GOOGLE_CLIENT_ID`         | Railway + Vercel      | both           | on compromise only | Low |
| `GOOGLE_CLIENT_SECRET`     | Railway               | backend only   | 180 days  | High        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel           | browser        | on compromise only | Low |
| UPI / bank QR image        | Frontend asset + posted QR | players  | on bank change | Medium |
| Atlas DB user password     | Atlas UI              | backend only   | 180 days  | Critical    |
| Atlas root password        | Personal pw manager   | founders only  | 90 days   | Critical    |
| Railway account password   | Personal pw manager   | founders only  | 180 days  | Critical    |
| Vercel account password    | Personal pw manager   | founders only  | 180 days  | Critical    |
| Cloudflare account         | Personal pw manager   | founders only  | 180 days  | Critical    |

PentaProtocol does not integrate with third-party payment gateways.
The sole payment path is the operator-verified UPI / bank-QR flow,
so the only "payment secret" is the bank-account QR image itself —
rotate it only if the receiving account changes.

---

## 2. Routine rotation procedure (per secret)

The same five-step pattern applies to every rotating secret:

1. **Generate the new value** on the provider's dashboard (Resend,
   Atlas, Google, etc). For `SECRET_KEY`:
   ```bash
   python -c "import secrets; print(secrets.token_hex(48))"
   ```
2. **Add it as a new env var** in Railway *alongside* the old one
   (e.g. `SECRET_KEY_NEXT`). Do not remove the old one yet.
3. **Deploy** and verify via the smoke test (`docs/OPS.md` §5).
4. **Swap** the primary env var (`SECRET_KEY`) to the new value and
   redeploy. Confirm smoke test. Invalidate all active sessions if the
   secret is a JWT signing key.
5. **Revoke** the old value at the provider (or delete `SECRET_KEY_NEXT`
   from Railway). Record the rotation date in the founder vault note
   titled "PentaProtocol — Secret Rotation Log".

Rotation frequencies in the inventory table above are *maximums*. A
secret rotates immediately if any of the following is true:

- A contributor with access leaves the team.
- A laptop with access is lost or stolen.
- The secret appears in any log, screenshot, git history, or
  third-party support ticket.
- The provider reports a breach affecting our tier.

---

## 3. Emergency compromise response

Assume "compromised" = a secret is visible to someone outside the
founder set.

### If `SECRET_KEY` (JWT signing) is compromised

1. Rotate as above **in under one hour**.
2. After the swap, every existing JWT is void. Users must log in again.
   This is the intended behaviour.
3. Audit `security_events` for `login_success` events from the
   compromise window; flag any unusual IP/fingerprint pairs.

### If the UPI receiving account / QR image is compromised

1. Contact the bank to freeze the account if someone has gained
   unauthorised access.
2. Take down the old QR image from the frontend (`public/`) and
   deploy a placeholder "payments temporarily paused" state.
3. Pull the last 24 h of `security_events` filtered on
   `payment.*`. Cross-reference with the bank's transaction export.
   Any UPI submission that doesn't match a legitimate settlement on
   the bank side is suspect.
4. Create a new account or provision a fresh QR, update the asset,
   re-enable submissions.

### If `MONGO_URI` (DB credentials) is compromised

1. In Atlas, immediately change the password of the DB user in the URI.
2. Railway → update `MONGO_URI` → redeploy.
3. Atlas → Network Access → restrict to Railway's egress IPs if not
   already. (A leaked URI with an open IP allowlist is a wide-open
   door.)
4. Review Atlas audit logs for the past 24 h.

### If Redis is compromised

1. If `REDIS_URL` contains credentials, rotate the Redis password and
   update Railway.
2. `FLUSHDB` — everything in Redis is recoverable. Better to wipe than
   to let an attacker read OTPs or 2FA tokens.
3. If the provider allows, rotate the Redis instance entirely.

### If a personal dev laptop is compromised

1. Assume **every** secret the developer had access to is burned.
2. Revoke their Railway / Vercel / Atlas / Cloudflare access.
3. Rotate the secrets in §1 rows they had access to, in this order:
   JWT signing → DB → payments → email → OAuth.

---

## 4. Audit trail

### 4.1 Rotation ledger (automated)

Every rotation MUST be recorded in the `secrets_ledger` Mongo
collection immediately after the rotation completes. The canonical
way to do this is:

```bash
python -m app.scripts.record_rotation SECRET_KEY --by=yagya --notes="quarterly"
```

The script upserts a row keyed on secret name containing:

- `rotated_at` (UTC)
- `rotated_by` (operator)
- `cadence_days` (copied from `rotation_ledger.ROTATION_SCHEDULE`)
- `sensitivity`
- `notes`

A daily Railway cron job runs
`python -m app.scripts.check_secret_ages` and fires a
`security.rotation_overdue` alert for any secret whose age exceeds
its cadence (or which has never been recorded). Severity is
`alert` when a critical secret is stale, `warn` otherwise. Because
the alert pipeline includes `security.rotation_overdue` on its
WARN allowlist, the staff distribution list sees these at the
latest the next morning.

The ledger is **intent**, not enforcement — an operator can lie to
it. Mitigations:

- The old credential genuinely works until revoked at the source
  (Railway / provider dashboard). If someone marks rotation in the
  ledger without actually rotating, the follow-up "credential was
  still live after you claimed to rotate it" incident will expose
  the fiction.
- Daily staleness alerts restart the countdown on inaction.

### 4.2 Founder vault note (manual backstop)

The founder vault note "PentaProtocol — Secret Rotation Log"
duplicates the ledger rows for critical secrets, in case the Mongo
ledger is ever lost (it has 90-day `security_events` TTL
dependency; the ledger itself has no TTL). Record:

- date (UTC)
- key name
- reason (routine / compromise / personnel)
- operator (who ran the rotation)
- verification (smoke-test pass/fail, incident ticket if any)

### 4.3 Event log

`security_audit.py` persists all authentication-relevant events to
Mongo's `security_events` collection with a 90-day TTL. That is the
forensic backstop — if a rotation was triggered by an incident, the
corresponding audit rows should be archived out of the 90-day
window before TTL expiry (mongodump → long-term encrypted storage).

---

## 5. What we will NOT do

- Commit any real `.env` to git. Only `.env.example` is tracked.
- DM secrets on Discord / Telegram / email. Use the shared password
  manager or Railway's share link (expiring).
- Check in a "test" key that's the same as a prod key "just for now".
- Reuse the same JWT `SECRET_KEY` between staging and production.
