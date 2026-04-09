"use client";
import React from "react";

type Props = {
  fromLevel: number;
  toLevel: number;
  onDone: () => void;
  t: {
    fontDisplay: string;
    fontMono: string;
    accent: string;
    gold: string;
    text: string;
    textMuted: string;
  };
};

export default function XpLevelUpScreen({ fromLevel, toLevel, onDone, t }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120000, background: "radial-gradient(circle at center, #09101a 0%, #020306 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(760px, 92vw)", borderRadius: 22, border: `1px solid ${t.accent}88`, background: "rgba(10,12,24,0.92)", padding: "32px 26px", textAlign: "center", boxShadow: `0 0 60px ${t.accent}44` }}>
        <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.18em" }}>ACCOUNT PROGRESSION</div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(30px, 6vw, 56px)", fontWeight: 900, color: t.gold, letterSpacing: "0.1em", margin: "10px 0 22px" }}>LEVEL UP</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, fontFamily: t.fontDisplay, fontWeight: 900, color: t.accent }}>
          <span style={{ fontSize: 56 }}>{fromLevel}</span>
          <span style={{ fontSize: 32 }}>→</span>
          <span style={{ fontSize: 72, textShadow: `0 0 30px ${t.accent}88` }}>{toLevel}</span>
        </div>
        <button
          type="button"
          onClick={onDone}
          style={{ marginTop: 26, padding: "14px 28px", borderRadius: 12, border: `1px solid ${t.gold}99`, background: `${t.gold}22`, color: t.gold, fontFamily: t.fontDisplay, fontWeight: 900, letterSpacing: "0.14em", cursor: "pointer" }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}
