from dotenv import load_dotenv
load_dotenv()

import socket
_orig = socket.getaddrinfo
def _patched(host, port, family=0, type=0, proto=0, flags=0):
    return _orig(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _patched

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.routers import auth, game, profile, store, bot, bot7, room, otp, paypal
from app.core.database import connect_db, disconnect_db, get_db

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
    except Exception as e:
        # Don't catch HTTPExceptions here as they should be handled by FastAPI
        from starlette.exceptions import HTTPException as StarletteHTTPException
        if isinstance(e, StarletteHTTPException):
            raise e
        import traceback
        traceback.print_exc()
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
    from starlette.exceptions import HTTPException as StarletteHTTPException
    if isinstance(exc, StarletteHTTPException):
        # Let FastAPI's default handler handle it (or just return it)
        return await http_exception_handler(request, exc)

    import traceback
    traceback.print_exc()
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
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
                "Access-Control-Allow-Headers": "*",
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
app.include_router(paypal,  prefix="/api/paypal",  tags=["paypal"])  # ← Added PayPal router

# ── Single startup — connect DB then create TTL index ────────────────────────
@app.on_event("startup")
async def startup():
    await connect_db()
    db = get_db()
    # Auto-expire matchmaking queue entries after 60 seconds
    await db.matchmaking_queue.create_index("created_at", expireAfterSeconds=60)
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