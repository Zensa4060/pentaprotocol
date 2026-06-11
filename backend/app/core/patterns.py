# patterns.py
# Shape pattern definitions and variant generation for 5×5 board.

import random

GRID_SIZE = 5

# Named base patterns for 5×5
# LINE and DIAGONAL are handled by win_checker (not structural patterns)
BASE_PATTERNS_5 = {
    "V":    [(0, 0), (-1, 1), (-2, 2), (-1, 3), (0, 4)],
    "L":    [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)],
    "ZZ-5": [(0, 0), (1, 1), (0, 2), (1, 3), (0, 4)],
    "T":    [(0, 0), (0, 1), (0, 2), (1, 1), (2, 1)],
}

# Full pool: 4 special shapes + straight-line + diagonal = 6 total.
PATTERN_NAMES_5 = ["V", "L", "ZZ-5", "T", "LINE", "DIAGONAL"]

# ── Core vs special split ────────────────────────────────────────────────────
# STRAIGHT LINE and DIAGONAL are CORE rules on every grid — always active,
# never deselectable, never bannable (alongside the N-point connection rule).
# The four special shapes are the variable pool: exactly ONE of them sits out
# of every 5×5 match (player-picked in solo, server-drawn in multiplayer).
CORE_PATTERN_NAMES = ["LINE", "DIAGONAL"]
SPECIAL_PATTERN_NAMES_5 = ["V", "L", "ZZ-5", "T"]


def is_core_pattern(name) -> bool:
    return str(name).strip().upper() in ("LINE", "DIAGONAL")


def pick_match_patterns_5() -> list:
    """Active 5×5 set for a new match: both core line patterns plus a random
    3 of the 4 special shapes (one special is always absent)."""
    return random.sample(SPECIAL_PATTERN_NAMES_5, 3) + list(CORE_PATTERN_NAMES)

# Legacy alias for back-compat (any code that imported BASE_PATTERNS directly)
BASE_PATTERNS = list(BASE_PATTERNS_5.values())


def generate_all_patterns_5(selected_ids=None):
    """
    Generate all structural pattern variants for the given pattern IDs.
    LINE and DIAGONAL are excluded — they are handled by check_5_line in win_checker.
    If selected_ids is None, generates variants for all 4 shape patterns.
    """
    if selected_ids is None:
        ids = list(BASE_PATTERNS_5.keys())
    else:
        ids = [p for p in selected_ids if p in BASE_PATTERNS_5]
    patterns = []
    for pid in ids:
        patterns.extend(generate_variants(BASE_PATTERNS_5[pid]))
    return patterns


def generate_all_patterns():
    """Back-compat: returns all shape pattern variants (same as generate_all_patterns_5())."""
    return generate_all_patterns_5()


def generate_variants(pattern):
    variants = set()

    for reflect in [1, -1]:
        for rotation in range(4):

            transformed = []

            for r, c in pattern:
                r2, c2 = r, c * reflect

                for _ in range(rotation):
                    r2, c2 = c2, -r2

                transformed.append((r2, c2))

            min_r = min(r for r, _ in transformed)
            min_c = min(c for _, c in transformed)

            normalized = tuple(
                sorted((r - min_r, c - min_c)
                       for r, c in transformed)
            )

            variants.add(normalized)

    return [list(v) for v in variants]
