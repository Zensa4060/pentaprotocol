"""
danger_bot7.py  --  DANGER difficulty engine for 7x7 PentaProtocol.

Flat board with make/unmake (no copies), Zobrist-hashed transposition table,
IDAB + negamax + alpha-beta, killer moves, history heuristic, quiescence
search on forcing moves, fork detection, threat-table evaluation,
multi-component connectivity with bridge bonuses, and endgame path planning.
"""

import time
from collections import deque
import random as _rng

# ═══════════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════════

GRID = 7
CELLS = GRID * GRID
CENTER = 3
CENTER_IDX = CENTER * GRID + CENTER
INF = 10 ** 9

DIRS4 = ((0, 1), (1, 0), (1, 1), (1, -1))
ALL_DIRS = (
    (0, 1), (1, 0), (1, 1), (1, -1),
    (0, -1), (-1, 0), (-1, -1), (-1, 1),
)

MAX_DEPTH = 11
TIME_BUDGET_EARLY = 1.5
TIME_BUDGET_LATE = 1.5
QSEARCH_DEPTH = 4


def _rc(idx):
    return divmod(idx, GRID)


def _idx(r, c):
    return r * GRID + c


# ── Pre-built neighbor table (tuples for speed) ────────────────────
_NBR: list[list[int]] = [[] for _ in range(CELLS)]
for _i in range(CELLS):
    _r, _c = _rc(_i)
    for _dr, _dc in ALL_DIRS:
        _nr, _nc = _r + _dr, _c + _dc
        if 0 <= _nr < GRID and 0 <= _nc < GRID:
            _NBR[_i].append(_idx(_nr, _nc))
NEIGHBORS: tuple[tuple[int, ...], ...] = tuple(tuple(n) for n in _NBR)
del _NBR

# ── Manhattan distance from centre for every cell ──────────────────
CENTER_DIST: tuple[int, ...] = tuple(
    abs(r - CENTER) + abs(c - CENTER)
    for r in range(GRID) for c in range(GRID)
)

# ── Zobrist random keys ───────────────────────────────────────────
_rng.seed(0xDEADBEEF)
ZOBRIST: tuple[tuple[int, ...], ...] = tuple(
    tuple(_rng.getrandbits(64) for _ in range(3))
    for _ in range(CELLS)
)

# ── Threat-level score tables (index = count of friendly stones) ──
#    Used for both 7-in-a-line windows and pattern placements.
THREAT_MY  = (0, 2, 30, 300, 2500, 15000, 100000, 1_000_000)
THREAT_OPP = (0, 3, 45, 450, 3800, 22000, 150000, 1_000_000)

# ═══════════════════════════════════════════════════════════════════
#  ENGINE
# ═══════════════════════════════════════════════════════════════════

class DangerBot7Engine:
    """Nearly-unbeatable 7x7 bot."""

    __slots__ = (
        "patterns", "pat_cells", "cell_pats",
        "line_cells", "cell_lines",
        "tt", "history", "killers", "nodes",
    )

    def __init__(self, patterns):
        self.patterns = patterns

        self.pat_cells: list[tuple[int, ...]] = []
        self.cell_pats: list[list[int]] = [[] for _ in range(CELLS)]
        self._build_patterns()

        self.line_cells: list[tuple[int, ...]] = []
        self.cell_lines: list[list[int]] = [[] for _ in range(CELLS)]
        self._build_lines()

        self.tt: dict = {}
        self.history: list[int] = [0] * CELLS
        self.killers: list[list] = [[None, None] for _ in range(MAX_DEPTH + 8)]
        self.nodes: int = 0

    # ── index construction ─────────────────────────────────────────

    def _build_patterns(self):
        for pat in self.patterns:
            max_r = max(dr for dr, _ in pat)
            max_c = max(dc for _, dc in pat)
            for br in range(GRID - max_r):
                for bc in range(GRID - max_c):
                    cells = tuple(_idx(br + dr, bc + dc) for dr, dc in pat)
                    pi = len(self.pat_cells)
                    self.pat_cells.append(cells)
                    for idx in cells:
                        self.cell_pats[idx].append(pi)

    def _build_lines(self):
        for dr, dc in DIRS4:
            for r in range(GRID):
                for c in range(GRID):
                    er, ec = r + 6 * dr, c + 6 * dc
                    if not (0 <= er < GRID and 0 <= ec < GRID):
                        continue
                    win = tuple(_idx(r + i * dr, c + i * dc) for i in range(7))
                    li = len(self.line_cells)
                    self.line_cells.append(win)
                    for idx in win:
                        self.cell_lines[idx].append(li)

    # ── flat-board conversion ──────────────────────────────────────

    @staticmethod
    def to_flat(board_2d, bot, human):
        """2-D string board -> flat int list + Zobrist hash.
        bot -> 1, human -> 2, empty -> 0."""
        flat = [0] * CELLS
        zhash = 0
        for r in range(GRID):
            row = board_2d[r]
            for c in range(GRID):
                v = row[c]
                if v is not None:
                    p = 1 if v == bot else 2
                    idx = r * GRID + c
                    flat[idx] = p
                    zhash ^= ZOBRIST[idx][p]
        return flat, zhash

    # ── win detection (in-place flat board) ────────────────────────

    def _line_win(self, board, idx, player):
        r, c = _rc(idx)
        for dr, dc in ALL_DIRS:
            cnt = 1
            for sign in (1, -1):
                rr, cc = r + sign * dr, c + sign * dc
                while 0 <= rr < GRID and 0 <= cc < GRID and board[rr * GRID + cc] == player:
                    cnt += 1
                    rr += sign * dr
                    cc += sign * dc
            if cnt >= 7:
                return True
        return False

    def _pattern_win_at(self, board, idx, player):
        for pi in self.cell_pats[idx]:
            cells = self.pat_cells[pi]
            ok = True
            for ci in cells:
                if board[ci] != player:
                    ok = False
                    break
            if ok:
                return True
        return False

    def _wins_at(self, board, idx, player):
        return self._line_win(board, idx, player) or self._pattern_win_at(board, idx, player)

    # ── threat helpers ─────────────────────────────────────────────

    def _get_forcing(self, board, cur, opp):
        """Return immediate-win moves, then immediate-block moves."""
        wins: list[int] = []
        blocks: list[int] = []
        for idx in range(CELLS):
            if board[idx]:
                continue
            board[idx] = cur
            if self._wins_at(board, idx, cur):
                board[idx] = 0
                wins.append(idx)
                continue
            board[idx] = opp
            if self._wins_at(board, idx, opp):
                board[idx] = 0
                blocks.append(idx)
                continue
            board[idx] = 0
        return wins + blocks

    def _count_threat_cells(self, board, player):
        """Cells where playing would create a 6-of-7 or complete a win
        (i.e. cells that ARE a 1-move-away threat after being filled)."""
        opp = 3 - player
        out: list[int] = []
        for idx in range(CELLS):
            if board[idx]:
                continue
            found = False
            for li in self.cell_lines[idx]:
                win = self.line_cells[li]
                mine, blk = 0, False
                for ci in win:
                    v = board[ci]
                    if v == player:
                        mine += 1
                    elif v == opp:
                        blk = True
                        break
                if not blk and mine >= 6:
                    found = True
                    break
            if not found:
                for pi in self.cell_pats[idx]:
                    cells = self.pat_cells[pi]
                    mine, blk = 0, False
                    for ci in cells:
                        v = board[ci]
                        if v == player:
                            mine += 1
                        elif v == opp:
                            blk = True
                            break
                    if not blk and mine >= 6:
                        found = True
                        break
            if found:
                out.append(idx)
        return out

    # ── connectivity ───────────────────────────────────────────────

    @staticmethod
    def _components(board, player):
        vis = bytearray(CELLS)
        comps: list[list[int]] = []
        for idx in range(CELLS):
            if board[idx] != player or vis[idx]:
                continue
            comp: list[int] = []
            q = deque((idx,))
            vis[idx] = 1
            while q:
                ci = q.popleft()
                comp.append(ci)
                for ni in NEIGHBORS[ci]:
                    if board[ni] == player and not vis[ni]:
                        vis[ni] = 1
                        q.append(ni)
            comps.append(comp)
        return comps

    def _connectivity_eval(self, board, me, opp, mp):
        my_c = self._components(board, me)
        opp_c = self._components(board, opp)

        my_big = max((len(c) for c in my_c), default=0)
        opp_big = max((len(c) for c in opp_c), default=0)

        my_frag = max(0, len(my_c) - 1) * 18
        opp_frag = max(0, len(opp_c) - 1) * 18

        my_br = self._bridge_bonus(board, me, my_c)
        opp_br = self._bridge_bonus(board, opp, opp_c)

        w = 3.0 + (mp / 49.0) * 20.0
        return int(((my_big - my_frag + my_br) - (opp_big - opp_frag + opp_br)) * w)

    @staticmethod
    def _bridge_bonus(board, player, comps):
        if len(comps) < 2:
            return 0
        cid = [0] * CELLS
        for ci, comp in enumerate(comps, 1):
            for idx in comp:
                cid[idx] = ci
        bonus = 0
        for idx in range(CELLS):
            if board[idx]:
                continue
            adj: set[int] = set()
            for ni in NEIGHBORS[idx]:
                if board[ni] == player:
                    adj.add(cid[ni])
                    if len(adj) >= 2:
                        bonus += 12
                        break
        return bonus

    # ── endgame path estimation ────────────────────────────────────

    def _path_estimate(self, board, player):
        """Bounded DFS for longest simple path through player's stones."""
        comps = self._components(board, player)
        if not comps:
            return 0
        largest = max(comps, key=len)
        sz = len(largest)
        if sz < 10:
            return sz

        best = 0
        budget = 4000
        vis = bytearray(CELLS)

        def dfs(idx, length):
            nonlocal best, budget
            budget -= 1
            if length > best:
                best = length
            if best >= 20 or budget <= 0:
                return
            for ni in NEIGHBORS[idx]:
                if board[ni] == player and not vis[ni]:
                    vis[ni] = 1
                    dfs(ni, length + 1)
                    vis[ni] = 0

        starts = sorted(
            largest,
            key=lambda x: sum(1 for ni in NEIGHBORS[x] if board[ni] == player),
        )
        for s in starts[:6]:
            if budget <= 0 or best >= 20:
                break
            for i in range(CELLS):
                vis[i] = 0
            vis[s] = 1
            dfs(s, 1)
        return best

    # ── static evaluation ──────────────────────────────────────────

    def _evaluate(self, board, cur, opp, mp):
        me, them = cur, opp
        score = 0

        # 1. Line windows
        seen_l: set[int] = set()
        for idx in range(CELLS):
            if not board[idx]:
                continue
            for li in self.cell_lines[idx]:
                if li in seen_l:
                    continue
                seen_l.add(li)
                win = self.line_cells[li]
                mine, theirs = 0, 0
                for ci in win:
                    v = board[ci]
                    if v == me:
                        mine += 1
                    elif v == them:
                        theirs += 1
                if mine and not theirs:
                    score += THREAT_MY[mine]
                elif theirs and not mine:
                    score -= THREAT_OPP[theirs]

        # 2. Pattern placements
        seen_p: set[int] = set()
        for idx in range(CELLS):
            if not board[idx]:
                continue
            for pi in self.cell_pats[idx]:
                if pi in seen_p:
                    continue
                seen_p.add(pi)
                cells = self.pat_cells[pi]
                mine, theirs = 0, 0
                for ci in cells:
                    v = board[ci]
                    if v == me:
                        mine += 1
                    elif v == them:
                        theirs += 1
                if mine and not theirs:
                    score += THREAT_MY[mine]
                elif theirs and not mine:
                    score -= THREAT_OPP[theirs]

        # 3. Connectivity (components, fragmentation, bridges)
        score += self._connectivity_eval(board, me, them, mp)

        # 4. Centre control
        for idx in range(CELLS):
            b = max(0, 4 - CENTER_DIST[idx]) << 2          # * 4
            if board[idx] == me:
                score += b
            elif board[idx] == them:
                score -= b

        # 5. Late-game path planning (35+ moves)
        if mp >= 35:
            my_p = self._path_estimate(board, me)
            opp_p = self._path_estimate(board, them)
            pw = 25.0 + (mp - 35) * 8.0
            score += int((my_p - opp_p) * pw)

        return score

    def _eval_full(self, board, cur, opp):
        """Score a completely filled board (20-pt connection rule)."""
        my_ok = self._path_estimate(board, cur) >= 20
        opp_ok = self._path_estimate(board, opp) >= 20
        if my_ok and not opp_ok:
            return 800_000
        if opp_ok and not my_ok:
            return -800_000
        mc = self._components(board, cur)
        oc = self._components(board, opp)
        return (max((len(c) for c in mc), default=0) -
                max((len(c) for c in oc), default=0)) * 500

    # ── quiescence search ──────────────────────────────────────────

    def _quiesce(self, board, zhash, alpha, beta, cur, opp, mp, qd):
        stand = self._evaluate(board, cur, opp, mp)
        if stand >= beta:
            return beta
        if stand > alpha:
            alpha = stand
        if qd <= 0:
            return alpha

        forcing = self._get_forcing(board, cur, opp)
        if not forcing:
            return alpha

        for idx in forcing:
            board[idx] = cur
            zh2 = zhash ^ ZOBRIST[idx][cur]

            if self._wins_at(board, idx, cur):
                board[idx] = 0
                return 1_000_000

            val = -self._quiesce(board, zh2, -beta, -alpha, opp, cur, mp + 1, qd - 1)
            board[idx] = 0

            if val >= beta:
                return beta
            if val > alpha:
                alpha = val
        return alpha

    # ── move ordering ──────────────────────────────────────────────

    def _order(self, empties, depth, tt_move):
        hist = self.history
        k0, k1 = self.killers[depth]
        buf: list[tuple[int, int]] = []
        for idx in empties:
            s = hist[idx] * 100
            if idx == tt_move:
                s += 10_000_000
            elif idx == k0:
                s += 5_000_000
            elif idx == k1:
                s += 4_000_000
            s += (6 - CENTER_DIST[idx]) * 10
            buf.append((s, idx))
        buf.sort(reverse=True)
        return [idx for _, idx in buf]

    # ── negamax ────────────────────────────────────────────────────

    def _negamax(self, board, zhash, depth, alpha, beta,
                 cur, opp, last, mp, dl):
        self.nodes += 1
        if time.monotonic() >= dl:
            return 0

        if last >= 0 and self._wins_at(board, last, 3 - cur):
            return -(1_000_000 + depth)

        if mp >= CELLS:
            return self._eval_full(board, cur, opp)

        if depth <= 0:
            return self._quiesce(board, zhash, alpha, beta, cur, opp, mp, QSEARCH_DEPTH)

        # TT probe
        tt_move = -1
        key = (zhash, cur)
        entry = self.tt.get(key)
        if entry is not None:
            d, v, f, bm = entry
            tt_move = bm
            if d >= depth:
                if f == 0:
                    return v
                if f == 1 and v > alpha:
                    alpha = v
                elif f == 2 and v < beta:
                    beta = v
                if alpha >= beta:
                    return v

        empties = [i for i in range(CELLS) if not board[i]]
        moves = self._order(empties, depth, tt_move)
        if not moves:
            return self._evaluate(board, cur, opp, mp)

        best_v = -INF
        best_m = moves[0]
        orig_alpha = alpha

        for idx in moves:
            if time.monotonic() >= dl:
                break

            board[idx] = cur
            zh2 = zhash ^ ZOBRIST[idx][cur]
            v = -self._negamax(board, zh2, depth - 1, -beta, -alpha,
                               opp, cur, idx, mp + 1, dl)
            board[idx] = 0

            if v > best_v:
                best_v = v
                best_m = idx
            if v > alpha:
                alpha = v
            if alpha >= beta:
                self.history[idx] += 1 << depth
                k = self.killers[depth]
                if k[0] != idx:
                    k[1] = k[0]
                    k[0] = idx
                break

        if best_v <= orig_alpha:
            flag = 2        # upper bound
        elif best_v >= beta:
            flag = 1        # lower bound
        else:
            flag = 0        # exact
        self.tt[key] = (depth, best_v, flag, best_m)
        return best_v

    # ── IDAB ───────────────────────────────────────────────────────

    def _idab(self, board, zhash, me, opp, empties, mp):
        ordered = sorted(empties, key=lambda x: CENTER_DIST[x])
        max_depth = 10 if mp < 10 else MAX_DEPTH
        time_budget = TIME_BUDGET_EARLY if mp < 10 else TIME_BUDGET_LATE
        dl = time.monotonic() + time_budget

        self.tt.clear()
        self.history = [0] * CELLS
        self.killers = [[None, None] for _ in range(MAX_DEPTH + 8)]
        self.nodes = 0

        best_mv = ordered[0]

        for depth in range(1, max_depth + 1):
            if time.monotonic() >= dl and depth > 1:
                break

            trial = [best_mv] + [m for m in ordered if m != best_mv]
            d_best = best_mv
            d_val = -INF
            alpha = -INF

            for idx in trial:
                if time.monotonic() >= dl and depth > 1:
                    break

                board[idx] = me
                zh2 = zhash ^ ZOBRIST[idx][me]
                val = -self._negamax(board, zh2, depth - 1, -INF, -alpha,
                                     opp, me, idx, mp + 1, dl)
                board[idx] = 0

                if val > d_val:
                    d_val = val
                    d_best = idx
                if val > alpha:
                    alpha = val

            if time.monotonic() < dl or depth == 1:
                best_mv = d_best
            if d_val > 900_000:
                break

        return best_mv

    # ── public entry point ─────────────────────────────────────────

    def choose(self, board_2d, bot, human, moves_played, c3_blocked):
        board, zhash = self.to_flat(board_2d, bot, human)
        me, opp = 1, 2

        empties = [i for i in range(CELLS) if not board[i]]
        if not empties:
            return None

        if c3_blocked and moves_played == 0:
            empties = [i for i in empties if i != CENTER_IDX]
            if not empties:
                return None

        # 1-ply win
        for idx in empties:
            board[idx] = me
            if self._wins_at(board, idx, me):
                board[idx] = 0
                return _rc(idx)
            board[idx] = 0

        # 1-ply block
        for idx in empties:
            board[idx] = opp
            if self._wins_at(board, idx, opp):
                board[idx] = 0
                return _rc(idx)
            board[idx] = 0

        # Fork detection (2+ simultaneous threats -> play one)
        my_threats = self._count_threat_cells(board, me)
        if len(my_threats) >= 2:
            return _rc(my_threats[0])

        # Full search
        mv = self._idab(board, zhash, me, opp, empties, moves_played)
        return _rc(mv)
