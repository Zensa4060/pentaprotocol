from pydantic import BaseModel

class CreateGame(BaseModel):
    mode: str = "classic"
    format: str = "unranked"

class MakeMove(BaseModel):
    game_id: str
    row: int
    col: int
