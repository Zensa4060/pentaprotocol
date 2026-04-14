// lib/botEngine.ts
// TypeScript port of bot.py — PentaProtocol AI Engine
//
// Architecture:
//   BotEngine           — stateful class, one instance per session
//   ├── Opening Book    — optimal first moves for hard mode
//   ├── Pattern DB      — pre-indexed cell→pattern membership
//   ├── IDAB            — Iterative Deepening Alpha-Beta w/ time control
//   │   ├── Move Ordering  (win>block>fork>killer>history>heuristic)
//   │   ├── Quiescence     — extend on direct threats
//   │   └── Transposition Table
//   └── Endgame Solver  — perfect minimax when ≤ 8 cells remain
//
// Public API:
//   getBotMove(board, botPlayer, humanPlayer, difficulty) → [row, col]

import { check5Line, checkStructuralPatterns, Board, Coord, ALL_VARIANTS_5 } from "./winChecker";

// ── Constants ──
const GRID = 5;
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

// Evaluation score tables
const LINE_SCORE = [0, 1, 6, 50, 400, 0];
const PAT_SCORE = [0, 0, 5, 30, 200, 0];
const OPPO_MULT = 1.3;

// Think-time budgets in ms
const TIME_BUDGET: Record<string, number> = { easy: 0, medium: 600, hard: 1800 };
const MAX_DEPTH: Record<string, number> = { easy: 1, medium: 5, hard: 99 };

const QSEARCH_DEPTH = 2;

// ── Pattern definitions (mirrored from winChecker.ts) ──
const ALL_PATTERNS: Coord[][] = Object.values(ALL_VARIANTS_5).flat();

// ── Helpers ──

type TTFlag = "exact" | "lower" | "upper";

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

function boardKey(board: Board): string {
    let s = "";
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            s += board[r][c] === null ? "." : board[r][c] === "P1" ? "1" : "2";
    return s;
}

function wins(board: Board, r: number, c: number, player: string): boolean {
    const line5 = check5Line(board, r, c, player);
    if (line5) return true;
    const lineS = checkStructuralPatterns(board, player, []);
    return lineS !== null;
}

// BFS connectivity for 10-chain potential
function bfs(board: Board, sr: number, sc: number, player: string, visited: boolean[][]): number {
    const q: Coord[] = [[sr, sc]];
    visited[sr][sc] = true;
    let size = 0;
    while (q.length) {
        const [r, c] = q.shift()!;
        size++;
        for (const [dr, dc] of DIRS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID
                && !visited[nr][nc] && board[nr][nc] === player) {
                visited[nr][nc] = true;
                q.push([nr, nc]);
            }
        }
    }
    return size;
}

// Find 10-cell connected chain (for full-board resolution)
function find10(board: Board, player: string): Coord[] | null {
    function dfs(path: Coord[]): Coord[] | null {
        if (path.length === 10) return path;
        const [r0, c0] = path[path.length - 1];
        for (const [dr, dc] of DIRS) {
            const nr = r0 + dr, nc = c0 + dc;
            if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID
                && board[nr][nc] === player
                && !path.some(([pr, pc]) => pr === nr && pc === nc)) {
                const result = dfs([...path, [nr, nc]]);
                if (result) return result;
            }
        }
        return null;
    }
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (board[r][c] === player) {
                const result = dfs([[r, c]]);
                if (result) return result;
            }
    return null;
}

// ── Threat counting ──
function countThreats(board: Board, player: string): number {
    const opponent = player === "P1" ? "P2" : "P1";
    let threats = 0;

    // Linear threats
    for (const [dr, dc] of DIRS4) {
        for (let r = 0; r < GRID; r++) {
            for (let c = 0; c < GRID; c++) {
                let mine = 0, blk = false, length = 0;
                let rr = r, cc = c;
                while (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID) {
                    const v = board[rr][cc];
                    if (v === opponent) { blk = true; break; }
                    if (v === player) mine++;
                    length++;
                    rr += dr; cc += dc;
                }
                if (!blk && mine >= 2 && length >= 5) threats++;
            }
        }
    }

    // Pattern threats
    for (const pattern of ALL_PATTERNS) {
        const maxR = Math.max(...pattern.map(([r]) => r));
        const maxC = Math.max(...pattern.map(([, c]) => c));
        for (let br = 0; br < GRID - maxR; br++) {
            for (let bc = 0; bc < GRID - maxC; bc++) {
                let mine = 0, blk = false;
                for (const [dr, dc] of pattern) {
                    const v = board[br + dr][bc + dc];
                    if (v === opponent) { blk = true; break; }
                    if (v === player) mine++;
                }
                if (!blk && mine >= 2) threats++;
            }
        }
    }
    return threats;
}

// ── Evaluation function ──
function evaluate(board: Board, player: string, cellUses: [number, Coord[]][][][]): number {
    const opponent = player === "P1" ? "P2" : "P1";
    let score = 0;

    // 1. Linear streaks
    for (const [dr, dc] of DIRS4) {
        for (let r = 0; r < GRID; r++) {
            for (let c = 0; c < GRID; c++) {
                let myRun = 0, oppRun = 0;
                let myBlk = false, oppBlk = false;
                let rr = r, cc = c;
                while (rr >= 0 && rr < GRID && cc >= 0 && cc < GRID) {
                    const v = board[rr][cc];
                    if (v === player) {
                        if (oppRun > 0) oppBlk = true;
                        myRun++;
                    } else if (v === opponent) {
                        if (myRun > 0) myBlk = true;
                        oppRun++;
                    }
                    rr += dr; cc += dc;
                }
                if (myRun >= 2 && !myBlk)
                    score += LINE_SCORE[Math.min(myRun, 5)];
                if (oppRun >= 2 && !oppBlk)
                    score -= Math.floor(LINE_SCORE[Math.min(oppRun, 5)] * OPPO_MULT);
            }
        }
    }

    // 2. Pattern progress (via pre-built index)
    const seen = new Set<string>();
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            if (board[r][c] === null) continue;
            for (const [pid, cells] of cellUses[r][c]) {
                const key = `${pid}:${cells.map(([cr, cc]) => `${cr}${cc}`).join(",")}`;
                if (seen.has(key)) continue;
                seen.add(key);
                let mine = 0, oppCnt = 0;
                for (const [cr, cc] of cells) {
                    const v = board[cr][cc];
                    if (v === player) mine++;
                    else if (v === opponent) oppCnt++;
                }
                if (oppCnt === 0 && mine >= 2)
                    score += PAT_SCORE[Math.min(mine, 5)];
                if (mine === 0 && oppCnt >= 2)
                    score -= Math.floor(PAT_SCORE[Math.min(oppCnt, 5)] * OPPO_MULT);
            }
        }
    }

    // 3. BFS connectivity (10-chain potential)
    const visited: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
            if (board[r][c] === player && !visited[r][c]) {
                const sz = bfs(board, r, c, player, visited);
                if (sz >= 3) score += sz * 12;
            }
        }
    }

    // 4. Fork bonus
    const threatCount = countThreats(board, player);
    if (threatCount >= 2) score += 80 * (threatCount - 1);

    // 5. Positional bias
    for (let r = 0; r < GRID; r++)
        for (let c = 0; c < GRID; c++)
            if (board[r][c] === player)
                score += Math.max(0, 4 - (Math.abs(r - 2) + Math.abs(c - 2)));

    return score;
}

// ── Opening book ──
const BOOK_FIRST: Coord[] = [[1, 1], [1, 3], [3, 1], [3, 3]];
const BOOK_SECOND: Coord[] = [[0, 0], [0, 4], [4, 0], [4, 4], [0, 2], [2, 0], [2, 4], [4, 2]];

function openingBook(board: Board, _bot: string): Coord | null {
    const placed = ALL_RC.filter(([r, c]) => board[r][c] !== null);
    const n = placed.length;

    if (n === 0) {
        const candidates = BOOK_FIRST.filter(([r, c]) => board[r][c] === null);
        return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }
    if (n === 1) {
        const candidates = BOOK_SECOND.filter(([r, c]) => board[r][c] === null);
        return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }
    return null;
}

// ── Move ordering ──
function orderMoves(
    board: Board, empties: Coord[], player: string, opponent: string,
    killers: Coord[], history: number[][]
): Coord[] {
    const winMvs: Coord[] = [], blkMvs: Coord[] = [], forkMvs: Coord[] = [];
    const bforkMvs: Coord[] = [], killMvs: Coord[] = [];
    const rest: [number, number, number][] = [];

    for (const [r, c] of empties) {
        const b = place(board, r, c, player);
        if (wins(b, r, c, player)) { winMvs.push([r, c]); continue; }

        const b2 = place(board, r, c, opponent);
        if (wins(b2, r, c, opponent)) { blkMvs.push([r, c]); continue; }

        if (countThreats(b, player) >= 2) { forkMvs.push([r, c]); continue; }

        const b3 = place(board, r, c, opponent);
        if (countThreats(b3, opponent) >= 2) { bforkMvs.push([r, c]); continue; }

        if (killers.some(([kr, kc]) => kr === r && kc === c)) { killMvs.push([r, c]); continue; }

        rest.push([history[r][c], r, c]);
    }

    rest.sort((a, b) => b[0] - a[0]);
    return [
        ...winMvs, ...blkMvs, ...forkMvs, ...bforkMvs,
        ...killMvs, ...rest.map(([_, r, c]) => [r, c] as Coord)
    ];
}

// ══════════════════════════════════════════════════════════════════════
//  BOT ENGINE CLASS
// ══════════════════════════════════════════════════════════════════════

class BotEngine {
    cellUses: [number, Coord[]][][][];
    killers: Coord[][];
    history: number[][];
    tt: Map<string, [number, number, TTFlag]>;

    constructor() {
        this.cellUses = Array.from({ length: GRID }, () =>
            Array.from({ length: GRID }, () => [] as [number, Coord[]][])
        );
        this._buildPatternIndex();
        this.killers = Array.from({ length: 30 }, () => []);
        this.history = Array.from({ length: GRID }, () => Array(GRID).fill(0));
        this.tt = new Map();
    }

    private _buildPatternIndex() {
        for (let pid = 0; pid < ALL_PATTERNS.length; pid++) {
            const pattern = ALL_PATTERNS[pid];
            const maxR = Math.max(...pattern.map(([r]) => r));
            const maxC = Math.max(...pattern.map(([, c]) => c));
            for (let br = 0; br < GRID - maxR; br++) {
                for (let bc = 0; bc < GRID - maxC; bc++) {
                    const cells: Coord[] = pattern.map(([dr, dc]) => [br + dr, bc + dc]);
                    for (const [r, c] of cells) {
                        this.cellUses[r][c].push([pid, cells]);
                    }
                }
            }
        }
    }

    choose(board: Board, bot: string, human: string, difficulty: string): Coord | null {
        const empties = empty(board);
        if (!empties.length) return null;

        if (difficulty === "easy") {
            return empties[Math.floor(Math.random() * empties.length)];
        }

        // Opening book (hard mode, <= 1 move played)
        const placed = ALL_RC.filter(([r, c]) => board[r][c] !== null).length;
        if (difficulty === "hard" && placed <= 1) {
            const book = openingBook(board, bot);
            if (book) return book;
        }

        // Endgame: <= 8 cells -> perfect solve
        if (empties.length <= 8) {
            return this._endgame(board, bot, human);
        }

        return this._idab(board, bot, human, difficulty);
    }

    private _endgame(board: Board, bot: string, human: string): Coord {
        const empties = empty(board);
        const ordered = this._order(board, empties, bot, human);
        let bestVal = -INF, bestMv = ordered[0];

        for (const [r, c] of ordered) {
            const b = place(board, r, c, bot);
            let val = this._negamax(b, empties.length - 1, -INF, INF, human, bot, bot, [r, c, bot]);
            val = -val;
            if (val > bestVal) { bestVal = val; bestMv = [r, c]; }
        }
        return bestMv;
    }

    private _idab(board: Board, bot: string, human: string, difficulty: string): Coord {
        const deadline = performance.now() + TIME_BUDGET[difficulty];
        const maxD = MAX_DEPTH[difficulty];
        const empties = empty(board);

        // Reset for this search
        this.killers = Array.from({ length: maxD + QSEARCH_DEPTH + 4 }, () => []);
        this.history = Array.from({ length: GRID }, () => Array(GRID).fill(0));
        this.tt = new Map();

        let bestMv = this._order(board, empties, bot, human)[0];

        for (let depth = 1; depth <= maxD; depth++) {
            if (performance.now() >= deadline && depth > 1) break;

            const ordered = this._order(board, empties, bot, human);
            let bestVal = -INF;
            let alpha = -INF;

            for (const [r, c] of ordered) {
                if (performance.now() >= deadline && depth > 1) break;
                const b = place(board, r, c, bot);
                let val = this._negamax(b, depth - 1, -INF, -alpha, human, bot, bot, [r, c, bot], deadline);
                val = -val;
                if (val > bestVal) { bestVal = val; bestMv = [r, c]; }
                alpha = Math.max(alpha, bestVal);
            }
        }
        return bestMv;
    }

    private _negamax(
        board: Board, depth: number, alpha: number, beta: number,
        cur: string, opp: string, rootBot: string,
        last: [number, number, string], deadline?: number
    ): number {
        const [lr, lc, lp] = last;

        // Terminal: last move was a win
        if (wins(board, lr, lc, lp)) {
            const bonus = depth + 1;
            const val = 10000 + bonus;
            return lp === cur ? val : -val;
        }

        const empties = empty(board);

        // Terminal: board full -> 10-chain
        if (!empties.length) {
            const otherPlayer = rootBot === cur ? opp : cur;
            const pBot = find10(board, rootBot);
            const pOpp = find10(board, otherPlayer);
            if (pBot && !pOpp) return cur === rootBot ? 4000 : -4000;
            if (pOpp && !pBot) return cur === rootBot ? -4000 : 4000;
            return 0;
        }

        // Depth limit or time up -> heuristic
        if (depth === 0 || (deadline && performance.now() >= deadline)) {
            const otherPlayer = rootBot === cur ? opp : cur;
            const h = evaluate(board, rootBot, this.cellUses) - evaluate(board, otherPlayer, this.cellUses);
            return cur === rootBot ? h : -h;
        }

        // Transposition table lookup
        const key = boardKey(board) + cur;
        const stored = this.tt.get(key);
        if (stored) {
            const [storedDepth, storedScore, flag] = stored;
            if (storedDepth >= depth) {
                if (flag === "exact") return storedScore;
                if (flag === "lower") alpha = Math.max(alpha, storedScore);
                if (flag === "upper") beta = Math.min(beta, storedScore);
                if (alpha >= beta) return storedScore;
            }
        }

        // Quiescence at depth 0
        if (depth === 0) {
            return this._quiesce(board, alpha, beta, cur, opp, rootBot, deadline);
        }

        // Move ordering with killers
        const killersAtDepth = depth < this.killers.length ? this.killers[depth] : [];
        const ordered = orderMoves(board, empties, cur, opp, killersAtDepth, this.history);

        let bestVal = -INF;
        let ttFlag: TTFlag = "upper";

        for (const [r, c] of ordered) {
            const b = place(board, r, c, cur);
            const val = -this._negamax(b, depth - 1, -beta, -alpha, opp, cur, rootBot, [r, c, cur], deadline);
            if (val > bestVal) { bestVal = val; ttFlag = "exact"; }
            alpha = Math.max(alpha, val);
            if (alpha >= beta) {
                // Beta cutoff — record killer and history
                this._recordKiller(r, c, depth);
                this.history[r][c] += 2 ** depth;
                ttFlag = "lower";
                break;
            }
        }

        this.tt.set(key, [depth, bestVal, ttFlag]);
        return bestVal;
    }

    private _quiesce(
        board: Board, alpha: number, beta: number,
        cur: string, opp: string, rootBot: string,
        deadline?: number, qDepth = QSEARCH_DEPTH
    ): number {
        const otherPlayer = rootBot === cur ? opp : cur;
        const h = evaluate(board, rootBot, this.cellUses) - evaluate(board, otherPlayer, this.cellUses);
        const standPat = cur === rootBot ? h : -h;

        if (standPat >= beta) return beta;
        alpha = Math.max(alpha, standPat);

        if (qDepth === 0 || (deadline && performance.now() >= deadline)) return alpha;

        const empties = empty(board);
        const forcing: Coord[] = [];

        for (const [r, c] of empties) {
            const b = place(board, r, c, cur);
            if (wins(b, r, c, cur)) { forcing.push([r, c]); continue; }
            const b2 = place(board, r, c, opp);
            if (wins(b2, r, c, opp)) forcing.push([r, c]);
        }

        if (!forcing.length) return alpha;

        for (const [r, c] of forcing) {
            const b = place(board, r, c, cur);
            const val = -this._quiesce(b, -beta, -alpha, opp, cur, rootBot, deadline, qDepth - 1);
            if (val >= beta) return beta;
            alpha = Math.max(alpha, val);
        }
        return alpha;
    }

    private _recordKiller(r: number, c: number, depth: number) {
        if (depth >= this.killers.length) return;
        const slot = this.killers[depth];
        const mv: Coord = [r, c];
        if (!slot.some(([kr, kc]) => kr === r && kc === c)) {
            slot.unshift(mv);
            if (slot.length > 2) slot.pop();
        }
    }

    private _order(board: Board, empties: Coord[], player: string, opponent: string): Coord[] {
        return orderMoves(board, empties, player, opponent, [], this.history);
    }
}

// ══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════

let _engine: BotEngine | null = null;

function getEngine(): BotEngine {
    if (!_engine) _engine = new BotEngine();
    return _engine;
}

export type Difficulty = "easy" | "medium" | "hard" | "danger" | "normal" | "machine_god";

/**
 * Main entry point for the frontend.
 * Returns [row, col] for the bot's move.
 */
export function getBotMove(
    board: Board,
    botPlayer: string,
    humanPlayer: string,
    difficulty: Difficulty
): Coord | null {
    const engine = getEngine();
    // Deep-copy the board so the engine doesn't mutate it
    const boardCopy: Board = board.map(row => [...row]);
    return engine.choose(boardCopy, botPlayer, humanPlayer, difficulty);
}

/**
 * Visual delay before the bot "thinks" — in ms (client-side only; GameScreen AI uses the same values).
 * Hard and danger use 0 so the API runs immediately; strength comes from server search, not delay.
 */
export const BOT_DELAY = {
    easy: 400,
    medium: 850,
    hard: 0,
    danger: 0,
    normal: 350,
    machine_god: 0,
} as const satisfies Record<Difficulty, number>;
