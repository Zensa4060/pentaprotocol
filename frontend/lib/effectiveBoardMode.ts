import type { BoardMode } from "@/lib/types";

/** First leg of compound modes (e.g. 5x5_6x6_7x7) — matches backend _starting_board_mode idea. */
export function startingLegFromBoardMode(mode: BoardMode): "5x5" | "6x6" | "7x7" {
  if (mode === "5x5" || mode === "6x6" || mode === "7x7") return mode;
  const seg = mode.split("_").filter((p): p is "5x5" | "6x6" | "7x7" => p === "5x5" || p === "6x6" || p === "7x7");
  return seg[0] ?? "5x5";
}

/** Matches backend `_effective_board_mode` — playable size label for a room `board_mode` string. */
export function effectivePlayBoardMode(mode: BoardMode | string | undefined): "5x5" | "6x6" | "7x7" {
  const m = (mode ?? "5x5") as string;
  if (m === "5x5" || m === "6x6" || m === "7x7") return m;
  return startingLegFromBoardMode(m as BoardMode);
}

export type MultiplayerRulesBootstrap = { sheet: "5x5" | "6x6" | "7x7"; rulesMatchGate: true };

/** Aligns with GameScreen `room_state` rules sheet + gate when awaiting_* is true. */
export function multiplayerRulesBootstrapFromRoom(
  room:
    | {
        board_mode?: string;
        awaiting_5x5_rules_ready?: boolean;
        awaiting_6x6_rules_ready?: boolean;
        awaiting_7x7_rules_ready?: boolean;
      }
    | undefined,
): MultiplayerRulesBootstrap | null {
  if (!room) return null;
  const roomEffBm = effectivePlayBoardMode(room.board_mode as BoardMode);
  if (roomEffBm === "5x5" && room.awaiting_5x5_rules_ready === true) {
    return { sheet: "5x5", rulesMatchGate: true };
  }
  if (roomEffBm === "6x6" && room.awaiting_6x6_rules_ready === true) {
    return { sheet: "6x6", rulesMatchGate: true };
  }
  if (roomEffBm === "7x7" && room.awaiting_7x7_rules_ready === true) {
    return { sheet: "7x7", rulesMatchGate: true };
  }
  return null;
}
