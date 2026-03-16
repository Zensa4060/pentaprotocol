import os
from pymongo import MongoClient

def reset_all():
    # Use environment variable if available, otherwise default to local
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = MongoClient(mongo_uri)
    db = client["pentaprotocol"]
    
    print("Starting profile reset...")
    
    users = list(db.users.find({}))
    total_users = len(users)
    print(f"Processing {total_users} users...")
    
    for user in users:
        # Calculate total unranked games
        unranked_wins = user.get("unranked_wins", 0)
        unranked_losses = user.get("unranked_losses", 0)
        total_unranked = unranked_wins + unranked_losses
        
        # Prepare updates
        # Preserves: coins, shards, protocredits, bio, avatar, created_at, totp_enabled, etc.
        updates = {
            "$set": {
                "wins": 0,
                "losses": 0,
                "draws": 0,
                "elo": 100,
                "xp": 0,
                "level": 1,
            },
            "$inc": {
                "unranked_wins": total_unranked,
                "unranked_losses": total_unranked
            }
        }
        
        db.users.update_one({"_id": user["_id"]}, updates)
    
    print(f"Stats reset for {total_users} users.")
    
    # Clear collections that should be reset entirely
    res_matches = db.matches.delete_many({})
    print(f"Matches deleted: {res_matches.deleted_count}")
    
    # Also clear match_history if it's a separate collection (seen in profile.py)
    res_history = db.match_history.delete_many({})
    print(f"Match history deleted: {res_history.deleted_count}")

if __name__ == "__main__":
    reset_all()
