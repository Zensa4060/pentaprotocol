"use client";

/**
 * Syros narrator card — the talking-head used by the guided onboarding and
 * the home tour. Shows the Syros portrait (glowing purple ring) beside a
 * speech bubble that types the current line out, and speaks it aloud via the
 * browser TTS voice. Optional NEXT button for manually-paced steps.
 *
 * Presentational + self-contained: the parent owns which `line` is showing;
 * this component only animates + voices whatever it's handed. It speaks once
 * per distinct line (keyed by `lineKey ?? line`) so re-renders don't restart
 * the voice.
 */

import { useEffect, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { SYROS_PFP_URL } from "@/lib/unrankedBots";
import type { SyrosVoice } from "@/hooks/useSyrosVoice";

const SYROS_PURPLE = "#9333EA";
const TYPE_MS = 22;

export interface SyrosNarratorProps {
  line: string;
  themeId: ThemeId;
  voice: SyrosVoice;
  /** Optional eyebrow/title above the line (e.g. the tour step title). */
  title?: string;
  /** Show a NEXT button. Omit `onNext` to hide it (auto-paced flows). */
  onNext?: () => void;
  nextLabel?: string;
  /** Stable key for the current line so the typewriter + voice only restart on
   *  a genuinely new line (defaults to the line text). */
  lineKey?: string;
  /** Compact variant for the tour tooltip. */
  compact?: boolean;
}

export default function SyrosNarrator({
  line,
  themeId,
  voice,
  title,
  onNext,
  nextLabel = "NEXT",
  lineKey,
  compact = false,
}: SyrosNarratorProps) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const key = lineKey ?? line;
  const [shown, setShown] = useState("");
  const spokenKey = useRef<string | null>(null);

  // Speak once per distinct line.
  useEffect(() => {
    if (spokenKey.current === key) return;
    spokenKey.current = key;
    voice.speak(line);
  }, [key, line, voice]);

  // Typewriter reveal.
  useEffect(() => {
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(line.slice(0, i));
      if (i >= line.length) window.clearInterval(id);
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [key, line]);

  const avatar = compact ? 44 : 64;

  return (
    <div
      style={{
        display: "flex",
        gap: compact ? 12 : 16,
        alignItems: "flex-start",
        maxWidth: compact ? 360 : 560,
      }}
    >
      {/* Portrait */}
      <div
        style={{
          flexShrink: 0,
          width: avatar,
          height: avatar,
          borderRadius: "50%",
          padding: 2,
          background: `radial-gradient(circle at 50% 30%, ${SYROS_PURPLE}, ${SYROS_PURPLE}55)`,
          boxShadow: `0 0 22px ${SYROS_PURPLE}88`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SYROS_PFP_URL}
          alt="Syros"
          width={avatar - 4}
          height={avatar - 4}
          style={{ width: avatar - 4, height: avatar - 4, borderRadius: "50%", objectFit: "cover", display: "block" }}
        />
      </div>

      {/* Bubble */}
      <div
        style={{
          flex: 1,
          background: t.bgCard,
          border: `1px solid ${SYROS_PURPLE}55`,
          borderRadius: 14,
          padding: compact ? "12px 14px" : "16px 18px",
          boxShadow: `0 8px 32px ${SYROS_PURPLE}22`,
        }}
      >
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 10,
            letterSpacing: "0.18em",
            color: SYROS_PURPLE,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          {title ? title : "SYROS"}
        </div>
        <div
          style={{
            fontFamily: t.fontBody,
            fontSize: compact ? 14 : 16,
            lineHeight: 1.55,
            color: t.text,
            minHeight: compact ? 38 : 48,
          }}
        >
          {shown}
          <span style={{ opacity: shown.length < line.length ? 1 : 0, color: SYROS_PURPLE }}>▍</span>
        </div>

        {onNext && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button
              type="button"
              onClick={onNext}
              style={{
                background: SYROS_PURPLE,
                border: "none",
                color: "#fff",
                fontFamily: t.fontDisplay,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                padding: "8px 22px",
                borderRadius: 8,
                cursor: "pointer",
                boxShadow: `0 0 18px ${SYROS_PURPLE}66`,
              }}
            >
              {nextLabel} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
