"""Persistent user memory for Mythos — stored in argus/memory.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

_MEMORY_PATH = Path(__file__).resolve().parent / "memory.json"

REMEMBER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bremember that\s+(.+)", re.I),
    re.compile(r"\bkeep in mind that\s+(.+)", re.I),
    re.compile(r"\bdon'?t forget that\s+(.+)", re.I),
    re.compile(r"\bsave that\s+(.+)", re.I),
    re.compile(r"\bnote that\s+(.+)", re.I),
]

SAVE_TRIGGER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bremember that\b", re.I),
    re.compile(r"\bkeep in mind that\b", re.I),
    re.compile(r"\bdon'?t forget that\b", re.I),
    re.compile(r"\bsave that\b", re.I),
    re.compile(r"\bnote that\b", re.I),
]

QUESTION_START = re.compile(
    r"^\s*(what|who|whom|whose|why|how|when|where|which|"
    r"is|are|was|were|do|does|did|can|could|should|would|will|shall|"
    r"have|has|had|am)\b",
    re.I,
)

MIN_MEMORY_WORDS = 5

FORGET_PATTERN = re.compile(r"\bforget about\s+(.+)", re.I)


def _ensure_memory_file() -> None:
    if not _MEMORY_PATH.exists():
        _MEMORY_PATH.write_text("{}\n", encoding="utf-8")


def _load_raw() -> dict[str, str]:
    _ensure_memory_file()
    try:
        data = json.loads(_MEMORY_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        print(f"Memory error: could not read {_MEMORY_PATH} ({exc})")
        return {}
    if not isinstance(data, dict):
        print("Memory error: memory.json must be a JSON object")
        return {}
    return {str(k): str(v) for k, v in data.items()}


def _write_all(memories: dict[str, str]) -> None:
    _ensure_memory_file()
    _MEMORY_PATH.write_text(
        json.dumps(memories, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def save_memory(key: str, value: str) -> bool:
    """Save or update a memory entry."""
    memory_key = (key or "").strip()
    memory_value = (value or "").strip()
    if not memory_key or not memory_value:
        return False
    memories = _load_raw()
    memories[memory_key] = memory_value
    _write_all(memories)
    print(f"Memory saved: {memory_key} = {memory_value}")
    return True


def get_all_memories() -> dict[str, str]:
    """Return all stored memories."""
    return _load_raw()


def get_memories_text() -> str:
    """Format memories for the Mythos system prompt."""
    memories = get_all_memories()
    if not memories:
        return "USER MEMORIES:\n[No stored memories yet.]"
    lines = [f"- {key} = {value}" for key, value in memories.items()]
    return "USER MEMORIES:\n" + "\n".join(lines)


def delete_memory(key: str) -> bool:
    """Remove a memory by exact key."""
    memory_key = (key or "").strip()
    if not memory_key:
        return False
    memories = _load_raw()
    if memory_key not in memories:
        return False
    del memories[memory_key]
    _write_all(memories)
    print(f"Memory deleted: {memory_key}")
    return True


def _clean_phrase(text: str) -> str:
    return text.strip().strip(" ,.!?;:\"'")


def _parse_memory_content(content: str) -> tuple[str, str] | None:
    cleaned = _clean_phrase(content)
    if not cleaned:
        return None

    is_match = re.match(r"^(.+)\s+is\s+(.+)$", cleaned, re.I)
    if is_match:
        key, value = is_match.group(1).strip(), is_match.group(2).strip()
        if key and value:
            return key, value

    if "=" in cleaned:
        key, _, value = cleaned.partition("=")
        key, value = key.strip(), value.strip()
        if key and value:
            return key, value

    return None


def _has_save_trigger(text: str) -> bool:
    return any(pattern.search(text) for pattern in SAVE_TRIGGER_PATTERNS)


def _is_question(text: str) -> bool:
    stripped = text.strip()
    if stripped.endswith("?"):
        return True
    return bool(QUESTION_START.match(stripped))


def _has_assignment(text: str) -> bool:
    return bool(re.search(r"\s+is\s+", text, re.I)) or "=" in text


def _word_count(text: str) -> int:
    return len(text.split())


def _should_attempt_save(text: str, assignment: str) -> bool:
    if not _has_save_trigger(text):
        return False
    if _is_question(text):
        return False
    if not _has_assignment(assignment):
        return False
    if _word_count(assignment) < MIN_MEMORY_WORDS:
        return False
    return True


def _find_memory_keys(query: str) -> list[str]:
    needle = _clean_phrase(query).lower()
    if not needle:
        return []
    memories = get_all_memories()
    exact = [key for key in memories if key.lower() == needle]
    if exact:
        return exact
    return [key for key in memories if needle in key.lower()]


def handle_memory_actions(user_query: str) -> bool:
    """Save or delete memories from voice phrasing. Returns True if memory changed."""
    text = (user_query or "").strip()
    if not text:
        return False

    forget_match = FORGET_PATTERN.search(text)
    if forget_match:
        target = _clean_phrase(forget_match.group(1))
        keys = _find_memory_keys(target)
        if not keys:
            print(f"Memory not found for forget request: {target}")
            return False
        changed = False
        for key in keys:
            changed = delete_memory(key) or changed
        return changed

    for pattern in REMEMBER_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        content = match.group(1)
        if not _should_attempt_save(text, content):
            return False
        parsed = _parse_memory_content(content)
        if parsed:
            return save_memory(*parsed)
        return False

    return False
