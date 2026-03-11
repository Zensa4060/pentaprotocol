from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, game, profile, store, bot
from app.core.database import connect_db, disconnect_db
from app.routers import room

app = FastAPI(title="PentaProtocol API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pentaprotocol.vercel.app",
    "https://pentaprotocol.com",
    "https://www.pentaprotocol.com",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup(): await connect_db()

@app.on_event("shutdown")
async def shutdown(): await disconnect_db()

app.include_router(auth.router,    prefix="/api/auth",    tags=["auth"])
app.include_router(game.router,    prefix="/api/game",    tags=["game"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(store.router,   prefix="/api/store",   tags=["store"])
app.include_router(bot.router, prefix="/api/bot", tags=["bot"])
app.include_router(room.router, prefix="/api/room", tags=["room"])

@app.get("/")
async def root(): return {"status": "PentaProtocol API running"}