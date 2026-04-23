from fastapi import APIRouter, HTTPException, Depends
from app.models.game import CreateGame, MakeMove
from app.core.database import get_db
from app.game.engine import GameEngine
from app.game.ranked_penalties import record_ranked_match_completed_clean
from app.core import economy_watch
from bson import ObjectId
from datetime import datetime
router = APIRouter()

def xp_for_level(level: int) -> int:
    """
    New level formula: 1000 + (level-1)*500
    Level 1->2 required: 1000
    Level 2->3 required: 1500
    """
    if level <= 0:
        return 1000
    return 1000 + (level - 1) * 500

def add_xp(current_level: int, current_xp: int, gained_xp: int) -> tuple[int, int]:
    level = current_level if current_level else 1
    rem = current_xp + gained_xp
    while level < 1000 and rem >= xp_for_level(level):
        rem -= xp_for_level(level)
        level += 1
    if level >= 1000:
        level = 1000
        rem = 0
    return min(level, 1000), rem

def xp_for_result(result: str, mode: str = "multiplayer", difficulty: str = "medium") -> int:
    if mode == "bot":
        return {"easy": 10, "medium": 50, "hard": 100}.get(difficulty, 50)
    if result == "win":  return 1000
    if result == "draw": return 500
    if result == "loss": return 250
    return 0


def _draw_xp_from_total_time_ms(total_time_ms: int) -> int:
    # Default draw XP buckets based on total match time consumed by both players.
    total_seconds = max(0, int(total_time_ms or 0)) // 1000
    if total_seconds < 4 * 60:
        return 3700
    if total_seconds < 8 * 60:
        return 3850
    if total_seconds < 12 * 60:
        return 4000
    return 4200


def xp_for_series_outcome(result: str, format: str, rounds_list: list, total_time_ms: int = 0) -> int:
    """
    Multi-layer reward system:
    1. Base Series Outcome: Win 150 / Draw 100 / Loss 50
    2. Per-Round Bonus: Win 75 / Draw 50 / Loss 25
    """
    r = (result or "").lower()
    
    # 1. Base Series Outcome
    if r == "win":
        base = 150
    elif r == "draw":
        base = 100
    else:
        base = 50
        
    # 2. Per-Round Bonus
    round_sum = 0
    if isinstance(rounds_list, list):
        for item in rounds_list:
            # item can be a dict {'winner': 'P1', ...} or a string winner ID
            w = ""
            if isinstance(item, dict):
                w = str(item.get("winner") or "")
            else:
                w = str(item)
            
            # We don't know the player's perspective here yet? 
            # Wait, 'result' is the result for THIS player.
            # But the history is global (P1/P2). 
            # This function needs to know which player we are calculating for.
            pass

    # REVISION: xp_for_series_outcome is better handled inside award_ranked_match_result
    # where we know the user's ID and which slot they occupy.
    # For now, let's keep it simple and just return the base here, 
    # OR change the signature to include the player's perspective.
    return base

def expected_score(rating_a: int, rating_b: int) -> float:
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))

def new_elo(rating: int, opponent_rating: int, score: float, k: int = 32) -> int:
    expected = expected_score(rating, opponent_rating)
    return max(0, round(rating + k * (score - expected)))

# Rank bracket thresholds (kept in sync with frontend RANKS min values and
# backend get_rank). A loss that would drop a player *across* one of these
# thresholds for the first time clamps them to the threshold instead of
# deranking — giving one "buffer loss" per bracket. Rank-ups are unaffected.
_RANK_THRESHOLDS = (500, 1000, 1500, 2000, 2500)


def apply_derank_buffer(elo_old: int, elo_candidate: int, result: str) -> int:
    """Return the elo to store after a ranked match.

    Rules:
    - Only applies on losses (result == "loss").
    - If the player's current elo is *strictly* above a rank threshold and the
      loss would drop them below it, clamp to the threshold. The next loss,
      starting from the threshold, deranks normally.
    - Wins and draws are passed through unchanged.
    """
    if result != "loss" or elo_candidate >= elo_old:
        return elo_candidate
    for thr in _RANK_THRESHOLDS:
        if elo_old > thr and elo_candidate < thr:
            return thr
    return elo_candidate

# Cookie-first shared dependency (review F-03). Replaces the previous
# strict-Bearer-only implementation — the shared version still rejects
# missing / invalid tokens, and additionally accepts the HttpOnly
# ``pp_token`` cookie so callers don't need to attach an Authorization
# header when logged-in via cookie session.
from app.core.auth_dep import get_current_user  # noqa: F401 — re-exported


async def require_legal_accepted(user_id: str = Depends(get_current_user)) -> str:
    """Gate gameplay endpoints on the current legal-policy version.

    The client shows a modal, but a modified or bypassed client could
    otherwise skip it. We return 403 ``legal_required`` so the frontend
    can route the user into the acceptance flow exactly like it does on
    401 session-replaced.
    """
    try:
        from app.routers.auth import _user_needs_policy_gate
        from app.core.ids import user_object_id
        db = get_db()
        user = await db.users.find_one(
            {"_id": user_object_id(user_id)},
            {"legal_accepted": 1, "legal_accepted_version": 1},
        )
        if user and _user_needs_policy_gate(user):
            raise HTTPException(status_code=403, detail="legal_required")
    except HTTPException:
        raise
    except Exception:
        pass
    return user_id

async def award_game_result(db, game: dict, winner: str | None):
    p1_id      = game.get("player1_id")
    p2_id      = game.get("player2_id")
    is_ranked  = game.get("format") == "ranked"
    mode       = game.get("mode", "multiplayer")
    difficulty = game.get("difficulty", "medium")
    # Solo and singleplayer games do not count toward any profile stats
    if mode in ("solo", "singleplayer", "bot"):
        return

    # Ranked vs unranked (private friend rooms use the same labels as queue when format matches)
    career_mode = "ranked" if is_ranked else "unranked"

    # Pre-fetch both players for ELO-before snapshot
    p1_user = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    p2_user = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None

    async def update_player(user_id: str, result: str, opponent_id: str | None):
        if not user_id:
            return
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return
        gained_xp    = xp_for_result(result, mode, difficulty)
        new_level, new_xp = add_xp(user.get("level", 1), user.get("xp", 0), gained_xp)
        inc = {}
        if career_mode == "unranked":
            if result == "win":  inc["unranked_wins"]   = 1
            if result == "loss": inc["unranked_losses"] = 1
            if result == "draw": inc["draws"]           = 1
        else:
            # Ranked - Re-enabled
            if result == "win":  inc["wins"]   = 1
            if result == "loss": inc["losses"] = 1
            if result == "draw": inc["draws"]  = 1

        updates = {"xp": new_xp, "level": new_level}
        # ELO changes apply to ranked PvP only; unranked uses unranked_wins/losses without ELO.
        if is_ranked and opponent_id and mode != "bot":
            # Elo updates re-enabled for ranked
            opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})
            if opponent:
                score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
                mmr_old = int(user.get("hidden_mmr", 500))
                mmr_new = new_elo(mmr_old, int(opponent.get("hidden_mmr", 500)), score)
                updates["hidden_mmr"] = mmr_new
                # Displayed ELO applies derank-buffer: a loss that would cross a
                # rank threshold downward clamps to the threshold first (one
                # grace loss per bracket). Wins / draws pass through unchanged.
                elo_old = int(user.get("elo") if user.get("elo") is not None else mmr_old)
                elo_candidate = elo_old + (mmr_new - mmr_old)
                elo_new = apply_derank_buffer(elo_old, elo_candidate, result)
                updates["elo"] = elo_new
                updates["ranked_rating"] = elo_new
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates, "$inc": inc})

    w = (winner or "").upper()
    if w == "P1":
        await update_player(p1_id, "win",  p2_id)
        await update_player(p2_id, "loss", p1_id)
    elif w == "P2":
        await update_player(p1_id, "loss", p2_id)
        await update_player(p2_id, "win",  p1_id)
    elif w == "DRAW":
        await update_player(p1_id, "draw", p2_id)
        await update_player(p2_id, "draw", p1_id)

    # ── Log match history for each player (multiplayer only) ──────────────
    async def log_match(user_id, opponent_id, result, user_snap, opp_snap):
        if not user_id:
            return
        user_id = str(user_id)
        opponent_id = str(opponent_id) if opponent_id else None
        if not user_snap:
            user_snap = await db.users.find_one({"_id": ObjectId(user_id)})
        if opponent_id and not opp_snap:
            opp_snap = await db.users.find_one({"_id": ObjectId(opponent_id)})
        if not user_snap:
            return
        elo_before = user_snap.get("elo", 100)
        # Re-read to get the post-update ELO
        updated = await db.users.find_one({"_id": ObjectId(user_id)})
        elo_after = updated.get("elo", elo_before) if updated else elo_before
        doc = {
            "user_id":            user_id,
            "opponent_id":        opponent_id,
            "opponent_username":  (opp_snap or {}).get("username", "Unknown"),
            "opponent_elo":       (opp_snap or {}).get("elo", 100),
            "result":             result,
            "elo_before":         elo_before,
            "elo_after":          elo_after,
            "elo_delta":          elo_after - elo_before,
            "mode":               career_mode,
            "played_at":          datetime.utcnow(),
        }
        bp = game.get("rb_banned_pattern_7x7")
        if isinstance(bp, str) and bp.strip():
            doc["banned_pattern_7x7"] = bp.strip()
            doc["board_mode"] = game.get("board_mode", "7x7")
            doc["game_number"] = game.get("game_number")
        await db.match_history.insert_one(doc)

    if w == "P1":
        await log_match(p1_id, p2_id, "win",  p1_user, p2_user)
        await log_match(p2_id, p1_id, "loss", p2_user, p1_user)
    elif w == "P2":
        await log_match(p1_id, p2_id, "loss", p1_user, p2_user)
        await log_match(p2_id, p1_id, "win",  p2_user, p1_user)
    elif w == "DRAW":
        await log_match(p1_id, p2_id, "draw", p1_user, p2_user)
        await log_match(p2_id, p1_id, "draw", p2_user, p1_user)


async def award_ranked_match_result(
    db, game: dict, winner: str | None, *, record_clean_streak: bool = True, surrendered_by: str | None = None
):
    """
    Standard match outcome for both Ranked and Unranked modes.
    Follows the "First-to-3" win condition.
    """
    p1_id = game.get("player1_id")
    p2_id = game.get("player2_id")
    fmt = game.get("format", "unranked")
    if game.get("source") == "private":
        fmt = "custom"
    is_ranked = (fmt == "ranked")

    mode = game.get("mode", "multiplayer")
    difficulty = game.get("difficulty", "medium")
    
    p1_user = await db.users.find_one({"_id": ObjectId(p1_id)}) if p1_id else None
    p2_user = await db.users.find_one({"_id": ObjectId(p2_id)}) if p2_id else None

    rounds_list = game.get("match_rounds") or []
    num_rounds = max(1, min(9, len(rounds_list))) if isinstance(rounds_list, list) else 1
    total_time_ms = int(game.get("total_time_ms", 0) or 0)
    p1_time_used_ms = int(game.get("p1_time_used_ms", 0) or 0)
    p2_time_used_ms = int(game.get("p2_time_used_ms", 0) or 0)

    async def update_player(user_id: str, result: str, opponent_id: str | None):
        if not user_id: return
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user: return
        
        # Calculate multi-layer XP
        # 1. Base Series Outcome
        gained_xp = 150 if result == "win" else (100 if result == "draw" else 50)
        
        # 2. Per-Round Performance Bonus
        my_slot = "P1" if user_id == p1_id else "P2"
        for item in rounds_list:
            w = str(item.get("winner") if isinstance(item, dict) else item)
            if w == my_slot:
                gained_xp += 75
            elif w == "DRAW":
                gained_xp += 50
            else:
                gained_xp += 25

        new_level, new_xp = add_xp(user.get("level", 1), user.get("xp", 0), gained_xp)
        
        inc = {}
        if is_ranked:
            if result == "win": inc["wins"] = 1
            elif result == "loss": inc["losses"] = 1
            elif result == "draw": inc["draws"] = 1
        else:
            if result == "win": inc["unranked_wins"] = 1
            elif result == "loss": inc["unranked_losses"] = 1
            elif result == "draw": inc["draws"] = 1
        
        updates = {"xp": new_xp, "level": new_level}
        
        # Only update ELO/RR for ranked matches
        if is_ranked and opponent_id and mode != "bot":
            opponent = await db.users.find_one({"_id": ObjectId(opponent_id)})
            if opponent:
                score = 1.0 if result == "win" else (0.5 if result == "draw" else 0.0)
                mmr_old = int(user.get("hidden_mmr", 500))
                opp_mmr = int(opponent.get("hidden_mmr", 500))
                
                pl_matches = user.get("placement_matches", 0)
                # Placement logic: higher K-factor for first 5 matches
                k_p1 = 100 if pl_matches < 5 else 32
                
                mmr_new = new_elo(mmr_old, opp_mmr, score, k=k_p1)
                updates["hidden_mmr"] = mmr_new
                # Displayed ELO follows hidden_mmr but with a one-loss "derank
                # buffer" at each rank threshold (500/1000/.../2500). A loss
                # that would cross a threshold downward clamps the player to
                # the threshold first; the next loss actually deranks.
                elo_old = int(user.get("elo") if user.get("elo") is not None else mmr_old)
                elo_candidate = elo_old + (mmr_new - mmr_old)
                elo_new = apply_derank_buffer(elo_old, elo_candidate, result)
                updates["elo"] = elo_new
                updates["ranked_rating"] = elo_new

                if pl_matches < 5:
                    updates["placement_matches"] = pl_matches + 1

        # Phase 2.6 — if this user is shadow-banned, route ranked deltas to
        # shadow_rating and freeze their mainline elo / mmr / placement.
        try:
            from app.core import anticheat_heuristics as _ach
            updates = _ach.apply_shadow_rating_policy(user, updates)
        except Exception:
            pass

        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates, "$inc": inc})
        try:
            await economy_watch.record_match_reward(
                db,
                user_id=str(user_id),
                xp=int(gained_xp or 0),
                shards=0,
                room_code=None,
            )
        except Exception:
            pass

    w = (winner or "").upper()
    if w == "P1":
        await update_player(p1_id, "win", p2_id)
        await update_player(p2_id, "loss", p1_id)
    elif w == "P2":
        await update_player(p1_id, "loss", p2_id)
        await update_player(p2_id, "win", p1_id)
    elif w == "DRAW":
        await update_player(p1_id, "draw", p2_id)
        await update_player(p2_id, "draw", p1_id)

    async def log_match(user_id, opponent_id, result, user_snap, opp_snap):
        if not user_id:
            return None
        u_id_str = str(user_id)
        o_id_str = str(opponent_id) if opponent_id else None
        if not user_snap:
            user_snap = await db.users.find_one({"_id": ObjectId(u_id_str)})
        if o_id_str and not opp_snap:
            opp_snap = await db.users.find_one({"_id": ObjectId(o_id_str)})
        if not user_snap:
            return None
        
        # Ensure IDs are strings for consistent MongoDB querying (JWT uses string sub)
        elo_before = user_snap.get("elo")
        updated = await db.users.find_one({"_id": ObjectId(u_id_str)})
        elo_after = updated.get("elo") if updated else elo_before
        
        doc = {
            "user_id":            u_id_str,
            "opponent_id":        o_id_str,
            "opponent_username":  (opp_snap or {}).get("username", "Unknown"),
            "opponent_elo":       (opp_snap or {}).get("elo") if opp_snap else None,
            "result":             result,
            "elo_before":         elo_before,
            "elo_after":          elo_after,
            "elo_delta":          ((elo_after or 0) - (elo_before or 0)) if is_ranked else 0,
            "was_placement":      (user_snap.get("placement_matches", 0) < 5) if is_ranked else False,
            "placement_matches":  user_snap.get("placement_matches", 0) if is_ranked else 0,
            "mode":               fmt,
            "played_at":          datetime.utcnow(),
            "my_slot":            "P1" if user_id == p1_id else "P2",
            "match_scope":        "full_match",
            "board_mode":         game.get("board_mode"),
            "board_mode_full":    game.get("board_mode_full"),
            "match_rounds":       game.get("match_rounds", []),
            "protocolbreaker_played": bool(game.get("protocolbreaker_played") or game.get("limitbreaker_played")),
            "limitbreaker_played": bool(game.get("protocolbreaker_played") or game.get("limitbreaker_played")),
            "surrendered_by":         surrendered_by,
            "p1_time_used_ms":        p1_time_used_ms,
            "p2_time_used_ms":        p2_time_used_ms,
        }
        ins = await db.match_history.insert_one(doc)
        return str(ins.inserted_id)

    p1_career_entry_id = None
    p2_career_entry_id = None
    if w == "P1":
        p1_career_entry_id = await log_match(p1_id, p2_id, "win", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "loss", p2_user, p1_user)
    elif w == "P2":
        p1_career_entry_id = await log_match(p1_id, p2_id, "loss", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "win", p2_user, p1_user)
    elif w == "DRAW":
        p1_career_entry_id = await log_match(p1_id, p2_id, "draw", p1_user, p2_user)
        p2_career_entry_id = await log_match(p2_id, p1_id, "draw", p2_user, p1_user)

    if record_clean_streak:
        if p1_id:
            await record_ranked_match_completed_clean(db, p1_id)
        if p2_id:
            await record_ranked_match_completed_clean(db, p2_id)
    elif winner in ("P1", "P2"):
        wid = p1_id if winner == "P1" else p2_id
        if wid:
            await record_ranked_match_completed_clean(db, wid)

    return {
        "p1_career_entry_id": p1_career_entry_id,
        "p2_career_entry_id": p2_career_entry_id,
    }


@router.post("/create")
async def create_game(data: CreateGame, user_id: str = Depends(require_legal_accepted)):
    db = get_db()
    engine = GameEngine()
    game = {
        "board":          engine.board,
        "current_player": "P1",
        "status":         "active",
        "winner":         None,
        "mode":           data.mode,
        "format":         data.format,
        "difficulty":     getattr(data, "difficulty", "medium"),
        "moves_played":   0,
        "extra_turns":    0,
        "player1_id":     user_id,
        "player2_id":     None,
        "created_at":     datetime.utcnow(),
    }
    result = await db.games.insert_one(game)
    return {
        "game_id":        str(result.inserted_id),
        "board":          engine.board,
        "current_player": "P1",
        "status":         "active",
        "mode":           data.mode,
        "moves_played":   0,
        "winner":         None,
    }

@router.post("/move")
async def make_move(data: MakeMove, user_id: str = Depends(require_legal_accepted)):
    db = get_db()
    try:
        game_oid = ObjectId(data.game_id)
    except Exception:
        raise HTTPException(400, "Invalid game id")
    game = await db.games.find_one({"_id": game_oid})
    if not game:
        raise HTTPException(404, "Game not found")

    # Participation check — only the player(s) on the game can make a move.
    # player1_id is always set; player2_id is None for solo / bot modes.
    p1 = str(game.get("player1_id")) if game.get("player1_id") is not None else None
    p2 = str(game.get("player2_id")) if game.get("player2_id") is not None else None
    participants = {x for x in (p1, p2) if x}
    if user_id not in participants:
        raise HTTPException(403, "Not a participant in this game")

    if game["status"] != "active":
        return {
            "game_id":        data.game_id,
            "board":          game["board"],
            "current_player": game["current_player"],
            "moves_played":   game["moves_played"],
            "extra_turns":    game.get("extra_turns", 0),
            "status":         game["status"],
            "winner":         game["winner"],
            "mode":           game["mode"],
        }
    engine = GameEngine()
    engine.board          = game["board"]
    engine.current_player = game["current_player"]
    engine.moves_played   = game["moves_played"]
    engine.extra_turns    = game.get("extra_turns", 0)
    result = engine.deploy(data.row, data.col)
    is_finished = bool(result["winner"])
    update = {
        "board":          engine.board,
        "current_player": engine.current_player,
        "moves_played":   engine.moves_played,
        "extra_turns":    engine.extra_turns,
        "status":         "finished" if is_finished else "active",
        "winner":         result.get("winner"),
    }
    await db.games.update_one({"_id": ObjectId(data.game_id)}, {"$set": update})
    if is_finished:
        await award_game_result(db, game, result.get("winner"))
    return {"game_id": data.game_id, **update, "mode": game["mode"]}

@router.get("/{game_id}")
async def get_game(game_id: str, user_id: str = Depends(get_current_user)):
    db = get_db()
    try:
        game_oid = ObjectId(game_id)
    except Exception:
        raise HTTPException(400, "Invalid game id")
    game = await db.games.find_one({"_id": game_oid})
    if not game:
        raise HTTPException(404, "Game not found")

    # Participation check — only the player(s) on the game may read it.
    p1 = str(game.get("player1_id")) if game.get("player1_id") is not None else None
    p2 = str(game.get("player2_id")) if game.get("player2_id") is not None else None
    participants = {x for x in (p1, p2) if x}
    if user_id not in participants:
        raise HTTPException(403, "Not a participant in this game")

    return {
        "game_id":        str(game["_id"]),
        "board":          game["board"],
        "current_player": game["current_player"],
        "status":         game["status"],
        "winner":         game["winner"],
        "mode":           game["mode"],
        "moves_played":   game["moves_played"],
        "extra_turns":    game.get("extra_turns", 0),
    }