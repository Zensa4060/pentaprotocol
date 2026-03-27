import sys
import os
import copy

# Add the backend directory to sys.path
backend_dir = r"c:\Users\yagya\Documents\pentaprotocol\backend"
sys.path.append(backend_dir)

from app.routers.bot import bot_move, BotMoveRequest

def test_5x5():
    print("\n--- Testing 5x5 Bot Move ---")
    board = [[None for _ in range(5)] for _ in range(5)]
    req = BotMoveRequest(
        board=board,
        difficulty="medium",
        current_player="P1",
        board_mode="5x5",
        moves_played=0
    )
    try:
        res = bot_move(req)
        print(f"Result: {res}")
    except Exception as e:
        print(f"FAILED 5x5: {e}")
        import traceback
        traceback.print_exc()

def test_6x6_screenshot():
    print("\n--- Testing 6x6 Bot Move (Screenshot State) ---")
    board = [[None for _ in range(6)] for _ in range(6)]
    # P1 made move at C4 (r=3, c=2)
    board[3][2] = "P1"
    req = BotMoveRequest(
        board=board,
        difficulty="medium",
        current_player="P2",
        board_mode="6x6",
        moves_played=1
    )
    try:
        res = bot_move(req)
        print(f"Result: {res}")
    except Exception as e:
        print(f"FAILED 6x6 Screenshot: {e}")
        import traceback
        traceback.print_exc()

def test_7x7_robustness():
    print("\n--- Testing 7x7 Bot Move (Robustness) ---")
    board = [[None for _ in range(7)] for _ in range(7)]
    # Test lowercase, uppercase, and spaces
    req = BotMoveRequest(
        board=board,
        difficulty="hard",
        current_player="P1",
        board_mode="7x7",
        moves_played=0,
        selected_patterns=["Zigzag", " v ", "L"] 
    )
    try:
        res = bot_move(req)
        print(f"Result (Mixed Case): {res}")
    except Exception as e:
        print(f"FAILED 7x7 Robustness: {e}")
        import traceback
        traceback.print_exc()

def test_7x7_c3_blocked():
    print("\n--- Testing 7x7 Bot Move (C3 Blocked) ---")
    board = [[None for _ in range(7)] for _ in range(7)]
    req = BotMoveRequest(
        board=board,
        difficulty="hard",
        current_player="P1",
        board_mode="7x7",
        moves_played=0,
        c3_blocked=True
    )
    try:
        res = bot_move(req)
        print(f"Result (C3 Blocked): {res}")
    except Exception as e:
        print(f"FAILED 7x7 C3 Blocked: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_5x5()
    test_6x6_screenshot()
    test_7x7_robustness()
    test_7x7_c3_blocked()
