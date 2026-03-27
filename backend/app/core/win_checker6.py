# win_checker6.py
# Win-condition checks for the 6×6 board mode.

from app.core.win_checker import find_path

def check_6_line(board, r, c, player, directions, grid_size=6):
    """
    Check whether placing at (r, c) completes a 6-in-a-line for player.
    Returns (True, line_coords) on win, (False, []) otherwise.
    """
    for dr, dc in directions:
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

        if count >= 6:
            return True, line

    return False, []

def resolve_full_board_6(board, directions, grid_size=6):
    """
    Called when the 6×6 board is completely filled.
    Returns (winner_string, winner_line, p1_score, p2_score).
    """
    # 6x6 resolution requires a 15-cell chain.
    p1_path = find_path(board, "P1", 15, directions, grid_size)
    p2_path = find_path(board, "P2", 15, directions, grid_size)

    p1_score = 15 if p1_path else 0
    p2_score = 15 if p2_path else 0

    if p1_path and not p2_path:
        return "P1", p1_path, p1_score, p2_score
    elif p2_path and not p1_path:
        return "P2", p2_path, p1_score, p2_score
    else:
        return "DRAW", [], p1_score, p2_score
