/**
 * Server-side bot moves — ``POST /api/bot/move``.
 *
 * The web app and production AI ladder use this endpoint (Rust /
 * Python engines on Railway). Mobile must not run the local
 * ``botEngine7`` for AI Engine matches.
 */

import { isAxiosError } from "axios";

import API from "@/lib/api";
import type { BoardMode } from "@/lib/game/boardConfig";
import type { Board } from "@/lib/game/winCheck";
import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import type { EngineDifficulty } from "@/lib/botRewards";

export type { EngineDifficulty } from "@/lib/botRewards";

export interface BotMoveRequest {
  board: Board;
  difficulty: EngineDifficulty;
  /** Whose turn the server should move for — always ``P2`` in v1. */
  current_player: "P1" | "P2";
  board_mode: BoardMode;
  selected_patterns?: string[];
  c3_blocked?: boolean;
  moves_played?: number;
}

export interface BotMoveResponse {
  row: number;
  col: number;
}

export class BotMoveError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "BotMoveError";
    this.status = status;
    this.detail = detail;
  }
}

export async function requestBotMove(req: BotMoveRequest): Promise<BotMoveResponse | null> {
  try {
    const res = await API.post<BotMoveResponse>(
      "/api/bot/move",
      {
        board: req.board,
        difficulty: req.difficulty,
        current_player: req.current_player,
        board_mode: req.board_mode,
        selected_patterns: req.selected_patterns ?? DEFAULT_PATTERNS_7,
        c3_blocked: req.c3_blocked ?? false,
        moves_played: req.moves_played,
      },
      // Danger / machine_god engines can take several seconds — the
      // default 15s client timeout occasionally clips them.
      { timeout: 30_000 },
    );
    const data = res.data;
    if (typeof data?.row === "number" && typeof data?.col === "number") {
      return { row: data.row, col: data.col };
    }
    return null;
  } catch (err) {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const detail =
        typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : undefined;
      throw new BotMoveError(
        detail ?? "Bot service unavailable.",
        status,
        detail,
      );
    }
    throw new BotMoveError("Bot service unavailable.");
  }
}
