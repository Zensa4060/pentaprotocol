import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import certifi

from dotenv import load_dotenv

async def drop_index():
    load_dotenv()
    uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URL")
    if not uri:
        print("No MONGO_URI found")
        return
    
    client = AsyncIOMotorClient(uri, tls=True, tlsCAFile=certifi.where())
    db_name = os.getenv("DATABASE_NAME", "pentaprotocol")
    db = client[db_name]
    
    try:
        # Drop the old unique email index
        # MongoDB index name for email ASC is usually 'email_1'
        print("Attempting to drop index 'email_1'...")
        await db.users.drop_index("email_1")
        print("Dropped index 'email_1' successfully.")
    except Exception as e:
        print(f"Index 'email_1' drop failed or not found: {e}")

    try:
        # Drop the old google_id index to recreate it as unique/sparse
        print("Attempting to drop index 'google_id_1'...")
        await db.users.drop_index("google_id_1")
        print("Dropped index 'google_id_1' successfully.")
    except Exception as e:
        print(f"Index 'google_id_1' drop failed or not found: {e}")

    client.close()

if __name__ == "__main__":
    asyncio.run(drop_index())
