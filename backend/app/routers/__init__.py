
# app/routers/__init__.py
from .admin import router as admin
from .argus import router as argus
from .analyze import router as analyze
from .auth import router as auth
from .bot import router as bot
from .bot7 import router as bot7
from .friends import router as friends
from .game import router as game
from .syros import router as syros
from .otp import router as otp
from .profile import router as profile
from .room import router as room
from .store import router as store

__all__ = ['admin', 'analyze', 'argus', 'auth', 'bot', 'bot7', 'friends', 'game', 'syros', 'otp', 'profile', 'room', 'store']
