import sys
import os

# Add the backend directory to sys.path
backend_dir = r"c:\Users\yagya\Documents\pentaprotocol\backend"
sys.path.append(backend_dir)

import copy
import random
from app.routers.bot import BotEngine6
from app.core.patterns6 import generate_all_patterns_6

def print_board(board):
    for row in board:
        print(" ".join([("X" if x == "P1" else "O" if x == "P2" else ".") for x in row]))

def test_6x6_win_detection():
    print("\n--- Test 1: 6x6 Win Detection (6-in-a-line) ---")
    board = [[None for _ in range(6)] for _ in range(6)]
    # Bot (P2) has 5 pieces in a row, should pick the 6th
    for i in range(5):
        board[0][i] = "P2"
    
    patterns = generate_all_patterns_6()
    engine = BotEngine6(patterns)
    
    move = engine.choose(board, "P2", "P1", "hard")
    print("Board state:")
    print_board(board)
    print(f"Bot (P2) picks move: {move}")
    
    if move == (0, 5):
        print("SUCCESS: Bot detected the win!")
    else:
        print(f"FAILURE: Bot missed the win at (0, 5). Picked {move} instead.")

def test_6x6_blocking():
    print("\n--- Test 2: 6x6 Blocking Opponent ---")
    board = [[None for _ in range(6)] for _ in range(6)]
    # Opponent (P1) has 5 pieces in a row, Bot (P2) should block
    for i in range(1, 6):
        board[2][i] = "P1"
    
    patterns = generate_all_patterns_6()
    engine = BotEngine6(patterns)
    
    move = engine.choose(board, "P2", "P1", "hard")
    print("Board state:")
    print_board(board)
    print(f"Bot (P2) picks move: {move}")
    
    if move == (2, 0):
        print("SUCCESS: Bot blocked the opponent!")
    else:
        print(f"FAILURE: Bot failed to block at (2, 0). Picked {move} instead.")

def test_6x6_pattern_win():
    print("\n--- Test 3: 6x6 Pattern Win (ZZ Pattern) ---")
    board = [[None for _ in range(6)] for _ in range(6)]
    # ZZ pattern: (0,0), (1,1), (0,2), (1,3), (0,4), (1,5)
    # Bot (P2) has 5 of 6 pieces
    pats = [(0, 0), (1, 1), (0, 2), (1, 3), (0, 4)]
    for r, c in pats:
        board[r][c] = "P2"
    
    patterns = generate_all_patterns_6()
    engine = BotEngine6(patterns)
    
    move = engine.choose(board, "P2", "P1", "hard")
    print("Board state:")
    print_board(board)
    print(f"Bot (P2) picks move: {move}")
    
    if move == (1, 5):
        print("SUCCESS: Bot detected the pattern win!")
    else:
        print(f"FAILURE: Bot missed the pattern win at (1, 5). Picked {move} instead.")

if __name__ == "__main__":
    test_6x6_win_detection()
    test_6x6_blocking()
    test_6x6_pattern_win()
