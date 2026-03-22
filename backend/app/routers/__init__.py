from .auth import router as auth_router
from .bot import router as bot_router
from .game import router as game_router
from .otp import router as otp_router
from .paypal import router as paypal_router
from .profile import router as profile_router
from .room import router as room_router
from .store import router as store_router

__all__ = [
    'auth_router',
    'bot_router', 
    'game_router',
    'otp_router',
    'paypal_router',
    'profile_router',
    'room_router',
    'store_router'
]
