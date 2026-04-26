"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { THEMES, type Theme, type ThemeId } from "@/lib/themes";
import {
  PATTERN_METADATA_5,
  PATTERN_METADATA_6,
  PATTERN_METADATA_7,
  type PatternInfo,
} from "@/lib/patterns_metadata";
import {
  TUTORIAL_SECTIONS,
  flattenTutorial,
  type BoardIllustration,
  type BreakerDiagramStep,
  type CentreCompareStep,
  type ScreenMockKey,
  type StonePlacement,
  type TutorialStep,
} from "@/lib/tutorialContent";
import TutorialDemoBoard from "@/components/TutorialDemoBoard";
import TutorialPracticeBoard from "@/components/TutorialPracticeBoard";
import { PieceGlyph } from "@/components/TutorialPiece";
import {
  RANKS,
  NavRankBadge,
  rankGlowVisualStrength,
  rankHaloGradientForRank,
} from "@/components/NavBar";
import {
  persistTutorialState,
  writeLocalTutorialState,
  type TutorialState,
} from "@/lib/tutorialState";
import { SYROS_PFP_URL } from "@/lib/unrankedBots";

/**
 * First-run tutorial overlay.
 *
 * Rendered as a full-screen fixed-position layer (zIndex ≥ 12060 so it
 * covers PolicyAcceptanceGate and NavBar). Two modes:
 *   - "gate"   : first card is Start / Skip; persists state on either button.
 *   - "replay" : starts at step 0 of the walkthrough; no state change.
 *
 * Once the walkthrough begins it cannot be skipped mid-flow — the only exit
 * after the gate is the "Finish" button on the final step. This matches the
 * product spec: the tutorial is either completed or skipped at the gate.
 */

export interface TutorialScreenProps {
  themeId: ThemeId;
  userId: string;
  token: string;
  mode: "gate" | "replay";
  onDoneAction: (result: TutorialState) => void;
}

const Z = 12060;
const BLOOD_RED = "#a30000";
const BLOOD_RED_SOFT = "#7a0000";

export default function TutorialScreen({
  themeId,
  userId,
  token,
  mode,
  onDoneAction,
}: TutorialScreenProps) {
  const t = THEMES[themeId] ?? THEMES.classic_dark;
  const steps = useMemo(() => flattenTutorial(), []);
  const totalSteps = steps.length;

  // stepIdx = -1 means "gate choice" (only in mode === "gate"); otherwise 0..N-1.
  const [stepIdx, setStepIdx] = useState<number>(mode === "gate" ? -1 : 0);
  const [submitting, setSubmitting] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* Lock body scroll while the overlay is mounted. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* Reset scroll position when step changes so long body text starts at top. */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [stepIdx]);

  const finish = useCallback(
    async (result: TutorialState) => {
      if (submitting) return;
      setSubmitting(true);
      try {
        if (mode === "gate") {
          writeLocalTutorialState(userId, result);
          await persistTutorialState(token, result);
        }
      } finally {
        setSubmitting(false);
        onDoneAction(result);
      }
    },
    [mode, onDoneAction, submitting, token, userId],
  );

  const startWalkthrough = () => setStepIdx(0);

  const goNext = () => {
    if (stepIdx < totalSteps - 1) {
      setStepIdx((i) => i + 1);
    } else {
      void finish("completed");
    }
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const confirmSkip = () => {
    setShowSkipConfirm(false);
    if (mode === "gate") {
      void finish("skipped");
      return;
    }
    // Replay mode has no persistence; close immediately.
    onDoneAction("completed");
  };

  const cancelSkip = () => setShowSkipConfirm(false);

  /* Browser/device back should ask for skip confirmation while walking. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (stepIdx < 0) return;
    const pushBarrierState = () => {
      try {
        window.history.pushState({ ...(window.history.state ?? {}), pp_tutorial_guard: true }, "");
      } catch {
        // ignore history errors (very old browsers / restricted environments)
      }
    };
    pushBarrierState();
    const onPop = () => {
      setShowSkipConfirm(true);
      pushBarrierState();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [stepIdx]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z,
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        color: t.text,
        fontFamily: t.fontBody,
      }}
    >
      {/* Top rail. On narrow viewports the title was colliding with the
          ``STEP 5 / 39`` counter + SKIP button and the counter text was
          wrapping mid-number ("STE" / "5 /" / "39"). Clamping the title
          font-size and allowing the rail to wrap keeps every element on
          screen at ≤ 400px widths without touching the desktop layout. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px clamp(12px, 4vw, 22px)",
          borderBottom: `1px solid ${t.border}`,
          background: t.bgPanel,
          flexWrap: "wrap",
          rowGap: 8,
          columnGap: 10,
        }}
      >
        <div style={{ fontFamily: t.fontDisplay, fontWeight: 800, letterSpacing: "0.08em", color: BLOOD_RED, fontSize: "clamp(16px, 4.2vw, 33px)", overflowWrap: "anywhere" }}>
          PENTAPROTOCOL · TUTORIAL
        </div>
        {stepIdx >= 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ fontFamily: t.fontMono, fontSize: "clamp(12px, 3vw, 22px)", color: BLOOD_RED_SOFT, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
              STEP {stepIdx + 1} / {totalSteps}
            </div>
            <button
              onClick={() => setShowSkipConfirm(true)}
              style={btn(t, "ghost")}
              disabled={submitting}
            >
              SKIP
            </button>
          </div>
        )}
      </div>

      {/* Body — either gate or step content. */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "28px clamp(16px, 4vw, 48px)",
        }}
      >
        {stepIdx < 0 ? (
          <GateCard
            themeT={t}
            onStart={startWalkthrough}
            onSkip={() => void finish("skipped")}
            submitting={submitting}
          />
        ) : (
          <StepView step={steps[stepIdx].step} themeT={t} />
        )}
      </div>

      {/* Bottom rail — only when walking */}
      {stepIdx >= 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 22px",
            borderTop: `1px solid ${t.border}`,
            background: t.bgPanel,
            gap: 12,
          }}
        >
          <button
            onClick={goBack}
            disabled={stepIdx === 0}
            style={btn(t, stepIdx === 0 ? "disabled" : "ghost")}
          >
            BACK
          </button>
          <ProgressPips current={stepIdx} total={totalSteps} color={t.accent} dim={t.border} />
          <button
            onClick={goNext}
            style={btn(t, "primary")}
            disabled={submitting}
          >
            {stepIdx === totalSteps - 1 ? "FINISH" : "NEXT"}
          </button>
        </div>
      )}

      {showSkipConfirm && stepIdx >= 0 && (
        <SkipConfirmModal
          themeT={t}
          submitting={submitting}
          onCancel={cancelSkip}
          onConfirm={confirmSkip}
        />
      )}
    </div>
  );
}

/* ── Gate card (choice) ───────────────────────────────────────────────────── */

function GateCard({
  themeT,
  onStart,
  onSkip,
  submitting,
}: {
  themeT: (typeof THEMES)[ThemeId];
  onStart: () => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  return (
    <div
      style={{
        maxWidth: 960,
        margin: "6vh auto 0",
        padding: "40px 36px",
        border: `1px solid ${themeT.border}`,
        borderRadius: 14,
        background: themeT.bgCard,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: themeT.fontDisplay,
          fontSize: 52,
          fontWeight: 800,
          color: BLOOD_RED,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Take the quick tour?
      </div>
      <div style={{ color: themeT.textSecondary, lineHeight: 1.6, fontSize: 28, maxWidth: 820 }}>
        First time signing in. This walkthrough covers how the boards work,
        the special rounds, how points are awarded and what every screen in
        the app does — with annotated illustrations for each concept.
      </div>
      <ul
        style={{
          color: themeT.textMuted,
          lineHeight: 1.7,
          margin: 0,
          padding: 0,
          fontSize: 25,
          listStyle: "none",
          maxWidth: 820,
        }}
      >
        <li>You can replay it any time from Training → Tutorial.</li>
      </ul>
      <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onStart} style={btn(themeT, "primary")} disabled={submitting}>
          START TUTORIAL
        </button>
        <button onClick={onSkip} style={btn(themeT, "ghost")} disabled={submitting}>
          SKIP FOR NOW
        </button>
      </div>
    </div>
  );
}

function SkipConfirmModal({
  themeT,
  onCancel,
  onConfirm,
  submitting,
}: {
  themeT: (typeof THEMES)[ThemeId];
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Skip tutorial confirmation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z + 1,
        background: `${themeT.overlay}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(560px, 94vw)",
          borderRadius: 12,
          background: themeT.bgCard,
          border: `1px solid ${themeT.border}`,
          padding: "22px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ fontFamily: themeT.fontDisplay, fontSize: 45, color: BLOOD_RED, fontWeight: 800, textTransform: "uppercase", textAlign: "center" }}>
          Skip Tutorial?
        </div>
        <div style={{ color: themeT.textSecondary, lineHeight: 1.6, fontSize: 28, textAlign: "center" }}>
          You are about to exit the walkthrough. Do you want to skip the tutorial now?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button onClick={onCancel} style={btn(themeT, "ghost")} disabled={submitting}>
            CONTINUE TUTORIAL
          </button>
          <button onClick={onConfirm} style={btn(themeT, "primary")} disabled={submitting}>
            YES, SKIP
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step renderer ────────────────────────────────────────────────────────── */

function StepView({
  step,
  themeT,
}: {
  step: TutorialStep;
  themeT: (typeof THEMES)[ThemeId];
}) {
  /* Use a side-by-side layout for any step that pairs descriptive text
     with a visual — description reads on the left while the visual sits
     on the right. This keeps the step on a single screen without
     scrolling, even for long bodies/captions. */
  const isSplitLayout =
    step.kind === "breaker-diagram" ||
    step.kind === "rank-ladder" ||
    step.kind === "demo-game" ||
    step.kind === "board" ||
    step.kind === "interactive";

  const hasBullets =
    (step.kind === "message" ||
      step.kind === "breaker-diagram" ||
      step.kind === "rank-ladder" ||
      step.kind === "centre-compare") && !!step.bullets?.length;

  /* Split-layout text — bumped +20% so pages fill more of the screen. */
  const splitHeadingStyle: React.CSSProperties = {
    fontFamily: themeT.fontDisplay,
    fontSize: "clamp(38px, 4.56vw, 55px)",
    fontWeight: 800,
    color: BLOOD_RED,
    marginBottom: 16,
    letterSpacing: "0.03em",
    textAlign: "left",
    textTransform: "uppercase",
    lineHeight: 1.12,
  };
  const splitBodyStyle: React.CSSProperties = {
    color: themeT.textSecondary,
    lineHeight: 1.55,
    fontSize: 26,
    textAlign: "left",
    margin: 0,
  };
  const splitBulletStyle: React.CSSProperties = {
    color: themeT.textSecondary,
    lineHeight: 1.55,
    marginTop: 16,
    padding: 0,
    fontSize: 26,
    listStyle: "none",
    textAlign: "left",
  };

  if (isSplitLayout) {
    return (
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          gap: 36,
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: "1 1 480px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={splitHeadingStyle}>{step.title}</div>
          <div style={splitBodyStyle}>{step.body}</div>
          {hasBullets ? (
            <ul style={splitBulletStyle}>
              {(step as { bullets?: string[] }).bullets!.map((b, i) => (
                <li key={i} style={{ marginTop: i === 0 ? 0 : 10 }}>{b}</li>
              ))}
            </ul>
          ) : null}
          {step.syrosQuote ? (
            <div style={{ maxWidth: 820, width: "100%", marginTop: 28 }}>
              <SyrosBlock quote={step.syrosQuote} themeT={themeT} />
            </div>
          ) : null}
        </div>
        <div
          style={{
            flex: "1 1 560px",
            minWidth: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {step.kind === "breaker-diagram" && (
            <BreakerDiagram step={step} themeT={themeT} compact />
          )}
          {step.kind === "rank-ladder" && (
            <RankLadder themeT={themeT} compact />
          )}
          {step.kind === "demo-game" && (
            <TutorialDemoBoard demo={step} themeT={themeT} compact />
          )}
          {step.kind === "board" && (
            <BoardFigure illustration={step.board} themeT={themeT} compact />
          )}
          {step.kind === "interactive" && (
            <TutorialPracticeBoard step={step} themeT={themeT} compact />
          )}
        </div>
      </div>
    );
  }

  const headingStyle: React.CSSProperties = {
    fontFamily: themeT.fontDisplay,
    fontSize: "clamp(41px, 5.55vw, 60px)",
    fontWeight: 800,
    color: BLOOD_RED,
    marginBottom: 18,
    letterSpacing: "0.03em",
    textAlign: "center",
    textTransform: "uppercase",
  };
  const bodyStyle: React.CSSProperties = {
    color: themeT.textSecondary,
    lineHeight: 1.65,
    fontSize: 28,
    maxWidth: 1040,
    textAlign: "center",
    margin: "0 auto",
  };
  const bulletWrap: React.CSSProperties = {
    color: themeT.textSecondary,
    lineHeight: 1.7,
    marginTop: 20,
    padding: 0,
    fontSize: 28,
    listStyle: "none",
    maxWidth: 1040,
    textAlign: "center",
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div style={headingStyle}>{step.title}</div>
      <div style={bodyStyle}>{step.body}</div>

      {hasBullets ? (
        <ul style={bulletWrap}>
          {(step as { bullets?: string[] }).bullets!.map((b, i) => (
            <li key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>{b}</li>
          ))}
        </ul>
      ) : null}

      {step.kind === "centre-compare" && (
        <div style={{ marginTop: 28, width: "100%", maxWidth: 1100, marginLeft: "auto", marginRight: "auto" }}>
          <CentreCompareFigure step={step} themeT={themeT} />
        </div>
      )}

      {step.kind === "pattern-gallery" && (
        <div style={{ marginTop: 30, width: "100%" }}>
          <PatternGallery size={step.size} themeT={themeT} />
        </div>
      )}

      {step.kind === "screen-mock" && (
        <div style={{ marginTop: 30, width: "100%" }}>
          <ScreenMock step={step} themeT={themeT} />
        </div>
      )}

      {step.syrosQuote ? (
        <div style={{ maxWidth: 820, width: "100%", marginTop: 28 }}>
          <SyrosBlock quote={step.syrosQuote} themeT={themeT} />
        </div>
      ) : null}

    </div>
  );
}

/* ── Pattern gallery ──────────────────────────────────────────────────────── */

function PatternGallery({
  size,
  themeT,
}: {
  size: 5 | 6 | 7;
  themeT: (typeof THEMES)[ThemeId];
}) {
  const dict: Record<string, PatternInfo> =
    size === 5 ? PATTERN_METADATA_5 : size === 6 ? PATTERN_METADATA_6 : PATTERN_METADATA_7;
  const items = Object.values(dict);
  const count = items.length;
  /* 6×6 / 7×7 grids +10% vs prior sizing so pattern cards read larger. */
  const cellPx = size === 5 ? 22 : size === 6 ? 20 : 17;
  /* Mobile story: packing 6–8 pattern cards in a single CSS-grid row at
     viewports < 480px squashed each column to ~45px, which forced the
     label ("V-SHAPE", "ZIGZAG-5", etc.) to break character-by-character
     (see user bug report showing "V- SH AP" stacks). We now render the
     gallery as a horizontally-scrollable flex strip on narrow screens so
     every card keeps its natural width (≈ 120px) and the label renders
     on a single line. Desktop / tablet viewports still see the full
     side-by-side grid thanks to the ``pp-pat-gallery-desktop`` media
     query. */
  return (
    <>
      <style>{`
        .pp-pat-gallery { display: flex; gap: 10px; overflow-x: auto; overflow-y: hidden; padding-bottom: 6px; scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch; width: 100%; }
        .pp-pat-gallery::-webkit-scrollbar { height: 4px; }
        .pp-pat-gallery::-webkit-scrollbar-thumb { background: rgba(204,0,0,0.35); border-radius: 2px; }
        .pp-pat-gallery > div { flex: 0 0 auto; width: 120px; scroll-snap-align: start; }
        @media (min-width: 640px) {
          .pp-pat-gallery { display: grid; grid-template-columns: repeat(var(--pp-pat-count, ${count}), minmax(0, 1fr)); overflow: visible; padding-bottom: 0; }
          .pp-pat-gallery > div { width: auto; flex: unset; }
        }
      `}</style>
      <div
        className="pp-pat-gallery"
        style={{
          // CSS custom property picks up the dynamic pattern count for the
          // desktop grid without inlining a stringified template column.
          ["--pp-pat-count" as string]: String(count),
        }}
      >
        {items.map((p) => (
          <div
            key={p.id}
            style={{
              border: `1px solid ${themeT.border}`,
              background: themeT.bgCard,
              borderRadius: 10,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "center",
              textAlign: "center",
              minWidth: 0,
            }}
          >
            <PatternGrid size={p.gridSize} cells={p.cells} themeT={themeT} cellPx={cellPx} />
            <div
              style={{
                fontFamily: themeT.fontDisplay,
                // Slightly smaller + no forced letter-spacing stretches the
                // label so "STRAIGHT" / "ZIGZAG-5" still fit a 120px card.
                fontSize: "clamp(13px, 3.2vw, 20px)",
                fontWeight: 700,
                color: BLOOD_RED,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                lineHeight: 1.15,
                whiteSpace: "nowrap",
              }}
            >
              {p.label}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function PatternGrid({
  size,
  cells,
  themeT,
  cellPx,
}: {
  size: number;
  cells: Array<[number, number]>;
  themeT: (typeof THEMES)[ThemeId];
  cellPx?: number;
}) {
  const CELL = cellPx ?? 28;
  const W = CELL * size;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));
  return (
    <svg width={W} height={W} style={{ display: "block" }}>
      <rect x={0} y={0} width={W} height={W} fill={themeT.boardBg} />
      {Array.from({ length: size + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={themeT.boardLine} strokeWidth={0.6} />
          <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={themeT.boardLine} strokeWidth={0.6} />
        </g>
      ))}
      {Array.from({ length: size * size }).map((_, idx) => {
        const r = Math.floor(idx / size);
        const c = idx % size;
        if (!cellSet.has(`${r},${c}`)) return null;
        return (
          <PieceGlyph
            key={idx}
            cx={c * CELL + CELL / 2}
            cy={r * CELL + CELL / 2}
            cell={CELL}
            slot="P1"
            themeT={themeT}
          />
        );
      })}
    </svg>
  );
}

/* ── Full board figure (for line-win / draw / full-board path steps) ────── */

function BoardFigure({
  illustration,
  themeT,
  compact = false,
}: {
  illustration: BoardIllustration;
  themeT: (typeof THEMES)[ThemeId];
  compact?: boolean;
}) {
  const { size, stones, winLine, path, caption } = illustration;
  const CELL = compact
    ? (size === 5 ? 63 : size === 6 ? 54 : 48)
    : (size === 5 ? 58 : size === 6 ? 52 : 46);
  const W = CELL * size;
  const pathSet = new Set((path ?? []).map(([r, c]) => `${r},${c}`));
  const stoneAt: Record<string, StonePlacement> = {};
  for (const s of stones) stoneAt[`${s.r},${s.c}`] = s;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={W} height={W} style={{ border: `1px solid ${themeT.border}` }}>
        <rect x={0} y={0} width={W} height={W} fill={themeT.boardBg} />
        {Array.from({ length: size + 1 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={themeT.boardLine} strokeWidth={0.8} />
            <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={themeT.boardLine} strokeWidth={0.8} />
          </g>
        ))}

        {/* Connected path highlight (drawn beneath stones). */}
        {path && path.length > 1 && (
          <polyline
            points={path.map(([r, c]) => `${c * CELL + CELL / 2},${r * CELL + CELL / 2}`).join(" ")}
            fill="none"
            stroke={themeT.accent}
            strokeOpacity={0.55}
            strokeWidth={CELL * 0.55}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Win line. */}
        {winLine && (
          <line
            x1={winLine.from[1] * CELL + CELL / 2}
            y1={winLine.from[0] * CELL + CELL / 2}
            x2={winLine.to[1] * CELL + CELL / 2}
            y2={winLine.to[0] * CELL + CELL / 2}
            stroke={themeT.success}
            strokeWidth={4}
            strokeOpacity={0.8}
            strokeLinecap="round"
          />
        )}

        {/* Stones. */}
        {Array.from({ length: size * size }).map((_, idx) => {
          const r = Math.floor(idx / size);
          const c = idx % size;
          const s = stoneAt[`${r},${c}`];
          if (!s) return null;
          const cx = c * CELL + CELL / 2;
          const cy = r * CELL + CELL / 2;
          const onPath = pathSet.has(`${r},${c}`);
          return (
            <g key={idx}>
              <PieceGlyph
                cx={cx}
                cy={cy}
                cell={CELL}
                slot={s.p}
                themeT={themeT}
                ringColor={onPath ? themeT.accent : undefined}
              />
              {s.label && (
                <text
                  x={cx}
                  y={cy + CELL * 0.35}
                  fontSize={CELL * 0.22}
                  textAnchor="middle"
                  fill={themeT.textMuted}
                  fontFamily={themeT.fontMono}
                >
                  {s.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {caption && (
        <div
          style={{
            color: themeT.textSecondary,
            fontSize: compact ? 18 : 22,
            maxWidth: Math.max(W, compact ? 420 : 520),
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

/* ── Centre-rule comparison (three mini-boards side-by-side) ──────────────── */

/**
 * Mini-board visual used by {@link CentreCompareFigure}. Draws a small empty
 * grid and either highlights the true centre cell (for odd-sized boards
 * where the centre rule applies) or draws a subtle red "no centre" cross
 * over the middle 2×2 block (for even-sized boards).
 */
function CentreMiniBoard({
  size,
  supported,
  themeT,
  compact,
}: {
  size: 5 | 6 | 7;
  supported: boolean;
  themeT: (typeof THEMES)[ThemeId];
  compact?: boolean;
}) {
  const CELL = compact
    ? (size === 5 ? 26 : size === 6 ? 22 : 19)
    : (size === 5 ? 36 : size === 6 ? 32 : 28);
  const W = CELL * size;

  /* For odd sizes the centre is a single cell; for even sizes we draw the
     2×2 middle block so the viewer can see *why* there is no centre. */
  const hasSingleCentre = size % 2 === 1;
  const centreR = hasSingleCentre ? Math.floor(size / 2) : -1;
  const centreC = hasSingleCentre ? Math.floor(size / 2) : -1;

  const accent = supported ? (themeT.success || themeT.accent) : themeT.danger;

  return (
    <svg
      width={W}
      height={W}
      style={{
        border: `1px solid ${themeT.border}`,
        background: themeT.boardBg,
        borderRadius: 6,
        display: "block",
      }}
    >
      <rect x={0} y={0} width={W} height={W} fill={themeT.boardBg} />

      {/* Highlight the centre cell (odd sizes) or the 2×2 middle block (6×6). */}
      {hasSingleCentre ? (
        <rect
          x={centreC * CELL + 1}
          y={centreR * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          fill={`${accent}22`}
          stroke={accent}
          strokeWidth={1.5}
        />
      ) : (
        <rect
          x={(size / 2 - 1) * CELL + 1}
          y={(size / 2 - 1) * CELL + 1}
          width={CELL * 2 - 2}
          height={CELL * 2 - 2}
          fill={`${accent}16`}
          stroke={accent}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Grid lines (drawn over the centre highlight). */}
      {Array.from({ length: size + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke={themeT.boardLine} strokeWidth={0.8} />
          <line x1={i * CELL} y1={0} x2={i * CELL} y2={W} stroke={themeT.boardLine} strokeWidth={0.8} />
        </g>
      ))}

      {/* Corner badge: tick (supported) or cross (no centre). */}
      {(() => {
        const r = compact ? 10 : 14;
        const bx = W - (r + 4);
        const by = r + 4;
        return (
          <g>
            <circle cx={bx} cy={by} r={r} fill={accent} stroke={themeT.border} strokeWidth={1} />
            {supported ? (
              <path
                d={`M ${bx - 6} ${by + 1} L ${bx - 1} ${by + 6} L ${bx + 7} ${by - 4}`}
                stroke="#0a0a0a"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <g stroke="#0a0a0a" strokeWidth={2.5} strokeLinecap="round">
                <line x1={bx - 5} y1={by - 5} x2={bx + 5} y2={by + 5} />
                <line x1={bx - 5} y1={by + 5} x2={bx + 5} y2={by - 5} />
              </g>
            )}
          </g>
        );
      })()}
    </svg>
  );
}

/**
 * The full page visual for the `centre-compare` tutorial step — lays out
 * three {@link CentreMiniBoard} panels side-by-side with the size label, a
 * supporting / not-supporting badge row, and a short note per board.
 */
function CentreCompareFigure({
  step,
  themeT,
  compact,
}: {
  step: CentreCompareStep;
  themeT: (typeof THEMES)[ThemeId];
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: compact ? 14 : 28,
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-start",
        maxWidth: compact ? 560 : 1100,
      }}
    >
      {step.boards.map((b) => {
        const accent = b.supported ? (themeT.success || themeT.accent) : themeT.danger;
        return (
          <div
            key={`${b.size}-${b.label}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: compact ? 6 : 10,
              padding: compact ? "10px 10px 12px" : "14px 16px 18px",
              border: `1px solid ${accent}55`,
              borderRadius: 12,
              background: `${accent}10`,
              minWidth: compact ? 130 : 180,
            }}
          >
            <div
              style={{
                fontFamily: themeT.fontDisplay,
                fontSize: compact ? 16 : 22,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: themeT.text,
                textTransform: "uppercase",
              }}
            >
              {b.label}
            </div>
            <CentreMiniBoard size={b.size} supported={b.supported} themeT={themeT} compact={compact} />
            <div
              style={{
                fontFamily: themeT.fontMono,
                fontSize: compact ? 9 : 11,
                letterSpacing: "0.14em",
                color: accent,
                textTransform: "uppercase",
                fontWeight: 800,
              }}
            >
              {b.supported ? "CENTRE RULE ✓" : "NO CENTRE RULE ✕"}
            </div>
            {b.note ? (
              <div
                style={{
                  fontFamily: themeT.fontBody,
                  fontSize: compact ? 11 : 14,
                  color: themeT.textSecondary,
                  textAlign: "center",
                  maxWidth: compact ? 140 : 200,
                  lineHeight: 1.4,
                }}
              >
                {b.note}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ── Screen mocks with callouts ──────────────────────────────────────────── */

function ScreenMock({
  step,
  themeT,
}: {
  step: Extract<TutorialStep, { kind: "screen-mock" }>;
  themeT: (typeof THEMES)[ThemeId];
}) {
  const CARD_W = 720;
  const CARD_H = 420;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: "min(92vw, " + CARD_W + "px)",
          aspectRatio: `${CARD_W} / ${CARD_H}`,
          position: "relative",
          border: `1px solid ${themeT.border}`,
          borderRadius: 12,
          background: themeT.bgCard,
          overflow: "hidden",
        }}
      >
        {step.videoUrl ? (
          <video
            src={step.videoUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : step.imageUrl ? (
          <img
            src={step.imageUrl}
            alt={step.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <ScreenMockArt kind={step.screenKey} themeT={themeT} />
        )}
        {step.callouts.map((c, i) => (
          <Callout key={i} x={c.x} y={c.y} label={c.label} desc={c.desc} themeT={themeT} />
        ))}
      </div>
      <div style={{ color: themeT.textSecondary, fontSize: 22, textAlign: "center", maxWidth: CARD_W, lineHeight: 1.55 }}>
        {step.videoUrl || step.imageUrl
          ? "Screen capture — callouts point at the controls you'll use."
          : "Annotated mock — positions on your build may look slightly different as the UI evolves."}
      </div>
    </div>
  );
}

function Callout({
  x,
  y,
  label,
  desc,
  themeT,
}: {
  x: number;
  y: number;
  label: string;
  desc: string;
  themeT: (typeof THEMES)[ThemeId];
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: themeT.accent,
          border: `2px solid ${themeT.bg}`,
          boxShadow: `0 0 0 3px ${themeT.accent}40`,
        }}
      />
      <div
        style={{
          marginTop: 4,
          padding: "5px 8px",
          background: themeT.bgPanel,
          border: `1px solid ${themeT.accent}`,
          borderRadius: 6,
          fontFamily: themeT.fontMono,
          fontSize: 12,
          color: themeT.text,
          lineHeight: 1.3,
          maxWidth: 160,
          textAlign: "center",
          letterSpacing: "0.03em",
        }}
      >
        <div style={{ fontWeight: 800, color: BLOOD_RED, fontSize: 12, textTransform: "uppercase", lineHeight: 1.2 }}>{label}</div>
        <div style={{ color: themeT.textSecondary, marginTop: 2, fontSize: 11, lineHeight: 1.3 }}>{desc}</div>
      </div>
    </div>
  );
}

/**
 * Procedural SVG mock art for each screen. Kept simple on purpose — the
 * callouts carry the educational weight, and plain shapes hold up across
 * every theme. Real screenshots can be substituted later per-screen by
 * switching a `screenKey` to an `<img>` in this switch without changing
 * anything else in the flow.
 */
function ScreenMockArt({
  kind,
  themeT,
}: {
  kind: ScreenMockKey;
  themeT: (typeof THEMES)[ThemeId];
}) {
  const common = {
    width: "100%",
    height: "100%",
    display: "block",
    position: "absolute" as const,
    inset: 0,
  };
  const stroke = themeT.border;
  const panel = themeT.bgPanel;
  const accent = themeT.accent;
  const textMuted = themeT.textMuted;

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <svg viewBox="0 0 720 420" preserveAspectRatio="xMidYMid meet" style={common}>
      {/* Top bar */}
      <rect x={0} y={0} width={720} height={40} fill={panel} />
      <rect x={16} y={12} width={100} height={16} rx={3} fill={accent} opacity={0.85} />
      <rect x={600} y={12} width={104} height={16} rx={8} fill={stroke} />
      {/* Body */}
      {children}
    </svg>
  );

  switch (kind) {
    case "home":
      return (
        <Shell>
          <rect x={40} y={70} width={260} height={120} rx={8} fill={panel} stroke={stroke} />
          <rect x={320} y={70} width={360} height={120} rx={8} fill={panel} stroke={accent} />
          <rect x={40} y={210} width={200} height={140} rx={8} fill={panel} stroke={stroke} />
          <rect x={260} y={210} width={200} height={140} rx={8} fill={panel} stroke={stroke} />
          <rect x={480} y={210} width={200} height={140} rx={8} fill={panel} stroke={stroke} />
          <rect x={40} y={370} width={640} height={36} rx={6} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "training":
      return (
        <Shell>
          <rect x={60} y={90} width={600} height={40} rx={6} fill={panel} stroke={stroke} />
          <rect x={60} y={150} width={180} height={200} rx={10} fill={panel} stroke={accent} />
          <rect x={270} y={150} width={180} height={200} rx={10} fill={panel} stroke={stroke} />
          <rect x={480} y={150} width={180} height={200} rx={10} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "bots":
      return (
        <Shell>
          {[0, 1, 2].map((tier) => (
            <g key={tier}>
              <rect x={40 + tier * 230} y={80} width={200} height={240} rx={10} fill={panel} stroke={stroke} />
              <rect x={60 + tier * 230} y={100} width={160} height={20} fill={accent} opacity={0.7} />
              {[0, 1, 2].map((idx) => (
                <rect key={idx} x={60 + tier * 230} y={140 + idx * 48} width={160} height={40} rx={6} fill={themeT.bgCard} stroke={stroke} />
              ))}
            </g>
          ))}
          <rect x={40} y={340} width={640} height={40} rx={6} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "unranked":
      return (
        <Shell>
          <rect x={140} y={110} width={440} height={80} rx={10} fill={panel} stroke={accent} />
          <rect x={220} y={220} width={280} height={60} rx={30} fill={accent} opacity={0.85} />
          <rect x={140} y={310} width={440} height={40} rx={6} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "ranked":
      return (
        <Shell>
          <rect x={40} y={80} width={260} height={90} rx={10} fill={panel} stroke={accent} />
          <rect x={320} y={80} width={360} height={90} rx={10} fill={panel} stroke={stroke} />
          <rect x={220} y={210} width={280} height={60} rx={30} fill={accent} opacity={0.85} />
          <rect x={120} y={320} width={480} height={50} rx={8} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "store":
      return (
        <Shell>
          <rect x={40} y={60} width={640} height={30} rx={6} fill={panel} stroke={stroke} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={40 + (i % 4) * 160} y={110} width={150} height={110} rx={8} fill={panel} stroke={stroke} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={40 + (i % 4) * 160} y={240} width={150} height={110} rx={8} fill={panel} stroke={stroke} />
          ))}
        </Shell>
      );
    case "collection":
      return (
        <Shell>
          <rect x={40} y={70} width={120} height={280} rx={8} fill={panel} stroke={stroke} />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={52} y={90 + i * 52} width={96} height={40} rx={6} fill={themeT.bgCard} stroke={stroke} />
          ))}
          <rect x={180} y={70} width={500} height={280} rx={8} fill={panel} stroke={stroke} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={200 + (i % 3) * 160} y={90 + Math.floor(i / 3) * 130} width={140} height={110} rx={8} fill={themeT.bgCard} stroke={stroke} />
          ))}
        </Shell>
      );
    case "friends":
      return (
        <Shell>
          <rect x={40} y={70} width={640} height={60} rx={10} fill={panel} stroke={accent} />
          <rect x={40} y={150} width={300} height={200} rx={10} fill={panel} stroke={stroke} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={56} y={170 + i * 44} width={268} height={36} rx={6} fill={themeT.bgCard} stroke={stroke} />
          ))}
          <rect x={360} y={150} width={320} height={200} rx={10} fill={panel} stroke={stroke} />
        </Shell>
      );
    case "career":
      return (
        <Shell>
          <rect x={40} y={70} width={640} height={110} rx={10} fill={panel} stroke={accent} />
          <polyline
            points="60,150 140,120 220,130 300,90 380,110 460,85 540,100 620,70 660,80"
            fill="none"
            stroke={accent}
            strokeWidth={2.5}
          />
          <rect x={40} y={200} width={640} height={150} rx={10} fill={panel} stroke={stroke} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={56} y={218 + i * 42} width={608} height={36} rx={6} fill={themeT.bgCard} stroke={stroke} />
          ))}
        </Shell>
      );
    case "profile":
      return (
        <Shell>
          <circle cx={120} cy={140} r={54} fill={panel} stroke={accent} strokeWidth={2} />
          <rect x={200} y={90} width={480} height={30} rx={6} fill={panel} stroke={stroke} />
          <rect x={200} y={130} width={360} height={20} rx={4} fill={panel} stroke={stroke} />
          <rect x={40} y={220} width={310} height={150} rx={10} fill={panel} stroke={stroke} />
          <rect x={370} y={220} width={310} height={150} rx={10} fill={panel} stroke={stroke} />
          <rect x={0} y={0} width={0} height={0} fill={textMuted} />
        </Shell>
      );
    default:
      return (
        <Shell>
          <rect x={40} y={70} width={640} height={280} rx={10} fill={panel} stroke={stroke} />
        </Shell>
      );
  }
}

/* ── Breaker diagrams (multi-board illustrations for special rounds) ────── */

function BreakerDiagram({
  step,
  themeT,
  compact = false,
}: {
  step: BreakerDiagramStep;
  themeT: (typeof THEMES)[ThemeId];
  compact?: boolean;
}) {
  if (step.variant === "rulebreaker") return <RulebreakerDiagram themeT={themeT} compact={compact} />;
  if (step.variant === "mindbreaker") return <MindbreakerDiagram themeT={themeT} compact={compact} />;
  return <LimitbreakerDiagram themeT={themeT} compact={compact} />;
}

/**
 * Mini-grid used inside the breaker diagrams. Supports optional centre
 * block marker, banned-pattern overlay (red X path) and first-turn piece
 * placements. Kept local — the tutorial's diagrams are bespoke enough that
 * reusing the full BoardFigure would fight against layout control.
 */
function MiniBoard({
  size,
  themeT,
  cell = 44,
  stones = [],
  blockedCells = [],
  banPath,
  crossOut = false,
  extraTurnPath,
}: {
  size: 5 | 6 | 7;
  themeT: (typeof THEMES)[ThemeId];
  cell?: number;
  stones?: Array<{ r: number; c: number; p: "P1" | "P2"; hint?: boolean }>;
  blockedCells?: Array<[number, number]>;
  banPath?: Array<[number, number]>;
  crossOut?: boolean;
  extraTurnPath?: Array<[number, number]>;
}) {
  const W = cell * size;
  return (
    <svg width={W} height={W} style={{ display: "block", border: `1px solid ${themeT.border}`, borderRadius: 6, background: themeT.boardBg }}>
      <rect x={0} y={0} width={W} height={W} fill={themeT.boardBg} />
      {Array.from({ length: size + 1 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i * cell} x2={W} y2={i * cell} stroke={themeT.boardLine} strokeWidth={0.8} />
          <line x1={i * cell} y1={0} x2={i * cell} y2={W} stroke={themeT.boardLine} strokeWidth={0.8} />
        </g>
      ))}

      {blockedCells.map(([r, c], i) => (
        <g key={`blk-${i}`}>
          <rect
            x={c * cell + 3}
            y={r * cell + 3}
            width={cell - 6}
            height={cell - 6}
            rx={4}
            fill={themeT.p2}
            opacity={0.18}
            stroke={themeT.p2}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <line
            x1={c * cell + 10}
            y1={r * cell + 10}
            x2={(c + 1) * cell - 10}
            y2={(r + 1) * cell - 10}
            stroke={themeT.p2}
            strokeWidth={3}
          />
          <line
            x1={(c + 1) * cell - 10}
            y1={r * cell + 10}
            x2={c * cell + 10}
            y2={(r + 1) * cell - 10}
            stroke={themeT.p2}
            strokeWidth={3}
          />
        </g>
      ))}

      {extraTurnPath && extraTurnPath.length > 1 && (
        <polyline
          points={extraTurnPath.map(([r, c]) => `${c * cell + cell / 2},${r * cell + cell / 2}`).join(" ")}
          fill="none"
          stroke={themeT.accent}
          strokeOpacity={0.45}
          strokeWidth={cell * 0.55}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {stones.map((s, i) => (
        <PieceGlyph
          key={`st-${i}`}
          cx={s.c * cell + cell / 2}
          cy={s.r * cell + cell / 2}
          cell={cell}
          slot={s.p}
          themeT={themeT}
          ringColor={s.hint ? themeT.accent : undefined}
        />
      ))}

      {banPath && banPath.length > 1 && (
        <>
          <polyline
            points={banPath.map(([r, c]) => `${c * cell + cell / 2},${r * cell + cell / 2}`).join(" ")}
            fill="none"
            stroke={themeT.p2}
            strokeOpacity={0.75}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Ban slash across the pattern */}
          <line
            x1={banPath[0][1] * cell}
            y1={banPath[banPath.length - 1][0] * cell + cell}
            x2={banPath[banPath.length - 1][1] * cell + cell}
            y2={banPath[0][0] * cell}
            stroke="#ff2a2a"
            strokeWidth={5}
            opacity={0.85}
            strokeLinecap="round"
          />
        </>
      )}

      {crossOut && (
        <>
          <line x1={6} y1={6} x2={W - 6} y2={W - 6} stroke="#ff2a2a" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
          <line x1={W - 6} y1={6} x2={6} y2={W - 6} stroke="#ff2a2a" strokeWidth={6} strokeLinecap="round" opacity={0.9} />
        </>
      )}
    </svg>
  );
}

function DiagramPanel({
  label,
  description,
  themeT,
  children,
  compact = false,
}: {
  label: string;
  description?: string;
  themeT: (typeof THEMES)[ThemeId];
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? 7 : 10,
        padding: compact ? 10 : 14,
        border: `1px solid ${themeT.border}`,
        borderRadius: 10,
        background: themeT.bgCard,
        minWidth: compact ? 0 : 260,
      }}
    >
      <div
        style={{
          fontFamily: themeT.fontDisplay,
          fontSize: compact ? 16 : 22,
          fontWeight: 800,
          color: BLOOD_RED,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      {children}
      {description && (
        <div
          style={{
            color: themeT.textSecondary,
            fontSize: compact ? 14 : 19,
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: compact ? 220 : 300,
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}

function FirstTurnChooser({ themeT, compact = false }: { themeT: (typeof THEMES)[ThemeId]; compact?: boolean }) {
  const CELL = compact ? 46 : 70;
  const labelPad = compact ? 18 : 26;
  return (
    <svg width={CELL * 3} height={CELL + labelPad + 6} style={{ display: "block" }}>
      <rect x={0} y={10} width={CELL} height={CELL} rx={8} fill={themeT.bgPanel} stroke={themeT.p1} strokeWidth={2} />
      <PieceGlyph cx={CELL / 2} cy={10 + CELL / 2} cell={CELL} slot="P1" themeT={themeT} />
      <text x={CELL / 2} y={CELL + labelPad} fontFamily={themeT.fontMono} fontSize={compact ? 11 : 13} fill={themeT.textSecondary} textAnchor="middle">
        P1 FIRST
      </text>

      <text x={CELL * 1.5} y={CELL / 2 + 18} fontFamily={themeT.fontDisplay} fontSize={compact ? 18 : 24} fill={themeT.textMuted} textAnchor="middle" fontWeight={800}>
        OR
      </text>

      <rect x={CELL * 2} y={10} width={CELL} height={CELL} rx={8} fill={themeT.bgPanel} stroke={themeT.p2} strokeWidth={2} />
      <PieceGlyph cx={CELL * 2.5} cy={10 + CELL / 2} cell={CELL} slot="P2" themeT={themeT} />
      <text x={CELL * 2.5} y={CELL + labelPad} fontFamily={themeT.fontMono} fontSize={compact ? 11 : 13} fill={themeT.textSecondary} textAnchor="middle">
        P2 FIRST
      </text>
    </svg>
  );
}

function RulebreakerDiagram({ themeT, compact = false }: { themeT: (typeof THEMES)[ThemeId]; compact?: boolean }) {
  const cell = compact ? 30 : 44;
  const smallCell = compact ? 22 : 36;
  return (
    <div style={{ display: "flex", gap: compact ? 12 : 22, flexWrap: "wrap", justifyContent: "center" }}>
      <DiagramPanel
        label="Option A · Center block"
        description="The centre cell is locked for the whole game — neither player can place there."
        themeT={themeT}
        compact={compact}
      >
        <MiniBoard size={5} themeT={themeT} cell={cell} blockedCells={[[2, 2]]} />
      </DiagramPanel>
      <DiagramPanel
        label="Option B · Force first turn"
        description="Toss winner picks who plays the opening stone instead of it being random."
        themeT={themeT}
        compact={compact}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 8 : 14, paddingTop: compact ? 6 : 30 }}>
          <FirstTurnChooser themeT={themeT} compact={compact} />
          <MiniBoard size={5} themeT={themeT} stones={[{ r: 2, c: 2, p: "P1", hint: true }]} cell={smallCell} />
        </div>
      </DiagramPanel>
    </div>
  );
}

function MindbreakerDiagram({ themeT, compact = false }: { themeT: (typeof THEMES)[ThemeId]; compact?: boolean }) {
  /* Seven-by-seven mid-game snapshot. P1 has two bonus-pattern options
     circled mid-play; both would complete an extra win geometry that only
     P1 can claim. */
  const midPanelStones: Array<{ r: number; c: number; p: "P1" | "P2"; hint?: boolean }> = [
    { r: 3, c: 3, p: "P1" },
    { r: 3, c: 2, p: "P1" },
    { r: 0, c: 0, p: "P2" },
    { r: 6, c: 6, p: "P2" },
    { r: 2, c: 3, p: "P1", hint: true },
    { r: 4, c: 3, p: "P1", hint: true },
  ];
  const cell = compact ? 26 : 38;
  return (
    <div style={{ display: "flex", gap: compact ? 12 : 22, flexWrap: "wrap", justifyContent: "center" }}>
      <DiagramPanel
        label="Option A · Pick two bonus patterns"
        description="Mid-game, P1 picks two extra cells (ringed) that only count as wins for them."
        themeT={themeT}
        compact={compact}
      >
        <MiniBoard size={7} themeT={themeT} cell={cell} stones={midPanelStones} />
      </DiagramPanel>
      <DiagramPanel
        label="Option B · Pattern banned"
        description="A chosen pattern stops counting — here P2 lines up a diagonal, but the ban nullifies the win."
        themeT={themeT}
        compact={compact}
      >
        <MiniBoard
          size={7}
          themeT={themeT}
          cell={cell}
          stones={[
            { r: 0, c: 0, p: "P2" },
            { r: 1, c: 1, p: "P2" },
            { r: 2, c: 2, p: "P2" },
            { r: 3, c: 3, p: "P2" },
            { r: 4, c: 4, p: "P2" },
            { r: 5, c: 5, p: "P2" },
            { r: 6, c: 6, p: "P2" },
            { r: 0, c: 6, p: "P1" },
            { r: 6, c: 0, p: "P1" },
          ]}
          banPath={[[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]]}
        />
      </DiagramPanel>
    </div>
  );
}

function LimitbreakerDiagram({ themeT, compact = false }: { themeT: (typeof THEMES)[ThemeId]; compact?: boolean }) {
  const cell5 = compact ? 24 : 38;
  const cell6 = compact ? 22 : 38;
  const cell7 = compact ? 20 : 34;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 12 : 20 }}>
      <div style={{ display: "flex", gap: compact ? 10 : 18, flexWrap: "wrap", justifyContent: "center" }}>
        <DiagramPanel label="5×5 · locked out" themeT={themeT} compact={compact}>
          <MiniBoard size={5} themeT={themeT} cell={cell5} crossOut />
        </DiagramPanel>
        <DiagramPanel label="6×6 · played" themeT={themeT} compact={compact}>
          <MiniBoard size={6} themeT={themeT} cell={cell6} stones={[
            { r: 2, c: 2, p: "P1" },
            { r: 3, c: 3, p: "P2" },
          ]} />
        </DiagramPanel>
        <DiagramPanel label="7×7 · locked out" themeT={themeT} compact={compact}>
          <MiniBoard size={7} themeT={themeT} cell={cell7} crossOut />
        </DiagramPanel>
      </div>
      <DiagramPanel
        label="Toss · first turn on surviving board"
        description="Toss winner forces which side opens the Limitbreaker game."
        themeT={themeT}
        compact={compact}
      >
        <FirstTurnChooser themeT={themeT} compact={compact} />
      </DiagramPanel>
    </div>
  );
}

/* ── Rank ladder (bottom-to-top with increasing glow) ────────────────────── */

function RankLadder({ themeT, compact = false }: { themeT: (typeof THEMES)[ThemeId]; compact?: boolean }) {
  /* Drop UNRANKED from the visible ladder — the tutorial is teaching the
     six real tiers. Ordered from highest tier at the top to lowest at the
     bottom per the user spec ("bottom to up"). */
  const ladder = RANKS.filter((r) => r.name !== "UNRANKED").slice().reverse();

  /* Elo window formatter. RANKS uses a half-open [min, max) interval; the
     top tier (CHRONICLE) sets max to 1 000 000 so we render it as an
     open-ended threshold to match how ProfileScreen describes it. */
  const eloRange = (rank: { min: number; max: number }): string => {
    if (rank.max >= 100000) return `${rank.min}+`;
    return `${rank.min} – ${rank.max - 1}`;
  };

  const badgeSize = compact ? 62 : 86;
  const rowGap = compact ? 10 : 16;
  const rowPad = compact ? "10px 16px" : "12px 22px";
  const minWidth = compact ? 360 : 440;
  const innerGap = compact ? 18 : 24;
  const nameSize = compact ? 26 : 34;
  const eloSize = compact ? 17 : 21;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: rowGap,
        padding: compact ? "14px 18px" : "18px 24px",
        border: `1px solid ${themeT.border}`,
        borderRadius: 14,
        background: themeT.bgCard,
      }}
    >
      {ladder.map((rank) => {
        const strength = rankGlowVisualStrength(rank);
        const haloGradient = rankHaloGradientForRank(rank.color, rank);
        return (
          <div
            key={rank.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: innerGap,
              padding: rowPad,
              borderRadius: 12,
              minWidth,
              background: `linear-gradient(90deg, transparent 0%, ${rank.color}18 60%, transparent 100%)`,
              border: `1px solid ${rank.color}40`,
              boxShadow: `0 0 ${(compact ? 10 : 12) + Math.round(strength * (compact ? 34 : 40))}px ${rank.color}${Math.min(255, Math.round(70 + strength * 160)).toString(16).padStart(2, "0")}`,
            }}
          >
            <div style={{ position: "relative", width: badgeSize, height: badgeSize, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  background: haloGradient,
                  filter: `blur(${Math.max(2, strength * 6)}px)`,
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1 }}>
                <NavRankBadge rank={rank} size={badgeSize} />
              </div>
            </div>
            <div
              style={{
                fontFamily: themeT.fontDisplay,
                fontSize: nameSize,
                fontWeight: 800,
                letterSpacing: "0.18em",
                color: rank.color,
                textShadow: `0 0 ${8 + Math.round(strength * 20)}px ${rank.color}`,
                textTransform: "uppercase",
                flex: 1,
              }}
            >
              {rank.name}
            </div>
            <div
              style={{
                fontFamily: themeT.fontMono,
                fontSize: eloSize,
                letterSpacing: "0.08em",
                color: rank.color,
                opacity: 0.92,
                textShadow: `0 0 ${6 + Math.round(strength * 14)}px ${rank.color}80`,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {eloRange(rank)} ELO
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Progress pips ───────────────────────────────────────────────────────── */

function ProgressPips({
  current,
  total,
  color,
  dim,
}: {
  current: number;
  total: number;
  color: string;
  dim: string;
}) {
  // Map steps to section headers so the pip rail is readable. We collapse
  // per-section into a single pip pair (section done / section in-progress)
  // rather than showing one pip per step — that'd be way too many dots.
  const sections = TUTORIAL_SECTIONS;
  let cum = 0;
  const pips: Array<{ active: boolean; done: boolean }> = [];
  for (const s of sections) {
    const start = cum;
    const end = cum + s.steps.length - 1;
    const done = current > end;
    const active = current >= start && current <= end;
    pips.push({ active, done });
    cum += s.steps.length;
  }
  void total;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
      {pips.map((p, i) => (
        <div
          key={i}
          style={{
            width: p.active ? 22 : 10,
            height: 6,
            borderRadius: 3,
            background: p.done || p.active ? color : dim,
            opacity: p.done && !p.active ? 0.55 : 1,
            transition: "width 0.22s ease",
          }}
          title={sections[i].title}
        />
      ))}
    </div>
  );
}

/* ── Syros epigraph (tutorial quotes) ───────────────────────────────────── */

const SYROS_TUTORIAL_VIOLET = "#C084FC";
const SYROS_TUTORIAL_DEEP = "#4C1D95";
const SYROS_TUTORIAL_MID = "#7C3AED";
const SYROS_TUTORIAL_MIST = "#E9D5FE";

function SyrosBlock({ quote, themeT }: { quote: string; themeT: Theme }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&display=swap');
        @keyframes pp-tutorial-syros-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pp-syros-laser-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pp-syros-aura-breathe {
          0%, 100% {
            box-shadow:
              0 0 22px rgba(192,132,252,0.55),
              0 0 48px rgba(124,58,237,0.35),
              0 0 72px rgba(76,29,149,0.25),
              inset 0 0 40px rgba(30,10,60,0.5);
          }
          50% {
            box-shadow:
              0 0 36px rgba(192,132,252,0.85),
              0 0 72px rgba(167,139,250,0.45),
              0 0 96px rgba(124,58,237,0.35),
              inset 0 0 52px rgba(45,15,90,0.55);
          }
        }
        @keyframes pp-syros-pfp-orbit {
          0%, 100% {
            box-shadow:
              0 0 14px rgba(192,132,252,0.85),
              0 0 28px rgba(124,58,237,0.55),
              inset 0 0 10px rgba(192,132,252,0.25);
          }
          50% {
            box-shadow:
              0 0 22px rgba(233,213,254,0.95),
              0 0 40px rgba(192,132,252,0.65),
              inset 0 0 14px rgba(167,139,250,0.35);
          }
        }
        @keyframes pp-syros-scanline {
          0% { transform: translateY(-100%); opacity: 0.06; }
          100% { transform: translateY(100%); opacity: 0.12; }
        }
      `}</style>
      <div
        style={{
          marginTop: 0,
          borderRadius: 14,
          padding: 3,
          background: `linear-gradient(
            105deg,
            ${SYROS_TUTORIAL_VIOLET},
            ${SYROS_TUTORIAL_MID},
            #A78BFA,
            ${SYROS_TUTORIAL_MIST},
            ${SYROS_TUTORIAL_MID},
            ${SYROS_TUTORIAL_VIOLET},
            ${SYROS_TUTORIAL_DEEP}
          )`,
          backgroundSize: "400% 400%",
          animation: "pp-syros-laser-flow 3.2s ease-in-out infinite, pp-syros-aura-breathe 4s ease-in-out infinite",
        }}
      >
        <div
          style={{
            borderRadius: 11,
            position: "relative",
            overflow: "hidden",
            padding: "22px 26px",
            background: `radial-gradient(ellipse 130% 90% at 50% -20%, rgba(192,132,252,0.35), transparent 55%),
              radial-gradient(ellipse 100% 70% at 80% 120%, rgba(124,58,237,0.28), transparent 50%),
              linear-gradient(165deg, rgba(24,8,48,0.98) 0%, rgba(8,2,18,0.99) 45%, rgba(18,6,40,0.98) 100%)`,
            border: "1px solid rgba(192,132,252,0.35)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: "42%",
              background: "linear-gradient(180deg, rgba(192,132,252,0.14), transparent)",
              pointerEvents: "none",
              animation: "pp-syros-scanline 5.5s linear infinite",
            }}
          />
          <div
            key={quote}
            style={{
              position: "relative",
              animation: "pp-tutorial-syros-fade 0.35s ease forwards",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: `2px solid ${SYROS_TUTORIAL_MIST}`,
                  background: "#0B0514",
                  animation: "pp-syros-pfp-orbit 2.6s ease-in-out infinite",
                }}
              >
                <img
                  src={SYROS_PFP_URL}
                  alt="SYROS"
                  width={56}
                  height={56}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div
                style={{
                  fontFamily: "'Orbitron', system-ui, sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: "0.28em",
                  color: SYROS_TUTORIAL_MIST,
                  textTransform: "uppercase",
                  textShadow:
                    "0 0 12px rgba(192,132,252,0.9), 0 0 28px rgba(124,58,237,0.65), 0 0 2px rgba(0,0,0,0.8)",
                  lineHeight: 1.25,
                }}
              >
                SYROS
              </div>
            </div>
            <div
              style={{
                fontFamily: `'Cormorant Garamond', 'Palatino Linotype', ${themeT.fontBody}, Georgia, serif`,
                fontSize: "clamp(22px, 2.4vw, 28px)",
                fontWeight: 600,
                fontStyle: "italic",
                color: "rgba(237, 233, 254, 0.94)",
                lineHeight: 1.55,
                textShadow: "0 0 20px rgba(192,132,252,0.25), 0 1px 0 rgba(0,0,0,0.5)",
              }}
            >
              {quote}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

type BtnKind = "primary" | "ghost" | "disabled";
function btn(
  themeT: (typeof THEMES)[ThemeId],
  kind: BtnKind,
): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "11px 22px",
    borderRadius: 8,
    fontFamily: themeT.fontMono,
    fontSize: 22,
    letterSpacing: "0.12em",
    fontWeight: 700,
    cursor: kind === "disabled" ? "default" : "pointer",
    border: `1px solid ${themeT.border}`,
    background: "transparent",
    color: themeT.text,
    minWidth: 120,
    textAlign: "center",
  };
  if (kind === "primary") {
    return {
      ...base,
      background: themeT.accent,
      color: themeT.bg,
      border: `1px solid ${themeT.accent}`,
      boxShadow: `0 0 12px ${themeT.accent}33`,
    };
  }
  if (kind === "ghost") {
    return { ...base, color: themeT.textSecondary };
  }
  return { ...base, opacity: 0.4, color: themeT.textMuted };
}
