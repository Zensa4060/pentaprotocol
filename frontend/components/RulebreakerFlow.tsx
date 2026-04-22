"use client";
import React from "react";
import { Piece as GamePieceComp, CoinFace, TossCard } from "./GamePieces";
import type { Phase } from "./GamePieces";
import { WraithKingCoinToss } from "./WraithKingCoinToss";

export const PHASE_TIMERS: Partial<Record<Phase, number>> = {
  rule_choice: 30, who_first_winner: 30, c3_choice: 30, c3_choice_loser: 30, who_first_loser: 30,
  ban_pattern_winner: 30, ban_pattern_loser: 30, grid_block_warning: 30, grid_block_selection: 60, grid_block_waiting: 60,
};

interface RulebreakerFlowProps {
  phase: Phase;
  t: {
    bg: string; accent: string; accentGlow: string; fontDisplay: string; fontMono: string;
    fontBody: string; textMuted: string; textSecondary: string; text: string; border: string;
    bgCard: string; gold: string; danger: string;
  };
  ip: boolean;
  p1c: string;
  p2c: string;
  p1Elo?: number;
  p2Elo?: number;
  p1IsPlacement?: boolean;
  p2IsPlacement?: boolean;
  coinResult: "PENTA" | "PROTO" | null;
  coinAngle: number;
  coinDivRef: React.RefObject<HTMLDivElement | null>;
  tossWinner: "P1" | "P2" | null;
  summaryTimer: number;
  firstPlayerChosen: string | null;
  rbC3Blocked: boolean;
  choiceTimer: number;
  isMultiplayerGame: boolean;
  mySlot: "P1" | "P2";
  winnerPickedRule: string | null;
  winnerPickedFirst: string | null;
  winnerPickedC3: boolean | null;
  /** 6x6 round-3 timer owner (1:00). */
  rb6TimerOwner?: "P1" | "P2" | null;
  /** 6x6 special-cell chooser. */
  rb6CellChooser?: "P1" | "P2" | null;
  onLeftAction: () => void;
  onRightAction: () => void;
  fmtSecAction: (s: number) => string;
  gameMode?: string;
  botPickedSide?: "left" | "right" | null;
  p1Label?: string;
  p2Label?: string;
  /** Wraith King bundle equipped + owned */
  wraithKingToss?: boolean;
  /** Pre-rolled face for authoritative client during toss (null for P2 until reveal) */
  rbCoinPendingResult?: "PENTA" | "PROTO" | null;
  /** 7x7 mode flag for pattern-ban rulebreaker */
  is7x7?: boolean;
  /** 6x6 mode flag for timer/grid-block rulebreaker */
  is6x6?: boolean;
  /** Currently selected pattern names */
  selectedPatterns?: string[];
  /** Patterns banned during rulebreaker */
  rbBannedPatterns?: string[];
  /** Called when a player chooses a grid block for 6x6 rulebreaker */
  onGridBlockChoice?: (r: number, c: number) => void;
  /** Return to rule_choice without resetting the confirm-window timer (6x6 grid_block_warning). */
  onGridBlockWarningBack?: () => void;
  /** Called when a player bans a pattern */
  onBanPattern?: (patternName: string) => void;
  graphicsQuality?: "performance" | "quality";
}

export function RulebreakerFlow({
  phase, t, ip, p1c, p2c,
  p1Elo, p2Elo,
  p1IsPlacement = false,
  p2IsPlacement = false,
  coinResult, coinAngle, coinDivRef, tossWinner,
  summaryTimer, firstPlayerChosen, rbC3Blocked,
  choiceTimer, isMultiplayerGame, mySlot,
  winnerPickedRule, winnerPickedFirst, winnerPickedC3,
  rb6TimerOwner = null, rb6CellChooser = null,
  onLeftAction, onRightAction, fmtSecAction, gameMode, botPickedSide,
  p1Label: p1LabelProp, p2Label: p2LabelProp,
  wraithKingToss = false,
  rbCoinPendingResult = null,
  is7x7 = false,
  is6x6 = false,
  selectedPatterns = [],
  rbBannedPatterns = [],
  onGridBlockChoice,
  onGridBlockWarningBack,
  onBanPattern,
  graphicsQuality = "quality",
}: RulebreakerFlowProps) {

  const p1Name = p1LabelProp ?? "P1";
  const p2Name = p2LabelProp ?? "P2";
  const tossLoser = tossWinner === "P1" ? "P2" : "P1";
  const nameOf = (slot: string) => slot === "P1" ? p1Name : p2Name;

  // ── rb_splash ──────────────────────────────────────────────────────────────
  if (phase === "rb_splash") {
    const isLowGraphics = graphicsQuality === "performance";
    const isBalancedGraphics = false;
    const isSixBySixRb = Boolean(is6x6);
    const isFiveByFive = !is7x7 && !isSixBySixRb;
    const splashTitle = isSixBySixRb ? "TIMEBREAKER" : isFiveByFive ? "RULEBREAKER" : "MINDBREAKER";
    const splashColor = isSixBySixRb ? "#c4b5fd" : isFiveByFive ? "#22d3ee" : "#EF4444";
    const splashMid = isSixBySixRb ? "rgba(139,92,246,0.32)" : isFiveByFive ? "rgba(56,200,235,0.28)" : "rgba(127,29,29,0.4)";
    const splashGlow = isSixBySixRb ? "rgba(196,181,253,0.75)" : isFiveByFive ? "rgba(130,235,255,0.72)" : "rgba(185,28,28,0.88)";
    const splashTitleGlow = isSixBySixRb ? "rgba(167,139,250,0.58)" : isFiveByFive ? "rgba(34,211,238,0.55)" : "rgba(220,38,38,0.62)";
    const splashBg = isSixBySixRb ? "#0a0614" : isFiveByFive ? "#02060c" : "#0a0000";
    const splashVignette = isSixBySixRb
      ? "radial-gradient(ellipse at 50% 38%, rgba(46,16,88,0.9) 0%, rgba(12,6,28,0.55) 48%, transparent 76%)"
      : isFiveByFive
        ? "radial-gradient(ellipse at 50% 38%, rgba(8,55,72,0.88) 0%, rgba(4,18,28,0.5) 48%, transparent 76%)"
        : "radial-gradient(ellipse at 50% 40%, rgba(72,0,0,0.92) 0%, rgba(28,0,0,0.72) 52%, transparent 78%)";
    const cloudTone = isSixBySixRb ? "rgba(167,139,250,0.12)" : isFiveByFive ? "rgba(120,230,255,0.1)" : "rgba(200,40,40,0.18)";
    const mistBlurPx = isLowGraphics ? 0 : isBalancedGraphics ? 8 : 11;

    // Keep TIMEBREAKER visuals unchanged; simplify RULEBREAKER and MINDBREAKER.
    if (!isSixBySixRb) {
      return (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: splashBg,
            userSelect: "none",
            overflow: "hidden",
          }}
        >
          <style>{`
            @keyframes rbSimpleTextIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes rbSimpleTextGlow { 0%, 100% { opacity: 0.78; } 50% { opacity: 1; } }
            @keyframes rbSimpleLineBreath { 0%, 100% { opacity: 0.45; transform: scaleX(0.94); } 50% { opacity: 0.95; transform: scaleX(1); } }
          `}</style>
          <div style={{ position: "absolute", inset: 0, background: splashVignette, opacity: 0.72 }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "0 20px", textAlign: "center" }}>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(36px,7vw,110px)",
                fontWeight: 950,
                color: splashColor,
                letterSpacing: "0.06em",
                textShadow: `0 0 24px ${splashTitleGlow}, 0 8px 18px rgba(0,0,0,0.52)`,
                animation: "rbSimpleTextIn 0.9s cubic-bezier(.22,.68,0,1.2) both, rbSimpleTextGlow 3s ease-in-out 1.1s infinite",
              }}
            >
              {splashTitle}
            </div>
            <div
              style={{
                width: "clamp(240px,52vw,840px)",
                height: 2,
                background: `linear-gradient(90deg, transparent, ${splashColor}, transparent)`,
                boxShadow: `0 0 14px ${splashGlow}`,
                animation: "rbSimpleLineBreath 3.2s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      );
    }

    /** 5×5 — large cyan splashes across the viewport (no micro-drops / drips = fewer layers). */
    const rulebreakerSplatsAll = [
      { l: "50%", t: "46%", s: 980, d: 0 },
      { l: "10%", t: "12%", s: 560, d: 0.14 },
      { l: "90%", t: "18%", s: 520, d: 0.2 },
      { l: "14%", t: "82%", s: 540, d: 0.1 },
      { l: "86%", t: "78%", s: 500, d: 0.24 },
      { l: "50%", t: "8%", s: 480, d: 0.18 },
      { l: "4%", t: "48%", s: 420, d: 0.28 },
      { l: "96%", t: "52%", s: 440, d: 0.32 },
    ];
    const mindSlashesAll = [
      { l: "5%", t: "15%", w: 120, h: 1200, rot: -45, d: 0.05 },
      { l: "25%", t: "85%", w: 100, h: 1100, rot: 35, d: 0.15 },
      { l: "45%", t: "25%", w: 110, h: 1300, rot: -25, d: 0.25 },
      { l: "65%", t: "75%", w: 130, h: 1250, rot: 40, d: 0.35 },
      { l: "85%", t: "20%", w: 105, h: 1150, rot: -30, d: 0.45 },
      { l: "95%", t: "50%", w: 115, h: 1200, rot: 15, d: 0.55 },
      { l: "15%", t: "40%", w: 90, h: 1000, rot: 60, d: 0.12 },
      { l: "75%", t: "60%", w: 95, h: 1050, rot: -65, d: 0.28 },
    ];
    const mainSplats = isFiveByFive
      ? (isLowGraphics ? rulebreakerSplatsAll.slice(0, 3) : isBalancedGraphics ? rulebreakerSplatsAll.slice(0, 4) : rulebreakerSplatsAll.slice(0, 6))
      : [];
    const mindSlashes = isLowGraphics ? mindSlashesAll.slice(0, 4) : isBalancedGraphics ? mindSlashesAll.slice(0, 6) : mindSlashesAll;
    const timebreakerClocks = [
      { l: "10%", t: "18%", s: 130, d: 0.0, r: -18 },
      { l: "26%", t: "10%", s: 96, d: 0.16, r: 12 },
      { l: "42%", t: "22%", s: 150, d: 0.08, r: -8 },
      { l: "61%", t: "12%", s: 105, d: 0.24, r: 15 },
      { l: "82%", t: "20%", s: 138, d: 0.12, r: -14 },
      { l: "88%", t: "50%", s: 118, d: 0.28, r: 10 },
      { l: "74%", t: "76%", s: 144, d: 0.04, r: -9 },
      { l: "48%", t: "84%", s: 118, d: 0.2, r: 7 },
      { l: "20%", t: "78%", s: 154, d: 0.09, r: -16 },
      { l: "8%", t: "54%", s: 112, d: 0.3, r: 13 },
      { l: "34%", t: "54%", s: 92, d: 0.18, r: -6 },
    ];
    const clocksToShow = isLowGraphics ? timebreakerClocks.slice(0, 5) : isBalancedGraphics ? timebreakerClocks.slice(0, 8) : timebreakerClocks;

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: splashBg, userSelect: "none", gap: 0, overflow: "hidden" }}>
        <style>{`
          @keyframes rbLetterInSplash { from{opacity:0;transform:translateY(16px) scaleY(1.04)} to{opacity:1;transform:translateY(0) scaleY(1)} }
          @keyframes rb3DPunchLetter {
            0% { opacity: 0; transform: translateZ(600px) scale(0.4) rotateX(60deg); filter: blur(12px) brightness(3); }
            45% { opacity: 1; transform: translateZ(-40px) scale(1.08) rotateX(-10deg); filter: blur(0px) brightness(1.5); }
            100% { opacity: 1; transform: translateZ(0) scale(1) rotateX(0); filter: drop-shadow(0 0 20px var(--glow)); }
          }
          @keyframes rbLineInSplash { from{opacity:0;transform:scaleX(0)} to{opacity:1;transform:scaleX(1)} }
          @keyframes rbCyanWash { 0%{opacity:0;transform:scale(0.92)} 35%{opacity:0.38} 100%{opacity:0.12;transform:scale(1)} }
          @keyframes rbCyanSplat { 0%{transform:translate(-50%,-50%) scale(0.2); opacity:0} 22%{opacity:0.9} 55%{transform:translate(-50%,-50%) scale(1.02); opacity:0.65} 100%{transform:translate(-50%,-50%) scale(1.18); opacity:0} }
          @keyframes rbBloodDrip {
            0% { transform: translateY(-160%) scaleY(1); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(110vh) scaleY(1.5); opacity: 0.2; }
          }
          @keyframes rbBloodMelt {
            0% { transform: translateY(-90%) scaleY(1); opacity: 0; }
            5% { opacity: 0.9; }
            100% { transform: translateY(0) scaleY(1); opacity: 0.95; }
          }
          @keyframes rbBloodFingerExpand {
            0% { transform: scaleY(0); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: scaleY(1); opacity: 0.98; }
          }
          @keyframes rbBloodSplatFade {
            0% { transform: scale(0.2); opacity: 0; }
            20% { opacity: 0.8; }
            100% { transform: scale(1.1); opacity: 0; }
          }
          @keyframes rbMindPulseVignette {
            0%, 100% { opacity: 0.5; filter: contrast(1); }
            50% { opacity: 0.85; filter: contrast(1.6) brightness(0.8); }
          }
          @keyframes rbMindSlashSweep { 0%{transform:translate(-50%,-50%) scaleY(0.2) scaleX(0.5) rotate(var(--rb-rot)); opacity:0} 22%{opacity:0.95} 58%{transform:translate(-50%,-50%) scaleY(1.08) scaleX(1.02) rotate(var(--rb-rot)); opacity:0.88} 100%{transform:translate(-50%,-50%) scaleY(1.22) scaleX(0.7) rotate(var(--rb-rot)); opacity:0} }
          @keyframes rbMindCoreSweep { 0%{transform:translate(-50%,-50%) scaleY(0.3) rotate(var(--rb-rot)); opacity:0} 18%{opacity:0.92} 100%{transform:translate(-50%,-50%) scaleY(1.1) rotate(var(--rb-rot)); opacity:0} }
          @keyframes rbMist { 0%{opacity:0; transform:translateX(-50%) translateY(16px) scale(0.98)} 22%{opacity:0.62} 100%{opacity:0; transform:translateX(-50%) translateY(-20px) scale(1.03)} }
          @keyframes tbClockIn { 0%{opacity:0; transform:translate(-50%,-50%) scale(0.35) rotate(var(--tb-rot));} 65%{opacity:0.92;} 100%{opacity:0.5; transform:translate(-50%,-50%) scale(1) rotate(var(--tb-rot));} }
          @keyframes tbClockPulse { 0%,100%{filter:drop-shadow(0 0 8px rgba(196,181,253,0.26));} 50%{filter:drop-shadow(0 0 18px rgba(196,181,253,0.5));} }
          @keyframes tbHandFast { from { transform:translateX(-50%) rotate(0deg);} to { transform:translateX(-50%) rotate(360deg);} }
          @keyframes tbHandSlow { from { transform:translateX(-50%) rotate(0deg);} to { transform:translateX(-50%) rotate(360deg);} }
          @keyframes tbVignetteBreath { 0%,100%{opacity:0.15;} 50%{opacity:0.32;} }
        `}</style>
        <div style={{ position: "absolute", inset: 0, background: splashVignette, opacity: 0.72, animation: !isFiveByFive && !isSixBySixRb ? "rbMindPulseVignette 2s ease-in-out infinite" : "none" }} />

        {/* Full-screen splash overlay (2D — avoids perspective + preserve-3d cost) */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", contain: "strict" }}>
          {isFiveByFive && (
            <div
              style={{
                position: "absolute",
                inset: "-8%",
                background: "radial-gradient(ellipse at 50% 42%, rgba(56,210,240,0.35) 0%, rgba(34,160,200,0.12) 38%, transparent 62%)",
                opacity: 0,
                animation: "rbCyanWash 2.2s cubic-bezier(.3,.55,.2,1) both",
              }}
            />
          )}
          {isSixBySixRb && (
            <div
              style={{
                position: "absolute",
                inset: "-8%",
                background: "radial-gradient(ellipse at 50% 42%, rgba(124,58,237,0.28) 0%, rgba(31,10,54,0.2) 34%, rgba(0,0,0,0.5) 72%, transparent 100%)",
                opacity: 0,
                animation: "rbCyanWash 2.2s cubic-bezier(.3,.55,.2,1) both",
              }}
            />
          )}
          {isFiveByFive && Array.from({ length: 22 }).map((_, i) => (
            <div key={`drip-${i}`} style={{
              position: "absolute",
              left: `${(i * 4.6) + Math.random() * 3}%`,
              top: -160,
              width: 8,
              height: 180 + Math.random() * 100,
              willChange: "transform",
              animation: `rbBloodDrip ${0.5 + Math.random() * 0.3}s cubic-bezier(.45, 0, .55, 1) ${i * 0.03}s infinite`,
            }}>
              <div style={{ position: "absolute", top: 0, left: 2, width: 4, height: "100%", background: `linear-gradient(to bottom, transparent, ${splashColor})`, borderRadius: "4px" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, width: 8, height: 12, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%", background: splashColor, boxShadow: `0 0 12px ${splashGlow}` }} />
            </div>
          ))}
          {isSixBySixRb && (
            <>
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, rgba(124,58,237,0.12) 0%, transparent 62%)", animation: "tbVignetteBreath 2.2s ease-in-out infinite" }} />
              {clocksToShow.map((cl, i) => (
                <div
                  key={`tb-clock-${i}`}
                  style={{
                    position: "absolute",
                    left: cl.l,
                    top: cl.t,
                    width: cl.s,
                    height: cl.s,
                    transform: `translate(-50%,-50%) rotate(${cl.r}deg)`,
                    opacity: 0,
                    ["--tb-rot" as string]: `${cl.r}deg`,
                    animation: `tbClockIn 0.9s cubic-bezier(.22,.68,0,1.2) ${cl.d}s both, tbClockPulse 1.9s ease-in-out ${cl.d}s infinite`,
                  } as React.CSSProperties}
                >
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(196,181,253,0.65)", background: "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.08) 0%, rgba(30,20,46,0.88) 60%, rgba(10,6,20,0.95) 100%)", boxShadow: "inset 0 0 24px rgba(0,0,0,0.6), 0 0 16px rgba(124,58,237,0.3)" }} />
                  <div style={{ position: "absolute", inset: "10%", borderRadius: "50%", border: "1px solid rgba(216,180,254,0.35)" }} />
                  <div style={{ position: "absolute", left: "50%", top: "13%", width: 2, height: "36%", background: "rgba(248,245,255,0.86)", borderRadius: 999, transformOrigin: "50% 100%", transform: "translateX(-50%)", animation: `tbHandFast ${0.45 + (i % 3) * 0.14}s linear infinite` }} />
                  <div style={{ position: "absolute", left: "50%", top: "20%", width: 2, height: "30%", background: "rgba(196,181,253,0.85)", borderRadius: 999, transformOrigin: "50% 100%", transform: "translateX(-50%)", animation: `tbHandSlow ${2.4 + (i % 4) * 0.4}s linear infinite` }} />
                  <div style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 8, marginLeft: -4, marginTop: -4, borderRadius: "50%", background: "rgba(216,180,254,0.95)", boxShadow: "0 0 8px rgba(216,180,254,0.6)" }} />
                </div>
              ))}
            </>
          )}

          {/* Mindbreaker cascade (Bleeding Screen Effect) */}
          {!isFiveByFive && !isSixBySixRb && (
            <div style={{ position: "absolute", inset:0, pointerEvents: "none" }}>
              {/* Top Blood Pool */}
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: 180,
                background: "linear-gradient(to bottom, #7F1D1D 0%, #B91C1C 40%, transparent 100%)",
                filter: "blur(4px)", opacity: 0.95,
                willChange: "transform, opacity",
                animation: "rbBloodMelt 6s cubic-bezier(0.12, 0, 0.39, 0) both"
              }} />
              
              {/* Viscous Fingers */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`finger-${i}`} style={{
                  position: "absolute", top: 0, 
                  left: `${(i * 8.5) + Math.random() * 4}%`,
                  width: 14 + Math.random() * 22,
                  height: 480 + Math.random() * 400,
                  transformOrigin: "top",
                  background: `linear-gradient(to bottom, #991B1B 0%, #B91C1C 60%, transparent 100%)`,
                  borderRadius: "0 0 16px 16px",
                  opacity: 0.98,
                  willChange: "transform, opacity",
                  animation: `rbBloodFingerExpand ${6 + Math.random() * 3}s cubic-bezier(0.12, 0, 0.39, 0) ${i * 0.2}s both`
                }}>
                  {/* Internal spec highlight */}
                  <div style={{ position: "absolute", top: "10%", left: 5, width: 3, height: "60%", background: "rgba(255,255,255,0.15)", borderRadius: "2px" }} />
                  {/* Thick bulb at bottom of finger */}
                  <div style={{ position: "absolute", bottom: 0, left: "5%", width: "90%", height: 32, borderRadius: "50%", background: "#B91C1C", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }} />
                </div>
              ))}

              {/* Random Blood Splashes */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`splat-${i}`} style={{
                  position: "absolute",
                  left: `${Math.random() * 80 + 10}%`,
                  top: `${Math.random() * 80 + 10}%`,
                  width: 120 + Math.random() * 200,
                  height: 120 + Math.random() * 150,
                  background: `radial-gradient(circle, #B91C1C 0%, #7F1D1D 40%, transparent 70%)`,
                  borderRadius: "50%",
                  filter: "blur(8px)",
                  opacity: 0,
                  willChange: "transform, opacity",
                  animation: `rbBloodSplatFade 4.5s ease-out ${1 + Math.random() * 2}s both`
                }} />
              ))}

              {/* Aggressive Corner pooling */}
              <div style={{ position:"absolute", top: -20, left: -40, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #450A0A 0%, #B91C1C 60%, transparent 100%)", filter: "blur(10px)", opacity: 0.8, animation: "rbBloodMelt 2s both" }} />
              <div style={{ position:"absolute", top: -20, right: -40, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle at 70% 30%, #450A0A 0%, #B91C1C 60%, transparent 100%)", filter: "blur(10px)", opacity: 0.8, animation: "rbBloodMelt 2s both" }} />
            </div>
          )}

          {!isFiveByFive && !isSixBySixRb && (
            <div style={{
              position: "absolute", left: "50%", top: "56%", width: "min(1300px,100vw)", height: 260,
              transform: "translateX(-50%)",
              background: `radial-gradient(circle at 50% 70%, ${cloudTone} 0%, rgba(0,0,0,0) 72%)`,
              filter: mistBlurPx ? `blur(${mistBlurPx}px)` : "none",
              opacity: 0,
              animation: "rbMist 2.1s cubic-bezier(.3,.6,.2,1) 0.35s both",
            }} />
          )}
        </div>

        <div style={{ display: "flex", gap: ip ? 1 : 5, alignItems: "center", justifyContent: "center", position: "relative", zIndex: 2, maxWidth: "98vw", flexWrap: "wrap" }}>
          {splashTitle.split("").map((ch, i) => (
            <div key={i} style={{ position: "relative", display: "inline-block", perspective: 1000 }}>
              <span style={{
                fontFamily: t.fontDisplay, fontSize: "clamp(32px,6.2vw,108px)", fontWeight: 950,
                color: splashColor,
                textShadow: isLowGraphics
                  ? (isFiveByFive ? "0 0 14px rgba(0,0,0,0.42)" : isSixBySixRb ? "0 0 14px rgba(0,0,0,0.6), 0 0 16px rgba(167,139,250,0.5)" : "0 0 16px rgba(40,0,0,0.65)")
                  : `0 0 22px ${splashTitleGlow}, 0 8px 20px rgba(0,0,0,0.55)`,
                letterSpacing: "0.02em", display: "inline-block",
                ["--glow" as any]: splashGlow,
                willChange: "transform, opacity, filter",
                animation: isFiveByFive 
                  ? `rb3DPunchLetter 0.8s cubic-bezier(.16,1,0.3,1) ${i * 0.08}s both`
                  : isSixBySixRb
                    ? `rbLetterInSplash 0.7s cubic-bezier(.33,.66,.2,1) ${i * 0.05}s both`
                    : `rbShatterIn 0.9s cubic-bezier(.16,1,0.3,1) ${i * 0.04}s both`,
              } as any}>{ch}</span>
            </div>
          ))}
        </div>
        <div style={{
          width: "clamp(320px,62vw,980px)",
          height: 3,
          background: `linear-gradient(90deg, transparent, ${splashColor}, transparent)`,
          marginTop: 24,
          position: "relative",
          zIndex: 2,
          animation: `rbLineInSplash 0.85s cubic-bezier(.28,.65,.25,1) 0.52s both`,
          boxShadow: isLowGraphics
            ? `0 0 14px ${isFiveByFive ? "rgba(34,211,238,0.55)" : isSixBySixRb ? "rgba(167,139,250,0.55)" : splashGlow}`
            : `0 0 20px ${isFiveByFive ? "rgba(34,211,238,0.72)" : isSixBySixRb ? "rgba(196,181,253,0.72)" : splashGlow}`,
        }} />
      </div>
    );
  }

  // ── rb_coin ────────────────────────────────────────────────────────────────
  if (phase === "rb_coin") {
    const isLowGraphics = graphicsQuality === "performance";
    const isBalancedGraphics = false;
    const revealed = coinResult !== null;
    const coinDiam = 240;
    const revType = coinResult ?? "PENTA";
    const winCol = revealed ? (coinResult === "PENTA" ? p1c : p2c) : t.textSecondary;
    const useWraith = wraithKingToss;

    return (
      <div className="phase-screen" style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", background: t.bg, overflowY: "auto", userSelect: "none" }}>
        <style>{`
          @keyframes coinReveal{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
          @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
          @keyframes rbCoinSpin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        `}</style>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(20px,3vw,48px)", fontWeight: 900, color: t.accent, textShadow: `0 0 40px ${t.accentGlow}66`, letterSpacing: "0.08em", marginTop: 36, marginBottom: 10, animation: "fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both" }}>COMMENCING</div>
        <div style={{ width: "clamp(160px,30vw,360px)", height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, marginBottom: 18, boxShadow: `0 0 14px ${t.accentGlow}55`, animation: "rbLineIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.1s both" }} />
        {useWraith ? (
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" as const, justifyContent: "center", fontFamily: t.fontMono, fontSize: ip ? 13 : 17, color: t.textMuted, marginBottom: 16, padding: "0 12px", animation: "fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both", textAlign: "center" as const }}>
            <span><span style={{ color: "#cc88ff", fontWeight: 900, letterSpacing: "0.06em" }}>DOMINION</span> <span style={{ color: t.textMuted }}>(PENTA)</span> = {p1Name}</span>
            <span style={{ color: t.border }}>|</span>
            <span><span style={{ color: "#88aadd", fontWeight: 900, letterSpacing: "0.06em" }}>SERVITUDE</span> <span style={{ color: t.textMuted }}>(PROTO)</span> = {p2Name}</span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 28, fontFamily: t.fontMono, fontSize: 39, color: t.textMuted, marginBottom: 20, animation: "fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><CoinFace type="PENTA" size={26} /><span>PENTA = {p1Name}</span></span>
            <span style={{ color: t.border }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><CoinFace type="PROTO" size={26} /><span>PROTO = {p2Name}</span></span>
          </div>
        )}

        <div style={{ width: "100%", minHeight: "50vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, perspective: 800 }}>
          {useWraith ? (
            <div style={{ position: "relative", width: "100%", maxWidth: 400, display: "flex", justifyContent: "center" }}>
              <div style={{ position: "absolute", width: coinDiam * 2.4, height: coinDiam * 2.4, borderRadius: "50%", left: "50%", top: "42%", transform: "translate(-50%,-50%)", background: revealed ? `radial-gradient(circle, ${winCol}28 0%, transparent 68%)` : `radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition: "background 0.6s ease", pointerEvents: "none" }} />
              <WraithKingCoinToss
                revealed={revealed}
                result={coinResult}
                pendingForSpin={revealed ? null : rbCoinPendingResult}
                coinDiam={coinDiam}
                showOutcomeText={false}
                compact={false}
              />
            </div>
          ) : (
            <>
              <div style={{ position: "absolute", width: coinDiam * 2.4, height: coinDiam * 2.4, borderRadius: "50%", background: revealed ? `radial-gradient(circle, ${winCol}28 0%, transparent 68%)` : `radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition: "background 0.6s ease", pointerEvents: "none" }} />
              {!revealed && (isLowGraphics ? [1.2] : isBalancedGraphics ? [1, 1.6] : [1, 1.5, 2]).map((scale, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: coinDiam * scale,
                    height: coinDiam * scale,
                    borderRadius: "50%",
                    border: `1px solid ${t.accent}${(["18", "10", "08"][i] ?? "08")}`,
                    animation: `spinRing ${2.4 + i * 0.6}s linear infinite`,
                    pointerEvents: "none",
                  }}
                />
              ))}
              {revealed ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, animation: "coinReveal 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
                  <div style={{ borderRadius: "50%", boxShadow: `0 0 90px ${winCol}66, 0 0 40px ${winCol}33, 0 20px 60px rgba(0,0,0,0.7)` }}><CoinFace type={revType} size={coinDiam} /></div>
                  <span style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 800, color: winCol, letterSpacing: "0.14em", textShadow: `0 0 32px ${winCol}99`, animation: "fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.18s both" }}>{revType}</span>
                </div>
              ) : (
                <div style={{ width: coinDiam, height: coinDiam, borderRadius: "50%", perspective: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{
                    width: coinDiam,
                    height: coinDiam,
                    position: "relative",
                    transformStyle: "preserve-3d",
                    animation: `rbCoinSpin ${isLowGraphics ? "0.9s" : isBalancedGraphics ? "0.6s" : "0.42s"} linear infinite`,
                    willChange: "transform",
                    borderRadius: "50%",
                    boxShadow: "0 12px 48px rgba(0,0,0,0.65)",
                  }}>
                    <img
                      src="/penta-coin.png"
                      alt="PENTA"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        objectFit: "cover",
                        background: "#ffffff",
                      }}
                    />
                    <img
                      src="/proto-coin.png"
                      alt="PROTO"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        objectFit: "cover",
                        background: "#0a0a0a",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {revealed && (
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(18px,2.4vw,32px)", fontWeight: 700, color: t.text, textAlign: "center", letterSpacing: "0.06em", marginTop: 8, animation: "fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.3s both" }}>
            <span style={{ color: winCol }}>{nameOf(tossWinner!)}</span><span style={{ color: t.textMuted }}> WINS THE TOSS</span>
          </div>
        )}
      </div>
    );
  }

  // ── grid_block_warning (6×6 own-cell branch) ───────────────────────────────
  if (phase === "grid_block_warning" && onGridBlockChoice) {
    const chooser = rb6CellChooser ?? tossWinner ?? "P1";
    const chooserCol = chooser === "P1" ? p1c : p2c;
    const imChooser = isMultiplayerGame ? mySlot === chooser : true;
    const maxTime = PHASE_TIMERS.grid_block_warning ?? 30;
    const pct = Math.max(0, choiceTimer / maxTime);
    const urgent = choiceTimer <= 10;
    return (
      <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "32px 20px", gap: 20, userSelect: "none" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(18px,2.4vw,30px)", fontWeight: 800, color: chooserCol, textAlign: "center", maxWidth: 760 }}>
          WARNING — {nameOf(chooser)} WILL PLAY WITH 1:00 TIMER
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 600, lineHeight: 1.6 }}>
          You chose <span style={{ color: chooserCol, fontWeight: 700 }}>OWN SPECIAL GRID CELL</span>.
          Your timer is reduced to 1:00 in Round 3. Continue to select your secret cell.
        </div>
        {isMultiplayerGame && !imChooser && (
          <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: t.textSecondary, textAlign: "center" }}>
            Waiting for {nameOf(chooser)} to confirm…
          </div>
        )}
        <div style={{ width: "min(420px,92vw)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.12em" }}>CONFIRM WINDOW</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: urgent ? t.danger : chooserCol }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height: 5, background: t.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 3, transition: "width 1.05s linear", background: urgent ? t.danger : `linear-gradient(90deg, ${chooserCol}, ${t.accent})` }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onLeftAction}
            disabled={!imChooser}
            style={{
              padding: "14px 28px",
              borderRadius: ip ? 2 : 12,
              border: `2px solid ${chooserCol}`,
              background: imChooser ? `${chooserCol}20` : `${t.border}22`,
              color: imChooser ? chooserCol : t.textMuted,
              fontFamily: t.fontDisplay,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "0.08em",
              cursor: imChooser ? "pointer" : "not-allowed",
              opacity: imChooser ? 1 : 0.65,
            }}
          >
            CONTINUE TO CELL SELECT
          </button>
          {imChooser && onGridBlockWarningBack && (
            <button
              type="button"
              onClick={onGridBlockWarningBack}
              style={{
                padding: "10px 22px",
                borderRadius: ip ? 2 : 10,
                border: `1px solid ${t.border}`,
                background: "transparent",
                color: t.textSecondary,
                fontFamily: t.fontMono,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: "pointer",
              }}
            >
              CHANGE RULE CHOICE
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── grid_block_waiting (6×6 — peer is picking secret cell) ────────────────
  if (phase === "grid_block_waiting") {
    return (
      <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "32px 20px", gap: 20, userSelect: "none" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(18px,2.8vw,32px)", fontWeight: 800, color: t.accent, textAlign: "center", maxWidth: 560, lineHeight: 1.35 }}>
          Other player is choosing their option
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 480, lineHeight: 1.6 }}>
          Wait until they finish selecting their special grid cell. You will then choose who plays first (or see the toss summary).
        </div>
      </div>
    );
  }

  // ── grid_block_selection (6×6 Round 3) ─────────────────────────────────────
  if (phase === "grid_block_selection" && onGridBlockChoice) {
    const chooser = rb6CellChooser ?? tossWinner ?? "P1";
    const chooserCol = chooser === "P1" ? p1c : p2c;
    const maxTime = PHASE_TIMERS.grid_block_selection ?? 60;
    const pct = Math.max(0, choiceTimer / maxTime);
    const urgent = choiceTimer <= 10;
    const cols = "ABCDEF".split("");
    return (
      <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "32px 20px", gap: 20, userSelect: "none" }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(15px,2vw,24px)", fontWeight: 800, color: t.accent, textAlign: "center", maxWidth: 720 }}>
          {nameOf(chooser)} — CHOOSE SPECIAL GRID CELL
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, textAlign: "center", maxWidth: 520, lineHeight: 1.5 }}>
          Tap one cell. It stays hidden from opponent; any stone there always counts as {nameOf(chooser)}'s symbol.
        </div>
        <div style={{ width: "min(420px,92vw)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.12em" }}>TIME</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: urgent ? t.danger : chooserCol }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height: 5, background: t.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 3, transition: "width 1.05s linear", background: urgent ? t.danger : `linear-gradient(90deg, ${chooserCol}, ${t.accent})` }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 6, marginLeft: 28 }}>
            {cols.map(l => (
              <div key={l} style={{ width: 44, textAlign: "center", fontFamily: t.fontMono, fontSize: 12, fontWeight: 800, color: chooserCol }}>{l}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: 12, fontWeight: 800, color: chooserCol, width: 20 }}>{n}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 44px)", gridTemplateRows: "repeat(6, 44px)", gap: 6 }}>
              {Array.from({ length: 36 }, (_, i) => {
                const r = Math.floor(i / 6);
                const c = i % 6;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onGridBlockChoice(r, c)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: ip ? 2 : 8,
                      border: `2px solid ${t.border}`,
                      background: `${chooserCol}12`,
                      cursor: "pointer",
                      transition: "transform 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = chooserCol; e.currentTarget.style.transform = "scale(1.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.transform = "scale(1)"; }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── toss choice phases (card-based left/right) ─────────────────────────────
  const tossChoicePhases: Phase[] = ["rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser"];
  if (tossChoicePhases.includes(phase)) {
    const winCol = tossWinner === "P1" ? p1c : p2c;
    const loseCol = tossLoser === "P1" ? p1c : p2c;
    let title = "", leftLabel = "", rightLabel = "", actor = "", actorCol = winCol;
    if (phase === "rule_choice") {
      title = `${nameOf(tossWinner!)} WON THE TOSS — CHOOSE YOUR RULE`;
      if (is7x7) {
        leftLabel = "EXTRA TURN\nTOKEN";
        rightLabel = "BAN A\nPATTERN";
      } else if (is6x6) {
        leftLabel = "OWN SPECIAL\nGRID CELL";
        rightLabel = "CHOOSE WHO\nWILL PLAY FIRST";
      } else {
        leftLabel = "DECIDE WHO\nPLAYS FIRST";
        rightLabel = "BLOCK C3\nFIRST MOVE";
      }
      actor = nameOf(tossWinner!); actorCol = winCol;
    }
    if (phase === "who_first_winner") { title = `${nameOf(tossWinner!)} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel = `${nameOf(tossWinner!)}\nPLAYS FIRST`; rightLabel = `${nameOf(tossLoser)}\nPLAYS FIRST`; actor = nameOf(tossWinner!); actorCol = winCol; }
    if (phase === "c3_choice") { title = `${nameOf(tossWinner!)} — CHOOSE C3 RULE`; leftLabel = "BLOCK C3"; rightLabel = "ALLOW C3"; actor = nameOf(tossWinner!); actorCol = winCol; }
    if (phase === "c3_choice_loser") { title = `${nameOf(tossLoser)} — CHOOSE C3 RULE`; leftLabel = "BLOCK C3"; rightLabel = "ALLOW C3"; actor = nameOf(tossLoser); actorCol = loseCol; }
    if (phase === "who_first_loser") {
      title = is6x6
        ? `${nameOf(tossLoser)} — CHOOSE WHO PLAYS FIRST (ROUND 3)`
        : `${nameOf(tossLoser)} — WHO PLAYS FIRST IN ROUND 3?`;
      leftLabel = `${nameOf(tossLoser)}\nPLAYS FIRST`; rightLabel = `${nameOf(tossWinner!)}\nPLAYS FIRST`; actor = nameOf(tossLoser); actorCol = loseCol;
    }

    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct = Math.max(0, choiceTimer / maxTime);
    const urgent = choiceTimer <= 10;

    const winnerPhases = ["rule_choice", "who_first_winner", "c3_choice"];
    const loserPhases = ["c3_choice_loser", "who_first_loser"];
    const isMyTurn = !isMultiplayerGame ||
      (winnerPhases.includes(phase) && mySlot === tossWinner) ||
      (loserPhases.includes(phase) && mySlot === tossLoser);

    // Bot is choosing: show/hide overlay on cards
    const isBotTurnToChoose = gameMode === "ai" && (
      (winnerPhases.includes(phase) && tossWinner === "P2") ||
      (loserPhases.includes(phase) && tossWinner === "P1")
    );
    const isBotChoosing = isBotTurnToChoose;

    return (
      <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "40px 24px", gap: 24, userSelect: "none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;animation-fill-mode:both;}`}</style>

        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(13px,1.8vw,22px)", fontWeight: 700, color: t.accent, textAlign: "center", maxWidth: 800 }}>{title}</div>

        {isMultiplayerGame && !isMyTurn && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: `${actorCol}10`, border: `1px solid ${actorCol}33`, borderRadius: ip ? 2 : 10, animation: "fadeUp 0.3s ease both" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: actorCol, opacity: 0.7, animation: `botPulse 1.2s ease-in-out ${i * 0.25}s infinite` }} />
              ))}
            </div>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, color: actorCol, letterSpacing: "0.12em" }}>WAITING FOR {actor}...</span>
          </div>
        )}

        {isMultiplayerGame && (phase === "c3_choice_loser" || phase === "who_first_loser") && (
          <div style={{ background: `${winCol}12`, border: `1px solid ${winCol}44`, borderRadius: ip ? 2 : 10, padding: "12px 20px", maxWidth: 480, width: "100%", textAlign: "center", animation: "fadeUp 0.3s ease both" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.12em", marginBottom: 6 }}>{tossWinner} ALREADY CHOSE</div>
            {phase === "c3_choice_loser" && winnerPickedFirst && (
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 700, color: winCol }}>PLAYS FIRST: {nameOf(winnerPickedFirst)}</div>
            )}
            {phase === "who_first_loser" && !is7x7 && winnerPickedC3 !== null && (
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 700, color: winCol }}>C3: {winnerPickedC3 ? "BLOCKED" : "ALLOWED"}</div>
            )}
            {phase === "who_first_loser" && is7x7 && rbBannedPatterns.length > 0 && !(winnerPickedRule === "extra_turn" && mySlot === tossWinner) && !(winnerPickedRule === "ban" && mySlot === tossLoser) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                {rbBannedPatterns.map(p => (
                  <div key={p} style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: "#EF4444" }}>BANNED: {({ "Y": "Y-SHAPE", "L": "L-SHAPE", "W": "W-SHAPE", "V": "V-SHAPE", "C": "C-SHAPE", "zigzag": "ZIGZAG", "T": "T-SHAPE" } as Record<string, string>)[p] || p.toUpperCase()}</div>
                ))}
              </div>
            )}
            {phase === "who_first_loser" && is7x7 && winnerPickedRule === "extra_turn" && mySlot === tossWinner && (
              <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: winCol }}>EXTRA TURN TOKEN (opponent banned a pattern — hidden from you for the full 7×7 game and on the match results screen; Career shows which pattern)</div>
            )}
            {phase === "who_first_loser" && is7x7 && winnerPickedRule === "ban" && mySlot === tossLoser && (
              <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: loseCol }}>EXTRA TURN TOKEN — you also choose who plays first. Opponent banned a pattern hidden from you for the full 7×7 game and on the results screen (Career shows which pattern).</div>
            )}
          </div>
        )}

        {/* Bot thinking banner */}
        {isBotTurnToChoose && !botPickedSide && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: `${actorCol}10`, border: `1px solid ${actorCol}33`, borderRadius: ip ? 2 : 10, animation: "fadeUp 0.3s ease both" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: actorCol, opacity: 0.7, animation: `botPulse 1.2s ease-in-out ${i * 0.25}s infinite` }} />
              ))}
            </div>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, color: actorCol, letterSpacing: "0.12em" }}>BOT IS CHOOSING...</span>
          </div>
        )}

        <div style={{ width: "min(480px,88vw)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.12em" }}>{actor} IS CHOOSING</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: urgent ? t.danger : actorCol, transition: "color 0.3s ease", animation: urgent ? "urgentPulse 0.6s ease infinite" : "none" }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height: 5, background: t.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 3, transition: "width 1.05s linear, background 0.35s ease", background: urgent ? t.danger : `linear-gradient(90deg, ${actorCol}, ${t.accent})`, boxShadow: urgent ? `0 0 14px ${t.danger}88` : `0 0 10px ${actorCol}66` }} />
          </div>
        </div>

        {/* Cards — always render normally; blur overlay only on unchosen card when bot reveals */}
        <div style={{ display: "flex", gap: 32, width: "100%", maxWidth: 1000, pointerEvents: (isMyTurn && !isBotTurnToChoose) ? "auto" : "none" }}>
          <div style={{ flex: 1, position: "relative", display: "flex" }}>
            <TossCard label={leftLabel} onClick={onLeftAction} delay={0.12} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip} />
            {isBotTurnToChoose && botPickedSide !== null && botPickedSide !== "left" && (
              <div style={{ position: "absolute", inset: 0, borderRadius: ip ? 2 : 16, backdropFilter: "blur(5px)", background: "rgba(0,0,0,0.5)", zIndex: 2 }} />
            )}
          </div>
          <div style={{ flex: 1, position: "relative", display: "flex" }}>
            <TossCard label={rightLabel} onClick={onRightAction} delay={0.20} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip} />
            {isBotTurnToChoose && botPickedSide !== null && botPickedSide !== "right" && (
              <div style={{ position: "absolute", inset: 0, borderRadius: ip ? 2 : 16, backdropFilter: "blur(5px)", background: "rgba(0,0,0,0.5)", zIndex: 2 }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── ban_pattern_winner / ban_pattern_loser ──────────────────────────────────
  if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
    const isWinnerBanning = phase === "ban_pattern_winner";
    const banActor = isWinnerBanning ? tossWinner! : tossLoser;
    const actorCol = banActor === "P1" ? p1c : p2c;
    const banLimit = is7x7 ? 2 : 1;
    const title = `${nameOf(banActor)} — BAN ${banLimit === 2 ? "TWO" : "ONE"} PATTERN${banLimit === 2 ? "S" : ""}`;

    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct = Math.max(0, choiceTimer / maxTime);
    const urgent = choiceTimer <= 10;

    const winnerPhases = ["ban_pattern_winner"];
    const loserPhases = ["ban_pattern_loser"];
    const isMyTurn = !isMultiplayerGame ||
      (winnerPhases.includes(phase) && mySlot === tossWinner) ||
      (loserPhases.includes(phase) && mySlot === tossLoser);

    const isBotTurnToChoose = gameMode === "ai" && (
      (isWinnerBanning && tossWinner === "P2") ||
      (!isWinnerBanning && tossWinner === "P1")
    );

    if (isMultiplayerGame && !isMyTurn) {
      return (
        <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "32px 20px", gap: 20, userSelect: "none" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(18px,2.8vw,32px)", fontWeight: 800, color: t.accent, textAlign: "center", maxWidth: 560, lineHeight: 1.35 }}>
            Other player is banning patterns
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 480, lineHeight: 1.6 }}>
            Wait until they finish selecting which win conditions to remove for Round 3.
          </div>
        </div>
      );
    }

    const PATTERN_LABELS: Record<string, string> = {

      Y: "Y-SHAPE", L: "L-SHAPE", W: "W-SHAPE", V: "V-SHAPE", C: "C-SHAPE", zigzag: "ZIGZAG",
    };

    return (
      <div className="phase-screen" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "40px 24px", gap: 20, userSelect: "none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;}`}</style>

        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(13px,1.8vw,22px)", fontWeight: 700, color: t.accent, textAlign: "center", maxWidth: 800 }}>{title}</div>

        <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, textAlign: "center", maxWidth: 500 }}>
          Choose {is7x7 ? "two patterns" : "one pattern"} to <span style={{ color: "#EF4444", fontWeight: 700 }}>remove</span> from Round 3.
          The remaining patterns will be the win conditions. ({rbBannedPatterns.length}/{is7x7 ? 2 : 1})
          {!isWinnerBanning && winnerPickedRule === "extra_turn" ? (
            <span style={{ display: "block", marginTop: 10, color: t.textSecondary }}>
              Your ban stays hidden from the toss winner for the entire 7×7 game and on the match results screen; Career shows which pattern was banned.
            </span>
          ) : isWinnerBanning && is7x7 && winnerPickedRule === "ban" ? (
            <span style={{ display: "block", marginTop: 10, color: t.textSecondary }}>
              Your ban stays hidden from your opponent in the match UI for the entire 7×7 game and on the results screen; Career shows which pattern was banned.
            </span>
          ) : null}
        </div>

        {isBotTurnToChoose && !botPickedSide && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: `${actorCol}10`, border: `1px solid ${actorCol}33`, borderRadius: ip ? 2 : 10, animation: "fadeUp 0.3s ease both" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: actorCol, opacity: 0.7, animation: `botPulse 1.2s ease-in-out ${i * 0.25}s infinite` }} />
              ))}
            </div>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, color: actorCol, letterSpacing: "0.12em" }}>BOT IS CHOOSING...</span>
          </div>
        )}

        <div style={{ width: "min(480px,88vw)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.12em" }}>{nameOf(banActor)} IS CHOOSING</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: urgent ? t.danger : actorCol, transition: "color 0.3s ease", animation: urgent ? "urgentPulse 0.6s ease infinite" : "none" }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height: 5, background: t.border, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 3, transition: "width 1.05s linear, background 0.35s ease", background: urgent ? t.danger : `linear-gradient(90deg, ${actorCol}, ${t.accent})`, boxShadow: urgent ? `0 0 14px ${t.danger}88` : `0 0 10px ${actorCol}66` }} />
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, width: "100%", maxWidth: 660,
          pointerEvents: (isMyTurn && !isBotTurnToChoose) ? "auto" : "none",
        }}>
          {selectedPatterns.map((name, i) => {
            const label = PATTERN_LABELS[name] || name.toUpperCase();
            const isBanned = rbBannedPatterns.includes(name);
            return (
              <button
                key={name}
                onClick={() => onBanPattern?.(name)}
                className="toss-card-enter"
                disabled={isBanned}
                style={{
                  animationDelay: `${i * 0.06}s`,
                  background: isBanned ? "rgba(239,68,68,0.2)" : `linear-gradient(145deg, rgba(239,68,68,0.08), ${t.bgCard})`,
                  border: `2px solid ${isBanned ? "#EF4444" : t.border}`,
                  borderRadius: ip ? 2 : 14,
                  padding: "20px 16px",
                  cursor: isBanned ? "default" : "pointer",
                  textAlign: "center",
                  transition: "all 0.25s cubic-bezier(.22,.68,0,1.2)",
                  minHeight: 80,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                  opacity: isBanned ? 0.7 : 1,
                  filter: isBanned ? "grayscale(0.5)" : "none",
                }}
                onMouseEnter={e => {
                  if (isBanned) return;
                  (e.currentTarget as HTMLButtonElement).style.border = "2px solid #EF4444";
                  (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(145deg, rgba(239,68,68,0.18), rgba(0,0,0,0.4))";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.03)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(239,68,68,0.2)";
                }}
                onMouseLeave={e => {
                  if (isBanned) return;
                  (e.currentTarget as HTMLButtonElement).style.border = `2px solid ${t.border}`;
                  (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(145deg, rgba(239,68,68,0.08), ${t.bgCard})`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#EF4444", letterSpacing: "0.1em", fontWeight: 600 }}>{isBanned ? "SELECTED" : "BAN"}</div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── toss_summary ───────────────────────────────────────────────────────────
  if (phase === "toss_summary") {
    const fp = firstPlayerChosen ?? tossWinner ?? "P1";
    const winnerPickedFirstTurn = winnerPickedRule === "first";

    const PATTERN_LABELS_SUMMARY: Record<string, string> = {
      Y: "Y-SHAPE", L: "L-SHAPE", W: "W-SHAPE", V: "V-SHAPE", C: "C-SHAPE", zigzag: "ZIGZAG",
    };

    const tossLoserSumm: "P1" | "P2" | null =
      tossWinner === "P1" ? "P2" : tossWinner === "P2" ? "P1" : null;
    const banActorColumn: "P1" | "P2" | null =
      is7x7 && tossWinner
        ? winnerPickedRule === "extra_turn"
          ? tossLoserSumm
          : winnerPickedRule === "ban"
            ? tossWinner
            : winnerPickedFirstTurn
              ? tossLoserSumm
              : tossWinner
        : null;
    const hideBannedNameForViewer = (col: "P1" | "P2") =>
      Boolean(
        rbBannedPatterns.length > 0 &&
        banActorColumn === col &&
        ((isMultiplayerGame && col !== mySlot) || (gameMode === "ai" && col === "P2")),
      );

    let winnerChoice: string;
    let loserChoice: string;
    if (is7x7) {
      const bannedLabels = rbBannedPatterns.map(p => PATTERN_LABELS_SUMMARY[p] || p.toUpperCase()).join(", ");
      const bannedText = bannedLabels || "NONE";
      if (winnerPickedRule === "extra_turn") {
        winnerChoice = "EXTRA TURN TOKEN\n(1× · center rule off)";
        loserChoice = `BANNED:\n${bannedText}\nPLAYS FIRST:\n${fp}`;
      } else if (winnerPickedFirstTurn) {
        winnerChoice = `PLAYS FIRST:\n${fp}`;
        loserChoice = `BANNED:\n${bannedText}`;
      } else {
        winnerChoice = `BANNED:\n${bannedText}`;
        loserChoice = `PLAYS FIRST:\n${fp}`;
      }
    } else if (is6x6) {
      const timerOwner = rb6TimerOwner ? nameOf(rb6TimerOwner) : "—";
      const cellOwner = rb6CellChooser ? nameOf(rb6CellChooser) : "—";
      winnerChoice = `TIMER 1:00:\n${timerOwner}\nSPECIAL CELL:\n${cellOwner}`;
      loserChoice = `PLAYS FIRST:\n${nameOf(fp)}\nSPECIAL CELL:\n${cellOwner}`;
    } else {
      winnerChoice = winnerPickedFirstTurn
        ? `PLAYS FIRST:\n${fp}`
        : `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`;
      loserChoice = winnerPickedFirstTurn
        ? `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`
        : `PLAYS FIRST:\n${fp}`;
    }

    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, padding: "40px 24px", gap: 32, userSelect: "none", animation: "fadeUp 0.35s ease both" }}>
        {/* Background Atmosphere */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%, ${t.accent}08 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ textAlign: "center", position: "relative" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(32px,5vw,64px)", fontWeight: 950, color: t.accent, textShadow: `0 0 40px ${t.accentGlow}66`, letterSpacing: "0.05em" }}>ROUND 3 RULES</div>
          <div style={{ fontFamily: t.fontMono, fontSize: 18, color: t.textMuted, letterSpacing: "0.2em", marginTop: 8 }}>PREPARING FOR COMMENCEMENT...</div>
        </div>

        <div style={{ display: "flex", gap: 32, width: "100%", maxWidth: 1100, position: "relative" }}>
          {(["P1", "P2"] as const).map(p => {
            const col = p === "P1" ? p1c : p2c;
            const isWinner = p === tossWinner;
            const choice = isWinner ? winnerChoice : loserChoice;
            const isMe = isMultiplayerGame && p === mySlot;
            const firstSlotFromFp = fp === "P1" || fp === "P2" ? fp : "P1";

            const isWhoFirst = choice.includes("PLAYS FIRST");
            const isBanned = choice.includes("BANNED");
            const bannedLabelOnly = is7x7 && rbBannedPatterns.length > 0 ? rbBannedPatterns.map(p => PATTERN_LABELS_SUMMARY[p] || p.toUpperCase()).join(", ") : "";
            const secretBan = hideBannedNameForViewer(p);
            const displayBannedLabel = secretBan ? "?" : bannedLabelOnly;

            return (
              <div key={p} style={{
                flex: 1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(40px)",
                border: `3px solid ${col}${isMe ? "" : "44"}`, borderRadius: ip ? 2 : 24,
                padding: "40px 32px", textAlign: "center", opacity: isMe ? 1 : 0.75,
                boxShadow: isMe ? `0 30px 100px rgba(0,0,0,0.8), 0 0 50px ${col}33` : "none",
                transform: isMe ? "scale(1.05)" : "scale(1)", transition: "all 0.4s cubic-bezier(.22,.68,0,1.2)"
              }}>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 64, fontWeight: 950, color: col, marginBottom: 8, textShadow: `0 0 30px ${col}66` }}>{nameOf(p)}</div>

                {/* Big rule-name banner replaces the rank logo showcase.
                    Fills the vertical space with a punchy one-line label so
                    the card visually advertises *what* each side chose. */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "16px 0 22px",
                    padding: "14px 20px",
                    borderRadius: 16,
                    border: `2px solid ${col}55`,
                    background: `linear-gradient(135deg, ${col}12, rgba(0,0,0,0.55))`,
                    boxShadow: `0 0 30px ${col}22, inset 0 0 18px rgba(0,0,0,0.55)`,
                    minHeight: 96,
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: "clamp(28px, 3.2vw, 46px)",
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                      color: col,
                      textAlign: "center" as const,
                      textTransform: "uppercase" as const,
                      textShadow: `0 0 22px ${col}99, 0 0 4px rgba(0,0,0,0.7)`,
                      lineHeight: 1.1,
                    }}
                  >
                    {(() => {
                      if (is7x7) {
                        if (winnerPickedRule === "extra_turn") {
                          return isWinner ? "EXTRA TURN TOKEN" : "PLAYS FIRST";
                        }
                        if (winnerPickedRule === "ban") {
                          return isWinner ? "PATTERNS BANNED" : "PLAYS FIRST";
                        }
                      }
                      if (is6x6) {
                        return isWinner ? "TIMER & SPECIAL CELL" : "PLAYS FIRST";
                      }
                      if (isWhoFirst) return "PLAYS FIRST";
                      if (isBanned) return "CENTER BLOCKED";
                      return "RULE SELECTED";
                    })()}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.2em", textTransform: "uppercase" }}>{isWinner ? "Toss Winner" : "Toss Loser"}</div>
                  {isMe && <div style={{ fontFamily: t.fontMono, fontSize: 12, color: col, letterSpacing: "0.2em", fontWeight: 800 }}>[YOU]</div>}
                </div>

                <div style={{
                  background: "rgba(0,0,0,0.4)", border: `1px solid ${col}22`, borderRadius: 16,
                  padding: "24px", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)", gap: 12
                }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    {is7x7 && winnerPickedRule === "extra_turn" && isWinner ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>Extra turn token</div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: col, letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.35 }}>
                          One bonus consecutive move later · center opening off
                        </div>
                      </>
                    ) : is7x7 && winnerPickedRule === "ban" && isWinner ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>Patterns banned</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {rbBannedPatterns.map(p => (
                            <div key={p} style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: "#EF4444", letterSpacing: "0.05em", textDecoration: secretBan ? "none" : "line-through", textDecorationColor: "rgba(239,68,68,0.6)" }}>
                              {secretBan ? "?" : (PATTERN_LABELS_SUMMARY[p] || p.toUpperCase())}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase", marginTop: 8 }}>Hidden from opponent in the match UI — Career shows it after the match</div>
                      </>
                    ) : is7x7 && winnerPickedRule === "ban" && !isWinner ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>Opponent banned</div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 800, color: col, letterSpacing: "0.04em", textAlign: "center", lineHeight: 1.4 }}>
                          {rbBannedPatterns.length} patterns removed — they stay hidden for the full game and on the results screen; Career shows them afterward
                        </div>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase", marginTop: 8 }}>Plays first</div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 900, color: firstSlotFromFp === "P1" ? p1c : p2c, letterSpacing: "0.05em" }}>{nameOf(firstSlotFromFp)}</div>
                      </>
                    ) : is7x7 && winnerPickedRule === "extra_turn" && !isWinner ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>Patterns banned</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {rbBannedPatterns.map(p => (
                            <div key={p} style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: "#EF4444", letterSpacing: "0.05em", textDecoration: secretBan ? "none" : "line-through", textDecorationColor: "rgba(239,68,68,0.6)" }}>
                              {secretBan ? "?" : (PATTERN_LABELS_SUMMARY[p] || p.toUpperCase())}
                            </div>
                          ))}
                        </div>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase", marginTop: 8 }}>Plays first</div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 32, fontWeight: 900, color: firstSlotFromFp === "P1" ? p1c : p2c, letterSpacing: "0.05em" }}>{nameOf(firstSlotFromFp)}</div>
                      </>
                    ) : isWhoFirst ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>
                          Plays First
                        </div>
                        <div style={{
                          fontFamily: t.fontDisplay,
                          fontSize: 32,
                          fontWeight: 900,
                          color: firstSlotFromFp === "P1" ? p1c : p2c,
                          letterSpacing: "0.05em"
                        }}>
                          {nameOf(firstSlotFromFp)}
                        </div>
                      </>
                    ) : isBanned ? (
                      <>
                        <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, textTransform: "uppercase" }}>
                          Pattern Banned
                        </div>
                        <div style={{
                          fontFamily: t.fontDisplay,
                          fontSize: 28,
                          fontWeight: 900,
                          color: "#EF4444",
                          letterSpacing: "0.05em",
                          textDecoration: secretBan ? "none" : "line-through",
                          textDecorationColor: "rgba(239,68,68,0.6)",
                        }}>
                          {secretBan ? "?" : choice.replace("BANNED:\n", "")}
                        </div>
                      </>
                    ) : (
                      <div style={{
                        fontFamily: t.fontMono,
                        fontSize: 22,
                        fontWeight: 700,
                        color: t.text,
                        whiteSpace: "pre-line",
                        lineHeight: 1.6,
                        letterSpacing: "0.05em"
                      }}>
                        {choice}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 900, color: t.accent, background: "rgba(0,0,0,0.5)", padding: "12px 40px", borderRadius: 40, border: `1px solid ${t.accent}44` }}>
          BATTLE STARTS IN {Math.max(1, Math.ceil(summaryTimer))}S
        </div>
      </div>
    );
  }

  // ── rb_initializing ────────────────────────────────────────────────────────
  if (phase === "rb_initializing") {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: t.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.15, pointerEvents: "none" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at center, ${t.accent} 0%, transparent 70%)`, filter: "blur(80px)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, animation: "fadeUp 0.6s ease both" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: t.accent, animation: `rbRingPulse 1s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(24px,4vw,48px)", fontWeight: 900, color: t.accent, letterSpacing: "0.15em", textShadow: `0 0 40px ${t.accentGlow}66` }}>
            RECONFIGURING BOARD...
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, letterSpacing: "0.3em" }}>
            PREPARING SPECIAL RULES FOR ROUND 3
          </div>
        </div>

        <div style={{ width: "clamp(240px, 40vw, 500px)", height: 6, background: t.border, borderRadius: 3, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: t.accent, animation: "loadingSweep 2s infinite linear" }} />
          <style>{`
            @keyframes loadingSweep {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return null;
}
