import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

_XP_CURVE_LEVELS_1_TO_30 = [1000 + ((lvl - 1) * 50) for lvl in range(1, 31)]

def xp_for_level(level: int) -> int:
    if level >= 1000:
        return 999_999_999  # Effective cap
    if level <= 0:
        return _XP_CURVE_LEVELS_1_TO_30[0]
    if level <= 30:
        return _XP_CURVE_LEVELS_1_TO_30[level - 1]
    return _XP_CURVE_LEVELS_1_TO_30[-1] + ((level - 30) * 50)

async def migrate_xp():
    mongodb_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017")
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
