/**
 * ``useMatchSocket`` — React hook around ``openMatchSocket``.
 *
 * Server frames are the source of truth. Protocol-breaker toss state is
 * merged into ``room`` so UI reads one snapshot (matches web GameScreen).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { gridFromBoardMode } from "@/lib/game/boardConfig";
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
}

function emptyBoardForMode(mode: string): Room["board"] {
  const n = gridFromBoardMode(mode);
  return Array.from({ length: n }, () => Array.from({ length: n }, () => null));
}

function mergeRbPayload(
  prev: Room,
  payload: Record<string, unknown>,
): Room {
  const next: Room = { ...prev, rb_phase_payload: payload };
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
          setRoom(msg.room);
          syncRbPhase(msg.room.phase);
          if (isRbPhase(msg.room.phase ?? "")) setRbPhase(msg.room.phase as RbPhase);
          else if (!msg.room.awaiting_rulebreaker) setRbPhase(null);
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
    [syncRbPhase],
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

  const placeStone = useCallback((row: number, col: number) => {
    socketRef.current?.send({ type: "move", row, col });
  }, []);

  const readyForNextGame = useCallback(() => {
    socketRef.current?.send({ type: "ready", ready: true });
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
    lbState,
    sendLimitbreakerAction,
    matchResult,
    dismissMatchResult,
    rulesReady,
    sendLevelupReady,
  };
}
