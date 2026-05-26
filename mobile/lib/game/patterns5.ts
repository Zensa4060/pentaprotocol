/** Auto-synced from frontend/lib/patterns_metadata.ts */
import type { PatternInfo } from './patterns7';

export const PATTERN_METADATA_5: Record<string, PatternInfo> = {
  V: {
    id: "V",
    label: "V-SHAPE",
    desc: "A wide V chevron spanning the board.",
    gridSize: 5,
    cells: [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
    mirrorCount: 4,
  },
  L: {
    id: "L",
    label: "L-SHAPE",
    desc: "Standard 90-degree L formation.",
    gridSize: 5,
    cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    mirrorCount: 4,
  },
  "ZZ-5": {
    id: "ZZ-5",
    label: "ZIGZAG-5",
    desc: "A sharp angled zigzag following the diagonal axis.",
    gridSize: 5,
    cells: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]],
    mirrorCount: 4,
  },
  T: {
    id: "T",
    label: "T-SHAPE",
    desc: "A balanced T-bracket for anchoring territory.",
    gridSize: 5,
    cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
    mirrorCount: 4,
  },
  LINE: {
    id: "LINE",
    label: "STRAIGHT LINE",
    desc: "A continuous row or column of 5 stones.",
    gridSize: 5,
    cells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
    mirrorCount: 4,
  },
  DIAGONAL: {
    id: "DIAGONAL",
    label: "DIAGONAL",
    desc: "A corner-to-corner diagonal line of 5 stones.",
    gridSize: 5,
    cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],
    mirrorCount: 2,
  },
};

// ─── 6×6 Special Patterns (all 7 always selected) ───────────────────────────

export const CORE_RULES_METADATA_5: Record<string, PatternInfo> = {
  CHAIN: {
    id: "CHAIN",
    label: "10PT CONNECTION",
    desc: "Always active: 10+ connected stones wins the game.",
    gridSize: 5,
    cells: [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [4, 1], [4, 2]],
    mirrorCount: 1,
  },
};

