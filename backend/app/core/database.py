from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi
from pymongo import ASCENDING, DESCENDING
import asyncio



class DB:
    client: AsyncIOMotorClient = None
    db = None

db = DB()


async def ensure_indexes():
    if db.db is None:  # ← fixed: was "if not db.db" which pymongo can't bool-check
        return
    try:
        # Critical indexes for room queue/create/join and profile fetch paths.
        await db.db.users.create_index([("username", ASCENDING)], unique=True, background=True)
        # 1. Email is unique ONLY for normal (non-Google) accounts.
        # This allows multiple Google users with the same email (though google_id is unique)
        # and exactly one normal user per email.
        await db.db.users.create_index(
            [("email", ASCENDING)],
            unique=True,
            partialFilterExpression={"google_id": None},
            background=True
        )
        # 2. Google ID is always unique.
        await db.db.users.create_index(
            [("google_id", ASCENDING)],
            unique=True,
            sparse=True,
            background=True
        )
        await db.db.rooms.create_index([("room_code", ASCENDING)], unique=True, background=True)
        await db.db.rooms.create_index([("status", ASCENDING), ("format", ASCENDING), ("created_at", DESCENDING)], background=True)
        await db.db.rooms.create_index([("player1_id", ASCENDING)], background=True)
        await db.db.rooms.create_index([("player2_id", ASCENDING)], background=True)
        await db.db.match_history.create_index([("user_id", ASCENDING), ("played_at", DESCENDING)], background=True)
        # TTL for abandoned queue rows only — 60s was too short (players queue longer than
        # that while waiting for a match, which removed them from the pool but left the room stuck).
        # Deploy: restart API after deploy so ensure_indexes runs; if Atlas still shows old TTL,
        # manually drop index created_at_1 on matchmaking_queue then redeploy.
        try:
            await db.db.matchmaking_queue.drop_index("created_at_1")
        except Exception:
            pass
        await db.db.matchmaking_queue.create_index(
            [("created_at", ASCENDING)], expireAfterSeconds=7200, background=True
        )
        print("MongoDB indexes ensured")
    except Exception as e:
        print(f"Index ensure warning: {e}")

async def connect_db():
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not uri:
        raise ValueError("No MongoDB URI found! Set MONGO_URI environment variable.")
    print(f"Connecting to MongoDB: {uri[:40]}...")
    name = os.getenv("DATABASE_NAME", "pentaprotocol")

    db.client = AsyncIOMotorClient(
        uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=60000,
        maxPoolSize=50,
        minPoolSize=1,
        waitQueueTimeoutMS=30000,
    )
    db.db = db.client[name]

    await db.client.admin.command("ping")
    # Don't block startup on index operations.
    asyncio.create_task(ensure_indexes())
    print("Connected to MongoDB Atlas successfully")

async def disconnect_db():
    if db.client:
        db.client.close()
    print("Disconnected from MongoDB")

def get_db():
    """Direct call — use this in routers that call get_db() manually."""
    return db.db

async def get_db_dep():
    """FastAPI Depends version — use this with Depends(get_db_dep)."""
    yield db.db