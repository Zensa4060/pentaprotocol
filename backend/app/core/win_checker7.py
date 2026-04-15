from app.core.win_checker import find_path


# ================= 7 IN A LINE =================

_LINE_DIRS_7 = [(1, 0), (0, 1)]
_DIAG_DIRS_7 = [(1, 1), (1, -1)]
_ALL_DIRS_7  = _LINE_DIRS_7 + _DIAG_DIRS_7


def check_7_line(board, r, c, player, directions, grid_size=7, selected_patterns=None):
    """
    Check whether placing at (r, c) completes a 7-in-a-line for player.
    When selected_patterns is provided, only active directions are checked:
      - "LINE"     → horizontal and vertical
      - "DIAGONAL" → both diagonal axes
    Returns (True, line_coords) on win, (False, []) otherwise.
    """
    if selected_patterns is None:
        active = _ALL_DIRS_7
    else:
        active = []
        if "LINE" in selected_patterns:
            active.extend(_LINE_DIRS_7)
        if "DIAGONAL" in selected_patterns:
            active.extend(_DIAG_DIRS_7)
        if not active:
            return False, []

    for dr, dc in active:
        count = 1
        line = [(r, c)]

        for sign in (1, -1):
            rr = r + sign * dr
            cc = c + sign * dc

            while (0 <= rr < grid_size and
                   0 <= cc < grid_size and
                   board[rr][cc] == player):
                count += 1
                line.append((rr, cc))
                rr += sign * dr
                cc += sign * dc

        if count >= 7:
            return True, line

    return False, []


# ================= FULL-BOARD RESOLUTION =================

def resolve_full_board_7(board, directions, grid_size=7):
    """
    Called when the 7×7 board is completely filled.
    Returns (winner_string, winner_line, p1_score, p2_score).
    """
    p1_path = find_path(board, "P1", 20, directions, grid_size)
    p2_path = find_path(board, "P2", 20, directions, grid_size)

    p1_score = 20 if p1_path else 0
    p2_score = 20 if p2_path else 0

    if p1_path and not p2_path:
        return "P1", p1_path, p1_score, p2_score
    elif p2_path and not p1_path:
        return "P2", p2_path, p1_score, p2_score
    else:
        return "DRAW", [], p1_score, p2_score
