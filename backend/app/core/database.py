from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi
from pymongo import ASCENDING, DESCENDING

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class DB:
    client: AsyncIOMotorClient = None
    db = None

db = DB()

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
        minPoolSize=5,
        waitQueueTimeoutMS=30000,
    )
    db.db = db.client[name]

    await db.client.admin.command("ping")
    # Critical indexes for room queue/create/join and profile fetch paths.
    await db.db.users.create_index([("username", ASCENDING)], unique=True, background=True)
    await db.db.users.create_index([("email", ASCENDING)], unique=True, background=True)
    await db.db.rooms.create_index([("room_code", ASCENDING)], unique=True, background=True)
    await db.db.rooms.create_index([("status", ASCENDING), ("format", ASCENDING), ("created_at", DESCENDING)], background=True)
    await db.db.rooms.create_index([("player1_id", ASCENDING)], background=True)
    await db.db.rooms.create_index([("player2_id", ASCENDING)], background=True)
    await db.db.match_history.create_index([("user_id", ASCENDING), ("played_at", DESCENDING)], background=True)
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