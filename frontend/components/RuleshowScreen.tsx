"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  PATTERN_METADATA_5,
  PATTERN_METADATA_6,
  PATTERN_METADATA_7,
} from "@/lib/patterns_metadata";
import { getRuleshowBlocks, type RuleshowSheetKind } from "@/lib/ruleshowNarrative";
import PatternDiagram from "./PatternDiagram";

export type RuleshowSheet = RuleshowSheetKind;

type RuleshowScreenProps = {
  sheet: RuleshowSheet;
  t: {
    accent: string;
    border: string;
    fontDisplay: string;
    fontMono: string;
    fontBody: string;
    text: string;
    textSecondary: string;
    textMuted: string;
  };
  ip: boolean;
  p1c: string;
  p2c: string;
  p1Ready: boolean;
  p2Ready: boolean;
  mySlot: "P1" | "P2";
  /** Leg sheets: toggles level-up ready (no pattern payload). Protocol sheet: omit or unused. */
  onToggleReadyAction: (selected?: string[]) => void;
  /** Protocolbreaker explainer only — clears rules sheet; does not reset limitbreaker overlay. */
  onDismissSheetAction?: () => void;
};

/** +60% vs prior sizing for readiness chips and primary button */
const RS = 1.6;

export default function RuleshowScreen({
  sheet,
  t,
  ip,
  p1c,
  p2c,
  p1Ready,
  p2Ready,
  mySlot,
  onToggleReadyAction,
  onDismissSheetAction,
}: RuleshowScreenProps) {
  const isProtocol = sheet === "protocolbreaker";
  const is77 = sheet === "7x7";
  const is66 = sheet === "6x6";
  const is55 = sheet === "5x5";
  const legSheet = is55 || is66 || is77;

  const [rulesSecLeft, setRulesSecLeft] = useState(60);
  const autoReadyFiredRef = useRef(false);
  const autoDismissFiredRef = useRef(false);

  const patterns = is77 ? PATTERN_METADATA_7 : is66 ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const patternList = legSheet ? Object.values(patterns) : [];
  const ruleBlocks = getRuleshowBlocks(sheet);

  useEffect(() => {
    if (!legSheet && !isProtocol) return;
    autoReadyFiredRef.current = false;
    autoDismissFiredRef.current = false;
    setRulesSecLeft(60);
    const id = window.setInterval(() => {
      setRulesSecLeft(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sheet, legSheet, isProtocol]);

  useEffect(() => {
    if (!legSheet) return;
    if (rulesSecLeft !== 0) return;
    if (autoReadyFiredRef.current) return;
    const myReady = mySlot === "P1" ? p1Ready : p2Ready;
    if (myReady) return;
    autoReadyFiredRef.current = true;
    onToggleReadyAction(undefined);
  }, [rulesSecLeft, legSheet, mySlot, p1Ready, p2Ready, onToggleReadyAction]);

  useEffect(() => {
    if (!isProtocol || !onDismissSheetAction) return;
    if (rulesSecLeft !== 0) return;
    if (autoDismissFiredRef.current) return;
    autoDismissFiredRef.current = true;
    onDismissSheetAction();
  }, [rulesSecLeft, isProtocol, onDismissSheetAction]);

  const kicker = isProtocol
    ? "MATCH TIED AFTER NINE GAMES"
    : is77
      ? "7×7 LEG"
      : is66
        ? "6×6 LEG"
        : "5×5 LEG";
  const title = isProtocol ? "PROTOCOLBREAKER" : "LEG RULES & PATTERNS";
  const desc = isProtocol
    ? "How the sudden-death decider works. Continue to the Limitbreaker flow underneath."
    : is77
      ? "Reference patterns and leg rules for 7×7 — selection is server-side; this screen is informational."
      : is66
        ? "Six-in-a-line, five fixed 6-cell shapes, and Timebreaker before game 6 on this leg."
        : "First-to-5 series framing, 5×5 centre rule, shapes, chain threshold, and Rulebreaker before game 3 here.";

  const chipPadV = Math.round(8 * RS);
  const chipPadH = Math.round(16 * RS);
  const chipFont = Math.round(12 * RS);
  const btnPadV = Math.round(14 * RS);
  const btnPadH = Math.round(48 * RS);
  const btnFont = Math.round(16 * RS);

  const overlayZ = isProtocol ? 11650 : 10003;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: overlayZ,
        background: "rgba(4,7,14,0.98)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "60px 20px 20px",
        overflow: "auto",
        backdropFilter: "blur(12px)",
      }}
    >
      <div style={{ width: "min(1100px, 95vw)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.22em", textAlign: "center" }}>
          {kicker}
        </div>
        {(legSheet || isProtocol) && (
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              color: rulesSecLeft <= 10 ? "#F59E0B" : t.textSecondary,
              letterSpacing: "0.12em",
              textAlign: "center",
              marginTop: 10,
              fontWeight: 700,
            }}
          >
            {isProtocol ? "AUTO-CONTINUE IN " : "AUTO-START IN "}
            {Math.floor(rulesSecLeft / 60)}:{String(rulesSecLeft % 60).padStart(2, "0")}
          </div>
        )}
        <div
          style={{
            fontFamily: t.fontDisplay,
            fontSize: "clamp(32px,5vw,52px)",
            color: t.accent,
            textAlign: "center",
            fontWeight: 900,
            marginTop: 8,
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, textAlign: "center", marginTop: 8, maxWidth: 520 }}>
          {desc}
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 720,
            marginTop: 24,
            padding: "16px 18px",
            borderRadius: ip ? 2 : 14,
            border: `1px solid ${t.border}`,
            background: "rgba(255,255,255,0.02)",
            maxHeight: isProtocol ? "min(50vh, 420px)" : "min(42vh, 360px)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 12 }}>
            LEG SUMMARY · NOT THE FULL “HOW TO PLAY”
          </div>
          {ruleBlocks.map(block => (
            <div key={block.id} style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, color: t.accent, letterSpacing: "0.06em", marginBottom: 6 }}>
                {block.title}
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, lineHeight: 1.55, whiteSpace: "pre-line" }}>
                {block.detail}
              </div>
            </div>
          ))}
        </div>

        {legSheet && (
          <div
            style={{
              marginTop: 28,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              width: "100%",
              paddingBottom: 28,
            }}
          >
            {patternList.map(p => (
              <div
                key={p.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${t.border}`,
                  borderRadius: ip ? 2 : 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  cursor: "default",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      fontWeight: 800,
                      color: t.text,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {p.label}
                  </div>
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, lineHeight: 1.4, minHeight: 34 }}>
                  {p.desc}
                </div>
                <PatternDiagram info={p} accent={t.accent} isSelected={false} />
              </div>
            ))}
          </div>
        )}

        {!isProtocol && (
          <>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: Math.round(14 * RS), flexWrap: "wrap" }}>
              <div
                style={{
                  padding: `${chipPadV}px ${chipPadH}px`,
                  borderRadius: ip ? 2 : 8,
                  border: `1px solid ${p1Ready ? p1c : t.border}`,
                  color: p1Ready ? p1c : t.textMuted,
                  fontFamily: t.fontMono,
                  fontSize: chipFont,
                  fontWeight: 700,
                  background: p1Ready ? `${p1c}12` : "transparent",
                }}
              >
                P1: {p1Ready ? "READY" : "WAITING"}
              </div>
              <div
                style={{
                  padding: `${chipPadV}px ${chipPadH}px`,
                  borderRadius: ip ? 2 : 8,
                  border: `1px solid ${p2Ready ? p2c : t.border}`,
                  color: p2Ready ? p2c : t.textMuted,
                  fontFamily: t.fontMono,
                  fontSize: chipFont,
                  fontWeight: 700,
                  background: p2Ready ? `${p2c}12` : "transparent",
                }}
              >
                P2: {p2Ready ? "READY" : "WAITING"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: Math.round(20 * RS), gap: 12 }}>
              <button
                type="button"
                onClick={() => onToggleReadyAction(undefined)}
                style={{
                  padding: `${btnPadV}px ${btnPadH}px`,
                  borderRadius: ip ? 2 : 12,
                  border: `2px solid ${t.accent}`,
                  background: `${t.accent}22`,
                  color: t.accent,
                  fontFamily: t.fontDisplay,
                  fontSize: btnFont,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {(mySlot === "P1" ? p1Ready : p2Ready) ? "UNREADY" : "START MATCH →"}
              </button>
            </div>
          </>
        )}

        {isProtocol && onDismissSheetAction && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: Math.round(28 * RS), gap: 12 }}>
            <button
              type="button"
              onClick={() => onDismissSheetAction()}
              style={{
                padding: `${btnPadV}px ${btnPadH}px`,
                borderRadius: ip ? 2 : 12,
                border: `2px solid ${t.accent}`,
                background: `${t.accent}22`,
                color: t.accent,
                fontFamily: t.fontDisplay,
                fontSize: btnFont,
                fontWeight: 900,
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              CONTINUE →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
