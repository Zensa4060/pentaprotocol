from app.core.patterns import generate_all_patterns
from app.core.win_checker import check_5_line, check_structural_patterns, resolve_full_board


class GameEngine:

    GRID_SIZE = 5
    CENTER = 2

    DIRECTIONS = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1)
    ]

    def __init__(self):
        self.shiftable_patterns = generate_all_patterns()
        self.reset()

    def reset(self):
        self.board = [[None for _ in range(self.GRID_SIZE)]
                      for _ in range(self.GRID_SIZE)]
        self.current_player = "P1"
        self.winner = None
        self.winner_line = []
        self.moves_played = 0
        self.extra_turns = 0

    def deploy(self, row, col):
        if self.winner:
            return {"success": False, "winner": None, "extra_turns": 0}
        if not (0 <= row < self.GRID_SIZE and 0 <= col < self.GRID_SIZE):
            return {"success": False, "winner": None, "extra_turns": 0}
        if self.board[row][col] is not None:
            return {"success": False, "winner": None, "extra_turns": 0}

        player_who_moved = self.current_player
        self.board[row][col] = player_who_moved
        self.moves_played += 1

        # ── Center rule: first move on center gives opponent 2 extra turns ──
        if self.moves_played == 1 and row == self.CENTER and col == self.CENTER:
            self._switch_turn()          # opponent now has the turn
            self.extra_turns = 2         # opponent gets 2 extra turns
            return {"success": True, "winner": None, "extra_turns": 2}

        # ── Win checks (use player_who_moved, not current_player) ──
        win, line = check_5_line(
            self.board, row, col, player_who_moved, self.DIRECTIONS, self.GRID_SIZE
        )
        if win:
            self.winner = player_who_moved
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}

        win, line = check_structural_patterns(
            self.board, player_who_moved, self.shiftable_patterns, self.GRID_SIZE
        )
        if win:
            self.winner = player_who_moved
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}

        # ── Full board draw ──
        if self.moves_played == self.GRID_SIZE * self.GRID_SIZE:
            result, line = resolve_full_board(self.board, self.DIRECTIONS, self.GRID_SIZE)
            self.winner = result
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}

        # ── Extra turns logic ──
        if self.extra_turns > 0:
            self.extra_turns -= 1
            if self.extra_turns == 0:
                self._switch_turn()
            # else: same player keeps their turn
        else:
            self._switch_turn()

        return {"success": True, "winner": None, "extra_turns": self.extra_turns}

    def _switch_turn(self):
        self.current_player = "P2" if self.current_player == "P1" else "P1"

    def get_board(self):          return self.board
    def get_winner(self):         return self.winner
    def get_winner_line(self):    return self.winner_line
    def get_current_player(self): return self.current_player
    def is_finished(self):        return self.winner is not None