/**
 * Training practice match — local only, no bot, no API.
 *
 * Mirrors web ``gameMode === "singleplayer"``: you alternate P1 / P2
 * on the same device to learn patterns. Optional undo stack like the
 * web training flow.
 */

import { useCallback, useRef, useState } from "react";

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
  winner: Player | null;
  line: Coord[] | null;
  connectionScores?: { p1: number; p2: number };
}

export interface PracticeMatch {
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
  inputEnabled: boolean;
  canUndo: boolean;
  place: (row: number, col: number) => void;
  undo: () => void;
  reset: () => void;
}

type Snapshot = {
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
};

function emptyBoard(): Board {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => null));
}

const INITIAL_RESULT: MatchResult = { status: "playing", winner: null, line: null };

export function usePracticeMatch(patterns = DEFAULT_PATTERNS_7): PracticeMatch {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [current, setCurrent] = useState<Player>("P1");
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [result, setResult] = useState<MatchResult>(INITIAL_RESULT);
  const undoStack = useRef<Snapshot[]>([]);

  const place = useCallback(
    (r: number, c: number) => {
      if (result.status !== "playing") return;
      if (board[r]?.[c] !== null) return;

      undoStack.current.push({
        board: board.map((row) => [...row]),
        current,
        movesPlayed,
        lastMove,
        result,
      });

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = current;
      const newMoves = movesPlayed + 1;
      const winRes = checkWin7(newBoard, r, c, current, newMoves, patterns);

      let nextResult: MatchResult = INITIAL_RESULT;
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
      }

      setBoard(newBoard);
      setMovesPlayed(newMoves);
      setLastMove([r, c]);
      setResult(nextResult);
      if (nextResult.status === "playing") {
        setCurrent(current === "P1" ? "P2" : "P1");
      }
    },
    [board, current, lastMove, movesPlayed, patterns, result],
  );

  const undo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    setBoard(snap.board);
    setCurrent(snap.current);
    setMovesPlayed(snap.movesPlayed);
    setLastMove(snap.lastMove);
    setResult(snap.result);
  }, []);

  const reset = useCallback(() => {
    const fresh = emptyBoard();
    setBoard(fresh);
    setCurrent("P1");
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    undoStack.current = [];
  }, []);

  return {
    board,
    current,
    movesPlayed,
    lastMove,
    result,
    inputEnabled: result.status === "playing",
    canUndo: undoStack.current.length > 0 && result.status === "playing",
    place,
    undo,
    reset,
  };
}
