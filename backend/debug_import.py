import sys
import os

# Add the backend directory to sys.path
backend_dir = r"c:\Users\yagya\Documents\pentaprotocol\backend"
sys.path.append(backend_dir)

try:
    print("Attempting to import app.routers.bot...")
    from app.routers import bot
    print("Successfully imported app.routers.bot")
except Exception as e:
    print(f"FAILED to import app.routers.bot: {e}")
    import traceback
    traceback.print_exc()
