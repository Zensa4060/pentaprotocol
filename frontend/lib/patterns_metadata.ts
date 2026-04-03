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
    desc: "A sharp angled V following the diagonal axis.",
    gridSize: 5,
    cells: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]],
    mirrorCount: 4,
  },
};

export const PATTERN_METADATA_6: Record<string, PatternInfo> = {
  ZZ: {
    id: "ZZ",
    label: "ZIGZAG",
    desc: "Continuous sawtooth pattern across the grid.",
    gridSize: 6,
    cells: [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4], [1, 5]],
    mirrorCount: 4,
  },
  P: {
    id: "P",
    label: "P-SHAPE",
    desc: "A hooked formation for strong connectivity.",
    gridSize: 6,
    cells: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1]],
    mirrorCount: 8,
    isException: true,
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
};

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
  W: {
    id: "W",
    label: "W-SHAPE",
    desc: "Cascading wave formation along the grid.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 2], [3, 1], [4, 2], [5, 1], [6, 0]],
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
    desc: "Sharp alternating steps of a saw teeth.",
    gridSize: 7,
    cells: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0]],
    mirrorCount: 4,
  },
};
