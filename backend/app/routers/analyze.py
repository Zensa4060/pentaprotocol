from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.analyzer import analyze_game


router = APIRouter()


VALID_PATTERN_POOLS: dict[int, set[str]] = {
    5: {"V", "L", "ZZ-5", "T", "LINE", "DIAGONAL"},
    6: {"ZZ", "T", "L", "Y", "LINE", "DIAGONAL", "A"},
    7: {"Y", "L", "T", "V", "C", "zigzag", "LINE", "DIAGONAL"},
}


class MoveEntry(BaseModel):
    player: str = Field(..., min_length=2, max_length=2)
    row: int = Field(..., ge=0, le=6)
    col: int = Field(..., ge=0, le=6)

    @field_validator("player")
    @classmethod
    def _validate_player(cls, v: str) -> str:
        if v not in ("P1", "P2"):
            raise ValueError("player must be 'P1' or 'P2'")
        return v


class AnalyzeRequest(BaseModel):
    board_size: int
    selected_patterns: list[str] = Field(..., min_length=1, max_length=32)
    move_history: list[MoveEntry] = Field(..., min_length=2, max_length=128)

    @field_validator("board_size")
    @classmethod
    def _validate_board_size(cls, v: int) -> int:
        if v not in (5, 6, 7):
            raise ValueError("board_size must be 5, 6, or 7")
        return v

    @field_validator("selected_patterns")
    @classmethod
    def _validate_selected_patterns(cls, v: list[str], info) -> list[str]:
        data = info.data or {}
        bs = data.get("board_size")
        if bs not in VALID_PATTERN_POOLS:
            # board_size validator will raise a clearer error; keep this safe.
            return v
        allowed = VALID_PATTERN_POOLS[bs]
        bad = [p for p in v if p not in allowed]
        if bad:
            raise ValueError(
                f"Invalid selected_patterns for {bs}x{bs}: {bad}. Allowed: {sorted(allowed)}"
            )
        return v

    @field_validator("move_history")
    @classmethod
    def _validate_move_history(cls, v: list[MoveEntry]) -> list[MoveEntry]:
        if len(v) < 2:
            raise ValueError("move_history must have at least 2 moves")
        return v


@router.post("/game")
async def analyze_game_endpoint(req: AnalyzeRequest):
    try:
        payload = [
            {"player": m.player, "row": m.row, "col": m.col}
            for m in req.move_history
        ]
        result = analyze_game(
            board_size=req.board_size,
            selected_patterns=req.selected_patterns,
            move_history=payload,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analyze failed: {e}")

