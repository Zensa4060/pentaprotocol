from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    level: int
    xp: int
    elo: int
    ranked_rating: Optional[int] = None
    wins: int
    losses: int
    draws: int
    placement_matches: int = 0
    totp_enabled: bool = False
    shards: int = 0
    protocredits: int = 0
    bio: str = ""
    avatar: Optional[str] = None
    legal_accepted: bool = False
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
