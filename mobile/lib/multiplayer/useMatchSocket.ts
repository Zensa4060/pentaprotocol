/**
 * ``useMatchSocket`` — React hook around ``openMatchSocket``.
 *
 * The match screen calls this with a ``roomCode`` + ``slot`` and
 * gets back:
 *   - The latest room snapshot (mirrors what the server holds).
 *   - The current connection status.
 *   - Typed action functions (``placeStone``, ``readyForNextGame``,
 *     ``quitMatch``).
 *   - A "last error" string surfaced by the server (e.g. "Not your
 *     turn") so the UI can flash it.
 *
 * State management strategy:
 *   - We treat server frames as the source of truth. A ``move_made``
 *     frame brings the full board / current_player / winner / etc.,
 *     so we replace the relevant slice atomically rather than
 *     trying to apply moves locally and reconcile (the web frontend
 *     learned that the hard way — see GameScreen).
 *   - We do NOT optimistically render the local user's move. Round
 *     trip on a typical mobile network is 80-150ms, well under what
 *     the eye reads as lag, and the optimistic path adds a whole
 *     "rollback on reject" code path we don't need for MVP.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  openMatchSocket,
  type MatchSocket,
  type WsConnectionStatus,
} from "./ws";

import { isRbPhase, type RbPhase } from "./rulebreakerPhases";
import type {
  InboundMessage,
  PlayerSlot,
  Room,
} from "./types";

export interface UseMatchSocketOptions {
  roomCode: string;
  slot: PlayerSlot;
  /** Optional seed from the create/join REST call — paints the UI immediately. */
  initialRoom?: Room | null;
}

export interface UseMatchSocketResult {
  /** Latest room snapshot, or null until the first frame lands. */
  room: Room | null;
  /** WS lifecycle state. */
  status: WsConnectionStatus;
  /** Last server-reported error message (e.g. "Not your turn"). */
  lastError: string | null;
  /** Sticky "match was disbanded by server" flag — set on disband/disconnect. */
  disbanded: { reason?: string } | null;
  /** True once the server has emitted ``match_start``. */
  matchStarted: boolean;

  /** Place a stone in the current game. Caller filters by turn. */
  placeStone: (row: number, col: number) => void;
  /** Tell the server we're ready for the next game in the series. */
  readyForNextGame: () => void;
  /** Send a ``quit_match`` frame — voluntary forfeit. */
  quitMatch: (reason?: string) => void;
  /** Tell the server whether we're currently looking at the game screen. */
  setOnGameScreen: (on: boolean) => void;
  /** Clear ``lastError`` so the UI banner dismisses. */
  dismissError: () => void;
  /** Active protocol-breaker phase, if any. */
  rbPhase: RbPhase | null;
  sendTossAction: (action: string, payload?: Record<string, unknown>) => void;
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
  const [rbTossWinner, setRbTossWinner] = useState<PlayerSlot | null>(null);
  const [rbCoinResult, setRbCoinResult] = useState<"PENTA" | "PROTO" | null>(null);

  const socketRef = useRef<MatchSocket | null>(null);
  // We need stable references to the callbacks inside ``openMatchSocket``
  // (which only takes them once at construction). Refs let us keep
  // a fresh closure without rebuilding the socket on every state tick.
  const roomRef = useRef(room);
  roomRef.current = room;

  // ── Message router ──────────────────────────────────────────
  // Centralized: every inbound type lands here, the dispatch table
  // mutates the appropriate piece of state. Easier to follow + a
  // single place to add new message kinds later.
  const onMessage = useCallback(
    (msg: InboundMessage) => {
      switch (msg.type) {
        case "room_state":
        case "player_joined": {
          setRoom(msg.room);
          if (isRbPhase(msg.room.phase)) setRbPhase(msg.room.phase);
          else if (!msg.room.awaiting_rulebreaker) setRbPhase(null);
          if (msg.room.rb_toss_winner) setRbTossWinner(msg.room.rb_toss_winner);
          if (msg.room.rb_coin_result) setRbCoinResult(msg.room.rb_coin_result);
          break;
        }
        case "rulebreaker_start": {
          setRbPhase("rb_splash");
          if (msg.toss_winner) setRbTossWinner(msg.toss_winner);
          setRbCoinResult(null);
          break;
        }
        case "toss_action": {
          const payload = msg.payload ?? {};
          if (msg.action === "coin_result") {
            const r = payload.result as "PENTA" | "PROTO" | undefined;
            if (r) setRbCoinResult(r);
            const tw = payload.toss_winner as PlayerSlot | undefined;
            if (tw) setRbTossWinner(tw);
            setRbPhase("rb_coin");
          } else if (msg.action === "start_rb") {
            setRbPhase("rb_splash");
          } else if (msg.action === "phase_choice" && typeof payload.phase === "string") {
            if (isRbPhase(payload.phase)) setRbPhase(payload.phase);
          }
          break;
        }
        case "move_made": {
          // Patch the slice of the room the frame carries. Anything
          // the frame doesn't include (player metadata, format,
          // etc.) is left untouched.
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
          // Fresh game in the same series — clear the board state.
          setRoom((prev) => {
            if (!prev) return prev;
            const emptySize = msg.board_mode === "5x5" ? 5 : msg.board_mode === "6x6" ? 6 : 7;
            const emptyBoard = Array.from({ length: emptySize }, () =>
              Array.from({ length: emptySize }, () => null),
            );
            return {
              ...prev,
              board: emptyBoard,
              current_player: msg.first_player,
              moves_played: 0,
              winner: null,
              game_status: "playing",
              game_number: msg.game_number,
              board_mode: msg.board_mode,
              awaiting_rulebreaker: false,
              phase: undefined,
            };
          });
          setRbPhase(null);
          break;
        }
        case "match_start": {
          setMatchStarted(true);
          break;
        }
        case "match_over": {
          // No state to mutate — the preceding move_made already
          // delivered series_winner. This frame is a heads-up that
          // the room is wrapping up.
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
          // Ignored types: chat, ready_update, net_update, levelup_*,
          // player_reconnect_countdown, pong, rulebreaker_start, etc.
          // We just no-op so future server-side additions don't
          // break the client.
          break;
      }
    },
    [],
  );

  // ── Connect / disconnect lifecycle ─────────────────────────
  useEffect(() => {
    setRoom(initialRoom);
    setStatus("connecting");
    setLastError(null);
    setDisbanded(null);
    setMatchStarted(false);

    const socket = openMatchSocket({
      roomCode,
      slot,
      onMessage,
      onStatus: (next, detail) => {
        setStatus(next);
        if (next === "open") {
          // Fire-and-forget: tell the server we're ready to start.
          // Idempotent server-side, so no harm if we send it twice
          // on a reconnect (and the second time the game's already
          // in progress, it's just ignored).
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
    // Intentionally not depending on `onMessage` / `initialRoom`:
    // the socket reconnect logic is keyed only on the room/slot
    // pair. Changes to handlers would force an unnecessary
    // teardown of the live connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, slot]);

  // ── Public actions ─────────────────────────────────────────

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
  }, []);

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
  };
}
