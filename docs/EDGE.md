# Edge security (Cloudflare)

Phase 3.1 — rate limiting at the infrastructure edge.

The app-level limiters in `backend/app/core/rate_limit.py` are the
*inner* ring. They exist to protect the database, Redis, and game
logic from one misbehaving client. They are not designed to absorb a
100k RPS flood — doing so would just move the flood into our event
loop and burn Railway billing.

Cloudflare is the outer ring: it terminates TLS, absorbs volumetric
floods, and blocks obviously-malicious traffic before it reaches the
FastAPI process.

This document is the exact configuration we ship with.

---

## 1. Prerequisites

1. Domain `pentaprotocol.com` on Cloudflare with the orange cloud
   toggled on for `api.pentaprotocol.com` and `www`.
2. Railway public URL treated as **origin only**. Do not expose
   `*.up.railway.app` directly to users — it bypasses Cloudflare.
3. Cloudflare SSL/TLS mode set to **Full (Strict)**. Railway serves
   TLS; this makes Cloudflare verify the Railway certificate rather
   than accepting any.
4. The backend reads the real client IP via
   `backend/app/core/client_ip.py`. It trusts `CF-Connecting-IP`
   only when the TCP peer is inside `TRUSTED_PROXY_CIDRS` (default
   includes the published Cloudflare ranges).

   If you rotate off Cloudflare, you **must** update
   `TRUSTED_PROXY_CIDRS` or the app will start trusting spoofed
   headers from direct connections.

---

## 2. WAF custom rules

Order matters. Cloudflare evaluates top-down; the first match wins.

### 2.1 — Block missing Cloudflare headers (origin protection)

> **When:** Request to `api.pentaprotocol.com` has no
> `CF-Connecting-IP`.
> **Action:** Block (1020).
>
> **Expression:**
> ```
> (http.host eq "api.pentaprotocol.com" and not any(http.request.headers["cf-connecting-ip"][*] ne ""))
> ```

This catches attackers who find the Railway URL and try to bypass
Cloudflare. They'll still have `CF-Connecting-IP` missing because
Cloudflare is the only thing adding it.

### 2.2 — Challenge obvious bots on auth endpoints

> **When:** Path starts with `/api/auth/` AND the request is not a
> WAF-classified "verified bot" AND the bot management score is low.
> **Action:** Managed Challenge.
>
> **Expression:**
> ```
> (starts_with(http.request.uri.path, "/api/auth/")
>  and not cf.client.bot
>  and cf.bot_management.score lt 30)
> ```

Doesn't block — shows a challenge. Real users sail through.

### 2.3 — Block known-abuse ASNs on high-value endpoints

Maintain a short list in the Cloudflare IP Access Rules or a
Custom List called `asn_blocklist_payments`. Populated manually
when we observe abuse.

> **When:** Path matches `/api/store/*`
> AND the IP is in `$asn_blocklist_payments`.
> **Action:** Block.

### 2.4 — Global token bucket per IP

Cloudflare Rate Limiting rules (separate product from WAF):

| Rule | Path | Limit |
| --- | --- | --- |
| auth-flood | `/api/auth/login`, `/api/auth/register`, `/api/auth/2fa/*`, `/api/auth/forgot-password/*`, `/api/auth/reset-password` | 10 req / IP / minute → block for 15 min |
| otp-flood | `/api/otp/*` | 10 req / IP / minute → block for 15 min |
| payments-flood | `/api/store/*` | 30 req / IP / minute → challenge |
| ws-ticket-flood | `/api/room/ws-ticket` | 60 req / IP / minute → challenge |
| api-global | `/api/*` | 600 req / IP / minute → challenge |

The app-level limiters are intentionally a notch stricter per
endpoint; these are the coarse safety net.

### 2.5 — Country-level controls

Default to **allow all**. If we see a sustained abuse pattern from a
specific country (we never block on a one-off — too many false
positives for legitimate users), add a temporary "Under Attack Mode"
challenge scoped to that country. Lift within 48 hours unless the
abuse is ongoing.

---

## 3. Cache rules

Nothing under `/api/` should be cached. The default Railway response
headers set `Cache-Control: no-store` for authenticated endpoints,
but as belt-and-braces add a Cloudflare Cache Rule:

> **When:** `starts_with(http.request.uri.path, "/api/")`
> **Cache eligibility:** Bypass cache.

Static assets under `/` (the Vercel deploy, not Railway) are handled
separately by Vercel's edge — nothing to configure on Cloudflare for
that side.

---

## 4. Verifying the chain

After any change to the rules above, run this end-to-end check from
an external host (not behind Cloudflare):

```bash
# 1. Cloudflare is present
curl -sI https://api.pentaprotocol.com/healthz | grep -i server:
# should include: server: cloudflare

# 2. Real IP is forwarded
curl -s https://api.pentaprotocol.com/api/debug/ip   # if the debug endpoint exists in a private env
# should return the caller's IP, not a Cloudflare or Railway IP

# 3. Direct-to-Railway is blocked
curl -sI https://<your-railway-public-url>/healthz
# should 403 or require CF-Connecting-IP
```

If step 3 succeeds without CF headers, the WAF rule in 2.1 is
misconfigured. Fix before going public.

---

## 5. Incident escalation

When under active attack:

1. Enable **Under Attack Mode** for the zone (Dashboard → Overview
   → right sidebar). Every visitor gets a 5s JS challenge. Ugly but
   buys time.
2. Lower the bot-management threshold in rule 2.2 from 30 → 50
   (more aggressive challenge).
3. Drop the `api-global` rate limit from 600 → 120 temporarily.
4. File a Cloudflare support ticket with sample attack request IDs
   from the Firewall Events log.
5. Keep alerting on; the app-level detector in
   `app/scripts/alert_burst_detector.py` will still catch anything
   that slips through.

Lift all of the above when traffic returns to baseline, documented
in `docs/INCIDENTS.md`.

---

## 6. What this does NOT replace

Edge rate limiting is layered defence. It does not replace:

* App-level per-account limits (abuse of stolen credentials will
  look like one user, not one IP).
* Anti-cheat heuristics (a single real player cheating stays under
  any edge limit).
* Audit logging (we still want to know *who* hit the limit).

All three remain active regardless of edge configuration.
