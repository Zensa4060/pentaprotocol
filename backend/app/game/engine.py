from app.core.patterns import generate_all_patterns
from app.core.patterns7 import generate_all_patterns_7
from app.core.patterns6 import generate_all_patterns_6
from app.core.win_checker import check_5_line, check_structural_patterns, find_path, resolve_full_board
from app.core.win_checker7 import check_7_line, resolve_full_board_7
from app.core.win_checker6 import check_6_line, resolve_full_board_6


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
        rb6_special_cell=None,
    ):
        self.board_mode = board_mode
        self.rb6_special_cell = rb6_special_cell  # {'r': int, 'c': int, 'owner': 'P1'|'P2'}

        if board_mode == "7x7":
            self.GRID_SIZE = 7
            self.CENTER = 3
            # Asymmetric rulebreaker ban: each player may have a different allowed pattern set.
            from app.core.patterns7 import PATTERN_NAMES_7

            base = (
                list(selected_pattern_ids)
                if isinstance(selected_pattern_ids, list) and len(selected_pattern_ids) > 0
                else list(PATTERN_NAMES_7)
            )
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
            # Generate structural patterns (shapes only — LINE/DIAGONAL are in win_checker)
            self.shiftable_patterns_p1 = generate_all_patterns_7([x for x in p1 if x not in ("LINE", "DIAGONAL")])
            self.shiftable_patterns_p2 = generate_all_patterns_7([x for x in p2 if x not in ("LINE", "DIAGONAL")])
            # Back-compat: default structural set (P1) for any code reading .shiftable_patterns
            self.shiftable_patterns = self.shiftable_patterns_p1
            self.selected_pattern_ids = base
            self.selected_pattern_ids_p1 = p1
            self.selected_pattern_ids_p2 = p2
            self.chain_target = 20
        elif board_mode == "6x6":
            self.GRID_SIZE = 6
            self.CENTER = 2.5  # No single center cell
            from app.core.patterns6 import PATTERN_NAMES_6
            base6 = (
                list(selected_pattern_ids)
                if isinstance(selected_pattern_ids, list) and len(selected_pattern_ids) > 0
                else list(PATTERN_NAMES_6)
            )
            # Structural patterns only (shapes; LINE/DIAGONAL handled in win_checker)
            self.shiftable_patterns = generate_all_patterns_6()
            self.selected_pattern_ids = base6
            self.selected_pattern_ids_p1 = base6
            self.selected_pattern_ids_p2 = base6
            self.chain_target = 15
        else:
            self.GRID_SIZE = 5
            self.CENTER = 2
            from app.core.patterns import PATTERN_NAMES_5, generate_all_patterns_5
            base5 = (
                list(selected_pattern_ids)
                if isinstance(selected_pattern_ids, list) and len(selected_pattern_ids) > 0
                else list(PATTERN_NAMES_5)
            )
            # Structural patterns only (shapes; LINE/DIAGONAL handled in win_checker)
            self.shiftable_patterns = generate_all_patterns_5([x for x in base5 if x not in ("LINE", "DIAGONAL")])
            self.selected_pattern_ids = base5
            self.selected_pattern_ids_p1 = base5
            self.selected_pattern_ids_p2 = base5
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
        # rb6_special_cell is typically passed in __init__ for stateless deploy, 
        # but we keep it here if reset is used.

    def deploy(self, row, col):
        if self.winner:
            return {"success": False, "winner": None, "extra_turns": 0}
        if not (0 <= row < self.GRID_SIZE and 0 <= col < self.GRID_SIZE):
            return {"success": False, "winner": None, "extra_turns": 0}
        if self.board[row][col] is not None:
            return {"success": False, "winner": None, "extra_turns": 0}

        player_who_moved = self.current_player
        
        # ── 6x6 Timebreaker Special Cell ──
        stone_owner = player_who_moved
        if (
            self.board_mode == "6x6"
            and self.rb6_special_cell
            and self.rb6_special_cell.get("r") == row
            and self.rb6_special_cell.get("c") == col
        ):
            stone_owner = self.rb6_special_cell.get("owner", player_who_moved)

        self.board[row][col] = stone_owner
        self.moves_played += 1

        # ── Center rule: first move on center gives opponent 2 extra turns ──
        if (
            not getattr(self, "suppress_center_opening", False)
            and self.moves_played == 1
            and (self.GRID_SIZE == 5 or self.GRID_SIZE == 7)
            and row == self.CENTER
            and col == self.CENTER
        ):
            self._switch_turn()          # opponent now has the turn
            self.extra_turns = 2         # opponent gets 2 extra turns
            return {"success": True, "winner": None, "extra_turns": 2}

        # ── Win checks (LINE/DIAGONAL conditional on selected_patterns) ──
        if self.board_mode == "7x7":
            player_patterns = (
                self.selected_pattern_ids_p1
                if stone_owner == "P1"
                else self.selected_pattern_ids_p2
            )
            win, line = check_7_line(
                self.board, row, col, stone_owner,
                self.DIRECTIONS, self.GRID_SIZE,
                selected_patterns=player_patterns,
            )
        elif self.board_mode == "6x6":
            win, line = check_6_line(
                self.board, row, col, stone_owner,
                self.DIRECTIONS, self.GRID_SIZE,
                selected_patterns=self.selected_pattern_ids,
            )
        else:
            win, line = check_5_line(
                self.board, row, col, stone_owner,
                self.DIRECTIONS, self.GRID_SIZE,
                selected_patterns=self.selected_pattern_ids,
            )
        if win:
            self.winner = stone_owner
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}

        # ── Structural patterns ──
        if self.board_mode == "7x7":
            pat_for_mover = (
                self.shiftable_patterns_p1
                if stone_owner == "P1"
                else self.shiftable_patterns_p2
            )
        else:
            pat_for_mover = self.shiftable_patterns
        win, line = check_structural_patterns(
            self.board, stone_owner, pat_for_mover, self.GRID_SIZE
        )
        if win:
            self.winner = stone_owner
            self.winner_line = line
            return {"success": True, "winner": self.winner, "extra_turns": 0}


        # ── Full board ──
        if self.moves_played == self.GRID_SIZE * self.GRID_SIZE:
            if self.board_mode == "7x7":
                result, line, p1_s, p2_s = resolve_full_board_7(
                    self.board, self.DIRECTIONS, self.GRID_SIZE
                )
            elif self.board_mode == "6x6":
                result, line, p1_s, p2_s = resolve_full_board_6(
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