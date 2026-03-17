"use client";
import React from "react";
import { CoinFace, TossCard, Piece as GamePieceComp } from "./GamePieces";
import type { Phase } from "./GamePieces";
import { RANKS, RankIcon } from "./ProfileScreen";

export const PHASE_TIMERS: Partial<Record<Phase, number>> = {
  rule_choice: 10, who_first_winner: 10, c3_choice: 10, c3_choice_loser: 10, who_first_loser: 10,
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
}

export function RulebreakerFlow({
  phase, t, ip, p1c, p2c,
  p1Elo, p2Elo,
  coinResult, coinAngle, coinDivRef, tossWinner,
  summaryTimer, firstPlayerChosen, rbC3Blocked,
  choiceTimer, isMultiplayerGame, mySlot,
  winnerPickedRule, winnerPickedFirst, winnerPickedC3,
  onLeftAction, onRightAction, fmtSecAction, gameMode, botPickedSide,
  p1Label: p1LabelProp, p2Label: p2LabelProp,
}: RulebreakerFlowProps) {

  const p1Name = p1LabelProp ?? "P1";
  const p2Name = p2LabelProp ?? "P2";
  const tossLoser = tossWinner === "P1" ? "P2" : "P1";
  const nameOf = (slot: string) => slot === "P1" ? p1Name : p2Name;

  // ── rb_splash ──────────────────────────────────────────────────────────────
  if (phase === "rb_splash") return (
    <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:10000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#050000", userSelect:"none", gap:0, overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at center, #200000 0%, transparent 70%)", opacity:0.6 }} />
      
      <div style={{ display:"flex", gap:ip?2:6, alignItems:"center", justifyContent:"center", position: "relative" }}>
        {"RULEBREAKER".split("").map((ch, i) => (
          <div key={i} style={{ position: "relative", display: "inline-block" }}>
            <span style={{ 
              fontFamily:t.fontDisplay, fontSize:"clamp(40px,8vw,120px)", fontWeight:950, 
              color:"#B91C1C", textShadow:`0 0 30px rgba(185,28,28,0.4), 0 10px 40px rgba(0,0,0,0.8)`, 
              letterSpacing:"0.02em", display:"inline-block", 
              animation:`rbLetterIn 0.7s cubic-bezier(.22,.68,0,1.2) ${i*0.06}s both` 
            }}>{ch}</span>
          </div>
        ))}
      </div>
      
      <div style={{ fontFamily:t.fontMono, fontSize:ip?12:16, color:"#991b1b", letterSpacing:"0.4em", fontWeight: 700, marginTop:32, textTransform: "uppercase", animation:"rbSubIn 0.8s cubic-bezier(.22,.68,0,1.2) 0.6s both" }}>
        ROUND 3 — SPECIAL RULES APPLY
      </div>
      <div style={{ width:"clamp(300px,50vw,700px)", height:3, background:`linear-gradient(90deg, transparent, #B91C1C, transparent)`, marginTop:24, animation:"rbLineIn 0.9s cubic-bezier(.22,.68,0,1.2) 0.5s both", boxShadow:`0 0 25px rgba(185,28,28,0.8)` }}/>
    </div>
  );

  // ── rb_coin ────────────────────────────────────────────────────────────────
  if (phase === "rb_coin") {
    const revealed    = coinResult !== null;
    const coinDiam    = 240;
    const revType     = coinResult ?? "PENTA";
    const winCol      = revealed ? (coinResult === "PENTA" ? p1c : p2c) : t.textSecondary;

    const spinScaleX  = Math.abs(Math.cos(coinAngle * 2));
    const spinDeg     = ((coinAngle * (180 / Math.PI)) % 360 + 360) % 360;
    const spinIsPenta = spinDeg < 90 || spinDeg > 270;
    const spinSrc     = spinIsPenta ? "/penta-coin.png" : "/proto-coin.png";
    const spinBg      = spinIsPenta ? "#ffffff" : "#0a0a0a";

    return (
      <div className="phase-screen" style={{ position:"fixed", top:64, left:0, right:0, bottom:0, zIndex:10000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", background:t.bg, overflowY:"auto", userSelect:"none" }}>
        <style>{`@keyframes coinReveal{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}} @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}`}</style>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(20px,3vw,48px)", fontWeight:900, color:t.accent, textShadow:`0 0 40px ${t.accentGlow}66`, letterSpacing:"0.08em", marginTop:36, marginBottom:10, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) both" }}>COMMENCING TOSS</div>
        <div style={{ width:"clamp(160px,30vw,360px)", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, marginBottom:18, boxShadow:`0 0 14px ${t.accentGlow}55`, animation:"rbLineIn 0.6s cubic-bezier(.22,.68,0,1.2) 0.1s both" }}/>
        <div style={{ display:"flex", gap:28, fontFamily:t.fontMono, fontSize:39, color:t.textMuted, marginBottom:20, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.12s both" }}>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PENTA" size={26}/><span>PENTA = {p1Name}</span></span>
          <span style={{ color:t.border }}>|</span>
          <span style={{ display:"flex", alignItems:"center", gap:8 }}><CoinFace type="PROTO" size={26}/><span>PROTO = {p2Name}</span></span>
        </div>

        <div style={{ width:"100%", height:"50vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", flexShrink:0, perspective:800 }}>
          <div style={{ position:"absolute", width:coinDiam*2.4, height:coinDiam*2.4, borderRadius:"50%", background:revealed?`radial-gradient(circle, ${winCol}28 0%, transparent 68%)`:`radial-gradient(circle, ${t.accent}14 0%, transparent 68%)`, transition:"background 0.6s ease", pointerEvents:"none" }}/>
          {!revealed && [1,1.5,2].map((scale,i) => (<div key={i} style={{ position:"absolute", width:coinDiam*scale, height:coinDiam*scale, borderRadius:"50%", border:`1px solid ${t.accent}${["18","10","08"][i]}`, animation:`spinRing ${2+i*0.4}s linear infinite`, pointerEvents:"none" }}/>))}
          {revealed ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:18, animation:"coinReveal 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ borderRadius:"50%", boxShadow:`0 0 90px ${winCol}66, 0 0 40px ${winCol}33, 0 20px 60px rgba(0,0,0,0.7)` }}><CoinFace type={revType} size={coinDiam}/></div>
              <span style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:800, color:winCol, letterSpacing:"0.14em", textShadow:`0 0 32px ${winCol}99`, animation:"fadeUp 0.4s cubic-bezier(.22,.68,0,1.2) 0.18s both" }}>{revType}</span>
            </div>
          ) : (
            <div style={{ width:coinDiam, height:coinDiam, borderRadius:"50%", overflow:"hidden", background:spinBg, transform:`scaleX(${spinScaleX})`, willChange:"transform", boxShadow:"0 12px 48px rgba(0,0,0,0.65)", transition:"background 0.05s" }}>
              <img src={spinSrc} alt={spinIsPenta?"PENTA":"PROTO"} style={{ width:"100%", height:"100%", display:"block", objectFit:"cover" }}/>
            </div>
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

  // ── toss choice phases ─────────────────────────────────────────────────────
  const tossChoicePhases: Phase[] = ["rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser"];
  if (tossChoicePhases.includes(phase)) {
    const winCol   = tossWinner === "P1" ? p1c : p2c;
    const loseCol  = tossLoser  === "P1" ? p1c : p2c;
    let title="", leftLabel="", rightLabel="", actor="", actorCol=winCol;
    if (phase==="rule_choice")      { title=`${nameOf(tossWinner!)} WON THE TOSS — CHOOSE YOUR RULE`; leftLabel="DECIDE WHO\nPLAYS FIRST"; rightLabel="BLOCK C3\nFIRST MOVE"; actor=nameOf(tossWinner!); actorCol=winCol; }
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
            {phase === "who_first_loser" && winnerPickedC3 !== null && (
              <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:winCol }}>C3: {winnerPickedC3 ? "BLOCKED" : "ALLOWED"}</div>
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

  // ── toss_summary ───────────────────────────────────────────────────────────
  if (phase === "toss_summary") {
    const fp = firstPlayerChosen ?? tossWinner ?? "P1";
    const winnerPickedFirstTurn = winnerPickedRule === "first";
    const winnerChoice = winnerPickedFirstTurn
      ? `PLAYS FIRST:\n${fp}`
      : `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`;
    const loserChoice = winnerPickedFirstTurn
      ? `C3: ${rbC3Blocked ? "BLOCKED" : "ALLOWED"}`
      : `PLAYS FIRST:\n${fp}`;

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
            
            // Only show rank icons in multiplayer, and only when we actually know each player's ELO.
            const playerElo = isMultiplayerGame ? (p === "P1" ? p1Elo : p2Elo) : undefined;
            const getRankData = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[RANKS.length - 1];
            const rank = (typeof playerElo === "number") ? getRankData(playerElo) : null;

            const isWhoFirst = choice.includes("PLAYS FIRST");
            const firstSlot = choice.includes("P1") ? "P1" : "P2";

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
                    <div style={{ width: 120, height: 120, filter: `drop-shadow(0 0 20px ${col}44)` }}>
                      <RankIcon rank={rank} size={120} />
                    </div>
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
  {isWhoFirst ? (
    <>
      <div style={{ fontFamily:t.fontMono, fontSize:14, color:t.textMuted, textTransform:"uppercase" }}>
        Plays First
      </div>
      <div style={{
        fontFamily:t.fontDisplay,
        fontSize:32,
        fontWeight:900,
        color:firstSlot === "P1" ? p1c : p2c,
        letterSpacing:"0.05em"
      }}>
        {nameOf(firstSlot)}
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
