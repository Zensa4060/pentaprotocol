/**
 * Post-match series result payload — mirrors ``match_series_complete`` WS frame.
 */

import type { PlayerSlot } from "./types";

export interface MatchResultPlayer {
  name: string;
  elo_before: number;
  elo_after: number;
  rr_before: number;
  rr_after: number;
  level_before: number;
  level_after: number;
  xp_before: number;
  xp_after: number;
  was_placement?: boolean;
}

export interface MatchSeriesComplete {
  series_winner: PlayerSlot | "DRAW";
  format: string;
  p1: MatchResultPlayer;
  p2: MatchResultPlayer;
  careerEntryId: string | null;
}

export type MpLbPhase =
  | "coin"
  | "choice"
  | "choose_first_player"
  | "ban_first"
  | "ban_second";

export interface MpLimitbreakerState {
  tossWinner: PlayerSlot;
  phase: MpLbPhase;
  nextSlot: PlayerSlot;
  choice: "choose_first_player" | "ban_first" | null;
  firstPlayer: PlayerSlot | null;
  bans: string[];
  p1SeriesPts: number;
  p2SeriesPts: number;
  coinDueMs: number | null;
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

function slot(v: unknown, fallback: PlayerSlot): PlayerSlot {
  return v === "P2" ? "P2" : fallback;
}

const LB_PHASES: MpLbPhase[] = [
  "coin",
  "choice",
  "choose_first_player",
  "ban_first",
  "ban_second",
];

export function parseMpLbPhase(v: unknown): MpLbPhase {
  if (typeof v === "string" && LB_PHASES.includes(v as MpLbPhase)) {
    return v as MpLbPhase;
  }
  return "coin";
}

export function buildLbStateFromStart(msg: Record<string, unknown>): MpLimitbreakerState {
  const tw = slot(msg.toss_winner, "P1");
  return {
    tossWinner: tw,
    phase: parseMpLbPhase(msg.phase),
    nextSlot: slot(msg.next_slot, tw),
    choice: null,
    firstPlayer: null,
    bans: [],
    p1SeriesPts: num(msg.p1_series_points, 0),
    p2SeriesPts: num(msg.p2_series_points, 0),
    coinDueMs: typeof msg.coin_due_ms === "number" ? msg.coin_due_ms : null,
  };
}

export function mergeLbUpdate(
  prev: MpLimitbreakerState,
  msg: Record<string, unknown>,
): MpLimitbreakerState {
  const bans = Array.isArray(msg.bans) ? msg.bans.map(String) : prev.bans;
  const choice =
    msg.choice === "ban_first" || msg.choice === "choose_first_player"
      ? msg.choice
      : prev.choice;
  const firstPlayer =
    msg.first_player === "P1" || msg.first_player === "P2"
      ? msg.first_player
      : prev.firstPlayer;
  return {
    ...prev,
    tossWinner: msg.toss_winner === "P2" ? "P2" : prev.tossWinner,
    phase: msg.phase ? parseMpLbPhase(msg.phase) : prev.phase,
    nextSlot: slot(msg.next_slot, prev.nextSlot),
    choice,
    firstPlayer,
    bans,
    p1SeriesPts: num(msg.p1_series_points, prev.p1SeriesPts),
    p2SeriesPts: num(msg.p2_series_points, prev.p2SeriesPts),
    coinDueMs:
      typeof msg.coin_due_ms === "number"
        ? msg.coin_due_ms
        : msg.coin_due_ms === null
          ? null
          : prev.coinDueMs,
  };
}

export function parseMatchSeriesComplete(
  msg: Record<string, unknown>,
  mySlot: PlayerSlot,
): MatchSeriesComplete {
  const p1raw = (msg.p1 ?? {}) as Record<string, unknown>;
  const p2raw = (msg.p2 ?? {}) as Record<string, unknown>;
  const p1Career = msg.p1_career_entry_id;
  const p2Career = msg.p2_career_entry_id;
  const careerEntryId =
    mySlot === "P1"
      ? typeof p1Career === "string"
        ? p1Career
        : null
      : typeof p2Career === "string"
        ? p2Career
        : null;

  const player = (raw: Record<string, unknown>, fallbackName: string): MatchResultPlayer => ({
    name: typeof raw.name === "string" ? raw.name : fallbackName,
    elo_before: num(raw.elo_before, 0),
    elo_after: num(raw.elo_after, 0),
    rr_before: num(raw.rr_before, 0),
    rr_after: num(raw.rr_after, 0),
    level_before: num(raw.level_before, 1),
    level_after: num(raw.level_after, 1),
    xp_before: num(raw.xp_before, 0),
    xp_after: num(raw.xp_after, 0),
    was_placement: raw.was_placement === true,
  });

  const winnerRaw = msg.series_winner;
  const series_winner: PlayerSlot | "DRAW" =
    winnerRaw === "P1" || winnerRaw === "P2"
      ? winnerRaw
      : winnerRaw === "DRAW"
        ? "DRAW"
        : "DRAW";

  return {
    series_winner,
    format: typeof msg.format === "string" ? msg.format : "unranked",
    p1: player(p1raw, "P1"),
    p2: player(p2raw, "P2"),
    careerEntryId,
  };
}
