from app.core.patterns import generate_all_patterns
from app.core.patterns7 import generate_all_patterns_7
from app.core.win_checker import check_5_line, check_structural_patterns, find_path, resolve_full_board
from app.core.win_checker7 import check_7_line, resolve_full_board_7


class GameEngine:

    DIRECTIONS = [
        (-1, 0), (1, 0), (0, -1), (0, 1),
        (-1, -1), (-1, 1), (1, -1), (1, 1)
    ]

    def __init__(
        self,
        board_mode="5x5",
        selected_pattern_ids=None,
        selected_pattern_ids_p1=None,
        selected_pattern_ids_p2=None,
    ):
        self.board_mode = board_mode

        if board_mode == "7x7":
            self.GRID_SIZE = 7
            self.CENTER = 3
            # Asymmetric rulebreaker ban: each player may have a different allowed pattern set.
            base = selected_pattern_ids or []
            p1 = (
                selected_pattern_ids_p1
                if selected_pattern_ids_p1 is not None
                else base
            )
            p2 = (
                selected_pattern_ids_p2
                if selected_pattern_ids_p2 is not None
                else base
            )
            self.shiftable_patterns_p1 = generate_all_patterns_7(p1)
            self.shiftable_patterns_p2 = generate_all_patterns_7(p2)
            # Back-compat: default structural set (P1) for any code reading .shiftable_patterns
            self.shiftable_patterns = self.shiftable_patterns_p1
            self.selected_pattern_ids = selected_pattern_ids or []
            self.selected_pattern_ids_p1 = p1
            self.selected_pattern_ids_p2 = p2
            self.chain_target = 20
        else:
            self.GRID_SIZE = 5
            self.CENTER = 2
            self.shiftable_patterns = generate_all_patterns()
            self.selected_pattern_ids = None
            self.selected_pattern_ids_p1 = None
            self.selected_pattern_ids_p2 = None
            self.chain_target = 10

        self.reset()

    def reset(self):
        self.board = [[None for _ in range(self.GRID_SIZE)]
                      for _ in range(self.GRID_SIZE)]
        self.current_player = "P1"
        self.winner = None
        self.winner_line = []
        self.moves_played = 0
        self.extra_turns = 0
        self.connection_scores = None
        self.suppress_center_opening = False

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
        if (
            not getattr(self, "suppress_center_opening", False)
            and self.moves_played == 1
            and row == self.CENTER
            and col == self.CENTER
        ):
            self._switch_turn()          # opponent now has the turn
            self.extra_turns = 2         # opponent gets 2 extra turns
            return {"success": True, "winner": None, "extra_turns": 2}

        # ── Win checks ──
        if self.board_mode == "7x7":
            win, line = check_7_line(
                self.board, row, col, player_who_moved,
                self.DIRECTIONS, self.GRID_SIZE
            )
        else:
            win, line = check_5_line(
                self.board, row, col, player_who_moved,
                self.DIRECTIONS, self.GRID_SIZE
            )
        if win:
            self.winner = player_who_moved
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}

        # ── Structural patterns ──
        if self.board_mode == "7x7":
            pat_for_mover = (
                self.shiftable_patterns_p1
                if player_who_moved == "P1"
                else self.shiftable_patterns_p2
            )
        else:
            pat_for_mover = self.shiftable_patterns
        win, line = check_structural_patterns(
            self.board, player_who_moved, pat_for_mover, self.GRID_SIZE
        )
        if win:
            self.winner = player_who_moved
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}


        # ── Full board ──
        if self.moves_played == self.GRID_SIZE * self.GRID_SIZE:
            if self.board_mode == "7x7":
                result, line, p1_s, p2_s = resolve_full_board_7(
                    self.board, self.DIRECTIONS, self.GRID_SIZE
                )
            else:
                result, line, p1_s, p2_s = resolve_full_board(
                    self.board, self.DIRECTIONS, self.GRID_SIZE
                )
            self.winner = result
            self.winner_line = line
            self.connection_scores = {"p1": p1_s, "p2": p2_s}
            return {"success": True, "winner": self.winner, "extra_turns": 0, "connectionScores": self.connection_scores}

        # ── Extra turns logic ──
        if self.extra_turns > 0:
            self.extra_turns -= 1
            if self.extra_turns == 0:
                self._switch_turn()
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