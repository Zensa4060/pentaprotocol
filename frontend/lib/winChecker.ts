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

// ─── DFS: find a chain of exactly 10 connected cells (mirrors Python find_10) ───
function find10(board: Board, player: string): Coord[] | null {
  function dfs(path: Coord[]): Coord[] | null {
    if (path.length === 10) return path;
    const [r0, c0] = path[path.length - 1];
    for (const [dr, dc] of DIRS) {
      const nr = r0 + dr, nc = c0 + dc;
      if (
        nr >= 0 && nr < GRID && nc >= 0 && nc < GRID &&
        board[nr][nc] === player &&
        !path.some(([pr, pc]) => pr === nr && pc === nc)
      ) {
        const result = dfs([...path, [nr, nc]]);
        if (result) return result;
      }
    }
    return null;
  }
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] === player) {
        const result = dfs([[r, c]]);
        if (result) return result;
      }
    }
  }
  return null;
}

// ─── Full board resolution (mirrors Python resolve_full_board) ───
function resolveFullBoard(board: Board): { winner: string; line: Coord[] } {
  const p1 = find10(board, "P1");
  const p2 = find10(board, "P2");
  if (p1 && !p2) return { winner: "P1", line: p1 };
  if (p2 && !p1) return { winner: "P2", line: p2 };
  return { winner: "DRAW", line: [] };
}

// ─── Main entry ───
// movesPlayed must be the TOTAL number of pieces on the board (pass _totalMoves + 1)
export function checkWin(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number
): { winner: string; line: Coord[] } | null {
  const line5 = check5Line(board, r, c, player);
  if (line5) return { winner: player, line: line5 };

  const lineS = checkStructuralPatterns(board, player);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard(board);

  return null;
}