# bot.py — XO-Arena Elite AI Bot
#
# Architecture:
#   BotEngine           — stateful class, one instance per session
#   ├── Opening Book    — optimal first moves for hard mode
#   ├── Pattern DB      — pre-indexed cell→pattern membership
#   ├── IDAB            — Iterative Deepening Alpha-Beta w/ time control
#   │   ├── Move Ordering  (win>block>fork>killer>history>heuristic)
#   │   ├── Quiescence     — extend on direct threats
#   │   └── Transposition Table
#   └── Endgame Solver  — perfect minimax when ≤ 8 cells remain
#
# Public API (unchanged from previous version):
#   get_bot_move(engine, difficulty) → (row, col)
#   tick_bot(ui, dt)                → called every frame

import copy
import time
import random
from collections import deque

from win_checker import check_5_line, check_structural_patterns, find_10

# ── Constants ──────────────────────────────────────────────────────────────
GRID   = 5
ALL_RC = [(r, c) for r in range(GRID) for c in range(GRID)]
DIRS   = [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)]
DIRS4  = [(0,1),(1,0),(1,1),(1,-1)]    # canonical 4 for line scanning
INF    = float('inf')

# Evaluation score tables  (index = pieces in line/pattern, opponent not present)
LINE_SCORE = [0, 1, 6, 50, 400, 0]    # 5 = already a win (handled separately)
PAT_SCORE  = [0, 0, 5, 30, 200, 0]
OPPO_MULT  = 1.3                       # opponent threats weighted higher

# Think-time budgets in seconds per difficulty
TIME_BUDGET = {"easy": 0.0, "medium": 0.60, "hard": 1.80}
MAX_DEPTH   = {"easy": 1,   "medium": 5,    "hard": 99}

# Quiescence extension depth
QSEARCH_DEPTH = 2


# ══════════════════════════════════════════════════════════════════════════
#  BOT ENGINE
# ══════════════════════════════════════════════════════════════════════════

class BotEngine:
    """
    Created once and re-used across all games in a session.
    Holds the pattern index and killer/history tables.
    """

    def __init__(self, shiftable_patterns):
        # Pre-build the cell → pattern-membership index
        self.patterns = shiftable_patterns
        self._build_pattern_index()

        # Killer move table: killers[depth] = [move1, move2]
        self.killers  = [[] for _ in range(30)]

        # History heuristic: history[r][c] += 2**depth on cutoff
        self.history  = [[0] * GRID for _ in range(GRID)]

        # Transposition table: board_key → (depth, score, flag)
        # flag: 'exact' | 'lower' | 'upper'
        self.tt = {}

    # ── Pattern index ──────────────────────────────────────────────────────

    def _build_pattern_index(self):
        """
        For every pattern P and every valid placement (br, bc),
        record which cells are part of that instance.
        cell_uses[r][c] → list of (pat_id, instance_cells)
        """
        self.cell_uses = [[[] for _ in range(GRID)] for _ in range(GRID)]
        for pid, pattern in enumerate(self.patterns):
            max_r = max(dr for dr, _ in pattern)
            max_c = max(dc for _, dc in pattern)
            for br in range(GRID - max_r):
                for bc in range(GRID - max_c):
                    cells = tuple((br+dr, bc+dc) for dr, dc in pattern)
                    for r, c in cells:
                        self.cell_uses[r][c].append((pid, cells))

    # ── Public entry point ────────────────────────────────────────────────

    def choose(self, board, bot, human, difficulty):
        """Return (row, col) — the bot's chosen move."""
        empties = _empty(board)
        if not empties:
            return None

        if difficulty == "easy":
            return random.choice(empties)

        # Opening book (hard mode, ≤ 2 moves played)
        placed = sum(1 for r, c in ALL_RC if board[r][c] is not None)
        if difficulty == "hard" and placed <= 1:
            book = _opening_book(board, bot)
            if book:
                return book

        # Endgame: ≤ 8 cells → perfect solve
        if len(empties) <= 8:
            return self._endgame(board, bot, human)

        # IDAB
        return self._idab(board, bot, human, difficulty)

    # ── Opening Book ──────────────────────────────────────────────────────

    # (delegated to module-level function for clarity)

    # ── Endgame Perfect Solver ────────────────────────────────────────────

    def _endgame(self, board, bot, human):
        """Full exhaustive minimax — only called when ≤ 8 cells remain."""
        empties = _empty(board)
        ordered = self._order(board, empties, bot, human)
        best_val, best_mv = -INF, ordered[0]

        for r, c in ordered:
            b   = _place(board, r, c, bot)
            val = self._negamax(b, depth=len(empties)-1,
                                alpha=-INF, beta=INF,
                                cur=human, opp=bot,
                                root_bot=bot, last=(r, c, bot))
            val = -val
            if val > best_val:
                best_val, best_mv = val, (r, c)

        return best_mv

    # ── IDAB ──────────────────────────────────────────────────────────────

    def _idab(self, board, bot, human, difficulty):
        """
        Iterative Deepening Alpha-Beta.
        Searches depth 1, 2, 3… until time budget expires.
        Always returns the best move found in the last completed depth.
        """
        deadline = time.monotonic() + TIME_BUDGET[difficulty]
        max_d    = MAX_DEPTH[difficulty]
        empties  = _empty(board)

        # Reset killer/history for this search
        self.killers = [[] for _ in range(max_d + QSEARCH_DEPTH + 4)]
        self.history = [[0] * GRID for _ in range(GRID)]
        self.tt      = {}

        best_mv = self._order(board, empties, bot, human)[0]

        for depth in range(1, max_d + 1):
            if time.monotonic() >= deadline and depth > 1:
                break

            ordered  = self._order(board, empties, bot, human)
            best_val = -INF
            alpha    = -INF

            for r, c in ordered:
                if time.monotonic() >= deadline and depth > 1:
                    break
                b   = _place(board, r, c, bot)
                val = self._negamax(b, depth=depth-1,
                                    alpha=-INF, beta=-alpha,
                                    cur=human, opp=bot,
                                    root_bot=bot, last=(r, c, bot),
                                    deadline=deadline)
                val = -val
                if val > best_val:
                    best_val = val
                    best_mv  = (r, c)
                alpha = max(alpha, best_val)

        return best_mv

    # ── Negamax (α-β) core ───────────────────────────────────────────────

    def _negamax(self, board, depth, alpha, beta, cur, opp,
                 root_bot, last, deadline=None):
        """
        Negamax with alpha-beta pruning.
        `cur`  = player whose turn it is at this node
        `opp`  = other player
        Returns score from `cur`'s perspective.
        """
        lr, lc, lp = last

        # ── Terminal: last move was a win ──
        if _wins(board, lr, lc, lp, self.patterns):
            bonus = depth + 1
            val   = 10000 + bonus
            return val if lp == cur else -val

        empties = _empty(board)

        # ── Terminal: board full → 10-chain tiebreak ──
        if not empties:
            p_bot = find_10(board, root_bot, DIRS, GRID)
            p_opp = find_10(board, opp if root_bot == cur else cur, DIRS, GRID)
            if p_bot and not p_opp:
                return 4000 if cur == root_bot else -4000
            elif p_opp and not p_bot:
                return -4000 if cur == root_bot else 4000
            return 0

        # ── Depth limit or time up → heuristic ──
        if depth == 0 or (deadline and time.monotonic() >= deadline):
            h = (_eval(board, root_bot, self.patterns, self.cell_uses)
                 - _eval(board, opp if root_bot == cur else cur,
                         self.patterns, self.cell_uses))
            return h if cur == root_bot else -h

        # ── Transposition table ──
        key = (_board_key(board), cur)
        if key in self.tt:
            stored_depth, stored_score, flag = self.tt[key]
            if stored_depth >= depth:
                if flag == 'exact':
                    return stored_score
                elif flag == 'lower':
                    alpha = max(alpha, stored_score)
                elif flag == 'upper':
                    beta = min(beta, stored_score)
                if alpha >= beta:
                    return stored_score

        # ── Quiescence: extend if opponent has a direct threat ──
        if depth == 0:
            return self._quiesce(board, alpha, beta, cur, opp,
                                 root_bot, deadline)

        # ── Move ordering ──
        ordered = self._order_with_killers(board, empties, cur, opp, depth)

        best_val = -INF
        flag     = 'upper'

        for r, c in ordered:
            b   = _place(board, r, c, cur)
            val = -self._negamax(b, depth-1, -beta, -alpha,
                                 opp, cur, root_bot, (r, c, cur), deadline)
            if val > best_val:
                best_val = val
                flag     = 'exact'

            alpha = max(alpha, val)

            if alpha >= beta:
                # β-cutoff — record killer and history
                self._record_killer(r, c, depth)
                self.history[r][c] += 2 ** depth
                flag = 'lower'
                break

        self.tt[key] = (depth, best_val, flag)
        return best_val

    # ── Quiescence Search ─────────────────────────────────────────────────

    def _quiesce(self, board, alpha, beta, cur, opp, root_bot, deadline,
                 qdepth=QSEARCH_DEPTH):
        """
        Extend search on forcing moves (immediate win / block) only.
        Prevents the horizon effect on threat positions.
        """
        # Stand-pat: evaluate as-is
        h = (_eval(board, root_bot, self.patterns, self.cell_uses)
             - _eval(board, opp if root_bot == cur else cur,
                     self.patterns, self.cell_uses))
        stand_pat = h if cur == root_bot else -h

        if stand_pat >= beta:
            return beta
        alpha = max(alpha, stand_pat)

        if qdepth == 0 or (deadline and time.monotonic() >= deadline):
            return alpha

        empties = _empty(board)

        # Only investigate moves that win or block a win
        forcing = []
        for r, c in empties:
            b = _place(board, r, c, cur)
            if _wins(b, r, c, cur, self.patterns):
                forcing.append((r, c))
                continue
            b2 = _place(board, r, c, opp)
            if _wins(b2, r, c, opp, self.patterns):
                forcing.append((r, c))

        if not forcing:
            return alpha

        for r, c in forcing:
            b   = _place(board, r, c, cur)
            val = -self._quiesce(b, -beta, -alpha, opp, cur,
                                 root_bot, deadline, qdepth-1)
            if val >= beta:
                return beta
            alpha = max(alpha, val)

        return alpha

    # ── Killer move management ────────────────────────────────────────────

    def _record_killer(self, r, c, depth):
        slot = self.killers[depth]
        mv   = (r, c)
        if mv not in slot:
            slot.insert(0, mv)
            if len(slot) > 2:
                slot.pop()

    # ── Move ordering ─────────────────────────────────────────────────────

    def _order(self, board, empties, player, opponent):
        """Simple ordering: win > block-win > fork > block-fork > heuristic."""
        return _order_moves(board, empties, player, opponent,
                            self.patterns, [], self.history)

    def _order_with_killers(self, board, empties, player, opponent, depth):
        """Full ordering including killers at this depth."""
        killers = self.killers[depth] if depth < len(self.killers) else []
        return _order_moves(board, empties, player, opponent,
                            self.patterns, killers, self.history)


# ══════════════════════════════════════════════════════════════════════════
#  MODULE-LEVEL HELPERS
# ══════════════════════════════════════════════════════════════════════════

def _empty(board):
    return [(r, c) for r, c in ALL_RC if board[r][c] is None]


def _place(board, r, c, player):
    b = copy.deepcopy(board)
    b[r][c] = player
    return b


def _board_key(board):
    return tuple(board[r][c] for r, c in ALL_RC)


def _wins(board, r, c, player, patterns):
    w, _ = check_5_line(board, r, c, player, DIRS, GRID)
    if w:
        return True
    w, _ = check_structural_patterns(board, player, patterns, GRID)
    return w


# ── Opening Book ──────────────────────────────────────────────────────────

# Preferred non-centre corners and edges for first move
_BOOK_FIRST  = [(1, 1), (1, 3), (3, 1), (3, 3)]
_BOOK_SECOND = [(0, 0), (0, 4), (4, 0), (4, 4), (0, 2), (2, 0), (2, 4), (4, 2)]

def _opening_book(board, bot):
    placed = [(r, c) for r, c in ALL_RC if board[r][c] is not None]
    n      = len(placed)

    if n == 0:
        # Bot moves first — avoid centre (gives opponent 2 extra turns)
        candidates = [m for m in _BOOK_FIRST if board[m[0]][m[1]] is None]
        return random.choice(candidates) if candidates else None

    if n == 1:
        # Bot moves second — pick a strong corner not yet taken
        candidates = [m for m in _BOOK_SECOND if board[m[0]][m[1]] is None]
        return random.choice(candidates) if candidates else None

    return None


# ── Threat Counting ───────────────────────────────────────────────────────

def _count_threats(board, player, patterns):
    """Number of un-blocked threat lines with ≥ 2 of player's pieces."""
    opponent = "P2" if player == "P1" else "P1"
    threats  = 0

    # Linear threats (4 canonical directions)
    for dr, dc in DIRS4:
        for r in range(GRID):
            for c in range(GRID):
                mine = blk = length = 0
                rr, cc = r, c
                while 0 <= rr < GRID and 0 <= cc < GRID:
                    v = board[rr][cc]
                    if v == opponent:
                        blk = 1; break
                    if v == player:
                        mine += 1
                    length += 1
                    rr += dr; cc += dc
                if not blk and mine >= 2 and length >= 5:
                    threats += 1

    # Pattern threats
    for pattern in patterns:
        max_r = max(dr for dr, _ in pattern)
        max_c = max(dc for _, dc in pattern)
        for br in range(GRID - max_r):
            for bc in range(GRID - max_c):
                mine = blk = 0
                for dr, dc in pattern:
                    v = board[br+dr][bc+dc]
                    if v == opponent: blk = 1; break
                    if v == player:   mine += 1
                if not blk and mine >= 2:
                    threats += 1

    return threats


# ── Evaluation Function ───────────────────────────────────────────────────

def _eval(board, player, patterns, cell_uses):
    """
    Full heuristic evaluation from `player`'s perspective.
    Uses the pre-built cell_uses index for pattern scoring.
    """
    opponent = "P2" if player == "P1" else "P1"
    score    = 0

    # ── 1. Linear streaks ──
    for dr, dc in DIRS4:
        for r in range(GRID):
            for c in range(GRID):
                my_run = opp_run = 0
                my_blk = opp_blk = False
                length = 0
                rr, cc = r, c
                while 0 <= rr < GRID and 0 <= cc < GRID:
                    v = board[rr][cc]
                    if v == player:
                        if opp_run > 0: opp_blk = True
                        my_run += 1
                    elif v == opponent:
                        if my_run > 0:  my_blk = True
                        opp_run += 1
                    length += 1
                    rr += dr; cc += dc

                if my_run >= 2 and not my_blk:
                    score += LINE_SCORE[min(my_run, 5)]
                if opp_run >= 2 and not opp_blk:
                    score -= int(LINE_SCORE[min(opp_run, 5)] * OPPO_MULT)

    # ── 2. Pattern progress (via pre-built index) ──
    seen = set()
    for r in range(GRID):
        for c in range(GRID):
            if board[r][c] is None:
                continue
            for pid, cells in cell_uses[r][c]:
                key = (pid, cells)
                if key in seen:
                    continue
                seen.add(key)

                mine = opp_cnt = 0
                for cr, cc in cells:
                    v = board[cr][cc]
                    if v == player:    mine    += 1
                    elif v == opponent: opp_cnt += 1

                if opp_cnt == 0 and mine >= 2:
                    score += PAT_SCORE[min(mine, 5)]
                if mine == 0 and opp_cnt >= 2:
                    score -= int(PAT_SCORE[min(opp_cnt, 5)] * OPPO_MULT)

    # ── 3. BFS connectivity (10-chain potential) ──
    visited = [[False]*GRID for _ in range(GRID)]
    for r in range(GRID):
        for c in range(GRID):
            if board[r][c] == player and not visited[r][c]:
                sz = _bfs(board, r, c, player, visited)
                if sz >= 3:
                    score += sz * 12

    # ── 4. Fork bonus ──
    threat_count = _count_threats(board, player, patterns)
    if threat_count >= 2:
        score += 80 * (threat_count - 1)

    # ── 5. Positional bias ──
    for r in range(GRID):
        for c in range(GRID):
            if board[r][c] == player:
                score += max(0, 4 - (abs(r-2) + abs(c-2)))

    return score


def _bfs(board, sr, sc, player, visited):
    q = deque([(sr, sc)])
    visited[sr][sc] = True
    size = 0
    while q:
        r, c = q.popleft()
        size += 1
        for dr, dc in DIRS:
            nr, nc = r+dr, c+dc
            if (0 <= nr < GRID and 0 <= nc < GRID
                    and not visited[nr][nc]
                    and board[nr][nc] == player):
                visited[nr][nc] = True
                q.append((nr, nc))
    return size


# ── Move Ordering ─────────────────────────────────────────────────────────

def _order_moves(board, empties, player, opponent, patterns, killers, history):
    """
    Full priority ordering:
      1. Immediate win
      2. Block opponent immediate win
      3. Fork creation (2+ own threats)
      4. Block opponent fork
      5. Killer moves from this depth
      6. History heuristic score (descending)
    """
    win_mvs = []; blk_mvs = []; fork_mvs = []; bfork_mvs = []
    kill_mvs = []; rest = []

    for r, c in empties:
        b = _place(board, r, c, player)

        if _wins(b, r, c, player, patterns):
            win_mvs.append((r, c)); continue

        b2 = _place(board, r, c, opponent)
        if _wins(b2, r, c, opponent, patterns):
            blk_mvs.append((r, c)); continue

        if _count_threats(b, player, patterns) >= 2:
            fork_mvs.append((r, c)); continue

        b3 = _place(board, r, c, opponent)
        if _count_threats(b3, opponent, patterns) >= 2:
            bfork_mvs.append((r, c)); continue

        if (r, c) in killers:
            kill_mvs.append((r, c)); continue

        rest.append((history[r][c], r, c))

    rest.sort(key=lambda x: x[0], reverse=True)
    return (win_mvs + blk_mvs + fork_mvs + bfork_mvs
            + kill_mvs + [(r, c) for _, r, c in rest])


# ══════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════

# One engine instance per session — created lazily
_ENGINE: BotEngine | None = None


def _get_engine(shiftable_patterns):
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = BotEngine(shiftable_patterns)
    return _ENGINE


def get_bot_move(engine, difficulty):
    """Return (row, col) for the bot to play."""
    be    = _get_engine(engine.shiftable_patterns)
    board = copy.deepcopy(engine.board)
    bot   = engine.current_player
    human = "P2" if bot == "P1" else "P1"
    return be.choose(board, bot, human, difficulty)


def tick_bot(ui, dt):
    """
    Called every frame from the main game loop.
    Manages think-delay; fires the actual move when the timer expires.
    """
    if not ui.bot_mode:
        return
    if ui.engine.is_finished():
        return
    if (ui.show_splash or ui.show_rulebreaker
            or ui.waiting_ready or ui.match_over
            or ui.forfeit_screen):
        return
    if ui.engine.get_current_player() != ui.bot_player:
        return

    if not ui.bot_thinking:
        ui.bot_thinking = True
        # Minimum visual delay so the UI shows "BOT THINKING..."
        delays = {"easy": 0.4, "medium": 0.85, "hard": 2.0}
        ui.bot_think_timer = delays.get(ui.bot_difficulty, 0.85)
    else:
        ui.bot_think_timer -= dt / 1000.0
        if ui.bot_think_timer <= 0:
            move = get_bot_move(ui.engine, ui.bot_difficulty)
            if move is not None:
                row, col = move
                current  = ui.engine.get_current_player()

                # Respect the c3_blocked rule (same as human's event handler)
                if ui.c3_blocked and ui.engine.moves_played == 0:
                    if row == 2 and col == 2:
                        alts = [(r, c) for r, c in _empty(ui.engine.board)
                                if not (r == 2 and c == 2)]
                        if alts:
                            row, col = alts[0]

                if ui.engine.deploy(row, col):
                    if ui.c3_blocked and ui.engine.moves_played == 1:
                        ui.c3_blocked = False
                    ui.log_move(row, col, current)

            ui.bot_thinking = False
