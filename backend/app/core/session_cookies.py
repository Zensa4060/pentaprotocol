"""Session-cookie helpers — Phase 3 / security-review finding F-03.

Before this migration, the JWT access token and the 2FA trusted-device
token were returned in JSON response bodies and persisted by the
browser in ``localStorage``. That put both credentials directly in
reach of any script executing in the page's origin, so an XSS
primitive (hypothetical today; not currently known to exist — see
review finding F-01) would have immediately compromised the account
AND bypassed 2FA.

The cookies written here are:

- ``pp_token``: HttpOnly, Secure, SameSite=Lax. Carries the JWT.
  Unreadable from JavaScript, so XSS cannot exfiltrate it. Max-Age
  mirrors the JWT lifetime (12h by default) so an expired cookie is
  dropped by the browser automatically.

- ``pp_device_token``: HttpOnly, Secure, SameSite=Lax. Carries the
  trusted-device random string that lets a browser skip the 2FA prompt
  for 30 days. Same XSS-safety guarantees as ``pp_token``; combined
  with the server-side hashing (see auth.py `_hash_device_token`) a DB
  leak also does not yield usable tokens.

- ``pp_auth``: **not** HttpOnly. A short presence hint that carries
  only the cookie's expiry timestamp (milliseconds, matches ``pp_token``).
  Read by the Next.js edge proxy (frontend/proxy.ts) and by the client
  auth store (frontend/lib/store.ts) to know synchronously whether the
  user has an active session without having to await a roundtrip.
  Contains no secret material — forging it gains an attacker nothing
  because the backend enforces the real JWT on every API call.

All three cookies are written together on the login/register/2FA
success paths and cleared together on logout. In local-dev (no HTTPS)
the ``Secure`` flag is omitted so dev logins work over http://localhost.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from starlette.responses import Response


# ── Configuration ─────────────────────────────────────────────────────────────
ACCESS_TOKEN_COOKIE = "pp_token"
DEVICE_TOKEN_COOKIE = "pp_device_token"
# Non-HttpOnly presence hint consumed by the edge proxy and the JS
# auth store. Name is historical (predates the HttpOnly migration).
PRESENCE_COOKIE = "pp_auth"

# Device tokens remain a 30-day bypass per the product spec.
DEVICE_TOKEN_TTL_DAYS = 30

# The JWT lifetime is controlled by security.DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES
# (12h by default). We re-read the env var here rather than import the
# constant to avoid a circular-import risk and so that
# ACCESS_TOKEN_EXPIRE_MINUTES override works without code changes.
def _access_token_ttl_seconds() -> int:
    try:
        minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))
    except ValueError:
        minutes = 720
    return max(60, minutes * 60)  # never below 1 min


def _is_production() -> bool:
    return os.getenv("ENV", "development").lower() == "production"


def _cookie_kwargs(
    *,
    max_age_seconds: int,
    http_only: bool,
) -> dict:
    """Shared cookie attributes. Starlette's ``set_cookie`` accepts these
    as kwargs.

    ``SameSite`` is environment-dependent:

    - **Production**: the frontend (pentaprotocol.com / *.vercel.app) and
      the API (*.up.railway.app or api.pentaprotocol.com) live on
      **different eTLD+1 sites**, so the browser treats every API call
      as cross-site. ``SameSite=Lax`` would therefore block the cookie
      from ever being sent on XHR/fetch — which is exactly the 401
      storm we hit after the F-03 cookie migration went live. We must
      use ``SameSite=None`` so the browser includes the cookie on
      cross-site requests. ``None`` is only honoured together with
      ``Secure``, which we already set in production.

    - **Development**: frontend (localhost:3000) and API (localhost:8000)
      share ``localhost`` as their site, so ``SameSite=Lax`` works and is
      the stronger default. ``SameSite=None`` additionally mandates
      ``Secure``, which browsers refuse to honour on plain ``http://``
      origins, so we would lose cookies entirely in dev if we flipped
      to ``None`` unconditionally.

    CSRF note: we compensate for the weaker cross-site semantics of
    ``SameSite=None`` with the Origin-check middleware in
    ``backend/main.py`` (``csrf_origin_guard``), which rejects mutating
    verbs whose ``Origin`` header is not in ``ALLOWED_ORIGINS``. That
    keeps the CSRF blast-radius of ``SameSite=None`` negligible.
    """
    production = _is_production()
    return {
        "max_age": max_age_seconds,
        "httponly": http_only,
        # ``SameSite=None`` requires ``Secure``; both must be set
        # together or browsers reject the cookie outright.
        "secure": production,
        "samesite": "none" if production else "lax",
        "path": "/",
    }


# ── Writers ───────────────────────────────────────────────────────────────────
def set_access_token_cookie(response: Response, token: str) -> None:
    """Persist the JWT as an HttpOnly cookie and refresh the matching
    non-HttpOnly presence hint."""
    ttl = _access_token_ttl_seconds()
    response.set_cookie(
        ACCESS_TOKEN_COOKIE,
        token,
        **_cookie_kwargs(max_age_seconds=ttl, http_only=True),
    )
    # Presence hint (JS-readable) — stores expiry in ms, matching the
    # value the frontend auth store previously computed locally.
    expiry_ms = int((datetime.utcnow() + timedelta(seconds=ttl)).timestamp() * 1000)
    response.set_cookie(
        PRESENCE_COOKIE,
        str(expiry_ms),
        **_cookie_kwargs(max_age_seconds=ttl, http_only=False),
    )


def set_device_token_cookie(response: Response, token: str) -> None:
    """Persist the trusted-device 2FA-bypass token as an HttpOnly cookie.
    The raw token is never visible to JavaScript after this call."""
    ttl = DEVICE_TOKEN_TTL_DAYS * 24 * 60 * 60
    response.set_cookie(
        DEVICE_TOKEN_COOKIE,
        token,
        **_cookie_kwargs(max_age_seconds=ttl, http_only=True),
    )


def set_session_cookies(
    response: Response,
    *,
    access_token: str,
    device_token: str | None = None,
) -> None:
    """One-shot helper used by login / register / google / 2fa handlers."""
    set_access_token_cookie(response, access_token)
    if device_token:
        set_device_token_cookie(response, device_token)


def clear_session_cookies(response: Response) -> None:
    """Used by /auth/logout. Browsers only accept a ``Set-Cookie`` that
    clears an existing cookie when its ``Path``, ``Secure`` and
    ``SameSite`` attributes match the ones used when the cookie was
    originally set — otherwise the browser treats the clear as a
    *different* cookie and the original remains live. We therefore
    re-emit ``Set-Cookie: <name>=; Max-Age=0`` with the same attribute
    set as ``set_cookie``."""
    production = _is_production()
    samesite = "none" if production else "lax"
    for name, http_only in (
        (ACCESS_TOKEN_COOKIE, True),
        (DEVICE_TOKEN_COOKIE, True),
        (PRESENCE_COOKIE, False),
    ):
        response.set_cookie(
            name,
            "",
            max_age=0,
            httponly=http_only,
            secure=production,
            samesite=samesite,
            path="/",
        )
