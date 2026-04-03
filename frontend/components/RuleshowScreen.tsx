"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  PATTERN_METADATA_5,
  PATTERN_METADATA_6,
  PATTERN_METADATA_7,
  PatternInfo,
} from "@/lib/patterns_metadata";
import { MULTIPLAYER_RULE_BLOCKS } from "@/lib/multiplayerRulesNarrative";

export type RuleshowSheet = "5x5" | "6x6" | "7x7";

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
  onToggleReadyAction: (selected?: string[]) => void;
};

function PatternDiagram({ info, accent, isSelected }: { info: PatternInfo; accent: string; isSelected: boolean }) {
  const cells = info.cells;
  const gridSize = info.gridSize;
  const cellSize = 14;
  const gap = 2;
  const cellSet = new Set(cells.map(([r, c]) => `${r},${c}`));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
        gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
        gap,
        marginTop: 8,
      }}
    >
      {Array.from({ length: gridSize }, (_, r) =>
        Array.from({ length: gridSize }, (_, c) => {
          const filled = cellSet.has(`${r},${c}`);
          return (
            <div
              key={`${r}-${c}`}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                background: filled ? (isSelected ? accent : `${accent}66`) : "rgba(255,255,255,0.04)",
                border: filled ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.06)",
                transition: "all 0.2s",
              }}
            />
          );
        })
      )}
    </div>
  );
}

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
}: RuleshowScreenProps) {
  const is77 = sheet === "7x7";
  const is66 = sheet === "6x6";

  const [rulesSecLeft, setRulesSecLeft] = useState(60);
  const selected77Ref = useRef<Set<string>>(new Set());
  const autoReadyFiredRef = useRef(false);

  const patterns = is77 ? PATTERN_METADATA_7 : is66 ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const patternList = Object.values(patterns);

  const [selected77, setSelected77] = useState<Set<string>>(new Set(Object.keys(PATTERN_METADATA_7)));

  const toggle77 = (id: string) => {
    if (!is77) return;
    setSelected77(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  selected77Ref.current = selected77;

  useEffect(() => {
    if (!is66 && !is77) {
      setRulesSecLeft(60);
      return;
    }
    autoReadyFiredRef.current = false;
    setRulesSecLeft(60);
    const id = window.setInterval(() => {
      setRulesSecLeft(s => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sheet, is66, is77]);

  useEffect(() => {
    if (!is66 && !is77) return;
    if (rulesSecLeft !== 0) return;
    if (autoReadyFiredRef.current) return;
    const myReady = mySlot === "P1" ? p1Ready : p2Ready;
    if (myReady) return;
    autoReadyFiredRef.current = true;
    if (is77) {
      let ids = Array.from(selected77Ref.current);
      if (ids.length < 5) {
        const all = Object.keys(PATTERN_METADATA_7);
        const next = new Set(selected77Ref.current);
        for (const pid of all) {
          if (next.size >= 5) break;
          next.add(pid);
        }
        ids = Array.from(next);
      }
      onToggleReadyAction(ids);
    } else {
      onToggleReadyAction(undefined);
    }
  }, [rulesSecLeft, is66, is77, mySlot, p1Ready, p2Ready, onToggleReadyAction]);

  const kicker = is77 ? "7×7 LEG UNLOCKED" : is66 ? "6×6 LEG UNLOCKED" : "5×5 SERIES";
  const title = "SELECT PATTERNS";
  const desc = is77
    ? "Choose 5 to 6 winning patterns for this high-tier leg."
    : is66
      ? "Five mandatory patterns enforced for the 6×6 protocol."
      : "Standard active patterns for the 5×5 series.";

  const chipPadV = Math.round(8 * RS);
  const chipPadH = Math.round(16 * RS);
  const chipFont = Math.round(12 * RS);
  const btnPadV = Math.round(14 * RS);
  const btnPadH = Math.round(48 * RS);
  const btnFont = Math.round(16 * RS);
  const selFont = Math.round(12 * RS);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10003,
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
        {(is66 || is77) && (
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
            AUTO-START IN {Math.floor(rulesSecLeft / 60)}:{String(rulesSecLeft % 60).padStart(2, "0")}
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
        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, textAlign: "center", marginTop: 8, maxWidth: 500 }}>
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
            maxHeight: "min(42vh, 360px)",
            overflowY: "auto",
          }}
        >
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 12 }}>
            PROTOCOL RULES · SAME AS HOW TO PLAY
          </div>
          {MULTIPLAYER_RULE_BLOCKS.map(block => (
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

        {is77 && (
          <div style={{ marginTop: 12, fontFamily: t.fontMono, fontSize: selFont, color: selected77.size >= 5 ? "#22C55E" : t.textMuted }}>
            {selected77.size} / 7 SELECTED
          </div>
        )}

        {/* Pattern cards — same pattern metadata as single-player */}
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
          {patternList.map(p => {
            const isSelected = is77 ? selected77.has(p.id) : true;
            return (
              <div
                key={p.id}
                onClick={() => is77 && toggle77(p.id)}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${isSelected ? t.accent : t.border}`,
                  borderRadius: ip ? 2 : 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  cursor: is77 ? "pointer" : "default",
                  transition: "all 0.2s",
                  boxShadow: isSelected ? `0 0 20px ${t.accent}11` : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      fontWeight: 800,
                      color: isSelected ? t.accent : t.text,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {p.label}
                  </div>
                  {is77 && (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${isSelected ? t.accent : t.textMuted}`,
                        background: isSelected ? t.accent : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <span style={{ fontSize: 12, color: "#000", fontWeight: 900 }}>✓</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, lineHeight: 1.4, minHeight: 34 }}>
                  {p.desc}
                </div>
                <PatternDiagram info={p} accent={t.accent} isSelected={isSelected} />
              </div>
            );
          })}
        </div>

        {/* Readiness + primary action */}
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
            disabled={is77 && selected77.size < 5}
            onClick={() => {
              onToggleReadyAction(is77 ? Array.from(selected77) : undefined);
            }}
            style={{
              padding: `${btnPadV}px ${btnPadH}px`,
              borderRadius: ip ? 2 : 12,
              border: `2px solid ${t.accent}`,
              background: is77 && selected77.size < 5 ? "transparent" : `${t.accent}22`,
              color: t.accent,
              fontFamily: t.fontDisplay,
              fontSize: btnFont,
              fontWeight: 900,
              letterSpacing: "0.08em",
              cursor: is77 && selected77.size < 5 ? "not-allowed" : "pointer",
              opacity: is77 && selected77.size < 5 ? 0.4 : 1,
              transition: "all 0.2s",
            }}
          >
            {(mySlot === "P1" ? p1Ready : p2Ready) ? "UNREADY" : "START MATCH →"}
          </button>
        </div>
      </div>
    </div>
  );
}
