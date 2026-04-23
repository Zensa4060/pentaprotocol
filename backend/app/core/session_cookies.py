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
    as kwargs. ``samesite="lax"`` is the strongest value that still lets
    users land on the site from external links (email, Google sign-in
    redirect) while blocking the worst CSRF patterns."""
    return {
        "max_age": max_age_seconds,
        "httponly": http_only,
        "secure": _is_production(),
        "samesite": "lax",
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
    """Used by /auth/logout. Browsers clear a cookie when we set it with
    a past Max-Age (we use ``delete_cookie`` which does this cleanly)."""
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(DEVICE_TOKEN_COOKIE, path="/")
    response.delete_cookie(PRESENCE_COOKIE, path="/")
