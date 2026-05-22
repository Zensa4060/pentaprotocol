/**
 * AI Engine match — human P1 vs server bot P2 via ``/api/bot/move``.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import { BotMoveError, requestBotMove, type EngineDifficulty } from "@/lib/botApi/botMove";
import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import {
  buildMoveLogEntry,
  isBlockedCenterOpening,
  resolveTurnAfterMove,
  type MoveLogEntry,
} from "@/lib/game/matchRules7";
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
  const [extraTurns, setExtraTurns] = useState(0);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [centerRuleHint, setCenterRuleHint] = useState(true);
  const [botThinking, setBotThinking] = useState(false);
  const [botError, setBotError] = useState<string | null>(null);
  const [botRetryTick, setBotRetryTick] = useState(0);

  const boardRef = useRef(board);
  const movesRef = useRef(movesPlayed);
  const extraRef = useRef(extraTurns);
  const statusRef = useRef<MatchStatus>("playing");
  const retryAfterRef = useRef(0);
  boardRef.current = board;
  movesRef.current = movesPlayed;
  extraRef.current = extraTurns;
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
      statusRef.current = nextResult.status;
    },
    [],
  );

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

      let next: Player = player;
      let newExtra = 0;
      if (nextResult.status === "playing") {
        const turn = resolveTurnAfterMove(
          player,
          newMoves,
          r,
          c,
          extraRef.current,
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
        newMoves === 1 && r === 3 && c === 3,
      );
      commitState(newBoard, newMoves, [r, c], nextResult, next, newExtra, logEntry);
      return nextResult;
    },
    [commitState, patterns],
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

      if (isBlockedCenterOpening(movesRef.current, 3, 3, false)) {
        /* rulebreaker C3 block — not used on mobile v1 */
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

        if (mv && isBlockedCenterOpening(movesRef.current, mv.row, mv.col, false)) {
          retryAfterRef.current = Date.now() + 350;
          setMoveLog((l) => [
            ...l.slice(-18),
            { text: "BOT tried blocked C3 — retrying.", player: "P2" },
          ]);
          setTimeout(() => setBotRetryTick((n) => n + 1), 350);
          return;
        }

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
    statusRef.current = "playing";
  }, []);

  const dismissBotError = useCallback(() => setBotError(null), []);

  const extraTurnsHolder =
    result.status === "playing" && extraTurns > 0 ? current : null;

  const inputEnabled = !botThinking && result.status === "playing" && current === "P1";

  return {
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
