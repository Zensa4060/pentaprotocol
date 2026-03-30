GRID_SIZE_6 = 6

BASE_PATTERNS_6 = {
    # Zigzag: A1-B2-C1-D2-E1-F2
    "ZZ": [(0, 0), (1, 1), (0, 2), (1, 3), (0, 4), (1, 5)],
    # J-shape: A1-A2-A3-A4-B4-B3
    "J": [(0, 0), (1, 0), (2, 0), (3, 0), (3, 1), (2, 1)],
    # T shape: A1-B1-C1-B2-B3-B4
    "T": [(0, 0), (0, 1), (0, 2), (1, 1), (2, 1), (3, 1)],
    # L shape: A1-B1-C1-C2-C3-B2
    "L": [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 1)],
    # Y shape: A1-B2-C1-B3-B4-B5
    "Y": [(0, 0), (1, 1), (2, 0), (1, 2), (1, 3), (1, 4)],
}

PATTERN_NAMES_6 = ["ZZ", "J", "T", "L", "Y"]


def generate_variants_6(pattern):
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
            normalized = tuple(sorted((r - min_r, c - min_c) for r, c in transformed))
            variants.add(normalized)
    return [list(v) for v in variants]


def generate_all_patterns_6():
    patterns = []
    for name in PATTERN_NAMES_6:
        patterns.extend(generate_variants_6(BASE_PATTERNS_6[name]))
    return patterns
