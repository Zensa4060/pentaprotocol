from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import auth, game, profile, store, bot
from app.core.database import connect_db, disconnect_db
from app.routers import room

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

# Force CORS headers on every response — Railway's proxy sometimes strips them
# from the CORSMiddleware response before they reach the client.
@app.middleware("http")
async def force_cors_headers(request: Request, call_next):
    origin = request.headers.get("origin", "")
    response = await call_next(request)
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Vary"] = "Origin"
    return response

# Explicit preflight handler — Railway's proxy sometimes swallows
# the OPTIONS response before FastAPI's CORS middleware can add headers.
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

@app.on_event("startup")
async def startup(): await connect_db()

@app.on_event("shutdown")
async def shutdown(): await disconnect_db()

app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(game.router,    prefix="/api/game",    tags=["game"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(store.router,   prefix="/api/store",   tags=["store"])
app.include_router(bot.router,     prefix="/api/bot",     tags=["bot"])
app.include_router(room.router,    prefix="/api/room",    tags=["room"])

@app.get("/")
async def root(): return {"status": "PentaProtocol API running"}