from pydantic import BaseModel
from typing import Optional, List

class CreateGame(BaseModel):
    mode: str  # "solo" | "unranked" | "ranked"
    format: str = "bo3"

class MakeMove(BaseModel):
    game_id: str
    row: int
    col: int

class GameResponse(BaseModel):
    game_id: str
    board: List[List[Optional[str]]]
    current_player: str
    status: str
    winner: Optional[str]
    mode: str
    moves_played: int
