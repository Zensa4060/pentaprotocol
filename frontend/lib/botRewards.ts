/**
 * Bot-reward / unlock chain for AI matches.
 *
 * Unlock chains (sequential within each board size):
 *   5x5 : baltazar → salazar → jr
 *   6x6 : valdorin → eldorin → him   (locked until 5x5 cleared)
 *   7x7 : seraphina → regina → her   (locked until 6x6 cleared)
 *
 * XP rewards are granted ONCE on the first series victory against each bot.
 *
 * Tier-capstone bots also unlock a one-time free-item pick from the store:
 *   jr  → one banner           (from STORE_BANNERS)
 *   him → one coin-toss skin   (from COIN_BUNDLES)
 *   her → one board skin       (from BUNDLES boardIds)
 *
 * The backend (`backend/app/core/bot_rewards.py`) MUST mirror these tables —
 * both are read when awarding XP and validating claims. Keep in sync.
 */

import type { BoardMode } from "@/lib/types";

/** Only the three pure board sizes have a bot roster. */
export type BotBoardMode = "5x5" | "6x6" | "7x7";

export type BotId =
  | "baltazar" | "salazar"   | "jr"
  | "valdorin" | "eldorin"   | "him"
  | "seraphina"| "regina"    | "her";

export const BOT_CHAIN_5X5: BotId[] = ["baltazar", "salazar", "jr"];
export const BOT_CHAIN_6X6: BotId[] = ["valdorin", "eldorin", "him"];
export const BOT_CHAIN_7X7: BotId[] = ["seraphina", "regina", "her"];

export const BOT_CHAINS: Record<BotBoardMode, BotId[]> = {
  "5x5": BOT_CHAIN_5X5,
  "6x6": BOT_CHAIN_6X6,
  "7x7": BOT_CHAIN_7X7,
};

export const ALL_BOT_IDS: BotId[] = [
  ...BOT_CHAIN_5X5,
  ...BOT_CHAIN_6X6,
  ...BOT_CHAIN_7X7,
];

/** XP awarded the first time each bot's series is won. */
export const BOT_XP_REWARD: Record<BotId, number> = {
  baltazar:  1000,
  salazar:   2000,
  jr:        4000,
  valdorin:  5000,
  eldorin:   8000,
  him:      10000,
  seraphina: 6000,
  regina:   10000,
  her:      15000,
};

/** Display label shown in the AI picker (mirrors AIScreen labels). */
export const BOT_LABEL: Record<BotId, string> = {
  baltazar:  "BALTAZAR",
  salazar:   "SALAZAR",
  jr:        "JR.",
  valdorin:  "VALDORIN",
  eldorin:   "ELDORIN",
  him:       "HIM",
  seraphina: "SERAPHINA",
  regina:    "REGINA",
  her:       "HER",
};

/** The bot immediately before `botId` in its chain (null if first in chain). */
export function prerequisiteBot(botId: BotId): BotId | null {
  for (const chain of Object.values(BOT_CHAINS)) {
    const idx = chain.indexOf(botId);
    if (idx > 0) return chain[idx - 1];
    if (idx === 0) return null;
  }
  return null;
}

/** Which board-mode chain a bot belongs to. */
export function botBoardMode(botId: BotId): BotBoardMode | null {
  for (const [mode, chain] of Object.entries(BOT_CHAINS) as [BotBoardMode, BotId[]][]) {
    if (chain.includes(botId)) return mode;
  }
  return null;
}

/** Did the player defeat `botId` (reads the user's server-persisted set)? */
export function hasDefeated(defeated: Record<string, boolean> | undefined, botId: BotId): boolean {
  if (!defeated) return false;
  return !!defeated[botId];
}

/**
 * A bot is "unlocked" iff:
 *   - it is the first bot in its chain AND the chain itself is unlocked, OR
 *   - the immediately prior bot in its chain has been defeated AND the chain is unlocked.
 *
 * Chain-level unlocks:
 *   - 5x5 chain: always unlocked.
 *   - 6x6 chain: unlocked after `jr` is defeated.
 *   - 7x7 chain: unlocked after `him` is defeated.
 */
export function isBotUnlocked(
  defeated: Record<string, boolean> | undefined,
  botId: BotId,
): boolean {
  const mode = botBoardMode(botId);
  if (!mode) return false;
  if (!isBoardModeUnlocked(defeated, mode)) return false;
  const prev = prerequisiteBot(botId);
  if (!prev) return true;
  return hasDefeated(defeated, prev);
}

/** Can the user even enter this board-mode chain? */
export function isBoardModeUnlocked(
  defeated: Record<string, boolean> | undefined,
  mode: BoardMode,
): boolean {
  if (mode === "5x5") return true;
  if (mode === "6x6") return hasDefeated(defeated, "jr");
  if (mode === "7x7") return hasDefeated(defeated, "him");
  // Combined-pattern modes (e.g. "5x5_6x6") are only used in multiplayer
  // variants — bots never run in those, so treat as locked.
  return false;
}

/** True if every bot has been defeated. */
export function allBotsDefeated(defeated: Record<string, boolean> | undefined): boolean {
  if (!defeated) return false;
  return ALL_BOT_IDS.every((id) => !!defeated[id]);
}

/** Gate-keeper label shown on a locked bot card. */
export function lockedByLabel(botId: BotId): string | null {
  const prev = prerequisiteBot(botId);
  if (prev) return BOT_LABEL[prev];
  const mode = botBoardMode(botId);
  if (mode === "6x6") return BOT_LABEL.jr;
  if (mode === "7x7") return BOT_LABEL.him;
  return null;
}

/** Friendly XP reward formatting (e.g. `+1,000 XP`). */
export function formatXpPrize(botId: BotId): string {
  return `+${BOT_XP_REWARD[botId].toLocaleString()} XP`;
}

// ── Tier-capstone free-item rewards ────────────────────────────────────────
/** Per-slot reward state the backend persists on the user profile. */
export type BotRewardSlot = "banner" | "coin_toss" | "board_skin";
export type BotRewardState = null | "pending" | "claimed";
export type BotRewards = Record<BotRewardSlot, BotRewardState>;

/** Which capstone bot awards which reward slot. */
export const BOT_REWARD_SLOT: Partial<Record<BotId, BotRewardSlot>> = {
  jr:  "banner",
  him: "coin_toss",
  her: "board_skin",
};

/** Reward slot (if any) awarded for first-time defeat of `botId`. */
export function rewardSlotForBot(botId: BotId): BotRewardSlot | null {
  return BOT_REWARD_SLOT[botId] ?? null;
}

/** Human-friendly headline for each reward slot — shown on bot cards + CTAs. */
export const REWARD_SLOT_LABEL: Record<BotRewardSlot, string> = {
  banner:     "Free Banner",
  coin_toss:  "Free Coin Toss Skin",
  board_skin: "Free Board Skin",
};

/** One-line description for the reward unlocked by each capstone bot. */
export function rewardPrizeLabel(botId: BotId): string | null {
  const slot = rewardSlotForBot(botId);
  return slot ? REWARD_SLOT_LABEL[slot] : null;
}

/**
 * Read a user's reward slots, tolerating missing field / legacy shape.
 * Accepts either the new `bot_rewards` dict or the legacy single
 * `bot_banner_reward` string.
 */
export function readBotRewards(user: unknown): BotRewards {
  const empty: BotRewards = { banner: null, coin_toss: null, board_skin: null };
  if (!user || typeof user !== "object") return empty;
  const u = user as Record<string, unknown>;
  const raw = u.bot_rewards as Record<string, unknown> | undefined;
  const out: BotRewards = { ...empty };
  if (raw && typeof raw === "object") {
    for (const slot of ["banner", "coin_toss", "board_skin"] as BotRewardSlot[]) {
      const v = raw[slot];
      if (v === "pending" || v === "claimed") out[slot] = v;
    }
  }
  // Legacy shim: promote the old `bot_banner_reward` into the banner slot
  // when the new field hasn't been written yet.
  if (out.banner === null) {
    const legacy = u.bot_banner_reward;
    if (legacy === "pending" || legacy === "claimed") out.banner = legacy;
  }
  return out;
}
