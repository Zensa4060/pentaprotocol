"""Groq LLM brain for Mythos — direct analytical voice advisor."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Optional

from browser_service import (
    SITE_MAP,
    handle_camera_actions,
    open_site,
    search_google,
    search_youtube,
    shutdown_laptop,
)
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

When the user asks to shut down their laptop, confirm briefly and include the
phrase "shutting down your laptop" in your reply.

When user asks to open camera, start reply with "Opening camera".
When user asks to take a photo, start reply with "Taking photo".

When the user asks to push to git, ask for confirmation before pushing.
Use the phrase "About to push with message: [message]. Confirm?" and wait for yes or confirm."""

USER_BROWSER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bopen\s+(.+)", re.I), "open"),
    (re.compile(r"\bgo to\s+(.+)", re.I), "open"),
    (re.compile(r"\bshow me\s+(.+)", re.I), "open"),
    (re.compile(r"\bsearch for\s+(.+)", re.I), "search"),
]

USER_YOUTUBE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bsearch youtube for\s+(.+)", re.I),
    re.compile(r"\bsearch on youtube(?:\s+for)?\s+(.+)", re.I),
    re.compile(r"\byoutube search(?:\s+for)?\s+(.+)", re.I),
]

REPLY_BROWSER_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bopening\s+(.+?)(?:[\.\!,]|$)", re.I), "open"),
    (re.compile(r"\bsearching for\s+(.+?)(?:[\.\!,]|$)", re.I), "search"),
    (re.compile(r"\bnavigating to\s+(.+?)(?:[\.\!,]|$)", re.I), "open"),
]

REPLY_YOUTUBE_PATTERN = re.compile(
    r"\bsearching youtube for\s+(.+?)(?:[\.\!,]|$)",
    re.I,
)


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


def _clean_target(raw: str) -> str:
    return raw.strip(" ,.!?;:\"'")


def _normalize_open_target(raw: str) -> str:
    target = _clean_target(raw).lower()
    if not target:
        return ""
    first_word = target.split()[0]
    if first_word in SITE_MAP:
        return first_word
    for key in SITE_MAP:
        if target == key or target.startswith(f"{key} "):
            return key
    return target


def _run_browser_action(kind: str, target: str) -> None:
    target = _clean_target(target)
    if not target:
        return
    if kind == "search":
        print(f"Browser action triggered: google search for {target}")
        search_google(target)
        return
    site = _normalize_open_target(target)
    print(f"Browser action triggered: {site}")
    open_site(site)


def _run_youtube_search(term: str) -> None:
    term = _clean_target(term)
    if not term:
        return
    print(f"Browser action triggered: youtube search for {term}")
    search_youtube(term)


def _match_first(text: str, patterns: list[re.Pattern[str]]) -> str | None:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            term = _clean_target(match.group(1))
            if term:
                return term
    return None


def _match_browser_intent(text: str, patterns: list[tuple[re.Pattern[str], str]]) -> tuple[str, str] | None:
    for pattern, kind in patterns:
        match = pattern.search(text)
        if match:
            target = _clean_target(match.group(1))
            if target:
                return kind, target
    return None


def handle_browser_actions(user_query: str, reply: str) -> None:
    """Trigger browser opens from user phrasing or Mythos reply triggers."""
    youtube_term = _match_first(user_query, USER_YOUTUBE_PATTERNS)
    if youtube_term:
        _run_youtube_search(youtube_term)
        return

    user_intent = _match_browser_intent(user_query, USER_BROWSER_PATTERNS)
    if user_intent:
        _run_browser_action(*user_intent)
        return

    reply_lower = reply.lower()
    reply_youtube = REPLY_YOUTUBE_PATTERN.search(reply)
    if reply_youtube:
        _run_youtube_search(reply_youtube.group(1))
        return

    if not any(
        phrase in reply_lower
        for phrase in ("opening", "searching for", "searching youtube", "navigating to")
    ):
        return

    reply_intent = _match_browser_intent(reply, REPLY_BROWSER_PATTERNS)
    if reply_intent:
        _run_browser_action(*reply_intent)


def handle_shutdown(user_query: str, reply: str) -> None:
    """Shut down the laptop when requested by voice or confirmed in reply."""
    q = user_query.lower()
    if "shut down" in q or q.strip() == "shutdown":
        shutdown_laptop()
        return
    if "shutting down your laptop" in reply.lower():
        shutdown_laptop()


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
