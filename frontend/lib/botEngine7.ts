// lib/botEngine7.ts
// 7×7 Board AI Engine for PentaProtocol
// Version: 3.0 (Path Potential + 3-ply Negamax + De-biased)

import { check7Line, checkStructuralPatterns7, getSelectedPatterns, Board, Coord } from "./winChecker7";

const GRID = 7;
const ALL_RC: Coord[] = [];
for (let r = 0; r < GRID; r++)
  for (let c = 0; c < GRID; c++)
    ALL_RC.push([r, c]);

const DIRS: Coord[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [-1, 1], [1, -1], [1, 1],
];
const DIRS4: Coord[] = [[0, 1], [1, 0], [1, 1], [1, -1]];
const INF = 1e9;

// Think-time budgets in ms
const TIME_BUDGET: Record<string, number> = { easy: 0, hard: 4000 };
const MAX_DEPTH: Record<string, number> = { easy: 1, hard: 4 };

// ── Helpers ──

function empty(board: Board): Coord[] {
  const out: Coord[] = [];
  for (const [r, c] of ALL_RC) if (board[r][c] === null) out.push([r, c]);
  return out;
}

function place(board: Board, r: number, c: number, player: string): Board {
  const b = board.map(row => [...row]);
  b[r][c] = player;
  return b;
}

function wins7(board: Board, r: number, c: number, player: string, patterns: Coord[][]): boolean {
  if (check7Line(board, r, c, player)) return true;
  return checkStructuralPatterns7(board, player, patterns, r, c) !== null;
}

// ══════════════════════════════════════════════════════════════
//  BOT ENGINE CLASS (7×7)
// ══════════════════════════════════════════════════════════════

class BotEngine7 {
  patterns: Coord[][];
  cellUses: { pid: number, cells: Coord[] }[][][];

  constructor(patterns: Coord[][]) {
    this.patterns = patterns;
    this.cellUses = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => []));
    this._buildPatternIndex();
  }

  _buildPatternIndex() {
    this.patterns.forEach((pattern, pid) => {
      const maxR = Math.max(...pattern.map(([r]) => r));
      const maxC = Math.max(...pattern.map(([, c]) => c));
      for (let br = 0; br <= GRID - 1 - maxR; br++) {
        for (let bc = 0; bc <= GRID - 1 - maxC; bc++) {
          const cells: Coord[] = pattern.map(([dr, dc]) => [br + dr, bc + dc]);
          cells.forEach(([r, c]) => {
            this.cellUses[r][c].push({ pid, cells });
          });
        }
      }
    });
  }

  evaluate(board: Board, bot: string, human: string): number {
    let score = 0;

    // 1. Line Progress (7-in-a-row) - Sliding Window
    const target = 7;
    for (const [dr, dc] of DIRS4) {
      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          // Check if window fits
          if (r + (target - 1) * dr >= GRID || r + (target - 1) * dr < 0 ||
              c + (target - 1) * dc >= GRID || c + (target - 1) * dc < 0) continue;

          let bCount = 0, hCount = 0;
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

    // 2. Pattern Progress
    const seenPats = new Set<string>();
    for (const [r, c] of ALL_RC) {
      if (board[r][c] === null) continue;
      this.cellUses[r][c].forEach(({ pid, cells }) => {
        const key = `${pid}-${cells[0][0]}-${cells[0][1]}`;
        if (seenPats.has(key)) return;
        seenPats.add(key);

        let bCount = 0, hCount = 0, bBlocked = false, hBlocked = false;
        cells.forEach(([cr, cc]) => {
          const v = board[cr][cc];
          if (v === bot) { bCount++; hBlocked = true; }
          else if (v === human) { hCount++; bBlocked = true; }
        });

        if (!bBlocked && bCount > 0) score += Math.pow(bCount, 4) * 30;
        if (!hBlocked && hCount > 0) score -= Math.pow(hCount, 4) * 45;
      });
    }

    // 3. Connection Potential (Path-Length Based)
    const visitedB = new Set<string>();
    const visitedH = new Set<string>();
    for (const [r, c] of ALL_RC) {
      if (board[r][c] === bot && !visitedB.has(`${r},${c}`)) {
        const sz = this._blobSize(board, r, c, bot, visitedB);
        if (sz >= 3) score += (sz * sz) * 12;
        if (sz >= 10) score += sz * 400;
        if (sz >= 18) score += 10000;
      }
      if (board[r][c] === human && !visitedH.has(`${r},${c}`)) {
        const sz = this._blobSize(board, r, c, human, visitedH);
        if (sz >= 3) score -= (sz * sz) * 15;
        if (sz >= 10) score -= sz * 600;
        if (sz >= 18) score -= 15000;
      }
    }

    // 4. Positional De-bias (Stronger center pull for 7x7)
    for (const [r, c] of ALL_RC) {
      if (board[r][c] === bot) score += (6 - (Math.abs(r - 3) + Math.abs(c - 3))) * 1.5;
      if (board[r][c] === human) score -= (6 - (Math.abs(r - 3) + Math.abs(c - 3))) * 1.5;
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
        const nr = currR + dr, nc = currC + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && board[nr][nc] === player && !visited.has(key)) {
          visited.add(key);
          q.push([nr, nc]);
        }
      }
    }
    return size;
  }

  negamax(board: Board, depth: number, alpha: number, beta: number, cur: string, opp: string, deadline: number): number {
    if (performance.now() >= deadline) return 0;
    if (depth === 0) return this.evaluate(board, cur, opp);

    const empties = empty(board);
    // Rough move ordering for better pruning
    if (depth >= 1) {
      empties.sort((a, b) => {
        const scoreA = (6 - (Math.abs(a[0] - 3) + Math.abs(a[1] - 3)));
        const scoreB = (6 - (Math.abs(b[0] - 3) + Math.abs(b[1] - 3)));
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

  choose(board: Board, bot: string, human: string, difficulty: string): Coord | null {
    const empties = empty(board);
    if (!empties.length) return null;

    if (difficulty === "easy" || difficulty === "medium") return empties[Math.floor(Math.random() * empties.length)];

    // Immediate win/block checks (1-ply)
    for (const [r, c] of empties) {
      if (wins7(place(board, r, c, bot), r, c, bot, this.patterns)) return [r, c];
    }
    for (const [r, c] of empties) {
      if (wins7(place(board, r, c, human), r, c, human, this.patterns)) return [r, c];
    }

    const deadline = performance.now() + TIME_BUDGET.hard;
    const depth = MAX_DEPTH.hard;

    let bestMv = empties[0];
    let overallBestScore = -INF;

    // Sort initial empties by distance to center
    const sortedEmpties = [...empties].sort((a, b) => {
      const distA = Math.abs(a[0] - 3) + Math.abs(a[1] - 3);
      const distB = Math.abs(b[0] - 3) + Math.abs(b[1] - 3);
      return distA - distB;
    });

    for (let d = 1; d <= depth; d++) {
      if (performance.now() >= deadline) break;
      
      let depthBestMv = bestMv;
      let depthBestScore = -INF;
      
      // Principal Variation: explore previous best move FIRST
      const depthOrder = [bestMv, ...sortedEmpties.filter(m => m[0] !== bestMv[0] || m[1] !== bestMv[1])];

      for (const [r, c] of depthOrder) {
        if (performance.now() >= deadline) break;
        const b = place(board, r, c, bot);
        // depth-1 because choose is already ply 1
        const score = -this.negamax(b, d - 1, -INF, INF, human, bot, deadline);
        
        if (score > depthBestScore) {
          depthBestScore = score;
          depthBestMv = [r, c];
        }
      }
      
      // Update global best only after completing depth (or first move of depth)
      if (performance.now() < deadline || d === 1) {
          bestMv = depthBestMv;
          overallBestScore = depthBestScore;
      }
      
      if (overallBestScore > 900000) break;
    }

    return bestMv;
  }
}

let _engine7: BotEngine7 | null = null;
let _lastPatternKey = "";

export function getBotMove7(board: Board, botPlayer: string, humanPlayer: string, difficulty: "easy" | "hard", selectedPatternIds: (number | string)[]): Coord | null {
  const patterns = getSelectedPatterns(selectedPatternIds);
  const key = JSON.stringify(selectedPatternIds);
  if (!_engine7 || key !== _lastPatternKey) {
    _engine7 = new BotEngine7(patterns);
    _lastPatternKey = key;
  }
  return _engine7.choose(board, botPlayer, humanPlayer, difficulty);
}

export const BOT_DELAY_7: Record<string, number> = { easy: 400, hard: 2000 };
