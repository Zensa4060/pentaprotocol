"""Shared auth dependency — Phase 3 / security-review finding F-03.

Historically every router declared its own ``get_current_user`` that
read ``Authorization: Bearer <JWT>``. With the move to HttpOnly cookies
the dependency has to support *both* sources (cookie-first, header
fallback for legacy clients that haven't reloaded yet), and the
single-session-id enforcement should not be duplicated across routers.

This module centralises that logic. Routers now just do::

    from app.core.auth_dep import get_current_user

and call it as a normal FastAPI dependency::

    async def some_endpoint(user_id: str = Depends(get_current_user)):
        ...
"""

from __future__ import annotations

from fastapi import Cookie, Header, HTTPException, Request

from app.core.database import get_db
from app.core.ids import user_object_id
from app.core.security import decode_token
from app.core.session_cookies import ACCESS_TOKEN_COOKIE


def _extract_bearer(authorization: str | None) -> str | None:
    """Parse ``Authorization: Bearer <token>`` and return the token, or
    None if the header is absent / malformed. Tolerant of extra
    whitespace and case variations on the scheme name."""
    if not authorization:
        return None
    parts = authorization.strip().split()
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    token = token.strip()
    return token or None


def extract_session_token(
    authorization: str | None,
    pp_token_cookie: str | None,
) -> str | None:
    """Prefer the HttpOnly cookie over the Authorization header.

    Exported so other router-local auth helpers (admin.py /
    bot.py / bot7.py) can adopt the same cookie-first strategy
    without duplicating the parsing logic.
    """
    if pp_token_cookie:
        return pp_token_cookie
    return _extract_bearer(authorization)


async def get_current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    pp_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
) -> str:
    """Resolve the authenticated user_id from an HttpOnly session cookie
    or an ``Authorization`` header (fallback for transitional clients).

    Always prefers the cookie when both are present — it is
    inaccessible to JavaScript running in the page and therefore
    harder to exfiltrate than a Bearer token that the app-layer JS
    has just retrieved and attached. If neither source is present or
    the JWT is invalid / replaced / expired, raises 401.
    """
    token = pp_token or _extract_bearer(authorization)
    if not token:
        raise HTTPException(401, "Not authenticated")

    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(401, "Invalid token")

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(401, "Invalid token")

    token_sid = payload.get("sid")
    # Single-session enforcement: when the token carries a session-id,
    # confirm it still matches the user's current_session_id in the DB.
    # This is what kicks older devices when the user signs in elsewhere.
    if token_sid:
        db = get_db()
        try:
            oid = user_object_id(user_id)
        except Exception:
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"_id": oid}, {"current_session_id": 1})
        if not user or user.get("current_session_id") != token_sid:
            raise HTTPException(401, "Session replaced — please sign in again")

    # Stash the token on the request so WS-ticket / rate-limit / audit
    # code can see the raw JWT without re-parsing headers or cookies.
    try:
        request.state.access_token = token
    except Exception:
        pass

    return user_id
