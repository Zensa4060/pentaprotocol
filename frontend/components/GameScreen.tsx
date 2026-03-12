"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { ThemeId, THEMES } from "@/lib/themes";
import { checkWin, Coord } from "@/lib/winChecker";
import API from "@/lib/api";
import { censorText, containsProfanity } from "@/lib/profanity";

import type { Screen } from "@/lib/types";
import type { Difficulty } from "@/lib/botEngine";
import { loadCustomTheme } from "@/lib/customTheme";

type GameMode = "singleplayer" | "ai" | "ranked" | "unranked";
interface Props {
  themeId: ThemeId;
  setThemeId?: (t: ThemeId) => void;
  isSingleplayer?: boolean;
  gameMode?: GameMode;
  difficulty?: Difficulty;
  setScreen?: (s: Screen) => void;
  playHover?: () => void;
  playPlace?: () => void;
  playVictory?: () => void;
  playDefeat?: () => void;
  playRulebreaker?: () => void;
  playTransition?: () => void;
  playClick?: () => void;
  roomCode?: string;
  playerSlot?: "P1" | "P2";
}

type Phase =
  | "playing" | "waiting_ready" | "match_over"
  | "rb_splash" | "rb_coin"
  | "rule_choice" | "who_first_winner" | "c3_choice"
  | "c3_choice_loser" | "who_first_loser" | "toss_summary";

function Piece({ symbol, color, size }: { symbol: string; color: string; size?: string | number }) {
  if (symbol === "🛡") {
    const s = size ?? "1em";
    return (
      <svg viewBox="0 0 24 28" width={s} height={s} style={{ display:"inline-block", verticalAlign:"middle", flexShrink:0 }}>
        <path d="M12 2 L22 6 L22 14 C22 20 17 25 12 27 C7 25 2 20 2 14 L2 6 Z"
          fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span>{symbol}</span>;
}

function Embers({ count = 8 }: { count?: number }) {
  const embers = useRef(Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 90 + 5, y: 70 + Math.random() * 30,
    size: Math.random() * 1.8 + 0.8, dur: Math.random() * 3 + 3,
    delay: Math.random() * 4, opacity: Math.random() * 0.5 + 0.2,
    tint: 60 + Math.floor(Math.random() * 80),
  })));
  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }}>
      {embers.current.map(e => (
        <circle key={e.id} cx={`${e.x}%`} cy={`${e.y}%`} r={e.size} fill={`rgba(255,${e.tint},0,0.8)`}>
          <animate attributeName="cy" values={`${e.y}%;${e.y-30}%;${e.y-60}%`} dur={`${e.dur}s`} begin={`${e.delay}s`} repeatCount="indefinite"/>
          <animate attributeName="opacity" values={`${e.opacity};${e.opacity*0.5};0`} dur={`${e.dur}s`} begin={`${e.delay}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

function HeatOverlay() {
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, borderRadius:"inherit", overflow:"hidden" }}>
      {[
        { w:"55%", h:"40%", top:"40%", left:"10%", color:"rgba(255,40,0,0.06)" },
        { w:"40%", h:"50%", top:"10%", left:"55%", color:"rgba(200,20,0,0.05)" },
        { w:"50%", h:"35%", top:"60%", left:"30%", color:"rgba(255,80,0,0.07)" },
      ].map((b, i) => (
        <div key={i} style={{ position:"absolute", borderRadius:"50%", filter:"blur(35px)", width:b.w, height:b.h, background:b.color, top:b.top, left:b.left, animation:`heatDrift${i} ${12+i*4}s ease-in-out infinite alternate` }}/>
      ))}
    </div>
  );
}

function Flame({ size, cssSize }: { size?: number; cssSize?: string }) {
  const fw = cssSize ?? `${(size ?? 80) * 0.52}px`;
  return (
    <svg width={fw} height={fw} viewBox="0 0 40 40" style={{ position:"absolute", zIndex:4, filter:"drop-shadow(0 0 5px rgba(255,80,0,0.9)) drop-shadow(0 0 12px rgba(255,40,0,0.5))" }}>
      <path d="M20,36 Q8,28 10,18 Q12,12 16,10 Q14,16 18,18 Q16,10 22,4 Q24,14 28,16 Q34,18 30,28 Q28,34 20,36 Z" fill="#ff4400" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.15s" fill="freeze"/>
      </path>
      <path d="M20,34 Q12,28 14,20 Q16,16 19,16 Q17,20 20,22 Q22,16 25,18 Q29,22 26,28 Q24,32 20,34 Z" fill="#ff8800" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.15s" begin="0.05s" fill="freeze"/>
      </path>
      <path d="M20,32 Q16,28 17,23 Q19,20 20,21 Q21,20 23,23 Q24,28 20,32 Z" fill="#ffcc00" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.15s" begin="0.08s" fill="freeze"/>
      </path>
    </svg>
  );
}

function Skull({ size, cssSize }: { size?: number; cssSize?: string }) {
  const sw = cssSize ?? `${(size ?? 80) * 0.52}px`;
  return (
    <svg width={sw} height={sw} viewBox="0 0 40 40" style={{ position:"absolute", zIndex:4, filter:"drop-shadow(0 0 5px rgba(200,0,0,0.9)) drop-shadow(0 0 10px rgba(180,0,0,0.5))" }}>
      <path d="M8,24 Q8,8 20,8 Q32,8 32,24 L32,28 L8,28 Z" fill="none" stroke="#cc0000" strokeWidth="2.2" strokeDasharray="70" strokeDashoffset="70">
        <animate attributeName="stroke-dashoffset" from="70" to="0" dur="0.25s" fill="freeze"/>
      </path>
      <path d="M11,28 L11,34 L16,34 L16,30 L20,30 L20,34 L24,34 L24,30 L29,30 L29,34 L29,28" fill="none" stroke="#cc0000" strokeWidth="2.2" strokeDasharray="50" strokeDashoffset="50">
        <animate attributeName="stroke-dashoffset" from="50" to="0" dur="0.2s" begin="0.2s" fill="freeze"/>
      </path>
      <circle cx="15" cy="20" r="3.5" fill="#cc0000" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.3s" fill="freeze"/>
      </circle>
      <circle cx="25" cy="20" r="3.5" fill="#cc0000" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.3s" fill="freeze"/>
      </circle>
      <path d="M19,24 L20,26 L21,24" fill="none" stroke="#cc0000" strokeWidth="1.5" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.32s" fill="freeze"/>
      </path>
    </svg>
  );
}

function FrostCrystals() {
  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:1, opacity:0.35 }}>
      <line x1="10%" y1="10%" x2="30%" y2="30%" stroke="rgba(200,240,255,0.6)" strokeWidth="0.8"/>
      <line x1="10%" y1="10%" x2="5%"  y2="28%" stroke="rgba(200,240,255,0.5)" strokeWidth="0.6"/>
      <line x1="10%" y1="10%" x2="26%" y2="6%"  stroke="rgba(200,240,255,0.5)" strokeWidth="0.6"/>
      <line x1="80%" y1="20%" x2="65%" y2="38%" stroke="rgba(180,230,255,0.5)" strokeWidth="0.8"/>
      <line x1="80%" y1="20%" x2="92%" y2="35%" stroke="rgba(180,230,255,0.4)" strokeWidth="0.6"/>
      <line x1="30%" y1="75%" x2="45%" y2="60%" stroke="rgba(200,240,255,0.5)" strokeWidth="0.7"/>
      <line x1="30%" y1="75%" x2="18%" y2="62%" stroke="rgba(200,240,255,0.4)" strokeWidth="0.6"/>
      <line x1="75%" y1="80%" x2="88%" y2="65%" stroke="rgba(180,230,255,0.5)" strokeWidth="0.7"/>
    </svg>
  );
}

function IceOverlay() {
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, borderRadius:"inherit", overflow:"hidden" }}>
      {[
        { w:"50%", h:"40%", top:"5%",  left:"15%", c:"rgba(180,230,255,0.06)" },
        { w:"45%", h:"50%", top:"45%", left:"45%", c:"rgba(160,210,255,0.05)" },
        { w:"55%", h:"35%", top:"60%", left:"5%",  c:"rgba(200,240,255,0.06)" },
      ].map((b, i) => (
        <div key={i} style={{ position:"absolute", borderRadius:"50%", filter:"blur(28px)", width:b.w, height:b.h, background:b.c, top:b.top, left:b.left, animation:`iceD${i} ${14+i*3}s ease-in-out infinite alternate` }}/>
      ))}
    </div>
  );
}

function SnowflakePiece({ size, cssSize }: { size?: number; cssSize?: string }) {
  const fw = cssSize ?? `${(size ?? 80) * 0.52}px`;
  return (
    <svg width={fw} height={fw} viewBox="0 0 40 40" style={{ position:"absolute", zIndex:4, filter:"drop-shadow(0 0 5px rgba(200,240,255,0.9)) drop-shadow(0 0 10px rgba(160,210,255,0.5))" }}>
      {[0, 60, 120].map(a => (
        <g key={a} transform={`rotate(${a} 20 20)`}>
          <line x1="20" y1="4" x2="20" y2="36" stroke="#c8eeff" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="32">
            <animate attributeName="stroke-dashoffset" from="32" to="0" dur="0.2s" fill="freeze"/>
          </line>
          <line x1="13" y1="11" x2="27" y2="11" stroke="#c8eeff" strokeWidth="1.5" strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.18s" fill="freeze"/>
          </line>
          <line x1="13" y1="29" x2="27" y2="29" stroke="#c8eeff" strokeWidth="1.5" strokeLinecap="round" opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.18s" fill="freeze"/>
          </line>
        </g>
      ))}
      <circle cx="20" cy="20" r="3" fill="#c8eeff" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.22s" fill="freeze"/>
      </circle>
    </svg>
  );
}

function IceShardPiece({ size, cssSize }: { size?: number; cssSize?: string }) {
  const sw = cssSize ?? `${(size ?? 80) * 0.52}px`;
  return (
    <svg width={sw} height={sw} viewBox="0 0 40 40" style={{ position:"absolute", zIndex:4, filter:"drop-shadow(0 0 5px rgba(100,200,255,0.9)) drop-shadow(0 0 10px rgba(60,160,255,0.5))" }}>
      <polygon points="20,4 28,16 36,30 20,36 4,30 12,16" fill="rgba(100,200,255,0.15)" stroke="#64c8ff" strokeWidth="2.2" strokeDasharray="75" strokeDashoffset="75">
        <animate attributeName="stroke-dashoffset" from="75" to="0" dur="0.3s" fill="freeze"/>
      </polygon>
      <polygon points="20,4 28,16 36,30 20,36 4,30 12,16" fill="rgba(100,200,255,0.12)" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.28s" fill="freeze"/>
      </polygon>
      <line x1="20" y1="4" x2="20" y2="36" stroke="rgba(180,230,255,0.4)" strokeWidth="1" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.1s" begin="0.3s" fill="freeze"/>
      </line>
    </svg>
  );
}

function RedCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useFlameSkull, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useFlameSkull: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
  onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const isP1 = player === "P1";
  const ref = useRef<HTMLDivElement>(null);
  const [numSize, setNumSize] = useState(80);
  useEffect(() => { if (ref.current) setNumSize(ref.current.offsetWidth); }, [cellSize]);
  const ec = isP1 ? p1c : p2c;
  return (
    <div ref={ref} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{
        width: cellSize, height: cellSize, borderRadius: 4, position: "relative",
        cursor: canPlay ? (isHov ? "grabbing" : "grab") : "default", overflow: "hidden",
        background: blk ? "rgba(180,0,0,0.18)" : isWinCell ? (isP1 ? "rgba(70,5,0,0.97)" : "rgba(50,0,0,0.97)") : isHov && !player ? "rgba(35,7,3,0.97)" : "rgba(14,3,1,0.97)",
        border: blk ? "2px solid #AA0000" : isWinCell ? `1.5px solid ${isP1 ? "rgba(255,80,0,0.7)" : "rgba(200,0,0,0.7)"}` : isHov && !player ? "1.5px solid rgba(220,50,0,0.45)" : "1.5px solid rgba(150,20,0,0.35)",
        boxShadow: isWinCell ? `0 0 18px ${isP1 ? "rgba(255,80,0,0.5)" : "rgba(200,0,0,0.5)"}` : isHov && !player ? "0 0 10px rgba(220,40,0,0.15)" : "none",
        transition: "background 0.15s, border 0.15s, box-shadow 0.15s", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", opacity: blk ? 0.45 : 1,
        animation: isWinCell ? "redWinCellPulse 0.9s ease-in-out infinite" : "none",
      }}>
      <Embers count={4}/>
      <HeatOverlay/>
      {player === "P1" && (useFlameSkull ? <Flame size={numSize}/> : <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:ec, textShadow:`0 0 14px ${ec}88`, position:"relative", zIndex:4 }}>{pieceSymbols.p1}</span>)}
      {player === "P2" && (useFlameSkull ? <Skull size={numSize}/> : <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:ec, textShadow:`0 0 14px ${ec}88`, position:"relative", zIndex:4 }}>{pieceSymbols.p2}</span>)}
      {!player && blk && <span style={{ fontSize:"clamp(14px,2.5vmin,28px)", color:"#AA0000", position:"relative", zIndex:5 }}>✕</span>}
    </div>
  );
}

function IceCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useSnowflakeShard, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useSnowflakeShard: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
  onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const isP1 = player === "P1";
  const ref = useRef<HTMLDivElement>(null);
  const [numSize, setNumSize] = useState(80);
  useEffect(() => { if (ref.current) setNumSize(ref.current.offsetWidth); }, [cellSize]);
  const ec = isP1 ? p1c : p2c;
  return (
    <div ref={ref} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{
        width: cellSize, height: cellSize, borderRadius: 4, position: "relative",
        cursor: canPlay ? (isHov ? "grabbing" : "grab") : "default", overflow: "hidden",
        background: blk ? "rgba(0,80,160,0.18)" : isWinCell ? (isP1 ? "linear-gradient(135deg,rgba(5,25,45,0.97),rgba(2,15,30,0.99))" : "linear-gradient(135deg,rgba(8,20,40,0.97),rgba(4,12,28,0.99))") : isHov && !player ? "linear-gradient(135deg,rgba(8,18,35,0.96),rgba(4,10,22,0.98))" : "linear-gradient(135deg,rgba(5,12,25,0.96),rgba(2,7,16,0.98))",
        border: blk ? "2px solid #0066BB" : isWinCell ? `1.5px solid ${isP1 ? "rgba(200,240,255,0.65)" : "rgba(100,200,255,0.65)"}` : isHov && !player ? "1.5px solid rgba(160,220,255,0.45)" : "1.5px solid rgba(80,160,220,0.35)",
        boxShadow: isWinCell ? `0 0 18px ${isP1 ? "rgba(200,240,255,0.4)" : "rgba(100,200,255,0.4)"}` : isHov && !player ? "0 0 10px rgba(140,210,255,0.15)" : "none",
        transition: "background 0.15s, border 0.15s, box-shadow 0.15s", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", opacity: blk ? 0.45 : 1,
        animation: isWinCell ? "iceWinCellPulse 0.9s ease-in-out infinite" : "none",
      }}>
      <FrostCrystals/>
      <IceOverlay/>
      {player === "P1" && (useSnowflakeShard ? <SnowflakePiece size={numSize}/> : <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:ec, textShadow:`0 0 14px ${ec}88`, position:"relative", zIndex:4 }}>{pieceSymbols.p1}</span>)}
      {player === "P2" && (useSnowflakeShard ? <IceShardPiece size={numSize}/> : <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:ec, textShadow:`0 0 14px ${ec}88`, position:"relative", zIndex:4 }}>{pieceSymbols.p2}</span>)}
      {!player && blk && <span style={{ fontSize:"clamp(14px,2.5vmin,28px)", color:"#0066BB", position:"relative", zIndex:5 }}>✕</span>}
    </div>
  );
}

function CoinFace({ type, size = 82 }: { type: "PENTA" | "PROTO"; size?: number }) {
  const isPenta = type === "PENTA";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: isPenta ? "#ffffff" : "#0a0a0a", boxShadow: isPenta ? "inset 0 0 12px rgba(0,0,0,0.15)" : "inset 0 0 12px rgba(255,200,50,0.1)" }}>
      <img src={isPenta ? "/penta-coin.png" : "/proto-coin.png"} alt={type} width={size} height={size} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}/>
    </div>
  );
}

const PHASE_TIMERS: Partial<Record<Phase, number>> = {
  rule_choice: 30, who_first_winner: 30, c3_choice: 30, c3_choice_loser: 30, who_first_loser: 30,
};

interface TossCardProps {
  label: string; onClick: () => void; delay: number; actorCol: string; bgCard: string;
  borderCol: string; textCol: string; fontDisplay: string; ip: boolean;
}
const TossCard = React.memo(function TossCard({ label, onClick, delay, actorCol, bgCard, borderCol, textCol, fontDisplay, ip }: TossCardProps) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} className="toss-card-enter"
      style={{
        flex: 1, minHeight: 200, animationDelay: `${delay}s`,
        background: hov ? `linear-gradient(145deg, ${actorCol}18, ${bgCard})` : bgCard,
        border: `2px solid ${hov ? actorCol : borderCol}`, borderRadius: ip ? 2 : 16,
        padding: "28px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: fontDisplay, fontSize: ip ? 16 : 22, fontWeight: 700, color: hov ? actorCol : textCol,
        whiteSpace: "pre-line" as const, textAlign: "center" as const,
        transform: hov ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
        boxShadow: hov ? `0 14px 44px ${actorCol}30, 0 0 0 1px ${actorCol}22` : "none",
        transition: ["background 0.28s cubic-bezier(.22,.68,0,1.2)", "border-color 0.28s cubic-bezier(.22,.68,0,1.2)", "color 0.28s cubic-bezier(.22,.68,0,1.2)", "transform 0.28s cubic-bezier(.22,.68,0,1.2)", "box-shadow 0.28s cubic-bezier(.22,.68,0,1.2)"].join(", "),
      }}>{label}</button>
  );
});

export default function GameScreen({ themeId, setThemeId, isSingleplayer, gameMode = "singleplayer", difficulty = "medium", setScreen, roomCode, playerSlot, playHover, playPlace, playVictory, playDefeat, playRulebreaker, playTransition, playClick }: Props) {
  const t  = THEMES[themeId];
  const ip = themeId === "pixel";

  const [_ct, set_ct] = useState(() => loadCustomTheme());
  useEffect(() => {
    const sync = () => set_ct(loadCustomTheme());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);
  const boardSkin  = _ct.boardSkin  ?? "default";
  const pieceSkin  = _ct.pieceSkin  ?? "default";

  const isRedBoard        = boardSkin === "red_grid";
  const useFlameSkull     = pieceSkin === "flame_skull";
  const isIceBoard        = boardSkin === "ice_grid";
  const useSnowflakeShard = pieceSkin === "snowflake_shard";

  const PIECE_SKIN_SYMBOLS: Record<string, { p1: string; p2: string; p1c: string; p2c: string }> = {
    default:         { p1: t.pieces.p1, p2: t.pieces.p2, p1c: t.p1,      p2c: t.p2      },
    roman:           { p1: "I",         p2: "V",          p1c: "#D4AF37", p2c: "#C0C0C0" },
    rune:            { p1: "R",         p2: "T",          p1c: "#34D399", p2c: "#A78BFA" },
    symbol:          { p1: "+",         p2: "*",          p1c: "#10B981", p2c: "#60A5FA" },
    legend:          { p1: "^",         p2: "@",          p1c: "#F59E0B", p2c: "#FF3333" },
    flame_skull:     { p1: "🔥",        p2: "💀",         p1c: "#FF4400", p2c: "#AAAAAA" },
    snowflake_shard: { p1: "❄",         p2: "◆",          p1c: "#C8EEFF", p2c: "#64C8FF" },
  };
  const skinData     = PIECE_SKIN_SYMBOLS[pieceSkin] ?? PIECE_SKIN_SYMBOLS.default;
  const pieceSymbols = { p1: skinData.p1, p2: skinData.p2 };
  const p1c = pieceSkin !== "default" ? skinData.p1c : t.p1;
  const p2c = pieceSkin !== "default" ? skinData.p2c : isRedBoard ? "#FF2222" : t.p2;

  const [showSplash, setShowSplash] = useState(!!isSingleplayer);

  const isMultiplayer = gameMode === "ranked" || gameMode === "unranked";
  const isRankedGame  = gameMode === "ranked";

  const [showSurrender, setShowSurrender]     = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const pausedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const isMultiplayerGame = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
  const mySlot = playerSlot ?? "P1";
  const emptyBoard = (): (string|null)[][] => Array(5).fill(null).map(() => Array(5).fill(null));

  const [board, setBoard]                   = useState<(string|null)[][]>(emptyBoard());
  const [current, setCurrent]               = useState("P1");
  const [winner, setWinner]                 = useState<string|null>(null);
  const [winLine, setWinLine]               = useState<Coord[]>([]);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [gameId, setGameId]                 = useState<string|null>(null);
  const [movesPlayed, setMovesPlayed]       = useState(0);
  const [extraTurns, setExtraTurns]         = useState(0);
  const [c3Blocked, setC3Blocked]           = useState(false);
  const [hover, setHover]                   = useState<string|null>(null);
  const [loading, setLoading]               = useState(false);
  const [botThinking, setBotThinking]       = useState(false);
  const [log, setLog]                       = useState<{text:string;player:string}[]>([]);

  const [p1Time, setP1Time] = useState(180000);
  const [p2Time, setP2Time] = useState(180000);

  const [gameNumber, setGameNumber]     = useState(1);
  const [matchHistory, setMatchHistory] = useState<string[]>([]);
  const [matchOver, setMatchOver]       = useState(false);
  const [seriesWinner, setSeriesWinner] = useState<string|null>(null);
  const [p1Ready, setP1Ready]           = useState(false);
  const [p2Ready, setP2Ready]           = useState(false);
  const [chatMessages, setChatMessages]  = useState<{from:"P1"|"P2";text:string;ts:number}[]>([]);
  const [chatInput, setChatInput]        = useState("");
  const [chatOpen, setChatOpen]          = useState(true);
  const [chatWarning, setChatWarning]    = useState(false);
  const [readyTimeout, setReadyTimeout] = useState(60);
  const [readyTimer, setReadyTimer]     = useState(0);
  const [phase, setPhase]               = useState<Phase>("playing");

  // Rematch states
  const [showRematch, setShowRematch]           = useState(false);
  const [rematchRequested, setRematchRequested] = useState<string|null>(null);

  // Toss choice visibility — what the winner already picked (shown to loser)
  const [winnerPickedRule, setWinnerPickedRule]   = useState<string|null>(null); // "first" | "c3"
  const [winnerPickedFirst, setWinnerPickedFirst] = useState<string|null>(null); // "P1" | "P2"
  const [winnerPickedC3, setWinnerPickedC3]       = useState<boolean|null>(null); // true=block false=allow

  const [rbSplashTimer, setRbSplashTimer]     = useState(3.0);
  const [coinFlipTimer, setCoinFlipTimer]     = useState(3.0);
  const [coinRevealTimer, setCoinRevealTimer] = useState(0.0);
  const [coinResult, setCoinResult]           = useState<"PENTA"|"PROTO"|null>(null);
  const [coinAngle, setCoinAngle]             = useState(0);
  const coinAngleRef  = useRef(0); // avoids 60fps re-renders during spin
  const coinFrameRef  = useRef(0);
  const coinDivRef    = useRef<HTMLDivElement>(null); // direct DOM for coin spin
  const [tossWinner, setTossWinner]           = useState<"P1"|"P2"|null>(null);
  const [firstPlayerChosen, setFirstPlayerChosen] = useState<string|null>(null);
  const [rbC3Blocked, setRbC3Blocked]         = useState(false);
  const [summaryTimer, setSummaryTimer]       = useState(3.0);
  const [choiceTimer, setChoiceTimer]         = useState(0);
  const [overlayVisible, setOverlayVisible]   = useState(false);

  const tossLoser = tossWinner === "P1" ? "P2" : "P1";

  const fmtTime = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };
  const fmtSec  = (s: number) => `${Math.ceil(Math.max(0, s))}`;

  const R = useRef({
    phase: "playing" as Phase, current: "P1", winner: null as string|null,
    p1Ready: false, p2Ready: false, readyTimeout: 60, readyTimer: 0,
    coinResult: null as "PENTA"|"PROTO"|null, matchOver: false, gameNumber: 1,
    matchHistory: [] as string[], firstPlayerChosen: null as string|null,
    tossWinner: null as "P1"|"P2"|null, rbC3Blocked: false, summaryTimer: 3.0, choiceTimer: 0,
  });
  R.current.phase             = phase;
  R.current.current           = current;
  R.current.winner            = winner;
  R.current.p1Ready           = p1Ready;
  R.current.p2Ready           = p2Ready;
  R.current.readyTimeout      = readyTimeout;
  R.current.readyTimer        = readyTimer;
  R.current.coinResult        = coinResult;
  R.current.matchOver         = matchOver;
  R.current.gameNumber        = gameNumber;
  R.current.matchHistory      = matchHistory;
  R.current.firstPlayerChosen = firstPlayerChosen;
  R.current.tossWinner        = tossWinner;
  R.current.rbC3Blocked       = rbC3Blocked;
  R.current.summaryTimer      = summaryTimer;
  R.current.choiceTimer       = choiceTimer;

  const boardRef          = useRef(board);
  const extraTurnsRef     = useRef(extraTurns);
  const movesPlayedRef    = useRef(movesPlayed);
  const matchHistoryRef   = useRef<string[]>([]);  // always-fresh match history for MP logic
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { extraTurnsRef.current = extraTurns; }, [extraTurns]);
  useEffect(() => { movesPlayedRef.current = movesPlayed; }, [movesPlayed]);

  useEffect(() => { initBoard("P1"); }, []);

  // ── WebSocket for multiplayer ─────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayerGame) return;
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
      .replace("https://", "wss://").replace("http://", "ws://");
    const ws = new WebSocket(`${base}/api/room/ws/${roomCode}/${mySlot}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "move_made") {
        setBoard(msg.board);
        setCurrent(msg.current_player);
        setMovesPlayed(msg.moves_played);
        setExtraTurns(msg.extra_turns ?? 0);
        // Log every move — use row/col directly, board already has piece placed
        if (msg.row !== undefined && msg.col !== undefined) {
          const mover = msg.board[msg.row][msg.col] as string | null;
          if (mover) {
            const _piece = mover === "P1" ? t.pieces.p1 : t.pieces.p2;
            setLog(l => [...l, { text: `${l.length+1}. ${_piece}→${String.fromCharCode(65+msg.col)}${msg.row+1} (${mover})`, player: mover }]);
          }
        }
        if (msg.winner) {
          const wl = (msg.win_line ?? []) as [number, number][];
          setWinLine(wl);
          setWinner(msg.winner);
          // Sound + overlay
          if (msg.winner === "P1") playVictory?.(); else playDefeat?.();
          requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
          // Update match history ref immediately (sync, no stale state)
          const newHist = [...matchHistoryRef.current, msg.winner as string];
          matchHistoryRef.current = newHist;
          setMatchHistory([...newHist]);
          const _mySlot = playerSlot ?? "P1";
          const sw = checkSeriesWinner(newHist);
          if (newHist.length >= 3 || sw !== null) {
            // Series over
            setMatchOver(true);
            setSeriesWinner(sw ?? newHist[newHist.length - 1]);
            setPhase("match_over");
            wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
          } else if (newHist.length === 2) {
            // Game 2 done, need game 3 rulebreaker
            setGameNumber(3);
            if (_mySlot === "P1") {
              wsRef.current?.send(JSON.stringify({ type: "toss_action", action: "start_rb", payload: {} }));
            }
            // Phase set by start_rb WS echo (arrives for both P1 and P2)
          } else {
            // Game 1 done, waiting ready
            setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
          }
        }
      } else if (msg.type === "room_state") {
        const r = msg.room;
        setBoard(r.board ?? emptyBoard());
        setCurrent(r.current_player ?? "P1");
        setMovesPlayed(r.moves_played ?? 0);
      } else if (msg.type === "opponent_disconnected") {
        setWinner(mySlot);
      } else if (msg.type === "ready_update") {
        if (msg.player === "P1") setP1Ready(msg.ready);
        else setP2Ready(msg.ready);
      } else if (msg.type === "chat_message") {
        setChatMessages(m => [...m.slice(-49), { from: msg.from, text: msg.text, ts: msg.ts }]);
      } else if (msg.type === "game_reset") {
        setBoard(emptyBoard());
        setCurrent(msg.first_player);
        setMovesPlayed(0);
        setExtraTurns(0);
        setWinner(null);
        setWinLine([]);
        setShowWinOverlay(false);
        setOverlayVisible(false);
        setC3Blocked(msg.c3_blocked ?? false);
        setLog([]);
        setP1Time(180000);
        setP2Time(180000);
        setP1Ready(false);
        setP2Ready(false);
        setShowRematch(false);
        setRematchRequested(null);
        // matchHistory NOT reset here — persists across games in a series
        if (msg.game_number) setGameNumber(msg.game_number);
        setPhase("playing");
      } else if (msg.type === "match_over") {
        setShowRematch(true);
      } else if (msg.type === "rematch_request") {
        setRematchRequested(msg.from);
      } else if (msg.type === "match_disbanded") {
        if (setScreen) setScreen("home");
      } else if (msg.type === "toss_action") {
        const { action, payload } = msg;
        if (action === "start_rb") {
          const _curPhase = R.current.phase;
          const _rbPhases = ["rb_splash","rb_coin","rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser","toss_summary"];
          if (_rbPhases.includes(_curPhase)) {
            // already in rulebreaker, ignore duplicate broadcast
          } else setTimeout(() => {
            setWinner(null);
            setWinLine([]);
            setShowWinOverlay(false);
            setOverlayVisible(false);
            setPhase("rb_splash");
            setRbSplashTimer(3);
            setCoinFlipTimer(3 + Math.random() * 3);
            setCoinRevealTimer(0);
            setCoinResult(null);
            coinAngleRef.current = 0;
            coinFrameRef.current = 0;
            setCoinAngle(0);
            setTossWinner(null);
            setFirstPlayerChosen(null);
            setRbC3Blocked(false);
            setWinnerPickedRule(null);
            setWinnerPickedFirst(null);
            setWinnerPickedC3(null);
            playRulebreaker?.();
          }, 200);
        } else if (action === "coin_result") {
          setCoinResult(payload.result);
          setTossWinner(payload.toss_winner);
          setCoinRevealTimer(3.5);
          // Snap coin to upright (no mid-animation lag for receiver)
          coinAngleRef.current = 0;
          setCoinAngle(0); // trigger re-render to show revealed coin face
        } else if (action === "phase_choice") {
          if (payload.phase) setPhase(payload.phase);
          if (payload.firstPlayerChosen !== undefined) setFirstPlayerChosen(payload.firstPlayerChosen);
          if (payload.rbC3Blocked !== undefined) setRbC3Blocked(payload.rbC3Blocked);
          if (payload.summaryTimer !== undefined) setSummaryTimer(payload.summaryTimer);
          // Sync winner's pick visibility to loser's screen
          if (payload.winnerPickedRule !== undefined) setWinnerPickedRule(payload.winnerPickedRule);
          if (payload.winnerPickedFirst !== undefined) setWinnerPickedFirst(payload.winnerPickedFirst);
          if (payload.winnerPickedC3 !== undefined) setWinnerPickedC3(payload.winnerPickedC3);
        }
      }
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25000);

    return () => { clearInterval(ping); ws.close(); wsRef.current = null; };
  }, [isMultiplayerGame, roomCode, mySlot]);

  // ── Bot move trigger ──────────────────────────────────────────────────────
  const botTurnKey = `${current}-${extraTurns}-${movesPlayed}`;

  useEffect(() => {
    if (gameMode !== "ai") return;
    if (phase !== "playing") return;
    if (current !== "P2") return;
    if (winner) return;

    let cancelled = false;
    const delays: Record<string, number> = { easy: 400, medium: 850, hard: 1800 };
    const delay = delays[difficulty] ?? 850;

    setBotThinking(true);

    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const res = await API.post("/api/bot/move", {
          board: boardRef.current,
          difficulty,
          current_player: "P2",
        });
        if (cancelled) return;
        const { row, col } = res.data ?? res;
        if (typeof row === "number" && typeof col === "number") {
          await placeBot(row, col);
        }
      } catch (err) {
        console.error("Bot move failed:", err);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setBotThinking(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botTurnKey, phase, winner, gameMode]);

  const initBoard = async (firstPlayer: string, c3block = false) => {
    setBoard(emptyBoard());
    setCurrent(firstPlayer);
    setWinner(null);
    setWinLine([]);
    setShowWinOverlay(false);
    setOverlayVisible(false);
    setMovesPlayed(0);
    setExtraTurns(0);
    setC3Blocked(c3block);
    setLog([]);
    setP1Time(180000);
    setP2Time(180000);
    setLoading(false);
    setHover(null);
    setBotThinking(false);
    try {
      const res = await API.post("/api/game/create", { mode: "solo", format: "bo3" });
      setGameId(res.data.game_id);
    } catch { setGameId(null); }
  };

  const sendChat = (from: "P1" | "P2") => {
    const text = chatInput.trim();
    if (!text) return;
    if (containsProfanity(text)) { setChatWarning(true); setTimeout(() => setChatWarning(false), 3000); }
    const censored = censorText(text);
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text: censored, ts: Date.now() }));
    } else {
      setChatMessages(m => [...m.slice(-49), { from, text: censored, ts: Date.now() }]);
    }
    setChatInput("");
  };

  const softReset = () => {
    matchHistoryRef.current = []; setGameNumber(1); setMatchHistory([]); setMatchOver(false); setSeriesWinner(null);
    setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0);
    setRbSplashTimer(3); setCoinFlipTimer(3 + Math.random() * 3); setCoinRevealTimer(0); setCoinResult(null);
    setCoinAngle(0); setTossWinner(null); setFirstPlayerChosen(null); setRbC3Blocked(false);
    setSummaryTimer(3); setOverlayVisible(false); setChoiceTimer(0);
    setShowRematch(false); setRematchRequested(null);
    setWinnerPickedRule(null); setWinnerPickedFirst(null); setWinnerPickedC3(null);
    setPhase("playing");
    initBoard("P1");
  };

  const checkSeriesWinner = (hist: string[]): string | null => {
    if (hist.length < 2) return null;
    const [g1, g2] = hist;
    if (g1 === g2 && (g1 === "P1" || g1 === "P2")) return g1;
    if (g1 !== "DRAW" && g2 === "DRAW") return g1;
    if (g2 !== "DRAW" && g1 === "DRAW") return g2;
    return null;
  };

  useEffect(() => {
    const dur = PHASE_TIMERS[phase];
    if (dur !== undefined) { choiceTimerRef.current = dur; lastChoiceSec.current = dur; setChoiceTimer(dur); }
  }, [phase]);

  const lastTick       = useRef(Date.now());
  const rafHandle      = useRef(0);
  const choiceTimerRef = useRef(0);
  const lastChoiceSec  = useRef(-1);

  useEffect(() => {
    const tossChoicePhases: Phase[] = ["rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser"];
    const tick = () => {
      rafHandle.current = requestAnimationFrame(tick);
      const now = Date.now();
      const dt  = now - lastTick.current;
      lastTick.current = now;
      const s = R.current;
      const freePhases = ["waiting_ready", "rb_splash", "rb_coin"];
      if (s.winner && !freePhases.includes(s.phase)) return;
      if (pausedRef.current && !freePhases.includes(s.phase)) return;

      if (s.phase === "playing" && !s.winner) {
        if (s.current === "P1") setP1Time(v => { if (v - dt <= 0) { setWinner("P2"); return 0; } return v - dt; });
        else setP2Time(v => { if (v - dt <= 0) { setWinner("P1"); return 0; } return v - dt; });
      }
      if (s.phase === "waiting_ready") {
        if (!s.p1Ready || !s.p2Ready) {
          setReadyTimeout(v => { const nv = v - dt / 1000; if (nv <= 0) { setP1Ready(true); setP2Ready(true); setReadyTimer(1); return 0; } return nv; });
        } else if (s.readyTimer > 0) {
          setReadyTimer(v => { const nv = v - dt / 1000; if (nv <= 0) { doAdvanceAfterReady(); return 0; } return nv; });
        }
      }
      if (s.phase === "rb_splash") setRbSplashTimer(v => { const nv = v - dt/1000; if (nv <= 0) { setPhase("rb_coin"); return 3; } return nv; });
      if (s.phase === "rb_coin") {
        coinAngleRef.current += 0.18;
        // Update coin DOM directly — zero React re-renders during spin
        if (coinDivRef.current && !s.coinResult) {
          const scaleX = Math.abs(Math.cos(coinAngleRef.current * 2));
          const deg = ((coinAngleRef.current * (180 / Math.PI)) % 360 + 360) % 360;
          const faceIsPenta = deg < 90 || deg > 270;
          coinDivRef.current.style.transform = `scaleX(${scaleX})`;
          coinDivRef.current.style.background = faceIsPenta ? "#ffffff" : "#0a0a0a";
          const img = coinDivRef.current.querySelector("img") as HTMLImageElement | null;
          if (img) img.src = faceIsPenta ? "/penta-coin.png" : "/proto-coin.png";
        }
        if (!s.coinResult) {
          // Only P1 drives the coin flip timer and broadcasts result
          if (!isMultiplayerGame || mySlot === "P1") {
            setCoinFlipTimer(v => { const nv = v - dt / 1000; if (nv <= 0) {
              const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
              setCoinResult(r);
              setTossWinner(r === "PENTA" ? "P1" : "P2");
              setCoinRevealTimer(3.5);
              if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "toss_action", action: "coin_result", payload: { result: r, toss_winner: r === "PENTA" ? "P1" : "P2" } }));
              }
              return 0;
            } return nv; });
          }
        } else {
          setCoinRevealTimer(v => { const nv = v - dt/1000; if (nv <= 0) { setPhase("rule_choice"); return 0; } return nv; });
        }
      }
      if (tossChoicePhases.includes(s.phase) && s.choiceTimer > 0) {
        choiceTimerRef.current -= dt / 1000;
        if (choiceTimerRef.current <= 0) { choiceTimerRef.current = 0; setChoiceTimer(0); autoPickLeft(s.phase); }
        else { const sec = Math.ceil(choiceTimerRef.current); if (sec !== lastChoiceSec.current) { lastChoiceSec.current = sec; setChoiceTimer(choiceTimerRef.current); } }
      }
      if (s.phase === "toss_summary") {
        setSummaryTimer(v => { const nv = v - dt / 1000; if (nv <= 0) {
            const fp = s.firstPlayerChosen ?? s.tossWinner ?? "P1";
            const _isMP2 = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
            if (_isMP2) {
              // For multiplayer: P1 tells server to start game 3
              // Both players wait for game_reset WS message
              // Both players send rb_start_game — server is idempotent (first one wins)
              wsRef.current?.send(JSON.stringify({ type: "rb_start_game", first_player: fp, c3_blocked: s.rbC3Blocked }));
              // c3blocked and phase("playing") set on game_reset arrival
            } else {
              setGameNumber(3); setPhase("playing"); initBoard(fp, s.rbC3Blocked);
            }
            return 0;
          } return nv; });
      }
    };
    rafHandle.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafHandle.current);
  }, []);

  const autoPickLeft = (p: Phase) => {
    const tw = R.current.tossWinner;
    const tl = tw === "P1" ? "P2" : "P1";
    if      (p === "rule_choice")      setPhase("who_first_winner");
    else if (p === "who_first_winner") { setFirstPlayerChosen(tw); setPhase("c3_choice_loser"); }
    else if (p === "c3_choice")        { setRbC3Blocked(true);  setPhase("who_first_loser"); }
    else if (p === "c3_choice_loser")  { setRbC3Blocked(true);  setSummaryTimer(3); setPhase("toss_summary"); }
    else if (p === "who_first_loser")  { setFirstPlayerChosen(tl); setSummaryTimer(3); setPhase("toss_summary"); }
  };

  const doAdvanceAfterReady = () => {
    const gn = R.current.gameNumber;
    if (R.current.matchOver) return;
    setWinner(null); setShowWinOverlay(false); setOverlayVisible(false);
    if (gn >= 2) {
      setGameNumber(3); setPhase("rb_splash"); playRulebreaker?.();
      setRbSplashTimer(3); setCoinFlipTimer(3 + Math.random() * 3); setCoinRevealTimer(0);
      setCoinResult(null); setCoinAngle(0); setTossWinner(null);
      setFirstPlayerChosen(null); setRbC3Blocked(false);
    } else {
      setGameNumber(2); setPhase("playing"); initBoard("P2");
    }
  };

  useEffect(() => {
    if (!winner) return;
    const _isMP = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
    // Multiplayer: all post-game logic handled in move_made handler — nothing to do here
    if (_isMP) return;
    // Singleplayer only below
    if (phase !== "playing") return;
    if (winner === "P1") playVictory?.(); else if (winner === "P2") playDefeat?.();
    requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
    const newHist = [...R.current.matchHistory, winner];
    setMatchHistory(newHist);
    const sw = checkSeriesWinner(newHist);
    if (newHist.length >= 3 || sw !== null) {
      setMatchOver(true);
      setSeriesWinner(sw ?? newHist[newHist.length - 1]);
      setPhase("match_over");
    } else {
      setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
    }
  }, [winner]);

  useEffect(() => {
    if (phase === "waiting_ready" && p1Ready && p2Ready && R.current.readyTimer <= 0) setReadyTimer(1);
  }, [p1Ready, p2Ready]);

  // ── placeBot ──────────────────────────────────────────────────────────────
  const placeBot = async (r: number, c: number) => {
    const currentBoard  = boardRef.current;
    const currentMoves  = movesPlayedRef.current;
    const currentExtra  = extraTurnsRef.current;
    if (phase !== "playing" || currentBoard[r][c] || winner) return;
    playPlace?.();
    const playerWhoMoved = "P2";
    const nb = currentBoard.map(row => [...row]);
    nb[r][c] = playerWhoMoved;
    const newMoves = currentMoves + 1;
    let newExtra = currentExtra, nextPlayer: string = "P1";
    if (newMoves === 1 && r === 2 && c === 2) { nextPlayer = "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = "P1"; else nextPlayer = "P2"; }
    else { nextPlayer = "P1"; }
    const result = checkWin(nb, r, c, playerWhoMoved, newMoves);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch {} }
  };

  const place = async (r: number, c: number) => {
    if (phase !== "playing" || board[r][c] || winner || loading) return;
    if (gameMode === "ai" && current === "P2") return;
    if (c3Blocked && movesPlayed === 0 && r === 2 && c === 2) return;

    // Multiplayer: instant sound + log, let server move_made update board for everyone
    if (isMultiplayerGame) {
      if (current !== mySlot) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      playPlace?.();
      wsRef.current.send(JSON.stringify({ type: "move", row: r, col: c }));
      return;
    }

    // Singleplayer / AI
    playPlace?.();
    setLoading(true);
    const playerWhoMoved = current;
    const nb = board.map(row => [...row]);
    nb[r][c] = playerWhoMoved;
    const newMoves = movesPlayed + 1;
    let newExtra = extraTurns, nextPlayer = current;
    if (newMoves === 1 && r === 2 && c === 2) { nextPlayer = current === "P1" ? "P2" : "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = current === "P1" ? "P2" : "P1"; }
    else { nextPlayer = current === "P1" ? "P2" : "P1"; }
    if (c3Blocked && newMoves === 1) setC3Blocked(false);
    const result = checkWin(nb, r, c, playerWhoMoved, newMoves);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    setLoading(false);
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch {} }
  };

  const addLog = (r: number, c: number, player: string) => {
    const piece = player === "P1" ? t.pieces.p1 : t.pieces.p2;
    setLog(l => [...l, { text: `${l.length+1}. ${piece}→${String.fromCharCode(65+c)}${r+1} (${player})`, player }]);
  };

  const dismissOverlay = useCallback(() => { setOverlayVisible(false); setTimeout(() => setShowWinOverlay(false), 320); }, []);

  const broadcastTossPhase = useCallback((phase: string, extra: Record<string,unknown> = {}) => {
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "toss_action", action: "phase_choice", payload: { phase, ...extra } }));
    }
  }, [isMultiplayerGame]);

  const onLeft = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      setWinnerPickedRule("first");
      setPhase("who_first_winner");
      broadcastTossPhase("who_first_winner", { winnerPickedRule: "first" });
    } else if (p === "who_first_winner") {
      setFirstPlayerChosen(tw);
      setWinnerPickedFirst(tw ?? null);
      setPhase("c3_choice_loser");
      broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tw, winnerPickedFirst: tw });
    } else if (p === "c3_choice") {
      setRbC3Blocked(true);
      setWinnerPickedC3(true);
      setPhase("who_first_loser");
      broadcastTossPhase("who_first_loser", { rbC3Blocked: true, winnerPickedC3: true });
    } else if (p === "c3_choice_loser") {
      setRbC3Blocked(true); setSummaryTimer(3); setPhase("toss_summary");
      broadcastTossPhase("toss_summary", { rbC3Blocked: true, summaryTimer: 3 });
    } else if (p === "who_first_loser") {
      setFirstPlayerChosen(tl); setSummaryTimer(3); setPhase("toss_summary");
      broadcastTossPhase("toss_summary", { firstPlayerChosen: tl, summaryTimer: 3 });
    }
  }, [broadcastTossPhase]);

  const onRight = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      setWinnerPickedRule("c3");
      setPhase("c3_choice");
      broadcastTossPhase("c3_choice", { winnerPickedRule: "c3" });
    } else if (p === "who_first_winner") {
      setFirstPlayerChosen(tl);
      setWinnerPickedFirst(tl ?? null);
      setPhase("c3_choice_loser");
      broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tl, winnerPickedFirst: tl });
    } else if (p === "c3_choice") {
      setRbC3Blocked(false);
      setWinnerPickedC3(false);
      setPhase("who_first_loser");
      broadcastTossPhase("who_first_loser", { rbC3Blocked: false, winnerPickedC3: false });
    } else if (p === "c3_choice_loser") {
      setRbC3Blocked(false); setSummaryTimer(3); setPhase("toss_summary");
      broadcastTossPhase("toss_summary", { rbC3Blocked: false, summaryTimer: 3 });
    } else if (p === "who_first_loser") {
      setFirstPlayerChosen(tw); setSummaryTimer(3); setPhase("toss_summary");
      broadcastTossPhase("toss_summary", { firstPlayerChosen: tw, summaryTimer: 3 });
    }
  }, [broadcastTossPhase]);

  const cc = current === "P1" ? p1c : p2c;
  const cp = current === "P1" ? t.pieces.p1 : t.pieces.p2;
  const winnerColor = winner === "P1" ? p1c : winner === "P2" ? p2c : t.gold;
  const winnerPiece = winner === "P1" ? t.pieces.p1 : winner === "P2" ? t.pieces.p2 : "⚖";

  if (showSplash) return (
    <div style={{ position:"fixed", top:64, left:0, right:0, bottom:0, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, gap:32, userSelect:"none" }}>
      <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(24px,5vw,72px)", fontWeight:900, color:t.accent, textShadow:`0 0 60px ${t.accentGlow}55`, letterSpacing:"0.06em", textAlign:"center" }}>SINGLEPLAYER</div>
      <div style={{ fontFamily:t.fontBody, fontSize:"clamp(13px,1.6vw,18px)", color:t.textSecondary, letterSpacing:"0.04em" }}>Local · Pass & Play · Best of 3</div>
      <button onClick={() => setShowSplash(false)}
        style={{ marginTop:8, padding:"18px 64px", background:`linear-gradient(135deg,${t.accent},${t.accentGlow})`, border:"none", borderRadius:ip?2:12, color:"#0A0A0A", fontFamily:t.fontDisplay, fontSize:"clamp(14px,2vw,22px)", fontWeight:900, cursor:"pointer", letterSpacing:"0.1em", boxShadow:`0 0 48px ${t.accentGlow}55`, transition:"transform 0.15s ease, box-shadow 0.2s ease" }}
        onMouseEnter={e => { playHover?.(); (e.currentTarget as HTMLElement).style.transform="scale(1.05)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 0 72px ${t.accentGlow}88`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 0 48px ${t.accentGlow}55`; }}
        onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform="scale(0.97)"; }}
        onMouseUp={e   => { (e.currentTarget as HTMLElement).style.transform="scale(1.05)"; }}
      >▶  PLAY</button>
      <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em" }}>P1 goes first · Click any cell to begin</div>
    </div>
  );

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

  if (phase === "rb_coin") {
    const revealed = coinResult !== null;
    const coinDiam = 240;
    const revType  = coinResult ?? "PENTA";
    const winCol   = revealed ? (coinResult === "PENTA" ? p1c : p2c) : t.textSecondary;
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
          ) : (() => {
            const deg = ((coinAngle*(180/Math.PI))%360+360)%360;
            const scaleX = Math.cos(coinAngle*2);
            const faceIsPenta = deg < 90 || deg > 270;
            const src = faceIsPenta ? "/penta-coin.png" : "/proto-coin.png";
            const bg  = faceIsPenta ? "#ffffff" : "#0a0a0a";
            return (<div ref={coinDivRef} style={{ width:coinDiam, height:coinDiam, borderRadius:"50%", overflow:"hidden", background:bg, transform:`scaleX(${Math.abs(scaleX)})`, willChange:"transform", boxShadow:"0 12px 48px rgba(0,0,0,0.65)", transition:"background 0.05s" }}><img src={src} alt={faceIsPenta?"PENTA":"PROTO"} style={{ width:"100%", height:"100%", display:"block", objectFit:"cover" }}/></div>);
          })()}
        </div>
        {revealed && (<div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(18px,2.4vw,32px)", fontWeight:700, color:t.text, textAlign:"center", letterSpacing:"0.06em", marginTop:8, animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) 0.3s both" }}><span style={{ color:winCol }}>{tossWinner}</span><span style={{ color:t.textMuted }}> WINS THE TOSS</span></div>)}
      </div>
    );
  }

  const tossChoicePhases: Phase[] = ["rule_choice","who_first_winner","c3_choice","c3_choice_loser","who_first_loser"];
  if (tossChoicePhases.includes(phase)) {
    const winCol = tossWinner === "P1" ? p1c : p2c;
    const loseCol = tossLoser === "P1" ? p1c : p2c;
    let title="", leftLabel="", rightLabel="", actor="", actorCol=winCol;
    if (phase==="rule_choice")      { title=`${tossWinner} WON THE TOSS — CHOOSE YOUR RULE`; leftLabel="DECIDE WHO\nPLAYS FIRST"; rightLabel="BLOCK C3\nFIRST MOVE"; actor=tossWinner!; actorCol=winCol; }
    if (phase==="who_first_winner") { title=`${tossWinner} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${tossWinner}\nPLAYS FIRST`; rightLabel=`${tossLoser}\nPLAYS FIRST`; actor=tossWinner!; actorCol=winCol; }
    if (phase==="c3_choice")        { title=`${tossWinner} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=tossWinner!; actorCol=winCol; }
    if (phase==="c3_choice_loser")  { title=`${tossLoser} — CHOOSE C3 RULE`; leftLabel="BLOCK C3"; rightLabel="ALLOW C3"; actor=tossLoser!; actorCol=loseCol; }
    if (phase==="who_first_loser")  { title=`${tossLoser} — WHO PLAYS FIRST IN ROUND 3?`; leftLabel=`${tossLoser}\nPLAYS FIRST`; rightLabel=`${tossWinner}\nPLAYS FIRST`; actor=tossLoser!; actorCol=loseCol; }
    const maxTime = PHASE_TIMERS[phase] ?? 60;
    const pct     = Math.max(0, choiceTimer / maxTime);
    const urgent  = choiceTimer <= 10;
    return (
      <div className="phase-screen" style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:2, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:24, userSelect:"none" }}>
        <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}} .toss-card-enter{animation:cardSlideIn 0.45s cubic-bezier(.22,.68,0,1.2) both;animation-fill-mode:both;}`}</style>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(13px,1.8vw,22px)", fontWeight:700, color:t.accent, textAlign:"center", maxWidth:800 }}>{title}</div>

        {/* Show what toss winner already picked — visible to loser when it's their turn */}
        {isMultiplayerGame && (phase === "c3_choice_loser" || phase === "who_first_loser") && (
          <div style={{ background:`${actorCol}12`, border:`1px solid ${actorCol}44`, borderRadius:ip?2:10, padding:"12px 20px", maxWidth:480, width:"100%", textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
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
        {(() => {
          const winnerPhases = ["rule_choice", "who_first_winner", "c3_choice"];
          const loserPhases  = ["c3_choice_loser", "who_first_loser"];
          const isMyTurn = !isMultiplayerGame ||
            (winnerPhases.includes(phase) && mySlot === tossWinner) ||
            (loserPhases.includes(phase)  && mySlot === tossLoser);
          return (
            <div style={{ display:"flex", gap:20, width:"100%", maxWidth:880, opacity: isMyTurn ? 1 : 0.35, pointerEvents: isMyTurn ? "auto" : "none", transition:"opacity 0.3s" }}>
              <TossCard label={leftLabel} onClick={onLeft} delay={0.12} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
              <TossCard label={rightLabel} onClick={onRight} delay={0.20} actorCol={actorCol} bgCard={t.bgCard} borderCol={t.border} textCol={t.text} fontDisplay={t.fontDisplay} ip={ip}/>
            </div>
          );
        })()}
      </div>
    );
  }

  if (phase === "toss_summary") {
    const fp = firstPlayerChosen ?? tossWinner ?? "P1";
    const wmc = firstPlayerChosen !== null;
    const winnerChoice = wmc ? `PLAYS FIRST:\n${fp}` : `C3 BLOCK: ${rbC3Blocked?"YES":"NO"}`;
    const loserChoice  = wmc ? `C3 BLOCK: ${rbC3Blocked?"YES":"NO"}` : `PLAYS FIRST:\n${fp}`;
    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:2, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:"40px 24px", gap:24, userSelect:"none", animation:"fadeUp 0.35s ease both" }}>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(22px,3.5vw,42px)", fontWeight:700, color:t.accent }}>ROUND 3 RULES</div>
        <div style={{ fontFamily:t.fontMono, fontSize:17, color:t.textMuted }}>Game starts in {Math.max(1,Math.ceil(summaryTimer))}...</div>
        <div style={{ display:"flex", gap:20, width:"100%", maxWidth:800 }}>
          {(["P1","P2"] as const).map(p => {
            const col = p==="P1"?p1c:p2c;
            const choice = p===tossWinner ? winnerChoice : loserChoice;
            return (<div key={p} style={{ flex:1, background:t.bgCard, border:`3px solid ${col}`, borderRadius:ip?2:14, padding:"24px 20px", textAlign:"center" }}><div style={{ fontFamily:t.fontDisplay, fontSize:50, fontWeight:900, color:col, marginBottom:12 }}>{p}</div><div style={{ fontFamily:t.fontMono, fontSize:16, color:t.textSecondary, whiteSpace:"pre-line", lineHeight:1.9 }}>{choice}</div></div>);
          })}
        </div>
      </div>
    );
  }

  const boardGap = ip ? 3 : 4;
  const boardPad = ip ? 3 : 4;
  const bigCs = `calc((min(calc(100vw - 560px), calc(100vh - 200px)) - ${4*boardGap + 2*boardPad}px) / 5)`;
  const panelW = 240;
  const seriesDiffers = phase === "match_over" && seriesWinner && seriesWinner !== winner;
  const seriesColor   = seriesWinner==="P1"?p1c:seriesWinner==="P2"?p2c:t.gold;
  const seriesPiece   = seriesWinner==="P1"?t.pieces.p1:seriesWinner==="P2"?t.pieces.p2:"⚖";

  return (
    <div style={{ position:"fixed", top:64, left:0, right:0, bottom:0, zIndex:2, display:"flex", flexDirection:"row", background:t.bg, overflow:"hidden", userSelect:"none", WebkitUserSelect:"none" }}>

      {showWinOverlay && winner && (
        <div onClick={dismissOverlay} style={{ position:"fixed", inset:0, zIndex:999, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"stretch", willChange:"opacity", opacity:overlayVisible?1:0, transition:"opacity 0.28s ease" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.92)", zIndex:0 }}/>
          {seriesDiffers ? (
            <>
              <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderBottom:"1px solid #ffffff14", willChange:"transform, opacity", opacity:overlayVisible?1:0, transform:overlayVisible?"translateY(0)":"translateY(28px)", transition:"opacity 0.32s ease 0.08s, transform 0.32s cubic-bezier(.22,.68,0,1.2) 0.08s" }}>
                <div style={{ fontSize:"clamp(44px,7vw,96px)", lineHeight:1, marginBottom:8, animation:"winPulse 1.6s ease infinite" }}>{winnerPiece}</div>
                <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,6.5vw,90px)", fontWeight:900, color:winnerColor, lineHeight:1, textShadow:`0 0 60px ${winnerColor}88`, animation:"winPulse 1.6s ease infinite" }}>{winner==="DRAW"?"DRAW":`${winner} WINS!`}</div>
                <div style={{ fontFamily:t.fontMono, fontSize:"clamp(11px,1.2vw,14px)", color:"#777", marginTop:12, letterSpacing:"0.12em" }}>GAME {R.current.gameNumber}</div>
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
              {phase==="match_over" ? <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>MATCH OVER — SERIES COMPLETE</div> : <div style={{ fontFamily:t.fontMono, fontSize:"clamp(13px,1.8vw,18px)", color:"#AAAAAA", marginBottom:20 }}>GAME {R.current.gameNumber} COMPLETE</div>}
              <div style={{ fontFamily:t.fontBody, fontSize:14, color:"#666" }}>click anywhere to continue</div>
            </div>
          )}
        </div>
      )}

      {/* LEFT PANEL */}
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
              return (<button key={p} onClick={() => {
                if (isMultiplayerGame && mySlot !== p) return;
                const newVal = p === "P1" ? !p1Ready : !p2Ready;
                if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "ready", ready: newVal }));
                }
                p === "P1" ? setP1Ready(newVal) : setP2Ready(newVal);
              }}
              style={{ background:rdy?`${col}22`:"#AA000022", border:`2px solid ${rdy?col:"#AA0000"}`, color:rdy?col:"#EE0000", fontFamily:t.fontMono, fontSize:15, fontWeight:700, padding:"12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", boxShadow:rdy?`0 0 16px ${col}55, 0 0 4px ${col}33`:"none" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.boxShadow=rdy?`0 0 24px ${col}88`:"0 0 16px #EE000055";e.currentTarget.style.borderColor=rdy?col:"#FF3333";}} onMouseLeave={e=>{e.currentTarget.style.boxShadow=rdy?`0 0 16px ${col}55`:"none";e.currentTarget.style.borderColor=rdy?col:"#AA0000";}}>{p} {rdy?"✓ READY":"NOT READY"}</button>);
            })}
          </div>
        )}
        {phase==="match_over" && !isMultiplayerGame && (
          <div style={{ textAlign:"center", animation:"fadeUp 0.3s ease both" }}>
            <div style={{ fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, color:t.gold, marginBottom:10 }}>{seriesWinner==="DRAW"?"DRAW!":seriesWinner+" WINS!"}</div>
            <button onClick={softReset} style={{ background:`${t.accent}18`, border:`1px solid ${t.accent}`, color:t.accent, fontFamily:t.fontMono, fontSize:13, padding:"10px 18px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ NEW MATCH</button>
          </div>
        )}
        {(phase==="playing"||phase==="waiting_ready") && (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:"auto", borderTop:`1px solid ${t.border}`, paddingTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:t.fontMono, fontSize:17, fontWeight:700, color:t.text, letterSpacing:"0.12em" }}>CHAT</div>
              <button onClick={() => setChatOpen(v=>!v)} style={{ background:"none", border:"none", color:t.text, fontFamily:t.fontMono, fontSize:16, cursor:"pointer", padding:"2px 6px" }}>{chatOpen?"▾":"▸"}</button>
            </div>
            {chatOpen && (
              <>
                <div style={{ height:160, overflowY:"auto", background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:ip?2:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                  {chatMessages.length===0 && (<div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, textAlign:"center", marginTop:24 }}>No messages yet</div>)}
                  {chatMessages.map((m,i) => (<div key={i} style={{ display:"flex", gap:6, alignItems:"flex-start" }}><span style={{ fontFamily:t.fontMono, fontSize:14, fontWeight:700, color:m.from==="P1"?p1c:p2c, flexShrink:0 }}>{m.from}:</span><span style={{ fontFamily:t.fontBody, fontSize:14, color:t.text, wordBreak:"break-word" as const }}>{m.text}</span></div>))}
                </div>
                {chatWarning && (<div style={{ padding:"8px 12px", background:"#F4433618", border:"1px solid #F44336", borderRadius:6, fontFamily:t.fontBody, fontSize:13, color:"#F44336" }}>⚠ Inappropriate language detected and censored.</div>)}
                <div style={{ display:"flex", gap:6 }}>
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter") sendChat(isMultiplayerGame ? mySlot : "P1");}} placeholder="message…" maxLength={60} style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:ip?2:6, color:t.text, fontFamily:t.fontBody, fontSize:14, padding:"8px 10px", outline:"none", minWidth:0 }}/>
                  {(!isMultiplayerGame || mySlot === "P1") && (<button onClick={()=>sendChat("P1")} style={{ background:`${p1c}20`, border:`1px solid ${p1c}`, color:p1c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p1c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p1c}20`;e.currentTarget.style.color=p1c;}}>P1</button>)}
                  {(!isMultiplayerGame || mySlot === "P2") && (<button onClick={()=>sendChat("P2")} style={{ background:`${p2c}20`, border:`1px solid ${p2c}`, color:p2c, fontFamily:t.fontMono, fontSize:14, fontWeight:700, padding:"8px 12px", borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.18s", flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.background=p2c;e.currentTarget.style.color="#000";}} onMouseLeave={e=>{e.currentTarget.style.background=`${p2c}20`;e.currentTarget.style.color=p2c;}}>P2</button>)}
                </div>
              </>
            )}
          </div>
        )}
        {(phase==="playing"||phase==="waiting_ready") && (
          isRankedGame ? (
            <button onClick={()=>{playClick?.();pausedRef.current=true;setShowSurrender(true);}} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>⚑ SURRENDER</button>
          ) : isMultiplayer ? null : (
            <button onClick={softReset} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s" }}>↺ RESET</button>
          )
        )}
      </div>

      {/* BOARD */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, padding:"10px 0", minWidth:0 }}>
        <div style={{ height:36, display:"flex", alignItems:"center", justifyContent:"center", gap:16, width:"100%", position:"relative", paddingLeft:"2%" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:11, letterSpacing:"0.08em", background:c3Blocked?`${t.danger}10`:`${t.gold}10`, border:`1px solid ${c3Blocked?t.danger:t.gold}33`, borderRadius:6, padding:"3px 14px", color:c3Blocked?t.danger:t.gold, flexShrink:0, visibility:phase==="playing"&&movesPlayed===0?"visible":"hidden", opacity:phase==="playing"&&movesPlayed===0?1:0, transition:"opacity 0.4s ease", pointerEvents:"none" }}>
            {c3Blocked?"✕ Center (C3) is blocked this game":"★ Playing center gives opponent 2 extra turns"}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 20px", background:`${winner?winnerColor:cc}14`, border:`${ip?3:1}px solid ${winner?winnerColor:cc}`, borderRadius:ip?2:24, transition:"background 0.25s, border-color 0.25s", flexShrink:0 }}>
            <div style={{ width:8, height:8, borderRadius:ip?0:"50%", background:winner?winnerColor:cc, transition:"background 0.25s" }}/>
            <span style={{ fontFamily:t.fontDisplay, fontSize:ip?11:15, fontWeight:700, color:winner?winnerColor:cc, transition:"color 0.25s" }}>
              {winner?(winner==="DRAW"?"⚖ DRAW":`${winnerPiece} ${winner} WINS`):extraTurns>0?`${cp} — ${current} EXTRA TURN ×${extraTurns}`:`${cp} — ${current}'s Turn`}
            </span>
          </div>
          <div style={{ fontFamily:t.fontMono, fontSize:11, letterSpacing:"0.08em", borderRadius:6, padding:"3px 14px", flexShrink:0, visibility:"hidden", pointerEvents:"none" }}>
            {c3Blocked?"✕ Center (C3) is blocked this game":"★ Playing center gives opponent 2 extra turns"}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(5,${bigCs})`, gap:`${boardGap}px`, marginLeft:28 }}>
          {"ABCDE".split("").map(l => <div key={l} style={{ textAlign:"center", fontFamily:t.fontMono, fontSize:22, fontWeight:800, color:isRedBoard?"rgba(200,60,40,0.7)":isIceBoard?"rgba(140,210,255,0.55)":t.accent, letterSpacing:"0.1em", textShadow:`0 0 10px ${isRedBoard?"rgba(200,40,0,0.4)":isIceBoard?"rgba(100,180,255,0.3)":t.accentGlow+"66"}` }}>{l}</div>)}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"flex-start" }}>
          <div style={{ display:"grid", gridTemplateRows:`repeat(5,${bigCs})`, gap:`${boardGap}px` }}>
            {[1,2,3,4,5].map(n => <div key={n} style={{ display:"flex", alignItems:"center", justifyContent:"center", fontFamily:t.fontMono, fontSize:22, fontWeight:800, color:isRedBoard?"rgba(200,60,40,0.7)":t.accent, letterSpacing:"0.1em", textShadow:`0 0 10px ${isRedBoard?"rgba(200,40,0,0.4)":t.accentGlow+"66"}`, width:28 }}>{n}</div>)}
          </div>
          <div style={{ position:"relative", display:"grid", gridTemplateColumns:`repeat(5,${bigCs})`, gridTemplateRows:`repeat(5,${bigCs})`, gap:`${boardGap}px`, background:isRedBoard?"rgba(10,2,1,0.99)":isIceBoard?"linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))":t.boardLine, padding:`${boardPad}px`, borderRadius:ip?2:10, border:`${ip?3:2}px solid ${isRedBoard?"rgba(140,20,0,0.35)":isIceBoard?"rgba(80,160,220,0.28)":t.border}`, boxShadow:isRedBoard?"0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)":isIceBoard?"0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)":"none", overflow:"hidden" }}>
            {isRedBoard && <Embers count={16}/>}
            {isRedBoard && <HeatOverlay/>}
            {isIceBoard && <FrostCrystals/>}
            {isIceBoard && <IceOverlay/>}
            {board.map((row, r) => row.map((cell, c) => {
              const key = `${r}-${c}`;
              const blk = c3Blocked && movesPlayed===0 && r===2 && c===2;
              const isHov = hover===key && !cell && !winner && !blk && phase==="playing";
              const isWin = winLine.some(([wr,wc]) => wr===r && wc===c);
              const ec = cell==="P1"?p1c:p2c;
              const canPlay = !cell && !winner && !blk && phase==="playing";

              if (isRedBoard) return (<RedCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useFlameSkull={useFlameSkull} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={()=>place(r,c)} onMouseEnter={()=>setHover(key)} onMouseLeave={()=>setHover(null)}/>);
              if (isIceBoard) return (<IceCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useSnowflakeShard={useSnowflakeShard} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={()=>place(r,c)} onMouseEnter={()=>setHover(key)} onMouseLeave={()=>setHover(null)}/>);

              return (
                <div key={key} onClick={()=>place(r,c)} onMouseEnter={()=>setHover(key)} onMouseLeave={()=>setHover(null)} className={isWin?"win-cell-pulse":""}
                  style={{ "--win-col":ec, width:bigCs, height:bigCs, background:blk?`${t.danger}18`:isWin?`${ec}28`:isHov?`${cc}22`:t.boardBg, border:`2px solid ${blk?t.danger:isWin?ec:isHov?cc:t.boardLine}`, borderRadius:ip?0:4, display:"flex", alignItems:"center", justifyContent:"center", cursor:canPlay?(isHov?"grabbing":"grab"):"default", fontSize:"clamp(24px,5.5vmin,58px)", fontFamily:t.fontDisplay, fontWeight:700, color:ec, textShadow:isWin?`0 0 20px ${ec}`:cell?`0 0 14px ${ec}77`:"none", transition:"background 0.1s, border-color 0.1s", opacity:blk?0.4:1, boxShadow:isWin?`0 0 8px ${ec}44`:isHov?`inset 0 0 12px ${cc}22`:"none", willChange:isWin?"auto":canPlay?"background, border-color":"auto", position:"relative" } as React.CSSProperties}>
                  {cell && useFlameSkull && cell==="P1" && <Flame cssSize="55%"/>}
                  {cell && useFlameSkull && cell==="P2" && <Skull cssSize="55%"/>}
                  {cell && useSnowflakeShard && cell==="P1" && <SnowflakePiece cssSize="55%"/>}
                  {cell && useSnowflakeShard && cell==="P2" && <IceShardPiece cssSize="55%"/>}
                  {cell && !useFlameSkull && !useSnowflakeShard && <Piece symbol={cell==="P1"?pieceSymbols.p1:pieceSymbols.p2} color={cell==="P1"?p1c:p2c} size="36%"/>}
                  {!cell && blk && <span style={{ fontSize:"clamp(14px,2.5vmin,28px)", color:t.danger }}>✕</span>}
                </div>
              );
            }))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ width:panelW, flexShrink:0, background:t.bgPanel, borderLeft:`${ip?3:1}px solid ${t.border}`, padding:"18px 18px", display:"flex", flexDirection:"column", gap:10, overflowY:"auto" }}>
        <div style={{ fontFamily:t.fontMono, fontSize:20, fontWeight:700, color:t.text, letterSpacing:"0.14em" }}>MOVE LOG</div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4 }}>
          {log.length===0 ? <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, fontStyle:"italic" }}>No moves yet</div> : log.map((m,i) => <div key={i} style={{ fontFamily:t.fontMono, fontSize:15, color:m.player==="P1"?p1c:p2c, padding:"3px 0", borderBottom:`1px solid ${t.border}22` }}>{m.text}</div>)}
        </div>
        {setScreen && !isRankedGame && (phase==="playing"||phase==="waiting_ready"||phase==="match_over") && (
          <button onClick={()=>{playClick?.();pausedRef.current=true;setShowExitConfirm(true);}} style={{ background:`${t.danger}16`, border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:13, padding:9, borderRadius:ip?2:6, cursor:"pointer", transition:"all 0.2s", marginTop:4 }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=`${t.danger}30`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}16`;}}>✕ EXIT MATCH</button>
        )}
      </div>

      {/* REMATCH OVERLAY — multiplayer only */}
      {showRematch && isMultiplayerGame && (
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
                onClick={() => {
                  wsRef.current?.send(JSON.stringify({ type: "rematch" }));
                  setRematchRequested(mySlot);
                }}
                disabled={rematchRequested === mySlot}
                style={{ background:rematchRequested===mySlot?`${t.accent}10`:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:rematchRequested===mySlot?"default":"pointer", opacity:rematchRequested===mySlot?0.5:1, transition:"all 0.2s" }}
                onMouseEnter={e=>{ if(rematchRequested!==mySlot){e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";} }}
                onMouseLeave={e=>{ e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent; }}
              >↺ REMATCH</button>
              <button
                onClick={() => {
                  wsRef.current?.send(JSON.stringify({ type: "quit_match" }));
                  if (setScreen) setScreen("home");
                }}
                style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 36px", borderRadius:ip?2:10, cursor:"pointer", transition:"all 0.2s" }}
                onMouseEnter={e=>{e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";}}
                onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;}}
              >✕ QUIT</button>
            </div>
          </div>
        </div>
      )}

      {showSurrender && (
        <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
          <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:2}px solid ${t.danger}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:`0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${t.danger}22` }}>
            <div style={{ fontSize:44, marginBottom:20 }}>⚑</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.danger, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to forfeit this Match?</div>
            <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>{isRankedGame?<>This counts as a <span style={{color:t.danger,fontWeight:700}}>forfeit</span> and will result in <span style={{color:t.danger,fontWeight:700}}>ELO deduction</span>.</>:"Your opponent will be declared the winner."}</div>
            <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
              <button className="action-btn" onClick={()=>{setShowSurrender(false);if(setScreen)setScreen("home");}} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES, FORFEIT</button>
              <button className="action-btn" onClick={()=>{playClick?.();pausedRef.current=false;setShowSurrender(false);}} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO, STAY</button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="overlay-backdrop" style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.88)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
          <div className="overlay-modal" style={{ background:t.bgPanel, border:`${ip?3:1}px solid ${t.border}`, borderRadius:ip?2:20, padding:ip?"32px 36px":"48px 56px", maxWidth:520, width:"90vw", textAlign:"center", boxShadow:"0 40px 100px rgba(0,0,0,0.7)" }}>
            <div style={{ fontSize:44, marginBottom:20 }}>⚠️</div>
            <div style={{ fontFamily:t.fontDisplay, fontSize:ip?14:23, fontWeight:700, color:t.text, lineHeight:1.5, marginBottom:12 }}>Are you sure you want to quit the current session?</div>
            <div style={{ fontFamily:t.fontBody, fontSize:ip?11:15, color:t.textMuted, marginBottom:36, lineHeight:1.7 }}>Current game progress will be lost.</div>
            <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
              <button className="action-btn" onClick={()=>{setShowExitConfirm(false);if(setScreen)setScreen("home");}} style={{ background:`${t.danger}18`, border:`2px solid ${t.danger}`, color:t.danger, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.danger;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.danger}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.danger}18`;e.currentTarget.style.color=t.danger;e.currentTarget.style.boxShadow="none";}}>YES</button>
              <button className="action-btn" onClick={()=>{playClick?.();pausedRef.current=false;setShowExitConfirm(false);}} style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:ip?12:17, fontWeight:700, padding:ip?"10px 28px":"14px 52px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.08em" }} onMouseEnter={e=>{playHover?.();e.currentTarget.style.background=t.accent;e.currentTarget.style.color="#000";e.currentTarget.style.boxShadow=`0 6px 28px ${t.accent}55`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${t.accent}18`;e.currentTarget.style.color=t.accent;e.currentTarget.style.boxShadow="none";}}>NO</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes heatDrift0{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,18px) scale(1.1)}}
        @keyframes heatDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-15px,8px) scale(0.95)}}
        @keyframes heatDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(8px,-12px) scale(1.08)}}
        @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7),inset 0 0 16px rgba(255,40,0,0.2)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes rbLetterIn{from{opacity:0;transform:translateY(40px) scaleY(1.4)}to{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes rbSubIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
        @keyframes rbRingPulse{from{opacity:0;transform:scale(0.3)}to{opacity:1;transform:scale(1)}}
        @keyframes winPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.82;transform:scale(1.03)}}
        @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes coinReveal{from{opacity:0;transform:scale(0.5) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
        @keyframes cardSlideIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes spinRing{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes botPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
        @keyframes winCellPulse{0%,100%{background:color-mix(in srgb, var(--win-col) 28%, transparent);box-shadow:0 0 8px color-mix(in srgb, var(--win-col) 44%, transparent)}50%{background:color-mix(in srgb, var(--win-col) 60%, transparent);box-shadow:0 0 22px color-mix(in srgb, var(--win-col) 80%, transparent)}}
        .win-cell-pulse{animation:winCellPulse 0.75s ease-in-out infinite}
        .overlay-modal{animation:scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both}
        .overlay-backdrop{animation:fadeIn 0.3s ease both}
        .phase-screen{animation:fadeUp 0.42s cubic-bezier(.22,.68,0,1.2) both}
        .action-btn{transition:background 0.25s cubic-bezier(.22,.68,0,1.2),color 0.25s cubic-bezier(.22,.68,0,1.2),transform 0.2s cubic-bezier(.22,.68,0,1.2),box-shadow 0.25s cubic-bezier(.22,.68,0,1.2) !important}
        .action-btn:hover{transform:scale(1.05) !important}
        .action-btn:active{transform:scale(0.97) !important}
        @keyframes iceD0{from{transform:translate(0,0)}to{transform:translate(8px,12px)}}
        @keyframes iceD1{from{transform:translate(0,0)}to{transform:translate(-10px,6px)}}
        @keyframes iceD2{from{transform:translate(0,0)}to{transform:translate(6px,-9px)}}
        @keyframes iceWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(100,200,255,0.3)}50%{box-shadow:0 0 28px rgba(100,200,255,0.7),inset 0 0 16px rgba(60,160,255,0.2)}}
      `}</style>
    </div>
  );
}