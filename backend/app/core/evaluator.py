from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Iterable, Sequence

from app.core.win_checker import (
    check_5_line,
    check_structural_patterns,
    resolve_full_board,
)
from app.core.win_checker6 import check_6_line, resolve_full_board_6
from app.core.win_checker7 import check_7_line, resolve_full_board_7


Board = list[list[str | None]]
Coord = tuple[int, int]

PLAYERS: tuple[str, str] = ("P1", "P2")
ALL_DIRS_8: tuple[Coord, ...] = (
    (0, 1),
    (1, 0),
    (1, 1),
    (1, -1),
    (0, -1),
    (-1, 0),
    (-1, -1),
    (-1, 1),
)


# Canonical pattern definitions aligned with frontend/lib/patterns_metadata.ts
PATTERN_SHAPES: dict[int, dict[str, list[Coord]]] = {
    5: {
        "V": [(0, 0), (1, 1), (2, 2), (1, 3), (0, 4)],
        "L": [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)],
        "ZZ-5": [(0, 0), (1, 1), (2, 0), (3, 1), (4, 0)],
        "T": [(0, 0), (0, 1), (0, 2), (1, 1), (2, 1)],
        "LINE": [(0, 2), (1, 2), (2, 2), (3, 2), (4, 2)],
        "DIAGONAL": [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4)],
    },
    6: {
        "ZZ": [(0, 0), (1, 1), (0, 2), (1, 3), (0, 4), (1, 5)],
        "T": [(0, 0), (0, 1), (0, 2), (1, 1), (2, 1), (3, 1)],
        "L": [(0, 0), (1, 0), (2, 0), (2, 1), (2, 2), (1, 1)],
        "Y": [(0, 0), (1, 1), (0, 2), (2, 1), (3, 1), (4, 1)],
        "LINE": [(0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2)],
        "DIAGONAL": [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)],
        "A": [(0, 2), (1, 1), (2, 0), (2, 1), (3, 1), (4, 2)],
    },
    7: {
        "Y": [(0, 0), (1, 1), (2, 2), (2, 3), (2, 4), (3, 1), (4, 0)],
        "L": [(0, 0), (0, 1), (0, 2), (0, 3), (1, 3), (2, 3), (3, 3)],
        "T": [(0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (2, 1), (2, 2)],
        "V": [(0, 0), (1, 1), (2, 2), (3, 3), (4, 2), (5, 1), (6, 0)],
        "C": [(0, 0), (0, 1), (0, 2), (1, 0), (2, 0), (1, 2), (2, 2)],
        "zigzag": [(0, 0), (1, 1), (2, 0), (3, 1), (4, 0), (5, 1), (6, 0)],
        "LINE": [(0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3)],
        "DIAGONAL": [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6)],
    },
}


@dataclass(frozen=True)
class _Weights:
    pattern: float = 0.65
    control: float = 0.22
    connection: float = 0.13


class PentaEvaluator:
    """
    Position evaluator for PentaProtocol.

    Notes:
    - Terminal detection intentionally delegates to existing win_checker modules.
    - No majority-control win rule is used (not part of PentaProtocol outcome logic).
    - Pattern features are computed only for this game's selected_patterns.
    """

    def __init__(self, board_size: int, selected_patterns: list[str]):
        if board_size not in (5, 6, 7):
            raise ValueError("board_size must be 5, 6, or 7")

        allowed = set(PATTERN_SHAPES[board_size].keys())
        bad = [p for p in selected_patterns if p not in allowed]
        if bad:
            raise ValueError(
                f"selected_patterns contains invalid ids for {board_size}x{board_size}: {bad}"
            )
        if len(selected_patterns) == 0:
            raise ValueError("selected_patterns must not be empty")

        self.size = board_size
        self.selected_patterns = tuple(selected_patterns)
        self._weights = _Weights()

        # Structural variants only; LINE/DIAGONAL are evaluated by line checkers.
        self._selected_structural_ids = tuple(
            p for p in self.selected_patterns if p not in ("LINE", "DIAGONAL")
        )
        self._selected_structural_variants = [
            v
            for pid in self._selected_structural_ids
            for v in self._generate_variants(PATTERN_SHAPES[self.size][pid])
        ]

        # For evaluator feature scoring we still evaluate proximity for all selected
        # patterns, including LINE / DIAGONAL.
        self._pattern_variants_for_eval: dict[str, list[list[Coord]]] = {
            pid: self._generate_variants(PATTERN_SHAPES[self.size][pid])
            for pid in self.selected_patterns
        }

        self._path_target = {5: 10, 6: 15, 7: 20}[self.size]
        self._cell_weights = self._build_cell_weights()

    def score(self, board: Board, player: str) -> float:
        """
        Returns score in [-1.0, 1.0] from `player` perspective.

        +1.0: terminal win for player
        -1.0: terminal loss for player
         0.0: terminal draw or balanced non-terminal
        """
        self._validate_board(board)
        if player not in PLAYERS:
            raise ValueError("player must be 'P1' or 'P2'")
        opponent = "P2" if player == "P1" else "P1"

        terminal = self._terminal_winner(board)
        if terminal == player:
            return 1.0
        if terminal == opponent:
            return -1.0
        if terminal == "DRAW":
            return 0.0

        # Non-terminal heuristics.
        p_pat = self._pattern_proximity_total(board, player)
        o_pat = self._pattern_proximity_total(board, opponent)
        pattern_term = p_pat - o_pat

        p_ctl = self._board_control(board, player)
        o_ctl = self._board_control(board, opponent)
        control_term = p_ctl - o_ctl

        p_conn = self._connection_potential(board, player)
        o_conn = self._connection_potential(board, opponent)
        conn_term = p_conn - o_conn

        raw = (
            self._weights.pattern * pattern_term
            + self._weights.control * control_term
            + self._weights.connection * conn_term
        )
        return max(-1.0, min(1.0, raw))

    def _terminal_winner(self, board: Board) -> str | None:
        """
        Uses existing win_checker modules for terminal detection.
        Returns: "P1" | "P2" | "DRAW" | None
        """
        # 1) Pattern/line terminal for either player.
        for who in PLAYERS:
            if self._has_pattern_or_line_win(board, who):
                return who

        # 2) Full-board connected-path resolution (10/15/20) with draw possible.
        if any(cell is None for row in board for cell in row):
            return None

        if self.size == 5:
            winner, _, _, _ = resolve_full_board(board, ALL_DIRS_8, self.size)
        elif self.size == 6:
            winner, _, _, _ = resolve_full_board_6(board, ALL_DIRS_8, self.size)
        else:
            winner, _, _, _ = resolve_full_board_7(board, ALL_DIRS_8, self.size)

        return winner

    def _has_pattern_or_line_win(self, board: Board, who: str) -> bool:
        # Line wins (LINE / DIAGONAL selected-state aware via selected_patterns arg).
        for r in range(self.size):
            for c in range(self.size):
                if board[r][c] != who:
                    continue
                if self.size == 5:
                    won, _ = check_5_line(
                        board,
                        r,
                        c,
                        who,
                        directions=None,
                        grid_size=self.size,
                        selected_patterns=list(self.selected_patterns),
                    )
                elif self.size == 6:
                    won, _ = check_6_line(
                        board,
                        r,
                        c,
                        who,
                        directions=None,
                        grid_size=self.size,
                        selected_patterns=list(self.selected_patterns),
                    )
                else:
                    won, _ = check_7_line(
                        board,
                        r,
                        c,
                        who,
                        directions=None,
                        grid_size=self.size,
                        selected_patterns=list(self.selected_patterns),
                    )
                if won:
                    return True

        if not self._selected_structural_variants:
            return False
        won_struct, _ = check_structural_patterns(
            board,
            who,
            self._selected_structural_variants,
            self.size,
        )
        return bool(won_struct)

    def _pattern_proximity_total(self, board: Board, player: str) -> float:
        """
        Average best fill ratio across selected patterns only.
        """
        if not self.selected_patterns:
            return 0.0
        vals = [
            self._pattern_proximity(board, player, pid)
            for pid in self.selected_patterns
        ]
        return sum(vals) / len(vals)

    def _pattern_proximity(self, board: Board, player: str, pattern_id: str) -> float:
        opponent = "P2" if player == "P1" else "P1"
        best = 0.0
        variants = self._pattern_variants_for_eval.get(pattern_id, [])
        if not variants:
            return 0.0

        for variant in variants:
            max_r = max(r for r, _ in variant)
            max_c = max(c for _, c in variant)
            for br in range(self.size - max_r):
                for bc in range(self.size - max_c):
                    mine = 0
                    blocked = False
                    for dr, dc in variant:
                        rr, cc = br + dr, bc + dc
                        v = board[rr][cc]
                        if v == opponent:
                            blocked = True
                            break
                        if v == player:
                            mine += 1
                    if blocked:
                        continue
                    ratio = mine / float(len(variant))
                    if ratio > best:
                        best = ratio
        return best

    def _board_control(self, board: Board, player: str) -> float:
        """
        Center-weighted occupancy ratio in [0,1] for `player`.
        """
        owned = 0.0
        total = 0.0
        for r in range(self.size):
            for c in range(self.size):
                w = self._cell_weights[r][c]
                total += w
                if board[r][c] == player:
                    owned += w
        if total <= 0:
            return 0.0
        return owned / total

    def _connection_potential(self, board: Board, player: str) -> float:
        """
        Connectivity signal in [0,1]:
        - largest connected component / target chain length (10/15/20)
        - plus mild coverage term to reward multiple strong clusters
        """
        comps = self._component_sizes(board, player)
        if not comps:
            return 0.0
        largest = max(comps)
        coverage = sum(v * v for v in comps) / float(self.size * self.size)
        a = min(1.0, largest / float(self._path_target))
        b = min(1.0, coverage / float(self._path_target))
        return 0.75 * a + 0.25 * b

    def _component_sizes(self, board: Board, player: str) -> list[int]:
        seen: set[Coord] = set()
        out: list[int] = []
        for r in range(self.size):
            for c in range(self.size):
                if board[r][c] != player or (r, c) in seen:
                    continue
                q: deque[Coord] = deque([(r, c)])
                seen.add((r, c))
                n = 0
                while q:
                    rr, cc = q.popleft()
                    n += 1
                    for dr, dc in ALL_DIRS_8:
                        nr, nc = rr + dr, cc + dc
                        if (
                            0 <= nr < self.size
                            and 0 <= nc < self.size
                            and board[nr][nc] == player
                            and (nr, nc) not in seen
                        ):
                            seen.add((nr, nc))
                            q.append((nr, nc))
                out.append(n)
        return out

    def _build_cell_weights(self) -> list[list[float]]:
        center = (self.size - 1) / 2.0
        max_manhattan = 2.0 * center if center > 0 else 1.0
        weights: list[list[float]] = []
        for r in range(self.size):
            row: list[float] = []
            for c in range(self.size):
                d = abs(r - center) + abs(c - center)
                # center -> 1.0, farthest edge -> ~0.25
                w = 1.0 - 0.75 * (d / max_manhattan)
                row.append(max(0.25, w))
            weights.append(row)
        return weights

    def _validate_board(self, board: Board) -> None:
        if len(board) != self.size:
            raise ValueError(f"board must have {self.size} rows")
        for row in board:
            if len(row) != self.size:
                raise ValueError(f"board must be {self.size}x{self.size}")
            for cell in row:
                if cell not in (None, "P1", "P2"):
                    raise ValueError("board cells must be None, 'P1', or 'P2'")

    @staticmethod
    def _generate_variants(pattern: Sequence[Coord]) -> list[list[Coord]]:
        """
        Generate unique rotations + reflections for a pattern.
        """
        seen: set[tuple[Coord, ...]] = set()
        variants: list[list[Coord]] = []

        for reflect in (1, -1):
            for rotation in range(4):
                transformed: list[Coord] = []
                for r, c in pattern:
                    r2, c2 = r, c * reflect
                    for _ in range(rotation):
                        r2, c2 = c2, -r2
                    transformed.append((r2, c2))

                min_r = min(r for r, _ in transformed)
                min_c = min(c for _, c in transformed)
                normalized = tuple(
                    sorted((r - min_r, c - min_c) for r, c in transformed)
                )
                if normalized not in seen:
                    seen.add(normalized)
                    variants.append(list(normalized))

        return variants

