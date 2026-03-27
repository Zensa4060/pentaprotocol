import copy
import time
import random
from typing import List, Optional
from collections import deque
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.patterns7 import generate_all_patterns_7

try:
    from penta_engine import RustHardBot7, RustDangerBot7
    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False

router = APIRouter()

GRID = 7
ALL_RC = [(r, c) for r in range(GRID) for c in range(GRID)]
CENTER = 3
CENTER_IDX = CENTER * GRID + CENTER # 24
DIRS4 = [(0, 1), (1, 0), (1, 1), (1, -1)]
ALL_DIRS = [(0, 1), (1, 0), (1, 1), (1, -1), (0, -1), (-1, 0), (-1, -1), (-1, 1)]
INF = 10**9

def _rc(idx):
    return (idx // GRID, idx % GRID)

def _idx(r, c):
    return r * GRID + c

class Bot7Engine:
    def __init__(self, patterns):
        self.patterns = patterns
        self.cell_index = [[] for _ in range(GRID * GRID)]
        self._build_index()
        self.tt = {}
        self.history = [0] * (GRID * GRID)
        self.zobrist = None
        self._init_zobrist()

    def _init_zobrist(self):
        random.seed(0xDEADBEEF)
        self.zobrist = [[random.getrandbits(64) for _ in range(3)] for _ in range(GRID * GRID)]

    def _build_index(self):
        for pid, pat in enumerate(self.patterns):
            max_r = max(dr for dr, _ in pat)
            max_c = max(dc for _, dc in pat)
            for br in range(GRID - max_r):
                for bc in range(GRID - max_c):
                    cells = tuple((br + dr) * GRID + (bc + dc) for dr, dc in pat)
                    for idx in cells:
                        self.cell_index[idx].append((pid, cells))

    def choose(self, board_2d, bot, human, difficulty, moves_played, c3_blocked):
        # Convert 2D board to 1D flat for performance
        board = [None] * (GRID * GRID)
        zhash = 0
        p_map = {bot: 1, human: 2, None: 0}
        for r in range(GRID):
            for c in range(GRID):
                val = board_2d[r][c]
                idx = r * GRID + c
                board[idx] = val
                pv = p_map.get(val, 0)
                if pv > 0:
                    zhash ^= self.zobrist[idx][pv]

        empties = [i for i, v in enumerate(board) if v is None]
        if not empties:
            return None

        if c3_blocked and moves_played == 0:
            if board[CENTER_IDX] is None:
                empties = [i for i in empties if i != CENTER_IDX]
            if not empties:
                return None

        if difficulty == "easy":
            return self._easy(board, bot, human, empties, moves_played)

        for i in empties:
            if _wins_idx(board, i, bot, self.patterns):
                return _rc(i)
        for i in empties:
            if _wins_idx(board, i, human, self.patterns):
                return _rc(i)

        move_idx = self._idab(board, zhash, bot, human, difficulty, empties, moves_played)
        return _rc(move_idx)

    def _easy(self, board, bot, human, empties, moves_played):
        for i in empties:
            if _wins_idx(board, i, bot, self.patterns):
                return _rc(i)
        for i in empties:
            if _wins_idx(board, i, human, self.patterns):
                return _rc(i)

        if moves_played < 4:
            near = [i for i in empties if abs(i // GRID - CENTER) <= 1 and abs(i % GRID - CENTER) <= 1]
            if near:
                return _rc(random.choice(near))
        return _rc(random.choice(empties))

    def _idab(self, board, zhash, bot, human, difficulty, empties, moves_played):
        max_d = {"medium": 4, "hard": 6}.get(difficulty, 4)
        budget = {"medium": 1.5, "hard": 4.0}.get(difficulty, 1.5)
        deadline = time.monotonic() + budget

        best_mv = empties[0]
        self.tt = {}
        self.history = [0] * (GRID * GRID)
        p_map = {bot: 1, human: 2}

        for depth in range(1, max_d + 1):
            if time.monotonic() >= deadline and depth > 1:
                break

            ordered = sorted(empties, key=lambda i: (i == best_mv, self.history[i], -(abs(i // GRID - CENTER) + abs(i % GRID - CENTER))), reverse=True)
            d_best_mv = best_mv
            d_best_val = -INF
            alpha = -INF

            for i in ordered:
                if time.monotonic() >= deadline and depth > 1:
                    break
                
                # Make
                board[i] = bot
                zh_new = zhash ^ self.zobrist[i][p_map[bot]]
                val = -self._negamax(board, zh_new, depth - 1, -INF, -alpha, human, bot, bot, i, p_map[human], p_map[bot], deadline, moves_played + 1)
                # Unmake
                board[i] = None
                
                if val > d_best_val:
                    d_best_val = val
                    d_best_mv = i
                alpha = max(alpha, val)

            if time.monotonic() < deadline or depth == 1:
                best_mv = d_best_mv
            if d_best_val > 900000:
                break

        return best_mv

    def _negamax(self, board, zhash, depth, alpha, beta, cur, opp, root_bot, last_idx, p_cur, p_opp, deadline, moves_played):
        if deadline and time.monotonic() >= deadline:
            return 0

        if _wins_placed_idx(board, last_idx, opp, self.patterns):
            return -(1000000 + depth)

        if moves_played >= GRID * GRID:
            return self._eval_full(board, cur, opp, root_bot)

        if depth == 0:
            return self._eval_heuristic(board, cur, opp, root_bot, moves_played)

        if zhash in self.tt:
            d, v, f = self.tt[zhash]
            if d >= depth:
                if f == 0: return v
                elif f == 1: alpha = max(alpha, v)
                elif f == 2: beta = min(beta, v)
                if alpha >= beta: return v

        empties = [i for i, v in enumerate(board) if v is None]
        moves = sorted(empties, key=lambda i: self.history[i], reverse=True)

        best_v = -INF
        orig_alpha = alpha
        for i in moves:
            board[i] = cur
            zh_new = zhash ^ self.zobrist[i][p_cur]
            v = -self._negamax(board, zh_new, depth - 1, -beta, -alpha, opp, cur, root_bot, i, p_opp, p_cur, deadline, moves_played + 1)
            board[i] = None
            
            if v > best_v:
                best_v = v
            alpha = max(alpha, v)
            if alpha >= beta:
                self.history[i] += 2 ** depth
                break

        flag = 0 if best_v > orig_alpha and best_v < beta else (1 if best_v >= beta else 2)
        self.tt[zhash] = (depth, best_v, flag)
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
                    if r + 6 * dr >= GRID or r + 6 * dr < 0: continue
                    if c + 6 * dc >= GRID or c + 6 * dc < 0: continue
                    mine, theirs = 0, 0
                    for i in range(7):
                        v = board[(r + i * dr) * GRID + (c + i * dc)]
                        if v == me: mine += 1
                        elif v == opp: theirs += 1
                    if mine > 0 and theirs == 0:
                        score += mine ** 4 * 25
                    elif theirs > 0 and mine == 0:
                        score -= theirs ** 4 * 35
        return score

    def _pattern_score(self, board, me, opp):
        score = 0
        seen = [False] * 1024 # Buffer
        for i in range(GRID * GRID):
            if board[i] is None: continue
            for pid, cells in self.cell_index[i]:
                tag = (pid, cells[0]) # Unique placement identifier
                # We can't easily use a bitset/bool array for (pid, first_cell) without a dense mapping.
                # Let's use a smaller set just for this call.
                # Actually, self.cell_index already contains global placement IDs? No, it's relative.
                # Let's use a local set for patterns to keep it simple but faster than the original.
                pass # (See below for refined pattern score)
        
        # Simplified/Faster Pattern Score
        unique_seen = set()
        for i in range(GRID * GRID):
            if board[i] is None: continue
            for pid, cells in self.cell_index[i]:
                if cells[0] not in unique_seen: # Basic deduplication using first cell idx
                    # Wait, multiple patterns can start at same cell. Use full tag.
                    tag = (pid, cells[0])
                    if tag in unique_seen: continue
                    unique_seen.add(tag)
                    mine, theirs = 0, 0
                    for ci in cells:
                        v = board[ci]
                        if v == me: mine += 1
                        elif v == opp: theirs += 1
                    if mine > 0 and theirs == 0: score += mine ** 4 * 45
                    elif theirs > 0 and mine == 0: score -= theirs ** 4 * 65
        return score

    def _connectivity_score(self, board, me, opp, moves_played):
        weight = 3.0 + (moves_played / 49.0) * 12.0
        my_conn = _largest_connected(board, me)
        op_conn = _largest_connected(board, opp)
        return int((my_conn - op_conn) * weight)

    def _center_score(self, board, me, opp):
        score = 0
        for i in range(GRID * GRID):
            r, c = _rc(i)
            dist = abs(r - CENTER) + abs(c - CENTER)
            bonus = max(0, 4 - dist) * 3
            if board[i] == me: score += bonus
            elif board[i] == opp: score -= bonus
        return score
    


def _place(board, r, c, p):
    nb = [list(row) for row in board]
    nb[r][c] = p
    return nb


def _empties(board):
    return [(r, c) for r, c in ALL_RC if board[r][c] is None]


def _board_key(board):
    return tuple(tuple(row) for row in board)


def _wins_idx(board, i, player, patterns):
    board[i] = player
    w = _wins_placed_idx(board, i, player, patterns)
    board[i] = None
    return w

def _wins_placed_idx(board, i, player, patterns):
    if _check_7_line_idx(board, i, player):
        return True
    if _check_patterns_idx(board, player, patterns):
        return True
    return False

def _check_7_line_idx(board, i, player):
    r, c = _rc(i)
    for dr, dc in ALL_DIRS:
        count = 1
        for sign in (1, -1):
            rr, cc = r + sign * dr, c + sign * dc
            while 0 <= rr < GRID and 0 <= cc < GRID and board[rr * GRID + cc] == player:
                count += 1
                rr += sign * dr
                cc += sign * dc
        if count >= 7:
            return True
    return False

def _check_patterns_idx(board, player, patterns):
    for pat in patterns:
        max_r = max(dr for dr, _ in pat)
        max_c = max(dc for _, dc in pat)
        for br in range(GRID - max_r):
            for bc in range(GRID - max_c):
                ok = True
                for dr, dc in pat:
                    if board[(br + dr) * GRID + (bc + dc)] != player:
                        ok = False
                        break
                if ok:
                    return True
    return False

def _largest_connected(board, player):
    visited = [False] * (GRID * GRID)
    best = 0
    for i in range(GRID * GRID):
        if board[i] == player and not visited[i]:
            size = 0
            q = deque([i])
            visited[i] = True
            while q:
                curr = q.popleft()
                size += 1
                r, c = _rc(curr)
                for dr, dc in ALL_DIRS:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < GRID and 0 <= nc < GRID:
                        ni = nr * GRID + nc
                        if board[ni] == player and not visited[ni]:
                            visited[ni] = True
                            q.append(ni)
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

_cached_danger = None
_cached_danger_pats = None

_cached_rust_hard = None
_cached_rust_hard_pats = None
_cached_rust_danger = None
_cached_rust_danger_pats = None


class _DangerRef:
    """Thin wrapper so we can store the danger engine in a module global."""
    __slots__ = ("engine",)
    def __init__(self, engine):
        self.engine = engine


@router.post("/move")
def bot7_move(req: Bot7MoveRequest):
    global _cached_engine, _cached_pats
    global _cached_danger, _cached_danger_pats
    global _cached_rust_hard, _cached_rust_hard_pats
    global _cached_rust_danger, _cached_rust_danger_pats

    def normalize(cell):
        return None if cell in [None, "null", ""] else cell

    board = [[normalize(cell) for cell in row] for row in req.board]
    pats = generate_all_patterns_7(req.selected_patterns)
    moves_played = req.moves_played
    if moves_played is None:
        moves_played = sum(1 for row in board for cell in row if cell is not None)

    pat_key = tuple(tuple(p) for p in pats)
    bot = req.current_player
    human = "P2" if bot == "P1" else "P1"

    if req.difficulty == "danger":
        if _HAS_RUST:
            if _cached_rust_danger is None or _cached_rust_danger_pats != pat_key:
                _cached_rust_danger = RustDangerBot7(pats)
                _cached_rust_danger_pats = pat_key
            move = _cached_rust_danger.choose(
                copy.deepcopy(board), bot, human,
                moves_played, req.c3_blocked,
            )
        else:
            from app.routers.danger_bot7 import DangerBot7Engine
            if _cached_danger is None or _cached_danger_pats != pat_key:
                _cached_danger = _DangerRef(DangerBot7Engine(pats))
                _cached_danger_pats = pat_key
            move = _cached_danger.engine.choose(
                copy.deepcopy(board), bot, human,
                moves_played, req.c3_blocked,
            )
    elif req.difficulty == "hard" and _HAS_RUST:
        if _cached_rust_hard is None or _cached_rust_hard_pats != pat_key:
            _cached_rust_hard = RustHardBot7(pats)
            _cached_rust_hard_pats = pat_key
        move = _cached_rust_hard.choose(
            copy.deepcopy(board), bot, human,
            "hard", moves_played, req.c3_blocked,
        )
    else:
        if _cached_engine is None or _cached_pats != pat_key:
            _cached_engine = Bot7Engine(pats)
            _cached_pats = pat_key
        move = _cached_engine.choose(
            copy.deepcopy(board), bot, human,
            req.difficulty, moves_played, req.c3_blocked,
        )

    if move:
        return {"row": move[0], "col": move[1]}
    return {"row": None, "col": None}
