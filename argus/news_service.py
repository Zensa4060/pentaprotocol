"""News headlines for Mythos via NewsAPI."""
from __future__ import annotations

import os
import re
import time
from typing import Any, Optional

import requests

CACHE_TTL_SECONDS = 1800
REQUEST_TIMEOUT = 20
TOP_HEADLINES_URL = "https://newsapi.org/v2/top-headlines"
EVERYTHING_URL = "https://newsapi.org/v2/everything"
MAX_STARTUP_HEADLINES = 10

# Common country name → NewsAPI `country` param (ISO 3166-1 alpha-2).
COUNTRY_CODES: dict[str, str] = {
    "india": "in",
    "usa": "us",
    "us": "us",
    "united states": "us",
    "america": "us",
    "uk": "gb",
    "united kingdom": "gb",
    "britain": "gb",
    "great britain": "gb",
    "australia": "au",
    "canada": "ca",
    "germany": "de",
    "france": "fr",
    "japan": "jp",
    "china": "cn",
    "russia": "ru",
    "pakistan": "pk",
    "brazil": "br",
    "italy": "it",
    "spain": "es",
}

# Per-key cache: key -> (timestamp, headlines)
_cache: dict[str, tuple[float, list[dict[str, str]]]] = {}


def _api_key() -> str | None:
    key = (os.getenv("NEWS_API_KEY") or "").strip()
    if not key:
        print("News error: NEWS_API_KEY is not set")
        return None
    return key


def _normalize_country_key(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def _cache_get(key: str) -> list[dict[str, str]] | None:
    entry = _cache.get(key)
    if not entry:
        return None
    cached_at, headlines = entry
    if (time.time() - cached_at) >= CACHE_TTL_SECONDS:
        return None
    return headlines


def _cache_set(key: str, headlines: list[dict[str, str]]) -> None:
    if headlines:
        _cache[key] = (time.time(), headlines)


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


def _fetch_top_headlines(**params: Any) -> list[dict[str, str]]:
    page_size = int(params.get("pageSize") or params.get("page_size") or 5)
    language = params.get("language")
    country = params.get("country")

    client_params: dict[str, Any] = {"page_size": page_size}
    if language:
        client_params["language"] = language
    if country:
        client_params["country"] = country

    data = _fetch_via_newsapi_client("top_headlines", **client_params)
    if data is None:
        req_params: dict[str, Any] = {"pageSize": page_size}
        if language:
            req_params["language"] = language
        if country:
            req_params["country"] = country
        data = _fetch_via_requests(TOP_HEADLINES_URL, req_params)
    return _articles_from_response(data)


def _fetch_everything(q: str, *, language: str = "en", page_size: int = 5) -> list[dict[str, str]]:
    params = {
        "q": q,
        "language": language,
        "sortBy": "publishedAt",
        "pageSize": page_size,
    }

    data = _fetch_via_newsapi_client(
        "everything",
        q=q,
        language=language,
        sort_by="publishedAt",
        page_size=page_size,
    )
    if data is None:
        data = _fetch_via_requests(EVERYTHING_URL, params)
    return _articles_from_response(data)


def _fetch_cached(key: str, fetcher) -> list[dict[str, str]]:
    cached = _cache_get(key)
    if cached is not None:
        return cached

    headlines = fetcher()
    _cache_set(key, headlines)
    return headlines


def get_top_headlines(language: str = "en", page_size: int = 5) -> list[dict[str, str]]:
    """Top global headlines (no country filter). Returns title, source, url per item."""
    cache_key = f"global:{language}:{page_size}"

    def fetch() -> list[dict[str, str]]:
        return _fetch_top_headlines(language=language, pageSize=page_size)

    return _fetch_cached(cache_key, fetch)


def get_india_headlines(page_size: int = 3) -> list[dict[str, str]]:
    """India-focused headlines via search (q=India)."""
    cache_key = f"india:q:{page_size}"

    def fetch() -> list[dict[str, str]]:
        return _fetch_everything("India", language="en", page_size=page_size)

    return _fetch_cached(cache_key, fetch)


def get_country_news(country_name: str, page_size: int = 5) -> list[dict[str, str]]:
    """Headlines for a named country — top-headlines by code, else search fallback."""
    normalized = _normalize_country_key(country_name)
    if not normalized:
        return []

    cache_key = f"country:{normalized}:{page_size}"

    def fetch() -> list[dict[str, str]]:
        code = COUNTRY_CODES.get(normalized)
        if code:
            rows = _fetch_top_headlines(country=code, page_size=page_size)
            if rows:
                return rows
        return _fetch_everything(country_name.strip(), language="en", page_size=page_size)

    return _fetch_cached(cache_key, fetch)


def get_tech_news(page_size: int = 3) -> list[dict[str, str]]:
    """Tech-related articles from NewsAPI search."""
    cache_key = f"tech:{page_size}"

    def fetch() -> list[dict[str, str]]:
        return _fetch_everything(
            "AI OR startup OR technology",
            language="en",
            page_size=page_size,
        )

    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    headlines = fetch()
    _cache_set(cache_key, headlines)
    return headlines


def format_news_headlines(
    headlines: Optional[list[dict[str, str]]],
    *,
    label: Optional[str] = None,
    start_index: int = 1,
) -> str:
    """Format headlines for prompts or on-demand replies."""
    if not headlines:
        empty = "[News unavailable — API fetch failed or not configured.]"
        return f"{label}\n{empty}" if label else empty

    lines = [
        f"{index}. {item['title']} - {item['source']}"
        for index, item in enumerate(headlines, start=start_index)
    ]
    body = "\n".join(lines)
    return f"{label}\n{body}" if label else body


def get_news_text(*, force: bool = False) -> str:
    """Global + India headlines for the system prompt (≤10 items, 30-minute TTL each)."""
    if force:
        _cache.pop("global:en:5", None)
        _cache.pop("india:q:3", None)

    global_rows = get_top_headlines(language="en", page_size=5)
    india_rows = get_india_headlines(page_size=3)

    combined: list[dict[str, str]] = []
    combined.extend(global_rows)
    remaining = MAX_STARTUP_HEADLINES - len(combined)
    if remaining > 0:
        combined.extend(india_rows[:remaining])

    if not combined:
        return "[News unavailable — API fetch failed or not configured.]"

    global_count = min(len(global_rows), MAX_STARTUP_HEADLINES)
    india_count = min(len(india_rows), max(0, MAX_STARTUP_HEADLINES - global_count))

    parts: list[str] = []
    if global_count:
        parts.append(
            format_news_headlines(global_rows[:global_count], label="GLOBAL:")
        )
    if india_count:
        parts.append(
            format_news_headlines(india_rows[:india_count], label="INDIA:")
        )
    return "\n\n".join(parts)


def format_country_news_for_reply(country_name: str, headlines: list[dict[str, str]]) -> str:
    """Format on-demand country headlines for a single assistant turn."""
    label = f"HEADLINES FOR {country_name.strip().upper()}:"
    return format_news_headlines(headlines, label=label)
