// lib/winChecker.ts
// Exact TypeScript port of win_checker.py + patterns.py

export type Coord = [number, number];
export type Board = (string | null)[][];

const GRID = 5;

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// Named shape patterns only — LINE and DIAGONAL are handled by check5Line
const BASE_PATTERNS_5: Record<string, Coord[]> = {
  V:      [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
  L:      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
  "ZZ-5": [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]],
  T:      [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]],
};

const LINE_DIRS: Coord[] = [[1, 0], [0, 1]];       // horizontal + vertical
const DIAG_DIRS: Coord[] = [[1, 1], [1, -1]];      // both diagonals

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

export const ALL_VARIANTS_5: Record<string, Coord[][]> = {};
for (const name in BASE_PATTERNS_5) {
  ALL_VARIANTS_5[name] = generateVariants(BASE_PATTERNS_5[name]);
}

// ─── 5-in-a-line ───
export function check5Line(board: Board, r: number, c: number, player: string, selectedPatterns?: string[]): Coord[] | null {
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
    if (line.length >= 5) return line;
  }
  return null;
}

// ─── Structural patterns ───
export function checkStructuralPatterns(board: Board, player: string, activeIds: string[]): Coord[] | null {
  const patterns: Coord[][] = [];
  for (const id of activeIds) {
    if (ALL_VARIANTS_5[id]) {
      patterns.push(...ALL_VARIANTS_5[id]);
    }
  }

  for (const pattern of patterns) {
    const maxR = Math.max(...pattern.map(([r]) => r));
    const maxC = Math.max(...pattern.map(([, c]) => c));
    for (let br = 0; br < GRID - maxR; br++) {
      for (let bc = 0; bc < GRID - maxC; bc++) {
        const coords: Coord[] = [];
        let valid = true;
        for (const [dr, dc] of pattern) {
          const rr = br + dr, cc = bc + dc;
          if (board[rr][cc] !== player) { valid = false; break; }
          coords.push([rr, cc]);
        }
        if (valid) return coords;
      }
    }
  }
  return null;
}

// ─── Flood Fill: find largest contiguous blob ───
function findPath(board: Board, player: string, targetLen: number): Coord[] | null {
  function dfs(r: number, c: number, path: Coord[], pathSet: Set<string>): Coord[] | null {
    if (path.length === targetLen) return path;

    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (
        nr >= 0 && nr < GRID && nc >= 0 && nc < GRID &&
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

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] === player) {
        const res = dfs(r, c, [[r, c]], new Set([`${r},${c}`]));
        if (res) return res;
      }
    }
  }
  return null;
}

// ─── Full board resolution ───
function resolveFullBoard(board: Board): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } {
  const p1Path = findPath(board, "P1", 10);
  const p2Path = findPath(board, "P2", 10);
  const scores = { p1: p1Path ? 10 : 0, p2: p2Path ? 10 : 0 };

  if (p1Path && !p2Path) return { winner: "P1", line: p1Path, connectionScores: scores };
  if (p2Path && !p1Path) return { winner: "P2", line: p2Path, connectionScores: scores };
  return { winner: "DRAW", line: [], connectionScores: scores };
}

// ─── Main entry ───
export function checkWin(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number,
  selectedPatternIds: string[] = []
): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } | null {
  const line5 = check5Line(board, r, c, player, selectedPatternIds.length > 0 ? selectedPatternIds : undefined);
  if (line5) return { winner: player, line: line5 };

  // If no patterns selected (e.g. legacy or not yet initialized), default to standard 5x5 set
  const activeIds = selectedPatternIds.length > 0 ? selectedPatternIds : ["V", "L", "ZZ-5", "T"];
  const lineS = checkStructuralPatterns(board, player, activeIds);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard(board);

  return null;
}