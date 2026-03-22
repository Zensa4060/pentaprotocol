
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.routers.bot import get_bot_move_7, generate_all_patterns_7, _eval, BotEngine7

class EngineStub:
    def __init__(self, board, player, patterns):
        self.board = board
        self.current_player = player
        self.shiftable_patterns = patterns

def test_bot_decision():
    grid_size = 7
    board = [[None for _ in range(grid_size)] for _ in range(grid_size)]
    patterns = generate_all_patterns_7(["H", "L", "W", "V", "C", "zigzag"])
    
    engine = EngineStub(board, "P2", patterns)
    
    print("Evaluating specific moves at depth 0:")
    be = BotEngine7(patterns)
    
    # Eval move (0,0)
    b00 = [row[:] for row in board]
    b00[0][0] = "P2"
    e00 = _eval(b00, "P2", patterns, be.cell_uses)
    print(f"  (0,0) Eval: {e00}")
    
    # Eval move (3,3)
    b33 = [row[:] for row in board]
    b33[3][3] = "P2"
    e33 = _eval(b33, "P2", patterns, be.cell_uses)
    print(f"  (3,3) Eval: {e33}")
    
    # Eval move (5,5)
    b55 = [row[:] for row in board]
    b55[5][5] = "P2"
    e55 = _eval(b55, "P2", patterns, be.cell_uses)
    print(f"  (5,5) Eval: {e55}")

    print("\nCalling get_bot_move_7...")
    move = get_bot_move_7(engine, "hard")
    print(f"FINAL MOVE SELECTED: {move}")

if __name__ == "__main__":
    test_bot_decision()
