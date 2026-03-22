
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.routers.bot import get_bot_move_7, generate_all_patterns_7

class EngineStub:
    def __init__(self, board, player, patterns):
        self.board = board
        self.current_player = player
        self.shiftable_patterns = patterns

def test_bot_coverage():
    grid_size = 7
    board = [[None for _ in range(grid_size)] for _ in range(grid_size)]
    patterns = generate_all_patterns_7(["H", "L", "W", "V", "C", "zigzag"])
    
    engine = EngineStub(board, "P2", patterns)
    
    # Try multiple moves and see where they land
    moves = []
    temp_board = [row[:] for row in board]
    for i in range(10):
        move = get_bot_move_7(engine, "hard")
        if move:
            r, c = move
            moves.append(move)
            temp_board[r][c] = "P2"
            engine.board = [row[:] for row in temp_board]
        else:
            break
            
    print(f"Moves selected: {moves}")
    
    # Check if any move is in the outer ring (row 0, 6 or col 0, 6)
    outer = [m for m in moves if m[0] in [0, 6] or m[1] in [0, 6]]
    print(f"Outer ring moves: {outer}")

if __name__ == "__main__":
    test_bot_coverage()
