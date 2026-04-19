# Chaos & resilience playbook

Phase 3.4 — a minimum-viable failure-injection plan.

The rest of the audit confirms the system is **secure**. This doc
confirms it is also **resilient** — that when one component flakes,
the rest degrades gracefully instead of cascading into an outage.

We run these drills on the staging environment before each
public-facing release and quarterly thereafter. They are NOT
destructive on prod.

---

## 1. Scope

We test three failure modes, because these are the three things that
have actually happened to us or to comparable systems:

1. **Redis is unreachable.** Upstash restart, network partition,
   credential rotation mishap.
2. **WebSocket flood.** A scripted client (or a popular streamer's
   audience) opens 5k connections within a minute.
3. **MongoDB slow / failover.** Atlas M0 → Flex migration, or a
   regional failover event during peak play.

For each mode we define: (a) how to inject the failure, (b) what
behaviour is acceptable, (c) what a failed drill looks like, (d)
the rollback / recovery step.

---

## 2. Failure mode: Redis down

### 2.1 Injection

Staging:

```bash
# From the Railway CLI, temporarily point REDIS_URL at an unreachable
# host. A working image:
railway variables set REDIS_URL=redis://invalid.internal:6379
railway restart backend
```

Or (safer — leaves prod config untouched):

```bash
# In a staging shell that exports MONGO / JWT but NOT the real Redis
# URL, run the backend pointing at an unreachable Redis.
REDIS_URL=redis://127.0.0.1:1 uvicorn main:app --port 8001
```

### 2.2 Acceptable behaviour

* Auth flows still allow logins — rate limiting must **fail open**
  so a Redis outage doesn't lock every user out. The ticket
  issuance path already does this (see
  `app/core/ws_security.py::issue_ticket`: "Fail open on Redis
  outage").
* OTP sending may fail; users see a clear "service temporarily
  unavailable" message, not a 500.
* WebSocket connections may be rejected for 10–30s during startup
  while the client retries; after that, the app-level fallback
  (in-memory tickets with a short TTL, not implemented — see
  "gaps" below) kicks in, OR we accept that WS auth is unavailable
  for the duration and emit a banner.
* The alert pipeline still fires `redis_unavailable` events; they
  are best-effort, since alerting also touches Redis for dedup.

### 2.3 Failure signatures (drill has failed)

* 5xx rates exceed 2% of all requests for > 60s.
* Login endpoint returns "Internal server error" (not a 503 or a
  429) — means the rate limiter crashed instead of failing open.
* Any money endpoint (`/api/store/*`) returns 500
  because it implicitly relies on Redis for idempotency — payments
  idempotency lives in Mongo unique indexes, so this is a code
  bug.

### 2.4 Recovery

Restart Redis (`railway service restart`) OR revert the env var.
The app reconnects on the next operation; no backend restart
required. Verify via `/healthz` and a synthetic login.

### 2.5 Known gaps

We do not currently have a Redis **fallback store** (e.g. in-process
LRU for rate counters). If you want the system to stay fully
functional through a 2-hour Redis outage, that's a fifth-order
improvement for after launch.

---

## 3. Failure mode: WebSocket flood

### 3.1 Injection

Use the companion helper `app/scripts/chaos_ws_flood.py`:

```bash
python -m app.scripts.chaos_ws_flood \
    --url wss://staging-api.pentaprotocol.com/api/room/ws/TEST1234/P1 \
    --count 500 \
    --concurrency 50 \
    --ticket-endpoint https://staging-api.pentaprotocol.com/api/room/ws-ticket \
    --jwt "$STAGING_TEST_JWT"
```

Stresses three things:

* The per-user reconnect throttle (ticket issuance) — should start
  returning 429 after ~10 tickets per minute per user.
* The per-connection rate cap (`app/core/ws_security.py`) — should
  close individual connections that exceed N msgs/sec.
* The upstream Cloudflare rate limit `ws-ticket-flood` (see
  `docs/EDGE.md` §2.4).

### 3.2 Acceptable behaviour

* Backend CPU stays under 80% sustained.
* Legitimate clients that already hold valid tickets continue their
  sessions uninterrupted.
* The flooder sees 429s within the first 15 seconds.

### 3.3 Failure signatures

* Event loop latency > 1s (backend becomes unresponsive to health
  checks).
* Queue depth in Mongo `matchmaking_queue` grows unbounded.
* WAF does not fire the `ws-ticket-flood` rule — means Cloudflare
  config has drifted.

### 3.4 Recovery

The backend should recover on its own once the flood stops.
Matchmaking queue entries self-expire via the TTL index (7200s).
If they don't (e.g. because the server stayed pinned), delete the
stuck rows manually: `db.matchmaking_queue.deleteMany({ status: "waiting" })`.

---

## 4. Failure mode: UPI submission duplication

### 4.1 Injection

There is no third-party payment gateway to replay — PentaProtocol
only accepts manually verified UPI / bank-QR submissions. The
equivalent drill is: a malicious user tries to submit the same UTR
twice, possibly from two different accounts.

```bash
# From a staging shell with two different JWTs in $JWT_A / $JWT_B
curl -sS -X POST https://staging-api.pentaprotocol.com/api/store/upi-submit \
  -H "Authorization: Bearer $JWT_A" -H "Content-Type: application/json" \
  -d '{"utr":"TESTCHAOS1","amount":49,"package_id":"starter","currency_type":"protocredits"}'

curl -sS -X POST https://staging-api.pentaprotocol.com/api/store/upi-submit \
  -H "Authorization: Bearer $JWT_B" -H "Content-Type: application/json" \
  -d '{"utr":"TESTCHAOS1","amount":49,"package_id":"starter","currency_type":"protocredits"}'
```

### 4.2 Acceptable behaviour

* First request: 200, row written to `upi_payments` with
  `status: "pending"`.
* Second request (same UTR, any account): 400 "This UTR has
  already been submitted." No row written.
* Amount mismatch: a third request with `"amount": 10` returns 400
  and emits a `payment.fail` audit event of severity `warn`.

### 4.3 Failure signatures

* Both submissions succeed — means the unique index on
  `upi_payments.utr` has been dropped. Check
  `db.upi_payments.getIndexes()` and recreate it.
* The amount-mismatch path returns 200 — the server-side amount
  check has regressed.

### 4.4 Recovery

Drop the duplicate row(s), re-run
`db.upi_payments.createIndex({ utr: 1 }, { unique: true })`, then
audit the last 24h of `upi_payments` for any pairs with the same
UTR and different `user_id`.

---

## 5. Failure mode: MongoDB slow / failover

### 5.1 Injection

On Atlas free/Flex tier you can't trigger a failover. Substitute:

```bash
# Simulate slow Mongo by starting a local tc-netem latency shim.
# (Linux only; skip on Windows dev hosts.)
sudo tc qdisc add dev lo root netem delay 800ms
# ... run the app and exercise flows ...
sudo tc qdisc del dev lo root netem
```

Or add a toxiproxy in front of Mongo and use its API to inject
latency / packet loss.

### 5.2 Acceptable behaviour

* Match creation slows but does not fail. The in-room state is
  memory-backed, so a 5s Mongo lag during a match doesn't drop
  players.
* Write-heavy endpoints (payments, account updates) see elevated
  latency but not 5xx.
* Audit log writes are fire-and-forget (see
  `app/core/security_audit.py`) so they never block a user-facing
  request, even under latency.

### 5.3 Failure signatures

* Match end-of-match awarding times out and players see "Result
  pending" for > 30s. This is a latent bug in `game.py`; the
  award path is not currently wrapped in a bounded retry.
* Any endpoint returns 500 with "connection reset" — means we have
  not set `serverSelectionTimeoutMS` correctly.

### 5.4 Recovery

Atlas failovers complete in < 60s. We rely on the Motor driver's
auto-discovery; no app change needed. If we observe stuck
connections post-failover, restart the backend service.

---

## 6. Running a drill

1. Announce on the team channel.
2. Pick a staging-traffic replay or synthetic load to run in the
   background (use a scripted bot playing 50 concurrent matches).
3. Inject the failure.
4. Observe the dashboards (Railway metrics, Mongo Atlas charts,
   Sentry, the alerting inbox).
5. Write up results in `docs/DRILLS.md` with timestamps, what
   happened, what broke, what's tracked for remediation.

The goal of each drill is not to avoid breakage — it's to convert
unknown breakage into known breakage.
