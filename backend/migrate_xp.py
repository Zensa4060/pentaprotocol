import asyncio
import os
import sys

# Re-use the existing xp computation from pentaprotocol
from app.routers.game import xp_for_level
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def migrate_xp():
    load_dotenv('.env')
    mongodb_url = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongodb_url)
    db = client.pentaprotocol
    
    users = db.users.find({})
    migrated_count = 0
    
    async for user in users:
        total_xp = user.get("xp", 0)
        
        level = 1
        rem = int(total_xp)
        while level < 1000 and rem >= xp_for_level(level):
            rem -= xp_for_level(level)
            level += 1
            
        if level >= 1000:
            level = 1000
            rem = 0
            
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"level": level, "xp": rem}}
        )
        migrated_count += 1
        print(f"Migrated user {user.get('username')} -> Level {level}, XP {rem}")
        
    print(f"Migrated {migrated_count} users successfully.")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_xp())
