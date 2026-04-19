
# app/routers/__init__.py
from .admin import router as admin
from .auth import router as auth
from .bot import router as bot
from .bot7 import router as bot7
from .game import router as game
from .otp import router as otp
from .profile import router as profile
from .room import router as room
from .store import router as store

__all__ = ['admin', 'auth', 'bot', 'bot7', 'game', 'otp', 'profile', 'room', 'store']
