// lib/winChecker.ts
// Exact TypeScript port of win_checker.py + patterns.py

export type Coord = [number, number];
export type Board = (string | null)[][];

const GRID = 5;

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

// All 12 unique pattern variants (generated from patterns.py)
const ALL_PATTERNS: Coord[][] = [
  [[0,2],[1,1],[2,0],[3,1],[4,2]],
  [[0,0],[1,1],[2,2],[3,1],[4,0]],
  [[0,2],[1,1],[1,3],[2,0],[2,4]],
  [[0,0],[0,4],[1,1],[1,3],[2,2]],
  [[0,2],[1,2],[2,0],[2,1],[2,2]],
  [[0,0],[1,0],[2,0],[2,1],[2,2]],
  [[0,0],[0,1],[0,2],[1,2],[2,2]],
  [[0,0],[0,1],[0,2],[1,0],[2,0]],
  [[0,0],[0,2],[0,4],[1,1],[1,3]],
  [[0,0],[1,1],[2,0],[3,1],[4,0]],
  [[0,1],[0,3],[1,0],[1,2],[1,4]],
  [[0,1],[1,0],[2,1],[3,0],[4,1]],
];

// ─── 5-in-a-line ───
export function check5Line(board: Board, r: number, c: number, player: string): Coord[] | null {
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
    if (line.length >= 5) return line;
  }
  return null;
}

// ─── Structural patterns ───
export function checkStructuralPatterns(board: Board, player: string): Coord[] | null {
  for (const pattern of ALL_PATTERNS) {
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
// movesPlayed must be the TOTAL number of pieces on the board (pass _totalMoves + 1)
export function checkWin(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number
): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } | null {
  const line5 = check5Line(board, r, c, player);
  if (line5) return { winner: player, line: line5 };

  const lineS = checkStructuralPatterns(board, player);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard(board);

  return null;
}