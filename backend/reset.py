from pymongo import MongoClient

def reset_all():
    client = MongoClient("mongodb://localhost:27017")
    db = client["pentaprotocol"]
    
    # Using independent updates for safety
    res1 = db.users.update_many({}, {"$set": {"wins": 0, "losses": 0, "unranked_wins": 0, "unranked_losses": 0, "draws": 0, "elo": 1000, "match_history": []}})
    print(f"Stats reset: {res1.modified_count}")
    
    res2 = db.matches.delete_many({})
    print(f"Matches deleted: {res2.deleted_count}")

reset_all()
