import copy
import time
import random
from typing import List, Optional
from collections import deque
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.patterns7 import generate_all_patterns_7

router = APIRouter()

GRID = 7
ALL_RC = [(r, c) for r in range(GRID) for c in range(GRID)]
CENTER = 3
DIRS4 = [(0, 1), (1, 0), (1, 1), (1, -1)]
ALL_DIRS = [(0, 1), (1, 0), (1, 1), (1, -1), (0, -1), (-1, 0), (-1, -1), (-1, 1)]
INF = 10**9


class Bot7Engine:
    def __init__(self, patterns):
        self.patterns = patterns
        self.cell_index = [[[] for _ in range(GRID)] for _ in range(GRID)]
        self._build_index()
        self.tt = {}
        self.history = [[0] * GRID for _ in range(GRID)]

    def _build_index(self):
        for pid, pat in enumerate(self.patterns):
            max_r = max(dr for dr, _ in pat)
            max_c = max(dc for _, dc in pat)
            for br in range(GRID - max_r):
                for bc in range(GRID - max_c):
                    cells = tuple((br + dr, bc + dc) for dr, dc in pat)
                    for r, c in cells:
                        self.cell_index[r][c].append((pid, cells))

    def choose(self, board, bot, human, difficulty, moves_played, c3_blocked):
        empties = _empties(board)
        if not empties:
            return None

        if c3_blocked and moves_played == 0:
            empties = [(r, c) for r, c in empties if not (r == CENTER and c == CENTER)]
            if not empties:
                return None

        if difficulty == "easy":
            return self._easy(board, bot, human, empties, moves_played)

        for r, c in empties:
            if _wins(board, r, c, bot, self.patterns):
                return (r, c)
        for r, c in empties:
            if _wins(board, r, c, human, self.patterns):
                return (r, c)

        return self._idab(board, bot, human, difficulty, empties, moves_played)

    def _easy(self, board, bot, human, empties, moves_played):
        for r, c in empties:
            if _wins(board, r, c, bot, self.patterns):
                return (r, c)
        for r, c in empties:
            if _wins(board, r, c, human, self.patterns):
                return (r, c)

        if moves_played < 4:
            near_center = [(r, c) for r, c in empties if abs(r - CENTER) <= 1 and abs(c - CENTER) <= 1]
            if near_center:
                return random.choice(near_center)
        return random.choice(empties)

    def _idab(self, board, bot, human, difficulty, empties, moves_played):
        ordered = sorted(empties, key=lambda x: abs(x[0] - CENTER) + abs(x[1] - CENTER))
        max_d = {"medium": 4, "hard": 6}.get(difficulty, 4)
        budget = {"medium": 1.5, "hard": 4.0}.get(difficulty, 1.5)
        deadline = time.monotonic() + budget

        best_mv = ordered[0]
        self.tt = {}
        self.history = [[0] * GRID for _ in range(GRID)]

        for depth in range(1, max_d + 1):
            if time.monotonic() >= deadline and depth > 1:
                break

            d_ordered = [best_mv] + [m for m in ordered if m != best_mv]
            d_best_mv = best_mv
            d_best_val = -INF
            alpha = -INF

            for r, c in d_ordered:
                if time.monotonic() >= deadline and depth > 1:
                    break
                b = _place(board, r, c, bot)
                val = -self._negamax(b, depth - 1, -INF, -alpha, human, bot, bot, (r, c, bot), deadline, moves_played + 1)
                if val > d_best_val:
                    d_best_val = val
                    d_best_mv = (r, c)
                alpha = max(alpha, val)

            if time.monotonic() < deadline or depth == 1:
                best_mv = d_best_mv
            if d_best_val > 900000:
                break

        return best_mv

    def _negamax(self, board, depth, alpha, beta, cur, opp, root_bot, last, deadline, moves_played):
        if deadline and time.monotonic() >= deadline:
            return 0

        lr, lc, lp = last
        if _wins_placed(board, lr, lc, lp, self.patterns):
            val = 1000000 + depth
            return val if lp == cur else -val

        if moves_played >= GRID * GRID:
            return self._eval_full(board, cur, opp, root_bot)

        if depth == 0:
            return self._eval_heuristic(board, cur, opp, root_bot, moves_played)

        key = (_board_key(board), cur)
        if key in self.tt:
            d, v, f = self.tt[key]
            if d >= depth:
                if f == 0:
                    return v
                elif f == 1:
                    alpha = max(alpha, v)
                elif f == 2:
                    beta = min(beta, v)
                if alpha >= beta:
                    return v

        empties = _empties(board)
        moves = sorted(empties, key=lambda x: self.history[x[0]][x[1]], reverse=True)

        best_v = -INF
        for r, c in moves:
            b = _place(board, r, c, cur)
            v = -self._negamax(b, depth - 1, -beta, -alpha, opp, cur, root_bot, (r, c, cur), deadline, moves_played + 1)
            if v > best_v:
                best_v = v
            alpha = max(alpha, v)
            if alpha >= beta:
                self.history[r][c] += 2 ** depth
                break

        flag = 0 if best_v <= alpha and best_v >= beta else (1 if best_v > alpha else 2)
        self.tt[key] = (depth, best_v, flag)
        return best_v

    def _eval_full(self, board, cur, opp, root_bot):
        """Evaluate a completely filled board via 20-point connection."""
        root_opp = opp if root_bot == cur else cur
        rb_conn = _largest_connected(board, root_bot)
        ro_conn = _largest_connected(board, root_opp)
        rb_has20 = rb_conn >= 20
        ro_has20 = ro_conn >= 20
        if rb_has20 and not ro_has20:
            v = 800000
        elif ro_has20 and not rb_has20:
            v = -800000
        else:
            v = (rb_conn - ro_conn) * 500
        return v if cur == root_bot else -v

    def _eval_heuristic(self, board, cur, opp, root_bot, moves_played):
        root_opp = opp if root_bot == cur else cur
        score = 0
        score += self._line_score(board, root_bot, root_opp)
        score += self._pattern_score(board, root_bot, root_opp)
        score += self._connectivity_score(board, root_bot, root_opp, moves_played)
        score += self._center_score(board, root_bot, root_opp)
        return score if cur == root_bot else -score

    def _line_score(self, board, me, opp):
        score = 0
        for dr, dc in DIRS4:
            for r in range(GRID):
                for c in range(GRID):
                    if r + 6 * dr >= GRID or r + 6 * dr < 0:
                        continue
                    if c + 6 * dc >= GRID or c + 6 * dc < 0:
                        continue
                    mine, theirs = 0, 0
                    for i in range(7):
                        v = board[r + i * dr][c + i * dc]
                        if v == me:
                            mine += 1
                        elif v == opp:
                            theirs += 1
                    if mine > 0 and theirs == 0:
                        score += mine ** 4 * 25
                    elif theirs > 0 and mine == 0:
                        score -= theirs ** 4 * 35
        return score

    def _pattern_score(self, board, me, opp):
        score = 0
        seen = set()
        for r in range(GRID):
            for c in range(GRID):
                if board[r][c] is None:
                    continue
                for pid, cells in self.cell_index[r][c]:
                    tag = (pid, cells[0])
                    if tag in seen:
                        continue
                    seen.add(tag)
                    mine, theirs = 0, 0
                    for cr, cc in cells:
                        v = board[cr][cc]
                        if v == me:
                            mine += 1
                        elif v == opp:
                            theirs += 1
                    if mine > 0 and theirs == 0:
                        score += mine ** 4 * 45
                    elif theirs > 0 and mine == 0:
                        score -= theirs ** 4 * 65
        return score

    def _connectivity_score(self, board, me, opp, moves_played):
        weight = 3.0 + (moves_played / 49.0) * 12.0
        my_conn = _largest_connected(board, me)
        op_conn = _largest_connected(board, opp)
        return int((my_conn - op_conn) * weight)

    def _center_score(self, board, me, opp):
        score = 0
        for r in range(GRID):
            for c in range(GRID):
                dist = abs(r - CENTER) + abs(c - CENTER)
                bonus = max(0, 4 - dist) * 3
                if board[r][c] == me:
                    score += bonus
                elif board[r][c] == opp:
                    score -= bonus
        return score


def _place(board, r, c, p):
    nb = [list(row) for row in board]
    nb[r][c] = p
    return nb


def _empties(board):
    return [(r, c) for r, c in ALL_RC if board[r][c] is None]


def _board_key(board):
    return tuple(tuple(row) for row in board)


def _wins(board, r, c, player, patterns):
    """Check if placing at (r,c) would win."""
    b = _place(board, r, c, player)
    return _wins_placed(b, r, c, player, patterns)


def _wins_placed(board, r, c, player, patterns):
    """Check win for a board where (r,c) is already placed."""
    if _check_7_line(board, r, c, player):
        return True
    if _check_patterns(board, player, patterns):
        return True
    return False


def _check_7_line(board, r, c, player):
    for dr, dc in ALL_DIRS:
        count = 1
        for sign in (1, -1):
            rr, cc = r + sign * dr, c + sign * dc
            while 0 <= rr < GRID and 0 <= cc < GRID and board[rr][cc] == player:
                count += 1
                rr += sign * dr
                cc += sign * dc
        if count >= 7:
            return True
    return False


def _check_patterns(board, player, patterns):
    for pat in patterns:
        max_r = max(dr for dr, _ in pat)
        max_c = max(dc for _, dc in pat)
        for br in range(GRID - max_r):
            for bc in range(GRID - max_c):
                ok = True
                for dr, dc in pat:
                    if board[br + dr][bc + dc] != player:
                        ok = False
                        break
                if ok:
                    return True
    return False


def _largest_connected(board, player):
    visited = set()
    best = 0
    for r in range(GRID):
        for c in range(GRID):
            if board[r][c] == player and (r, c) not in visited:
                size = 0
                q = deque([(r, c)])
                visited.add((r, c))
                while q:
                    cr, cc = q.popleft()
                    size += 1
                    for dr, dc in ALL_DIRS:
                        nr, nc = cr + dr, cc + dc
                        if 0 <= nr < GRID and 0 <= nc < GRID and (nr, nc) not in visited and board[nr][nc] == player:
                            visited.add((nr, nc))
                            q.append((nr, nc))
                if size > best:
                    best = size
    return best


class Bot7MoveRequest(BaseModel):
    board: List[List[Optional[str]]]
    difficulty: str
    current_player: str
    selected_patterns: Optional[List[str]] = None
    c3_blocked: bool = False
    moves_played: Optional[int] = None


_cached_engine: Optional[Bot7Engine] = None
_cached_pats = None


@router.post("/move")
def bot7_move(req: Bot7MoveRequest):
    global _cached_engine, _cached_pats

    def normalize(cell):
        return None if cell in [None, "null", ""] else cell

    board = [[normalize(cell) for cell in row] for row in req.board]
    pats = generate_all_patterns_7(req.selected_patterns)
    moves_played = req.moves_played
    if moves_played is None:
        moves_played = sum(1 for row in board for cell in row if cell is not None)

    pat_key = tuple(tuple(p) for p in pats)
    if _cached_engine is None or _cached_pats != pat_key:
        _cached_engine = Bot7Engine(pats)
        _cached_pats = pat_key

    bot = req.current_player
    human = "P2" if bot == "P1" else "P1"
    move = _cached_engine.choose(
        copy.deepcopy(board), bot, human,
        req.difficulty, moves_played, req.c3_blocked,
    )
    if move:
        return {"row": move[0], "col": move[1]}
    return {"row": None, "col": None}
