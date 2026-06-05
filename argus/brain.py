"""Groq LLM brain for Argus — direct analytical advisor."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Optional

from browser_service import open_site, search_google
from github_service import PENTAPROTOCOL_CONTEXT

MODEL = "llama-3.3-70b-versatile"

ARGUS_PERSONA = """You are Argus, a direct, analytical personal advisor.
You are not a friendly chatbot. You give concise, evidence-based guidance.
State uncertainty plainly. Prefer actionable recommendations over encouragement.
Keep spoken responses short (2–4 sentences) unless the user asks for detail.
Do not use markdown formatting in replies — plain sentences only.

When the user asks you to open a website, search something, or navigate somewhere,
start your reply with "Opening [name]" or "Searching for [query]" so the browser
action can be triggered."""

USER_BROWSER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bsearch for\s+(.+)", re.I), "search"),
    (re.compile(r"\bopen\s+(.+)", re.I), "open"),
    (re.compile(r"\bgo to\s+(.+)", re.I), "open"),
    (re.compile(r"\bshow me\s+(.+)", re.I), "open"),
]

REPLY_BROWSER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bopening\s+(.+?)(?:[\.!]|$)", re.I), "open"),
    (re.compile(r"\bsearching for\s+(.+?)(?:[\.!]|$)", re.I), "search"),
    (re.compile(r"\bnavigating to\s+(.+?)(?:[\.!]|$)", re.I), "open"),
]


def build_system_prompt(*, now: Optional[datetime] = None) -> str:
    """Assemble the Argus system prompt with live context and placeholders."""
    current = now or datetime.now(timezone.utc)
    local_line = current.astimezone().strftime("%A, %B %d, %Y — %I:%M %p %Z")

    return f"""{ARGUS_PERSONA}

PENTAPROTOCOL CONTEXT:
{PENTAPROTOCOL_CONTEXT}

CURRENT DATE AND TIME:
{local_line}

PROJECT STATS:
[Pending dynamic integration — will be filled with live API metrics.]

WEATHER:
[Pending dynamic integration — will be filled with local weather data.]

NEWS:
[Pending dynamic integration — will be filled with curated headlines.]
"""


def _clean_target(raw: str) -> str:
    return raw.strip(" ,.!?;:\"'")


def _run_browser_action(kind: str, target: str) -> None:
    target = _clean_target(target)
    if not target:
        return
    if kind == "search":
        search_google(target)
    else:
        open_site(target)


def _match_browser_intent(text: str, patterns: list[tuple[re.Pattern[str], str]]) -> tuple[str, str] | None:
    for pattern, kind in patterns:
        match = pattern.search(text)
        if match:
            target = _clean_target(match.group(1))
            if target:
                return kind, target
    return None


def handle_browser_actions(user_query: str, reply: str) -> None:
    """Trigger browser opens from user phrasing or Argus reply triggers."""
    user_intent = _match_browser_intent(user_query, USER_BROWSER_PATTERNS)
    if user_intent:
        _run_browser_action(*user_intent)
        return

    reply_lower = reply.lower()
    if not any(
        phrase in reply_lower
        for phrase in ("opening", "searching for", "navigating to")
    ):
        return

    reply_intent = _match_browser_intent(reply, REPLY_BROWSER_PATTERNS)
    if reply_intent:
        _run_browser_action(*reply_intent)


class ArgusBrain:
    """Session-scoped Groq chat with rolling conversation history."""

    def __init__(self) -> None:
        api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError("GROQ_API_KEY is not set")
        try:
            from groq import Groq
        except ImportError as exc:
            raise RuntimeError(
                "groq package is not installed — run: pip install groq"
            ) from exc
        self._client = Groq(api_key=api_key)
        self._history: list[dict[str, str]] = []
        self._system_prompt = build_system_prompt()

    def reset_history(self) -> None:
        """Clear session conversation (system prompt is retained)."""
        self._history.clear()

    @property
    def history_length(self) -> int:
        return len(self._history)

    def ask(self, user_message: str) -> str:
        """Send a user turn to Groq and return the assistant reply."""
        text = (user_message or "").strip()
        if not text:
            return "I did not catch a question."

        self._history.append({"role": "user", "content": text})

        messages = [{"role": "system", "content": self._system_prompt}]
        messages.extend(self._history)

        response = self._client.chat.completions.create(
            model=MODEL,
            messages=messages,
        )
        reply = (response.choices[0].message.content or "").strip()
        if not reply:
            reply = "No response from the model."

        self._history.append({"role": "assistant", "content": reply})
        handle_browser_actions(text, reply)
        return reply
