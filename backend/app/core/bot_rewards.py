"""Bot unlock chain + XP reward tables.

Must stay in sync with `frontend/lib/botRewards.ts`. The frontend declares which
bot IDs exist and what their unlock chain / prize table is; this backend file
is the authoritative source when awarding XP so the client cannot tamper.
"""
from __future__ import annotations

from typing import Dict, List, Optional


BOT_CHAIN_5X5: List[str] = ["baltazar", "salazar", "jr"]
BOT_CHAIN_6X6: List[str] = ["valdorin", "eldorin", "him"]
BOT_CHAIN_7X7: List[str] = ["seraphina", "regina", "her"]

BOT_CHAINS: Dict[str, List[str]] = {
    "5x5": BOT_CHAIN_5X5,
    "6x6": BOT_CHAIN_6X6,
    "7x7": BOT_CHAIN_7X7,
}

ALL_BOT_IDS: List[str] = [
    *BOT_CHAIN_5X5,
    *BOT_CHAIN_6X6,
    *BOT_CHAIN_7X7,
]

BOT_XP_REWARD: Dict[str, int] = {
    "baltazar":  1000,
    "salazar":   2000,
    "jr":        4000,
    "valdorin":  5000,
    "eldorin":   8000,
    "him":      10000,
    "seraphina": 6000,
    "regina":   10000,
    "her":      15000,
}


# Tier-capstone free-item rewards.
# Defeating each chain's final bot unlocks a single free-item pick:
#   jr  → one free banner of choice
#   him → one free coin-toss skin
#   her → one free board skin
# Each reward slot state cycles: None → "pending" → "claimed".
BOT_REWARD_SLOT: Dict[str, str] = {
    "jr":  "banner",
    "him": "coin_toss",
    "her": "board_skin",
}

REWARD_SLOTS = ("banner", "coin_toss", "board_skin")


def reward_slot_for_bot(bot_id: str) -> Optional[str]:
    return BOT_REWARD_SLOT.get(bot_id)


def prerequisite_bot(bot_id: str) -> Optional[str]:
    for chain in BOT_CHAINS.values():
        if bot_id in chain:
            idx = chain.index(bot_id)
            return chain[idx - 1] if idx > 0 else None
    return None


def bot_board_mode(bot_id: str) -> Optional[str]:
    for mode, chain in BOT_CHAINS.items():
        if bot_id in chain:
            return mode
    return None


def has_defeated(defeats: Dict[str, bool], bot_id: str) -> bool:
    return bool(defeats.get(bot_id))


def is_board_mode_unlocked(defeats: Dict[str, bool], mode: str) -> bool:
    if mode == "5x5":
        return True
    if mode == "6x6":
        return has_defeated(defeats, "jr")
    if mode == "7x7":
        return has_defeated(defeats, "him")
    return False


def is_bot_unlocked(defeats: Dict[str, bool], bot_id: str) -> bool:
    mode = bot_board_mode(bot_id)
    if mode is None:
        return False
    if not is_board_mode_unlocked(defeats, mode):
        return False
    prev = prerequisite_bot(bot_id)
    if prev is None:
        return True
    return has_defeated(defeats, prev)


def all_bots_defeated(defeats: Dict[str, bool]) -> bool:
    return all(bool(defeats.get(b)) for b in ALL_BOT_IDS)


def is_valid_bot_id(bot_id: str) -> bool:
    return bot_id in BOT_XP_REWARD
