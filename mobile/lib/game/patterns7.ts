/**
 * 7×7 pattern + core-rule metadata.
 *
 * Cherry-picked from ``frontend/lib/patterns_metadata.ts`` —
 * mobile v1 only ships the 7×7 board (5×5 / 6×6 can be added in
 * later phases). Keeping just the slice we use trims the bundle
 * and avoids dead-code warnings.
 *
 * The shape mirrors the web type exactly so future tooling (e.g.
 * a shared rules-doc generator) can ingest both clients without
 * a remap.
 */

export type PatternCoord = [number, number];

export interface PatternInfo {
  id: string;
  label: string;
  desc: string;
  cells: PatternCoord[];
  gridSize: number;
  mirrorCount: number;
  isException?: boolean;
}

export const PATTERN_METADATA_7: Record<string, PatternInfo> = {
  Y: {
    id: "Y",
    label: "Y-SHAPE",
    desc: "Diagonal stem splitting into a fork.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 2], [2, 3], [2, 4], [3, 1], [4, 0]],
    mirrorCount: 4,
  },
  L: {
    id: "L",
    label: "L-SHAPE",
    desc: "A long bar turning at a right angle.",
    gridSize: 7,
    cells: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
    mirrorCount: 4,
  },
  T: {
    id: "T",
    label: "T-SHAPE",
    desc: "A wide T-junction for broad board control.",
    gridSize: 7,
    cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [2, 1], [2, 2]],
    mirrorCount: 4,
  },
  V: {
    id: "V",
    label: "V-SHAPE",
    desc: "Broad V chevron with long diagonals.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 2], [5, 1], [6, 0]],
    mirrorCount: 4,
  },
  C: {
    id: "C",
    label: "C-SHAPE",
    desc: "Bracket formation for wrapping lines.",
    gridSize: 7,
    cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0], [1, 2], [2, 2]],
    mirrorCount: 4,
  },
  zigzag: {
    id: "zigzag",
    label: "ZIGZAG",
    desc: "Sharp alternating steps of saw teeth.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0]],
    mirrorCount: 4,
  },
  LINE: {
    id: "LINE",
    label: "STRAIGHT LINE",
    desc: "A continuous row or column of 7 stones.",
    gridSize: 7,
    cells: [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]],
    mirrorCount: 4,
  },
  DIAGONAL: {
    id: "DIAGONAL",
    label: "DIAGONAL",
    desc: "A corner-to-corner diagonal line of 7 stones.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]],
    mirrorCount: 2,
  },
};

export const CORE_RULES_METADATA_7: Record<string, PatternInfo> = {
  CHAIN: {
    id: "CHAIN",
    label: "20PT CONNECTION",
    desc: "Always active: 20+ connected stones wins the game.",
    gridSize: 7,
    cells: [
      [1, 1], [1, 2], [1, 3], [1, 4], [1, 5],
      [2, 1], [2, 2], [2, 3], [2, 4], [2, 5],
      [3, 1], [3, 2], [3, 3], [3, 4], [3, 5],
      [4, 1], [4, 2], [4, 3], [4, 4], [4, 5],
    ],
    mirrorCount: 1,
  },
};

/** Default 7×7 pattern set — all 8 active. v1 doesn't ship pattern picking. */
export const DEFAULT_PATTERNS_7: string[] = Object.keys(PATTERN_METADATA_7);
