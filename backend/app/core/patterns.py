# patterns.py
# Shape pattern definitions and variant generation.
# Extracted from the original monolithic engine.py.

GRID_SIZE = 5

BASE_PATTERNS = [
    [(0, 0), (-1, 1), (-2, 2), (-1, 3), (0, 4)],      # V
    [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)],          # L
    [(1, 1), (1, 2), (1, 3), (2, 3), (3, 3)],          # Offset L
    [(0, 0), (1, 1), (0, 2), (1, 3), (0, 4)],          # W
    [(0, 0), (1, 1), (2, 2), (1, 3), (0, 4)],          # Diagonal V
    [(0, 1), (1, 2), (2, 3), (3, 2), (4, 1)],          # Diamond
    [(0, 0), (0, 1), (0, 2), (1, 1), (2, 1)]           # T-Shape: A1-B1-C1-B2-B3
]


def generate_all_patterns():
    patterns = []
    for base in BASE_PATTERNS:
        patterns.extend(generate_variants(base))
    return patterns


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
