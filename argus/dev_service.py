"""Developer tools for Mythos — repo file access and git operations."""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MAX_READ_BYTES = 100_000

READ_FILE_PATTERN = re.compile(r"\bread file\s+(.+)", re.I)
GIT_PUSH_PATTERN = re.compile(r"\bgit push with message\s+(.+)", re.I)
GIT_STATUS_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bwhat files changed\b", re.I),
    re.compile(r"\bgit status\b", re.I),
]

CONFIRM_WORDS = frozenset({"yes", "confirm", "confirmed"})
CANCEL_WORDS = frozenset({"no", "cancel", "abort"})


@dataclass
class DevActionResult:
    reply: str | None = None
    pending_git_push: str | None = None


def _clean_phrase(text: str) -> str:
    return text.strip().strip(" ,.!?;:\"'")


def _resolve_repo_path(relative: str) -> Path | None:
    raw = (relative or "").strip().strip("\"'")
    if not raw:
        return None
    target = (REPO_ROOT / raw.lstrip("/\\")).resolve()
    try:
        target.relative_to(REPO_ROOT.resolve())
    except ValueError:
        return None
    return target


def read_file(filepath: str) -> str:
    """Read a file under the pentaprotocol repo root."""
    target = _resolve_repo_path(filepath)
    if not target:
        return f"Error: path is outside the repo or invalid ({filepath})."
    if not target.exists():
        return f"Error: file not found ({filepath})."
    if not target.is_file():
        return f"Error: not a file ({filepath})."
    try:
        data = target.read_bytes()
        if len(data) > MAX_READ_BYTES:
            text = data[:MAX_READ_BYTES].decode("utf-8", errors="replace")
            return (
                f"Contents of {filepath} (truncated to {MAX_READ_BYTES} bytes):\n"
                f"{text}"
            )
        return f"Contents of {filepath}:\n{data.decode('utf-8', errors='replace')}"
    except OSError as exc:
        return f"Error reading {filepath}: {exc}"


def list_directory(path: str = ".") -> str:
    """List files in a directory under the pentaprotocol repo root."""
    target = _resolve_repo_path(path or ".")
    if not target:
        return f"Error: path is outside the repo or invalid ({path})."
    if not target.exists():
        return f"Error: directory not found ({path})."
    if not target.is_dir():
        return f"Error: not a directory ({path})."
    try:
        entries = sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError as exc:
        return f"Error listing {path}: {exc}"

    if not entries:
        return f"Directory {path} is empty."

    lines = [f"Contents of {path}:"]
    for entry in entries:
        suffix = "/" if entry.is_dir() else ""
        lines.append(f"- {entry.name}{suffix}")
    return "\n".join(lines)


def _run_git(args: list[str]) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        return False, f"Git error: {exc}"

    output = (result.stdout or "").strip()
    error = (result.stderr or "").strip()
    combined = "\n".join(part for part in (output, error) if part)
    if result.returncode != 0:
        return False, combined or f"Git command failed: git {' '.join(args)}"
    return True, combined or f"git {' '.join(args)} completed successfully."


def git_status() -> str:
    """Run git status in the repo root."""
    ok, output = _run_git(["status"])
    if not ok:
        return f"Git status failed:\n{output}"
    return output


def git_push(message: str) -> str:
    """Stage all changes, commit, and push."""
    commit_message = (message or "").strip()
    if not commit_message:
        return "Error: commit message is empty."

    ok, output = _run_git(["add", "."])
    if not ok:
        return f"Git add failed:\n{output}"

    ok, output = _run_git(["commit", "-m", commit_message])
    if not ok:
        if "nothing to commit" in output.lower():
            return "Nothing to commit — working tree clean."
        return f"Git commit failed:\n{output}"

    ok, output = _run_git(["push"])
    if not ok:
        return f"Git commit succeeded but push failed:\n{output}"
    return f"Push successful.\n{output}"


def _is_confirmation(text: str) -> bool:
    words = _clean_phrase(text).lower().split()
    if not words:
        return False
    if _clean_phrase(text).lower() in CONFIRM_WORDS:
        return True
    return words[0] in CONFIRM_WORDS


def _is_cancel(text: str) -> bool:
    normalized = _clean_phrase(text).lower()
    if normalized in CANCEL_WORDS:
        return True
    words = normalized.split()
    return bool(words) and words[0] in CANCEL_WORDS


def handle_dev_actions(
    user_query: str,
    *,
    pending_git_push: str | None = None,
) -> DevActionResult:
    """Handle developer voice commands. Returns a direct reply when matched."""
    text = (user_query or "").strip()
    if not text:
        return DevActionResult(pending_git_push=pending_git_push)

    if pending_git_push:
        if _is_confirmation(text):
            print(f"Dev action triggered: git push ({pending_git_push})")
            result = git_push(pending_git_push)
            return DevActionResult(reply=result, pending_git_push=None)
        if _is_cancel(text):
            return DevActionResult(
                reply="Git push cancelled.",
                pending_git_push=None,
            )
        return DevActionResult(
            reply=(
                f"About to push with message: {pending_git_push}. "
                "Say yes or confirm to proceed, or no to cancel."
            ),
            pending_git_push=pending_git_push,
        )

    read_match = READ_FILE_PATTERN.search(text)
    if read_match:
        filepath = _clean_phrase(read_match.group(1))
        print(f"Dev action triggered: read file {filepath}")
        return DevActionResult(reply=read_file(filepath))

    push_match = GIT_PUSH_PATTERN.search(text)
    if push_match:
        message = _clean_phrase(push_match.group(1))
        if not message:
            return DevActionResult(reply="Error: commit message is empty.")
        print(f"Dev action triggered: git push pending confirmation ({message})")
        return DevActionResult(
            reply=f"About to push with message: {message}. Confirm?",
            pending_git_push=message,
        )

    for pattern in GIT_STATUS_PATTERNS:
        if pattern.search(text):
            print("Dev action triggered: git status")
            return DevActionResult(reply=git_status())

    return DevActionResult(pending_git_push=pending_git_push)
