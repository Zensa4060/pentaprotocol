import sys
import os

# Mock the compute_segment_points function as it is in room.py now
def compute_segment_points(history, segment_start=0):
    p1 = 0
    p2 = 0
    for item in history[segment_start:]:
        w = item["winner"] if isinstance(item, dict) else item
        if w == "P1": p1 += 1
        elif w == "P2": p2 += 1
    return p1, p2

# Mock the compute_series_winner function as it is in room.py now (FIXED)
def compute_series_winner(history, start_index=0, target_points=5):
    p1_pts, p2_pts = compute_segment_points(history, start_index)
    if p1_pts >= target_points:
        return "P1"
    if p2_pts >= target_points:
        return "P2"
    
    seg = history[start_index:]
    if len(seg) >= 9:
        if p1_pts > p2_pts:
            return "P1"
        if p2_pts > p1_pts:
            return "P2"
        return None # Protocolbreaker tie
        
    return None

def test():
    print("Testing compute_series_winner logic...")
    
    # Test case 1: P1 reaches 5 wins early
    hist1 = ["P1", "P1", "P1", "P1", "P1"]
    res1 = compute_series_winner(hist1)
    print(f"Test 1 (P1 wins early): Expected P1, Got {res1}")
    assert res1 == "P1"

    # Test case 2: P2 reaches 5 wins at game 8
    hist2 = ["P1", "P1", "P1", "P1", "P2", "P2", "P2", "P2", "P2"]
    res2 = compute_series_winner(hist2)
    print(f"Test 2 (P2 wins at game 9): Expected P2, Got {res2}")
    assert res2 == "P2"

    # Test case 3: Tie after 9 games (Protocolbreaker)
    hist3 = ["P1", "P2", "P1", "P2", "P1", "P2", "P1", "P2", "DRAW"]
    res3 = compute_series_winner(hist3)
    print(f"Test 3 (Tie at game 9): Expected None, Got {res3}")
    assert res3 is None

    # Test case 4: Segmented history (start_index = 3)
    # Total wins: P1=2, P2=2. In segment: P1=1, P2=0.
    hist4 = ["P1", "P2", "P2", "P1", "DRAW", "DRAW"]
    res4 = compute_series_winner(hist4, start_index=3)
    # Since win cap is 5, no one wins yet.
    print(f"Test 4 (Segmented): Expected None, Got {res4}")
    assert res4 is None

    # Test case 5: P1 wins in segment (target_points = 2)
    res5 = compute_series_winner(hist4, start_index=3, target_points=1)
    print(f"Test 5 (Segmented with target 1): Expected P1, Got {res5}")
    assert res5 == "P1"

    print("All tests passed!")

if __name__ == "__main__":
    test()
