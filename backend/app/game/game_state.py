# game_state.py
# Holds all non-rendering UI state: engine, clock, timers, match flow.
# Extracted from the original monolithic ui.py.

import pygame
from engine import GameEngine


class GameState:

    def __init__(self):

        # ================= ENGINE =================
        self.engine = GameEngine()

        # ================= CLOCK =================
        self.clock         = pygame.time.Clock()
        self.flash_counter = 0

        # ================= SERIES =================
        self.game_number      = 1
        self.match_history    = []
        self.match_wins       = {"P1": 0, "P2": 0}
        self.p1_series_points = 0
        self.p2_series_points = 0
        self.match_over       = False
        self.series_winner    = None
        self.series_processed = False

        # ================= MOVE LOG =================
        self.move_log    = []
        self.move_number = 1

        # ================= READY SYSTEM =================
        self.waiting_ready  = False
        self.p1_ready       = False
        self.p2_ready       = False
        self.ready_timer    = 0
        self.ready_timeout  = 0
        self.p1_ready_rect  = None
        self.p2_ready_rect  = None

        # ================= FORFEIT =================
        self.forfeit_screen  = False
        self.forfeit_message = ""
        self.proceed_rect    = None

        # ================= RESET BUTTON =================
        self.reset_rect = None

        # ================= SPLASH / QUIT =================
        self.show_splash       = True
        self.play_rect         = None
        self.show_quit_confirm = False
        self.quit_yes_rect     = None
        self.quit_no_rect      = None
        self.x_button_rect     = None

        # ================= RULEBREAKER =================
        self.show_rulebreaker    = False
        self.rulebreaker_timer   = 3.0
        self.coin_flip_timer     = 3.0
        self.coin_result         = None
        self.coin_reveal_timer   = 0.0

        self.toss_winner         = None
        self.toss_state          = None   # None | "rule_choice" | "c3_choice" |
                                          # "who_first_winner" | "who_first_loser" |
                                          # "c3_choice_loser" | "summary"
        self.c3_blocked          = False
        self.first_player_chosen = None
        self.toss_rect_left      = None
        self.toss_rect_right     = None

        self.toss_summary_timer = 0.0
        self.toss_summary_fp    = None

        # ================= TIMERS =================
        self.reset_timers()

    # ============================================================
    # SOFT RESET  (no splash — stays in game)
    # ============================================================

    def soft_reset(self):
        self.engine           = GameEngine()
        self.flash_counter    = 0
        self.game_number      = 1
        self.match_history    = []
        self.match_wins       = {"P1": 0, "P2": 0}
        self.p1_series_points = 0
        self.p2_series_points = 0
        self.match_over       = False
        self.series_winner    = None
        self.series_processed = False
        self.move_log         = []
        self.move_number      = 1
        self.waiting_ready    = False
        self.p1_ready         = False
        self.p2_ready         = False
        self.ready_timer      = 0
        self.ready_timeout    = 0
        self.forfeit_screen   = False
        self.forfeit_message  = ""
        self.show_quit_confirm  = False
        self.show_rulebreaker   = False
        self.rulebreaker_timer  = 3.0
        self.coin_flip_timer    = 3.0
        self.coin_result        = None
        self.coin_reveal_timer  = 0.0
        self.toss_winner        = None
        self.toss_state         = None
        self.c3_blocked         = False
        self.first_player_chosen = None
        self.toss_rect_left     = None
        self.toss_rect_right    = None
        self.toss_summary_timer = 0.0
        self.toss_summary_fp    = None
        self.reset_timers()

    # ============================================================
    # TIMER SYSTEM
    # ============================================================

    def reset_timers(self):
        self.p1_time = 180000   # 3 minutes in ms
        self.p2_time = 180000

    def update_timer(self, dt):
        if (self.show_splash or
                self.show_quit_confirm or
                self.engine.is_finished() or
                self.waiting_ready or
                self.match_over):
            return

        current = self.engine.get_current_player()

        if current == "P1":
            self.p1_time -= dt
            if self.p1_time <= 0:
                self.engine.winner   = "P2"
                self.forfeit_screen  = True
                self.forfeit_message = (
                    "P1 failed to deploy in time — P2 wins by default"
                )
        else:
            self.p2_time -= dt
            if self.p2_time <= 0:
                self.engine.winner   = "P1"
                self.forfeit_screen  = True
                self.forfeit_message = (
                    "P2 failed to deploy in time — P1 wins by default"
                )

    def format_time(self, ms):
        seconds = max(0, ms // 1000)
        return f"{seconds//60:02}:{seconds%60:02}"

    # ============================================================
    # SERIES WINNER CHECK
    # ============================================================

    def _check_series_winner(self):
        """
        Returns "P1", "P2", or None.
        Standardized first-to-5 total points.
        """
        p1 = 0.0
        p2 = 0.0
        for w in self.match_history:
            if w == "P1":
                p1 += 1.0
            elif w == "P2":
                p2 += 1.0
            elif w == "DRAW":
                p1 += 0.5
                p2 += 0.5
        self.p1_series_points = p1
        self.p2_series_points = p2

        if self.p1_series_points >= 5 - 1e-9:
            return "P1"
        if self.p2_series_points >= 5 - 1e-9:
            return "P2"

        return None

    # ============================================================
    # MOVE LOG
    # ============================================================

    def log_move(self, row, col, player):
        import random
        from constants import LOG_COLORS
        col_letter = chr(65 + col)          # A-E
        row_number = row + 1                 # 1-5
        piece      = "X" if player == "P1" else "Y"
        entry      = (
            f"{self.move_number}. {piece} deployed at "
            f"{col_letter}{row_number} by {player}"
        )
        color = random.choice(LOG_COLORS)
        self.move_log.append((entry, color))
        self.move_number += 1