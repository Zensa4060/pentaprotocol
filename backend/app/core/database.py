from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import certifi
import logging
from pymongo import ASCENDING, DESCENDING
import asyncio

logger = logging.getLogger("pentaprotocol.db")



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
        # Payment idempotency guards on the legacy ``payments`` collection.
        # Historical gateway integrations wrote rows here keyed on
        # ``payment_id`` / ``order_id``; we retain the unique
        # indexes so that any stale retry still can't double-credit. The
        # UPI flow uses ``upi_payments`` and is guarded separately below.
        await db.db.payments.create_index(
            [("payment_id", ASCENDING)],
            unique=True,
            partialFilterExpression={"payment_id": {"$type": "string"}},
            background=True,
        )
        await db.db.payments.create_index(
            [("order_id", ASCENDING)],
            unique=True,
            partialFilterExpression={"order_id": {"$type": "string"}},
            background=True,
        )
        # UPI UTR unique-per-submission. The app already checks in code;
        # the DB index is the authoritative guard against race conditions
        # (two parallel submissions of the same UTR by different users).
        await db.db.upi_payments.create_index(
            [("utr", ASCENDING)], unique=True, background=True
        )
        # Anti-cheat matches retention — 90 days matches security_events.
        await db.db.anticheat_matches.create_index(
            [("at", ASCENDING)],
            expireAfterSeconds=90 * 24 * 60 * 60,
            background=True,
        )
        await db.db.anticheat_matches.create_index(
            [("per_slot.P1.user_id", ASCENDING), ("at", DESCENDING)], background=True
        )
        await db.db.anticheat_matches.create_index(
            [("per_slot.P2.user_id", ASCENDING), ("at", DESCENDING)], background=True
        )
        # Economy events (Phase 3). Detection only — never read on a
        # hot request path; indexes kept minimal.
        await db.db.economy_events.create_index(
            [("at", ASCENDING)],
            background=True,
        )
        await db.db.economy_events.create_index(
            [("user_id", ASCENDING), ("kind", ASCENDING), ("at", DESCENDING)],
            background=True,
        )
        await db.db.economy_events.create_index(
            [("ip_hash", ASCENDING), ("at", DESCENDING)],
            background=True,
            sparse=True,
        )
        await db.db.economy_events.create_index(
            [("device_hash", ASCENDING), ("at", DESCENDING)],
            background=True,
            sparse=True,
        )
        # Secret rotation ledger (Phase 3). One row per secret name;
        # we upsert on rotation events. Small collection (<50 rows),
        # so a unique index on ``name`` is plenty.
        await db.db.secrets_ledger.create_index(
            [("name", ASCENDING)], unique=True, background=True
        )
        # Audit log indexes (TTL + lookup) — imported lazily to avoid a
        # circular import via app.core.security_audit -> get_db -> here.
        try:
            from app.core import security_audit
            await security_audit.ensure_indexes()
        except Exception as e:
            logger.warning("security_events index ensure warning: %s", e)
        logger.info("MongoDB indexes ensured")
    except Exception as e:
        logger.warning("Index ensure warning: %s", e)

async def connect_db():
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not uri:
        raise ValueError("No MongoDB URI found! Set MONGO_URI environment variable.")
    # Never log the URI (even truncated). Mongo connection strings can leak
    # the cluster host, database name, and — on misconfigured envs — the
    # credentials embedded as "mongodb+srv://user:pass@host/...".
    logger.info("Connecting to MongoDB cluster")
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
    logger.info("Connected to MongoDB successfully")

async def disconnect_db():
    if db.client:
        db.client.close()
    logger.info("Disconnected from MongoDB")

def get_db():
    """Direct call — use this in routers that call get_db() manually."""
    return db.db

async def get_db_dep():
    """FastAPI Depends version — use this with Depends(get_db_dep)."""
    yield db.db