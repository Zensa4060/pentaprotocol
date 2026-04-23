"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { DemoMove, InteractiveStep } from "@/lib/tutorialContent";
import { PieceGlyph } from "@/components/TutorialPiece";

/**
 * Guided 5×5 practice board used for the "play to win" / "play to draw"
 * exercises. The user clicks cells as P1; after each correct click the
 * next scripted P2 move auto-plays (~500 ms delay), then the next P1 target
 * is hinted with a dashed ring.
 *
 * Behaviour:
 *   - Click the highlighted cell → place stone, P2 replies, advance target.
 *   - Click any other cell → brief red shake on the board and a hint line
 *     appears ("Tap the ringed cell"); no state change.
 *   - Reset button returns to an empty board and replays from move 0.
 *   - On completion: outcome banner + final winLine / path / pattern ring
 *     drawn. The board stops accepting input.
 *
 * The board is intentionally permissive about progression — the parent
 * tutorial flow does not gate NEXT on completion (per the un-skippable
 * design for the walkthrough), but visibly rewarding completion here keeps
 * the exercise meaningful.
 */

export interface TutorialPracticeBoardProps {
  step: InteractiveStep;
  themeT: (typeof THEMES)[ThemeId];
  /** Render with smaller cells + tighter text so the board fits inside
      the split-layout right panel. */
  compact?: boolean;
}

const P2_DELAY_MS = 520;
const SHAKE_MS = 380;

export default function TutorialPracticeBoard({ step, themeT, compact = false }: TutorialPracticeBoardProps) {
  const t = themeT;
  const total = step.moves.length;

  // `moveIdx` is the index of the NEXT move in the script. When moveIdx
  // equals `total` the exercise is complete.
  const [moveIdx, setMoveIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const [wrongHint, setWrongHint] = useState(false);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => {
    setMoveIdx(0);
    setShake(false);
    setWrongHint(false);
  }, [step.id]);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    };
  }, []);

  const placedMoves: DemoMove[] = useMemo(
    () => step.moves.slice(0, moveIdx),
    [step.moves, moveIdx],
  );
  const nextMove = moveIdx < total ? step.moves[moveIdx] : null;
  const finished = moveIdx >= total;

  // Auto-play the scripted P2 reply after a user-correct P1 click.
  useEffect(() => {
    if (!nextMove || nextMove.p !== "P2") return;
    const id = window.setTimeout(() => setMoveIdx((i) => i + 1), P2_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [nextMove]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setWrongHint(true);
    if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => {
      setShake(false);
      // Hint sticks slightly longer than the shake so the user reads it.
    }, SHAKE_MS);
  }, []);

  const onCellClick = useCallback(
    (r: number, c: number) => {
      if (finished || !nextMove || nextMove.p !== "P1") return;
      const occupied = placedMoves.some((m) => m.r === r && m.c === c);
      if (occupied) {
        triggerShake();
        return;
      }
      if (r === nextMove.r && c === nextMove.c) {
        setWrongHint(false);
        setMoveIdx((i) => i + 1);
      } else {
        triggerShake();
      }
    },
    [finished, nextMove, placedMoves, triggerShake],
  );

  const onReset = useCallback(() => {
    setMoveIdx(0);
    setShake(false);
    setWrongHint(false);
  }, []);

  const sz = step.size;
  const CELL = compact
    ? (sz === 5 ? 69 : sz === 6 ? 60 : 51)
    : 64;
  const W = CELL * sz;

  const p1TargetVisible = !!(nextMove && nextMove.p === "P1" && !finished);
  const patternCells = finished && step.patternHighlight
    ? new Set(step.patternHighlight.map(([r, c]) => `${r},${c}`))
    : null;
  const pathCells = finished && step.path
    ? new Set(step.path.map(([r, c]) => `${r},${c}`))
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg
        width={W}
        height={W}
        style={{
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          background: t.boardBg,
          display: "block",
          transform: shake ? "translateX(-4px)" : "none",
          transition: shake ? "transform 80ms ease" : "transform 120ms ease",
          cursor: p1TargetVisible ? "pointer" : "default",
        }}
      >
        <rect x={0} y={0} width={W} height={W} fill={t.boardBg} />

        {/* Grid lines */}
        {Array.from({ length: sz + 1 }).map((_, i) => (
          <g key={`gr-${i}`}>
            <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={t.boardLine} strokeWidth={0.8} />
            <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={t.boardLine} strokeWidth={0.8} />
          </g>
        ))}

        {/* Click targets (full 25 rects). */}
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

        {/* Final path highlight on completion. */}
        {finished && step.path && step.path.length > 1 && (
          <polyline
            points={step.path.map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`).join(" ")}
            fill="none"
            stroke={t.accent}
            strokeOpacity={0.45}
            strokeWidth={CELL * 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Next-target hint ring (only while the user's turn is pending). */}
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
            <animate
              attributeName="stroke-opacity"
              values="0.35;1;0.35"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </rect>
        )}

        {/* Stones. */}
        {placedMoves.map((m, idx) => {
          const cx = m.c * CELL + CELL / 2;
          const cy = m.r * CELL + CELL / 2;
          const onPath = pathCells?.has(`${m.r},${m.c}`);
          const onPattern = patternCells?.has(`${m.r},${m.c}`);
          return (
            <PieceGlyph
              key={idx}
              cx={cx}
              cy={cy}
              cell={CELL}
              slot={m.p}
              themeT={t}
              ringColor={onPath || onPattern ? t.accent : undefined}
            />
          );
        })}

        {/* Win line on completion. */}
        {finished && step.winLine && (
          <line
            x1={step.winLine.from[1] * CELL + CELL / 2}
            y1={step.winLine.from[0] * CELL + CELL / 2}
            x2={step.winLine.to[1] * CELL + CELL / 2}
            y2={step.winLine.to[0] * CELL + CELL / 2}
            stroke={t.success}
            strokeWidth={4}
            strokeOpacity={0.85}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Status line */}
      <div
        style={{
          minHeight: 28,
          fontFamily: t.fontMono,
          fontSize: compact ? 17 : 22,
          letterSpacing: "0.08em",
          color: finished ? t.success : wrongHint ? t.p2 : t.textSecondary,
          textAlign: "center",
        }}
      >
        {finished
          ? `✓ ${step.successLabel}`
          : wrongHint
          ? "TAP THE RINGED CELL"
          : nextMove?.p === "P1"
          ? "YOUR MOVE — TAP THE HIGHLIGHTED CELL"
          : "P2 REPLYING…"}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={onReset}
          title="Reset practice"
          style={{
            minWidth: 44,
            height: compact ? 38 : 40,
            padding: compact ? "0 16px" : "0 18px",
            borderRadius: 6,
            cursor: "pointer",
            border: `1px solid ${t.border}`,
            background: "transparent",
            color: t.text,
            fontFamily: t.fontMono,
            fontSize: compact ? 17 : 22,
            letterSpacing: "0.08em",
          }}
        >
          ⟲ RESET
        </button>
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: compact ? 16 : 21,
            color: t.textSecondary,
            letterSpacing: "0.1em",
          }}
        >
          {`MOVE ${moveIdx} / ${total}`}
        </div>
      </div>

      {step.caption && (
        <div
          style={{
            color: t.textSecondary,
            fontSize: compact ? 18 : 22,
            maxWidth: Math.max(W, compact ? 420 : 520),
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {step.caption}
        </div>
      )}
    </div>
  );
}
