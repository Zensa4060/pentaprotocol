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
import type { GameResetOptions } from "@/lib/hooks/seriesConfig";
import {
  buildMoveLogEntry,
  isBlockedCenterOpening,
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
  /** Start a fresh game — optional breaker / leg reset options. */
  reset: (starter?: Player, opts?: GameResetOptions) => void;
  activePatterns: string[];
  c3Blocked: boolean;
  /** Mindbreaker extra-turn token (7×7 decider only). */
  extraTokenHolder: Player | null;
  extraTokenUsed: boolean;
  useExtraTurnToken: () => void;
  suppressCenterOpening: boolean;
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
  gridSize: initialGrid = 5,
  patterns: patternsProp,
}: UsePracticeMatchOptions = {}): PracticeMatch {
  const [liveGrid, setLiveGrid] = useState<GridSize>(initialGrid);
  const [patterns, setPatterns] = useState<string[]>(
    () => patternsProp ?? defaultPatternsForGrid(initialGrid),
  );
  const [c3Blocked, setC3Blocked] = useState(false);
  const [patternsP1, setPatternsP1] = useState<string[] | null>(null);
  const [patternsP2, setPatternsP2] = useState<string[] | null>(null);
  const [specialCell, setSpecialCell] = useState<
    { r: number; c: number; owner: Player } | null
  >(null);
  const [suppressCenterOpening, setSuppressCenterOpening] = useState(false);
  const [extraTokenHolder, setExtraTokenHolder] = useState<Player | null>(null);
  const [extraTokenUsed, setExtraTokenUsed] = useState(false);
  const center = centerCell(liveGrid);

  const [board, setBoard] = useState<Board>(() => emptyBoard(initialGrid));
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
      if (isBlockedCenterOpening(movesPlayed, r, c, c3Blocked, liveGrid)) return;

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
      // Timebreaker special cell: any stone placed there materialises as
      // the owner's symbol (web parity — the trap converts the stone).
      const rbTrap =
        liveGrid === 6 && specialCell && specialCell.r === r && specialCell.c === c;
      const stoneOwner: Player = rbTrap ? specialCell!.owner : current;
      newBoard[r][c] = stoneOwner;
      const newMoves = movesPlayed + 1;
      const ownerPatterns =
        stoneOwner === "P1" ? patternsP1 ?? patterns : patternsP2 ?? patterns;
      const winRes = checkWinForGrid(
        liveGrid, newBoard, r, c, stoneOwner, newMoves, ownerPatterns,
      );

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
          liveGrid,
          { suppressCenterOpening },
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
        !suppressCenterOpening &&
          liveGrid !== 6 &&
          newMoves === 1 &&
          r === center &&
          c === center,
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
      c3Blocked,
      current,
      extraTurns,
      liveGrid,
      lastMove,
      moveLog,
      movesPlayed,
      patterns,
      patternsP1,
      patternsP2,
      result,
      specialCell,
      suppressCenterOpening,
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

  const reset = useCallback((starter: Player = "P1", opts?: GameResetOptions) => {
    const grid = opts?.gridSize ?? liveGrid;
    if (opts?.gridSize) setLiveGrid(opts.gridSize);
    if (opts?.patterns) setPatterns(opts.patterns);
    setC3Blocked(opts?.c3Blocked ?? false);
    setPatternsP1(opts?.patternsP1 ?? null);
    setPatternsP2(opts?.patternsP2 ?? null);
    setSpecialCell(opts?.rb6SpecialCell ?? null);
    setSuppressCenterOpening(opts?.suppressCenterOpening ?? false);
    setExtraTokenHolder(opts?.extraTurnTokenHolder ?? null);
    setExtraTokenUsed(false);
    setBoard(emptyBoard(grid));
    setCurrent(starter);
    setMovesPlayed(0);
    setLastMove(null);
    setResult(INITIAL_RESULT);
    setExtraTurns(0);
    setMoveLog([]);
    setCenterRuleHint(true);
    undoStack.current = [];
  }, [liveGrid]);

  // Mindbreaker token: the holder cashes it on their own turn for one
  // bonus consecutive move (extraTurns=2 ⇒ this move + one more).
  const useExtraTurnToken = useCallback(() => {
    if (result.status !== "playing") return;
    if (!extraTokenHolder || extraTokenUsed) return;
    if (extraTurns !== 0) return;
    if (current !== extraTokenHolder) return;
    setExtraTurns(2);
    setExtraTokenUsed(true);
  }, [current, extraTokenHolder, extraTokenUsed, extraTurns, result.status]);

  const extraTurnsHolder =
    result.status === "playing" && extraTurns > 0 ? current : null;

  return {
    gridSize: liveGrid,
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
    activePatterns: patterns,
    c3Blocked,
    extraTokenHolder,
    extraTokenUsed,
    useExtraTurnToken,
    suppressCenterOpening,
  };
}
