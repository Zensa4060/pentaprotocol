import socket
_orig = socket.getaddrinfo
def _patched(host, port, family=0, type=0, proto=0, flags=0):
    return _orig(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _patched

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.routers import auth, game, profile, store, bot
from app.core.database import connect_db, disconnect_db, get_db  # ← added get_db
from app.routers import room
from app.routers import otp

app = FastAPI(title="PentaProtocol API")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pentaprotocol.vercel.app",
    "https://pentaprotocol.com",
    "https://www.pentaprotocol.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

@app.middleware("http")
async def force_cors_headers(request: Request, call_next):
    origin = request.headers.get("origin", "")
    try:
        response = await call_next(request)
    except Exception:
        response = JSONResponse({"detail": "Internal server error"}, status_code=500)
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Vary"] = "Origin"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=headers,
    )

@app.options("/{rest_of_path:path}")
async def preflight_handler(request: Request, rest_of_path: str):
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return JSONResponse(
            content={},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "3600",
            },
        )
    return JSONResponse(content={}, status_code=403)

# ── Single startup — connect DB then create TTL index ────────────────────────
@app.on_event("startup")
async def startup():
    await connect_db()
    db = get_db()
    # Auto-expire matchmaking queue entries after 60 seconds
    await db.matchmaking_queue.create_index("created_at", expireAfterSeconds=60)

@app.on_event("shutdown")
async def shutdown():
    await disconnect_db()
from app.routers import paypal
app.include_router(paypal.router, prefix="/api/paypal", tags=["paypal"])
app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(game.router,    prefix="/api/game",    tags=["game"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(store.router,   prefix="/api/store",   tags=["store"])
app.include_router(bot.router,     prefix="/api/bot",     tags=["bot"])
app.include_router(room.router,    prefix="/api/room",    tags=["room"])
app.include_router(otp.router,     prefix="/api/otp",     tags=["otp"])

@app.get("/")
async def root(): return {"status": "PentaProtocol API running"}