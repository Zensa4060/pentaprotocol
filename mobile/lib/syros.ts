/**
 * Syros — the in-universe AI oracle.
 *   - ``POST /api/syros/ask``     — lore / strategy Q&A
 *   - ``POST /api/analyze/game``  — post-game move analysis
 */

import API from "@/lib/api";
import { ApiError } from "@/lib/profile";
import { isAxiosError } from "axios";

export async function askSyros(question: string): Promise<string> {
  try {
    const res = await API.post<{ answer: string }>(
      "/api/syros/ask",
      { question },
      { timeout: 40_000 },
    );
    return res.data.answer;
  } catch (err) {
    if (isAxiosError(err)) {
      const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
      throw new ApiError(typeof detail === "string" ? detail : "Syros is unreachable.", err.response?.status);
    }
    throw new ApiError("Syros is unreachable.");
  }
}

// ─── Game analysis ────────────────────────────────────────────────────────────

export interface AnalyzeMove {
  player: "P1" | "P2";
  row: number;
  col: number;
}

/** Per-player summary shape from ``analyzer.compute_summary``. */
export interface PlayerSummary {
  best_moves: number;
  good: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  accuracy: number;
}

export type MoveQuality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** Per-move annotation from ``analyzer.analyze_game``. */
export interface MoveAnnotation {
  move_index: number;
  player: "P1" | "P2";
  /** [row, col] actually played. */
  played: [number, number];
  /** Engine's preferred [row, col] from the same position (null if none). */
  engine_best: [number, number] | null;
  quality: MoveQuality;
  score_before: number;
  score_after: number;
  score_delta: number;
  token_window?: boolean;
}

export interface AnalyzeResult {
  move_annotations: MoveAnnotation[];
  summary: { P1: PlayerSummary; P2: PlayerSummary };
}

export interface AnalyzeGameInput {
  boardSize: 5 | 6 | 7;
  selectedPatterns: string[];
  moves: AnalyzeMove[];
}

export async function analyzeGame(input: AnalyzeGameInput): Promise<AnalyzeResult> {
  try {
    const res = await API.post<AnalyzeResult>(
      "/api/analyze/game",
      {
        board_size: input.boardSize,
        selected_patterns: input.selectedPatterns,
        move_history: input.moves,
      },
      { timeout: 40_000 },
    );
    return res.data;
  } catch (err) {
    if (isAxiosError(err)) {
      const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
      throw new ApiError(typeof detail === "string" ? detail : "Analysis unavailable.", err.response?.status);
    }
    throw new ApiError("Analysis unavailable.");
  }
}
