// lib/winChecker6.ts
// Win-condition checks for the 6×6 board mode.
// - 6-in-a-line (straight + diagonal)
// - Structural pattern matching (4 mandatory patterns)
// - 15-cell connected chain (full-board resolution)

export type Coord = [number, number];
export type Board = (string | null)[][];

const GRID = 6;

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// ── 4 Patterns for 6x6 (0-indexed offsets) ──
// These are mandatory and always active in 6x6.
const PATTERNS_6: Record<string, Coord[]> = {
  // Zigzag (ZZ): A1-B2-C1-D2-E1-F2
  ZZ: [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4], [1, 5]],

  // T shape: A1-B1-C1-B2-B3-B4
  T: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1], [3, 1]],

  // L shape: A1-B1-C1-C2-C3-B2
  L: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 1]],

  // Y shape: A1-B2-C1-B3-B4-B5
  Y: [[0, 0], [1, 1], [2, 0], [1, 2], [1, 3], [1, 4]],
};

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

// Pre-generate all variants for all patterns
const ALL_VARIANTS_6: Record<string, Coord[][]> = {};
for (const name in PATTERNS_6) {
  ALL_VARIANTS_6[name] = generateVariants(PATTERNS_6[name]);
}

// ─── 6-in-a-line ───
export function check6Line(board: Board, r: number, c: number, player: string): Coord[] | null {
  for (const [dr, dc] of DIRS) {
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
    if (line.length >= 6) return line;
  }
  return null;
}

// ─── Structural patterns ───
export function checkStructuralPatterns6(board: Board, player: string, activeIds: string[]): Coord[] | null {
  const patterns: Coord[][] = [];
  for (const id of activeIds) {
    if (ALL_VARIANTS_6[id]) {
      patterns.push(...ALL_VARIANTS_6[id]);
    }
  }

  for (const pattern of patterns) {
    const maxR = Math.max(...pattern.map(([r]) => r));
    const maxC = Math.max(...pattern.map(([, c]) => c));
    for (let br = 0; br <= GRID - 1 - maxR; br++) {
      for (let bc = 0; bc <= GRID - 1 - maxC; bc++) {
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
function resolveFullBoard6(board: Board): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } {
  const p1Path = findPath(board, "P1", 15);
  const p2Path = findPath(board, "P2", 15);
  const scores = { p1: p1Path ? 15 : 0, p2: p2Path ? 15 : 0 };

  if (p1Path && !p2Path) return { winner: "P1", line: p1Path, connectionScores: scores };
  if (p2Path && !p1Path) return { winner: "P2", line: p2Path, connectionScores: scores };
  return { winner: "DRAW", line: [], connectionScores: scores };
}

// ─── Main entry for 6×6 win check ───
export function checkWin6(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number,
  selectedPatternIds: string[] = []
): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } | null {
  const line6 = check6Line(board, r, c, player);
  if (line6) return { winner: player, line: line6 };

  // If no patterns selected (e.g. legacy), default to standard 6x6 set
  const activeIds = selectedPatternIds.length > 0 ? selectedPatternIds : ["ZZ", "T", "L", "Y"];
  const lineS = checkStructuralPatterns6(board, player, activeIds);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard6(board);

  return null;
}
