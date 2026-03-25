"use client";
import React, { useState } from "react";

export type RuleshowSheet = "5x5" | "7x7";

export const RULESHOW_SKIP_STORAGE_5x5 = "pentaprotocol_ruleshow_skip_5x5";
export const RULESHOW_SKIP_STORAGE_7x7 = "pentaprotocol_ruleshow_skip_7x7";

export function readRuleshowSkip(sheet: RuleshowSheet): boolean {
  if (typeof window === "undefined") return false;
  const k = sheet === "7x7" ? RULESHOW_SKIP_STORAGE_7x7 : RULESHOW_SKIP_STORAGE_5x5;
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
  onToggleReady: () => void;
};

export default function RuleshowScreen({
  sheet,
  t,
  ip,
  p1c,
  p2c,
  p1Ready,
  p2Ready,
  mySlot,
  onToggleReady,
}: RuleshowScreenProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const is77 = sheet === "7x7";
  const kicker = is77 ? "7×7 LEG UNLOCKED" : "5×5 SERIES";
  const title = "READY CHECK + RULES";
  const rulesTitle = is77 ? "7×7 RULES" : "5×5 RULES";

  const rules77 = (
    <>
      <div>1) Objective: win the 7×7 leg by being first to 2 decisive wins in this leg.</div>
      <div>2) Draws give 0 points to both players and do not break score ties.</div>
      <div>3) Turn order alternates by game; first-player advantage rotates naturally.</div>
      <div>4) First move on the center can give your opponent two extra turns, unless that game began from Rulebreaker with the extra-turn token (center rule off for that game).</div>
      <div>5) Active win patterns for this leg are shown in the sidebar and must be respected.</div>
      <div>6) 7×7 Rulebreaker: toss winner picks an extra-turn token or bans a pattern. Token: loser bans one pattern (hidden from the winner in the UI), center rule is off, loser picks who plays first, winner gets one use of the token. Ban: winner bans one pattern (hidden from the loser in the UI), then loser picks who plays first.</div>
      <div>7) Game 3 is always played when required; match result is decided only after that game ends.</div>
      <div>8) If final points are tied after the deciding game, overall leg result is declared DRAW.</div>
    </>
  );

  const rules55 = (
    <>
      <div>1) Objective: win the 5×5 segment by being first to 2 decisive wins in this segment.</div>
      <div>2) Draws give 0 points to both players and do not break score ties.</div>
      <div>3) Turn order alternates by game; first-player advantage rotates naturally.</div>
      <div>4) Center is special on 5×5: see the in-game hint — center play can grant your opponent extra turns unless Rulebreaker changes it.</div>
      <div>5) Active win patterns for this segment are shown in the sidebar and must be respected.</div>
      <div>6) If Rulebreaker is triggered by the pair rule, toss flow decides constraints/first-player for the next game.</div>
      <div>7) Game 3 on 5×5 is played when needed; at 1–1 after three games, or triple draw, the match opens the 7×7 leg (no second 5×5 toss in that case).</div>
      <div>8) If final points are tied after the deciding game in a segment, that segment can end in DRAW before any upgrade.</div>
    </>
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10003,
        background: "rgba(4,7,14,0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflow: "auto",
      }}
    >
      <div
        style={{
          width: "min(980px, 95vw)",
          maxHeight: "min(900px, 92vh)",
          overflowY: "auto",
          border: `1px solid ${t.accent}44`,
          borderRadius: ip ? 2 : 14,
          background: "rgba(0,0,0,0.6)",
          boxShadow: `0 0 20px ${t.accent}22`,
          padding: 22,
        }}
      >
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 11,
            color: t.textMuted,
            letterSpacing: "0.22em",
            textAlign: "center",
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: t.fontDisplay,
            fontSize: "clamp(24px,5vw,42px)",
            color: t.accent,
            textAlign: "center",
            fontWeight: 900,
            marginTop: 8,
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: ip ? 2 : 8,
              border: `1px solid ${p1Ready ? p1c : t.border}`,
              color: p1Ready ? p1c : t.textMuted,
              fontFamily: t.fontMono,
              fontSize: 12,
            }}
          >
            P1: {p1Ready ? "READY" : "WAITING"}
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: ip ? 2 : 8,
              border: `1px solid ${p2Ready ? p2c : t.border}`,
              color: p2Ready ? p2c : t.textMuted,
              fontFamily: t.fontMono,
              fontSize: 12,
            }}
          >
            P2: {p2Ready ? "READY" : "WAITING"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 14, gap: 12 }}>
          <button
            type="button"
            onClick={() => {
              const nowReady = mySlot === "P1" ? p1Ready : p2Ready;
              const becomingReady = !nowReady;
              if (becomingReady && dontShowAgain) {
                const k = is77 ? RULESHOW_SKIP_STORAGE_7x7 : RULESHOW_SKIP_STORAGE_5x5;
                try {
                  window.localStorage.setItem(k, "1");
                } catch {
                  /* ignore quota / private mode */
                }
              }
              onToggleReady();
            }}
            style={{
              padding: "10px 20px",
              borderRadius: ip ? 2 : 8,
              border: `1px solid ${t.accent}`,
              background: `${t.accent}22`,
              color: t.accent,
              fontFamily: t.fontMono,
              fontWeight: 800,
              letterSpacing: "0.08em",
              cursor: "pointer",
            }}
          >
            {(mySlot === "P1" ? p1Ready : p2Ready) ? "UNREADY" : "I AM READY"}
          </button>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontFamily: t.fontBody,
              fontSize: 13,
              color: t.textSecondary,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: t.accent }}
            />
            Don&apos;t show this again
          </label>
        </div>
        <div style={{ marginTop: 20, borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              color: t.text,
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}
          >
            {rulesTitle}
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
            {is77 ? rules77 : rules55}
          </div>
        </div>
      </div>
    </div>
  );
}
