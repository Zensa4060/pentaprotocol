"use client";
import React from "react";
import { CoinFace, TossCard } from "./GamePieces";
import type { Phase } from "./GamePieces";

export const PHASE_TIMERS: Partial<Record<Phase, number>> = {
  rule_choice: 30, who_first_winner: 30, c3_choice: 30, c3_choice_loser: 30, who_first_loser: 30,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface RulebreakerFlowProps {
  phase: Phase;
  // theme
  t: {
    bg: string; accent: string; accentGlow: string; fontDisplay: string; fontMono: string;
    fontBody: string; textMuted: string; textSecondary: string; text: string; border: string;
    bgCard: string; gold: string; danger: string;
  };
  ip: boolean;
  p1c: string;
  p2c: string;
  // coin
  coinResult: "PENTA" | "PROTO" | null;
  coinAngle: number;
  coinDivRef: React.RefObject<HTMLDivElement | null>;
  tossWinner: "P1" | "P2" | null;
  // summary
  summaryTimer: number;
  firstPlayerChosen: string | null;
  rbC3Blocked: boolean;
  // choice timer
  choiceTimer: number;
  // multiplayer
  isMultiplayerGame: boolean;
  mySlot: "P1" | "P2";
  // winner's picks (shown to loser)
  winnerPickedRule: string | null;
  winnerPickedFirst: string | null;
  winnerPickedC3: boolean | null;
  // handlers
  onLeft: () => void;
  onRight: () => void;
  fmtSec: (s: number) => string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RulebreakerFlow({
  phase, t, ip, p1c, p2c,
  coinResult, coinAngle, coinDivRef, tossWinner,
  summaryTimer, firstPlayerChosen, rbC3Blocked,
  choiceTimer, isMultiplayerGame, mySlot,
  winnerPickedRule, winnerPickedFirst, winnerPickedC3,
  onLeft, onRight, fmtSec,
}: RulebreakerFlowProps) {

  const tossLoser = tossWinner === "P1" ? "P2" : "P1";

  // ── rb_splash ──────────────────────────────────────────────────────────────
  if (phase === "rb_splash") return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, userSelect:"none", gap:0, overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        {[1,2,3].map(i => (<div key={i} style={{ position:"absolute", width:`${i*280}px`, height:`${i*280}px`, borderRadius:"50%", border:`1px solid ${t.accent}${["22","18","0C"][i-1]}`, animation:`rbRingPulse 1.8s cubic-bezier(.22,.68,0,1.2) ${i*0.18}s both` }}/>))}
      </div>
      <div style={{ display:"flex", gap:ip?2:4, alignItems:"center", justifyContent:"center" }}>
        {"RULEBREAKER".split("").map((ch, i) => (
          <span key={i} style={{ fontFamily:t.fontDisplay, fontSize:"clamp(32px,5.5vw,88px)", fontWeight:900, color:t.accent, textShadow:`0 0 60px ${t.accentGlow}88`, letterSpacing:"0.01em", display:"inline-block", animation:`rbLetterIn 0.55s cubic-bezier(.22,.68,0,1.2) ${i*0.045}s both` }}>{ch}</span>
        ))}
      </div>
      <div style={{ fontFamily:t.fontMono, fontSize:ip?11:14, color:t.textMuted, letterSpacing:"0.28em", marginTop:18, animation:"rbSubIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.55s both" }}>ROUND 3 — SPECIAL RULES APPLY</div>
      <div style={{ width:"clamp(200px,38vw,480px)", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, marginTop:20, animation:"rbLineIn 0.7s cubic-bezier(.22,.68,0,1.2) 0.45s both", boxShadow:`0 0 18px ${t.accentGlow}66` }}/>
    </div>
  );

  // ── rb_coin ────────────────────────────────────────────────────────────────
  if (phase === "rb_coin") {
    const revealed  = coinResult !== null;
    const coinDiam  = 240;
    const revType   = coinResult ?? "PENTA";
    const winCol    = revealed ? (coinResult === "PENTA" ? p1c : p2c) : t.textSecondary;
    const deg       = ((coinAngle*(180/Math.PI))%360+360)%360;
    const scaleX    = Math.cos(coinAngle*2);
    const faceIsPenta = deg < 90 || deg > 270;
    const src       = faceIsPenta ? "/penta-coin.png" : "/proto-coin.png";
    const bg        = faceIsPenta ? "#ffffff" : "#0a0a0a";

    // In multiplayer, show a "waiting for coin" state for the non-P1 player
    // before the coin result arrives from P1
    const waitingForCoin = false; // both players see the coin via time-synced angle

    return (
      <div className="phase-screen" style={{ position:"fixed", top:64, left:0, right:0, bottom:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", background:t.bg, overflowY:"auto", userSelect:"none" }}>
        <style>{`@keyframes coinReveal{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}} @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}`}</style>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(20px,3vw,48px)", fontWeight:900, color:t.accent, textShadow:`0 0 40px ${t.accentGlow}66`, letterSpacing:"0.08em", marginTop:36, marginBottom:10, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both" }}>COMMENCING TOSS</div>
        <div style={{ width:"clamp(160px,30vw,360px)", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, marginBottom:18, boxShadow:`0 0 14px ${t.accentGlow}55`, animation:"rbLineIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.1s both" }}/>
        <div style={{ display:"flex", gap:28, fontFamily:t.fontMono, fontSize:39, color:t.textMuted, marginBottom:20, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PENTA" size={26}/><span>PENTA = P1</span></span>
          <span style={{ color:t.border }}>|</span>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PROTO" size={26}/><span>PROTO = P2</span></span>
        </div>

        <div style={{ width:"100%", height:"50vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", flexShrink:0, perspective:800 }}>
          <div style={{ position:"absolute", width:coinDiam*2.4, height:coinDiam*2.4, borderRadius:"50%", background:revealed?`radial-gradient(circle, ${winCol}28 0%, transparent 68%)`:`radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition:"background 0.6s ease", pointerEvents:"none" }}/>
          {!revealed && [1,1.5,2].map((scale,i) => (<div key={i} style={{ position:"absolute", width:coinDiam*scale, height:coinDiam*scale, borderRadius:"50%", border:`1px solid ${t.accent}${["18","10","08"][i]}`, animation:`spinRing ${2+i*0.4}s linear infinite`, pointerEvents:"none" }}/>))}
          {revealed ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, animation:"coinReveal 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ borderRadius:"50%", boxShadow:`0 0 90px ${winCol}66, 0 0 40px ${winCol}33, 0 20px 60px rgba(0,0,0,0.7)` }}><CoinFace type={revType} size={coinDiam}/></div>
              <span style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:800, color:winCol, letterSpacing:"0.14em", textShadow:`0 0 32px ${winCol}99`, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.18s both" }}>{revType}</span>
            </div>
          ) : waitingForCoin ? (
            // P2 waiting for P1 to flip — show animated waiting state
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
              <div style={{ width:coinDiam, height:coinDiam, borderRadius:"50%", border:`3px solid ${t.accent}44`, display:"flex", alignItems:"center", justifyContent:"center", background:`${t.accent}08`, boxShadow:`0 0 40px ${t.accent}22` }}>
                <div style={{ display:"flex", gap:10 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:t.accent, opacity:0.7, animation:`botPulse 1.2s ease-in-out ${i*0.3}s infinite` }}/>
                  ))}
                </div>
              </div>
              <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, letterSpacing:"0.14em" }}>WAITING FOR COIN FLIP...</div>
            </div>
          ) : (
            <div ref={coinDivRef} style={{ width:coinDiam, height:coinDiam, borderRadius:"50%", overflow:"hidden", background:bg, transform:`scaleX(${Math.abs(scaleX)})`, willChange:"transform", boxShadow:"0 12px 48px rgba(0,0,0,0.65)", transition:"background 0.05s" }}>
              <img src={src} alt={faceIsPenta?"PENTA":"PROTO"} style={{ width:"100%", height:"100%", display:"block", objectFit:"cover" }}/>
            </div>
          )}
        </div>

        {revealed && (
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(18px,2.4vw,32px)", fontWeight:700, color:t.text, textAlign:"center", letterSpacing:"0.06em", marginTop:8, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.3s both" }}>
            <span style={{ color:winCol }}>{tossWinner}</span><span style={{ color:t.textMuted }}> WINS THE TOSS</span>
          </div>
        )}
      </div>
    );
  }

  // ── toss choice phases ─────────────────────────────────────────────────────
  const tossChoicePhases: Phase[] = ["rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser"];
  if (tossChoicePhases.includes(phase)) {
    const winCol   = tossWinner === "P1" ? p1c : p2c;
    const loseCol  = tossLoser  === "P1" ? p1c : p2c;
    let title="", leftLabel="", rightLabel="", actor="", actorCol=winCol;
    if (phase==="rule_choice")      { title=`${tossWinner} WON THE TOSS — CHOOSE YOUR RULE`; leftLabel="DECIDE WHO\nPLAYS FIRST"; rightLabel="BLOCK C3\nFIRST MOVE"; actor=tossWinner!; actorCol=winCol; }
    if (phase==="who_first_winner") { title=`${tossWinner} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${tossWinner}\nPLAYS FIRST`; rightLabel=`${tossLoser}\nPLAYS FIRST`; actor=tossWinner!; actorCol=winCol; }
    if (phase==="c3_choice")        { title=`${tossWinner} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=tossWinner!; actorCol=winCol; }
    if (phase==="c3_choice_loser")  { title=`${tossLoser} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=tossLoser!; actorCol=loseCol; }
    if (phase==="who_first_loser")  { title=`${tossLoser} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${tossLoser}\nPLAYS FIRST`; rightLabel=`${tossWinner}\nPLAYS FIRST`; actor=tossLoser!; actorCol=loseCol; }

    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct     = Math.max(0, choiceTimer / maxTime);
    const urgent  = choiceTimer <= 10;

    const winnerPhases = ["rule_choice", "who_first_winner", "c3_choice"];
    const loserPhases  = ["c3_choice_loser", "who_first_loser"];
    const isMyTurn = !isMultiplayerGame ||
      (winnerPhases.includes(phase) && mySlot === tossWinner) ||
      (loserPhases.includes(phase)  && mySlot === tossLoser);

    return (
      <div className="phase-screen" style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:2, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:24, userSelect:"none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;animation-fill-mode:both;}`}</style>

        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(13px,1.8vw,22px)", fontWeight:700, color:t.accent, textAlign:"center", maxWidth:800 }}>{title}</div>

        {/* Waiting indicator for non-active player in multiplayer */}
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

        {/* Show what toss winner already picked — visible to loser when it's their turn */}
        {isMultiplayerGame && (phase === "c3_choice_loser" || phase === "who_first_loser") && (
          <div style={{ background:`${winCol}12`, border:`1px solid ${winCol}44`, borderRadius:ip?2:10, padding:"12px 20px", maxWidth:480, width:"100%", textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>{tossWinner} ALREADY CHOSE</div>
            {phase === "c3_choice_loser" && winnerPickedFirst && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:winCol }}>
                PLAYS FIRST: {winnerPickedFirst}
              </div>
            )}
            {phase === "who_first_loser" && winnerPickedC3 !== null && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:winCol }}>
                C3: {winnerPickedC3 ? "BLOCKED" : "ALLOWED"}
              </div>
            )}
          </div>
        )}

        <div style={{ width:"min(480px,88vw)", display:"flex", flexDirection:"column", gap:6 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em" }}>{actor} IS CHOOSING</span>
            <span style={{ fontFamily:t.fontMono, fontSize:22, fontWeight:700, color:urgent?t.danger:actorCol, transition:"color 0.3s ease", animation:urgent?"urgentPulse 0.6s ease infinite":"none" }}>{fmtSec(choiceTimer)}s</span>
          </div>
          <div style={{ height:5, background:t.border, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct*100}%`, borderRadius:3, transition:"width 1.05s linear, background 0.35s ease", background:urgent?t.danger:`linear-gradient(90deg, ${actorCol}, ${t.accent})`, boxShadow:urgent?`0 0 14px ${t.danger}88`:`0 0 10px ${actorCol}66` }}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:20, width:"100%", maxWidth:880, opacity:isMyTurn?1:0.25, pointerEvents:isMyTurn?"auto":"none", transition:"opacity 0.3s", filter:isMyTurn?"none":"blur(1px)" }}>
          <TossCard label={leftLabel} onClick={onLeft} delay={0.12} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
          <TossCard label={rightLabel} onClick={onRight} delay={0.20} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
        </div>
      </div>
    );
  }

  // ── toss_summary ───────────────────────────────────────────────────────────
  if (phase === "toss_summary") {
    const fp = firstPlayerChosen ?? tossWinner ?? "P1";

    // Determine which player picked what based on winnerPickedRule
    // If winner picked "first" → winner chose who goes first, loser chose c3
    // If winner picked "c3"   → winner chose c3 rule, loser chose who goes first
    const winnerPickedFirstTurn = winnerPickedRule === "first";
    const winnerChoice = winnerPickedFirstTurn
      ? `PLAYS FIRST:\n${fp}`
      : `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`;
    const loserChoice = winnerPickedFirstTurn
      ? `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`
      : `PLAYS FIRST:\n${fp}`;

    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:2, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:24, userSelect:"none", animation:"fadeUp 0.35s ease both" }}>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(22px,3.5vw,42px)", fontWeight:700, color:t.accent }}>ROUND 3 RULES</div>
        <div style={{ fontFamily:t.fontMono, fontSize:17, color:t.textMuted }}>Game starts in {Math.max(1, Math.ceil(summaryTimer))}...</div>
        <div style={{ display:"flex", gap:20, width:"100%", maxWidth:800 }}>
          {(["P1","P2"] as const).map(p => {
            const col    = p === "P1" ? p1c : p2c;
            const isWinner = p === tossWinner;
            const choice = isWinner ? winnerChoice : loserChoice;
            const isMe   = isMultiplayerGame && p === mySlot;
            return (
              <div key={p} style={{ flex:1, background:t.bgCard, border:`3px solid ${col}${isMe?"":"66"}`, borderRadius:ip?2:14, padding:"24px 20px", textAlign:"center", opacity:isMe?1:0.8 }}>
                <div style={{ fontFamily:t.fontDisplay, fontSize:50, fontWeight:900, color:col, marginBottom:4 }}>{p}</div>
                {isMe && (
                  <div style={{ fontFamily:t.fontMono, fontSize:10, color:col, letterSpacing:"0.14em", marginBottom:10, opacity:0.7 }}>YOU</div>
                )}
                <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em", marginBottom:6 }}>
                  {isWinner ? "TOSS WINNER" : "TOSS LOSER"}
                </div>
                <div style={{ fontFamily:t.fontMono, fontSize:16, color:t.textSecondary, whiteSpace:"pre-line", lineHeight:1.9 }}>{choice}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}