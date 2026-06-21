"use client";
/**
 * Dynamic capstone-bot naming.
 *
 * The three capstone bots — `jr` (5×5), `him` (6×6), `her` (7×7) — are renamed
 * after the top-3 players on the (Chronicle-rank) leaderboard:
 *
 *   leaderboard #1  →  `her`  (7×7, strongest)
 *   leaderboard #2  →  `him`  (6×6)
 *   leaderboard #3  →  `jr`   (5×5)
 *
 * Only the DISPLAY LABEL changes — `botId` and all gameplay / unlock logic
 * (see lib/botRewards.ts and the backend bot engine) are untouched. When fewer
 * than three players sit at Chronicle rank, the missing slots fall back to the
 * static `BOT_LABEL` defaults ("HER" / "HIM" / "JR.").
 */
import { create } from "zustand";
import API from "./api";
import { BOT_LABEL, prerequisiteBot, botBoardMode, type BotId } from "./botRewards";

export interface LeaderboardRow {
  username: string;
  elo: number | "?";
  rank: string;
  wins: number;
  is_placement: boolean;
}

interface BotNamesStore {
  her: string | null;
  him: string | null;
  jr: string | null;
  loaded: boolean;
  setFromLeaderboard: (rows: LeaderboardRow[]) => void;
}

export const useBotNamesStore = create<BotNamesStore>((set) => ({
  her: null,
  him: null,
  jr: null,
  loaded: false,
  setFromLeaderboard: (rows) => {
    const top = Array.isArray(rows) ? rows : [];
    set({
      her: top[0]?.username ?? null,
      him: top[1]?.username ?? null,
      jr: top[2]?.username ?? null,
      loaded: true,
    });
  },
}));

/** Only the three capstone bots carry a dynamic name. */
function dynamicOverride(botId: BotId): string | null {
  const s = useBotNamesStore.getState();
  if (botId === "her") return s.her;
  if (botId === "him") return s.him;
  if (botId === "jr") return s.jr;
  return null;
}

/**
 * Non-reactive label accessor — usable outside React (event handlers, plain
 * helpers). Returns the leaderboard override for capstone bots, else the
 * static `BOT_LABEL`.
 */
export function getBotLabel(botId: BotId): string {
  return dynamicOverride(botId) ?? BOT_LABEL[botId];
}

/**
 * Dynamic mirror of `lockedByLabel` (lib/botRewards.ts) that resolves the
 * gate-keeper bot's name through the leaderboard override. Lives here (not in
 * botRewards) to keep botRewards free of a circular dependency on this module.
 */
export function getLockedByLabel(botId: BotId): string | null {
  const prev = prerequisiteBot(botId);
  if (prev) return getBotLabel(prev);
  const mode = botBoardMode(botId);
  if (mode === "6x6") return getBotLabel("jr");
  if (mode === "7x7") return getBotLabel("him");
  return null;
}

/** Reactive variant: re-renders when the leaderboard names change. */
export function useBotLabel(botId: BotId): string {
  const her = useBotNamesStore((s) => s.her);
  const him = useBotNamesStore((s) => s.him);
  const jr = useBotNamesStore((s) => s.jr);
  if (botId === "her" && her) return her;
  if (botId === "him" && him) return him;
  if (botId === "jr" && jr) return jr;
  return BOT_LABEL[botId];
}

/**
 * Fetch the leaderboard once and populate the capstone-bot names. Safe to call
 * from multiple places (idempotent — last write wins with identical data).
 */
export async function loadBotNames(): Promise<void> {
  try {
    const res = await API.get<LeaderboardRow[]>("/api/profile/leaderboard");
    useBotNamesStore.getState().setFromLeaderboard(res.data ?? []);
  } catch {
    // Non-fatal: bots keep their static default labels.
  }
}
