"use client";
import React from "react";
import { Piece } from "./GamePieces";
import type { Phase } from "./GamePieces";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatchSidebarProps {
  // theme
  t: {
    bg: string; accent: string; accentGlow: string; fontDisplay: string; fontMono: string;
    fontBody: string; textMuted: string; textSecondary: string; text: string; border: string;
    bgCard: string; bgPanel: string; gold: string; danger: string; inputBg: string;
    pieces: { p1: string; p2: string };
  };
  ip: boolean;
  p1c: string;
  p2c: string;
  panelW: number;
  // game state
  phase: Phase;
  winner: string | null;
  current: string;
  gameNumber: number;
  matchHistory: string[];
  seriesWinner: string | null;
  matchOver: boolean;
  gameMode: string;
  isRankedGame: boolean;
  isMultiplayerGame: boolean;
  isMultiplayer: boolean;
  mySlot: "P1" | "P2";
  // timers
  p1Time: number;
  p2Time: number;
  readyTimeout: number;
  // ready
  p1Ready: boolean;
  p2Ready: boolean;
  // chat
  chatMessages: { from: "P1" | "P2"; text: string; ts: number }[];
  chatInput: string;
  chatOpen: boolean;
  chatWarning: boolean;
  // log
  log: { text: string; player: string }[];
  // bot
  botThinking: boolean;
  // overlays
  showWinOverlay: boolean;
  overlayVisible: boolean;
  winnerColor: string;
  winnerPiece: string;
  seriesDiffers: boolean;
  seriesColor: string;
  seriesPiece: string;
  showRematch: boolean;
  rematchRequested: string | null;
  showSurrender: boolean;
  showExitConfirm: boolean;
  setScreen?: (s: string) => void;
  // handlers
  onReadyToggle: (player: "P1" | "P2") => void;
  onSendChat: (from: "P1" | "P2") => void;
  onChatInputChange: (v: string) => void;
  onChatKeyDown: (e: React.KeyboardEvent) => void;
  onChatOpenToggle: () => void;
  onSoftReset: () => void;
  onDismissOverlay: () => void;
  onRematch: () => void;
  onQuitMatch: () => void;
  onSurrenderConfirm: () => void;
  onSurrenderCancel: () => void;
  onExitConfirm: () => void;
  onExitCancel: () => void;
  onShowSurrender: () => void;
  onShowExitConfirm: () => void;
  fmtTime: (ms: number) => string;
  playHover?: () => void;
  playClick?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatchSidebar({
  t, ip, p1c, p2c, panelW,
  phase, winner, current, gameNumber, matchHistory, seriesWinner, matchOver,
  gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot,
  p1Time, p2Time, readyTimeout,
  p1Ready, p2Ready,
  chatMessages, chatInput, chatOpen, chatWarning,
  log, botThinking,
  showWinOverlay, overlayVisible, winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece,
  showRematch, rematchRequested,
  showSurrender, showExitConfirm, setScreen,
  onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
  onSoftReset, onDismissOverlay, onRematch, onQuitMatch,
  onSurrenderConfirm, onSurrenderCancel, onExitConfirm, onExitCancel,
  onShowSurrender, onShowExitConfirm,
  fmtTime, playHover, playClick,
}: MatchSidebarProps) {

  // ── Win overlay ────────────────────────────────────────────────────────────
  const winOverlay = showWinOverlay && winner && (
    <div onClick={onDismissOverlay} style={{ position:"fixed", inset:0, zIndex:999, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"stretch", willChange:"opacity", opacity:overlayVisible?1:0, transition:"opacity 0.28s ease" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.92)", zIndex:0 }}/>
      {seriesDiffers ? (
        <>
          <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderBottom:"1px solid #ffffff14", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0)":"translateY(28px)", transition:"opacity 0.32s ease 0.08s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.08s" }}>
            <div style={{ fontSize:"clamp(44px,7vw,96px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,6.5vw,90px)", fontWeight:900, color:winnerColor, lineHeight:1, textShadow:`0 0 60px ${winnerColor}88`, animation:"winPulse 1.6s ease infinite" }}>{winner==="DRAW"?"DRAW":`${winner} WINS!`}</div>
            <div style={{ fontFamily:t.fontMono, fontSize:"clamp(11px,1.2vw,14px)", color:"#777", marginTop:12, letterSpacing:"0.12em" }}>GAME {gameNumber}</div>
          </div>
          <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0)":"translateY(28px)", transition:"opacity 0.32s ease 0.18s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.18s" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:"clamp(11px,1.2vw,14px)", color:"#777", marginBottom:12, letterSpacing:"0.12em" }}>SERIES WINNER</div>
            <div style={{ fontSize:"clamp(44px,7vw,96px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{seriesPiece}</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,6.5vw,90px)", fontWeight:900, color:seriesColor, lineHeight:1, textShadow:`0 0 60px ${seriesColor}88`, animation:"winPulse 1.6s ease infinite" }}>{seriesWinner} WINS!</div>
            <div style={{ fontFamily:t.fontBody, fontSize:13, color:"#555", marginTop:16 }}>click anywhere to continue</div>
          </div>
        </>
      ) : (
        <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0) scale(1)":"translateY(32px) scale(0.96)", transition:"opacity 0.32s ease 0.06s, transform 0.35s cubic-bezier(.22,.68,0,1.2) 0.06s" }}>
          <div style={{ fontSize:"clamp(52px,8vw,110px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(44px,7vw,100px)", fontWeight:900, color:winnerColor, lineHeight:1, marginBottom:18, textShadow:`0 0 60px ${winnerColor}88`, animation:"winPulse 1.6s ease infinite" }}>{winner==="DRAW"?"DRAW":`${winner} WINS!`}</div>
          {phase==="match_over" ? <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>MATCH OVER — SERIES COMPLETE</div> : <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>GAME {gameNumber} COMPLETE</div>}
          <div style={{ fontFamily:t.fontBody, fontSize:14, color:"#666" }}>click anywhere to continue</div>
        </div>
      )}
    </div>
  );

  // ── Left panel ─────────────────────────────────────────────────────────────
  const leftPanel = (
    <div style={{ width:panelW, flexShrink:0, background:t.bgPanel, borderRight:`${ip?3:1}px solid ${t.border}`, padding:"18px 18px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>
      <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em" }}>MATCH TIMER</div>
      {(["P1","P2"] as const).map(p => (
        <div key={p} style={{ padding:"12px 14px", background:phase==="playing"&&current===p?`${p==="P1"?p1c:p2c}22`:t.bgCard, border:`1px solid ${phase==="playing"&&current===p?(p==="P1"?p1c:p2c):t.border}`, borderRadius:ip?2:8, display:"flex", justifyContent:"space-between", alignItems:"center", transition:"background 0.25s, border-color 0.25s" }}>
          <span style={{ fontFamily:t.fontBody, fontSize:16, color:p==="P1"?p1c:p2c, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}><Piece symbol={p==="P1"?t.pieces.p1:t.pieces.p2} color={p==="P1"?p1c:p2c} size={16}/> {p}</span>
          <span style={{ fontFamily:t.fontMono, fontSize:18, color:t.text, fontWeight:700 }}>{p==="P1"?fmtTime(p1Time):fmtTime(p2Time)}</span>
        </div>
      ))}
      {gameMode === "ai" && botThinking && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:`${t.accent}12`, border:`1px solid ${t.accent}44`, borderRadius:ip?2:8, animation:"fadeUp 0.3s ease both" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:t.accent, boxShadow:`0 0 8px ${t.accentGlow}`, animation:"botPulse 0.8s ease-in-out infinite" }}/>
          <span style={{ fontFamily:t.fontMono, fontSize:13, color:t.accent, fontWeight:700, letterSpacing:"0.1em" }}>BOT THINKING...</span>
        </div>
      )}
      <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:12 }}>
        <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em", marginBottom:10 }}>MATCH HISTORY</div>
        {[0,1,2].map(i => {
          const result = matchHistory[i] ?? "";
          const col = result==="P1"?p1c:result==="P2"?p2c:result==="DRAW"?t.gold:t.textMuted;
          const isCur = i===gameNumber-1&&(phase==="playing"||phase==="waiting_ready");
          return (<div key={i} style={{ display:"flex", justifyContent:"space-between", fontFamily:t.fontBody, fontSize:22, padding:"6px 0", borderBottom:`1px solid ${t.border}22` }}><span style={{ color:isCur?t.accent:t.textMuted, transition:"color 0.2s" }}>G{i+1}{isCur?" ◄":""}</span><span style={{ color:col, fontWeight:result?700:400, transition:"color 0.2s" }}>{result||"—"}</span></div>);
        })}
        {seriesWinner && (<div style={{ marginTop:10, fontFamily:t.fontMono, fontSize:20, color:t.gold, textAlign:"center", fontWeight:700 }}>SERIES: {seriesWinner==="DRAW"?"DRAW":seriesWinner+" WINS"}</div>)}
      </div>
      {phase==="waiting_ready" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily:t.fontMono, fontSize:28, fontWeight:700, color:t.accent, textAlign:"center" }}>{Math.ceil(readyTimeout)}s</div>
          {(["P1","P2"] as const).map(p => {
            const rdy = p==="P1"?p1Ready:p2Ready;
            const col = p==="P1"?p1c:p2c;
            return (
              <button key={p} onClick={() => onReadyToggle(p)}
                style={{ background:rdy?`${col}22`:"#AA000022", border:`2px solid ${rdy?col:"#AA0000"}`, color:rdy?col:"#EE0000", fontFamily:t.fontMono, fontSize:15, fontWeight:700, padding:"12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", boxShadow:rdy?`0 0 16px ${col}55, 0 0 4px ${col}33`:"none" }}
                onMouseEnter={e=>{playHover?.();e.currentTarget.style.boxShadow=rdy?`0 0 24px ${col}88`:"0 0 16px #EE000055";e.currentTarget.style.borderColor=rdy?col:"#FF3333";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=rdy?`0 0 16px ${col}55`:"none";e.currentTarget.style.borderColor=rdy?col:"#AA0000";}}
              >{p} {rdy?"✓ READY":"NOT READY"}</button>
            );
          })}
        </div>
      )}
      {phase==="match_over" && !isMultiplayerGame && (
        <div style={{ textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:t.gold, marginBottom:10 }}>{seriesWinner==="DRAW"?"DRAW!":seriesWinner+" WINS!"}</div>
          <button onClick={onSoftReset} style={{ background:`${t.accent}18`, border:`1px solid ${t.accent}`, color:t.accent, fontFamily:t.fontMono, fontSize:13, padding:"10px 18px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ NEW MATCH</button>
        </div>
      )}
      {(phase==="playing"||phase==="waiting_ready") && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:"auto", borderTop:`1px solid ${t.border}`, paddingTop:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:17, fontWeight:700, color:t.text, letterSpacing:"0.12em" }}>CHAT</div>
            <button onClick={onChatOpenToggle} style={{ background:"none", border:"none", color:t.text, fontFamily:t.fontMono, fontSize:16, cursor:"pointer", padding:"2px 6px" }}>{chatOpen?"▾":"▸"}</button>
          </div>
          {chatOpen && (
            <>
              <div style={{ height:160, overflowY:"auto", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:ip?2:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                {chatMessages.length===0 && (<div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, textAlign:"center", marginTop:24 }}>No messages yet</div>)}
                {chatMessages.map((m,i) => (<div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start" }}><span style={{ fontFamily:t.fontMono, fontSize:14, fontWeight:700, color:m.from==="P1"?p1c:p2c, flexShrink:0 }}>{m.from}:</span><span style={{ fontFamily:t.fontBody, fontSize:14, color:t.text, wordBreak:"break-word" as const }}>{m.text}</span></div>))}
              </div>
              {chatWarning && (<div style={{ padding:"8px 12px", background:"#F4433618", border:"1px solid #F44336", borderRadius:6, fontFamily:t.fontBody, fontSize:13, color:"#F44336" }}>⚠ Inappropriate language detected and censored.</div>)}
              <div style={{ display:"flex", gap:6 }}>
                <input value={chatInput} onChange={e=>onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:ip?2:6, color:t.text, fontFamily:t.fontBody, fontSize:14, padding:"8px 10px", outline:"none", minWidth:0 }}/>
                {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={()=>onSendChat("P1")} style={{ background:`${p1c}20`, border:`1px solid ${p1c}`, color:p1c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p1c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p1c}20`;e.currentTarget.style.color=p1c;}}>P1</button>)}
                {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={()=>onSendChat("P2")} style={{ background:`${p2c}20`, border:`1px solid ${p2c}`, color:p2c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p2c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p2c}20`;e.currentTarget.style.color=p2c;}}>P2</button>)}
              </div>
            </>
          )}
        </div>
      )}
      {(phase==="playing"||phase==="waiting_ready") && (
        isRankedGame ? (
          <button onClick={onShowSurrender} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>⚑ SURRENDER</button>
        ) : isMultiplayer ? null : (
          <button onClick={onSoftReset} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ RESET</button>
        )
      )}
    </div>
  );

  // ── Right panel ────────────────────────────────────────────────────────────
  const rightPanel = (
    <div style={{ width:panelW, flexShrink:0, background:t.bgPanel, borderLeft:`${ip?3:1}px solid ${t.border}`, padding:"18px 18px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
      <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em" }}>MOVE LOG</div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
        {log.length===0 ? <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, fontStyle:"italic" }}>No moves yet</div> : log.map((m,i) => <div key={i} style={{ fontFamily:t.fontMono, fontSize:15, color:m.player==="P1"?p1c:p2c, padding:"3px 0", borderBottom:`1px solid ${t.border}22` }}>{m.text}</div>)}
      </div>
      {setScreen && !isRankedGame && (phase==="playing"||phase==="waiting_ready"||phase==="match_over") && (
        <button onClick={onShowExitConfirm} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", marginTop:4 }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>✕ EXIT MATCH</button>
      )}
    </div>
  );

  // ── Rematch overlay ────────────────────────────────────────────────────────
  const rematchOverlay = showRematch && isMultiplayerGame && (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.3s ease both" }}>
      <div style={{ background:t.bgPanel, border:`2px solid ${t.accent}`, borderRadius:ip?2:20, padding:"48px 56px", maxWidth:480, width:"90vw", textAlign:"center", boxShadow:`0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.accent}22`, animation:"scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:900, color:t.accent, marginBottom:8, letterSpacing:"0.08em" }}>MATCH COMPLETE</div>
        <div style={{ fontFamily:t.fontMono, fontSize:18, fontWeight:700, color:seriesWinner==="P1"?p1c:seriesWinner==="P2"?p2c:t.gold, marginBottom:6 }}>
          {seriesWinner === "DRAW" ? "DRAW!" : `${seriesWinner} WINS THE SERIES`}
        </div>
        {rematchRequested && rematchRequested !== mySlot && (
          <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.gold, marginBottom:16 }}>⚡ Opponent wants a rematch!</div>
        )}
        {rematchRequested === mySlot && (
          <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, marginBottom:16 }}>⏳ Waiting for opponent...</div>
        )}
        {!rematchRequested && <div style={{ marginBottom:16 }}/>}
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button
            onClick={onRematch}
            disabled={rematchRequested === mySlot}
            style={{ background:rematchRequested===mySlot?`${t.accent}10`:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:rematchRequested===mySlot?"default":"pointer", opacity:rematchRequested===mySlot?0.5:1, transition:"all 0.2s" }}
            onMouseEnter={e=>{ if(rematchRequested!==mySlot){e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";} }}
            onMouseLeave={e=>{ e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent; }}
          >↺ REMATCH</button>
          <button
            onClick={onQuitMatch}
            style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:"pointer", transition:"all 0.2s" }}
            onMouseEnter={e=>{e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;}}
          >✕ QUIT</button>
        </div>
      </div>
    </div>
  );

  // ── Surrender confirm ──────────────────────────────────────────────────────
  const surrenderModal = showSurrender && (
    <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:2}px solid ${t.danger}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:`0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize:44, marginBottom:20 }}>⚑</div>
        <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.danger, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to forfeit this Match?</div>
        <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>{isRankedGame?<>This counts as a <span style={{color:t.danger,fontWeight:700}}>forfeit</span> and will result in <span style={{color:t.danger,fontWeight:700}}>ELO deduction</span>.</>:"Your opponent will be declared the winner."}</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button className="action-btn" onClick={onSurrenderConfirm} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES, FORFEIT</button>
          <button className="action-btn" onClick={onSurrenderCancel} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO, STAY</button>
        </div>
      </div>
    </div>
  );

  // ── Exit confirm ───────────────────────────────────────────────────────────
  const exitModal = showExitConfirm && (
    <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:1}px solid ${t.border}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:"0 40px 100px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize:44, marginBottom:20 }}>⚠️</div>
        <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.text, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to quit the current session?</div>
        <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>Current game progress will be lost.</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button className="action-btn" onClick={onExitConfirm} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES</button>
          <button className="action-btn" onClick={onExitCancel} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {winOverlay}
      {leftPanel}
      {/* Board slot — children passed in from GameScreen */}
      {/* Right panel and overlays rendered by GameScreen after board */}
    </>
  );
}

// ─── Separate named exports so GameScreen can render panels individually ──────

export function LeftPanel(props: MatchSidebarProps) {
  const { t, ip, p1c, p2c, panelW, phase, current, gameNumber, matchHistory, seriesWinner,
    gameMode, isRankedGame, isMultiplayerGame, isMultiplayer, mySlot,
    p1Time, p2Time, readyTimeout, p1Ready, p2Ready,
    chatMessages, chatInput, chatOpen, chatWarning, botThinking,
    onReadyToggle, onSendChat, onChatInputChange, onChatKeyDown, onChatOpenToggle,
    onSoftReset, onShowSurrender, fmtTime, playHover } = props;

  return (
    <div style={{ width:panelW, flexShrink:0, background:t.bgPanel, borderRight:`${ip?3:1}px solid ${t.border}`, padding:"18px 18px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>
      <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em" }}>MATCH TIMER</div>
      {(["P1","P2"] as const).map(p => (
        <div key={p} style={{ padding:"12px 14px", background:phase==="playing"&&current===p?`${p==="P1"?p1c:p2c}22`:t.bgCard, border:`1px solid ${phase==="playing"&&current===p?(p==="P1"?p1c:p2c):t.border}`, borderRadius:ip?2:8, display:"flex", justifyContent:"space-between", alignItems:"center", transition:"background 0.25s, border-color 0.25s" }}>
          <span style={{ fontFamily:t.fontBody, fontSize:16, color:p==="P1"?p1c:p2c, fontWeight:700, display:"flex", alignItems:"center", gap:4 }}><Piece symbol={p==="P1"?t.pieces.p1:t.pieces.p2} color={p==="P1"?p1c:p2c} size={16}/> {p}</span>
          <span style={{ fontFamily:t.fontMono, fontSize:18, color:t.text, fontWeight:700 }}>{p==="P1"?fmtTime(p1Time):fmtTime(p2Time)}</span>
        </div>
      ))}
      {gameMode === "ai" && botThinking && (
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:`${t.accent}12`, border:`1px solid ${t.accent}44`, borderRadius:ip?2:8, animation:"fadeUp 0.3s ease both" }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:t.accent, boxShadow:`0 0 8px ${t.accentGlow}`, animation:"botPulse 0.8s ease-in-out infinite" }}/>
          <span style={{ fontFamily:t.fontMono, fontSize:13, color:t.accent, fontWeight:700, letterSpacing:"0.1em" }}>BOT THINKING...</span>
        </div>
      )}
      <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:12 }}>
        <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em", marginBottom:10 }}>MATCH HISTORY</div>
        {[0,1,2].map(i => {
          const result = matchHistory[i] ?? "";
          const col = result==="P1"?p1c:result==="P2"?p2c:result==="DRAW"?t.gold:t.textMuted;
          const isCur = i===gameNumber-1&&(phase==="playing"||phase==="waiting_ready");
          return (<div key={i} style={{ display:"flex", justifyContent:"space-between", fontFamily:t.fontBody, fontSize:22, padding:"6px 0", borderBottom:`1px solid ${t.border}22` }}><span style={{ color:isCur?t.accent:t.textMuted, transition:"color 0.2s" }}>G{i+1}{isCur?" ◄":""}</span><span style={{ color:col, fontWeight:result?700:400, transition:"color 0.2s" }}>{result||"—"}</span></div>);
        })}
        {seriesWinner && (<div style={{ marginTop:10, fontFamily:t.fontMono, fontSize:20, color:t.gold, textAlign:"center", fontWeight:700 }}>SERIES: {seriesWinner==="DRAW"?"DRAW":seriesWinner+" WINS"}</div>)}
      </div>
      {phase==="waiting_ready" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.12em" }}>READY TO PLAY</div>
          <div style={{ fontFamily:t.fontMono, fontSize:28, fontWeight:700, color:t.accent, textAlign:"center" }}>{Math.ceil(readyTimeout)}s</div>
          {(["P1","P2"] as const).map(p => {
            const rdy = p==="P1"?p1Ready:p2Ready;
            const col = p==="P1"?p1c:p2c;
            return (
              <button key={p} onClick={() => onReadyToggle(p)}
                style={{ background:rdy?`${col}22`:"#AA000022", border:`2px solid ${rdy?col:"#AA0000"}`, color:rdy?col:"#EE0000", fontFamily:t.fontMono, fontSize:15, fontWeight:700, padding:"12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", boxShadow:rdy?`0 0 16px ${col}55, 0 0 4px ${col}33`:"none" }}
                onMouseEnter={e=>{playHover?.();e.currentTarget.style.boxShadow=rdy?`0 0 24px ${col}88`:"0 0 16px #EE000055";e.currentTarget.style.borderColor=rdy?col:"#FF3333";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow=rdy?`0 0 16px ${col}55`:"none";e.currentTarget.style.borderColor=rdy?col:"#AA0000";}}
              >{p} {rdy?"✓ READY":"NOT READY"}</button>
            );
          })}
        </div>
      )}
      {phase==="match_over" && !isMultiplayerGame && (
        <div style={{ textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
          <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:t.gold, marginBottom:10 }}>{seriesWinner==="DRAW"?"DRAW!":seriesWinner+" WINS!"}</div>
          <button onClick={onSoftReset} style={{ background:`${t.accent}18`, border:`1px solid ${t.accent}`, color:t.accent, fontFamily:t.fontMono, fontSize:13, padding:"10px 18px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ NEW MATCH</button>
        </div>
      )}
      {(phase==="playing"||phase==="waiting_ready") && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:"auto", borderTop:`1px solid ${t.border}`, paddingTop:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:17, fontWeight:700, color:t.text, letterSpacing:"0.12em" }}>CHAT</div>
            <button onClick={onChatOpenToggle} style={{ background:"none", border:"none", color:t.text, fontFamily:t.fontMono, fontSize:16, cursor:"pointer", padding:"2px 6px" }}>{chatOpen?"▾":"▸"}</button>
          </div>
          {chatOpen && (
            <>
              <div style={{ height:160, overflowY:"auto", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:ip?2:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                {chatMessages.length===0 && (<div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, textAlign:"center", marginTop:24 }}>No messages yet</div>)}
                {chatMessages.map((m,i) => (<div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start" }}><span style={{ fontFamily:t.fontMono, fontSize:14, fontWeight:700, color:m.from==="P1"?p1c:p2c, flexShrink:0 }}>{m.from}:</span><span style={{ fontFamily:t.fontBody, fontSize:14, color:t.text, wordBreak:"break-word" as const }}>{m.text}</span></div>))}
              </div>
              {chatWarning && (<div style={{ padding:"8px 12px", background:"#F4433618", border:"1px solid #F44336", borderRadius:6, fontFamily:t.fontBody, fontSize:13, color:"#F44336" }}>⚠ Inappropriate language detected and censored.</div>)}
              <div style={{ display:"flex", gap:6 }}>
                <input value={chatInput} onChange={e=>onChatInputChange(e.target.value)} onKeyDown={onChatKeyDown} placeholder="message…" maxLength={60} style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:ip?2:6, color:t.text, fontFamily:t.fontBody, fontSize:14, padding:"8px 10px", outline:"none", minWidth:0 }}/>
                {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={()=>onSendChat("P1")} style={{ background:`${p1c}20`, border:`1px solid ${p1c}`, color:p1c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p1c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p1c}20`;e.currentTarget.style.color=p1c;}}>P1</button>)}
                {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={()=>onSendChat("P2")} style={{ background:`${p2c}20`, border:`1px solid ${p2c}`, color:p2c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p2c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p2c}20`;e.currentTarget.style.color=p2c;}}>P2</button>)}
              </div>
            </>
          )}
        </div>
      )}
      {(phase==="playing"||phase==="waiting_ready") && (
        isRankedGame ? (
          <button onClick={onShowSurrender} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>⚑ SURRENDER</button>
        ) : isMultiplayer ? null : (
          <button onClick={onSoftReset} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ RESET</button>
        )
      )}
    </div>
  );
}

export function RightPanel({ t, ip, p1c, p2c, panelW, phase, log, isRankedGame, setScreen, onShowExitConfirm, playHover }: {
  t: MatchSidebarProps["t"]; ip: boolean; p1c: string; p2c: string; panelW: number;
  phase: Phase; log: { text: string; player: string }[]; isRankedGame: boolean;
  setScreen?: (s: string) => void; onShowExitConfirm: () => void; playHover?: () => void;
}) {
  return (
    <div style={{ width:panelW, flexShrink:0, background:t.bgPanel, borderLeft:`${ip?3:1}px solid ${t.border}`, padding:"18px 18px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
      <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em" }}>MOVE LOG</div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
        {log.length===0 ? <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, fontStyle:"italic" }}>No moves yet</div> : log.map((m,i) => <div key={i} style={{ fontFamily:t.fontMono, fontSize:15, color:m.player==="P1"?p1c:p2c, padding:"3px 0", borderBottom:`1px solid ${t.border}22` }}>{m.text}</div>)}
      </div>
      {setScreen && !isRankedGame && (phase==="playing"||phase==="waiting_ready"||phase==="match_over") && (
        <button onClick={onShowExitConfirm} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", marginTop:4 }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>✕ EXIT MATCH</button>
      )}
    </div>
  );
}

export function WinOverlay({ showWinOverlay, overlayVisible, winner, winnerColor, winnerPiece, seriesDiffers, seriesColor, seriesPiece, seriesWinner, phase, gameNumber, t, onDismiss }: {
  showWinOverlay: boolean; overlayVisible: boolean; winner: string | null; winnerColor: string; winnerPiece: string;
  seriesDiffers: boolean; seriesColor: string; seriesPiece: string; seriesWinner: string | null;
  phase: Phase; gameNumber: number; t: { fontDisplay: string; fontMono: string; fontBody: string };
  onDismiss: () => void;
}) {
  if (!showWinOverlay || !winner) return null;
  return (
    <div onClick={onDismiss} style={{ position:"fixed", inset:0, zIndex:999, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"stretch", willChange:"opacity", opacity:overlayVisible?1:0, transition:"opacity 0.28s ease" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.92)", zIndex:0 }}/>
      {seriesDiffers ? (
        <>
          <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderBottom:"1px solid #ffffff14", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0)":"translateY(28px)", transition:"opacity 0.32s ease 0.08s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.08s" }}>
            <div style={{ fontSize:"clamp(44px,7vw,96px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,6.5vw,90px)", fontWeight:900, color:winnerColor, lineHeight:1, textShadow:`0 0 60px ${winnerColor}88`, animation:"winPulse 1.6s ease infinite" }}>{winner==="DRAW"?"DRAW":`${winner} WINS!`}</div>
            <div style={{ fontFamily:t.fontMono, fontSize:"clamp(11px,1.2vw,14px)", color:"#777", marginTop:12, letterSpacing:"0.12em" }}>GAME {gameNumber}</div>
          </div>
          <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0)":"translateY(28px)", transition:"opacity 0.32s ease 0.18s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.18s" }}>
            <div style={{ fontFamily:t.fontMono, fontSize:"clamp(11px,1.2vw,14px)", color:"#777", marginBottom:12, letterSpacing:"0.12em" }}>SERIES WINNER</div>
            <div style={{ fontSize:"clamp(44px,7vw,96px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{seriesPiece}</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,6.5vw,90px)", fontWeight:900, color:seriesColor, lineHeight:1, textShadow:`0 0 60px ${seriesColor}88`, animation:"winPulse 1.6s ease infinite" }}>{seriesWinner} WINS!</div>
            <div style={{ fontFamily:t.fontBody, fontSize:13, color:"#555", marginTop:16 }}>click anywhere to continue</div>
          </div>
        </>
      ) : (
        <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0) scale(1)":"translateY(32px) scale(0.96)", transition:"opacity 0.32s ease 0.06s, transform 0.35s cubic-bezier(.22,.68,0,1.2) 0.06s" }}>
          <div style={{ fontSize:"clamp(52px,8vw,110px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(44px,7vw,100px)", fontWeight:900, color:winnerColor, lineHeight:1, marginBottom:18, textShadow:`0 0 60px ${winnerColor}88`, animation:"winPulse 1.6s ease infinite" }}>{winner==="DRAW"?"DRAW":`${winner} WINS!`}</div>
          {phase==="match_over" ? <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>MATCH OVER — SERIES COMPLETE</div> : <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>GAME {gameNumber} COMPLETE</div>}
          <div style={{ fontFamily:t.fontBody, fontSize:14, color:"#666" }}>click anywhere to continue</div>
        </div>
      )}
    </div>
  );
}

export function RematchOverlay({ show, isMultiplayerGame, t, ip, p1c, p2c, seriesWinner, mySlot, rematchRequested, onRematch, onQuitMatch }: {
  show: boolean; isMultiplayerGame: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  p1c: string; p2c: string; seriesWinner: string | null; mySlot: "P1"|"P2";
  rematchRequested: string | null; onRematch: () => void; onQuitMatch: () => void;
}) {
  if (!show || !isMultiplayerGame) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.3s ease both" }}>
      <div style={{ background:t.bgPanel, border:`2px solid ${t.accent}`, borderRadius:ip?2:20, padding:"48px 56px", maxWidth:480, width:"90vw", textAlign:"center", boxShadow:`0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.accent}22`, animation:"scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ fontFamily:t.fontDisplay, fontSize:28, fontWeight:900, color:t.accent, marginBottom:8, letterSpacing:"0.08em" }}>MATCH COMPLETE</div>
        <div style={{ fontFamily:t.fontMono, fontSize:18, fontWeight:700, color:seriesWinner==="P1"?p1c:seriesWinner==="P2"?p2c:t.gold, marginBottom:6 }}>
          {seriesWinner === "DRAW" ? "DRAW!" : `${seriesWinner} WINS THE SERIES`}
        </div>
        {rematchRequested && rematchRequested !== mySlot && (<div style={{ fontFamily:t.fontBody, fontSize:14, color:t.gold, marginBottom:16 }}>⚡ Opponent wants a rematch!</div>)}
        {rematchRequested === mySlot && (<div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, marginBottom:16 }}>⏳ Waiting for opponent...</div>)}
        {!rematchRequested && <div style={{ marginBottom:16 }}/>}
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button onClick={onRematch} disabled={rematchRequested === mySlot}
            style={{ background:rematchRequested===mySlot?`${t.accent}10`:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:rematchRequested===mySlot?"default":"pointer", opacity:rematchRequested===mySlot?0.5:1, transition:"all 0.2s" }}
            onMouseEnter={e=>{ if(rematchRequested!==mySlot){e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";} }}
            onMouseLeave={e=>{ e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent; }}
          >↺ REMATCH</button>
          <button onClick={onQuitMatch}
            style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:"pointer", transition:"all 0.2s" }}
            onMouseEnter={e=>{e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";}}
            onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;}}
          >✕ QUIT</button>
        </div>
      </div>
    </div>
  );
}

export function SurrenderModal({ show, t, ip, isRankedGame, onConfirm, onCancel, playHover }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean; isRankedGame: boolean;
  onConfirm: () => void; onCancel: () => void; playHover?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:2}px solid ${t.danger}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:`0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
        <div style={{ fontSize:44, marginBottom:20 }}>⚑</div>
        <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.danger, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to forfeit this Match?</div>
        <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>{isRankedGame?<>This counts as a <span style={{color:t.danger,fontWeight:700}}>forfeit</span> and will result in <span style={{color:t.danger,fontWeight:700}}>ELO deduction</span>.</>:"Your opponent will be declared the winner."}</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button className="action-btn" onClick={onConfirm} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES, FORFEIT</button>
          <button className="action-btn" onClick={onCancel} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO, STAY</button>
        </div>
      </div>
    </div>
  );
}

export function ExitModal({ show, t, ip, onConfirm, onCancel, playHover }: {
  show: boolean; t: MatchSidebarProps["t"]; ip: boolean;
  onConfirm: () => void; onCancel: () => void; playHover?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:1}px solid ${t.border}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:"0 40px 100px rgba(0,0,0,0.7)" }}>
        <div style={{ fontSize:44, marginBottom:20 }}>⚠️</div>
        <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.text, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to quit the current session?</div>
        <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>Current game progress will be lost.</div>
        <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
          <button className="action-btn" onClick={onConfirm} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES</button>
          <button className="action-btn" onClick={onCancel} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO</button>
        </div>
      </div>
    </div>
  );
}