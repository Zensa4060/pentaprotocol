/**
 * Match-found helpers — opponent extraction + route params.
 */

import type { PlayerSlot, Room, RoomFormat } from "@/lib/multiplayer/types";

export interface MatchOpponent {
  name: string;
  elo: number | null;
  level: number;
  avatar: string | null;
  banner: string;
  placementMatches: number;
}

export function opponentFromRoom(room: Room, mySlot: PlayerSlot): MatchOpponent {
  const prefix = mySlot === "P1" ? "player2" : "player1";
  const ext = room as unknown as Record<string, string | number | null | undefined>;
  return {
    name: String(room[`${prefix}_name` as keyof Room] ?? "OPPONENT"),
    elo: (room[`${prefix}_elo` as keyof Room] as number | null) ?? null,
    level: Number(room[`${prefix}_level` as keyof Room] ?? 1),
    avatar: (room[`${prefix}_avatar` as keyof Room] as string | null) ?? null,
    banner: String(ext[`${prefix}_banner`] ?? ext[`${prefix}_banner_style`] ?? "default"),
    placementMatches: Number(ext[`${prefix}_placement_matches`] ?? 5),
  };
}

export function humanMatchFoundParams(
  format: RoomFormat,
  code: string,
  slot: PlayerSlot,
  room: Room,
): Record<string, string> {
  const opp = opponentFromRoom(room, slot);
  return {
    flow: "human",
    format,
    code,
    slot,
    board_mode: room.board_mode,
    opp_name: opp.name,
    opp_elo: opp.elo != null ? String(opp.elo) : "",
    opp_level: String(opp.level),
    opp_avatar: opp.avatar ?? "",
    opp_banner: opp.banner,
    opp_placement: String(opp.placementMatches),
  };
}

export function fillerMatchFoundParams(input: {
  botName: string;
  botTier: string;
  botLevel: number;
  botEmoji: string;
  botBanner: string;
  isSyros: boolean;
  patterns: string[];
}): Record<string, string> {
  return {
    flow: "filler",
    format: "unranked",
    board_mode: "5x5_6x6_7x7",
    bot_name: input.botName,
    bot_tier: input.botTier,
    bot_level: String(input.botLevel),
    bot_emoji: input.botEmoji,
    bot_banner: input.botBanner,
    bot_syros: input.isSyros ? "1" : "0",
    patterns: input.patterns.join(","),
  };
}
