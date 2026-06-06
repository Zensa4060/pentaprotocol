"""Current weather for Mythos via OpenWeatherMap."""
from __future__ import annotations

import os
import time
from typing import Any, Optional

import requests

CACHE_TTL_SECONDS = 1800
REQUEST_TIMEOUT = 20
API_URL = "https://api.openweathermap.org/data/2.5/weather"

_cache: Optional[dict[str, Any]] = None
_cache_at: float = 0.0


def _default_city() -> str:
    return (os.getenv("DEFAULT_CITY") or "Delhi").strip() or "Delhi"


def _title_condition(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        return "Unknown"
    return text[0].upper() + text[1:]


def get_current_weather(city: str | None = None) -> Optional[dict[str, Any]]:
    """Fetch current weather for a city. Returns parsed fields or None on failure."""
    api_key = (os.getenv("WEATHER_API_KEY") or "").strip()
    if not api_key:
        print("Weather error: WEATHER_API_KEY is not set")
        return None

    target_city = (city or _default_city()).strip()
    if not target_city:
        print("Weather error: city is empty")
        return None

    try:
        response = requests.get(
            API_URL,
            params={
                "q": target_city,
                "appid": api_key,
                "units": "metric",
            },
            timeout=REQUEST_TIMEOUT,
        )
        if not response.ok:
            print(f"Weather error: HTTP {response.status_code} for {target_city}")
            return None
        data = response.json()
        if not isinstance(data, dict):
            print("Weather error: unexpected response format")
            return None

        main = data.get("main") or {}
        weather_items = data.get("weather") or []
        wind = data.get("wind") or {}
        condition_raw = ""
        if weather_items and isinstance(weather_items[0], dict):
            condition_raw = str(weather_items[0].get("description") or "")

        return {
            "city": str((data.get("name") or target_city)).strip(),
            "temperature": round(float(main.get("temp", 0))),
            "feels_like": round(float(main.get("feels_like", 0))),
            "condition": _title_condition(condition_raw),
            "humidity": int(main.get("humidity", 0)),
            "wind_speed": round(float(wind.get("speed", 0)), 1),
        }
    except requests.RequestException as exc:
        print(f"Weather error: {exc}")
        return None
    except (TypeError, ValueError) as exc:
        print(f"Weather error: invalid response ({exc})")
        return None


def _fetch_weather_cached(*, force: bool = False, city: str | None = None) -> Optional[dict[str, Any]]:
    global _cache, _cache_at

    now = time.time()
    if not force and _cache is not None and (now - _cache_at) < CACHE_TTL_SECONDS:
        return _cache

    weather = get_current_weather(city=city)
    if weather:
        _cache = weather
        _cache_at = now
    return _cache


def format_weather(weather: Optional[dict[str, Any]]) -> str:
    """Format weather data for the Mythos system prompt."""
    if not weather:
        return "[Weather unavailable — API fetch failed or not configured.]"

    return (
        f"{weather['city']}: {weather['temperature']}°C, "
        f"feels like {weather['feels_like']}°C, "
        f"{weather['condition']}, {weather['humidity']}% humidity"
    )


def get_weather_text(*, force: bool = False, city: str | None = None) -> str:
    """Cached current weather formatted for the system prompt (30-minute TTL)."""
    return format_weather(_fetch_weather_cached(force=force, city=city))
