import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.routers.bot import BotEngine6
from app.core.patterns6 import generate_all_patterns_6

def test_d4_opening():
    print("\n--- Testing D4 Opening Parity ---")
    # 6x6 board
    board_2d = [[None for _ in range(6)] for _ in range(6)]
    # User plays D4 (row 3, col 3) e.g. (3,3) in 0-indexed
    # In the screenshot it looks like Row 4, Col D. 
    # Row 4 -> 3, Col D -> 3. Correct.
    board_2d[3][3] = "P1"
    
    patterns = generate_all_patterns_6()
    engine = BotEngine6(patterns)
    
    # We want the bot (P2) to play like the "local host" (Rust)
    # The screenshot shows the local bot picked C3 (row 2, col 2)
    # The server (old python) picked E5 (row 4, col 4)
    
    move = engine.choose(board_2d, "P2", "P1", "hard")
    
    print(f"User play: D4 (3, 3)")
    print(f"Bot (P2) picks: {move}")
    
    if move == (2, 2):
        print("SUCCESS: Python bot matches Rust move (C3/2,2)!")
    else:
        print(f"OBSERVATION: Python bot picked {move}. Rust picked (2,2).")

if __name__ == "__main__":
    test_d4_opening()
