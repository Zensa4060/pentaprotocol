# engine.py

from app.patterns import generate_all_patterns
from app.win_checker import (
    check_5_line,
    check_structural_patterns,
    resolve_full_board
)


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
            return {"success": False, "winner": None}
        if not (0 <= row < self.GRID_SIZE and 0 <= col < self.GRID_SIZE):
            return {"success": False, "winner": None}
        if self.board[row][col] is not None:
            return {"success": False, "winner": None}
        self.board[row][col] = self.current_player
        self.moves_played += 1
        if self.moves_played == 1:
            if row == self.CENTER and col == self.CENTER:
                self._switch_turn()
                self.extra_turns = 2
                return {"success": True, "winner": None}
        win, line = check_5_line(self.board, row, col, self.current_player, self.DIRECTIONS, self.GRID_SIZE)
        if win:
            self.winner = self.current_player
            self.winner_line = line
            return {"success": True, "winner": self.winner}
        win, line = check_structural_patterns(self.board, self.current_player, self.shiftable_patterns, self.GRID_SIZE)
        if win:
            self.winner = self.current_player
            self.winner_line = line
            return {"success": True, "winner": self.winner}
        if self.moves_played == self.GRID_SIZE * self.GRID_SIZE:
            result, line = resolve_full_board(self.board, self.DIRECTIONS, self.GRID_SIZE)
            self.winner = result
            self.winner_line = line
            return {"success": True, "winner": self.winner}
        if self.extra_turns > 0:
            self.extra_turns -= 1
            if self.extra_turns == 0:
                self._switch_turn()
        else:
            self._switch_turn()
        return {"success": True, "winner": None}

    def _switch_turn(self):
        self.current_player = "P2" if self.current_player == "P1" else "P1"

    def get_board(self):          return self.board
    def get_winner(self):         return self.winner
    def get_winner_line(self):    return self.winner_line
    def get_current_player(self): return self.current_player
    def is_finished(self):        return self.winner is not None
