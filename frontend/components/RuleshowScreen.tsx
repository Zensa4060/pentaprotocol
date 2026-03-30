"use client";
import React, { useState } from "react";
import { 
  PATTERN_METADATA_5, 
  PATTERN_METADATA_6, 
  PATTERN_METADATA_7, 
  PatternInfo 
} from "@/lib/patterns_metadata";

export type RuleshowSheet = "5x5" | "6x6" | "7x7";

export const RULESHOW_SKIP_STORAGE_5x5 = "pentaprotocol_ruleshow_skip_5x5";
export const RULESHOW_SKIP_STORAGE_6x6 = "pentaprotocol_ruleshow_skip_6x6";
export const RULESHOW_SKIP_STORAGE_7x7 = "pentaprotocol_ruleshow_skip_7x7";

export function readRuleshowSkip(sheet: RuleshowSheet): boolean {
  if (typeof window === "undefined") return false;
  const k =
    sheet === "7x7" ? RULESHOW_SKIP_STORAGE_7x7 :
    sheet === "6x6" ? RULESHOW_SKIP_STORAGE_6x6 :
    RULESHOW_SKIP_STORAGE_5x5;
  return window.localStorage.getItem(k) === "1";
}

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
    <div style={{
      display: "grid",
      gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
      gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
      gap,
      marginTop: 8,
    }}>
      {Array.from({ length: gridSize }, (_, r) =>
        Array.from({ length: gridSize }, (_, c) => {
          const filled = cellSet.has(`${r},${c}`);
          return (
            <div key={`${r}-${c}`} style={{
              width: cellSize,
              height: cellSize,
              borderRadius: 2,
              background: filled
                ? isSelected ? accent : `${accent}66`
                : "rgba(255,255,255,0.04)",
              border: filled ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.06)",
              transition: "all 0.2s",
            }} />
          );
        })
      )}
    </div>
  );
}

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
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const is77 = sheet === "7x7";
  const is66 = sheet === "6x6";
  const is55 = sheet === "5x5";

  const patterns = is77 ? PATTERN_METADATA_7 : is66 ? PATTERN_METADATA_6 : PATTERN_METADATA_5;
  const patternList = Object.values(patterns);

  // For 7x7, handle selection state locally before ready
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

  const kicker = is77 ? "7×7 LEG UNLOCKED" : is66 ? "6×6 LEG UNLOCKED" : "5×5 SERIES";
  const title = "SELECT PATTERNS";
  const desc = is77 
    ? "Choose 5 to 6 winning patterns for this high-tier leg." 
    : is66 
      ? "Five mandatory patterns enforced for the 6×6 protocol." 
      : "Standard active patterns for the 5×5 series.";

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
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(32px,5vw,52px)", color: t.accent, textAlign: "center", fontWeight: 900, marginTop: 8, letterSpacing: "0.04em" }}>
          {title}
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, textAlign: "center", marginTop: 8, maxWidth: 500 }}>
          {desc}
        </div>

        {is77 && (
          <div style={{ marginTop: 12, fontFamily: t.fontMono, fontSize: 12, color: selected77.size >= 5 ? "#22C55E" : t.textMuted }}>
            {selected77.size} / 5–6 SELECTED
          </div>
        )}

        {/* Readiness Bars */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 16px", borderRadius: ip ? 2 : 8, border: `1px solid ${p1Ready ? p1c : t.border}`, color: p1Ready ? p1c : t.textMuted, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, background: p1Ready ? `${p1c}12` : "transparent" }}>
            P1: {p1Ready ? "READY" : "WAITING"}
          </div>
          <div style={{ padding: "8px 16px", borderRadius: ip ? 2 : 8, border: `1px solid ${p2Ready ? p2c : t.border}`, color: p2Ready ? p2c : t.textMuted, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, background: p2Ready ? `${p2c}12` : "transparent" }}>
            P2: {p2Ready ? "READY" : "WAITING"}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 20, gap: 12 }}>
          <button
            type="button"
            disabled={is77 && selected77.size < 5}
            onClick={() => {
              const nowReady = mySlot === "P1" ? p1Ready : p2Ready;
              const becomingReady = !nowReady;
              if (becomingReady && dontShowAgain) {
                const k = is77 ? RULESHOW_SKIP_STORAGE_7x7 : is66 ? RULESHOW_SKIP_STORAGE_6x6 : RULESHOW_SKIP_STORAGE_5x5;
                try { window.localStorage.setItem(k, "1"); } catch {}
              }
              onToggleReadyAction(is77 ? Array.from(selected77) : undefined);
            }}
            style={{
              padding: "14px 48px",
              borderRadius: ip ? 2 : 12,
              border: `2px solid ${t.accent}`,
              background: (is77 && selected77.size < 5) ? "transparent" : `${t.accent}22`,
              color: t.accent,
              fontFamily: t.fontDisplay,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: "0.08em",
              cursor: (is77 && selected77.size < 5) ? "not-allowed" : "pointer",
              opacity: (is77 && selected77.size < 5) ? 0.4 : 1,
              transition: "all 0.2s"
            }}
          >
            {(mySlot === "P1" ? p1Ready : p2Ready) ? "UNREADY" : "START MATCH →"}
          </button>
          
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, userSelect: "none" }}>
            <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} style={{ width: 16, height: 16, accentColor: t.accent }} />
            Don&apos;t show this again
          </label>
        </div>

        {/* Pattern Cards Grid */}
        <div style={{ 
          marginTop: 40, 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", 
          gap: 16, 
          width: "100%",
          paddingBottom: 40
        }}>
          {patternList.map((p) => {
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
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800, color: isSelected ? t.accent : t.text, letterSpacing: "0.04em" }}>
                    {p.label}
                  </div>
                  {is77 && (
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isSelected ? t.accent : t.textMuted}`, background: isSelected ? t.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isSelected && <span style={{ fontSize: 12, color: "#000", fontWeight: 900 }}>✓</span>}
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
      </div>
    </div>
  );
}
