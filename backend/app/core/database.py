from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi

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
        maxPoolSize=10,
        minPoolSize=1,
        waitQueueTimeoutMS=10000,
    )
    db.db = db.client[name]

    await db.client.admin.command("ping")
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