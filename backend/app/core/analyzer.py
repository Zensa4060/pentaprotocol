from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import Any

from app.core.evaluator import PentaEvaluator
from app.core.patterns import generate_all_patterns, generate_all_patterns_5
from app.core.patterns6 import generate_all_patterns_6
from app.core.patterns7 import generate_all_patterns_7
from app.routers import bot as bot_router


Move = dict[str, Any]


def classify_move(score_delta: float) -> str:
    """
    score_delta = score_after - score_before (from current player's perspective)
    """
    if score_delta >= 0.0:
        return "best"
    if score_delta >= -0.05:
        return "good"
    if score_delta >= -0.15:
        return "inaccuracy"
    if score_delta >= -0.30:
        return "mistake"
    return "blunder"


def compute_summary(annotations: list[dict]) -> dict:
    out: dict[str, dict[str, float | int]] = {
        "P1": {
            "best_moves": 0,
            "good": 0,
            "inaccuracies": 0,
            "mistakes": 0,
            "blunders": 0,
            "accuracy": 100.0,
        },
        "P2": {
            "best_moves": 0,
            "good": 0,
            "inaccuracies": 0,
            "mistakes": 0,
            "blunders": 0,
            "accuracy": 100.0,
        },
    }

    neg_deltas: dict[str, list[float]] = {"P1": [], "P2": []}
    q_key = {
        "best": "best_moves",
        "good": "good",
        "inaccuracy": "inaccuracies",
        "mistake": "mistakes",
        "blunder": "blunders",
    }

    for a in annotations:
        p = str(a.get("player", ""))
        if p not in ("P1", "P2"):
            continue
        q = str(a.get("quality", ""))
        d = float(a.get("score_delta", 0.0))

        bucket = q_key.get(q)
        if bucket:
            out[p][bucket] = int(out[p][bucket]) + 1
        if d < 0:
            neg_deltas[p].append(abs(d))

    for p in ("P1", "P2"):
        losses = neg_deltas[p]
        if not losses:
            acc = 100.0
        else:
            mean_drop = sum(losses) / len(losses)
            acc = 100.0 * (1.0 - mean_drop)
        acc = max(0.0, min(100.0, acc))
        out[p]["accuracy"] = round(acc, 1)

    return out


@dataclass
class _EngineAdapter:
    """
    Adapter so analyze_game can call engine.best_move(...) while still
    using the exact board-size selection logic already present in bot.py.
    """

    board_size: int
    selected_patterns: list[str]

    def best_move(self, board: list[list[str | None]], player: str, depth: int = 4) -> list[int] | None:
        move = _pick_best_move(self.board_size, self.selected_patterns, board, player)
        if move is None:
            return None
        return [int(move[0]), int(move[1])]


def _pick_best_move(
    board_size: int,
    selected_patterns: list[str],
    board: list[list[str | None]],
    player: str,
) -> tuple[int, int] | None:
    """
    Mirror bot.py engine-selection branches by board size.
    We deliberately reuse the same global engine instances / caches in bot.py
    instead of introducing a separate picker.
    """
    bot = player
    human = "P2" if bot == "P1" else "P1"
    moves_played = sum(1 for row in board for cell in row if cell is not None)

    if board_size == 7:
        pats = generate_all_patterns_7(selected_patterns)
        pat_key = tuple(tuple(p) for p in pats)

        if bot_router._HAS_RUST:
            # Same branch family as bot.py's 7x7 Rust "hard" path.
            if bot_router._RUST_HARD_ENG is None or bot_router._RUST_HARD_PATS != pat_key:
                bot_router._RUST_HARD_ENG = bot_router.RustHardBot7(pats)
                bot_router._RUST_HARD_PATS = pat_key
            return bot_router._RUST_HARD_ENG.choose(
                copy.deepcopy(board), bot, human, "hard", moves_played, False
            )

        # Python fallback branch used by bot.py for non-Rust 7x7.
        if bot_router._ENGINE7_NEW is None or bot_router._LAST_PATS7_NEW != pat_key:
            bot_router._ENGINE7_NEW = bot_router._Bot7Engine(pats)
            bot_router._LAST_PATS7_NEW = pat_key
        return bot_router._ENGINE7_NEW.choose(
            copy.deepcopy(board), bot, human, "hard", moves_played, False
        )

    if board_size == 6:
        # bot.py uses full 6x6 pool via generate_all_patterns_6()
        pats6 = generate_all_patterns_6()
        pat_key6 = tuple(tuple(p) for p in pats6)
        diff6 = "normal"

        if bot_router._HAS_RUST:
            if bot_router._RUST_6_PATS != pat_key6:
                bot_router._RUST_NORMAL6_ENG = bot_router.RustNormalBot6(pats6)
                bot_router._RUST_HARD6_ENG = bot_router.RustHardBot6(pats6)
                bot_router._RUST_GOD6_ENG = bot_router.RustMachineGodBot6(pats6)
                bot_router._RUST_6_PATS = pat_key6

            # Same mapping as bot.py normal branch.
            if diff6 == "normal":
                return bot_router._RUST_HARD6_ENG.choose(
                    copy.deepcopy(board), bot, human, moves_played
                )
            if diff6 == "machine_god":
                return bot_router._RUST_GOD6_ENG.choose(
                    copy.deepcopy(board), bot, human, moves_played
                )
            if diff6 == "hard":
                if bot_router._PYTHON_6_ENG is None or bot_router._PYTHON_6_PATS != pat_key6:
                    bot_router._PYTHON_6_ENG = bot_router.BotEngine6(pats6)
                    bot_router._PYTHON_6_PATS = pat_key6
                return bot_router._PYTHON_6_ENG.choose(
                    copy.deepcopy(board), bot, human, "easy_block"
                )
            return bot_router._RUST_NORMAL6_ENG.choose(
                copy.deepcopy(board), bot, human, moves_played
            )

        if bot_router._PYTHON_6_ENG is None or bot_router._PYTHON_6_PATS != pat_key6:
            bot_router._PYTHON_6_ENG = bot_router.BotEngine6(pats6)
            bot_router._PYTHON_6_PATS = pat_key6
        call_diff = "normal" if diff6 == "normal" else diff6
        return bot_router._PYTHON_6_ENG.choose(copy.deepcopy(board), bot, human, call_diff)

    # 5x5 branch (same selected-pattern handling semantics as bot.py).
    structural_ids = [p for p in selected_patterns if p not in ("LINE", "DIAGONAL")]
    pats5 = (
        generate_all_patterns_5(structural_ids)
        if structural_ids
        else generate_all_patterns()
    )
    engine_stub = type(
        "EngineStub",
        (),
        {
            "board": board,
            "current_player": player,
            "moves_played": moves_played,
            "shiftable_patterns": pats5,
        },
    )()
    return bot_router.get_bot_move(engine_stub, "hard", False)


def analyze_game(
    board_size: int,
    selected_patterns: list[str],
    move_history: list[dict],
) -> dict:
    evaluator = PentaEvaluator(board_size, selected_patterns)
    engine = _EngineAdapter(board_size=board_size, selected_patterns=selected_patterns)
    board: list[list[str | None]] = [[None for _ in range(board_size)] for _ in range(board_size)]

    annotations: list[dict] = []

    for i, move in enumerate(move_history):
        player = str(move["player"])
        row = int(move["row"])
        col = int(move["col"])

        if player not in ("P1", "P2"):
            raise ValueError(f"Invalid player at move {i}: {player}")
        if not (0 <= row < board_size and 0 <= col < board_size):
            raise ValueError(f"Move {i} out of bounds: ({row}, {col})")
        if board[row][col] is not None:
            raise ValueError(f"Illegal move {i}: cell already occupied at ({row}, {col})")

        # a) score_before
        score_before = evaluator.score(board, player)

        # b) engine_best from THIS position
        engine_best = engine.best_move(board, player, depth=4)

        # c) simulate engine-best move on a deep-copied board to compute
        # engine-relative quality delta without mutating the real board.
        engine_score = score_before
        if engine_best is not None and len(engine_best) == 2:
            er, ec = int(engine_best[0]), int(engine_best[1])
            if (
                0 <= er < board_size
                and 0 <= ec < board_size
                and board[er][ec] is None
            ):
                sim_board = copy.deepcopy(board)
                sim_board[er][ec] = player
                engine_score = evaluator.score(sim_board, player)

        # d) apply actual move
        board[row][col] = player

        # e) score_after
        score_after = evaluator.score(board, player)

        # f) classification delta compares actual move against engine-best
        # from the same pre-move position. score_before/score_after stay as-is
        # for trend graphing.
        delta = score_after - engine_score

        # g) classify + annotate
        quality = classify_move(delta)
        annotations.append(
            {
                "move_index": i,
                "player": player,
                "played": [row, col],
                "engine_best": engine_best,
                "quality": quality,
                "score_before": round(score_before, 3),
                "score_after": round(score_after, 3),
                "score_delta": round(delta, 3),
            }
        )

    return {
        "move_annotations": annotations,
        "summary": compute_summary(annotations),
    }

