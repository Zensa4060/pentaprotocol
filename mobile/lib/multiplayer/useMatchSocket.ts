/**
 * ``useMatchSocket`` — React hook around ``openMatchSocket``.
 *
 * Server frames are the source of truth. Protocol-breaker toss state is
 * merged into ``room`` so UI reads one snapshot (matches web GameScreen).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { gridFromBoardMode } from "@/lib/game/boardConfig";
import { buildMoveLogEntry, type MoveLogEntry } from "@/lib/game/matchRules";
import type { Coord } from "@/lib/game/winCheck";
import {
  openMatchSocket,
  type MatchSocket,
  type WsConnectionStatus,
} from "./ws";

import {
  buildLbStateFromStart,
  mergeLbUpdate,
  parseMatchSeriesComplete,
  type MatchSeriesComplete,
  type MpLimitbreakerState,
} from "./matchResult";
import { isRbPhase, type RbPhase } from "./rulebreakerPhases";
import type {
  ChatMessage,
  InboundMessage,
  PlayerSlot,
  Room,
} from "./types";

export interface UseMatchSocketOptions {
  roomCode: string;
  slot: PlayerSlot;
  initialRoom?: Room | null;
}

export interface UseMatchSocketResult {
  room: Room | null;
  status: WsConnectionStatus;
  lastError: string | null;
  disbanded: { reason?: string } | null;
  matchStarted: boolean;
  placeStone: (row: number, col: number) => void;
  readyForNextGame: () => void;
  quitMatch: (reason?: string) => void;
  setOnGameScreen: (on: boolean) => void;
  dismissError: () => void;
  rbPhase: RbPhase | null;
  sendTossAction: (action: string, payload?: Record<string, unknown>) => void;
  /** Cash the Mindbreaker extra-turn token (server validates everything). */
  sendUseExtraTurn: () => void;
  lbState: MpLimitbreakerState | null;
  sendLimitbreakerAction: (payload: {
    choice?: "choose_first_player" | "ban_first";
    first_player?: PlayerSlot;
    board_mode?: string;
  }) => void;
  matchResult: MatchSeriesComplete | null;
  dismissMatchResult: () => void;
  /** Rules-show gate readiness per slot (``levelup_ready`` protocol). */
  rulesReady: Record<PlayerSlot, boolean>;
  sendLevelupReady: (ready: boolean, selectedPatterns?: string[]) => void;
  /** Winning line of the just-finished game (animates the board). */
  winLine: Coord[] | null;
  /** Between-games readiness per slot (``ready_update`` protocol). */
  readyStates: Record<PlayerSlot, boolean>;
  /** Per-game move log (server-seeded on rejoin, appended per move). */
  moveLog: MoveLogEntry[];
  chatMessages: ChatMessage[];
  unreadChat: number;
  sendChat: (text: string) => void;
  markChatRead: () => void;
  /** Server-authoritative flag fall — loser is always current_player. */
  sendTimeout: () => void;
  /** Opponent dropped — server forfeits them when the deadline passes. */
  reconnectCountdown: { slot: PlayerSlot; deadlineMs: number } | null;
}

function emptyBoardForMode(mode: string): Room["board"] {
  const n = gridFromBoardMode(mode);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

function mergeRbPayload(
  prev: Room,
  payload: Record<string, unknown>,
): Room {
  // Accumulate phase payloads (server-side parity): later phases omit
  // earlier keys (e.g. toss_summary doesn't repeat winnerPickedRule), so
  // replacing the payload wholesale would lose the toss selections the
  // summary screen needs.
  const mergedPayload = {
    ...(prev.rb_phase_payload ?? {}),
    ...payload,
  };
  const next: Room = { ...prev, rb_phase_payload: mergedPayload };
  if (typeof payload.phase === "string") next.phase = payload.phase;
  if (payload.toss_winner === "P1" || payload.toss_winner === "P2") {
    next.rb_toss_winner = payload.toss_winner;
  }
  if (payload.result === "PENTA" || payload.result === "PROTO") {
    next.rb_coin_result = payload.result;
  }
  if (payload.rb6TimerOwner === "P1" || payload.rb6TimerOwner === "P2") {
    next.rb6_timer_owner = payload.rb6TimerOwner;
  }
  if (payload.rb6CellChooser === "P1" || payload.rb6CellChooser === "P2") {
    next.rb6_cell_chooser = payload.rb6CellChooser;
  }
  if (
    payload.rb6_special_cell &&
    typeof payload.rb6_special_cell === "object" &&
    payload.rb6_special_cell !== null
  ) {
    const cell = payload.rb6_special_cell as { r?: number; c?: number; owner?: PlayerSlot };
    if (typeof cell.r === "number" && typeof cell.c === "number" && cell.owner) {
      next.rb6_special_cell = { r: cell.r, c: cell.c, owner: cell.owner };
    }
  }
  if (typeof payload.rbC3Blocked === "boolean") next.c3_blocked = payload.rbC3Blocked;
  return next;
}

export function useMatchSocket({
  roomCode,
  slot,
  initialRoom = null,
}: UseMatchSocketOptions): UseMatchSocketResult {
  const [room, setRoom] = useState<Room | null>(initialRoom);
  const [status, setStatus] = useState<WsConnectionStatus>("connecting");
  const [lastError, setLastError] = useState<string | null>(null);
  const [disbanded, setDisbanded] = useState<{ reason?: string } | null>(null);
  const [matchStarted, setMatchStarted] = useState(false);
  const [rbPhase, setRbPhase] = useState<RbPhase | null>(null);
  const [lbState, setLbState] = useState<MpLimitbreakerState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchSeriesComplete | null>(null);
  const [rulesReady, setRulesReady] = useState<Record<PlayerSlot, boolean>>({
    P1: false,
    P2: false,
  });
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [readyStates, setReadyStates] = useState<Record<PlayerSlot, boolean>>({
    P1: false,
    P2: false,
  });
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [reconnectCountdown, setReconnectCountdown] = useState<{
    slot: PlayerSlot;
    deadlineMs: number;
  } | null>(null);

  const socketRef = useRef<MatchSocket | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  const syncRbPhase = useCallback((phase: string | null | undefined) => {
    if (phase && isRbPhase(phase)) setRbPhase(phase);
    else setRbPhase(null);
  }, []);

  const onMessage = useCallback(
    (msg: InboundMessage) => {
      switch (msg.type) {
        case "room_state":
        case "player_joined": {
          // A room that died while we were between routes (e.g. the
          // opponent aborted during the match-found handoff) must not
          // leave us parked on a dead board.
          if (msg.room.status === "disbanded" || msg.room.game_status === "disbanded") {
            setDisbanded((current) => current ?? { reason: "The match is no longer active." });
          }
          setRoom(msg.room);
          syncRbPhase(msg.room.phase);
          if (isRbPhase(msg.room.phase ?? "")) setRbPhase(msg.room.phase as RbPhase);
          else if (!msg.room.awaiting_rulebreaker) setRbPhase(null);
          // Seed the move log from the server copy (rejoin mid-game).
          if (Array.isArray(msg.room.move_log)) {
            setMoveLog(
              msg.room.move_log.map((e, i) =>
                buildMoveLogEntry(i + 1, e.row, e.col, e.player),
              ),
            );
          }
          break;
        }
        case "rulebreaker_start": {
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              awaiting_rulebreaker: true,
              phase: "rb_splash",
              rb_toss_winner: msg.toss_winner ?? prev.rb_toss_winner ?? null,
              rb_coin_result: null,
            };
          });
          setRbPhase("rb_splash");
          break;
        }
        case "toss_action": {
          const payload = msg.payload ?? {};
          if (msg.action === "coin_result") {
            setRoom((prev) => {
              if (!prev) return prev;
              const merged = mergeRbPayload(prev, payload);
              merged.rb_coin_result =
                payload.result === "PENTA" || payload.result === "PROTO"
                  ? payload.result
                  : merged.rb_coin_result ?? null;
              if (payload.toss_winner === "P1" || payload.toss_winner === "P2") {
                merged.rb_toss_winner = payload.toss_winner;
              }
              merged.phase = "rb_coin";
              return merged;
            });
            setRbPhase("rb_coin");
          } else if (msg.action === "start_rb") {
            setRoom((prev) =>
              prev ? { ...prev, phase: "rb_splash", awaiting_rulebreaker: true } : prev,
            );
            setRbPhase("rb_splash");
          } else if (msg.action === "phase_choice" && typeof payload.phase === "string") {
            setRoom((prev) => (prev ? mergeRbPayload(prev, payload) : prev));
            if (isRbPhase(payload.phase)) setRbPhase(payload.phase);
          }
          break;
        }
        case "move_made": {
          // Append to the move log — the stone's owner is read off the
          // board (a Timebreaker trap cell converts the stone, and the
          // log should show the resulting owner).
          const mover =
            (msg.board?.[msg.row]?.[msg.col] as PlayerSlot | null) ?? null;
          if (mover) {
            setMoveLog((l) => [
              ...l,
              buildMoveLogEntry(msg.moves_played, msg.row, msg.col, mover),
            ]);
          }
          if (msg.winner && msg.winner !== "DRAW" && msg.win_line?.length) {
            setWinLine(msg.win_line as Coord[]);
          }
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              board: msg.board,
              current_player: msg.current_player,
              moves_played: msg.moves_played,
              winner: msg.winner ?? null,
              game_status: msg.game_status,
              ...(msg.game_number !== undefined ? { game_number: msg.game_number } : null),
              ...(msg.match_history !== undefined
                ? { match_history: msg.match_history }
                : null),
              ...(msg.p1_series_points !== undefined
                ? { p1_series_points: msg.p1_series_points }
                : null),
              ...(msg.p2_series_points !== undefined
                ? { p2_series_points: msg.p2_series_points }
                : null),
              ...(msg.series_winner !== undefined
                ? { series_winner: msg.series_winner ?? null }
                : null),
              ...(msg.awaiting_rulebreaker !== undefined
                ? { awaiting_rulebreaker: msg.awaiting_rulebreaker }
                : null),
              ...(msg.extra_turns !== undefined ? { extra_turns: msg.extra_turns } : null),
            };
          });
          break;
        }
        case "game_reset": {
          const gr = msg as {
            limitbreaker_final?: boolean;
            protocolbreaker_final?: boolean;
          };
          if (gr.limitbreaker_final || gr.protocolbreaker_final) {
            setLbState(null);
          }
          // A fresh leg can raise a rules-show gate — start with both
          // sides un-ready so the sheet shows live READY states.
          if (
            msg.awaiting_5x5_rules_ready ||
            msg.awaiting_6x6_rules_ready ||
            msg.awaiting_7x7_rules_ready
          ) {
            setRulesReady({ P1: false, P2: false });
          }
          setWinLine(null);
          setMoveLog([]);
          setReadyStates({ P1: false, P2: false });
          setRoom((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              board: emptyBoardForMode(msg.board_mode),
              current_player: msg.first_player,
              moves_played: 0,
              winner: null,
              game_status: "playing",
              game_number: msg.game_number,
              board_mode: msg.board_mode,
              awaiting_rulebreaker: false,
              phase: null,
              rb_toss_winner: null,
              rb_coin_result: null,
              rb_phase_payload: null,
              rb6_timer_owner: msg.rb6_timer_owner ?? null,
              rb6_cell_chooser: null,
              rb6_special_cell: msg.rb6_special_cell ?? null,
              c3_blocked: msg.c3_blocked ?? false,
              suppress_center_opening: msg.suppress_center_opening ?? false,
              rb_extra_turn_token_holder: msg.rb_extra_turn_token_holder ?? null,
              rb_extra_turn_token_used: msg.rb_extra_turn_token_used ?? false,
              rb_hide_banned_from_slot: msg.rb_hide_banned_from_slot ?? null,
              rb_banned_patterns: msg.rb_banned_patterns ?? [],
              extra_turns: 0,
              awaiting_limitbreaker: false,
              ...(msg.p1_series_points !== undefined
                ? { p1_series_points: msg.p1_series_points }
                : null),
              ...(msg.p2_series_points !== undefined
                ? { p2_series_points: msg.p2_series_points }
                : null),
              ...(msg.selected_patterns !== undefined
                ? { selected_patterns: msg.selected_patterns }
                : null),
              ...(msg.awaiting_5x5_rules_ready !== undefined
                ? { awaiting_5x5_rules_ready: msg.awaiting_5x5_rules_ready }
                : null),
              ...(msg.awaiting_6x6_rules_ready !== undefined
                ? { awaiting_6x6_rules_ready: msg.awaiting_6x6_rules_ready }
                : null),
              ...(msg.awaiting_7x7_rules_ready !== undefined
                ? { awaiting_7x7_rules_ready: msg.awaiting_7x7_rules_ready }
                : null),
            };
          });
          setRbPhase(null);
          break;
        }
        case "limitbreaker_start": {
          const raw = msg as Record<string, unknown>;
          setLbState(buildLbStateFromStart(raw));
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  awaiting_limitbreaker: true,
                  rb_toss_winner:
                    raw.toss_winner === "P1" || raw.toss_winner === "P2"
                      ? raw.toss_winner
                      : prev.rb_toss_winner,
                }
              : prev,
          );
          break;
        }
        case "limitbreaker_update": {
          setLbState((prev) =>
            prev ? mergeLbUpdate(prev, msg as Record<string, unknown>) : prev,
          );
          break;
        }
        case "match_series_complete":
        case "ranked_match_complete": {
          const parsed = parseMatchSeriesComplete(msg as Record<string, unknown>, slot);
          setMatchResult(parsed);
          setLbState(null);
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  series_winner:
                    parsed.series_winner === "DRAW" ? null : parsed.series_winner,
                  game_status: "finished",
                }
              : prev,
          );
          break;
        }
        case "ready_update": {
          setReadyStates((prev) => ({ ...prev, [msg.player]: msg.ready }));
          break;
        }
        case "chat_message": {
          const entry: ChatMessage = {
            from: msg.from,
            text: msg.text,
            ts: typeof msg.ts === "number" && msg.ts > 0 ? msg.ts : Date.now(),
          };
          setChatMessages((prev) => [...prev.slice(-99), entry]);
          if (msg.from !== slot) setUnreadChat((c) => c + 1);
          break;
        }
        case "rb_extra_turn_update": {
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  extra_turns: msg.extra_turns,
                  rb_extra_turn_token_used: msg.rb_extra_turn_token_used,
                }
              : prev,
          );
          break;
        }
        case "levelup_ready_update": {
          setRulesReady((prev) => ({ ...prev, [msg.player]: msg.ready }));
          break;
        }
        case "levelup_sync": {
          setRulesReady({
            P1: Boolean(msg.p1_ready),
            P2: Boolean(msg.p2_ready),
          });
          break;
        }
        case "levelup_start": {
          // Both sides ready — server opened the board. Clear the gate.
          setRulesReady({ P1: false, P2: false });
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  awaiting_5x5_rules_ready: false,
                  awaiting_6x6_rules_ready: false,
                  awaiting_7x7_rules_ready: false,
                }
              : prev,
          );
          break;
        }
        case "match_start": {
          setMatchStarted(true);
          break;
        }
        case "match_disbanded": {
          setDisbanded({ reason: msg.reason });
          break;
        }
        case "match_aborted_no_play": {
          setDisbanded({
            reason:
              msg.reason ??
              "Your opponent aborted or could not connect to the match. No result was recorded.",
          });
          break;
        }
        case "player_reconnect_countdown": {
          setReconnectCountdown({ slot: msg.slot, deadlineMs: msg.deadline_ms });
          break;
        }
        case "player_reconnected": {
          setReconnectCountdown((prev) => (prev && prev.slot === msg.slot ? null : prev));
          break;
        }
        case "player_disconnect_confirmed": {
          setReconnectCountdown(null);
          break;
        }
        case "duplicate_session": {
          setDisbanded({ reason: msg.reason ?? "Signed in elsewhere" });
          break;
        }
        case "error": {
          setLastError(msg.message);
          break;
        }
        default:
          break;
      }
    },
    [syncRbPhase, slot],
  );

  useEffect(() => {
    setRoom(initialRoom);
    setStatus("connecting");
    setLastError(null);
    setDisbanded(null);
    setMatchStarted(false);
    setRbPhase(null);
    setLbState(null);
    setMatchResult(null);
    setRulesReady({ P1: false, P2: false });
    setWinLine(null);
    setReadyStates({ P1: false, P2: false });
    setMoveLog([]);
    setChatMessages([]);
    setUnreadChat(0);
    setReconnectCountdown(null);

    const socket = openMatchSocket({
      roomCode,
      slot,
      onMessage,
      onStatus: (next, detail) => {
        setStatus(next);
        if (next === "open") {
          socket.send({ type: "match_found_ready" });
          socket.send({ type: "screen_presence", on_game_screen: true });
        }
        if (next === "disconnected" || next === "rejected") {
          setDisbanded((current) =>
            current ?? { reason: detail ?? "Disconnected" },
          );
        }
      },
    });
    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, slot]);

  // ── Coin-toss cadence (web GameScreen parity) ────────────────────
  // Each client advances its own splash → coin reveal → rule choice;
  // only P1 rolls the coin and broadcasts ``coin_result``. Without this
  // a mobile P1 room sat on the splash until the server stall-watchdog
  // force-resolved the whole toss with default picks.
  useEffect(() => {
    if (rbPhase !== "rb_splash") return;
    const t = setTimeout(() => {
      setRbPhase((p) => (p === "rb_splash" ? "rb_coin" : p));
      setRoom((prev) =>
        prev && prev.phase === "rb_splash" ? { ...prev, phase: "rb_coin" } : prev,
      );
    }, 3200);
    return () => clearTimeout(t);
  }, [rbPhase]);

  const rbCoinResult = room?.rb_coin_result ?? null;
  useEffect(() => {
    if (rbPhase !== "rb_coin") return;
    if (rbCoinResult) {
      const t = setTimeout(() => {
        setRbPhase((p) => (p === "rb_coin" ? "rule_choice" : p));
        setRoom((prev) =>
          prev && prev.phase === "rb_coin" ? { ...prev, phase: "rule_choice" } : prev,
        );
      }, 2500);
      return () => clearTimeout(t);
    }
    if (slot !== "P1") return;
    const t = setTimeout(() => {
      const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
      socketRef.current?.send({
        type: "toss_action",
        action: "coin_result",
        payload: { result: r, toss_winner: r === "PENTA" ? "P1" : "P2" },
      });
    }, 2800);
    return () => clearTimeout(t);
  }, [rbPhase, rbCoinResult, slot]);

  const placeStone = useCallback((row: number, col: number) => {
    socketRef.current?.send({ type: "move", row, col });
  }, []);

  const readyForNextGame = useCallback(() => {
    socketRef.current?.send({ type: "ready", ready: true });
    // Optimistic echo so the ready overlay flips my row immediately.
    setReadyStates((prev) => ({ ...prev, [slot]: true }));
  }, [slot]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socketRef.current?.send({ type: "chat", text: trimmed.slice(0, 300), ts: Date.now() });
  }, []);

  const markChatRead = useCallback(() => setUnreadChat(0), []);

  const sendTimeout = useCallback(() => {
    socketRef.current?.send({ type: "timeout" });
  }, []);

  const quitMatch = useCallback((reason?: string) => {
    socketRef.current?.send({ type: "quit_match", reason });
  }, []);

  const setOnGameScreen = useCallback((on: boolean) => {
    socketRef.current?.send({ type: "screen_presence", on_game_screen: on });
  }, []);

  const dismissError = useCallback(() => {
    setLastError(null);
  }, []);

  const sendTossAction = useCallback((action: string, payload?: Record<string, unknown>) => {
    socketRef.current?.send({ type: "toss_action", action, payload });
    if (action === "phase_choice" && payload?.phase && isRbPhase(String(payload.phase))) {
      setRbPhase(payload.phase as RbPhase);
      setRoom((prev) => (prev ? mergeRbPayload(prev, payload ?? {}) : prev));
    }
  }, []);

  const sendUseExtraTurn = useCallback(() => {
    socketRef.current?.send({ type: "rb_use_extra_turn" });
  }, []);

  const sendLimitbreakerAction = useCallback(
    (payload: {
      choice?: "choose_first_player" | "ban_first";
      first_player?: PlayerSlot;
      board_mode?: string;
    }) => {
      socketRef.current?.send({ type: "limitbreaker_action", ...payload });
    },
    [],
  );

  const dismissMatchResult = useCallback(() => {
    setMatchResult(null);
  }, []);

  const sendLevelupReady = useCallback(
    (ready: boolean, selectedPatterns?: string[]) => {
      socketRef.current?.send({
        type: "levelup_ready",
        ready,
        ...(selectedPatterns?.length ? { selected_patterns: selectedPatterns } : null),
      });
      // Optimistic local echo — the server broadcasts levelup_ready_update
      // to both peers, but reflecting our own tap immediately keeps the
      // button state snappy.
      setRulesReady((prev) => ({ ...prev, [slot]: ready }));
    },
    [slot],
  );

  return {
    room,
    status,
    lastError,
    disbanded,
    matchStarted,
    placeStone,
    readyForNextGame,
    quitMatch,
    setOnGameScreen,
    dismissError,
    rbPhase,
    sendTossAction,
    sendUseExtraTurn,
    lbState,
    sendLimitbreakerAction,
    matchResult,
    dismissMatchResult,
    rulesReady,
    sendLevelupReady,
    winLine,
    readyStates,
    moveLog,
    chatMessages,
    unreadChat,
    sendChat,
    markChatRead,
    sendTimeout,
    reconnectCountdown,
  };
}
