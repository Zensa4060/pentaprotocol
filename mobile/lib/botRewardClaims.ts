/**
 * Bot defeat reward claims — mirrors web Storescreen claim helpers.
 */

import API from "@/lib/api";
import { fetchProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import type { BotRewards, User } from "@/lib/types";
export type BotRewardSlotKey = "banner" | "coin_toss" | "board_skin" | "syros_skin";

export function readBotRewards(user: User | null | undefined): BotRewards & { syros_skin: BotRewards["banner"] } {
  const empty = {
    banner: null,
    coin_toss: null,
    board_skin: null,
    syros_skin: null,
  } as BotRewards & { syros_skin: BotRewards["banner"] };
  if (!user) return empty;
  const raw = user.bot_rewards;
  if (raw) {
    const slots: (keyof typeof empty)[] = ["banner", "coin_toss", "board_skin", "syros_skin"];
    for (const slot of slots) {
      const v = raw[slot];
      if (v === "pending" || v === "claimed") {
        empty[slot] = v;
      }
    }
  }
  return empty;
}

export function hasPendingBotReward(
  rewards: ReturnType<typeof readBotRewards>,
): boolean {
  return (
    rewards.banner === "pending" ||
    rewards.coin_toss === "pending" ||
    rewards.board_skin === "pending" ||
    rewards.syros_skin === "pending"
  );
}

export async function claimBotReward(
  slot: BotRewardSlotKey,
  itemId: string,
): Promise<User> {
  const url =
    slot === "banner"
      ? "/api/profile/claim-bot-banner-reward"
      : slot === "coin_toss"
        ? "/api/profile/claim-bot-coin-toss-reward"
        : slot === "syros_skin"
          ? "/api/profile/claim-syros-board-skin-reward"
          : "/api/profile/claim-bot-board-skin-reward";

  const body: Record<string, string> =
    slot === "banner"
      ? { bannerId: itemId }
      : slot === "coin_toss"
        ? { coinTossId: itemId }
        : { boardSkinId: itemId };

  const res = await API.post<{ profile?: User }>(url, body);
  if (res.data.profile) {
    useAuthStore.getState().setProfile(res.data.profile);
    return res.data.profile;
  }
  return fetchProfile();
}

/** Prefer SYROS slot when both board_skin and syros_skin are pending (web parity). */
export function boardSkinClaimSlot(
  rewards: ReturnType<typeof readBotRewards>,
): "syros_skin" | "board_skin" {
  return rewards.syros_skin === "pending" ? "syros_skin" : "board_skin";
}
