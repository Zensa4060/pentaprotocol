"use client";

/**
 * Spotlight tour — dims the screen and cuts a hole around one target element
 * at a time while Syros narrates it. Targets are matched by a `data-tour`
 * attribute on the real UI (e.g. `data-tour="home-play"`), so the tour rides
 * on top of the live Home screen / nav rather than a mock.
 *
 * Steps whose target isn't present on this screen are skipped automatically,
 * so the same `HOME_TOUR` list works even if a platform is missing a tile.
 */

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { TourStep } from "@/lib/guidedGames";
import type { SyrosVoice } from "@/hooks/useSyrosVoice";
import SyrosNarrator from "@/components/SyrosNarrator";

const PAD = 8;
const SYROS_PURPLE = "#9333EA";

export interface SpotlightTourProps {
  steps: TourStep[];
  themeId: ThemeId;
  voice: SyrosVoice;
  onDone: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function targetEl(step: TourStep | undefined): HTMLElement | null {
  if (typeof document === "undefined" || !step) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
}

export default function SpotlightTour({ steps, themeId, voice, onDone }: SpotlightTourProps) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];

  const advance = useCallback(() => {
    setIndex((i) => i + 1);
  }, []);

  // Finished?
  useEffect(() => {
    if (index >= steps.length) {
      voice.cancel();
      onDone();
    }
  }, [index, steps.length, onDone, voice]);

  // Skip any step whose target element is missing on this screen.
  useEffect(() => {
    if (index >= steps.length) return;
    if (!targetEl(step)) {
      const id = window.setTimeout(() => setIndex((i) => i + 1), 0);
      return () => window.clearTimeout(id);
    }
  }, [index, step, steps.length]);

  // Measure the current target (and keep it measured on scroll/resize).
  useLayoutEffect(() => {
    if (index >= steps.length) return;
    const el = targetEl(step);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const id = window.setTimeout(measure, 220); // after smooth scroll settles
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index, step, steps.length]);

  if (index >= steps.length || !step || !rect) return null;

  // Position the tooltip below the target if there's room, else above.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = rect.top + rect.height + 220 < vh;
  const tooltipTop = below ? rect.top + rect.height + PAD + 10 : Math.max(12, rect.top - 200);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000 }}>
      {/* Dimmer with a cut-out hole via a giant box-shadow spread. */}
      <div
        style={{
          position: "fixed",
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 14,
          boxShadow: `0 0 0 9999px rgba(2,2,6,0.74)`,
          border: `2px solid ${SYROS_PURPLE}`,
          pointerEvents: "none",
          transition: "all 0.28s cubic-bezier(.22,.68,0,1.2)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 14,
            boxShadow: `0 0 28px ${SYROS_PURPLE}aa`,
            animation: "tourPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>

      {/* Tooltip card with the narrator. */}
      <div
        style={{
          position: "fixed",
          top: tooltipTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(92vw, 560px)",
          background: t.bg,
          border: `1px solid ${SYROS_PURPLE}44`,
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 16px 56px rgba(0,0,0,0.6)",
        }}
      >
        <SyrosNarrator
          line={step.line}
          title={step.title}
          themeId={themeId}
          voice={voice}
          lineKey={`tour-${index}`}
          onNext={advance}
          nextLabel={index === steps.length - 1 ? "DONE" : "NEXT"}
          compact
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              voice.cancel();
              onDone();
            }}
            style={{
              background: "transparent",
              border: "none",
              color: t.textMuted,
              fontFamily: t.fontMono,
              fontSize: 11,
              letterSpacing: "0.12em",
              cursor: "pointer",
            }}
          >
            SKIP TOUR
          </button>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>
            {index + 1} / {steps.length}
          </div>
        </div>
      </div>

      <style>{`@keyframes tourPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  );
}
