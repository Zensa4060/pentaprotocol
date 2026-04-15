# win_checker.py
# All win-condition checks.
# Extracted from the original monolithic engine.py.


# ================= 5 IN A LINE =================

# Canonical direction pairs (each covers both signs automatically)
_LINE_DIRS = [(1, 0), (0, 1)]        # horizontal + vertical
_DIAG_DIRS = [(1, 1), (1, -1)]       # both diagonals
_ALL_DIRS_5 = _LINE_DIRS + _DIAG_DIRS


def check_5_line(board, r, c, player, directions, grid_size, selected_patterns=None):
    """
    Check whether placing at (r, c) completes a 5-in-a-line for player.
    When selected_patterns is provided, only checks directions for patterns that are selected:
      - "LINE"     → horizontal and vertical
      - "DIAGONAL" → both diagonal axes
    When selected_patterns is None (legacy), checks all 4 axis directions.
    Returns (True, line_coords) on win, (False, []) otherwise.
    """
    if selected_patterns is None:
        active = _ALL_DIRS_5
    else:
        active = []
        if "LINE" in selected_patterns:
            active.extend(_LINE_DIRS)
        if "DIAGONAL" in selected_patterns:
            active.extend(_DIAG_DIRS)
        if not active:
            return False, []

    for dr, dc in active:

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


def find_path(board, player, target_len, directions, grid_size):
    """
    DFS search for a simple path of target_len connected cells belonging to player.
    Returns the path list if found, None otherwise.
    """
    memo = {}

    def dfs(r, c, path_set):
        if len(path_set) == target_len:
            return list(path_set)
        
        # We don't really need a full memo for "any path of length N" 
        # because the state includes the path_set (visited nodes in current path).
        # But for depth 10-15 on 5x5/7x7, simple backtracking is fine.
        
        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if (0 <= nr < grid_size and 0 <= nc < grid_size and 
                board[nr][nc] == player and (nr, nc) not in path_set):
                
                path_set.add((nr, nc))
                res = dfs(nr, nc, path_set)
                if res: return res
                path_set.remove((nr, nc))
        return None

    for r in range(grid_size):
        for c in range(grid_size):
            if board[r][c] == player:
                start_set = {(r, c)}
                res = dfs(r, c, start_set)
                if res: return res
    return None

# ================= LARGEST CONNECTED COMPONENT =================

def find_largest_component(board, player, directions, grid_size):
    """
    Flood-fill search for the largest contiguous blob belonging to player.
    Returns the maximum size found and the path list of that component.
    """
    visited = set()
    best_path = []
    max_size = 0

    for r in range(grid_size):
        for c in range(grid_size):
            if board[r][c] == player and (r, c) not in visited:
                queue = [(r, c)]
                visited.add((r, c))
                component_path = [(r, c)]

                while queue:
                    r0, c0 = queue.pop(0)

                    for dr, dc in directions:
                        nr = r0 + dr
                        nc = c0 + dc
                        if (0 <= nr < grid_size and 0 <= nc < grid_size and
                                board[nr][nc] == player and (nr, nc) not in visited):
                            visited.add((nr, nc))
                            queue.append((nr, nc))

                if len(component_path) > max_size:
                    max_size = len(component_path)
                    best_path = component_path

    return max_size, best_path

# ================= FULL-BOARD RESOLUTION =================

def resolve_full_board(board, directions, grid_size):
    """
    Called when the board is completely filled.
    Returns (winner_string, winner_line, p1_score, p2_score).
    Note: p1_score/p2_score are now 10 if path found, 0 otherwise (for simplicity).
    """
    p1_path = find_path(board, "P1", 10, directions, grid_size)
    p2_path = find_path(board, "P2", 10, directions, grid_size)

    p1_score = 10 if p1_path else 0
    p2_score = 10 if p2_path else 0

    if p1_path and not p2_path:
        return "P1", p1_path, p1_score, p2_score
    elif p2_path and not p1_path:
        return "P2", p2_path, p1_score, p2_score
    else:
        # Draw if both have path or neither has path
        return "DRAW", [], p1_score, p2_score