/** Auto-synced from frontend/lib/patterns_metadata.ts */
import type { PatternInfo } from './patterns7';

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

