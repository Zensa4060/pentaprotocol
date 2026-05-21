/**
 * AI Engine match — human P1 vs server bot P2 via ``/api/bot/move``.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import { BotMoveError, requestBotMove, type EngineDifficulty } from "@/lib/botApi/botMove";
import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import {
  checkWin7,
  type Board,
  type Coord,
} from "@/lib/game/winChecker7";

const GRID = 7;
const BOT_RETRY_MS = 1200;

export type Player = "P1" | "P2";
export type MatchStatus = "playing" | "won" | "draw";

export interface MatchResult {
  status: MatchStatus;
  winner: Player | null;
  line: Coord[] | null;
  connectionScores?: { p1: number; p2: number };
}

export interface UseEngineMatchOptions {
  difficulty: EngineDifficulty;
  patterns?: string[];
}

export interface EngineMatch {
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
  botThinking: boolean;
  botError: string | null;
  inputEnabled: boolean;
  placeHuman: (row: number, col: number) => void;
  reset: () => void;
  dismissBotError: () => void;
}

function emptyBoard(): Board {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
}

const INITIAL_RESULT: MatchResult = { status: "playing", winner: null, line: null };

export function useEngineMatch({
  difficulty,
  patterns = DEFAULT_PATTERNS_7,
}: UseEngineMatchOptions): EngineMatch {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [current, setCurrent] = useState<Player>("P1");
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [result, setResult] = useState<MatchResult>(INITIAL_RESULT);
  const [botThinking, setBotThinking] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [botRetryTick, setBotRetryTick] = useState(0);

  const boardRef = useRef(board);
  const movesRef = useRef(movesPlayed);
  const statusRef = useRef<MatchStatus>("playing");
  const retryAfterRef = useRef(0);
  boardRef.current = board;
  movesRef.current = movesPlayed;
  statusRef.current = result.status;

  const applyMove = useCallback(
    (player: Player, r: number, c: number): MatchResult => {
      const newBoard = boardRef.current.map((row) => [...row]);
      newBoard[r][c] = player;
      const newMoves = movesRef.current + 1;
      const winRes = checkWin7(newBoard, r, c, player, newMoves, patterns);

      let nextResult: MatchResult;
      if (winRes) {
        if (winRes.winner === "DRAW") {
          nextResult = {
            status: "draw",
            winner: null,
            line: null,
            connectionScores: winRes.connectionScores,
          };
        } else {
          nextResult = {
            status: "won",
            winner: winRes.winner as Player,
            line: winRes.line,
            connectionScores: winRes.connectionScores,
          };
        }
      } else {
        nextResult = INITIAL_RESULT;
      }

      setBoard(newBoard);
      setMovesPlayed(newMoves);
      setLastMove([r, c]);
      setResult(nextResult);
      setCurrent(player === "P1" ? "P2" : "P1");
      boardRef.current = newBoard;
      movesRef.current = newMoves;
      statusRef.current = nextResult.status;
      return nextResult;
    },
    [patterns],
  );

  const placeHuman = useCallback(
    (r: number, c: number) => {
      if (statusRef.current !== "playing") return;
      if (botThinking) return;
      if (current !== "P1") return;
      if (boardRef.current[r]?.[c] !== null) return;
      setBotError(null);
      applyMove("P1", r, c);
    },
    [applyMove, botThinking, current],
  );

  useEffect(() => {
    if (current !== "P2") return;
    if (result.status !== "playing") return;

    let cancelled = false;
    setBotThinking(true);

    const runBotMove = async () => {
      if (cancelled) return;
      const wait = retryAfterRef.current - Date.now();
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
      }
      try {
        const mv = await requestBotMove({
          board: boardRef.current,
          difficulty,
          current_player: "P2",
          board_mode: "7x7",
          selected_patterns: patterns,
          moves_played: movesRef.current,
        });
        if (cancelled) return;
        retryAfterRef.current = 0;
        setBotError(null);
        if (mv) {
          applyMove("P2", mv.row, mv.col);
        } else {
          retryAfterRef.current = Date.now() + BOT_RETRY_MS;
          setBotError("Engine returned no move. Retrying…");
          setTimeout(() => setBotRetryTick((n) => n + 1), BOT_RETRY_MS);
        }
      } catch (err) {
        if (cancelled) return;
        retryAfterRef.current = Date.now() + BOT_RETRY_MS;
        const msg =
          err instanceof BotMoveError
            ? err.detail ?? err.message
            : "Bot service unavailable. Retrying…";
        setBotError(msg);
        setTimeout(() => setBotRetryTick((n) => n + 1), BOT_RETRY_MS);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    };

    const handle = InteractionManager.runAfterInteractions(() => {
      void runBotMove();
    });

    return () => {
      cancelled = true;
      handle.cancel();
      setBotThinking(false);
    };
  }, [applyMove, botRetryTick, current, difficulty, patterns, result.status]);

  const reset = useCallback(() => {
    const fresh = emptyBoard();
    setBoard(fresh);
    setCurrent("P1");
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    setBotThinking(false);
    setBotError(null);
    retryAfterRef.current = 0;
    setBotRetryTick(0);
    boardRef.current = fresh;
    movesRef.current = 0;
    statusRef.current = "playing";
  }, []);

  const dismissBotError = useCallback(() => setBotError(null), []);

  const inputEnabled = !botThinking && result.status === "playing" && current === "P1";

  return {
    board,
    current,
    movesPlayed,
    lastMove,
    result,
    botThinking,
    botError,
    inputEnabled,
    placeHuman,
    reset,
    dismissBotError,
  };
}
