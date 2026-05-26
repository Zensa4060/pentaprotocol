/**
 * AI Engine match — human P1 vs server bot P2 via ``POST /api/bot/move``.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import { BotMoveError, requestBotMove, type EngineDifficulty } from "@/lib/botApi/botMove";
import {
  boardModeFromGrid,
  centerCell,
  defaultPatternsForGrid,
  emptyBoard,
  type GridSize,
} from "@/lib/game/boardConfig";
import {
  buildMoveLogEntry,
  isBlockedCenterOpening,
  resolveTurnAfterMove,
  type MoveLogEntry,
} from "@/lib/game/matchRules";
import { checkWinForGrid, type Board, type Coord } from "@/lib/game/winCheck";

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
  gridSize?: GridSize;
  patterns?: string[];
}

export interface EngineMatch {
  gridSize: GridSize;
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
  extraTurns: number;
  extraTurnsHolder: Player | null;
  moveLog: MoveLogEntry[];
  centerRuleHint: boolean;
  botThinking: boolean;
  botError: string | null;
  inputEnabled: boolean;
  placeHuman: (row: number, col: number) => void;
  reset: () => void;
  dismissBotError: () => void;
}

const INITIAL_RESULT: MatchResult = { status: "playing", winner: null, line: null };

export function useEngineMatch({
  difficulty,
  gridSize = 7,
  patterns: patternsProp,
}: UseEngineMatchOptions): EngineMatch {
  const patterns = patternsProp ?? defaultPatternsForGrid(gridSize);
  const center = centerCell(gridSize);
  const boardMode = boardModeFromGrid(gridSize);

  const [board, setBoard] = useState<Board>(() => emptyBoard(gridSize));
  const [current, setCurrent] = useState<Player>("P1");
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [result, setResult] = useState<MatchResult>(INITIAL_RESULT);
  const [extraTurns, setExtraTurns] = useState(0);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [centerRuleHint, setCenterRuleHint] = useState(true);
  const [botThinking, setBotThinking] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [botRetryTick, setBotRetryTick] = useState(0);

  const boardRef = useRef(board);
  const movesRef = useRef(movesPlayed);
  const extraRef = useRef(extraTurns);
  const currentRef = useRef(current);
  const statusRef = useRef<MatchStatus>("playing");
  const retryAfterRef = useRef(0);
  boardRef.current = board;
  movesRef.current = movesPlayed;
  extraRef.current = extraTurns;
  currentRef.current = current;
  statusRef.current = result.status;

  const commitState = useCallback(
    (
      newBoard: Board,
      newMoves: number,
      coord: Coord,
      nextResult: MatchResult,
      next: Player,
      newExtra: number,
      logEntry: MoveLogEntry,
    ) => {
      setBoard(newBoard);
      setMovesPlayed(newMoves);
      setLastMove(coord);
      setResult(nextResult);
      setCurrent(next);
      setExtraTurns(newExtra);
      setMoveLog((l) => [...l, logEntry]);
      boardRef.current = newBoard;
      movesRef.current = newMoves;
      extraRef.current = newExtra;
      currentRef.current = next;
      statusRef.current = nextResult.status;
    },
    [],
  );

  const applyMove = useCallback(
    (player: Player, r: number, c: number): MatchResult => {
      const newBoard = boardRef.current.map((row) => [...row]);
      newBoard[r][c] = player;
      const newMoves = movesRef.current + 1;
      const winRes = checkWinForGrid(
        gridSize,
        newBoard,
        r,
        c,
        player,
        newMoves,
        patterns,
      );

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

      let next: Player = player;
      let newExtra = 0;
      if (nextResult.status === "playing") {
        const turn = resolveTurnAfterMove(
          player,
          newMoves,
          r,
          c,
          extraRef.current,
          gridSize,
        );
        next = turn.next;
        newExtra = turn.extraTurns;
        if (turn.centerBonus) setCenterRuleHint(false);
      }

      const logEntry = buildMoveLogEntry(
        newMoves,
        r,
        c,
        player,
        newMoves === 1 && r === center && c === center,
      );
      commitState(newBoard, newMoves, [r, c], nextResult, next, newExtra, logEntry);
      return nextResult;
    },
    [center, commitState, gridSize, patterns],
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
          board_mode: boardMode,
          selected_patterns: patterns,
          moves_played: movesRef.current,
        });
        if (cancelled) return;

        if (
          mv &&
          isBlockedCenterOpening(movesRef.current, mv.row, mv.col, false, gridSize)
        ) {
          retryAfterRef.current = Date.now() + 350;
          setMoveLog((l) => [
            ...l.slice(-18),
            { text: "BOT tried blocked center — retrying.", player: "P2" },
          ]);
          setTimeout(() => setBotRetryTick((n) => n + 1), 350);
          return;
        }

        retryAfterRef.current = 0;
        setBotError(null);
        if (mv) {
          applyMove("P2", mv.row, mv.col);
          if (
            statusRef.current === "playing" &&
            currentRef.current === "P2" &&
            extraRef.current > 0
          ) {
            setTimeout(() => setBotRetryTick((n) => n + 1), 120);
            return;
          }
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
  }, [
    applyMove,
    boardMode,
    botRetryTick,
    current,
    difficulty,
    extraTurns,
    gridSize,
    movesPlayed,
    patterns,
    result.status,
  ]);

  const reset = useCallback(() => {
    const fresh = emptyBoard(gridSize);
    setBoard(fresh);
    setCurrent("P1");
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    setExtraTurns(0);
    setMoveLog([]);
    setCenterRuleHint(true);
    setBotThinking(false);
    setBotError(null);
    retryAfterRef.current = 0;
    setBotRetryTick(0);
    boardRef.current = fresh;
    movesRef.current = 0;
    extraRef.current = 0;
    currentRef.current = "P1";
    statusRef.current = "playing";
  }, [gridSize]);

  const dismissBotError = useCallback(() => setBotError(null), []);

  const extraTurnsHolder =
    result.status === "playing" && extraTurns > 0 ? current : null;

  const inputEnabled = !botThinking && result.status === "playing" && current === "P1";

  return {
    gridSize,
    board,
    current,
    movesPlayed,
    lastMove,
    result,
    extraTurns,
    extraTurnsHolder,
    moveLog,
    centerRuleHint,
    botThinking,
    botError,
    inputEnabled,
    placeHuman,
    reset,
    dismissBotError,
  };
}
