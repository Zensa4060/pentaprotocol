from pydantic import BaseModel
from typing import Optional

class CreateGame(BaseModel):
    mode: str = "classic"
    format: str = "unranked"  # "ranked" or "unranked"

class MakeMove(BaseModel):
    game_id: str
    row: int
    col: int