// frontend/lib/patterns_metadata.ts

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

// ─── 5×5 Special Patterns (selectable pool — pick 5 of 6) ───────────────────
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
export const PATTERN_METADATA_6: Record<string, PatternInfo> = {
  ZZ: {
    id: "ZZ",
    label: "ZIGZAG",
    desc: "Continuous sawtooth pattern across the grid.",
    gridSize: 6,
    cells: [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4], [1, 5]],
    mirrorCount: 4,
  },
  T: {
    id: "T",
    label: "T-SHAPE",
    desc: "A balanced T-bracket for anchoring territory.",
    gridSize: 6,
    cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1], [3, 1]],
    mirrorCount: 4,
  },
  L: {
    id: "L",
    label: "L-SHAPE",
    desc: "Extended L formation for perimeter control.",
    gridSize: 6,
    cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 1]],
    mirrorCount: 4,
  },
  Y: {
    id: "Y",
    label: "Y-SHAPE",
    desc: "A forked Y formation with a central stem.",
    gridSize: 6,
    cells: [[0, 0], [1, 1], [0, 2], [2, 1], [3, 1], [4, 1]],
    mirrorCount: 4,
  },
  LINE: {
    id: "LINE",
    label: "STRAIGHT LINE",
    desc: "A continuous row or column of 6 stones.",
    gridSize: 6,
    cells: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2]],
    mirrorCount: 4,
  },
  DIAGONAL: {
    id: "DIAGONAL",
    label: "DIAGONAL",
    desc: "A corner-to-corner diagonal line of 6 stones.",
    gridSize: 6,
    cells: [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
    mirrorCount: 2,
  },
  A: {
    id: "A",
    label: "A-SHAPE",
    desc: "A symmetric arch: two diagonal legs meeting at a peak with a central crossbar.",
    gridSize: 6,
    cells: [[0, 2], [1, 1], [2, 0], [2, 1], [3, 1], [4, 2]],
    mirrorCount: 4,
  },
};

// ─── 7×7 Special Patterns (all always selected; W removed — same as zigzag) ──
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

// ─── Core Rules (always active regardless of pattern selection) ───────────────
// CHAIN is the only true always-on core rule — LINE/DIAGONAL are now in the selectable pool.

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

export const CORE_RULES_METADATA_6: Record<string, PatternInfo> = {
  CHAIN: {
    id: "CHAIN",
    label: "15PT CONNECTION",
    desc: "Always active: 15+ connected stones wins the game.",
    gridSize: 6,
    cells: [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [2, 3], [2, 4], [3, 1], [3, 2], [3, 3], [3, 4], [4, 1], [4, 2], [4, 3]],
    mirrorCount: 1,
  },
};

export const CORE_RULES_METADATA_7: Record<string, PatternInfo> = {
  CHAIN: {
    id: "CHAIN",
    label: "20PT CONNECTION",
    desc: "Always active: 20+ connected stones wins the game.",
    gridSize: 7,
    cells: [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5]],
    mirrorCount: 1,
  },
};

// ─── Default selections (used when no server-provided list) ──────────────────
export const DEFAULT_PATTERNS_5 = Object.keys(PATTERN_METADATA_5);   // all 6 (picker enforces pick-5)
export const DEFAULT_PATTERNS_6 = Object.keys(PATTERN_METADATA_6);   // all 7 always selected
export const DEFAULT_PATTERNS_7 = Object.keys(PATTERN_METADATA_7);   // all 8 always selected
