# series_logic.py — ready system timer tick and series outcome logic.
# Called every frame from the main loop.

import random

from rulebreaker import really_launch_game3


def tick_ready_system(ui, dt):
    """Advance the ready-system countdown each frame."""
    if not ui.waiting_ready:
        return

    if not (ui.p1_ready and ui.p2_ready):
        ui.ready_timeout -= dt / 1000
        if ui.ready_timeout <= 0:
            ui.p1_ready      = True
            ui.p2_ready      = True
            ui.ready_timer   = 2
    else:
        ui.ready_timer -= dt / 1000
        if ui.ready_timer <= 0:
            ui.waiting_ready = False

            if ui.match_over:
                pass  # series already decided, do nothing

            elif ui.game_number + 1 == 3:
                # About to start game 3 — show rulebreaker first
                ui.show_rulebreaker  = True
                ui.rulebreaker_timer = 3.0
                ui.coin_flip_timer   = 3.0
                ui.coin_result       = None

            else:
                ui.engine.reset()
                ui.game_number += 1

                if ui.game_number == 2:
                    ui.engine.current_player = "P2"

                ui.reset_timers()
                ui.move_log.clear()
                ui.move_number      = 1
                ui.series_processed = False


def tick_rulebreaker_phases(ui, dt):
    """Advance rulebreaker phase timers: summary countdown and coin flip phases."""
    # Summary countdown (after all choices made)
    if ui.show_rulebreaker and ui.toss_state == "summary":
        ui.toss_summary_timer -= dt / 1000
        if ui.toss_summary_timer <= 0:
            really_launch_game3(ui)
        return  # don't also tick the coin phases

    # Coin flip phases (only while no choice screen is active)
    if ui.show_rulebreaker and ui.toss_state is None:
        if ui.rulebreaker_timer > 0:
            # Phase 1: splash
            ui.rulebreaker_timer -= dt / 1000
        elif ui.coin_result is None:
            # Phase 2: coin flipping
            ui.coin_flip_timer -= dt / 1000
            if ui.coin_flip_timer <= 0:
                ui.coin_result       = random.choice(["YIN", "YANG"])
                ui.coin_reveal_timer = 2.5
        else:
            # Phase 3: reveal, then enter choice screen
            ui.coin_reveal_timer -= dt / 1000
            if ui.coin_reveal_timer <= 0:
                ui.toss_winner = "P1" if ui.coin_result == "YIN" else "P2"
                ui.toss_state  = "rule_choice"


def process_game_end(ui):
    """Check for and handle series outcome after each game finishes."""
    if not ui.engine.is_finished() or ui.series_processed:
        return

    ui.series_processed = True
    ui.match_history.append(ui.engine.get_winner())

    if len(ui.match_history) >= 2:
        series_winner = ui._check_series_winner()
        if series_winner is not None:
            # Series decided in 2 games
            ui.match_over    = True
            ui.series_winner = series_winner
        else:
            # Need game 3
            if ui.game_number >= 3:
                ui.match_over    = True
                ui.series_winner = ui.match_history[-1]
            else:
                ui.waiting_ready = True
                ui.p1_ready      = False
                ui.p2_ready      = False
                ui.ready_timeout = 60
                ui.ready_timer   = 2
    else:
        # After game 1, always go to game 2
        ui.waiting_ready = True
        ui.p1_ready      = False
        ui.p2_ready      = False
        ui.ready_timeout = 60
        ui.ready_timer   = 2