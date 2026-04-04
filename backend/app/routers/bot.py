import copy
import random
import time
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.patterns import generate_all_patterns
from app.core.patterns6 import generate_all_patterns_6
from app.core.patterns7 import generate_all_patterns_7
from app.core.win_checker import check_5_line, check_structural_patterns
from app.core.win_checker7 import check_7_line, resolve_full_board_7
from app.core.win_checker6 import check_6_line, resolve_full_board_6

try:
    from penta_engine import (
        RustHardBot7,
        RustDangerBot7,
        RustNormalBot6,
        RustHardBot6,
        RustMachineGodBot6,
    )
    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False

router = APIRouter()

GRID5 = 5
GRID6 = 6
GRID7 = 7
DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]
ALL_DIRS = [(0, 1), (1, 0), (1, 1), (1, -1), (0, -1), (-1, 0), (-1, -1), (-1, 1)]
INF = 10**9

LINE_SCORE = [0, 10, 100, 1000, 5000, 100000]
PAT_SCORE = [0, 30, 300, 3000, 15000, 500000]
OPPO_MULT = 1.3

ALL_RC5 = [(r, c) for r in range(GRID5) for c in range(GRID5)]
ALL_RC6 = [(r, c) for r in range(GRID6) for c in range(GRID6)]
ALL_RC7 = [(r, c) for r in range(GRID7) for c in range(GRID7)]

def _rc5(idx): return (idx // GRID5, idx % GRID5)
def _idx5(r, c): return r * GRID5 + c

def _rc6(idx): return (idx // GRID6, idx % GRID6)
def _idx6(r, c): return r * GRID6 + c

def _rc7(idx): return (idx // GRID7, idx % GRID7)
def _idx7(r, c): return r * GRID7 + c

# =============================================================
#  7x7 BOT ENGINE
# =============================================================

class BotEngine7:
    def __init__(self, patterns):
        self.patterns = patterns
        self.cell_uses = [[[] for _ in range(GRID7)] for _ in range(GRID7)]
        self._build_pattern_index()
        self.tt = {}
        self.history = [[0] * GRID7 for _ in range(GRID7)]

    def _build_pattern_index(self):
        for pid, pattern in enumerate(self.patterns):
            max_r = max(dr for dr, _ in pattern); max_c = max(dc for _, dc in pattern)
            for br in range(GRID7 - max_r):
                for bc in range(GRID7 - max_c):
                    cells = tuple((br+dr, bc+dc) for dr, dc in pattern)
                    for r, c in cells: self.cell_uses[r][c].append((pid, cells))

    def choose(self, board, bot, human, difficulty):
        empties = _empty7(board)
        if not empties: return None
        if difficulty == "easy":
            import random
            return random.choice(empties)

        # 1-ply immediate win/block
        for r, c in empties:
            b = _place(board, r, c, bot)
            if _wins7(b, r, c, bot, self.patterns): return (r, c)
        for r, c in empties:
            b = _place(board, r, c, human)
            if _wins7(b, r, c, human, self.patterns): return (r, c)

        return self._idab(board, bot, human, difficulty)

    def _idab(self, board, bot, human, difficulty):
        empties = _empty7(board)
        # Move ordering: center-first
        ordered = sorted(empties, key=lambda x: abs(x[0]-3) + abs(x[1]-3))
        
        max_d = {"hard": 6}.get(difficulty, 6)
        budget = {"hard": 1.0}.get(difficulty, 1.0)
        deadline = time.monotonic() + budget
        
        best_mv = ordered[0]
        self.tt = {}
        self.history = [[0] * GRID7 for _ in range(GRID7)]

        for depth in range(1, max_d + 1):
            if time.monotonic() >= deadline and depth > 1: break
            
            depth_ordered = [best_mv] + [m for m in ordered if m != best_mv]
            depth_best_mv = best_mv
            depth_best_val = -INF
            alpha = -INF
            
            for r, c in depth_ordered:
                if time.monotonic() >= deadline and depth > 1: break
                b = _place(board, r, c, bot)
                val = -self._negamax(b, depth - 1, -INF, -alpha, human, bot, bot, (r, c, bot), deadline)
                
                if val > depth_best_val:
                    depth_best_val = val
                    depth_best_mv = (r, c)
                alpha = max(alpha, val)
            
            if time.monotonic() < deadline or depth == 1:
                best_mv = depth_best_mv
            if depth_best_val > 900000: break
            
        return best_mv

    def _negamax(self, board, depth, alpha, beta, cur, opp, root_bot, last, deadline=None):
        if deadline and time.monotonic() >= deadline: return 0
        lr, lc, lp = last
        if _wins7(board, lr, lc, lp, self.patterns):
            val = 1000000 + depth
            return val if lp == cur else -val
        
        if depth == 0:
            h = _eval(board, root_bot, self.patterns, self.cell_uses)
            h -= _eval(board, opp if root_bot == cur else cur, self.patterns, self.cell_uses)
            return h if cur == root_bot else -h

        key = (tuple(tuple(r) for r in board), cur)
        if key in self.tt:
            d, v, f = self.tt[key]
            if d >= depth:
                if f == 0: return v
                elif f == 1: alpha = max(alpha, v)
                elif f == 2: beta = min(beta, v)
                if alpha >= beta: return v

        empties = _empty7(board)
        # Simple ordering for internal nodes
        moves = sorted(empties, key=lambda x: self.history[x[0]][x[1]], reverse=True)
        
        best_v = -INF
        for r, c in moves:
            b = _place(board, r, c, cur)
            v = -self._negamax(b, depth - 1, -beta, -alpha, opp, cur, root_bot, (r, c, cur), deadline)
            b[r][c] = None # Unmake move
            if v > best_v:
                best_v = v
            alpha = max(alpha, v)
            if alpha >= beta:
                self.history[r][c] += 2**depth
                break
        
        flag = 0 if best_v <= alpha and best_v >= beta else (1 if best_v > alpha else 2)
        self.tt[key] = (depth, best_v, flag)
        return best_v

# =============================================================
#  5x5 BOT ENGINE (Original)
# =============================================================

class BotEngine:
    def __init__(self, patterns):
        self.patterns = patterns
        self.tt = {}
        self.history = [0] * (GRID5 * GRID5)
        self.zobrist = [[random.getrandbits(64) for _ in range(3)] for _ in range(GRID5 * GRID5)]

    def choose(self, board_2d, bot, human, difficulty):
        board = [None] * (GRID5 * GRID5)
        zhash = 0
        p_map = {bot: 1, human: 2, None: 0}
        for r in range(GRID5):
            for c in range(GRID5):
                val = board_2d[r][c]
                idx = r * GRID5 + c
                board[idx] = val
                pv = p_map.get(val, 0)
                if pv > 0: zhash ^= self.zobrist[idx][pv]

        empties = [i for i, v in enumerate(board) if v is None]
        if not empties: return None
        if difficulty == "easy":
            return _rc5(random.choice(empties))

        # Win/Block check
        for i in empties:
            if _wins5_idx(board, i, bot, self.patterns): return _rc5(i)
        for i in empties:
            if _wins5_idx(board, i, human, self.patterns): return _rc5(i)

        if difficulty == "medium":
            depth, budget = 4, 1.0
        else: # hard
            depth, budget = 8, 1.0

        move_idx = self._idab(board, zhash, bot, human, depth, budget, empties)
        return _rc5(move_idx)

    def _idab(self, board, zhash, bot, human, max_d, budget, empties):
        deadline = time.monotonic() + budget
        best_mv = empties[0]
        self.tt = {}
        self.history = [0] * (GRID5 * GRID5)
        p_map = {bot: 1, human: 2}

        for d in range(1, max_d + 1):
            if time.monotonic() >= deadline and d > 1: break
            ordered = sorted(empties, key=lambda i: (i == best_mv, self.history[i], -(abs(i // GRID5 - 2) + abs(i % GRID5 - 2))), reverse=True)
            d_best_mv = best_mv
            d_best_val = -INF
            alpha = -INF
            for i in ordered:
                if time.monotonic() >= deadline and d > 1: break
                board[i] = bot
                val = -self._negamax(board, zhash ^ self.zobrist[i][p_map[bot]], d - 1, -INF, -alpha, human, bot, bot, i, p_map[human], p_map[bot], deadline)
                board[i] = None
                if val > d_best_val:
                    d_best_val = val
                    d_best_mv = i
                alpha = max(alpha, val)
            if time.monotonic() < deadline or d == 1:
                best_mv = d_best_mv
            if d_best_val > 900000: break
        return best_mv

    def _negamax(self, board, zhash, depth, alpha, beta, cur, opp, root_bot, last_idx, p_cur, p_opp, deadline):
        if deadline and time.monotonic() >= deadline: return 0
        if _wins5_placed_idx(board, last_idx, opp, self.patterns):
            return -(1000000 + depth)
        if depth == 0:
            return _eval_flat(board, root_bot, self.patterns, GRID5) if cur == root_bot else -_eval_flat(board, root_bot, self.patterns, GRID5)

        if zhash in self.tt:
            d, v, f = self.tt[zhash]
            if d >= depth:
                if f == 0: return v
                elif f == 1: alpha = max(alpha, v)
                elif f == 2: beta = min(beta, v)
                if alpha >= beta: return v

        empties = [i for i, v in enumerate(board) if v is None]
        if not empties: return 0
        moves = sorted(empties, key=lambda i: self.history[i], reverse=True)
        best_v = -INF; orig_alpha = alpha
        for i in moves:
            board[i] = cur
            v = -self._negamax(board, zhash ^ self.zobrist[i][p_cur], depth - 1, -beta, -alpha, opp, cur, root_bot, i, p_opp, p_cur, deadline)
            board[i] = None
            if v > best_v: best_v = v
            alpha = max(alpha, v)
            if alpha >= beta:
                self.history[i] += 2**depth
                break
        flag = 0 if best_v > orig_alpha and best_v < beta else (1 if best_v >= beta else 2)
        self.tt[zhash] = (depth, best_v, flag)
        return best_v

# =============================================================
#  6x6 BOT ENGINE (Python Fallback)
# =============================================================

class BotEngine6:
    def __init__(self, patterns):
        self.patterns = patterns
        self.tt = {}
        self.history = [0] * (GRID6 * GRID6)
        self.zobrist = [[random.getrandbits(64) for _ in range(3)] for _ in range(GRID6 * GRID6)]
        
        # Pattern indexing for fast eval (similar to 7x7)
        self.cell_pats = [[] for _ in range(GRID6 * GRID6)]
        self._build_pattern_index()

    def _build_pattern_index(self):
        for pid, pattern in enumerate(self.patterns):
            max_r = max(dr for dr, _ in pattern); max_c = max(dc for _, dc in pattern)
            for br in range(GRID6 - max_r):
                for bc in range(GRID6 - max_c):
                    cells = tuple( (br+dr)*GRID6 + (bc+dc) for dr, dc in pattern )
                    for idx in cells:
                        self.cell_pats[idx].append((pid, cells))

    def choose(self, board_2d, bot, human, difficulty):
        board = [None] * (GRID6 * GRID6)
        zhash = 0
        p_map = {bot: 1, human: 2, None: 0}
        for r in range(GRID6):
            for c in range(GRID6):
                val = board_2d[r][c]
                idx = r * GRID6 + c
                board[idx] = val
                pv = p_map.get(val, 0)
                if pv > 0: zhash ^= self.zobrist[idx][pv]

        empties = [i for i, v in enumerate(board) if v is None]
        if not empties: return None
        if difficulty == "easy":
            return _rc6(random.choice(empties))

        # 1-ply immediate win/block
        for i in empties:
            if self._wins6_idx(board, i, bot): return _rc6(i)
        for i in empties:
            if self._wins6_idx(board, i, human): return _rc6(i)

        if difficulty == "easy":
            return _rc6(random.choice(empties))

        # Iterative Deepening Alpha-Beta Search
        budget = None # Will be set based on difficulty
        if difficulty == "normal":
            depth, budget = 4, 1.0
        elif difficulty == "medium":
            depth, budget = 5, 1.0
        elif difficulty == "hard":
            depth, budget = 6, 1.0
        else: # machine_god or default
            depth, budget = 8, 1.0
        
        move_idx = self._idab(board, zhash, bot, human, depth, budget, empties)
        return _rc6(move_idx)

    def _largest_connected6(self, board, player):
        visited = [False] * (GRID6 * GRID6)
        best = 0
        for i in range(GRID6 * GRID6):
            if board[i] != player or visited[i]: continue
            size = 0
            q = [i]
            visited[i] = True
            while q:
                ci = q.pop(0)
                size += 1
                r, c = ci // GRID6, ci % GRID6
                for dr, dc in [(0,1),(1,0),(0,-1),(-1,0),(1,1),(1,-1),(-1,1),(-1,-1)]:
                    nr, nc = r+dr, c+dc
                    ni = nr * GRID6 + nc
                    if 0<=nr<GRID6 and 0<=nc<GRID6 and board[ni] == player and not visited[ni]:
                        visited[ni] = True
                        q.append(ni)
            if size > best: best = size
        return best

    def _eval_6x6(self, board, root_bot, moves_played):
        score = 0
        opp = "P2" if root_bot == "P1" else "P1"
        
        # 1. Line Progress (Synced with Rust weights)
        for dr, dc in [(0,1),(1,0),(1,1),(1,-1)]:
            for r in range(GRID6):
                for c in range(GRID6):
                    if r+5*dr>=GRID6 or c+5*dc>=GRID6 or c+5*dc<0: continue
                    m, o = 0, 0
                    for k in range(6):
                        v = board[(r+k*dr)*GRID6 + (c+k*dc)]
                        if v == root_bot: m += 1
                        elif v == opp: o += 1
                    if m>0 and o==0: score += (m**4) * 24
                    elif o>0 and m==0: score -= (o**4) * 34
        
        # 2. Pattern Progress (ZZ, L, T, etc.)
        seen_p = set()
        for i in range(GRID6 * GRID6):
            if board[i] is None: continue
            for pid, cells in self.cell_pats[i]:
                if (pid, cells[0]) in seen_p: continue
                seen_p.add((pid, cells[0]))
                m, o = 0, 0
                for ci in cells:
                    v = board[ci]
                    if v == root_bot: m += 1
                    elif v == opp: o += 1
                if m>0 and o==0: score += (m**4) * 44
                elif o>0 and m==0: score -= (o**4) * 62

        # 3. Connectivity (The 15-cell rule - crucial parity)
        m_conn = self._largest_connected6(board, root_bot)
        o_conn = self._largest_connected6(board, opp)
        if m_conn >= 15 and o_conn < 15: score += 500000
        elif o_conn >= 15 and m_conn < 15: score -= 700000
        else:
            weight = 4.0 + (moves_played / 36.0) * 14.0
            score += int((m_conn - o_conn) * weight * 10) # Scaled for integer math roughly

        # 4. Center Bias
        center_pts = [
            0,0,0,0,0,0,
            0,1,1,1,1,0,
            0,1,2,2,1,0,
            0,1,2,2,1,0,
            0,1,1,1,1,0,
            0,0,0,0,0,0
        ]
        for i in range(GRID6 * GRID6):
            if board[i] == root_bot: score += center_pts[i] * 5
            elif board[i] == opp: score -= center_pts[i] * 5

        return score

    def _idab(self, board, zhash, bot, human, max_d, budget, empties):
        deadline = time.monotonic() + budget
        best_mv = empties[0]
        self.tt = {}
        self.history = [0] * (GRID6 * GRID6)
        p_map = {bot: 1, human: 2}

        # Center preference for 6x6
        ordered_empties = sorted(empties, key=lambda i: abs(i // GRID6 - 2.5) + abs(i % GRID6 - 2.5))

        for d in range(1, max_d + 1):
            if time.monotonic() >= deadline and d > 1: break
            # Sort by history and result of previous depth
            ordered = sorted(ordered_empties, key=lambda i: (i == best_mv, self.history[i]), reverse=True)
            d_best_mv = best_mv
            d_best_val = -INF
            alpha = -INF
            for i in ordered:
                if time.monotonic() >= deadline and d > 1: break
                board[i] = bot
                val = -self._negamax(board, zhash ^ self.zobrist[i][p_map[bot]], d - 1, -INF, -alpha, human, bot, bot, i, p_map[human], p_map[bot], deadline)
                board[i] = None
                if val > d_best_val:
                    d_best_val = val
                    d_best_mv = i
                alpha = max(alpha, val)
            if time.monotonic() < deadline or d == 1:
                best_mv = d_best_mv
            if d_best_val > 900000: break
        return best_mv

    def _negamax(self, board, zhash, depth, alpha, beta, cur, opp, root_bot, last_idx, p_cur, p_opp, deadline):
        if deadline and time.monotonic() >= deadline: return 0
        if self._wins6_placed_idx(board, last_idx, opp):
            return -(1000000 + depth)
        
        if depth == 0:
            return self._eval_6x6(board, root_bot, sum(1 for v in board if v is not None)) if cur == root_bot else -self._eval_6x6(board, root_bot, sum(1 for v in board if v is not None))

        if zhash in self.tt:
            d, v, f = self.tt[zhash]
            if d >= depth:
                if f == 0: return v
                elif f == 1: alpha = max(alpha, v)
                elif f == 2: beta = min(beta, v)
                if alpha >= beta: return v

        empties = [i for i, v in enumerate(board) if v is None]
        if not empties: return 0
        moves = sorted(empties, key=lambda i: self.history[i], reverse=True)
        best_v = -INF; orig_alpha = alpha
        for i in moves:
            board[i] = cur
            v = -self._negamax(board, zhash ^ self.zobrist[i][p_cur], depth - 1, -beta, -alpha, opp, cur, root_bot, i, p_opp, p_cur, deadline)
            board[i] = None
            if v > best_v: best_v = v
            alpha = max(alpha, v)
            if alpha >= beta:
                self.history[i] += 2**depth
                break
        flag = 0 if best_v > orig_alpha and best_v < beta else (1 if best_v >= beta else 2)
        self.tt[zhash] = (depth, best_v, flag)
        return best_v

    def _wins6_idx(self, board, i, player):
        board[i] = player
        w = self._wins6_placed_idx(board, i, player)
        board[i] = None
        return w

    def _wins6_placed_idx(self, board, i, player):
        r, c = _rc6(i)
        if self._check_6_line_flat(board, r, c, player): return True
        if check_structural_patterns_flat(board, player, self.patterns, GRID6): return True
        return False

    def _check_6_line_flat(self, board, r, c, player):
        for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
            count = 1
            for sign in (1, -1):
                rr, cc = r + sign * dr, c + sign * dc
                while 0 <= rr < GRID6 and 0 <= cc < GRID6 and board[rr * GRID6 + cc] == player:
                    count += 1
                    rr += sign * dr
                    cc += sign * dc
            if count >= 6: return True
        return False

# =============================================================
#  HELPERS
# =============================================================

def _place(board, r, c, p):
    nb = [list(row) for row in board]
    nb[r][c] = p
    return nb

def _empty5(board): return [(r, c) for r, c in ALL_RC5 if board[r][c] is None]
def _empty6(board): return [(r, c) for r, c in ALL_RC6 if board[r][c] is None]
def _empty7(board): return [(r, c) for r, c in ALL_RC7 if board[r][c] is None]

def _wins7(board, r, c, player, patterns):
    if check_7_line(board, r, c, player, ALL_DIRS, 7)[0]: return True
    if check_structural_patterns(board, player, patterns, 7)[0]: return True
    return False

def _wins5_idx(board, i, player, patterns):
    board[i] = player
    w = _wins5_placed_idx(board, i, player, patterns)
    board[i] = None
    return w

def _wins5_placed_idx(board, i, player, patterns):
    r, c = _rc5(i)
    if check_5_line_flat(board, r, c, player): return True
    if check_structural_patterns_flat(board, player, patterns, GRID5): return True
    return False

def check_5_line_flat(board, r, c, player):
    for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
        count = 1
        for sign in (1, -1):
            rr, cc = r + sign * dr, c + sign * dc
            while 0 <= rr < GRID5 and 0 <= cc < GRID5 and board[rr * GRID5 + cc] == player:
                count += 1
                rr += sign * dr
                cc += sign * dc
        if count >= 5: return True
    return False

def check_structural_patterns_flat(board, player, patterns, grid_size):
    for pat in patterns:
        max_r = max(dr for dr, _ in pat); max_c = max(dc for _, dc in pat)
        for br in range(grid_size - max_r):
            for bc in range(grid_size - max_c):
                ok = True
                for dr, dc in pat:
                    if board[(br + dr) * grid_size + (bc + dc)] != player:
                        ok = False; break
                if ok: return True
    return False

def _eval(board, player, patterns, cell_uses):
    score = 0
    grid_size = len(board)
    opponent = "P2" if player == "P1" else "P1"
    
    # 1. Line Progress
    target = grid_size
    for dr, dc in DIRS:
        for r in range(grid_size):
            for c in range(grid_size):
                if r + (target-1)*dr >= grid_size or c + (target-1)*dc >= grid_size or c + (target-1)*dc < 0: continue
                m, o = 0, 0
                for i in range(target):
                    v = board[r + i*dr][c + i*dc]
                    if v == player: m += 1
                    elif v == opponent: o += 1
                if m > 0 and o == 0:
                    score += (m ** 4) * (30 if grid_size >= 6 else 10)
                elif o > 0 and m == 0:
                    score -= (o ** 4) * (45 if grid_size >= 6 else 15)

    # 2. Pattern Progress
    if cell_uses:
        seen = set()
        for r in range(grid_size):
            for c in range(grid_size):
                if board[r][c] is None: continue
                for pid, cells in cell_uses[r][c]:
                    if (pid, cells[0]) in seen: continue
                    seen.add((pid, cells[0]))
                    m, o = 0, 0
                    for cr, cc in cells:
                        v = board[cr][cc]
                        if v == player: m += 1
                        elif v == opponent: o += 1
                    if m > 0 and o == 0: score += (m**4) * 50
                    elif o > 0 and m == 0: score -= (o**4) * 75

    # 3. Center Bias
    center = grid_size // 2
    for r in range(grid_size):
        for c in range(grid_size):
            if board[r][c] == player: 
                score += max(0, center + 1 - (abs(r-center) + abs(c-center))) * (1.0 if grid_size == 5 else 4.0)
            elif board[r][c] == opponent: 
                score -= max(0, center + 1 - (abs(r-center) + abs(c-center))) * (1.0 if grid_size == 5 else 4.0)
    
    return score

def _eval_flat(board, player, patterns, grid_size):
    score = 0
    opponent = "P2" if player == "P1" else "P1"
    target = grid_size
    # Lines
    for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
        for r in range(grid_size):
            for c in range(grid_size):
                if r + (target-1)*dr >= grid_size or c + (target-1)*dc >= grid_size or c + (target-1)*dc < 0: continue
                m, o = 0, 0
                for i in range(target):
                    v = board[(r + i*dr) * grid_size + (c + i*dc)]
                    if v == player: m += 1
                    elif v == opponent: o += 1
                if m > 0 and o == 0: score += (m ** 4) * (15 if grid_size == 6 else 10)
                elif o > 0 and m == 0: score -= (o ** 4) * (22 if grid_size == 6 else 15)
    # Center
    center = grid_size // 2
    for i in range(grid_size * grid_size):
        if board[i] == player:
            r, c = i // grid_size, i % grid_size
            score += max(0, center + 1 - (abs(r-center) + abs(c-center)))
        elif board[i] == opponent:
            r, c = i // grid_size, i % grid_size
            score -= max(0, center + 1 - (abs(r-center) + abs(c-center)))
    return score


# =============================================================
#  ROUTERS
# =============================================================

class BotMoveRequest(BaseModel):
    board: List[List[Optional[str]]]
    difficulty: str
    current_player: str
    board_mode: str = "5x5"
    selected_patterns: Optional[List[str]] = None
    c3_blocked: bool = False
    moves_played: Optional[int] = None

_ENGINE5 = None
_LAST_PATS5 = None

def get_bot_move(engine, difficulty):
    global _ENGINE5, _LAST_PATS5
    pats = engine.shiftable_patterns
    if _ENGINE5 is None or pats != _LAST_PATS5:
        _ENGINE5 = BotEngine(pats)
        _LAST_PATS5 = pats
    bot = engine.current_player; human = "P2" if bot == "P1" else "P1"
    return _ENGINE5.choose(copy.deepcopy(engine.board), bot, human, difficulty)

from app.routers.bot7 import Bot7Engine as _Bot7Engine

_ENGINE7_NEW = None
_LAST_PATS7_NEW = None
_DANGER_ENG = None
_DANGER_PATS = None
_RUST_HARD_ENG = None
_RUST_HARD_PATS = None
_RUST_DANGER_ENG = None
_RUST_DANGER_PATS = None
_RUST_NORMAL6_ENG = None
_RUST_HARD6_ENG = None
_RUST_GOD6_ENG = None
_RUST_6_PATS = None
_PYTHON_6_ENG = None
_PYTHON_6_PATS = None

@router.post("/move")
def bot_move(req: BotMoveRequest):
    global _ENGINE7_NEW, _LAST_PATS7_NEW, _DANGER_ENG, _DANGER_PATS
    global _RUST_HARD_ENG, _RUST_HARD_PATS, _RUST_DANGER_ENG, _RUST_DANGER_PATS
    global _RUST_NORMAL6_ENG, _RUST_HARD6_ENG, _RUST_GOD6_ENG, _RUST_6_PATS
    global _PYTHON_6_ENG, _PYTHON_6_PATS
    def normalize(cell): return None if cell in [None, "null", ""] else cell
    board = [[normalize(cell) for cell in row] for row in req.board]
    if len(board) >= 7 and len(board[0]) >= 7:
        actual_mode = "7x7"
    elif len(board) >= 6 and len(board[0]) >= 6:
        actual_mode = "6x6"
    else:
        actual_mode = "5x5"
    moves_played = req.moves_played if req.moves_played is not None else sum(1 for row in board for cell in row if cell is not None)

    if actual_mode == "7x7":
        pats = generate_all_patterns_7(req.selected_patterns)
        pat_key = tuple(tuple(p) for p in pats)
        bot = req.current_player
        human = "P2" if bot == "P1" else "P1"
        if req.difficulty == "danger":
            if _HAS_RUST:
                if _RUST_DANGER_ENG is None or _RUST_DANGER_PATS != pat_key:
                    _RUST_DANGER_ENG = RustDangerBot7(pats)
                    _RUST_DANGER_PATS = pat_key
                move = _RUST_DANGER_ENG.choose(
                    copy.deepcopy(board), bot, human, moves_played, req.c3_blocked,
                )
            else:
                from app.routers.danger_bot7 import DangerBot7Engine as _DangerBot7
                if _DANGER_ENG is None or _DANGER_PATS != pat_key:
                    _DANGER_ENG = _DangerBot7(pats)
                    _DANGER_PATS = pat_key
                move = _DANGER_ENG.choose(
                    copy.deepcopy(board), bot, human, moves_played, req.c3_blocked,
                )
        elif req.difficulty == "hard" and _HAS_RUST:
            if _RUST_HARD_ENG is None or _RUST_HARD_PATS != pat_key:
                _RUST_HARD_ENG = RustHardBot7(pats)
                _RUST_HARD_PATS = pat_key
            move = _RUST_HARD_ENG.choose(
                copy.deepcopy(board), bot, human, "hard", moves_played, req.c3_blocked,
            )
        else:
            if _ENGINE7_NEW is None or _LAST_PATS7_NEW != pat_key:
                _ENGINE7_NEW = _Bot7Engine(pats)
                _LAST_PATS7_NEW = pat_key
            diff7 = "easy" if req.difficulty == "medium" else req.difficulty
            move = _ENGINE7_NEW.choose(copy.deepcopy(board), bot, human, diff7, moves_played, req.c3_blocked)
    elif actual_mode == "6x6":
        pats6 = generate_all_patterns_6()
        pat_key6 = tuple(tuple(p) for p in pats6)
        bot = req.current_player
        human = "P2" if bot == "P1" else "P1"
        diff6 = (req.difficulty or "normal").lower()
        valid6 = {"easy", "normal", "medium", "hard", "machine_god", "danger"}

        if diff6 not in valid6:
            raise HTTPException(
                status_code=422,
                detail="Invalid 6x6 difficulty. Use one of: normal, hard, machine_god.",
            )

        if _HAS_RUST:
            if _RUST_6_PATS != pat_key6:
                _RUST_NORMAL6_ENG = RustNormalBot6(pats6)
                _RUST_HARD6_ENG = RustHardBot6(pats6)
                _RUST_GOD6_ENG = RustMachineGodBot6(pats6)
                _RUST_6_PATS = pat_key6

            if diff6 == "machine_god":
                move = _RUST_GOD6_ENG.choose(copy.deepcopy(board), bot, human, moves_played)
            elif diff6 == "hard":
                move = _RUST_HARD6_ENG.choose(copy.deepcopy(board), bot, human, moves_played)
            else:
                move = _RUST_NORMAL6_ENG.choose(copy.deepcopy(board), bot, human, moves_played)
        else:
            if _PYTHON_6_ENG is None or _PYTHON_6_PATS != pat_key6:
                _PYTHON_6_ENG = BotEngine6(pats6)
                _PYTHON_6_PATS = pat_key6
            move = _PYTHON_6_ENG.choose(copy.deepcopy(board), bot, human, diff6)
    else:
        engine_stub = type("EngineStub", (), {
            "board": board,
            "current_player": req.current_player,
            "moves_played": moves_played,
            "shiftable_patterns": generate_all_patterns()
        })()
        move = get_bot_move(engine_stub, req.difficulty)
    return {"row": move[0], "col": move[1]} if move else {"row": None, "col": None}