/**
 * Training practice match — local only, 5×5 / 6×6 / 7×7.
 */

import { useCallback, useRef, useState } from "react";

import {
  centerCell,
  defaultPatternsForGrid,
  emptyBoard,
  type GridSize,
} from "@/lib/game/boardConfig";
import {
  buildMoveLogEntry,
  resolveTurnAfterMove,
  type MoveLogEntry,
} from "@/lib/game/matchRules";
import { checkWinForGrid, type Board, type Coord } from "@/lib/game/winCheck";

export type Player = "P1" | "P2";
export type MatchStatus = "playing" | "won" | "draw";

export interface MatchResult {
  status: MatchStatus;
  winner: Player | null;
  line: Coord[] | null;
  connectionScores?: { p1: number; p2: number };
}

export interface PracticeMatch {
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
  inputEnabled: boolean;
  canUndo: boolean;
  place: (row: number, col: number) => void;
  undo: () => void;
  reset: () => void;
}

export interface UsePracticeMatchOptions {
  gridSize?: GridSize;
  patterns?: string[];
}

type Snapshot = {
  board: Board;
  current: Player;
  movesPlayed: number;
  lastMove: Coord | null;
  result: MatchResult;
  extraTurns: number;
  moveLog: MoveLogEntry[];
  centerRuleHint: boolean;
};

const INITIAL_RESULT: MatchResult = { status: "playing", winner: null, line: null };

export function usePracticeMatch({
  gridSize = 5,
  patterns: patternsProp,
}: UsePracticeMatchOptions = {}): PracticeMatch {
  const patterns = patternsProp ?? defaultPatternsForGrid(gridSize);
  const center = centerCell(gridSize);

  const [board, setBoard] = useState<Board>(() => emptyBoard(gridSize));
  const [current, setCurrent] = useState<Player>("P1");
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [lastMove, setLastMove] = useState<Coord | null>(null);
  const [result, setResult] = useState<MatchResult>(INITIAL_RESULT);
  const [extraTurns, setExtraTurns] = useState(0);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [centerRuleHint, setCenterRuleHint] = useState(true);
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
        extraTurns,
        moveLog: [...moveLog],
        centerRuleHint,
      });

      const newBoard = board.map((row) => [...row]);
      newBoard[r][c] = current;
      const newMoves = movesPlayed + 1;
      const winRes = checkWinForGrid(gridSize, newBoard, r, c, current, newMoves, patterns);

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

      let next = current;
      let newExtra = 0;
      if (nextResult.status === "playing") {
        const turn = resolveTurnAfterMove(
          current,
          newMoves,
          r,
          c,
          extraTurns,
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
        current,
        gridSize !== 6 && newMoves === 1 && r === center && c === center,
      );

      setBoard(newBoard);
      setMovesPlayed(newMoves);
      setLastMove([r, c]);
      setResult(nextResult);
      setExtraTurns(newExtra);
      setMoveLog((l) => [...l, logEntry]);
      if (nextResult.status === "playing") setCurrent(next);
    },
    [
      board,
      center,
      centerRuleHint,
      current,
      extraTurns,
      gridSize,
      lastMove,
      moveLog,
      movesPlayed,
      patterns,
      result,
    ],
  );

  const undo = useCallback(() => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    setBoard(snap.board);
    setCurrent(snap.current);
    setMovesPlayed(snap.movesPlayed);
    setLastMove(snap.lastMove);
    setResult(snap.result);
    setExtraTurns(snap.extraTurns);
    setMoveLog(snap.moveLog);
    setCenterRuleHint(snap.centerRuleHint);
  }, []);

  const reset = useCallback(() => {
    setBoard(emptyBoard(gridSize));
    setCurrent("P1");
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    setExtraTurns(0);
    setMoveLog([]);
    setCenterRuleHint(true);
    undoStack.current = [];
  }, [gridSize]);

  const extraTurnsHolder =
    result.status === "playing" && extraTurns > 0 ? current : null;

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
    inputEnabled: result.status === "playing",
    canUndo: undoStack.current.length > 0 && result.status === "playing",
    place,
    undo,
    reset,
  };
}
