"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { DemoGameStep } from "@/lib/tutorialContent";
import { PieceGlyph } from "@/components/TutorialPiece";

/**
 * Animated bot-vs-bot demo board for the tutorial walkthrough.
 *
 * Plays the supplied `DemoGameStep.moves` out one stone at a time. A
 * configurable inter-move delay keeps the pace readable (default 750ms).
 * After the last move the decisive `winLine`, connected `path` or pattern
 * ring is drawn, and an outcome banner is shown underneath.
 *
 * Controls:
 *   ▶︎/⏸ — toggle autoplay
 *   ⟲    — reset to the first move
 *   ⟵/⟶ — single-step back / forward
 *
 * The demo auto-loops after a short pause on the last frame so a user
 * returning to the step later still sees the animation, rather than
 * landing on a fully-resolved board with no context.
 */

export interface TutorialDemoBoardProps {
  demo: DemoGameStep;
  themeT: (typeof THEMES)[ThemeId];
  compact?: boolean;
}

const DEFAULT_MOVE_DELAY_MS = 750;
const DEFAULT_LOOP_PAUSE_MS = 2400;

export default function TutorialDemoBoard({ demo, themeT, compact = false }: TutorialDemoBoardProps) {
  const t = themeT;
  const total = demo.moves.length;
  const moveDelayMs = demo.moveDelayMs ?? DEFAULT_MOVE_DELAY_MS;
  const loopPauseMs = demo.loopPauseMs ?? DEFAULT_LOOP_PAUSE_MS;

  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // Reset when a different demo is mounted in place.
  useEffect(() => {
    setShown(0);
    setPlaying(true);
  }, [demo.id]);

  // Autoplay loop. Advances `shown` every moveDelayMs while playing, then
  // pauses loopPauseMs on the final frame before resetting and resuming.
  useEffect(() => {
    if (!playing) return;
    if (shown < total) {
      const id = window.setTimeout(() => setShown((s) => s + 1), moveDelayMs);
      return () => window.clearTimeout(id);
    }
    // Finished — pause on the resolved board then loop.
    const id = window.setTimeout(() => {
      if (playingRef.current) setShown(0);
    }, loopPauseMs);
    return () => window.clearTimeout(id);
  }, [playing, shown, total, moveDelayMs, loopPauseMs]);

  const onToggle = useCallback(() => setPlaying((p) => !p), []);
  const onReset = useCallback(() => {
    setShown(0);
    setPlaying(true);
  }, []);
  const onBack = useCallback(() => {
    setPlaying(false);
    setShown((s) => Math.max(0, s - 1));
  }, []);
  const onForward = useCallback(() => {
    setPlaying(false);
    setShown((s) => Math.min(total, s + 1));
  }, [total]);

  // Derived: each cell's current owner accounting for the trap cell.
  const stones = useMemo(() => {
    const out: Array<{ r: number; c: number; p: "P1" | "P2"; trapped?: boolean }> = [];
    for (let i = 0; i < shown; i++) {
      const m = demo.moves[i];
      if (
        demo.specialCell &&
        m.r === demo.specialCell.r &&
        m.c === demo.specialCell.c &&
        m.p !== demo.specialCell.owner
      ) {
        out.push({ r: m.r, c: m.c, p: demo.specialCell.owner, trapped: true });
      } else {
        out.push({ r: m.r, c: m.c, p: m.p });
      }
    }
    return out;
  }, [demo, shown]);

  const finished = shown >= total;
  const sz = demo.size;
  const CELL = compact
    ? (sz === 5 ? 66 : sz === 6 ? 57 : 51)
    : (sz === 5 ? 60 : sz === 6 ? 52 : 46);
  const W = CELL * sz;

  const lastMove = shown > 0 ? demo.moves[shown - 1] : null;
  const patternCells = finished && demo.patternHighlight ? new Set(demo.patternHighlight.map(([r, c]) => `${r},${c}`)) : null;
  const pathCells = finished && demo.path ? new Set(demo.path.map(([r, c]) => `${r},${c}`)) : null;

  const outcomeLabel =
    demo.outcome === "P1_WIN" ? "P1 WINS"
    : demo.outcome === "P2_WIN" ? "P2 WINS"
    : demo.outcome === "DRAW" ? "DRAW"
    : null;
  const outcomeColor =
    demo.outcome === "DRAW" ? t.textMuted
    : demo.outcome === "P1_WIN" ? t.p1
    : demo.outcome === "P2_WIN" ? t.p2
    : t.textMuted;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
      {/* ``viewBox`` + percentage width lets the SVG scale down on narrow
          phone viewports (360–390px) instead of overflowing the tutorial
          card and forcing horizontal scroll. Desktop keeps the intended
          pixel size via maxWidth capping. */}
      <svg
        viewBox={`0 0 ${W} ${W}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{
          maxWidth: W,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          background: t.boardBg,
          display: "block",
        }}
      >
        <rect x={0} y={0} width={W} height={W} fill={t.boardBg} />

        {/* Grid */}
        {Array.from({ length: sz + 1 }).map((_, i) => (
          <g key={`gr-${i}`}>
            <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={t.boardLine} strokeWidth={0.8} />
            <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={t.boardLine} strokeWidth={0.8} />
          </g>
        ))}

        {/* Trap cell — dashed ring visible throughout the demo. */}
        {demo.specialCell && (
          <rect
            x={demo.specialCell.c * CELL + 3}
            y={demo.specialCell.r * CELL + 3}
            width={CELL - 6}
            height={CELL - 6}
            rx={6}
            fill="none"
            stroke={demo.specialCell.owner === "P1" ? t.p1 : t.p2}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.75}
          />
        )}

        {/* Connected path highlight (only after the game resolves). */}
        {finished && demo.path && demo.path.length > 1 && (
          <polyline
            points={demo.path.map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`).join(" ")}
            fill="none"
            stroke={t.accent}
            strokeOpacity={0.45}
            strokeWidth={CELL * 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Last-move "current" highlight while the demo is still playing. */}
        {lastMove && !finished && (
          <rect
            x={lastMove.c * CELL + 2}
            y={lastMove.r * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            rx={5}
            fill="none"
            stroke={t.accent}
            strokeWidth={2}
            opacity={0.85}
          />
        )}

        {/* Stones. */}
        {stones.map((s, idx) => {
          const cx = s.c * CELL + CELL / 2;
          const cy = s.r * CELL + CELL / 2;
          const isPath = pathCells?.has(`${s.r},${s.c}`);
          const isPattern = patternCells?.has(`${s.r},${s.c}`);
          const ringColor = isPattern || isPath || s.trapped ? t.accent : undefined;
          return (
            <g key={idx}>
              <PieceGlyph
                cx={cx}
                cy={cy}
                cell={CELL}
                slot={s.p}
                themeT={t}
                ringColor={ringColor}
              />
              {s.trapped && (
                <text
                  x={cx}
                  y={cy - CELL * 0.42}
                  fontFamily={t.fontMono}
                  fontSize={12}
                  fill={t.accent}
                  textAnchor="middle"
                >
                  TRAP
                </text>
              )}
            </g>
          );
        })}

        {/* Win line (after resolve). */}
        {finished && demo.winLine && (
          <line
            x1={demo.winLine.from[1] * CELL + CELL / 2}
            y1={demo.winLine.from[0] * CELL + CELL / 2}
            x2={demo.winLine.to[1] * CELL + CELL / 2}
            y2={demo.winLine.to[0] * CELL + CELL / 2}
            stroke={t.success}
            strokeWidth={4}
            strokeOpacity={0.85}
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Outcome banner */}
      {finished && outcomeLabel && (
        <div
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            background: outcomeColor + "22",
            border: `1px solid ${outcomeColor}`,
            color: outcomeColor,
            fontFamily: t.fontMono,
            fontSize: 22,
            letterSpacing: "0.18em",
            fontWeight: 700,
          }}
        >
          {outcomeLabel}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <CtrlButton onClick={onReset} themeT={t} title="Replay from start">⟲</CtrlButton>
        <CtrlButton onClick={onBack} themeT={t} title="Previous move" disabled={shown === 0}>⟵</CtrlButton>
        <CtrlButton onClick={onToggle} themeT={t} title={playing ? "Pause" : "Play"} primary>
          {playing ? "⏸" : "▶"}
        </CtrlButton>
        <CtrlButton onClick={onForward} themeT={t} title="Next move" disabled={shown >= total}>⟶</CtrlButton>
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 21,
            color: t.textSecondary,
            letterSpacing: "0.1em",
            paddingLeft: 8,
          }}
        >
          MOVE {Math.min(shown, total)} / {total}
        </div>
      </div>

      {demo.caption && (
        <div
          style={{
            color: t.textSecondary,
            fontSize: compact ? 18 : 22,
            maxWidth: Math.max(W, compact ? 420 : 520),
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {demo.caption}
        </div>
      )}
    </div>
  );
}

/* ── Small control button ───────────────────────────────────────────────── */

function CtrlButton({
  children,
  onClick,
  themeT,
  disabled,
  primary,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  themeT: (typeof THEMES)[ThemeId];
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        minWidth: 44,
        height: 40,
        padding: "0 12px",
        borderRadius: 6,
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${primary ? themeT.accent : themeT.border}`,
        background: primary ? themeT.accent : "transparent",
        color: primary ? themeT.bg : themeT.text,
        fontFamily: themeT.fontMono,
        fontSize: 26,
        letterSpacing: "0.04em",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
