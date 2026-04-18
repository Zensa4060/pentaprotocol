"""Deterministic mission XP (must match frontend missionXpForMissionId / hashStringToSeed)."""
from __future__ import annotations

from typing import Optional


def _to_int32(n: int) -> int:
    n = n & 0xFFFFFFFF
    if n >= 2**31:
        n -= 2**32
    return n


def _imul32(a: int, b: int) -> int:
    return _to_int32(a * b)


def hash_string_to_seed(s: str) -> int:
    h = _to_int32(2166136261)
    for ch in s:
        h = _to_int32(h ^ ord(ch))
        h = _imul32(h, 16777619)
    return h & 0xFFFFFFFF


def mission_xp_for_mission_id(mission_id: str) -> Optional[int]:
    if not mission_id or not isinstance(mission_id, str):
        return None
    if mission_id == "perm_rank_legend":
        return 200000
    h = hash_string_to_seed(mission_id)
    if mission_id.startswith("d_"):
        return 250
    if mission_id.startswith("w_"):
        return 2500
    if mission_id.startswith("perm_"):
        # Range: 500 - 10000
        return 500 + (h % 9501)
    return None
