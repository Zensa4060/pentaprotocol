"""Browser control for Argus — open URLs and sites via webbrowser."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import urllib.parse
import webbrowser
from pathlib import Path

import requests

from camera_service import close_camera, open_camera, take_photo

SITE_MAP: dict[str, str] = {
    "youtube": "https://youtube.com",
    "gmail": "https://gmail.com",
    "github": "https://github.com",
    "railway": "https://railway.app",
    "vercel": "https://vercel.com",
    "mongodb": "https://cloud.mongodb.com",
    "supabase": "https://supabase.com",
    "pentaprotocol": "https://pentaprotocol.com",
    "amazon": "https://amazon.in",
}

# Desktop apps — launched locally; fall back to web URLs if unavailable.
APP_MAP: dict[str, dict[str, object]] = {
    "spotify": {
        "aliases": ("spotify",),
        "commands": ("spotify",),
        "paths": (),
        "fallback_url": "https://open.spotify.com",
    },
    "vscode": {
        "aliases": ("vscode", "vs code"),
        "commands": ("code",),
        "paths": (),
        "fallback_url": "https://vscode.dev",
    },
    "chrome": {
        "aliases": ("chrome",),
        "commands": ("chrome",),
        "paths": (
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ),
        "fallback_url": "https://www.google.com/chrome/",
    },
}

APP_ALIASES: dict[str, str] = {
    alias: app_key
    for app_key, config in APP_MAP.items()
    for alias in config["aliases"]  # type: ignore[index]
}

DOMAIN_SUFFIXES = (".com", ".io", ".app", ".ai", ".org", ".in")

SHUTDOWN_PHRASES = (
    "shut down my laptop",
    "shutdown my laptop",
    "turn off my laptop",
    "power off my laptop",
)

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

USER_YOUTUBE_PLAY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bplay\s+(.+?)\s+on youtube\b", re.I),
    re.compile(r"\byoutube play\s+(.+)", re.I),
    re.compile(r"\bwatch\s+(.+)", re.I),
    re.compile(r"\bplay\s+(.+)", re.I),
]

USER_AMAZON_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bsearch on amazon for\s+(.+)", re.I),
    re.compile(r"\bsearch amazon for\s+(.+)", re.I),
    re.compile(r"\bsearch on amazon\.in for\s+(.+)", re.I),
    re.compile(r"\bsearch amazon\.in for\s+(.+)", re.I),
    re.compile(r"\bsearch for\s+(.+?)\s+on amazon(?:\.in)?\b", re.I),
    re.compile(r"\bsearch for\s+(.+?)\s+from amazon(?:\.in)?\b", re.I),
    re.compile(r"\bsearch for\s+amazon(?:\.in)?\s+(.+)", re.I),
    re.compile(r"\b(?:find|look for)\s+(.+?)\s+(?:on|from)\s+amazon(?:\.in)?\b", re.I),
    re.compile(r"\bamazon(?:\.in)?\s+for\s+(.+)", re.I),
    re.compile(r"\bon amazon(?:\.in)?\s+(?:for\s+)?(.+)", re.I),
    re.compile(r"\bfrom amazon(?:\.in)?\s+(?:for\s+)?(.+)", re.I),
    re.compile(r".*\bon amazon(?:\.in)?\b.*\bfor\s+(.+)", re.I),
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

REPLY_YOUTUBE_PLAY_PATTERN = re.compile(
    r"\bplaying\s+(.+?)\s+on youtube(?:[\.\!,]|$)",
    re.I,
)

YOUTUBE_SEARCH_URL = "https://www.youtube.com/results"
YOUTUBE_REQUEST_TIMEOUT = 15
YOUTUBE_VIDEO_ID_PATTERN = re.compile(r'"videoId":"([a-zA-Z0-9_-]{11})"')
YOUTUBE_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _domain_candidate(name: str) -> str:
    candidate = (name or "").strip().lower()
    if not candidate:
        return ""
    if candidate.startswith(("http://", "https://")):
        return candidate
    first = candidate.split()[0].strip(" ,.!?;:")
    return first


def _is_direct_domain(name: str) -> bool:
    candidate = _domain_candidate(name)
    if not candidate:
        return False
    if candidate.startswith(("http://", "https://")):
        return True
    return any(candidate.endswith(suffix) for suffix in DOMAIN_SUFFIXES)


def _spotify_exe_paths() -> list[Path]:
    paths: list[Path] = []
    appdata = os.environ.get("APPDATA", "").strip()
    if appdata:
        paths.append(Path(appdata) / "Spotify" / "Spotify.exe")
    username = os.environ.get("USERNAME", "").strip()
    if username:
        paths.append(
            Path(f"C:/Users/{username}/AppData/Roaming/Spotify/Spotify.exe")
        )
    return paths


def _is_app_key(key: str) -> bool:
    return key in APP_MAP


def _launch_executable(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        if hasattr(os, "startfile"):
            os.startfile(str(path))  # type: ignore[attr-defined]
        else:
            subprocess.Popen([str(path)], shell=False)
        return True
    except OSError as exc:
        return False


def _launch_command(command: str) -> bool:
    token = command.strip().split()[0]
    if not token or shutil.which(token) is None:
        return False
    try:
        subprocess.Popen(command, shell=True)
        return True
    except OSError:
        return False


def launch_app(name: str) -> bool:
    """Launch a desktop app by key. Falls back to the web version if unavailable."""
    key = APP_ALIASES.get(name.strip().lower(), name.strip().lower())
    config = APP_MAP.get(key)
    if not config:
        return False

    for raw_path in config.get("paths", ()):
        if _launch_executable(Path(str(raw_path))):
            print(f"Browser action triggered: launch {key}")
            return True

    if key == "spotify":
        for path in _spotify_exe_paths():
            if _launch_executable(path):
                print(f"Browser action triggered: launch {key}")
                return True

    for command in config.get("commands", ()):
        if _launch_command(str(command)):
            print(f"Browser action triggered: launch {key}")
            return True

    fallback = str(config.get("fallback_url") or "")
    if fallback:
        return open_url(fallback)

    return False


def open_url(url: str) -> bool:
    """Open a URL in the default browser."""
    target = (url or "").strip()
    if not target:
        return False
    if not target.startswith(("http://", "https://")):
        target = f"https://{target}"
    return webbrowser.open(target)


def search_google(query: str) -> bool:
    """Open a Google search for the given query."""
    q = (query or "").strip()
    if not q:
        return False
    url = "https://www.google.com/search?q=" + urllib.parse.quote_plus(q)
    return webbrowser.open(url)


def search_youtube(query: str) -> None:
    q = (query or "").strip()
    if not q:
        return
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}"
    open_url(url)


def _first_youtube_video_id(query: str) -> str | None:
    q = (query or "").strip()
    if not q:
        return None
    try:
        response = requests.get(
            YOUTUBE_SEARCH_URL,
            params={"search_query": q},
            headers={"User-Agent": YOUTUBE_USER_AGENT},
            timeout=YOUTUBE_REQUEST_TIMEOUT,
        )
        if not response.ok:
            return None
        match = YOUTUBE_VIDEO_ID_PATTERN.search(response.text)
        if match:
            return match.group(1)
        return None
    except requests.RequestException:
        return None


def play_youtube(query: str) -> bool:
    """Open the first YouTube search result video directly."""
    q = (query or "").strip()
    if not q:
        return False

    video_id = _first_youtube_video_id(q)
    if video_id:
        url = f"https://www.youtube.com/watch?v={video_id}&autoplay=1"
        return open_url(url)

    search_youtube(q)
    return False


def search_amazon(query: str) -> None:
    q = (query or "").strip()
    if not q:
        return
    url = f"https://www.amazon.in/s?k={urllib.parse.quote_plus(q)}"
    open_url(url)


def _clean_target(raw: str) -> str:
    return raw.strip(" ,.!?;:\"'")


def _normalize_open_target(raw: str) -> str:
    target = _clean_target(raw).lower()
    if not target:
        return ""

    if target in APP_ALIASES:
        return APP_ALIASES[target]

    for alias, app_key in APP_ALIASES.items():
        if " " in alias and (target == alias or target.startswith(f"{alias} ")):
            return app_key

    if target in SITE_MAP:
        return target

    for key in SITE_MAP:
        if target == key or target.startswith(f"{key} "):
            return key

    first_word = target.split()[0]
    if first_word in APP_ALIASES:
        return APP_ALIASES[first_word]
    if first_word in SITE_MAP:
        return first_word

    for alias, app_key in APP_ALIASES.items():
        if target == alias or target.startswith(f"{alias} "):
            return app_key

    return target


def open_site(name: str) -> bool:
    """Open a known app, site, direct domain, or Google search if unknown."""
    key = _normalize_open_target(name)
    if not key:
        return False
    if _is_app_key(key):
        return launch_app(key)
    url = SITE_MAP.get(key)
    if url:
        return webbrowser.open(url)
    if _is_direct_domain(name):
        return open_url(_domain_candidate(name))
    return search_google(name)


def shutdown_laptop() -> None:
    os.system("shutdown /s /t 5")


def _is_camera_or_photo_query(text: str) -> bool:
    q = text.lower()
    return "camera" in q or "photo" in q


def _is_sleep_query(text: str) -> bool:
    q = text.strip().lower()
    if q in ("sleep", "sleep mode"):
        return True
    return "go to sleep" in q


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


def _run_youtube_play(term: str) -> None:
    term = _clean_target(term)
    if not term:
        return
    print(f"Browser action triggered: youtube play for {term}")
    play_youtube(term)


def _match_youtube_play_term(text: str) -> str | None:
    return _match_first(text, USER_YOUTUBE_PLAY_PATTERNS)


def _run_amazon_search(term: str) -> None:
    term = _clean_target(term)
    if not term:
        return
    print(f"Browser action triggered: amazon search for {term}")
    search_amazon(term)


def _match_first(text: str, patterns: list[re.Pattern[str]]) -> str | None:
    for pattern in patterns:
        match = pattern.search(text)
        if match:
            term = _clean_target(match.group(1))
            if term:
                return term
    return None


def _is_amazon_search_intent(text: str) -> bool:
    lower = text.lower()
    if "amazon" not in lower:
        return False
    return any(token in lower for token in ("search", "find", "look for"))


def _extract_amazon_fallback(text: str) -> str | None:
    """Extract search term when query mentions amazon + search/find but patterns missed."""
    if not _is_amazon_search_intent(text):
        return None

    stripped = re.sub(
        r"^.*?\b(?:search|find|look for)\b\s*(?:on|from)?\s*amazon(?:\.in)?\b(?:\s+for)?\s*",
        "",
        text,
        count=1,
        flags=re.I,
    )
    stripped = re.sub(
        r"^.*?\b(?:search|find|look for)\b\s+for\s+",
        "",
        stripped,
        count=1,
        flags=re.I,
    )
    stripped = re.sub(r"\s+(?:on|from)\s+amazon(?:\.in)?\b.*$", "", stripped, flags=re.I)
    term = _clean_target(stripped)
    if term:
        return term
    return None


def _match_amazon_term(text: str) -> str | None:
    term = _match_first(text, USER_AMAZON_PATTERNS)
    if term:
        return term
    if _is_amazon_search_intent(text):
        return _extract_amazon_fallback(text)
    return None


def _match_browser_intent(
    text: str,
    patterns: list[tuple[re.Pattern[str], str]],
) -> tuple[str, str] | None:
    for pattern, kind in patterns:
        match = pattern.search(text)
        if match:
            target = _clean_target(match.group(1))
            if target:
                return kind, target
    return None


def handle_browser_actions(user_query: str, reply: str) -> None:
    """Trigger browser opens from user phrasing or Mythos reply triggers."""
    if _is_camera_or_photo_query(user_query):
        return
    if _is_sleep_query(user_query):
        return

    amazon_term = _match_amazon_term(user_query)
    if amazon_term:
        _run_amazon_search(amazon_term)
        return

    youtube_play_term = _match_youtube_play_term(user_query)
    if youtube_play_term:
        _run_youtube_play(youtube_play_term)
        return

    youtube_term = _match_first(user_query, USER_YOUTUBE_PATTERNS)
    if youtube_term:
        _run_youtube_search(youtube_term)
        return

    user_intent = _match_browser_intent(user_query, USER_BROWSER_PATTERNS)
    if user_intent:
        _run_browser_action(*user_intent)
        return

    reply_lower = reply.lower()
    reply_youtube_play = REPLY_YOUTUBE_PLAY_PATTERN.search(reply)
    if reply_youtube_play:
        _run_youtube_play(reply_youtube_play.group(1))
        return

    reply_youtube = REPLY_YOUTUBE_PATTERN.search(reply)
    if reply_youtube:
        _run_youtube_search(reply_youtube.group(1))
        return

    if not any(
        phrase in reply_lower
        for phrase in ("opening", "searching for", "searching youtube", "navigating to", "playing")
    ):
        return

    reply_intent = _match_browser_intent(reply, REPLY_BROWSER_PATTERNS)
    if reply_intent:
        _run_browser_action(*reply_intent)


def handle_shutdown(user_query: str, reply: str) -> None:
    """Shut down the laptop only on explicit voice phrases."""
    q = user_query.lower().strip()
    if any(phrase in q for phrase in SHUTDOWN_PHRASES):
        shutdown_laptop()
        return
    if "shutting down your laptop" in reply.lower():
        shutdown_laptop()


def handle_camera_actions(user_query: str, reply: str) -> None:
    """Open, close, or capture from the camera via voice phrasing."""
    q = user_query.lower()
    r = reply.lower()

    if "close camera" in q or "stop camera" in q:
        close_camera()
        return
    if "open camera" in q or "show camera" in q:
        open_camera()
        return
    if "take a photo" in q or "take a picture" in q:
        take_photo()
        return

    if "closing camera" in r:
        close_camera()
        return
    if "opening camera" in r:
        open_camera()
        return
    if "taking photo" in r:
        take_photo()
