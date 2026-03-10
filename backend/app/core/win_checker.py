# win_checker.py
# All win-condition checks.
# Extracted from the original monolithic engine.py.


# ================= 5 IN A LINE =================

def check_5_line(board, r, c, player, directions, grid_size):
    """
    Check whether placing at (r, c) completes a 5-in-a-line for player.
    Returns (True, line_coords) on win, (False, []) otherwise.
    """
    for dr, dc in directions:

        count = 1
        line  = [(r, c)]

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

        if count >= 5:
            return True, line

    return False, []


# ================= STRUCTURAL PATTERNS =================

def check_structural_patterns(board, player, patterns, grid_size):
    """
    Check whether player has completed any of the pre-generated shape patterns.
    Returns (True, coords) on match, (False, []) otherwise.
    """
    for pattern in patterns:

        max_r = max(r for r, _ in pattern)
        max_c = max(c for _, c in pattern)

        for br in range(grid_size - max_r):
            for bc in range(grid_size - max_c):

                coords = []
                valid  = True

                for dr, dc in pattern:
                    rr = br + dr
                    cc = bc + dc

                    if board[rr][cc] != player:
                        valid = False
                        break

                    coords.append((rr, cc))

                if valid:
                    return True, coords

    return False, []


# ================= 10-CELL CONNECTION =================

def find_10(board, player, directions, grid_size):
    """
    DFS search for a chain of 10 connected cells belonging to player.
    Returns the path list if found, None otherwise.
    """
    def dfs(path):
        if len(path) == 10:
            return path

        r0, c0 = path[-1]

        for dr, dc in directions:
            nr = r0 + dr
            nc = c0 + dc

            if (0 <= nr < grid_size and
                    0 <= nc < grid_size and
                    board[nr][nc] == player and
                    (nr, nc) not in path):

                result = dfs(path + [(nr, nc)])
                if result:
                    return result

        return None

    for r in range(grid_size):
        for c in range(grid_size):
            if board[r][c] == player:
                result = dfs([(r, c)])
                if result:
                    return result

    return None


# ================= FULL-BOARD RESOLUTION =================

def resolve_full_board(board, directions, grid_size):
    """
    Called when the board is completely filled.
    Returns (winner_string, winner_line).
    """
    p1 = find_10(board, "P1", directions, grid_size)
    p2 = find_10(board, "P2", directions, grid_size)

    if p1 and not p2:
        return "P1", p1
    elif p2 and not p1:
        return "P2", p2
    else:
        return "DRAW", []