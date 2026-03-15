"use client";
import React, { useState, useEffect, useRef, memo } from "react";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type Phase =
  | "playing" | "waiting_ready" | "match_over"
  | "rb_splash" | "rb_coin"
  | "rule_choice" | "who_first_winner" | "c3_choice"
  | "c3_choice_loser" | "who_first_loser" | "toss_summary";

// ─── Piece ────────────────────────────────────────────────────────────────────

export function Piece({ symbol, color, size }: { symbol: string; color: string; size?: string | number }) {
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

// ─── Red board helpers ────────────────────────────────────────────────────────

export function Embers({ count = 8 }: { count?: number }) {
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

export function HeatOverlay() {
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

// ── Wrapped in memo: SVG draw animations must NOT restart on re-render ────────

export const Flame = memo(function Flame({ size, cssSize }: { size?: number; cssSize?: string }) {
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
});

export const Skull = memo(function Skull({ size, cssSize }: { size?: number; cssSize?: string }) {
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
});

export const RedCell = React.memo(function RedCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useFlameSkull, useSnowflakeShard, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useFlameSkull: boolean; useSnowflakeShard: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
  onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const isP1 = player === "P1";
  const ref = useRef<HTMLDivElement>(null);
  const numSizeRef = useRef(80);
  useEffect(() => {
    if (!ref.current) return;
    numSizeRef.current = ref.current.offsetWidth || 80;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) numSizeRef.current = w;
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const ec = isP1 ? p1c : p2c;
  const renderPiece = (slot: "P1" | "P2") => {
    if (useFlameSkull) return slot === "P1" ? <Flame size={numSizeRef.current}/> : <Skull size={numSizeRef.current}/>;
    if (useSnowflakeShard) return slot === "P1" ? <SnowflakePiece size={numSizeRef.current}/> : <IceShardPiece size={numSizeRef.current}/>;
    const sc = slot === "P1" ? p1c : p2c;
    return <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:sc, textShadow:`0 0 14px ${sc}88`, position:"relative", zIndex:4 }}>{slot === "P1" ? pieceSymbols.p1 : pieceSymbols.p2}</span>;
  };
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
      {player === "P1" && renderPiece("P1")}
      {player === "P2" && renderPiece("P2")}
      {!player && blk && <span style={{ fontSize:"clamp(14px,2.5vmin,28px)", color:"#AA0000", position:"relative", zIndex:5 }}>✕</span>}
    </div>
  );
});

// ─── Ice board helpers ────────────────────────────────────────────────────────

export function FrostCrystals() {
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

export function IceOverlay() {
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

export const SnowflakePiece = memo(function SnowflakePiece({ size, cssSize }: { size?: number; cssSize?: string }) {
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
});

export const IceShardPiece = memo(function IceShardPiece({ size, cssSize }: { size?: number; cssSize?: string }) {
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
});

export const IceCell = React.memo(function IceCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useFlameSkull, useSnowflakeShard, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useFlameSkull: boolean; useSnowflakeShard: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
  onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const isP1 = player === "P1";
  const ref = useRef<HTMLDivElement>(null);
  const numSizeRef = useRef(80);
  useEffect(() => {
    if (!ref.current) return;
    numSizeRef.current = ref.current.offsetWidth || 80;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) numSizeRef.current = w;
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const ec = isP1 ? p1c : p2c;
  const renderPiece = (slot: "P1" | "P2") => {
    if (useFlameSkull) return slot === "P1" ? <Flame size={numSizeRef.current}/> : <Skull size={numSizeRef.current}/>;
    if (useSnowflakeShard) return slot === "P1" ? <SnowflakePiece size={numSizeRef.current}/> : <IceShardPiece size={numSizeRef.current}/>;
    const sc = slot === "P1" ? p1c : p2c;
    return <span style={{ fontFamily:fontDisplay, fontSize:"clamp(24px,5.5vmin,58px)", fontWeight:700, color:sc, textShadow:`0 0 14px ${sc}88`, position:"relative", zIndex:4 }}>{slot === "P1" ? pieceSymbols.p1 : pieceSymbols.p2}</span>;
  };
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
      {player === "P1" && renderPiece("P1")}
      {player === "P2" && renderPiece("P2")}
      {!player && blk && <span style={{ fontSize:"clamp(14px,2.5vmin,28px)", color:"#0066BB", position:"relative", zIndex:5 }}>✕</span>}
    </div>
  );
});

// ─── CoinFace ─────────────────────────────────────────────────────────────────

export function CoinFace({ type, size = 82 }: { type: "PENTA" | "PROTO"; size?: number }) {
  const isPenta = type === "PENTA";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: isPenta ? "#ffffff" : "#0a0a0a", boxShadow: isPenta ? "inset 0 0 12px rgba(0,0,0,0.15)" : "inset 0 0 12px rgba(255,200,50,0.1)" }}>
      <img src={isPenta ? "/penta-coin.png" : "/proto-coin.png"} alt={type} width={size} height={size} style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}/>
    </div>
  );
}

// ─── TossCard ─────────────────────────────────────────────────────────────────

interface TossCardProps {
  label: string; onClick: () => void; delay: number; actorCol: string; bgCard: string;
  borderCol: string; textCol: string; fontDisplay: string; ip: boolean;
}
export const TossCard = memo(function TossCard({ label, onClick, delay, actorCol, bgCard, borderCol, textCol, fontDisplay, ip }: TossCardProps) {
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