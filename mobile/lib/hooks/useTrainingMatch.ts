/**
 * ``useTrainingMatch`` — offline single-match state machine.
 *
 * Owns the entire training-match lifecycle:
 *   - Empty 7×7 board.
 *   - Alternating turns (human is always P1, bot is always P2 in
 *     v1 — side-pick lands in a later phase).
 *   - Win detection after every move (via ``checkWin7``).
 *   - Bot move scheduling: when it becomes P2's turn we schedule
 *     ``getBotMove7`` after a small UI-shielding delay (so the
 *     human's stone paints before the bot starts thinking).
 *   - Reset / restart (same difficulty, fresh board).
 *
 * The hook deliberately does NOT integrate with the API, the
 * backend ``/api/bot/move`` route, or the auth store. Training is
 * an offline experience — keeping it pure means it works on
 * planes and in the subway, and the engine is testable in
 * isolation. Career-tracking integration (record wins against
 * bots in ``user.bot_defeats``) is a Phase 6 hook on top.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

import {
  BOT_DELAY_7,
  type BotDifficulty,
  getBotMove7,
} from "@/lib/game/botEngine7";
import { DEFAULT_PATTERNS_7 } from "@/lib/game/patterns7";
import {
  checkWin7,
  type Board,
  type Coord,
} from "@/lib/game/winChecker7";

const GRID = 7;

export type Player = "P1" | "P2";
export type MatchStatus = "playing" | "won" | "draw";

export interface MatchResult {
  status: MatchStatus;
  /** Winner player, or null on draw / still playing. */
  winner: Player | null;
  /** Cells that triggered the win, for board highlight. */
  line: Coord[] | null;
  /** Connection scores when resolved by full-board chain. */
  connectionScores?: { p1: number; p2: number };
}

export interface UseTrainingMatchOptions {
  difficulty: BotDifficulty;
  /** Patterns enabled for this match. Defaults to all 8 (v1 ships no picker). */
  patterns?: string[];
}

export interface TrainingMatch {
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
  botThinking: boolean;
  /** Inverse of ``botThinking || result.status !== 'playing'``. */
  inputEnabled: boolean;
  /** Place a stone for the *human* (P1). Ignored if illegal/disabled. */
  placeHuman: (row: number, col: number) => void;
  /** Wipe the board and start a new match with the same difficulty. */
  reset: () => void;
}

function emptyBoard(): Board {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
}

const INITIAL_RESULT: MatchResult = { status: "playing", winner: null, line: null };

export function useTrainingMatch({
  difficulty,
  patterns = DEFAULT_PATTERNS_7,
}: UseTrainingMatchOptions): TrainingMatch {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [current, setCurrent] = useState<Player>("P1");
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [result, setResult] = useState<MatchResult>(INITIAL_RESULT);
  const [botThinking, setBotThinking] = useState(false);

  // Ref mirrors so closures (timeouts, interaction handles) always
  // see the latest board state without forcing a re-subscription.
  const boardRef = useRef(board);
  const movesRef = useRef(movesPlayed);
  const statusRef = useRef<MatchStatus>("playing");
  boardRef.current = board;
  movesRef.current = movesPlayed;
  statusRef.current = result.status;

  /**
   * Apply a move from any source (human or bot). Centralized so
   * both code paths run the same win check + state transition.
   * Returns the new ``MatchResult`` so the caller can decide
   * whether to schedule the next turn.
   */
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

      // Mirror refs immediately so a follow-up call within the
      // same microtask sees the new state.
      boardRef.current = newBoard;
      movesRef.current = newMoves;
      statusRef.current = nextResult.status;

      return nextResult;
    },
    [patterns],
  );

  /** Human (P1) tries to place a stone. Validated, then applied. */
  const placeHuman = useCallback(
    (r: number, c: number) => {
      if (statusRef.current !== "playing") return;
      if (botThinking) return;
      if (current !== "P1") return;
      if (boardRef.current[r]?.[c] !== null) return;
      applyMove("P1", r, c);
    },
    [applyMove, botThinking, current],
  );

  // ── Bot turn ───────────────────────────────────────────────────
  // When it becomes P2's turn and the game's still live, schedule
  // a bot move. ``InteractionManager.runAfterInteractions`` lets the
  // human's stone paint + animation settle before we hog the JS
  // thread with the negamax search. We then apply the bot's move
  // through the same ``applyMove`` path so win logic is shared.
  useEffect(() => {
    if (current !== "P2") return;
    if (result.status !== "playing") return;

    let cancelled = false;
    setBotThinking(true);

    const startedAt = Date.now();
    const minDelay = BOT_DELAY_7[difficulty];

    const handle = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      // Synchronous engine call. For "hard" this can take up to
      // 4 seconds — that's expected; the spinner in the match
      // screen tells the user the bot's working.
      const mv = getBotMove7(boardRef.current, "P2", "P1", difficulty, patterns);
      if (cancelled) return;

      const finish = () => {
        if (cancelled) return;
        if (mv) {
          applyMove("P2", mv[0], mv[1]);
        }
        setBotThinking(false);
      };

      // Pad to ``minDelay`` so the "thinking" UI is at least
      // perceivable on easy mode (where the search is essentially
      // free and would otherwise feel jumpy).
      const elapsed = Date.now() - startedAt;
      if (elapsed >= minDelay) {
        finish();
      } else {
        setTimeout(finish, minDelay - elapsed);
      }
    });

    return () => {
      cancelled = true;
      handle.cancel();
      setBotThinking(false);
    };
  }, [applyMove, current, difficulty, patterns, result.status]);

  const reset = useCallback(() => {
    const fresh = emptyBoard();
    setBoard(fresh);
    setCurrent("P1");
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    setBotThinking(false);
    boardRef.current = fresh;
    movesRef.current = 0;
    statusRef.current = "playing";
  }, []);

  const inputEnabled = !botThinking && result.status === "playing" && current === "P1";

  return {
    board,
    current,
    movesPlayed,
    lastMove,
    result,
    botThinking,
    inputEnabled,
    placeHuman,
    reset,
  };
}
