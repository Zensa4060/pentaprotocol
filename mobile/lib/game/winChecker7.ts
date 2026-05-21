/**
 * 7×7 win-condition checker — ported from
 * ``frontend/lib/winChecker7.ts`` with **identical** semantics so a
 * mobile training match and a web training match resolve the same
 * way for the same sequence of moves.
 *
 * Three win conditions are evaluated, in order, on the last placed
 * cell ``(r, c)``:
 *
 *   1. **7-in-a-line** — straight (rows/columns) and/or diagonals,
 *      depending on which of ``LINE`` / ``DIAGONAL`` the caller has
 *      enabled. With no selection, all four orientations are active.
 *   2. **Structural pattern** match — any of the 6 base shapes
 *      (Y, L, V, C, zigzag, T), pre-expanded to every rotation +
 *      reflection. The optimized check restricts the search to
 *      pattern placements that *could* contain ``(r, c)``, so this is
 *      O(P × K) rather than O(P × N²).
 *   3. **Full-board chain** — once the board is full and neither of
 *      the above hit, we look for the longest connected blob of
 *      each player. 20+ stones connected wins; otherwise it's a
 *      draw.
 *
 * The functions are deliberately pure (no module state, no
 * randomness, no clocks) so they're cheap to call inside the bot's
 * negamax loop and trivial to unit test against the web version.
 */

export type Coord = [number, number];
export type Board = (string | null)[][];

const GRID = 7;

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];

const LINE_DIRS: Coord[] = [[1, 0], [0, 1]];
const DIAG_DIRS: Coord[] = [[1, 1], [1, -1]];

/**
 * The six base 7×7 structural patterns. ``W`` is intentionally
 * omitted (it collapses to ``zigzag`` after rotation).
 */
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

/** Min patterns players must enable for 7×7. Max is 8. */
export const MIN_SELECTED_PATTERNS_7X7 = 5;

/**
 * Expand a base pattern to every distinct rotation + reflection.
 * The web version pre-computes these once at module load; we do
 * the same below so the work happens once per cold start.
 */
function generateVariants(pattern: Coord[]): Coord[][] {
  const variants = new Set<string>();
  const result: Coord[][] = [];

  for (const reflect of [1, -1]) {
    for (let rotation = 0; rotation < 4; rotation++) {
      const transformed: Coord[] = [];
      for (const [r, c] of pattern) {
        let r2 = r;
        let c2 = c * reflect;
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

const ALL_PATTERN_VARIANTS: Record<string, Coord[][]> = {};
for (const name of PATTERN_NAMES_7) {
  if (BASE_PATTERNS_7[name]) {
    ALL_PATTERN_VARIANTS[name] = generateVariants(BASE_PATTERNS_7[name]);
  }
}

/**
 * Translate selected pattern names/indices into the concrete list
 * of variants to test. LINE + DIAGONAL are handled separately by
 * ``check7Line`` — they don't appear in the structural variant set.
 */
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

/** 7-in-a-row check anchored on the last placed cell. */
export function check7Line(
  board: Board,
  r: number,
  c: number,
  player: string,
  selectedPatterns?: string[],
): Coord[] | null {
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

/** Structural-pattern check restricted to placements containing (lastR, lastC). */
export function checkStructuralPatterns7(
  board: Board,
  player: string,
  patterns: Coord[][],
  lastR: number,
  lastC: number,
): Coord[] | null {
  for (const pattern of patterns) {
    for (const [dr, dc] of pattern) {
      const br = lastR - dr;
      const bc = lastC - dc;
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

/** DFS for a connected chain of ``targetLen`` stones for ``player``. */
function findPath(board: Board, player: string, targetLen: number): Coord[] | null {
  const GRID_SIZE = 7;
  function dfs(r: number, c: number, path: Coord[], pathSet: Set<string>): Coord[] | null {
    if (path.length === targetLen) return path;
    for (const [dr, dc] of DIRS) {
      const nr = r + dr;
      const nc = c + dc;
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

/** Full-board resolution: 20+ chain wins, otherwise draw. */
function resolveFullBoard7(board: Board): {
  winner: string;
  line: Coord[];
  connectionScores?: { p1: number; p2: number };
} {
  const p1Path = findPath(board, "P1", 20);
  const p2Path = findPath(board, "P2", 20);
  const scores = { p1: p1Path ? 20 : 0, p2: p2Path ? 20 : 0 };

  if (p1Path && !p2Path) return { winner: "P1", line: p1Path, connectionScores: scores };
  if (p2Path && !p1Path) return { winner: "P2", line: p2Path, connectionScores: scores };
  return { winner: "DRAW", line: [], connectionScores: scores };
}

/** Top-level: returns the winning result, or null if play continues. */
export function checkWin7(
  board: Board,
  r: number,
  c: number,
  player: string,
  movesPlayed: number,
  selectedPatternIds: (number | string)[],
): { winner: string; line: Coord[]; connectionScores?: { p1: number; p2: number } } | null {
  const ids = selectedPatternIds.map(
    (id) => (typeof id === "number" ? PATTERN_NAMES_7[id] : id),
  ) as string[];

  const line7 = check7Line(board, r, c, player, ids.length > 0 ? ids : undefined);
  if (line7) return { winner: player, line: line7 };

  const structuralIds = selectedPatternIds.filter((id) => {
    const name = typeof id === "number" ? PATTERN_NAMES_7[id] : id;
    return name !== "LINE" && name !== "DIAGONAL";
  });
  const patterns = getSelectedPatterns(structuralIds);
  const lineS = checkStructuralPatterns7(board, player, patterns, r, c);
  if (lineS) return { winner: player, line: lineS };

  if (movesPlayed === GRID * GRID) return resolveFullBoard7(board);

  return null;
}
