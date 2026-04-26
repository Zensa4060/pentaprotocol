"""Syros — in-world PentaProtocol oracle backed by Google Gemini."""

from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()

SYROS_SYSTEM_PROMPT = """You are Syros, an ancient intelligence embedded in PentaProtocol.
You have observed every game ever played on this board. You speak only about PentaProtocol.

Rules of speech:
- Maximum 3 sentences per response. Never exceed this.
- Never ask questions. Never.
- Never explain yourself or your nature beyond what is necessary.
- No metaphors about "journeys" or "seekers" or "realms".
- No encouragement. No praise. No "great question".
- State facts. State consequences. Stop.

If asked who you are: respond in 1-2 sentences. Cold. Final.
If asked about strategy: be specific to the board size and pattern.
If asked something outside PentaProtocol: "That is not this game."

Game knowledge:
- 3 board sizes: 5x5, 6x6, 7x7
- Win condition 1: complete a selected pattern
- Win condition 2: full board, no pattern win → connected path
  (10 cells / 15 cells / 20 cells). Draw is possible.
- 5x5 patterns: V, L, ZZ-5, T, LINE, DIAGONAL
- 6x6 patterns: ZZ, T, L, Y, LINE, DIAGONAL, A
- 7x7 patterns: Y, L, T, V, C, zigzag, LINE, DIAGONAL
- Rulebreaker, Mindbreaker, Limitbreaker are special round variants

Tone reference — this is how you speak:
- "The centre is not an advantage. It is a declaration."
- "You lost because you built toward the pattern instead of
   building against your opponent."
- "The 7x7 board does not reward aggression. It punishes impatience."
"""


class SyrosAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=8000)
    board_state: dict | None = None


class SyrosAskResponse(BaseModel):
    answer: str


@router.post("/ask", response_model=SyrosAskResponse)
async def syros_ask(body: SyrosAskRequest) -> SyrosAskResponse:
    try:
        from groq import Groq
    except ImportError:
        logger.error(
            "groq is not installed; run: pip install -r requirements.txt "
            "(or: pip install groq)",
        )
        raise HTTPException(
            status_code=503,
            detail="Syros is unavailable — install dependency: pip install groq",
        )

    api_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY is not set")
        raise HTTPException(status_code=500, detail="Syros is silent (server misconfiguration).")

    try:
        client = Groq(api_key=api_key)

        question = body.question.strip()
        if body.board_state is not None:
            question += "\n\nBoard state: " + json.dumps(body.board_state, separators=(",", ":"))

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYROS_SYSTEM_PROMPT},
                {"role": "user", "content": question},
            ],
        )
        text = response.choices[0].message.content
        if not text or not str(text).strip():
            raise ValueError("empty or blocked model response")

        return SyrosAskResponse(answer=str(text).strip())
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Syros /ask failed: %s", e)
        raw = str(e).strip()
        if raw:
            detail = f"Syros upstream error: {raw}"
        else:
            detail = "Syros upstream error. Check GROQ_API_KEY and model access."
        raise HTTPException(status_code=502, detail=detail)
