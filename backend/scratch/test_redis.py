import redis
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL")
print(f"Testing connection to: {REDIS_URL}")

try:
    r = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=5)
    ping = r.ping()
    print(f"Success! Ping response: {ping}")
except Exception as e:
    print(f"Failed to connect to Redis: {e}")
