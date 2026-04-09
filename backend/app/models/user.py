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
    rank: str
    wins: int
    losses: int
    draws: int
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
