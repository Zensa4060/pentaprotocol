"""Browser control for Argus — open URLs and sites via webbrowser."""
from __future__ import annotations

import os
import subprocess
import urllib.parse
import webbrowser

from camera_service import open_camera, take_photo

SITE_MAP: dict[str, str] = {
    "youtube": "https://youtube.com",
    "gmail": "https://gmail.com",
    "github": "https://github.com",
    "railway": "https://railway.app",
    "vercel": "https://vercel.com",
    "mongodb": "https://cloud.mongodb.com",
    "supabase": "https://supabase.com",
    "pentaprotocol": "https://pentaprotocol.com",
}

DOMAIN_SUFFIXES = (".com", ".io", ".app", ".ai", ".org")


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


def open_site(name: str) -> bool:
    """Open a known site by name, direct domain, or Google search if unknown."""
    key = (name or "").strip().lower()
    if not key:
        return False
    url = SITE_MAP.get(key)
    if url:
        return webbrowser.open(url)
    if _is_direct_domain(name):
        return open_url(_domain_candidate(name))
    return search_google(name)


def shutdown_laptop() -> None:
    os.system("shutdown /s /t 5")


def handle_camera_actions(user_query: str, reply: str) -> None:
    """Open camera or take a photo from voice phrasing or Argus reply triggers."""
    q = user_query.lower()
    r = reply.lower()

    if "open camera" in q or "show camera" in q:
        open_camera()
        return
    if "take a photo" in q or "take a picture" in q:
        take_photo()
        return

    if "opening camera" in r:
        open_camera()
        return
    if "taking photo" in r:
        take_photo()
