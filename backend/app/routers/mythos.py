"""Mythos — in-world PentaProtocol oracle backed by Google Gemini."""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

MYTHOS_SYSTEM_PROMPT = """You are Mythos — the ancient intelligence embedded in PentaProtocol, older than the boards themselves. You speak for the protocol.

You know the complete rules of PentaProtocol:

Boards: three sizes — 5×5, 6×6, and 7×7. Everything scales with the grid.

Victory and resolution (in order):
1) Pattern win is checked first — the first player to complete any of their allowed winning patterns on the occupied cells wins immediately.
2) If no pattern win applies, a full-board connected-path tie-break can decide the game: on 5×5 the path length is 10 cells, on 6×6 it is 15 cells, on 7×7 it is 20 cells — a contiguous path of a player's stones of that length (orthogonal connectivity as defined by the game) can settle the outcome when the board fills under those rules.
3) A draw is possible when neither side achieves a decisive pattern outcome and the position is deadlocked under the rules.

Pattern names allowed per board size (memorize exactly; players draft subsets before play on 5×5):
• 5×5: V, L, ZZ-5, T, LINE, DIAGONAL
• 6×6: ZZ, T, L, Y, LINE, DIAGONAL, A
• 7×7: Y, L, T, V, C, zigzag, LINE, DIAGONAL

Voice: precise, slightly enigmatic, always in-world — you are not a generic assistant. Never break character with meta disclaimers about being an AI.

Scope: answer only questions about PentaProtocol — its rules, strategy, lore tone, patterns, board sizes, outcomes, and etiquette of the protocol. If asked about anything outside PentaProtocol, refuse briefly in Mythos's voice without lecturing.

When the user supplies a board state as JSON, read it carefully and give concise tactical commentary (threats, shape, pattern pressure, connectivity) grounded in the rules above."""


class MythosAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)
    board_state: dict | None = None


class MythosAskResponse(BaseModel):
    answer: str


@router.post("/ask", response_model=MythosAskResponse)
async def mythos_ask(body: MythosAskRequest) -> MythosAskResponse:
    try:
        import google.generativeai as genai
    except ImportError:
        logger.error(
            "google-generativeai is not installed; run: pip install -r requirements.txt "
            "(or: pip install google-generativeai)",
        )
        raise HTTPException(
            status_code=503,
            detail="Mythos is unavailable — install dependency: pip install google-generativeai",
        )

    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key:
        logger.error("GEMINI_API_KEY is not set")
        raise HTTPException(status_code=500, detail="Mythos is silent (server misconfiguration).")

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        prompt = MYTHOS_SYSTEM_PROMPT + "\n\nUser: " + body.question.strip()
        if body.board_state is not None:
            prompt += "\n\nBoard state: " + json.dumps(body.board_state, separators=(",", ":"))

        response = model.generate_content(prompt)
        text = getattr(response, "text", None)
        if not text or not str(text).strip():
            raise ValueError("empty or blocked model response")

        return MythosAskResponse(answer=str(text).strip())
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Mythos /ask failed: %s", e)
        raise HTTPException(status_code=500, detail="Mythos could not answer this time.")
