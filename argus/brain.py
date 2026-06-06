"""Groq LLM brain for Mythos — direct analytical voice advisor."""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from browser_service import handle_browser_actions, handle_camera_actions, handle_shutdown
from dev_service import handle_dev_actions
from github_service import PENTAPROTOCOL_CONTEXT
from memory_service import get_memories_text, handle_memory_actions
from news_service import get_news_text
from stats_service import get_project_stats_text
from weather_service import get_weather_text

MODEL = "llama-3.3-70b-versatile"

MYTHOS_PERSONA = """You are Mythos, a direct, analytical personal voice advisor.
You communicate via voice — the user speaks to you through a microphone and hears your replies aloud.
You are not a friendly chatbot. You give concise, evidence-based guidance.
You have access to live PentaProtocol project stats, news headlines, browser or system actions, and developer tools when requested.
You can read files and push to git when asked.
State uncertainty plainly. Prefer actionable recommendations over encouragement.
Keep spoken responses short (2–4 sentences) unless the user asks for detail.
Do not use markdown formatting in replies — plain sentences only.
Never claim you cannot hear audio or that you only accept text input.

When the user asks you to open a website, search something, or navigate somewhere,
start your reply with "Opening [name]" or "Searching for [query]" so the browser
action can be triggered.

When user asks to search YouTube for something, start reply with
"Searching YouTube for [term]" so the action triggers.

When user asks to play or watch a video, start reply with
"Playing [title] on YouTube" so the video action triggers.

When the user asks to shut down their laptop, confirm briefly and include the
phrase "shutting down your laptop" in your reply. Only shut down on explicit
phrases like "shut down my laptop" — not for "go to sleep" or "sleep mode".

When the user says "go to sleep" or wants to stop listening, say you will stop
listening and wait for the wake word again. Do not shut down the laptop.

When user asks to open camera, start reply with "Opening camera".
When user asks to close or stop the camera, start reply with "Closing camera".
When user asks to take a photo, start reply with "Taking photo".

When the user asks to push to git, ask for confirmation before pushing.
Use the phrase "About to push with message: [message]. Confirm?" and wait for yes or confirm."""


def build_system_prompt(
    *,
    now: Optional[datetime] = None,
    project_stats: Optional[str] = None,
    news: Optional[str] = None,
    memories: Optional[str] = None,
    weather: Optional[str] = None,
) -> str:
    """Assemble the Mythos system prompt with live context and placeholders."""
    current = now or datetime.now(timezone.utc)
    local_line = current.astimezone().strftime("%A, %B %d, %Y — %I:%M %p %Z")
    stats_block = project_stats or "[Project stats unavailable.]"
    news_block = news or "[News unavailable.]"
    memories_block = memories or get_memories_text()
    weather_block = weather or get_weather_text()

    return f"""{MYTHOS_PERSONA}

{memories_block}

PENTAPROTOCOL CONTEXT:
{PENTAPROTOCOL_CONTEXT}

CURRENT DATE AND TIME:
{local_line}

PROJECT STATS:
{stats_block}

WEATHER:
{weather_block}

NEWS:
{news_block}
"""


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
        self._pending_git_push: str | None = None
        self._refresh_system_prompt()

    def _refresh_system_prompt(self) -> None:
        self._system_prompt = build_system_prompt(
            project_stats=get_project_stats_text(),
            news=get_news_text(),
            memories=get_memories_text(),
            weather=get_weather_text(),
        )

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

        handle_memory_actions(text)

        dev_result = handle_dev_actions(
            text,
            pending_git_push=self._pending_git_push,
        )
        self._pending_git_push = dev_result.pending_git_push
        if dev_result.reply is not None:
            self._history.append({"role": "user", "content": text})
            self._history.append({"role": "assistant", "content": dev_result.reply})
            return dev_result.reply

        self._refresh_system_prompt()

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
        handle_camera_actions(text, reply)
        handle_browser_actions(text, reply)
        handle_shutdown(text, reply)
        return reply
