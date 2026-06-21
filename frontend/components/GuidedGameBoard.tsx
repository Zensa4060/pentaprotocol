"use client";

/**
 * Guided game board — a scripted 5×5 / 6×6 / 7×7 board for the onboarding
 * "play & win" games. Generalised from `TutorialPracticeBoard`: the player
 * (P1) is shown the engine's best move as a pulsing ring and can only advance
 * through it; the opponent (P2) auto-replies; the win line is drawn on the
 * final move. Reports the active move index up so the parent can sync Syros's
 * narration, and rings the two dual-threat cells when asked.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { DemoMove } from "@/lib/tutorialContent";
import type { GuidedGame } from "@/lib/guidedGames";
import { getBotLabel } from "@/lib/botNames";
import type { BotId } from "@/lib/botRewards";
import { PieceGlyph } from "@/components/TutorialPiece";

const P2_DELAY_SLOW = 520;
const P2_DELAY_FAST = 180; // long connection games auto-play the opponent quickly
const SHAKE_MS = 360;
const DUAL_GOLD = "#FCD34D";

export interface GuidedGameBoardProps {
  game: GuidedGame;
  themeT: (typeof THEMES)[ThemeId];
  /** Fires whenever the active (next-to-play) move index changes. */
  onMoveIndex?: (idx: number, finished: boolean) => void;
  /** Fires once when the scripted game completes. */
  onComplete?: () => void;
  /** Ring these cells gold (the dual-threat lesson). */
  highlightCells?: Array<[number, number]>;
}

export default function GuidedGameBoard({
  game,
  themeT,
  onMoveIndex,
  onComplete,
  highlightCells,
}: GuidedGameBoardProps) {
  const t = themeT;
  const total = game.moves.length;
  const sz = game.size;

  const [moveIdx, setMoveIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const [wrongHint, setWrongHint] = useState(false);
  const shakeTimer = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Reset when the game changes.
  useEffect(() => {
    setMoveIdx(0);
    setShake(false);
    setWrongHint(false);
    completedRef.current = false;
  }, [game.id]);

  useEffect(() => () => {
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
  }, []);

  const placedMoves: DemoMove[] = useMemo(
    () => game.moves.slice(0, moveIdx),
    [game.moves, moveIdx],
  );
  const nextMove = moveIdx < total ? game.moves[moveIdx] : null;
  const finished = moveIdx >= total;
  const p2Delay = total > 20 ? P2_DELAY_FAST : P2_DELAY_SLOW;

  // Report progress + completion to the parent.
  useEffect(() => {
    onMoveIndex?.(moveIdx, finished);
    if (finished && !completedRef.current) {
      completedRef.current = true;
      onComplete?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveIdx, finished]);

  // Auto-play the scripted P2 reply.
  useEffect(() => {
    if (!nextMove || nextMove.p !== "P2") return;
    const id = window.setTimeout(() => setMoveIdx((i) => i + 1), p2Delay);
    return () => window.clearTimeout(id);
  }, [nextMove, p2Delay]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setWrongHint(true);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(false), SHAKE_MS);
  }, []);

  const onCellClick = useCallback(
    (r: number, c: number) => {
      if (finished || !nextMove || nextMove.p !== "P1") return;
      const occupied = placedMoves.some((m) => m.r === r && m.c === c);
      if (occupied) return triggerShake();
      if (r === nextMove.r && c === nextMove.c) {
        setWrongHint(false);
        setMoveIdx((i) => i + 1);
      } else {
        triggerShake();
      }
    },
    [finished, nextMove, placedMoves, triggerShake],
  );

  // Cell sizing — big enough to dominate the onboarding screen.
  const CELL = sz === 5 ? 72 : sz === 6 ? 60 : 52;
  const W = CELL * sz;
  const p1TargetVisible = !!(nextMove && nextMove.p === "P1" && !finished);

  const hlSet = useMemo(
    () => new Set((highlightCells ?? []).map(([r, c]) => `${r},${c}`)),
    [highlightCells],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg
        width={W}
        height={W}
        style={{
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          background: t.boardBg,
          display: "block",
          transform: shake ? "translateX(-4px)" : "none",
          transition: shake ? "transform 80ms ease" : "transform 120ms ease",
          cursor: p1TargetVisible ? "pointer" : "default",
        }}
      >
        <rect x={0} y={0} width={W} height={W} fill={t.boardBg} />

        {Array.from({ length: sz + 1 }).map((_, i) => (
          <g key={`gr-${i}`}>
            <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={t.boardLine} strokeWidth={0.8} />
            <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={t.boardLine} strokeWidth={0.8} />
          </g>
        ))}

        {/* Click targets. */}
        {Array.from({ length: sz * sz }).map((_, idx) => {
          const r = Math.floor(idx / sz);
          const c = idx % sz;
          return (
            <rect
              key={`ht-${idx}`}
              x={c * CELL}
              y={r * CELL}
              width={CELL}
              height={CELL}
              fill="transparent"
              style={{ cursor: p1TargetVisible ? "pointer" : "default" }}
              onClick={() => onCellClick(r, c)}
            />
          );
        })}

        {/* Dual-threat rings. */}
        {!finished &&
          [...hlSet].map((k) => {
            const [r, c] = k.split(",").map(Number);
            return (
              <rect
                key={`hl-${k}`}
                x={c * CELL + 4}
                y={r * CELL + 4}
                width={CELL - 8}
                height={CELL - 8}
                rx={8}
                fill="none"
                stroke={DUAL_GOLD}
                strokeWidth={2.5}
                opacity={0.85}
                pointerEvents="none"
              >
                <animate attributeName="stroke-opacity" values="0.3;0.95;0.3" dur="1.5s" repeatCount="indefinite" />
              </rect>
            );
          })}

        {/* Next-target hint ring. */}
        {p1TargetVisible && nextMove && (
          <rect
            x={nextMove.c * CELL + 4}
            y={nextMove.r * CELL + 4}
            width={CELL - 8}
            height={CELL - 8}
            rx={7}
            fill="none"
            stroke={t.accent}
            strokeWidth={2.5}
            strokeDasharray="5 4"
            opacity={0.9}
            pointerEvents="none"
          >
            <animate attributeName="stroke-opacity" values="0.35;1;0.35" dur="1.4s" repeatCount="indefinite" />
          </rect>
        )}

        {/* Winning connection chain — drawn under the stones. */}
        {finished && game.winPath && game.winPath.length > 1 && (
          <polyline
            points={game.winPath.map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`).join(" ")}
            fill="none"
            stroke={game.outcome === "DRAW" ? t.textMuted : t.accent}
            strokeOpacity={game.outcome === "DRAW" ? 0.4 : 0.5}
            strokeWidth={CELL * 0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Stones. */}
        {placedMoves.map((m, idx) => (
          <PieceGlyph
            key={idx}
            cx={m.c * CELL + CELL / 2}
            cy={m.r * CELL + CELL / 2}
            cell={CELL}
            slot={m.p}
            themeT={t}
          />
        ))}

        {/* Win line on completion. */}
        {finished && game.winLine && (
          <line
            x1={game.winLine.from[1] * CELL + CELL / 2}
            y1={game.winLine.from[0] * CELL + CELL / 2}
            x2={game.winLine.to[1] * CELL + CELL / 2}
            y2={game.winLine.to[0] * CELL + CELL / 2}
            stroke={t.success}
            strokeWidth={5}
            strokeOpacity={0.9}
            strokeLinecap="round"
          >
            <animate attributeName="stroke-opacity" values="0.3;1;0.85" dur="0.6s" />
          </line>
        )}

        {/* Winning pattern rings on completion. */}
        {finished &&
          game.winPattern &&
          game.winPattern.map(([r, c]) => (
            <rect
              key={`wp-${r}-${c}`}
              x={c * CELL + 4}
              y={r * CELL + 4}
              width={CELL - 8}
              height={CELL - 8}
              rx={8}
              fill="none"
              stroke={t.success}
              strokeWidth={3}
              opacity={0.95}
              pointerEvents="none"
            >
              <animate attributeName="stroke-opacity" values="0.4;1;0.9" dur="0.6s" />
            </rect>
          ))}
      </svg>

      <div
        style={{
          minHeight: 22,
          fontFamily: t.fontMono,
          fontSize: 13,
          letterSpacing: "0.1em",
          color: finished ? t.success : wrongHint ? t.p2 : t.textSecondary,
          textAlign: "center",
        }}
      >
        {finished
          ? game.outcome === "DRAW"
            ? "= DRAW"
            : "✓ VICTORY"
          : wrongHint
          ? "TAP THE GLOWING CELL"
          : nextMove?.p === "P1"
          ? "YOUR MOVE — TAP THE GLOWING CELL"
          : `${getBotLabel(game.opponent.id as BotId) || game.opponent.label} IS THINKING…`}
      </div>
    </div>
  );
}
