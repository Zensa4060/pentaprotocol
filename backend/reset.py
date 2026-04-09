import os
import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def reset_all():
    mongo_uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL") or "mongodb://localhost:27017"
    client = AsyncIOMotorClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=30000,
        socketTimeoutMS=60000,
    )
    db = client["pentaprotocol"]

    print("Starting profile reset...")

    users = await db.users.find({}).to_list(length=None)
    total_users = len(users)
    print(f"Processing {total_users} users...")

    for user in users:
        # XP migration for new level curve: reset progression only.
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"xp": 0, "level": 1}},
        )

    print(f"Stats reset for {total_users} users.")

    res_matches = await db.matches.delete_many({})
    print(f"Matches deleted: {res_matches.deleted_count}")

    res_history = await db.match_history.delete_many({})
    print(f"Match history deleted: {res_history.deleted_count}")

    client.close()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(reset_all())