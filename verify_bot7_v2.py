import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.routers.bot import get_bot_move_7, generate_all_patterns_7

# Mock engine
class MockEngine:
    def __init__(self, board, player):
        self.board = board
        self.current_player = player
        self.grid_size = 7
        self.shiftable_patterns = generate_all_patterns_7(None) # Default all patterns

def test_bot_move():
    # 7x7 board
    board = [[None for _ in range(7)] for _ in range(7)]
    
    # Test 1: Opening move
    engine = MockEngine(board, "P1")
    move = get_bot_move_7(engine, "hard")
    print(f"Opening move: {move}", flush=True)
    
    # Test 2: Blocking a 7-in-a-row threat
    board[3] = ["P1", "P1", "P1", "P1", "P1", "P1", None] # 6 in a row
    engine = MockEngine(board, "P2")
    move = get_bot_move_7(engine, "hard")
    print(f"Block 7-in-a-row move: {move} (Expected (3, 6))", flush=True)
    
    # Test 3: Winning move
    board[4] = ["P1", "P1", "P1", "P1", "P1", "P1", None]
    engine = MockEngine(board, "P1")
    move = get_bot_move_7(engine, "hard")
    print(f"Winning move: {move} (Expected (4, 6))", flush=True)

if __name__ == "__main__":
    try:
        test_bot_move()
        print("\nVerification script finished successfully.", flush=True)
    except Exception as e:
        print(f"\nVerification failed with error: {e}")
        import traceback
        traceback.print_exc()
