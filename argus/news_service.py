"""News headlines for Mythos via NewsAPI."""
from __future__ import annotations

import os
import time
from typing import Any, Optional

import requests

CACHE_TTL_SECONDS = 1800
REQUEST_TIMEOUT = 20
TOP_HEADLINES_URL = "https://newsapi.org/v2/top-headlines"
EVERYTHING_URL = "https://newsapi.org/v2/everything"

_headlines_cache: Optional[list[dict[str, str]]] = None
_cache_at: float = 0.0


def _api_key() -> str | None:
    key = (os.getenv("NEWS_API_KEY") or "").strip()
    if not key:
        print("News error: NEWS_API_KEY is not set")
        return None
    return key


def _article_row(article: dict[str, Any]) -> dict[str, str]:
    source = article.get("source") or {}
    return {
        "title": str(article.get("title") or "").strip(),
        "source": str(source.get("name") or "Unknown").strip(),
        "url": str(article.get("url") or "").strip(),
    }


def _fetch_via_requests(url: str, params: dict[str, Any]) -> dict[str, Any] | None:
    api_key = _api_key()
    if not api_key:
        return None

    try:
        response = requests.get(
            url,
            params={**params, "apiKey": api_key},
            timeout=REQUEST_TIMEOUT,
        )
        if not response.ok:
            print(f"News error: HTTP {response.status_code} from {url}")
            return None
        data = response.json()
        if not isinstance(data, dict):
            print("News error: unexpected response format")
            return None
        if data.get("status") != "ok":
            message = data.get("message") or "unknown error"
            print(f"News error: {message}")
            return None
        return data
    except requests.RequestException as exc:
        print(f"News error: {exc}")
        return None
    except ValueError as exc:
        print(f"News error: invalid JSON ({exc})")
        return None


def _fetch_via_newsapi_client(method: str, **params: Any) -> dict[str, Any] | None:
    try:
        from newsapi import NewsApiClient
    except ImportError:
        return None

    api_key = _api_key()
    if not api_key:
        return None

    try:
        client = NewsApiClient(api_key=api_key)
        if method == "top_headlines":
            data = client.get_top_headlines(**params)
        elif method == "everything":
            data = client.get_everything(**params)
        else:
            return None
        return data if isinstance(data, dict) else None
    except Exception as exc:
        print(f"News error: {exc}")
        return None


def _articles_from_response(data: dict[str, Any] | None) -> list[dict[str, str]]:
    if not data:
        return []
    articles = data.get("articles") or []
    rows = [_article_row(a) for a in articles if isinstance(a, dict) and a.get("title")]
    return [row for row in rows if row["title"]]


def get_top_headlines(language: str = "en", page_size: int = 5) -> list[dict[str, str]]:
    """Top headlines for a country. Returns title, source, url per item."""
    params = {"language": language, "pageSize": page_size}

    data = _fetch_via_newsapi_client("top_headlines", language=language, page_size=page_size)
    if data is None:
        data = _fetch_via_requests(TOP_HEADLINES_URL, params)
    return _articles_from_response(data)


def get_tech_news(page_size: int = 3) -> list[dict[str, str]]:
    """Tech-related articles from NewsAPI search."""
    params = {
        "q": "AI OR startup OR technology",
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
    }

    data = _fetch_via_newsapi_client(
        "everything",
        q=params["q"],
        language=params["language"],
        sort_by=params["sortBy"],
        page_size=page_size,
    )
    if data is None:
        data = _fetch_via_requests(EVERYTHING_URL, params)
    return _articles_from_response(data)


def _fetch_headlines_cached(*, force: bool = False) -> list[dict[str, str]]:
    global _headlines_cache, _cache_at

    now = time.time()
    if (
        not force
        and _headlines_cache is not None
        and (now - _cache_at) < CACHE_TTL_SECONDS
    ):
        return _headlines_cache

    headlines = get_top_headlines()
    if headlines:
        _headlines_cache = headlines
        _cache_at = now
    return _headlines_cache or []


def format_news_headlines(headlines: Optional[list[dict[str, str]]]) -> str:
    """Format headlines for the Mythos system prompt."""
    if not headlines:
        return "[News unavailable — API fetch failed or not configured.]"

    lines = [
        f"{index}. {item['title']} - {item['source']}"
        for index, item in enumerate(headlines, start=1)
    ]
    return "\n".join(lines)


def get_news_text(*, force: bool = False) -> str:
    """Cached top headlines formatted for the system prompt (30-minute TTL)."""
    return format_news_headlines(_fetch_headlines_cached(force=force))
