"use client";
import React, { useState, useEffect, useRef } from "react";

const DEFAULT_SIZE = 5;
const GET_COLS = (s: number) => Array.from({ length: s }, (_, i) => String.fromCharCode(65 + i));
const GET_ROWS = (s: number) => Array.from({ length: s }, (_, i) => i + 1);




import { ThemeId, THEMES } from "@/lib/themes";

function useCellSize(size: number, pad = 8) {
  const [cs, setCs] = useState(110);
  useEffect(() => {
    const c = () => {
      const b = Math.min(Math.max(window.innerWidth - 560, 260), Math.max(window.innerHeight - 200, 260));
      setCs(Math.max(50, (b - 2 * pad) / size));
    };
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [pad, size]);
  return cs;
}

function Embers({ count = 10 }: { count?: number }) {
  const embers = useRef(Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 90 + 5,
    y: 70 + Math.random() * 30, size: Math.random() * 2 + 1,
    dur: Math.random() * 3 + 3, delay: Math.random() * 4,
    opacity: Math.random() * 0.5 + 0.2,
  })));
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {embers.current.map(e => (
        <circle key={e.id} cx={`${e.x}%`} cy={`${e.y}%`} r={e.size}
          fill={`rgba(255,${60 + Math.floor(Math.random() * 80)},0,0.8)`}>
          <animate attributeName="cy" values={`${e.y}%;${e.y - 30}%;${e.y - 60}%`} dur={`${e.dur}s`} begin={`${e.delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values={`${e.opacity};${e.opacity * 0.5};0`} dur={`${e.dur}s`} begin={`${e.delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function RedPiece({
  player,
  p1Symbol = "+",
  p2Symbol = "○",
  delay = 0,
  win = false,
}: {
  player: string;
  p1Symbol?: string;
  p2Symbol?: string;
  delay?: number;
  win?: boolean;
}) {
  const isP1 = player === "P1";
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return null;

  const col  = isP1 ? "#ffcc99" : "#ff3300";
  const gl   = isP1 ? "#ffb366" : "#cc0000";
  const ring = isP1 ? "#ffffff" : "#ff9999";
  const sym  = isP1 ? p1Symbol : p2Symbol;

  return (
    <div style={{
      width: "60%", height: "60%", borderRadius: "50%",
      background: `radial-gradient(circle at 30% 30%, ${col}, ${gl} 70%)`,
      boxShadow: `0 0 ${win ? 24 : 15}px ${gl}, inset 0 0 10px rgba(0,0,0,0.5)`,
      border: `2px solid ${ring}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: win
        ? "redWinPulse 0.9s ease-in-out infinite"
        : "redDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both",
      fontFamily: "'Courier New', monospace",
      fontWeight: 900,
      fontSize: "clamp(11px, 2.6vmin, 24px)",
      color: ring,
      textShadow: `0 0 8px ${ring}88`,
    }}>
      <style>{`
        @keyframes redDrop     { from{transform:scale(2) translateY(-20px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        @keyframes redWinPulse { 0%,100%{transform:scale(1);filter:brightness(1)} 50%{transform:scale(1.15);filter:brightness(1.4)} }
      `}</style>
      {sym}
    </div>
  );
}

export default function RedGrid({ board, onCellClickAction, winCells = [], showLabels = true }: { board?: (string | null)[][]; onCellClickAction?: (r: number, c: number) => void; winCells?: [number, number][]; showLabels?: boolean }) {
  const active = board ?? Array(DEFAULT_SIZE).fill(null).map(() => Array(DEFAULT_SIZE).fill(null));
  const SIZE = active.length;
  const COLS = GET_COLS(SIZE);
  const ROWS = GET_ROWS(SIZE);
  const PAD = 8;
  const CS = useCellSize(SIZE, PAD);
  const BS = SIZE * CS + 2 * PAD;

  const [hov, setHov] = useState<string | null>(null);

  const redTheme = {
    boardBg:     "#140300",
    boardLine:   "#330b00",
    border:      "#4d1000",
    borderAccent:"#992200",
    accentGlow:  "#ff6633",
  };

  return (
    <div style={{
      width: "100%", maxWidth: 420, aspectRatio: "1", position: "relative",
      background: redTheme.boardBg, borderRadius: 12,
      border: `2px solid ${redTheme.boardLine}`,
      boxShadow: `0 0 40px rgba(204,0,0,0.1), inset 0 0 20px rgba(0,0,0,0.8)`,
      overflow: "hidden", margin: "0 auto",
    }}>
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, transparent 40%, rgba(255,50,0,0.03) 100%)`, pointerEvents: "none" }} />
      <Embers count={12} />

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${SIZE},1fr)`,
        gridTemplateRows: `repeat(${SIZE},1fr)`,
        width: "100%", height: "100%",
        padding: 8, gap: 4,
        position: "relative", zIndex: 1,
      }}>
        {active.map((row, r) => row.map((cell, c) => {
          const key = `${r}-${c}`;
          const isHov = hov === key;
          const isWin = winCells?.some(([wr, wc]) => wr === r && wc === c);
          return (
            <div key={key}
              onMouseEnter={() => setHov(key)}
              onMouseLeave={() => setHov(null)}
              onClick={() => onCellClickAction?.(r, c)}
              style={{
                background: cell
                  ? "rgba(0,0,0,0.4)"
                  : isHov
                    ? "rgba(255,50,0,0.1)"
                    : "rgba(255,50,0,0.02)",
                border: `1px solid ${
                  isWin
                    ? redTheme.accentGlow
                    : isHov
                      ? "rgba(255,50,0,0.4)"
                      : "rgba(255,50,0,0.1)"
                }`,
                borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
                cursor: cell ? "default" : "pointer",
                boxShadow: isWin
                  ? `0 0 15px rgba(255,50,0,0.5), inset 0 0 10px rgba(255,50,0,0.2)`
                  : isHov && !cell
                    ? `inset 0 0 8px rgba(255,50,0,0.2)`
                    : "none",
              }}
            >
              {!cell && isHov && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,50,0,0.6)", filter: "blur(2px)" }} />
              )}
              {cell && (
                <RedPiece
                  player={cell}
                  win={isWin}
                />
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
