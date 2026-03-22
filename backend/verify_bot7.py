import sys
import os

# Add the backend directory to sys.path
backend_dir = r"c:\Users\yagya\Documents\pentaprotocol\backend"
sys.path.append(backend_dir)

import copy
from app.routers.bot import get_bot_move_7, BotEngine7
from app.core.patterns7 import generate_all_patterns_7

def print_board(board):
    for row in board:
        print(" ".join([("X" if x == "P1" else "O" if x == "P2" else ".") for x in row]))

def test_blocking_connection():
    print("\n--- Test 1: Blocking Opponent 20-point Connection ---")
    board = [[None for _ in range(7)] for _ in range(7)]
    # Opponent (P2) has a long horizontal line (6 pieces)
    for i in range(1, 7):
        board[3][i] = "P2"
    
    # Player (P1) is the bot
    class EngineStub:
        def __init__(self, board, current_player, patterns):
            self.board = board
            self.current_player = current_player
            self.shiftable_patterns = patterns

    patterns = generate_all_patterns_7([])
    engine = EngineStub(board, "P1", patterns)
    
    move = get_bot_move_7(engine, "hard")
    print("Board state:")
    print_board(board)
    print(f"Bot (P1) picks move: {move}")
    
    # Bot should block at (3, 0) or (3, 7) - wait, (3, 0) or (3, 6)?
    # Grid is 0-6. Line is (3,1) to (3,6). Blocking (3,0) or (3,6) is already taken?
    # Let's adjust. Line: (3,1), (3,2), (3,3), (3,4), (3,5)
    board = [[None for _ in range(7)] for _ in range(7)]
    for i in range(1, 6): board[3][i] = "P2"
    engine.board = board
    move = get_bot_move_7(engine, "hard")
    print("New board state (5 pieces in row):")
    print_board(board)
    print(f"Bot (P1) picks move: {move}")
    
    # It should play near the line or block.

def test_full_board_usage():
    print("\n--- Test 2: Full Board Usage (Reduced Center Bias) ---")
    board = [[None for _ in range(7)] for _ in range(7)]
    # Bot (P1) has pieces far from center
    board[0][0] = "P1"
    board[6][6] = "P1"
    
    class EngineStub:
        def __init__(self, board, current_player, patterns):
            self.board = board
            self.current_player = current_player
            self.shiftable_patterns = patterns
            
    patterns = generate_all_patterns_7([])
    engine = EngineStub(board, "P1", patterns)
    
    move = get_bot_move_7(engine, "hard")
    print("Board state:")
    print_board(board)
    print(f"Bot (P1) picks move: {move}")
    # If the bot is still center-biased, it will ignore its own pieces at edges.
    # With path-potential, it should consider growing the edge connections.

def test_pattern_blocking():
    print("\n--- Test 3: Aggressive Pattern Blocking ---")
    board = [[None for _ in range(7)] for _ in range(7)]
    # Opponent (P2) is completing a pattern (e.g., Square 2x2, but we need to know the selected patterns)
    # Let's use standard patterns.
    # Pattern 0 in generate_all_patterns_7 is a L-shape or something?
    # Let's just create a board where P2 has multiple pieces that form a threat.
    board[2][2] = "P2"
    board[2][3] = "P2"
    board[3][2] = "P2"
    
    class EngineStub:
        def __init__(self, board, current_player, patterns):
            self.board = board
            self.current_player = current_player
            self.shiftable_patterns = patterns
            
    patterns = generate_all_patterns_7([]) # All patterns
    engine = EngineStub(board, "P1", patterns)
    
    move = get_bot_move_7(engine, "hard")
    print("Board state (P2 near pattern completion):")
    print_board(board)
    print(f"Bot (P1) picks move: {move}")

if __name__ == "__main__":
    test_blocking_connection()
    test_full_board_usage()
    test_pattern_blocking()
