/**
 * Multiplayer protocol types.
 *
 * We deliberately model a **slim** subset of the room shape +
 * WS message kinds — only the fields mobile v1 reads. The backend
 * sends ~80 keys per ``room_state`` and ~14 message types; pulling
 * all of that into our types would buy us nothing for the
 * happy-path flow we ship today, and would force us to grow the
 * client every time the server adds a column to a feature we don't
 * use (chat, ranked, ProtocolBreaker, RB6 special cell, etc.).
 *
 * The shape mirrors the server's ``serialize_room`` keys 1-for-1
 * (no remapping) so when we DO start consuming a new field we can
 * just append it here.
 */

import type { Board } from "@/lib/game/winChecker7";

export type PlayerSlot = "P1" | "P2";

/** Room status — top-level lifecycle flag. */
export type RoomStatus = "waiting" | "active" | "finished" | "disbanded";

/** Game status — per-game lifecycle within an active room. */
export type GameStatus = "waiting" | "playing" | "finished" | "disbanded";

export type RoomFormat = "unranked" | "ranked" | "private";

/**
 * Subset of the room document we actually read on mobile.
 *
 * Everything optional that the server sets defaults for is marked
 * optional here so the type compiles for both the "freshly created,
 * still waiting for P2" shape (most fields null) and the "in active
 * gameplay" shape (everything populated).
 */
export interface Room {
  room_code: string;
  status: RoomStatus;
  format: RoomFormat;
  board_mode: string;

  // ── players ────────────────────────────────────────────────
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  player1_elo: number | null;
  player2_elo: number | null;
  player1_avatar: string | null;
  player2_avatar: string | null;
  player1_level: number | null;
  player2_level: number | null;

  // ── gameplay ───────────────────────────────────────────────
  board: Board | null;
  current_player: PlayerSlot;
  moves_played: number;
  winner: PlayerSlot | "DRAW" | null;
  game_status: GameStatus;
  game_number: number;

  // ── series ─────────────────────────────────────────────────
  p1_series_points: number;
  p2_series_points: number;
  series_winner: PlayerSlot | null;
  match_history: MatchHistoryEntry[];

  // ── rule gates / protocol breaker ───────────────────────────
  awaiting_rulebreaker: boolean;
  phase?: string | null;
  selected_patterns?: string[];
  rb_toss_winner?: PlayerSlot | null;
  rb_coin_result?: "PENTA" | "PROTO" | null;
  rb_phase_payload?: Record<string, unknown> | null;
  rb6_timer_owner?: PlayerSlot | null;
  rb6_special_cell?: { r: number; c: number; owner: PlayerSlot } | null;
  awaiting_5x5_rules_ready: boolean;
  awaiting_6x6_rules_ready: boolean;
  awaiting_7x7_rules_ready: boolean;

  // ── identity (only present on responses where the API knows
  //    the caller's slot — /join, /create). NOT a server doc field. ─
  player_slot?: PlayerSlot;
}

export interface MatchHistoryEntry {
  winner: PlayerSlot | "DRAW";
  board?: Board;
  moves?: unknown[];
  board_mode?: string;
  game_number?: number;
}

// ── Active-room peek (mobile uses to nudge a rejoin) ─────────────

export interface ActiveRoomCheck {
  room_code: string | null;
  player_slot?: PlayerSlot;
  format?: RoomFormat;
  board_mode?: string;
}

// ── WS messages ──────────────────────────────────────────────────

/**
 * Inbound from server. We list every kind we *read*; ones we
 * ignore (chat, friend_request_peer, net_update, levelup_*, etc.)
 * still arrive — the listener just no-ops on unknown ``type`` values.
 */
export type InboundMessage =
  | { type: "room_state"; room: Room }
  | {
      type: "move_made";
      row: number;
      col: number;
      board: Board;
      current_player: PlayerSlot;
      moves_played: number;
      winner: PlayerSlot | "DRAW" | null;
      win_line?: Array<[number, number]> | [];
      game_status: GameStatus;
      extra_turns?: number;
      connectionScores?: { p1: number; p2: number };
      game_number?: number;
      match_history?: MatchHistoryEntry[];
      p1_series_points?: number;
      p2_series_points?: number;
      series_winner?: PlayerSlot | null;
      awaiting_rulebreaker?: boolean;
    }
  | {
      type: "game_reset";
      first_player: PlayerSlot;
      game_number: number;
      board_mode: string;
      suppress_center_opening?: boolean;
    }
  | { type: "match_start"; start_at_ms: number }
  | { type: "match_over" }
  | { type: "match_disbanded"; reason?: string }
  | { type: "ready_update"; player: PlayerSlot; ready: boolean }
  | { type: "player_joined"; room: Room }
  | { type: "player_reconnected"; slot: PlayerSlot }
  | {
      type: "player_reconnect_countdown";
      slot: PlayerSlot;
      deadline_ms: number;
      remaining_seconds: number;
    }
  | { type: "duplicate_session"; reason?: string }
  | { type: "error"; message: string }
  | { type: "pong"; ts?: number }
  // ProtocolBreaker / Mindbreaker / Timebreaker — we don't render
  // these on mobile v1; we surface "open in web app" when we see
  // the awaiting_rulebreaker flag in a move_made tail.
  | {
      type: "rulebreaker_start";
      toss_winner?: PlayerSlot;
      board_mode?: string;
    }
  | {
      type: "toss_action";
      action: string;
      payload?: Record<string, unknown>;
      from?: PlayerSlot;
    }
  | { type: "limitbreaker_start"; [key: string]: unknown };

/**
 * Outbound from client. Server uses strict schemas for ``move``,
 * ``chat``, ``quit_match``, ``timeout``; everything else is
 * envelope-only validated. We only ship a small set — the rest
 * are server-internal flows we don't need yet.
 */
export type OutboundMessage =
  | { type: "move"; row: number; col: number; think_ms?: number }
  | { type: "ready"; ready: boolean }
  | { type: "match_found_ready" }
  | { type: "screen_presence"; on_game_screen: boolean }
  | { type: "ping"; ts: number }
  | { type: "quit_match"; reason?: string }
  | { type: "toss_action"; action: string; payload?: Record<string, unknown> }
  | { type: "rb_start_game"; first_player?: PlayerSlot; resolve_series_only?: boolean };
