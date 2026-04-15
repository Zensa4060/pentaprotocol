# patterns7.py
# 7×7 shape pattern definitions and variant generation.
# 6 special patterns: Y, L, W, V, C, Zigzag — each has 7 cells.

GRID_SIZE_7 = 7

# The 6 base patterns for 7×7 mode (0-indexed row, col offsets)
# Each pattern uses exactly 7 cells.

BASE_PATTERNS_7 = {
    "Y": [
        # Y-shape: diagonal stem splitting into a fork
        # A1-B2-C3-C4-C5-D2-E1
        (0, 0), (1, 1), (2, 2), (2, 3), (2, 4), (3, 1), (4, 0)
    ],
    "L": [
        # L-shape: vertical bar then horizontal bar
        # A1-A2-A3-A4-B4-C4-D4
        (0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (2, 3), (3, 3)
    ],
    "V": [
        # V-shape: diagonal down then diagonal up
        # A1-B2-C3-D4-E3-F2-G1
        (0, 0), (1, 1), (2, 2), (3, 3), (4, 2), (5, 1), (6, 0)
    ],
    "C": [
        # C-shape: U/bracket shape
        # C1-B1-A1-A2-A3-B3-C3
        (0, 0), (0, 1), (0, 2), (1, 0), (2, 0), (1, 2), (2, 2)
    ],
    "zigzag": [
        # Zigzag: alternating diagonal steps
        # A1-B2-C1-D2-E1-F2-G1
        (0, 0), (1, 1), (2, 0), (3, 1), (4, 0), (5, 1), (6, 0)
    ],
    "T": [
        # T-shape: wide T-junction
        # (0,0)-(1,0)-(2,0)-(3,0)-(4,0)-(2,1)-(2,2)
        (0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (2, 1), (2, 2)
    ],
}

# Full selectable pool for 7×7: 6 shapes + straight-line + diagonal = 8 total (all always selected)
PATTERN_NAMES_7 = ["Y", "L", "V", "C", "zigzag", "T", "LINE", "DIAGONAL"]


def generate_variants_7(pattern):
    """
    Generate all unique rotations and reflections of a pattern,
    normalized to start at (0,0).
    """
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


def generate_all_patterns_7(selected_ids=None):
    """
    Generate all pattern variants for the selected patterns.
    selected_ids: list of indices (0-5) or pattern names.
    If None, generates all 6.
    """
    if selected_ids is None:
        names = PATTERN_NAMES_7
    else:
        names = []
        # Ensure we have a case-insensitive lookup
        lookup = {n.lower(): n for n in PATTERN_NAMES_7}
        for sid in selected_ids:
            if isinstance(sid, int):
                if 0 <= sid < len(PATTERN_NAMES_7):
                    names.append(PATTERN_NAMES_7[sid])
            elif isinstance(sid, str):
                s = sid.strip().lower()
                if s in lookup:
                    names.append(lookup[s])

    patterns = []
    for name in names:
        if name in BASE_PATTERNS_7:
            base = BASE_PATTERNS_7[name]
            patterns.extend(generate_variants_7(base))
    return patterns
