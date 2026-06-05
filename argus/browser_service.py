"""Browser control for Argus — open URLs and sites via webbrowser."""
from __future__ import annotations

import urllib.parse
import webbrowser

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


def open_site(name: str) -> bool:
    """Open a known site by name, or Google search if unknown."""
    key = (name or "").strip().lower()
    if not key:
        return False
    url = SITE_MAP.get(key)
    if url:
        return webbrowser.open(url)
    return search_google(name)
