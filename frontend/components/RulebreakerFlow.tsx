"use client";
import React from "react";
import { CoinFace, TossCard, Piece as GamePieceComp } from "./GamePieces";
import type { Phase } from "./GamePieces";
import { RANKS, RankIcon } from "./ProfileScreen";
import { WraithKingCoinToss } from "./WraithKingCoinToss";

export const PHASE_TIMERS: Partial<Record<Phase, number>> = {
  rule_choice: 30, who_first_winner: 30, c3_choice: 30, c3_choice_loser: 30, who_first_loser: 30,
  ban_pattern_winner: 30, ban_pattern_loser: 30,
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
  /** Currently selected pattern names */
  selectedPatterns?: string[];
  /** Pattern banned during rulebreaker */
  rbBannedPattern?: string | null;
  /** Called when a player bans a pattern */
  onBanPattern?: (patternName: string) => void;
}

export function RulebreakerFlow({
  phase, t, ip, p1c, p2c,
  p1Elo, p2Elo,
  coinResult, coinAngle, coinDivRef, tossWinner,
  summaryTimer, firstPlayerChosen, rbC3Blocked,
  choiceTimer, isMultiplayerGame, mySlot,
  winnerPickedRule, winnerPickedFirst, winnerPickedC3,
  onLeftAction, onRightAction, fmtSecAction,   gameMode, botPickedSide,
  p1Label: p1LabelProp, p2Label: p2LabelProp,
  wraithKingToss = false,
  rbCoinPendingResult = null,
  is7x7 = false,
  selectedPatterns = [],
  rbBannedPattern = null,
  onBanPattern,
}: RulebreakerFlowProps) {

  const p1Name = p1LabelProp ?? "P1";
  const p2Name = p2LabelProp ?? "P2";
  const tossLoser = tossWinner === "P1" ? "P2" : "P1";
  const nameOf = (slot: string) => slot === "P1" ? p1Name : p2Name;

  // ── rb_splash ──────────────────────────────────────────────────────────────
  if (phase === "rb_splash") {
    const isFiveByFive = !is7x7;
    const splashTitle = isFiveByFive ? "RULEBREAKER" : "MINDBREAKER";
    const splashColor = isFiveByFive ? "#06B6D4" : "#B91C1C";
    const splashMid = isFiveByFive ? "rgba(8,145,178,0.30)" : "rgba(185,28,28,0.30)";
    const splashGlow = isFiveByFive ? "rgba(34,211,238,0.78)" : "rgba(220,38,38,0.78)";
    const splashBg = isFiveByFive ? "#02090d" : "#050000";
    const splashVignette = isFiveByFive
      ? "radial-gradient(circle at center, rgba(10,70,90,0.9) 0%, transparent 72%)"
      : "radial-gradient(circle at center, rgba(40,0,0,0.85) 0%, transparent 72%)";
    const cloudTone = isFiveByFive ? "rgba(34,211,238,0.17)" : "rgba(255,60,60,0.12)";
    const sceneTilt = "rotateX(11deg) rotateY(-8deg)";
    const titleTilt = "translateZ(94px) rotateX(14deg) rotateY(-7deg)";

    const mainSplats = [
      { l: "12%", t: "14%", s: 540, d: 0.03 },
      { l: "28%", t: "78%", s: 500, d: 0.08 },
      { l: "52%", t: "34%", s: 620, d: 0.12 },
      { l: "72%", t: "66%", s: 560, d: 0.16 },
      { l: "90%", t: "20%", s: 480, d: 0.2 },
      { l: "84%", t: "86%", s: 460, d: 0.25 },
    ];
    const microDrops = [
      { l: "8%", t: "42%", r: 28, a: 0.72, d: 0.09 },
      { l: "20%", t: "24%", r: 22, a: 0.64, d: 0.11 },
      { l: "34%", t: "58%", r: 18, a: 0.56, d: 0.15 },
      { l: "44%", t: "18%", r: 20, a: 0.6, d: 0.19 },
      { l: "58%", t: "76%", r: 24, a: 0.68, d: 0.21 },
      { l: "68%", t: "32%", r: 16, a: 0.52, d: 0.24 },
      { l: "78%", t: "48%", r: 20, a: 0.58, d: 0.27 },
      { l: "88%", t: "62%", r: 18, a: 0.53, d: 0.3 },
      { l: "93%", t: "36%", r: 16, a: 0.48, d: 0.34 },
      { l: "64%", t: "10%", r: 14, a: 0.44, d: 0.38 },
      { l: "40%", t: "88%", r: 22, a: 0.62, d: 0.42 },
    ];
    const mindSlashes = [
      { l: "8%", t: "18%", w: 56, h: 560, rot: -35, d: 0.06 },
      { l: "24%", t: "72%", w: 44, h: 480, rot: 28, d: 0.12 },
      { l: "38%", t: "30%", w: 52, h: 620, rot: -22, d: 0.16 },
      { l: "54%", t: "82%", w: 60, h: 540, rot: 31, d: 0.21 },
      { l: "70%", t: "26%", w: 48, h: 600, rot: -27, d: 0.25 },
      { l: "84%", t: "74%", w: 42, h: 520, rot: 24, d: 0.31 },
      { l: "94%", t: "16%", w: 38, h: 430, rot: -33, d: 0.36 },
    ];

    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:10000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:splashBg, userSelect:"none", gap:0, overflow:"hidden", perspective:"1100px" }}>
        <style>{`
          @keyframes rbBloodPop { 0%{transform:translate(-50%,-50%) translateZ(var(--rb-z,-20px)) scale(0.16) rotate(-12deg); opacity:0} 18%{opacity:0.98} 56%{transform:translate(-50%,-50%) translateZ(var(--rb-z,0px)) scale(1.05) rotate(2deg); opacity:0.74} 100%{transform:translate(-50%,-50%) translateZ(var(--rb-z,20px)) scale(1.32) rotate(6deg); opacity:0} }
          @keyframes rbMicroPop { 0%{transform:translate(-50%,-50%) scale(0.2); opacity:0} 24%{opacity:0.9} 100%{transform:translate(-50%,-50%) scale(1.18); opacity:0} }
          @keyframes rbDropFall { 0%{transform:translate(-50%,-50%) translateY(-42px) scaleY(0.5); opacity:0} 16%{opacity:0.95} 56%{transform:translate(-50%,-50%) translateY(26px) scaleY(1.08); opacity:0.88} 100%{transform:translate(-50%,-50%) translateY(190px) scaleY(1.25); opacity:0} }
          @keyframes rbTailFall { 0%{transform:translateX(-50%) scaleY(0.2); opacity:0} 18%{opacity:0.82} 100%{transform:translateX(-50%) scaleY(1); opacity:0} }
          @keyframes rbMindSlashSweep { 0%{transform:translate(-50%,-50%) scaleY(0.2) scaleX(0.5) rotate(var(--rb-rot)); opacity:0} 22%{opacity:0.95} 58%{transform:translate(-50%,-50%) scaleY(1.08) scaleX(1.02) rotate(var(--rb-rot)); opacity:0.88} 100%{transform:translate(-50%,-50%) scaleY(1.22) scaleX(0.7) rotate(var(--rb-rot)); opacity:0} }
          @keyframes rbMindCoreSweep { 0%{transform:translate(-50%,-50%) scaleY(0.3) rotate(var(--rb-rot)); opacity:0} 18%{opacity:0.92} 100%{transform:translate(-50%,-50%) scaleY(1.1) rotate(var(--rb-rot)); opacity:0} }
          @keyframes rbMist { 0%{opacity:0; transform:translateY(20px) scale(0.98)} 20%{opacity:0.74} 100%{opacity:0; transform:translateY(-26px) scale(1.04)} }
        `}</style>
        <div style={{ position:"absolute", inset:0, background:splashVignette, opacity:0.72, transform:"translateZ(-160px)" }} />

        {/* Full-screen splash overlay */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", transformStyle:"preserve-3d", transform:sceneTilt }}>
          {mainSplats.map((b, i) => (
            <div key={i} style={{
              position:"absolute", left:b.l, top:b.t, width:b.s, height:b.s,
              ["--rb-z" as string]: isFiveByFive ? `${18 + (i % 3) * 8}px` : `${32 + (i % 3) * 12}px`,
              borderRadius:"54% 46% 58% 42% / 52% 48% 54% 46%",
              background:`radial-gradient(circle, ${splashGlow} 0%, ${splashMid} 36%, rgba(0,0,0,0) 72%)`,
              filter:isFiveByFive ? "blur(1.1px)" : "blur(0.7px)",
              transform:`translate(-50%,-50%) translateZ(${isFiveByFive ? `${14 + i * 2}px` : `${28 + i * 4}px`}) scale(0.16)`,
              opacity:0,
              animation:`rbBloodPop ${isFiveByFive ? "1.85s" : "1.55s"} cubic-bezier(.18,.9,.12,1) ${b.d}s both`,
            }} />
          ))}

          {microDrops.map((s, i) => (
            <div key={`s${i}`} style={{
              position:"absolute", left:s.l, top:s.t, width:s.r, height:s.r,
              borderRadius:"50%",
              background:`${isFiveByFive ? `rgba(34, 211, 238, ${s.a})` : `rgba(185, 28, 28, ${s.a})`}`,
              boxShadow:`0 0 ${isFiveByFive ? "20px" : "26px"} ${isFiveByFive ? "rgba(34,211,238,0.34)" : "rgba(220,38,38,0.36)"}`,
              filter:"blur(0.25px)",
              opacity:0,
              transform:`translate(-50%,-50%) translateZ(${isFiveByFive ? "26px" : "52px"}) scale(0.2)`,
              animation:`rbMicroPop 1.7s cubic-bezier(.18,.9,.12,1) ${s.d}s both`,
            }} />
          ))}

          {mindSlashes.map((sl, i) => (
            <div key={`ms${i}`} style={{ position:"absolute", left:sl.l, top:sl.t, transform:`translateZ(${72 + i * 8}px)` }}>
              <div style={{
                position:"absolute",
                left:"50%",
                top:"50%",
                width:sl.w,
                height:sl.h,
                ["--rb-rot" as string]: `${sl.rot}deg`,
                transform:`translate(-50%,-50%) rotate(${sl.rot}deg) translateZ(${64 + i * 6}px)`,
                borderRadius:"70% 30% 60% 40% / 8% 12% 88% 92%",
                background:isFiveByFive
                  ? "linear-gradient(to bottom, rgba(34,211,238,0) 0%, rgba(103,232,249,0.86) 18%, rgba(34,211,238,0.95) 52%, rgba(8,145,178,0.16) 100%)"
                  : "linear-gradient(to bottom, rgba(255,110,110,0) 0%, rgba(248,113,113,0.82) 18%, rgba(220,38,38,0.94) 52%, rgba(127,29,29,0.16) 100%)",
                filter:"blur(0.35px)",
                boxShadow:isFiveByFive
                  ? "0 0 26px rgba(34,211,238,0.52), 0 20px 36px rgba(0,0,0,0.36)"
                  : "0 0 26px rgba(220,38,38,0.48), 0 20px 36px rgba(0,0,0,0.36)",
                opacity:0,
                animation:`rbMindSlashSweep 1.75s cubic-bezier(.2,.85,.15,1) ${sl.d}s both`,
              } as React.CSSProperties} />
              <div style={{
                position:"absolute",
                left:"50%",
                top:"50%",
                width:Math.max(6, Math.floor(sl.w * 0.26)),
                height:Math.max(80, Math.floor(sl.h * 0.74)),
                ["--rb-rot" as string]: `${sl.rot}deg`,
                transform:`translate(-50%,-50%) rotate(${sl.rot}deg) translateZ(${110 + i * 8}px)`,
                borderRadius:"999px",
                background:isFiveByFive
                  ? "linear-gradient(to bottom, rgba(165,243,252,0) 0%, rgba(103,232,249,0.9) 24%, rgba(34,211,238,0.28) 82%, rgba(0,0,0,0) 100%)"
                  : "linear-gradient(to bottom, rgba(254,202,202,0) 0%, rgba(252,165,165,0.88) 24%, rgba(248,113,113,0.28) 82%, rgba(0,0,0,0) 100%)",
                opacity:0,
                animation:`rbMindCoreSweep 1.45s ease ${sl.d + 0.05}s both`,
              } as React.CSSProperties} />
            </div>
          ))}

          <div style={{
            position:"absolute", left:"50%", top:"56%", width:"min(1300px,100vw)", height:260,
            transform:"translateX(-50%) translateZ(54px) rotateX(16deg)",
            background:`radial-gradient(circle at 50% 70%, ${cloudTone} 0%, rgba(0,0,0,0) 72%)`,
            filter:"blur(16px)",
            opacity:0,
            animation:"rbMist 2.3s ease 0.2s both",
          }} />
        </div>

        <div style={{ display:"flex", gap:ip?1:5, alignItems:"center", justifyContent:"center", position:"relative", maxWidth:"98vw", flexWrap:"wrap", transformStyle:"preserve-3d", transform:titleTilt }}>
          {splashTitle.split("").map((ch, i) => (
            <div key={i} style={{ position:"relative", display:"inline-block" }}>
              <span style={{
                fontFamily:t.fontDisplay, fontSize:"clamp(32px,6.2vw,108px)", fontWeight:950,
                color:splashColor, textShadow:isFiveByFive
                  ? "0 0 34px rgba(34,211,238,0.62), 0 18px 40px rgba(0,0,0,0.8)"
                  : "0 0 38px rgba(185,28,28,0.62), 0 18px 40px rgba(0,0,0,0.86)",
                letterSpacing:isFiveByFive ? "0.01em" : "0.02em", display:"inline-block",
                transform:`translateZ(${isFiveByFive ? 56 : 62}px) rotateX(${isFiveByFive ? 10 : 10}deg)`,
                animation:`rbLetterIn 0.7s cubic-bezier(.22,.68,0,1.2) ${i*0.045}s both`
              }}>{ch}</span>
            </div>
          ))}
        </div>
        <div style={{ width:"clamp(320px,62vw,980px)", height:3, background:`linear-gradient(90deg, transparent, ${splashColor}, transparent)`, marginTop:24, animation:"rbLineIn 0.9s cubic-bezier(.22,.68,0,1.2) 0.45s both", boxShadow:`0 0 28px ${isFiveByFive ? "rgba(34,211,238,0.72)" : "rgba(185,28,28,0.8)"}`, transform:`translateZ(${isFiveByFive ? 46 : 46}px) rotateX(${isFiveByFive ? 8 : 8}deg)` }}/>
      </div>
    );
  }

  // ── rb_coin ────────────────────────────────────────────────────────────────
  if (phase === "rb_coin") {
    const revealed    = coinResult !== null;
    const coinDiam    = 240;
    const revType     = coinResult ?? "PENTA";
    const winCol      = revealed ? (coinResult === "PENTA" ? p1c : p2c) : t.textSecondary;
    const useWraith   = wraithKingToss;

    return (
      <div className="phase-screen" style={{ position:"fixed", top:64, left:0, right:0, bottom:0, zIndex:10000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", background:t.bg, overflowY:"auto", userSelect:"none" }}>
        <style>{`
          @keyframes coinReveal{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
          @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
          @keyframes rbCoinSpin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        `}</style>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(20px,3vw,48px)", fontWeight:900, color:t.accent, textShadow:`0 0 40px ${t.accentGlow}66`, letterSpacing:"0.08em", marginTop:36, marginBottom:10, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both" }}>COMMENCING TOSS</div>
        <div style={{ width:"clamp(160px,30vw,360px)", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, marginBottom:18, boxShadow:`0 0 14px ${t.accentGlow}55`, animation:"rbLineIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.1s both" }}/>
        {useWraith ? (
          <div style={{ display:"flex", gap:22, flexWrap:"wrap" as const, justifyContent:"center", fontFamily:t.fontMono, fontSize:ip ? 13 : 17, color:t.textMuted, marginBottom:16, padding:"0 12px", animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both", textAlign:"center" as const }}>
            <span><span style={{ color:"#cc88ff", fontWeight:900, letterSpacing:"0.06em" }}>DOMINION</span> <span style={{ color:t.textMuted }}>(PENTA)</span> = {p1Name}</span>
            <span style={{ color:t.border }}>|</span>
            <span><span style={{ color:"#88aadd", fontWeight:900, letterSpacing:"0.06em" }}>SERVITUDE</span> <span style={{ color:t.textMuted }}>(PROTO)</span> = {p2Name}</span>
          </div>
        ) : (
          <div style={{ display:"flex", gap:28, fontFamily:t.fontMono, fontSize:39, color:t.textMuted, marginBottom:20, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both" }}>
            <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PENTA" size={26}/><span>PENTA = {p1Name}</span></span>
            <span style={{ color:t.border }}>|</span>
            <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PROTO" size={26}/><span>PROTO = {p2Name}</span></span>
          </div>
        )}

        <div style={{ width:"100%", minHeight:"50vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", flexShrink:0, perspective:800 }}>
          {useWraith ? (
            <div style={{ position:"relative", width:"100%", maxWidth:400, display:"flex", justifyContent:"center" }}>
              <div style={{ position:"absolute", width:coinDiam*2.4, height:coinDiam*2.4, borderRadius:"50%", left:"50%", top:"42%", transform:"translate(-50%,-50%)", background:revealed?`radial-gradient(circle, ${winCol}28 0%, transparent 68%)`:`radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition:"background 0.6s ease", pointerEvents:"none" }}/>
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
              <div style={{ position:"absolute", width:coinDiam*2.4, height:coinDiam*2.4, borderRadius:"50%", background:revealed?`radial-gradient(circle, ${winCol}28 0%, transparent 68%)`:`radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition:"background 0.6s ease", pointerEvents:"none" }}/>
              {!revealed && [1,1.5,2].map((scale,i) => (<div key={i} style={{ position:"absolute", width:coinDiam*scale, height:coinDiam*scale, borderRadius:"50%", border:`1px solid ${t.accent}${["18","10","08"][i]}`, animation:`spinRing ${2+i*0.4}s linear infinite`, pointerEvents:"none" }}/>))}
              {revealed ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, animation:"coinReveal 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
                  <div style={{ borderRadius:"50%", boxShadow:`0 0 90px ${winCol}66, 0 0 40px ${winCol}33, 0 20px 60px rgba(0,0,0,0.7)` }}><CoinFace type={revType} size={coinDiam}/></div>
                  <span style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:800, color:winCol, letterSpacing:"0.14em", textShadow:`0 0 32px ${winCol}99`, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.18s both" }}>{revType}</span>
                </div>
              ) : (
                <div style={{ width:coinDiam, height:coinDiam, borderRadius:"50%", perspective:900, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <div style={{
                    width:coinDiam,
                    height:coinDiam,
                    position:"relative",
                    transformStyle:"preserve-3d",
                    animation:"rbCoinSpin 0.12s linear infinite",
                    willChange:"transform",
                    borderRadius:"50%",
                    boxShadow:"0 12px 48px rgba(0,0,0,0.65)",
                  }}>
                    <img
                      src="/penta-coin.png"
                      alt="PENTA"
                      style={{
                        position:"absolute",
                        inset:0,
                        width:"100%",
                        height:"100%",
                        borderRadius:"50%",
                        backfaceVisibility:"hidden",
                        WebkitBackfaceVisibility:"hidden",
                        objectFit:"cover",
                        background:"#ffffff",
                      }}
                    />
                    <img
                      src="/proto-coin.png"
                      alt="PROTO"
                      style={{
                        position:"absolute",
                        inset:0,
                        width:"100%",
                        height:"100%",
                        borderRadius:"50%",
                        backfaceVisibility:"hidden",
                        WebkitBackfaceVisibility:"hidden",
                        transform:"rotateY(180deg)",
                        objectFit:"cover",
                        background:"#0a0a0a",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {revealed && (
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(18px,2.4vw,32px)", fontWeight:700, color:t.text, textAlign:"center", letterSpacing:"0.06em", marginTop:8, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.3s both" }}>
            <span style={{ color:winCol }}>{nameOf(tossWinner!)}</span><span style={{ color:t.textMuted }}> WINS THE TOSS</span>
          </div>
        )}
      </div>
    );
  }

  // ── toss choice phases (card-based left/right) ─────────────────────────────
  const tossChoicePhases: Phase[] = ["rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser"];
  if (tossChoicePhases.includes(phase)) {
    const winCol   = tossWinner === "P1" ? p1c : p2c;
    const loseCol  = tossLoser  === "P1" ? p1c : p2c;
    let title="", leftLabel="", rightLabel="", actor="", actorCol=winCol;
    if (phase==="rule_choice") {
      title=`${nameOf(tossWinner!)} WON THE TOSS — CHOOSE YOUR RULE`;
      leftLabel= is7x7 ? "EXTRA TURN\nTOKEN" : "DECIDE WHO\nPLAYS FIRST";
      rightLabel= is7x7 ? "BAN A\nPATTERN" : "BLOCK C3\nFIRST MOVE";
      actor=nameOf(tossWinner!); actorCol=winCol;
    }
    if (phase==="who_first_winner") { title=`${nameOf(tossWinner!)} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${nameOf(tossWinner!)}\nPLAYS FIRST`; rightLabel=`${nameOf(tossLoser)}\nPLAYS FIRST`; actor=nameOf(tossWinner!); actorCol=winCol; }
    if (phase==="c3_choice")        { title=`${nameOf(tossWinner!)} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=nameOf(tossWinner!); actorCol=winCol; }
    if (phase==="c3_choice_loser")  { title=`${nameOf(tossLoser)} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=nameOf(tossLoser); actorCol=loseCol; }
    if (phase==="who_first_loser")  { title=`${nameOf(tossLoser)} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${nameOf(tossLoser)}\nPLAYS FIRST`; rightLabel=`${nameOf(tossWinner!)}\nPLAYS FIRST`; actor=nameOf(tossLoser); actorCol=loseCol; }

    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct     = Math.max(0, choiceTimer / maxTime);
    const urgent  = choiceTimer <= 10;

    const winnerPhases = ["rule_choice", "who_first_winner", "c3_choice"];
    const loserPhases  = ["c3_choice_loser", "who_first_loser"];
    const isMyTurn = !isMultiplayerGame ||
      (winnerPhases.includes(phase) && mySlot === tossWinner) ||
      (loserPhases.includes(phase)  && mySlot === tossLoser);

    // Bot is choosing: show/hide overlay on cards
    const isBotTurnToChoose = gameMode === "ai" && (
  (winnerPhases.includes(phase) && tossWinner === "P2") ||
  (loserPhases.includes(phase)  && tossWinner === "P1")
);
const isBotChoosing = isBotTurnToChoose;

    return (
      <div className="phase-screen" style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:10000, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:24, userSelect:"none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;animation-fill-mode:both;}`}</style>

        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(13px,1.8vw,22px)", fontWeight:700, color:t.accent, textAlign:"center", maxWidth:800 }}>{title}</div>

        {isMultiplayerGame && !isMyTurn && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", background:`${actorCol}10`, border:`1px solid ${actorCol}33`, borderRadius:ip?2:10, animation:"fadeUp 0.3s ease both" }}>
            <div style={{ display:"flex", gap:6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:actorCol, opacity:0.7, animation:`botPulse 1.2s ease-in-out ${i*0.25}s infinite` }}/>
              ))}
            </div>
            <span style={{ fontFamily:t.fontMono, fontSize:12, color:actorCol, letterSpacing:"0.12em" }}>WAITING FOR {actor}...</span>
          </div>
        )}

        {isMultiplayerGame && (phase === "c3_choice_loser" || phase === "who_first_loser") && (
          <div style={{ background:`${winCol}12`, border:`1px solid ${winCol}44`, borderRadius:ip?2:10, padding:"12px 20px", maxWidth:480, width:"100%", textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>{tossWinner} ALREADY CHOSE</div>
            {phase === "c3_choice_loser" && winnerPickedFirst && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:winCol }}>PLAYS FIRST: {nameOf(winnerPickedFirst)}</div>
            )}
            {phase === "who_first_loser" && !is7x7 && winnerPickedC3 !== null && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:winCol }}>C3: {winnerPickedC3 ? "BLOCKED" : "ALLOWED"}</div>
            )}
            {phase === "who_first_loser" && is7x7 && rbBannedPattern && !(winnerPickedRule === "extra_turn" && mySlot === tossWinner) && !(winnerPickedRule === "ban" && mySlot === tossLoser) && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:"#EF4444" }}>BANNED: {({"Y":"Y-SHAPE","L":"L-SHAPE","W":"W-SHAPE","V":"V-SHAPE","C":"C-SHAPE","zigzag":"ZIGZAG"} as Record<string,string>)[rbBannedPattern] || rbBannedPattern.toUpperCase()}</div>
            )}
            {phase === "who_first_loser" && is7x7 && winnerPickedRule === "extra_turn" && mySlot === tossWinner && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:winCol }}>EXTRA TURN TOKEN (opponent banned a pattern — hidden from you for the full 7×7 game and on the match results screen; Career shows which pattern)</div>
            )}
            {phase === "who_first_loser" && is7x7 && winnerPickedRule === "ban" && mySlot === tossLoser && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:loseCol }}>OPPONENT BANNED A PATTERN (hidden from you for the full 7×7 game and on the results screen; Career shows which pattern)</div>
            )}
          </div>
        )}

        {/* Bot thinking banner */}
        {isBotTurnToChoose && !botPickedSide && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", background:`${actorCol}10`, border:`1px solid ${actorCol}33`, borderRadius:ip?2:10, animation:"fadeUp 0.3s ease both" }}>
            <div style={{ display:"flex", gap:6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:actorCol, opacity:0.7, animation:`botPulse 1.2s ease-in-out ${i*0.25}s infinite` }}/>
              ))}
            </div>
            <span style={{ fontFamily:t.fontMono, fontSize:12, color:actorCol, letterSpacing:"0.12em" }}>BOT IS CHOOSING...</span>
          </div>
        )}

        <div style={{ width:"min(480px,88vw)", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em" }}>{actor} IS CHOOSING</span>
            <span style={{ fontFamily:t.fontMono, fontSize:22, fontWeight:700, color:urgent?t.danger:actorCol, transition:"color 0.3s ease", animation:urgent?"urgentPulse 0.6s ease infinite":"none" }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height:5, background:t.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:3, transition:"width 1.05s linear, background 0.35s ease", background:urgent?t.danger:`linear-gradient(90deg, ${actorCol}, ${t.accent})`, boxShadow:urgent?`0 0 14px ${t.danger}88`:`0 0 10px ${actorCol}66` }}/>
          </div>
        </div>

        {/* Cards — always render normally; blur overlay only on unchosen card when bot reveals */}
        <div style={{ display:"flex", gap:32, width:"100%", maxWidth:1000, pointerEvents:(isMyTurn && !isBotTurnToChoose)?"auto":"none" }}>
          <div style={{ flex:1, position:"relative", display:"flex" }}>
            <TossCard label={leftLabel} onClick={onLeftAction} delay={0.12} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
            {isBotTurnToChoose && botPickedSide !== null && botPickedSide !== "left" && (
              <div style={{ position:"absolute", inset:0, borderRadius:ip?2:16, backdropFilter:"blur(5px)", background:"rgba(0,0,0,0.5)", zIndex:2 }} />
            )}
          </div>
          <div style={{ flex:1, position:"relative", display:"flex" }}>
            <TossCard label={rightLabel} onClick={onRightAction} delay={0.20} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
            {isBotTurnToChoose && botPickedSide !== null && botPickedSide !== "right" && (
              <div style={{ position:"absolute", inset:0, borderRadius:ip?2:16, backdropFilter:"blur(5px)", background:"rgba(0,0,0,0.5)", zIndex:2 }} />
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
    const title = `${nameOf(banActor)} — BAN ONE PATTERN`;

    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct = Math.max(0, choiceTimer / maxTime);
    const urgent = choiceTimer <= 10;

    const winnerPhases = ["ban_pattern_winner"];
    const loserPhases  = ["ban_pattern_loser"];
    const isMyTurn = !isMultiplayerGame ||
      (winnerPhases.includes(phase) && mySlot === tossWinner) ||
      (loserPhases.includes(phase) && mySlot === tossLoser);

    const isBotTurnToChoose = gameMode === "ai" && (
      (isWinnerBanning && tossWinner === "P2") ||
      (!isWinnerBanning && tossWinner === "P1")
    );

    const PATTERN_LABELS: Record<string, string> = {
      Y: "Y-SHAPE", L: "L-SHAPE", W: "W-SHAPE", V: "V-SHAPE", C: "C-SHAPE", zigzag: "ZIGZAG",
    };

    return (
      <div className="phase-screen" style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:10000, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:20, userSelect:"none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;}`}</style>

        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(13px,1.8vw,22px)", fontWeight:700, color:t.accent, textAlign:"center", maxWidth:800 }}>{title}</div>

        <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, textAlign:"center", maxWidth:500 }}>
          Choose one pattern to <span style={{ color: "#EF4444", fontWeight: 700 }}>remove</span> from Round 3.
          The remaining patterns will be the win conditions.
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
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", background:`${actorCol}10`, border:`1px solid ${actorCol}33`, borderRadius:ip?2:10, animation:"fadeUp 0.3s ease both" }}>
            <div style={{ display:"flex", gap:6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:actorCol, opacity:0.7, animation:`botPulse 1.2s ease-in-out ${i*0.25}s infinite` }}/>
              ))}
            </div>
            <span style={{ fontFamily:t.fontMono, fontSize:12, color:actorCol, letterSpacing:"0.12em" }}>BOT IS CHOOSING...</span>
          </div>
        )}

        <div style={{ width:"min(480px,88vw)", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em" }}>{nameOf(banActor)} IS CHOOSING</span>
            <span style={{ fontFamily:t.fontMono, fontSize:22, fontWeight:700, color:urgent?t.danger:actorCol, transition:"color 0.3s ease", animation:urgent?"urgentPulse 0.6s ease infinite":"none" }}>{fmtSecAction(choiceTimer)}s</span>
          </div>
          <div style={{ height:5, background:t.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:3, transition:"width 1.05s linear, background 0.35s ease", background:urgent?t.danger:`linear-gradient(90deg, ${actorCol}, ${t.accent})`, boxShadow:urgent?`0 0 14px ${t.danger}88`:`0 0 10px ${actorCol}66` }}/>
          </div>
        </div>

        <div style={{
          display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))",
          gap:12, width:"100%", maxWidth:660,
          pointerEvents: (isMyTurn && !isBotTurnToChoose) ? "auto" : "none",
        }}>
          {selectedPatterns.map((name, i) => {
            const label = PATTERN_LABELS[name] || name.toUpperCase();
            return (
              <button
                key={name}
                onClick={() => onBanPattern?.(name)}
                className="toss-card-enter"
                style={{
                  animationDelay: `${i * 0.06}s`,
                  background: `linear-gradient(145deg, rgba(239,68,68,0.08), ${t.bgCard})`,
                  border: `2px solid ${t.border}`,
                  borderRadius: ip ? 2 : 14,
                  padding: "20px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.25s cubic-bezier(.22,.68,0,1.2)",
                  minHeight: 80,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.border = "2px solid #EF4444";
                  (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(145deg, rgba(239,68,68,0.18), rgba(0,0,0,0.4))";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px) scale(1.03)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(239,68,68,0.2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.border = `2px solid ${t.border}`;
                  (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(145deg, rgba(239,68,68,0.08), ${t.bgCard})`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0) scale(1)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:t.text, letterSpacing:"0.06em" }}>{label}</div>
                <div style={{ fontFamily:t.fontMono, fontSize:11, color:"#EF4444", letterSpacing:"0.1em", fontWeight:600 }}>BAN</div>
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
        rbBannedPattern &&
          banActorColumn === col &&
          ((isMultiplayerGame && col !== mySlot) || (gameMode === "ai" && col === "P2")),
      );

    let winnerChoice: string;
    let loserChoice: string;
    if (is7x7) {
      const bannedLabel = rbBannedPattern ? (PATTERN_LABELS_SUMMARY[rbBannedPattern] || rbBannedPattern.toUpperCase()) : "NONE";
      if (winnerPickedRule === "extra_turn") {
        winnerChoice = "EXTRA TURN TOKEN\n(1× · center rule off)";
        loserChoice = `BANNED:\n${bannedLabel}\nPLAYS FIRST:\n${fp}`;
      } else if (winnerPickedFirstTurn) {
        winnerChoice = `PLAYS FIRST:\n${fp}`;
        loserChoice = `BANNED:\n${bannedLabel}`;
      } else {
        winnerChoice = `BANNED:\n${bannedLabel}`;
        loserChoice = `PLAYS FIRST:\n${fp}`;
      }
    } else {
      winnerChoice = winnerPickedFirstTurn
        ? `PLAYS FIRST:\n${fp}`
        : `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`;
      loserChoice = winnerPickedFirstTurn
        ? `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`
        : `PLAYS FIRST:\n${fp}`;
    }

    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:10000, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:32, userSelect:"none", animation:"fadeUp 0.35s ease both" }}>
        {/* Background Atmosphere */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 50%, ${t.accent}08 0%, transparent 70%)`, pointerEvents: "none" }} />
        
        <div style={{ textAlign: "center", position: "relative" }}>
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(32px,5vw,64px)", fontWeight:950, color:t.accent, textShadow: `0 0 40px ${t.accentGlow}66`, letterSpacing: "0.05em" }}>ROUND 3 RULES</div>
          <div style={{ fontFamily:t.fontMono, fontSize:18, color:t.textMuted, letterSpacing: "0.2em", marginTop: 8 }}>PREPARING FOR COMMENCEMENT...</div>
        </div>

        <div style={{ display:"flex", gap:32, width:"100%", maxWidth:1100, position: "relative" }}>
          {(["P1","P2"] as const).map(p => {
            const col      = p === "P1" ? p1c : p2c;
            const isWinner = p === tossWinner;
            const choice   = isWinner ? winnerChoice : loserChoice;
            const isMe     = isMultiplayerGame && p === mySlot;
            const firstSlotFromFp = fp === "P1" || fp === "P2" ? fp : "P1";
            
            // Only show rank icons in multiplayer, and only when we actually know each player's ELO.
            const playerElo = isMultiplayerGame ? (p === "P1" ? p1Elo : p2Elo) : undefined;
            const getRankData = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[RANKS.length - 1];
            const rank = (typeof playerElo === "number") ? getRankData(playerElo) : null;

            const isWhoFirst = choice.includes("PLAYS FIRST");
            const isBanned = choice.includes("BANNED");
            const bannedLabelOnly = is7x7 && rbBannedPattern ? (PATTERN_LABELS_SUMMARY[rbBannedPattern] || rbBannedPattern.toUpperCase()) : "";
            const secretBan = hideBannedNameForViewer(p);
            const displayBannedLabel = secretBan ? "?" : bannedLabelOnly;

            return (
              <div key={p} style={{ 
                flex:1, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(40px)",
                border:`3px solid ${col}${isMe?"":"44"}`, borderRadius:ip?2:24, 
                padding:"40px 32px", textAlign:"center", opacity:isMe?1:0.75,
                boxShadow: isMe ? `0 30px 100px rgba(0,0,0,0.8), 0 0 50px ${col}33` : "none",
                transform: isMe ? "scale(1.05)" : "scale(1)", transition: "all 0.4s cubic-bezier(.22,.68,0,1.2)"
              }}>
                <div style={{ fontFamily:t.fontDisplay, fontSize:64, fontWeight:950, color:col, marginBottom:8, textShadow: `0 0 30px ${col}66` }}>{nameOf(p)}</div>
                
                {/* Rank Logo below name */}
                {rank && (
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                    <RankIcon rank={rank} size={120} />
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.2em", textTransform: "uppercase" }}>{isWinner ? "Toss Winner" : "Toss Loser"}</div>
                  {isMe && <div style={{ fontFamily:t.fontMono, fontSize:12, color:col, letterSpacing:"0.2em", fontWeight: 800 }}>[YOU]</div>}
                </div>

                <div style={{ 
                  background: "rgba(0,0,0,0.4)", border: `1px solid ${col}22`, borderRadius: 16, 
                  padding: "24px", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)", gap: 12
                }}>
                 <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
  {is7x7 && winnerPickedRule === "extra_turn" && isWinner ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>Extra turn token</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:26, fontWeight:900, color:col, letterSpacing:"0.05em", textAlign:"center", lineHeight:1.35 }}>
        One bonus consecutive move later · center opening off
      </div>
    </>
  ) : is7x7 && winnerPickedRule === "ban" && isWinner ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>Pattern banned</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:900, color:"#EF4444", letterSpacing:"0.05em", textDecoration: secretBan ? "none" : "line-through", textDecorationColor:"rgba(239,68,68,0.6)" }}>{displayBannedLabel}</div>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase", marginTop: 8 }}>Hidden from opponent in the match UI — Career shows it after the match</div>
    </>
  ) : is7x7 && winnerPickedRule === "ban" && !isWinner ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>Opponent banned</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:22, fontWeight:800, color:col, letterSpacing:"0.04em", textAlign:"center", lineHeight:1.4 }}>
        One pattern removed — which one stays hidden for the full game and on the results screen; Career shows it afterward
      </div>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase", marginTop: 8 }}>Plays first</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:32, fontWeight:900, color:firstSlotFromFp === "P1" ? p1c : p2c, letterSpacing:"0.05em" }}>{nameOf(firstSlotFromFp)}</div>
    </>
  ) : is7x7 && winnerPickedRule === "extra_turn" && !isWinner ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>Pattern banned</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:900, color:"#EF4444", letterSpacing:"0.05em", textDecoration: secretBan ? "none" : "line-through", textDecorationColor:"rgba(239,68,68,0.6)" }}>{displayBannedLabel}</div>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase", marginTop: 8 }}>Plays first</div>
      <div style={{ fontFamily:t.fontDisplay, fontSize:32, fontWeight:900, color:firstSlotFromFp === "P1" ? p1c : p2c, letterSpacing:"0.05em" }}>{nameOf(firstSlotFromFp)}</div>
    </>
  ) : isWhoFirst ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>
        Plays First
      </div>
      <div style={{
        fontFamily:t.fontDisplay,
        fontSize:32,
        fontWeight:900,
        color:firstSlotFromFp === "P1" ? p1c : p2c,
        letterSpacing:"0.05em"
      }}>
        {nameOf(firstSlotFromFp)}
      </div>
    </>
  ) : isBanned ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>
        Pattern Banned
      </div>
      <div style={{
        fontFamily:t.fontDisplay,
        fontSize:28,
        fontWeight:900,
        color:"#EF4444",
        letterSpacing:"0.05em",
        textDecoration: secretBan ? "none" : "line-through",
        textDecorationColor:"rgba(239,68,68,0.6)",
      }}>
        {secretBan ? "?" : choice.replace("BANNED:\n", "")}
      </div>
    </>
  ) : (
    <div style={{
      fontFamily:t.fontMono,
      fontSize:22,
      fontWeight:700,
      color:t.text,
      whiteSpace:"pre-line",
      lineHeight:1.6,
      letterSpacing:"0.05em"
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

        <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight: 900, color:t.accent, background: "rgba(0,0,0,0.5)", padding: "12px 40px", borderRadius: 40, border: `1px solid ${t.accent}44` }}>
          BATTLE STARTS IN {Math.max(1, Math.ceil(summaryTimer))}S
        </div>
      </div>
    );
  }

  // ── rb_initializing ────────────────────────────────────────────────────────
  if (phase === "rb_initializing") {
    return (
      <div style={{ position:"fixed", inset:0, zIndex:10001, background:t.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:32, overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, opacity:0.15, pointerEvents:"none" }}>
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at center, ${t.accent} 0%, transparent 70%)`, filter:"blur(80px)" }} />
        </div>
        
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, animation:"fadeUp 0.6s ease both" }}>
          <div style={{ display:"flex", gap:4 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:t.accent, animation:`rbRingPulse 1s ease-in-out ${i*0.15}s infinite` }} />
            ))}
          </div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(24px,4vw,48px)", fontWeight:900, color:t.accent, letterSpacing:"0.15em", textShadow:`0 0 40px ${t.accentGlow}66` }}>
            RECONFIGURING BOARD...
          </div>
          <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, letterSpacing:"0.3em" }}>
            PREPARING SPECIAL RULES FOR ROUND 3
          </div>
        </div>

        <div style={{ width:"clamp(240px, 40vw, 500px)", height:6, background:t.border, borderRadius:3, overflow:"hidden", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:t.accent, animation:"loadingSweep 2s infinite linear" }} />
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
