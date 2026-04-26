"""
Manual smoke test for /api/analyze/game.

Usage:
  BASE_URL=http://localhost:8000 python backend/tests/smoke_analyze.py
"""

from __future__ import annotations

import json
import os
import sys

import requests


BASE_URL = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
URL = f"{BASE_URL}/api/analyze/game"


def _fmt_move(v):
    if not v or len(v) != 2:
        return "(None,None)"
    return f"({v[0]},{v[1]})"


def main() -> int:
    payload = {
        "board_size": 5,
        "selected_patterns": ["LINE", "DIAGONAL"],
        "move_history": [
            {"player": "P1", "row": 2, "col": 2},
            {"player": "P2", "row": 1, "col": 1},
            {"player": "P1", "row": 2, "col": 1},
            {"player": "P2", "row": 1, "col": 2},
            {"player": "P1", "row": 2, "col": 3},
            {"player": "P2", "row": 0, "col": 0},
            {"player": "P1", "row": 2, "col": 0},
            {"player": "P2", "row": 3, "col": 3},
            {"player": "P1", "row": 2, "col": 4},
            {"player": "P2", "row": 4, "col": 4},
        ],
    }

    print(f"POST {URL}")
    try:
        resp = requests.post(URL, json=payload, timeout=60)
    except requests.RequestException as e:
        print(f"Request failed: {e}")
        return 1

    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}")
        try:
            print(json.dumps(resp.json(), indent=2))
        except Exception:
            print(resp.text)
        return 1

    try:
        data = resp.json()
    except ValueError:
        print("Response is not valid JSON")
        print(resp.text)
        return 1

    print(json.dumps(data, indent=2))
    print("\nPer-move summary:")

    anns = data.get("move_annotations", []) or []
    for ann in anns:
        idx = int(ann.get("move_index", -1)) + 1
        player = ann.get("player", "?")
        played = ann.get("played", [None, None])
        engine = ann.get("engine_best", [None, None])
        quality = ann.get("quality", "?")
        sb = ann.get("score_before", 0.0)
        sa = ann.get("score_after", 0.0)
        print(
            f"Move {idx} | {player} | played {_fmt_move(played)} | "
            f"engine {_fmt_move(engine)} | {quality} | score {sb} \u2192 {sa}"
        )

    summary = data.get("summary", {}) or {}
    p1_acc = (summary.get("P1", {}) or {}).get("accuracy", "n/a")
    p2_acc = (summary.get("P2", {}) or {}).get("accuracy", "n/a")
    print("\nFinal accuracy:")
    print(f"P1: {p1_acc}")
    print(f"P2: {p2_acc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


# ---------------------------------------------------------------------------
# Optional second manual case (7x7) — uncomment and run manually:
#
# payload = {
#     "board_size": 7,
#     "selected_patterns": ["Y", "LINE"],
#     "move_history": [
#         {"player": "P1", "row": 3, "col": 3},
#         {"player": "P2", "row": 2, "col": 2},
#         {"player": "P1", "row": 4, "col": 3},
#         {"player": "P2", "row": 1, "col": 1},
#         {"player": "P1", "row": 5, "col": 3},
#         {"player": "P2", "row": 0, "col": 0},
#         {"player": "P1", "row": 6, "col": 3},
#         {"player": "P2", "row": 3, "col": 2},
#         {"player": "P1", "row": 2, "col": 3},
#         {"player": "P2", "row": 4, "col": 2},
#     ],
# }
# resp = requests.post(URL, json=payload, timeout=60)
# print(resp.status_code)
# print(resp.json())
# ---------------------------------------------------------------------------
