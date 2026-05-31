"use client";
import React, { useState, useEffect, useRef, memo } from "react";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type Phase =
  | "playing" | "waiting_ready" | "match_over"
  | "rb_splash" | "rb_coin"
  | "rule_choice" | "who_first_winner" | "c3_choice"
  | "c3_choice_loser" | "who_first_loser" | "toss_summary" | "rb_initializing"
  | "ban_pattern_winner" | "ban_pattern_loser" | "grid_block_warning" | "grid_block_selection" | "grid_block_waiting";

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

export const RedCell = React.memo(function RedCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useFlameSkull, useSnowflakeShard, useGlacierSigils, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useFlameSkull: boolean; useSnowflakeShard: boolean; useGlacierSigils: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
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
    if (useGlacierSigils) return slot === "P1" ? <GlacierSigilPiece size={numSizeRef.current}/> : <GlacierPrismPiece size={numSizeRef.current}/>;
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

export function GlacierAurora() {
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:0, borderRadius:"inherit", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:"-6%", left:"-8%", width:"70%", height:"38%", borderRadius:"50%", background:"radial-gradient(ellipse at center, rgba(0,220,180,0.16), transparent 70%)", filter:"blur(22px)", animation:"glAurora1 9s ease-in-out infinite alternate" }} />
      <div style={{ position:"absolute", top:"-2%", right:"-8%", width:"72%", height:"36%", borderRadius:"50%", background:"radial-gradient(ellipse at center, rgba(60,120,255,0.14), transparent 72%)", filter:"blur(24px)", animation:"glAurora2 11s ease-in-out infinite alternate" }} />
      <div style={{ position:"absolute", top:"10%", left:"18%", width:"62%", height:"30%", borderRadius:"50%", background:"radial-gradient(ellipse at center, rgba(140,80,255,0.08), transparent 74%)", filter:"blur(20px)", animation:"glAurora3 10s ease-in-out infinite alternate" }} />
    </div>
  );
}

export function GlacierSnow({ count = 18 }: { count?: number }) {
  const flakes = useRef(Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    d: Math.random() * 9 + 6,
    delay: -(Math.random() * 12),
    s: Math.random() * 1.8 + 0.8,
    dx: (Math.random() - 0.5) * 40,
  })));
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:1, overflow:"hidden" }}>
      <style>{`@keyframes glSnowFall{0%{transform:translateY(-8px) translateX(0px);opacity:0}8%{opacity:.88}85%{opacity:.45}100%{transform:translateY(800px) translateX(var(--gl-dx,12px));opacity:0}}`}</style>
      {flakes.current.map(f => (
        <span
          key={f.id}
          style={{
            position:"absolute",
            left:`${f.x}%`,
            top:0,
            width:f.s,
            height:f.s,
            borderRadius:"50%",
            background:"rgba(220,245,255,0.92)",
            boxShadow:"0 0 5px rgba(200,240,255,0.75)",
            ["--gl-dx" as string]:`${f.dx}px`,
            animation:`glSnowFall ${f.d}s linear ${f.delay}s infinite`,
          }}
        />
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

// Glacier Sigil — 6-arm snowflake matching GlacierGrid store preview exactly
export const GlacierSigilPiece = memo(function GlacierSigilPiece({ size, cssSize }: { size?: number; cssSize?: string }) {
  const s = cssSize ?? `${(size ?? 80) * 0.58}px`;
  const glow = "drop-shadow(0 0 6px #7dd3fc) drop-shadow(0 0 18px rgba(125,211,252,.7))";
  const arms = [0, 60, 120, 180, 240, 300];
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "gsfIn .55s cubic-bezier(.175,.885,.32,1.275) forwards" }}>
      <style>{`@keyframes gsfIn{0%{transform:scale(0) rotate(-120deg);opacity:0}60%{transform:scale(1.22) rotate(15deg);opacity:1}80%{transform:scale(.9) rotate(-5deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <g transform="translate(24,24)">
        {arms.map((a, i) => (
          <g key={a} transform={`rotate(${a})`} opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur=".05s" begin={`${0.04 * i}s`} fill="freeze" />
            <line x1="0" y1="-19" x2="0" y2="19" stroke="#7dd3fc" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="-4.5" y1="-11" x2="0" y2="-11" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="4.5" y1="-11" x2="0" y2="-11" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="-3" y1="-6" x2="0" y2="-6" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" />
            <line x1="3" y1="-6" x2="0" y2="-6" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" />
            <polygon points="0,-19 -2,-15 0,-21 2,-15" fill="#e0f2fe" opacity=".7" />
          </g>
        ))}
        <circle cx="0" cy="0" r="2.5" fill="#e0f2fe" opacity="0">
          <animate attributeName="opacity" values="0;1;.5;1;.8" dur=".4s" begin=".28s" fill="freeze" />
          <animate attributeName="r" values="2;3.5;2" dur="2.5s" begin=".5s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
});

// Glacier Prism — tall tapered diamond matching GlacierGrid store preview exactly
export const GlacierPrismPiece = memo(function GlacierPrismPiece({ size, cssSize }: { size?: number; cssSize?: string }) {
  const s = cssSize ?? `${(size ?? 80) * 0.58}px`;
  const glow = "drop-shadow(0 0 6px #93c5fd) drop-shadow(0 0 18px rgba(147,197,253,.7))";
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" style={{ position: "absolute", zIndex: 6, filter: glow, animation: "gisIn .45s cubic-bezier(.34,1.56,.64,1) forwards" }}>
      <style>{`@keyframes gisIn{0%{transform:scale(0) rotate(30deg);opacity:0}58%{transform:scale(1.18) rotate(-5deg);opacity:1}80%{transform:scale(.93) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}}`}</style>
      <path d="M24,4 L28,20 L24,44 L20,20 Z" fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinejoin="round" strokeDasharray="68" strokeDashoffset="68">
        <animate attributeName="stroke-dashoffset" from="68" to="0" dur=".2s" fill="freeze" />
      </path>
      <path d="M24,4 L28,20 L24,44 L20,20 Z" fill="#93c5fd" opacity="0">
        <animate attributeName="opacity" from="0" to=".12" dur=".07s" begin=".18s" fill="freeze" />
      </path>
      <path d="M8,10 L16,22 L14,38 L8,24 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="50" strokeDashoffset="50">
        <animate attributeName="stroke-dashoffset" from="50" to="0" dur=".16s" begin=".16s" fill="freeze" />
      </path>
      <path d="M40,10 L32,22 L34,38 L40,24 Z" fill="none" stroke="#bfdbfe" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="50" strokeDashoffset="50">
        <animate attributeName="stroke-dashoffset" from="50" to="0" dur=".16s" begin=".16s" fill="freeze" />
      </path>
      <line x1="24" y1="4" x2="28" y2="20" stroke="white" strokeWidth=".7" opacity="0">
        <animate attributeName="opacity" from="0" to=".5" dur=".06s" begin=".22s" fill="freeze" />
      </line>
      <circle cx="24" cy="4" r="2.5" fill="#e0f2fe" opacity="0">
        <animate attributeName="opacity" values="0;1;.4;1;0" dur="2.2s" begin=".28s" repeatCount="indefinite" />
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

export const IceCell = React.memo(function IceCell({ cellSize, player, isWinCell, isHov, canPlay, blk, useFlameSkull, useSnowflakeShard, useGlacierSigils, pieceSymbols, p1c, p2c, fontDisplay, onClick, onMouseEnter, onMouseLeave }: {
  cellSize: string; player: string | null; isWinCell: boolean; isHov: boolean; canPlay: boolean; blk: boolean;
  useFlameSkull: boolean; useSnowflakeShard: boolean; useGlacierSigils: boolean; pieceSymbols: { p1: string; p2: string }; p1c: string; p2c: string; fontDisplay: string;
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
    if (useGlacierSigils) return slot === "P1" ? <GlacierSigilPiece size={numSizeRef.current}/> : <GlacierPrismPiece size={numSizeRef.current}/>;
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

// Canvas-based animated crystalline grid lines — matches GlacierGrid store preview exactly
export function GlacierGridLines() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tc = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const cv = canvasRef.current;
    if (!container || !cv) return;

    const startDraw = (W: number, H: number) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const tw = Math.round(W * dpr), th = Math.round(H * dpr);
      if (cv.width !== tw || cv.height !== th) { cv.width = tw; cv.height = th; }
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      const ctx = cv.getContext("2d", { alpha: true, willReadFrequently: false });
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const loop = () => {
        tc.current += 0.014;
        const t = tc.current;
        ctx.clearRect(0, 0, W, H);

        for (let i = 0; i <= 5; i++) {
          const x = (i / 5) * W;
          const y = (i / 5) * H;
          const icy = 0.6 + 0.4 * Math.sin(t * 1.0 + i * 0.9);

          // Vertical ice-white lines
          ctx.save();
          ctx.strokeStyle = `rgba(160,230,255,${0.2 * icy})`;
          ctx.lineWidth = 9;
          ctx.shadowColor = "rgba(180,240,255,0.7)";
          ctx.shadowBlur = 24;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = `rgba(200,240,255,${0.72 * icy})`;
          ctx.lineWidth = 4;
          ctx.shadowColor = "rgba(220,250,255,1)";
          ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = `rgba(240,250,255,${0.92 * icy})`;
          ctx.lineWidth = 1.2;
          ctx.shadowColor = "rgba(255,255,255,0.9)";
          ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          ctx.restore();

          // Horizontal aurora-teal lines
          ctx.save();
          ctx.strokeStyle = `rgba(0,190,170,${0.18 * icy})`;
          ctx.lineWidth = 9;
          ctx.shadowColor = "rgba(0,220,200,0.7)";
          ctx.shadowBlur = 24;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = `rgba(0,220,200,${0.7 * icy})`;
          ctx.lineWidth = 4;
          ctx.shadowColor = "rgba(80,240,220,1)";
          ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.restore();
          ctx.save();
          ctx.strokeStyle = `rgba(180,255,248,${0.9 * icy})`;
          ctx.lineWidth = 1.2;
          ctx.shadowColor = "rgba(255,255,255,0.9)";
          ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.restore();
        }

        // Frost-star sparkles at intersections
        for (let r = 0; r <= 5; r++) {
          for (let c = 0; c <= 5; c++) {
            const nx = (c / 5) * W;
            const ny = (r / 5) * H;
            const sp = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + (r * 6 + c) * 0.9));
            ctx.save();
            ctx.translate(nx, ny);
            ctx.globalAlpha = sp * 0.9;
            ctx.strokeStyle = "rgba(220,250,255,0.9)";
            ctx.lineWidth = 1.2;
            ctx.shadowColor = "rgba(200,240,255,1)";
            ctx.shadowBlur = 14 * sp;
            const sz = Math.max(W, H) * 0.012 + sp * Math.max(W, H) * 0.008;
            [0, 60, 120].forEach(a => {
              const rad = (a * Math.PI) / 180;
              ctx.beginPath();
              ctx.moveTo(-Math.cos(rad) * sz, -Math.sin(rad) * sz);
              ctx.lineTo(Math.cos(rad) * sz, Math.sin(rad) * sz);
              ctx.stroke();
            });
            ctx.fillStyle = `rgba(240,255,255,${0.9 * sp})`;
            ctx.shadowBlur = 12 * sp;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(W, H) * 0.004, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    };

    let W = container.offsetWidth;
    let H = container.offsetHeight;
    if (W > 0 && H > 0) startDraw(W, H);

    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      if (Math.abs(rect.width - W) < 2 && Math.abs(rect.height - H) < 2) return;
      W = rect.width;
      H = rect.height;
      if (W > 0 && H > 0) startDraw(W, H);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    </div>
  );
}