from pymongo import MongoClient
from dotenv import load_dotenv
import os
import ssl

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class DB:
    client: MongoClient = None
    db = None

db = DB()

async def connect_db():
    uri = os.getenv("MONGO_URI")
    name = os.getenv("DATABASE_NAME", "pentaprotocol")
    db.client = MongoClient(
        uri,
        tls=True,
        tlsAllowInvalidCertificates=True,
    )
    db.db = db.client[name]
    db.client.admin.command("ping")
    print("Connected to MongoDB Atlas successfully")

async def disconnect_db():
    if db.client:
        db.client.close()
    print("Disconnected from MongoDB")

def get_db():
    return db.db