
# app/routers/__init__.py
from .auth import router as auth
from .bot import router as bot
from .bot7 import router as bot7
from .game import router as game
from .otp import router as otp
from .paypal_service import router as paypal
from .profile import router as profile
from .room import router as room
from .store import router as store

# Export all routers
__all__ = ['auth', 'bot', 'bot7', 'game', 'otp', 'paypal', 'profile', 'room', 'store']