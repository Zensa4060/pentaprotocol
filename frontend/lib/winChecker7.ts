// lib/winChecker7.ts
// Win-condition checks for the 7×7 board mode.
// - 7-in-a-line (straight + diagonal)
// - Structural pattern matching (user-selected 3 of 6 patterns)
// - 15-cell connected chain (full-board resolution)

export type Coord = [number, number];
export type Board = (string | null)[][];

const GRID = 7;

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

const LINE_DIRS: Coord[] = [[1, 0], [0, 1]];   // horizontal + vertical
const DIAG_DIRS: Coord[] = [[1, 1], [1, -1]];  // both diagonals

// ── Base Patterns (0-indexed offsets) ──
// Each pattern has 7 cells. W removed (same as zigzag).
const BASE_PATTERNS_7: Record<string, Coord[]> = {
  Y:      [[0,0],[1,1],[2,2],[2,3],[2,4],[3,1],[4,0]],
  L:      [[0,0],[0,1],[0,2],[0,3],[1,3],[2,3],[3,3]],
  V:      [[0,0],[1,1],[2,2],[3,3],[4,2],[5,1],[6,0]],
  C:      [[0,0],[0,1],[0,2],[1,0],[2,0],[1,2],[2,2]],
  zigzag: [[0,0],[1,1],[2,0],[3,1],[4,0],[5,1],[6,0]],
  T:      [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2]],
};

export const PATTERN_NAMES_7 = ["Y", "L", "V", "C", "zigzag", "T", "LINE", "DIAGONAL"] as const;
export type PatternName7 = typeof PATTERN_NAMES_7[number];
/** Minimum count of special patterns players must enable to start a 7×7 game (max is 6). */
export const MIN_SELECTED_PATTERNS_7X7 = 5;

// ── Variant Generation ──
function generateVariants(pattern: Coord[]): Coord[][] {
  const variants = new Set<string>();
  const result: Coord[][] = [];

  for (const reflect of [1, -1]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const transformed: Coord[] = [];
      for (const [r, c] of pattern) {
        let r2 = r, c2 = c * reflect;
        for (let i = 0; i < rotation; i++) {
          [r2, c2] = [c2, -r2];
        }
        transformed.push([r2, c2]);
      }
      const minR = Math.min(...transformed.map(([r]) => r));
      const minC = Math.min(...transformed.map(([, c]) => c));
      const normalized: Coord[] = transformed
        .map(([r, c]) => [r - minR, c - minC] as Coord)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const key = normalized.map(([r, c]) => `${r},${c}`).join("|");
      if (!variants.has(key)) {
        variants.add(key);
        result.push(normalized);
      }
    }
  }
  return result;
}

// Pre-generate all variants for structural patterns (excludes LINE/DIAGONAL handled separately)
const ALL_PATTERN_VARIANTS: Record<string, Coord[][]> = {};
for (const name of PATTERN_NAMES_7) {
  if (BASE_PATTERNS_7[name]) {
    ALL_PATTERN_VARIANTS[name] = generateVariants(BASE_PATTERNS_7[name]);
  }
}

/** Get pattern variants for selected pattern names/indices */
export function getSelectedPatterns(selectedIds: (number | string)[]): Coord[][] {
  const patterns: Coord[][] = [];
  for (const id of selectedIds) {
    const name = typeof id === "number" ? PATTERN_NAMES_7[id] : id;
    if (ALL_PATTERN_VARIANTS[name]) {
      patterns.push(...ALL_PATTERN_VARIANTS[name]);
    }
  }
  return patterns;
}

// ─── 7-in-a-line ───
export function check7Line(board: Board, r: number, c: number, player: string, selectedPatterns?: string[]): Coord[] | null {
  let activeDirs: Coord[];
  if (!selectedPatterns || selectedPatterns.length === 0) {
    activeDirs = [...LINE_DIRS, ...DIAG_DIRS];
  } else {
    activeDirs = [];
    if (selectedPatterns.includes("LINE")) activeDirs.push(...LINE_DIRS);
    if (selectedPatterns.includes("DIAGONAL")) activeDirs.push(...DIAG_DIRS);
    if (activeDirs.length === 0) return null;
  }
  for (const [dr, dc] of activeDirs) {
    const line: Coord[] = [[r, c]];
    for (const sign of [1, -1] as const) {
      let rr = r + sign * dr;
      let cc = c + sign * dc;
      while (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID && board[rr][cc] === player) {
        line.push([rr, cc]);
        rr += sign * dr;
        cc += sign * dc;
      }
    }
    if (line.length >= 7) return line;
  }
  return null;
}

// ─── Structural patterns ───
// Optimized: Only check patterns that COULD contain the last placed cell (r, c)
export function checkStructuralPatterns7(board: Board, player: string, patterns: Coord[][], lastR: number, lastC: number): Coord[] | null {
  for (const pattern of patterns) {
    // A pattern variant at (br, bc) contains (lastR, lastC) if there exists (dr, dc) in pattern 
    // such that br + dr = lastR and bc + dc = lastC.
    // This means br = lastR - dr and bc = lastC - dc.
    for (const [dr, dc] of pattern) {
      const br = lastR - dr;
      const bc = lastC - dc;

      // Check if this bounding box is valid on the grid
      const maxPR = Math.max(...pattern.map(([pr]) => pr));
      const maxPC = Math.max(...pattern.map(([, pc]) => pc));

      if (br >= 0 && bc >= 0 && br + maxPR < GRID && bc + maxPC < GRID) {
        const coords: Coord[] = [];
        let valid = true;
        for (const [pdr, pdc] of pattern) {
          if (board[br + pdr][bc + pdc] !== player) {
            valid = false;
            break;
          }
          coords.push([br + pdr, bc + pdc]);
        }
        if (valid) return coords;
      }
    }
  }
  return null;
}

// ─── Flood Fill: find largest contiguous blob ───
function findPath(board: Board, player: string, targetLen: number): Coord[] | null {
  const GRID_SIZE = 7;
  function dfs(r: number, c: number, path: Coord[], pathSet: Set<string>): Coord[] | null {
    if (path.length === targetLen) return path;

    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (
        nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE &&
        board[nr][nc] === player && !pathSet.has(key)
      ) {
        pathSet.add(key);
        path.push([nr, nc]);
        const res = dfs(nr, nc, path, pathSet);
        if (res) return res;
        path.pop();
        pathSet.delete(key);
      }
    }
    return null;
  }

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === player) {
        const res = dfs(r, c, [[r, c]], new Set([`${r},${c}`]));
        if (res) return res;
      }
    }
  }
  return null;
}

// ─── Full board resolution ───
function resolveFullBoard7(board: Board): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } {
  const p1Path = findPath(board, "P1", 20);
  const p2Path = findPath(board, "P2", 20);
  const scores = { p1: p1Path ? 20 : 0, p2: p2Path ? 20 : 0 };

  if (p1Path && !p2Path) return { winner: "P1", line: p1Path, connectionScores: scores };
  if (p2Path && !p1Path) return { winner: "P2", line: p2Path, connectionScores: scores };
  return { winner: "DRAW", line: [], connectionScores: scores };
}

// ─── Main entry for 7×7 win check ───
export function checkWin7(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number,
  selectedPatternIds: (number | string)[]
): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } | null {
  const ids = selectedPatternIds.map(id => typeof id === "number" ? PATTERN_NAMES_7[id] : id) as string[];
  const line7 = check7Line(board, r, c, player, ids.length > 0 ? ids : undefined);
  if (line7) return { winner: player, line: line7 };

  // For 7x7, we check for structural patterns from the provided list.
  // LINE and DIAGONAL are handled by check7Line above, not as structural shapes.
  const structuralIds = selectedPatternIds.filter(id => {
    const name = typeof id === "number" ? PATTERN_NAMES_7[id] : id;
    return name !== "LINE" && name !== "DIAGONAL";
  });
  const patterns = getSelectedPatterns(structuralIds);
  const lineS = checkStructuralPatterns7(board, player, patterns, r, c);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard7(board);

  return null;
}
