/**
 * 7×7 bot engine — ported from ``frontend/lib/botEngine7.ts``.
 *
 * Differences from the web port:
 *   1. ``performance.now()`` is replaced with ``Date.now()``. The
 *      web port uses ``performance`` for sub-ms resolution; on
 *      React Native that API exists but isn't worth the import
 *      surface, and our time budgets are in seconds-range so
 *      millisecond resolution is plenty.
 *   2. The engine is single-threaded JS like the web version —
 *      heavy negamax searches will block the JS thread during the
 *      bot's turn. For the "hard" difficulty (4-second budget) we
 *      shield the UI by:
 *        a. Showing a "thinking..." indicator in the match screen.
 *        b. Yielding to the event loop via ``setImmediate``/
 *           ``InteractionManager`` BEFORE calling ``choose`` so the
 *           UI tick (board update for the human move) commits first.
 *      The cleanest long-term answer is a JSI worklet on the UI
 *      thread or a web worker via ``react-native-thread``; this is
 *      Phase 6 work and not needed for v1.
 *
 * The algorithm itself — heuristic eval + iterative deepening
 * negamax + alpha/beta — is unchanged from the web version so the
 * mobile bot plays exactly the same way for the same board.
 */

import {
  check7Line,
  checkStructuralPatterns7,
  getSelectedPatterns,
  type Board,
  type Coord,
} from "./winChecker7";

const GRID = 7;
const ALL_RC: Coord[] = [];
for (let r = 0; r < GRID; r++) {
  for (let c = 0; c < GRID; c++) {
    ALL_RC.push([r, c]);
  }
}

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];
const DIRS4: Coord[] = [[0, 1], [1, 0], [1, 1], [1, -1]];
const INF = 1e9;

/** Per-difficulty think-time budgets and search depths. */
const TIME_BUDGET: Record<string, number> = { easy: 0, hard: 4000 };
const MAX_DEPTH: Record<string, number> = { easy: 1, hard: 4 };

export type BotDifficulty = "easy" | "hard";

function empty(board: Board): Coord[] {
  const out: Coord[] = [];
  for (const [r, c] of ALL_RC) if (board[r][c] === null) out.push([r, c]);
  return out;
}

function place(board: Board, r: number, c: number, player: string): Board {
  const b = board.map((row) => [...row]);
  b[r][c] = player;
  return b;
}

function wins7(board: Board, r: number, c: number, player: string, patterns: Coord[][]): boolean {
  if (check7Line(board, r, c, player)) return true;
  return checkStructuralPatterns7(board, player, patterns, r, c) !== null;
}

/** Pattern index keyed by cell, used to make the structural eval fast. */
type CellUse = { pid: number; cells: Coord[] };

class BotEngine7 {
  patterns: Coord[][];
  cellUses: CellUse[][][];

  constructor(patterns: Coord[][]) {
    this.patterns = patterns;
    this.cellUses = Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => [] as CellUse[]),
    );
    this._buildPatternIndex();
  }

  _buildPatternIndex(): void {
    this.patterns.forEach((pattern, pid) => {
      const maxR = Math.max(...pattern.map(([r]) => r));
      const maxC = Math.max(...pattern.map(([, c]) => c));
      for (let br = 0; br <= GRID - 1 - maxR; br++) {
        for (let bc = 0; bc <= GRID - 1 - maxC; bc++) {
          const cells: Coord[] = pattern.map(([dr, dc]) => [br + dr, bc + dc] as Coord);
          cells.forEach(([r, c]) => {
            this.cellUses[r][c].push({ pid, cells });
          });
        }
      }
    });
  }

  /**
   * Heuristic evaluation. Four signals, each weighted to nudge the
   * bot toward sensible play even at low search depth:
   *   1. Sliding 7-cell windows in each direction — exponential
   *      bonus for friendly density, exponential penalty for
   *      enemy density.
   *   2. Pre-indexed structural pattern progress — same scoring
   *      shape, with stronger weights (patterns are harder to
   *      complete).
   *   3. Connection potential — square the blob size; massive
   *      bonus past the 20-stone CHAIN threshold.
   *   4. Center pull — small bias so the bot doesn't waste moves
   *      hugging the perimeter.
   */
  evaluate(board: Board, bot: string, human: string): number {
    let score = 0;

    const target = 7;
    for (const [dr, dc] of DIRS4) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (
            r + (target - 1) * dr >= GRID ||
            r + (target - 1) * dr < 0 ||
            c + (target - 1) * dc >= GRID ||
            c + (target - 1) * dc < 0
          ) {
            continue;
          }
          let bCount = 0;
          let hCount = 0;
          for (let i = 0; i < target; i++) {
            const v = board[r + i * dr][c + i * dc];
            if (v === bot) bCount++;
            else if (v === human) hCount++;
          }
          if (bCount > 0 && hCount === 0) {
            score += Math.pow(bCount, 4) * 10;
          } else if (hCount > 0 && bCount === 0) {
            score -= Math.pow(hCount, 4) * 15;
          }
        }
      }
    }

    const seenPats = new Set<string>();
    for (const [r, c] of ALL_RC) {
      if (board[r][c] === null) continue;
      this.cellUses[r][c].forEach(({ pid, cells }) => {
        const key = `${pid}-${cells[0][0]}-${cells[0][1]}`;
        if (seenPats.has(key)) return;
        seenPats.add(key);

        let bCount = 0;
        let hCount = 0;
        let bBlocked = false;
        let hBlocked = false;
        cells.forEach(([cr, cc]) => {
          const v = board[cr][cc];
          if (v === bot) {
            bCount++;
            hBlocked = true;
          } else if (v === human) {
            hCount++;
            bBlocked = true;
          }
        });

        if (!bBlocked && bCount > 0) score += Math.pow(bCount, 4) * 30;
        if (!hBlocked && hCount > 0) score -= Math.pow(hCount, 4) * 45;
      });
    }

    const visitedB = new Set<string>();
    const visitedH = new Set<string>();
    for (const [r, c] of ALL_RC) {
      if (board[r][c] === bot && !visitedB.has(`${r},${c}`)) {
        const sz = this._blobSize(board, r, c, bot, visitedB);
        if (sz >= 3) score += sz * sz * 12;
        if (sz >= 10) score += sz * 400;
        if (sz >= 18) score += 10000;
      }
      if (board[r][c] === human && !visitedH.has(`${r},${c}`)) {
        const sz = this._blobSize(board, r, c, human, visitedH);
        if (sz >= 3) score -= sz * sz * 15;
        if (sz >= 10) score -= sz * 600;
        if (sz >= 18) score -= 15000;
      }
    }

    for (const [r, c] of ALL_RC) {
      if (board[r][c] === bot) {
        score += (6 - (Math.abs(r - 3) + Math.abs(c - 3))) * 1.5;
      }
      if (board[r][c] === human) {
        score -= (6 - (Math.abs(r - 3) + Math.abs(c - 3))) * 1.5;
      }
    }

    return score;
  }

  _blobSize(board: Board, r: number, c: number, player: string, visited: Set<string>): number {
    const q: Coord[] = [[r, c]];
    visited.add(`${r},${c}`);
    let size = 0;
    while (q.length) {
      const [currR, currC] = q.shift()!;
      size++;
      for (const [dr, dc] of DIRS) {
        const nr = currR + dr;
        const nc = currC + dc;
        const key = `${nr},${nc}`;
        if (
          nr >= 0 && nr < GRID && nc >= 0 && nc < GRID &&
          board[nr][nc] === player && !visited.has(key)
        ) {
          visited.add(key);
          q.push([nr, nc]);
        }
      }
    }
    return size;
  }

  negamax(
    board: Board,
    depth: number,
    alpha: number,
    beta: number,
    cur: string,
    opp: string,
    deadline: number,
  ): number {
    if (Date.now() >= deadline) return 0;
    if (depth === 0) return this.evaluate(board, cur, opp);

    const empties = empty(board);
    if (depth >= 1) {
      empties.sort((a, b) => {
        const scoreA = 6 - (Math.abs(a[0] - 3) + Math.abs(a[1] - 3));
        const scoreB = 6 - (Math.abs(b[0] - 3) + Math.abs(b[1] - 3));
        return scoreB - scoreA;
      });
    }

    let maxVal = -INF;
    for (const [r, c] of empties) {
      const b = place(board, r, c, cur);
      if (wins7(b, r, c, cur, this.patterns)) return 1000000 + depth;

      const val = -this.negamax(b, depth - 1, -beta, -alpha, opp, cur, deadline);
      if (val > maxVal) maxVal = val;
      alpha = Math.max(alpha, val);
      if (alpha >= beta) break;
    }
    return maxVal;
  }

  choose(board: Board, bot: string, human: string, difficulty: BotDifficulty): Coord | null {
    const empties = empty(board);
    if (!empties.length) return null;

    // Easy mode = random legal move. Useful for new players and for
    // pacing — we don't want to crush a new user before they learn
    // the patterns.
    if (difficulty === "easy") {
      return empties[Math.floor(Math.random() * empties.length)];
    }

    // 1-ply immediate-win / immediate-block before launching the
    // expensive search. Saves a 4-ply call when there's a forced move.
    for (const [r, c] of empties) {
      if (wins7(place(board, r, c, bot), r, c, bot, this.patterns)) return [r, c];
    }
    for (const [r, c] of empties) {
      if (wins7(place(board, r, c, human), r, c, human, this.patterns)) return [r, c];
    }

    const deadline = Date.now() + TIME_BUDGET.hard;
    const depth = MAX_DEPTH.hard;

    let bestMv: Coord = empties[0];
    let overallBestScore = -INF;

    const sortedEmpties: Coord[] = [...empties].sort((a, b) => {
      const distA = Math.abs(a[0] - 3) + Math.abs(a[1] - 3);
      const distB = Math.abs(b[0] - 3) + Math.abs(b[1] - 3);
      return distA - distB;
    });

    for (let d = 1; d <= depth; d++) {
      if (Date.now() >= deadline) break;

      let depthBestMv = bestMv;
      let depthBestScore = -INF;

      const depthOrder: Coord[] = [
        bestMv,
        ...sortedEmpties.filter((m) => m[0] !== bestMv[0] || m[1] !== bestMv[1]),
      ];

      for (const [r, c] of depthOrder) {
        if (Date.now() >= deadline) break;
        const b = place(board, r, c, bot);
        const score = -this.negamax(b, d - 1, -INF, INF, human, bot, deadline);
        if (score > depthBestScore) {
          depthBestScore = score;
          depthBestMv = [r, c];
        }
      }

      if (Date.now() < deadline || d === 1) {
        bestMv = depthBestMv;
        overallBestScore = depthBestScore;
      }

      if (overallBestScore > 900000) break;
    }

    return bestMv;
  }
}

// Engine instance is cached across calls — building the pattern
// index is the slow part and we re-use it every time the same
// pattern selection is in play (which is almost always for the
// 7×7 default-all set).
let _engine7: BotEngine7 | null = null;
let _lastPatternKey = "";

export function getBotMove7(
  board: Board,
  botPlayer: string,
  humanPlayer: string,
  difficulty: BotDifficulty,
  selectedPatternIds: (number | string)[],
): Coord | null {
  const patterns = getSelectedPatterns(selectedPatternIds);
  const key = JSON.stringify(selectedPatternIds);
  if (!_engine7 || key !== _lastPatternKey) {
    _engine7 = new BotEngine7(patterns);
    _lastPatternKey = key;
  }
  return _engine7.choose(board, botPlayer, humanPlayer, difficulty);
}

/**
 * Minimum visible "thinking" delay per difficulty, used by the
 * match controller to keep the bot's response from feeling jumpy.
 * The actual search time is dominated by the negamax budget for
 * "hard", so this is mainly a floor for "easy".
 */
export const BOT_DELAY_7: Record<BotDifficulty, number> = { easy: 400, hard: 200 };
