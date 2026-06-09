/**
 * Career match replay + analysis helpers.
 */

import {
  defaultPatternsForGrid,
  emptyBoard,
  type GridSize,
} from "@/lib/game/boardConfig";
import type { Board } from "@/lib/game/winCheck";
import type { AnalyzeMove } from "@/lib/syros";
import type { CareerMatchMove, CareerMatchRound } from "@/lib/types";

export function boardSizeFromRound(round: CareerMatchRound): GridSize {
  const bm = String(round.board_mode ?? "").toLowerCase();
  if (bm.includes("7x7")) return 7;
  if (bm.includes("6x6")) return 6;
  const n = Array.isArray(round.board) ? round.board.length : 0;
  if (n === 7 || n === 6 || n === 5) return n as GridSize;
  return 5;
}

export function normalizeCareerMoves(moves: CareerMatchMove[] | undefined): AnalyzeMove[] {
  if (!Array.isArray(moves)) return [];
  const out: AnalyzeMove[] = [];
  for (const m of moves) {
    if (!m || typeof m.row !== "number" || typeof m.col !== "number") continue;
    const p = String(m.player ?? "").toUpperCase();
    if (p !== "P1" && p !== "P2") continue;
    out.push({ row: m.row, col: m.col, player: p });
  }
  return out;
}

export function boardAtMoveIndex(round: CareerMatchRound, moveIdx: number): Board {
  const grid = boardSizeFromRound(round);
  const board = emptyBoard(grid);
  const moves = normalizeCareerMoves(round.moves);
  const slice = moves.slice(0, Math.max(0, moveIdx + 1));
  for (const m of slice) {
    if (board[m.row]?.[m.col] == null) {
      board[m.row][m.col] = m.player;
    }
  }
  return board;
}

export function lastMoveAtIndex(
  round: CareerMatchRound,
  moveIdx: number,
): { row: number; col: number } | null {
  const moves = normalizeCareerMoves(round.moves);
  if (moveIdx < 0 || moveIdx >= moves.length) return null;
  return { row: moves[moveIdx].row, col: moves[moveIdx].col };
}

export function patternsForRound(round: CareerMatchRound): string[] {
  return defaultPatternsForGrid(boardSizeFromRound(round));
}

export function formatCareerDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDurationShort(ms: number): string {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function careerResultLabel(result: string, surrenderedBy?: string, mySlot?: string): string {
  const r = result.toLowerCase();
  if (surrenderedBy && mySlot) {
    if (surrenderedBy === mySlot) return "FORFEITED";
    return "OPPONENT SURRENDERED";
  }
  if (r === "win") return "VICTORY";
  if (r === "draw") return "DRAW";
  return "DEFEAT";
}
