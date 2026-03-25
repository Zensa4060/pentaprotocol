import copy
import time
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.patterns import generate_all_patterns
from app.core.patterns7 import generate_all_patterns_7
from app.core.win_checker import check_5_line, check_structural_patterns
from app.core.win_checker7 import check_7_line, resolve_full_board_7

try:
    from penta_engine import RustHardBot7, RustDangerBot7
    _HAS_RUST = True
except ImportError:
    _HAS_RUST = False

router = APIRouter()

GRID5 = 5
GRID7 = 7
DIRS = [(0, 1), (1, 0), (1, 1), (1, -1)]
ALL_DIRS = [(0, 1), (1, 0), (1, 1), (1, -1), (0, -1), (-1, 0), (-1, -1), (-1, 1)]
INF = 10**9

LINE_SCORE = [0, 10, 100, 1000, 5000, 100000]
PAT_SCORE = [0, 30, 300, 3000, 15000, 500000]
OPPO_MULT = 1.3

ALL_RC5 = [(r, c) for r in range(GRID5) for c in range(GRID5)]
ALL_RC7 = [(r, c) for r in range(GRID7) for c in range(GRID7)]

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
        
        max_d = {"medium": 4, "hard": 6}[difficulty]
        budget = {"medium": 1.2, "hard": 3.5}[difficulty]
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

    def choose(self, board, bot, human, difficulty):
        empties = _empty5(board)
        if not empties: return None
        if difficulty == "easy":
            import random
            return random.choice(empties)

        # Immediate win/block
        for r, c in empties:
            b = _place(board, r, c, bot)
            if check_5_line(b, r, c, bot, DIRS, 5)[0] or check_structural_patterns(b, bot, self.patterns, 5)[0]:
                return (r, c)
        for r, c in empties:
            b = _place(board, r, c, human)
            if check_5_line(b, r, c, human, DIRS, 5)[0] or check_structural_patterns(b, human, self.patterns, 5)[0]:
                return (r, c)

        best_v = -INF; best_mv = empties[0]
        for r, c in empties:
            b = _place(board, r, c, bot)
            v = _eval(b, bot, self.patterns, None)
            v -= _eval(b, human, self.patterns, None)
            if v > best_v:
                best_v = v
                best_mv = (r, c)
        return best_mv

# =============================================================
#  HELPERS
# =============================================================

def _place(board, r, c, p):
    nb = [list(row) for row in board]
    nb[r][c] = p
    return nb

def _empty5(board): return [(r, c) for r, c in ALL_RC5 if board[r][c] is None]
def _empty7(board): return [(r, c) for r, c in ALL_RC7 if board[r][c] is None]

def _wins7(board, r, c, player, patterns):
    if check_7_line(board, r, c, player, ALL_DIRS, 7)[0]: return True
    if check_structural_patterns(board, player, patterns, 7)[0]: return True
    return False

def _eval(board, player, patterns, cell_uses):
    score = 0
    grid_size = len(board)
    opponent = "P2" if player == "P1" else "P1"
    
    # 1. Line Progress
    target = 7 if grid_size == 7 else 5
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
                    score += (m ** 4) * (30 if grid_size == 7 else 10)
                elif o > 0 and m == 0:
                    score -= (o ** 4) * (45 if grid_size == 7 else 15)

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

@router.post("/move")
def bot_move(req: BotMoveRequest):
    global _ENGINE7_NEW, _LAST_PATS7_NEW, _DANGER_ENG, _DANGER_PATS
    global _RUST_HARD_ENG, _RUST_HARD_PATS, _RUST_DANGER_ENG, _RUST_DANGER_PATS
    with open("C:/Users/yagya/Documents/pentaprotocol/backend/bot_debug.txt", "w") as f:
        f.write(f"BOT HIT: mode={req.board_mode}, pats={req.selected_patterns}\n")
    def normalize(cell): return None if cell in [None, "null", ""] else cell
    board = [[normalize(cell) for cell in row] for row in req.board]
    actual_mode = "7x7" if len(board) >= 7 and len(board[0]) >= 7 else "5x5"
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
            move = _ENGINE7_NEW.choose(copy.deepcopy(board), bot, human, req.difficulty, moves_played, req.c3_blocked)
    else:
        engine_stub = type("EngineStub", (), {
            "board": board,
            "current_player": req.current_player,
            "moves_played": moves_played,
            "shiftable_patterns": generate_all_patterns()
        })()
        move = get_bot_move(engine_stub, req.difficulty)
    return {"row": move[0], "col": move[1]} if move else {"row": None, "col": None}