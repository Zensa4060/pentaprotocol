from dotenv import load_dotenv
load_dotenv()

import socket
_orig = socket.getaddrinfo
def _patched(host, port, family=0, type=0, proto=0, flags=0):
    return _orig(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _patched

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from app.routers import auth, game, profile, store, bot, bot7, room, otp, admin
from app.core.database import connect_db, disconnect_db, get_db
import logging
import os

logger = logging.getLogger(__name__)

app = FastAPI(title="PentaProtocol API")
MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str(1024 * 1024)))
ENV = os.getenv("ENV", "development").lower()

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pentaprotocol.vercel.app",
    "https://pentaprotocol.com",
    "https://www.pentaprotocol.com",
]

# Host allowlist — anything not in this list gets a 400 from
# TrustedHostMiddleware before it ever reaches a route. This blocks
# Host-header-spoofing attacks (cache poisoning, password-reset-link
# hijack) that show up in opportunistic scanners after any launch.
#
# Local dev keeps the wildcard so localhost / 127.0.0.1 / 0.0.0.0 / LAN
# all work without config. Production narrows to our actual hosts plus
# Railway's internal routing host (required for Railway's health checks
# and for the internal service-to-service calls).
if ENV == "production":
    ALLOWED_HOSTS = [
        "pentaprotocol.com",
        "www.pentaprotocol.com",
        "api.pentaprotocol.com",
        "pentaprotocol.vercel.app",
        "*.up.railway.app",
        "*.railway.app",
    ]
else:
    ALLOWED_HOSTS = ["*"]

app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)

# HTTPS redirect only in production — Railway terminates TLS at the
# edge and forwards as HTTP internally, but if any misconfigured
# routing lands a cleartext HTTP request on the app we bounce it to
# HTTPS immediately instead of processing it. Dev needs HTTP.
if ENV == "production":
    app.add_middleware(HTTPSRedirectMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Explicitly list Authorization: the CORS spec says the "*" wildcard in
    # Access-Control-Allow-Headers does NOT cover the Authorization header,
    # so browsers log a warning and may block authed requests.
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-Device-Fingerprint",
        "If-None-Match",
        "If-Modified-Since",
    ],
    expose_headers=["Content-Length", "ETag", "X-Request-Id"],
    max_age=3600,
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS — only send in production (sending from http://localhost would
    # pin the browser to HTTPS for a dev hostname which is painful to
    # undo). Two years + includeSubDomains + preload is the standard
    # production policy.
    if ENV == "production":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
        )
    # Belt-and-suspenders — these are also set by Next on the frontend
    # but the API can be hit directly, so we echo them here.
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
    )
    return response

@app.middleware("http")
async def request_size_guard(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH"}:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BYTES:
                    return JSONResponse({"detail": "Request payload too large"}, status_code=413)
            except ValueError:
                return JSONResponse({"detail": "Malformed Content-Length header"}, status_code=400)
    return await call_next(request)


@app.middleware("http")
async def force_cors_headers(request: Request, call_next):
    origin = request.headers.get("origin", "")
    try:
        response = await call_next(request)
    except Exception as e:
        # Don't catch HTTPExceptions here as they should be handled by FastAPI
        from starlette.exceptions import HTTPException as StarletteHTTPException
        if isinstance(e, StarletteHTTPException):
            raise e
        logger.exception("force_cors_headers caught unhandled exception")
        response = JSONResponse({"detail": "Internal server error"}, status_code=500)
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        # Mirror the concrete header list used by CORSMiddleware. The
        # previous `*` value is technically valid but (a) does not cover
        # the Authorization header per spec and (b) masks misconfigured
        # clients sending headers we don't expect.
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-CSRF-Token, X-Device-Fingerprint"
        response.headers["Vary"] = "Origin"
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": "Malformed request payload"})

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    from starlette.exceptions import HTTPException as StarletteHTTPException
    if isinstance(exc, StarletteHTTPException):
        # Let FastAPI's default handler handle it (or just return it)
        return await http_exception_handler(request, exc)

    # Log the full traceback server-side (never return it to the client).
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)

    # Previously this handler echoed Access-Control-Allow-Origin: * which
    # undid the concrete allowlist used by CORSMiddleware for every other
    # response — i.e. a 500 let any origin read the response. Now we
    # mirror the same allowlist logic: if the request's Origin is
    # allowed, echo it; otherwise emit no CORS headers.
    origin = request.headers.get("origin", "")
    headers: dict[str, str] = {}
    if origin in ALLOWED_ORIGINS:
        headers = {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-CSRF-Token, X-Device-Fingerprint",
            "Vary": "Origin",
        }
    return JSONResponse(status_code=500, content={"detail": "Internal server error"}, headers=headers)

@app.options("/{rest_of_path:path}")
async def preflight_handler(request: Request, rest_of_path: str):
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return JSONResponse(
            content={},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Origin, X-Requested-With, X-CSRF-Token, X-Device-Fingerprint",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600",
            },
        )
    return JSONResponse(content={}, status_code=403)

# Include all routers BEFORE the startup event
app.include_router(auth,    prefix="/api/auth",    tags=["auth"])
app.include_router(game,    prefix="/api/game",    tags=["game"])
app.include_router(profile, prefix="/api/profile", tags=["profile"])
app.include_router(store,   prefix="/api/store",   tags=["store"])
app.include_router(bot,     prefix="/api/bot",     tags=["bot"])
app.include_router(bot7,    prefix="/api/bot7",    tags=["bot7"])
app.include_router(room,    prefix="/api/room",    tags=["room"])
app.include_router(otp,     prefix="/api/otp",     tags=["otp"])
app.include_router(admin,   prefix="/api/admin",   tags=["admin"])

# ── Single startup — connect DB (matchmaking TTL lives in database.ensure_indexes) ─
@app.on_event("startup")
async def startup():
    await connect_db()
    try:
        from app.routers.bot import _HAS_RUST as BOT_RUST_ACTIVE
        print(f"Rust Engine Active: {BOT_RUST_ACTIVE}")
    except Exception as e:
        print(f"Rust Engine Active: unknown ({e})")
    
    # Optional: Print routes for debugging (handles both HTTP and WebSocket)
    try:
        print("\n=== Registered Routes ===")
        for route in app.routes:
            if hasattr(route, 'methods'):
                # HTTP routes
                print(f"{route.methods} {route.path}")
            elif hasattr(route, 'path'):
                # WebSocket or other routes
                route_type = type(route).__name__
                print(f"[{route_type}] {route.path}")
        print("========================\n")
    except Exception as e:
        print(f"Error printing routes: {e}")

@app.on_event("shutdown")
async def shutdown():
    await disconnect_db()

@app.get("/")
async def root(): 
    return {"status": "PentaProtocol API running"}