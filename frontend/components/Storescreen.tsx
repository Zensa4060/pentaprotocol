"use client";
import { useState, useRef, useEffect } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { PROTO_DARK_SVG } from "@/lib/currencyIcons";
import {
  Embers, HeatOverlay, FrostCrystals, IceOverlay,
  Flame, Skull, SnowflakePiece, IceShardPiece,
  RedCell, IceCell,
} from "./GamePieces";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
}

const PACKAGES = [
  { id: "starter", credits: 100,  price: 49,  bonus: 0,   label: "STARTER", popular: false, desc: "Try it out" },
  { id: "plus",    credits: 500,  price: 199, bonus: 50,  label: "PLUS",    popular: true,  desc: "Most popular" },
  { id: "pro",     credits: 1200, price: 399, bonus: 200, label: "PRO",     popular: false, desc: "Best value" },
  { id: "elite",   credits: 3000, price: 799, bonus: 600, label: "ELITE",   popular: false, desc: "Power user" },
];

declare global { interface Window { Razorpay: any; } }

const STORE_THEMES = [
  { id: "space",         label: "Space",         desc: "Deep space atmosphere",         preview: "linear-gradient(135deg,#020410,#0d1b4b)", unlock: "Coming Soon" },
  { id: "pixel",         label: "Pixel",         desc: "Retro pixel art style",         preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", unlock: "Coming Soon" },
];

const STORE_BOARD_SKINS: { id: string; label: string; desc: string; preview: string; border?: string; unlock: string; price: number }[] = [
  { id: "default",  label: "Normal",   desc: "Clean default board",                 preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", unlock: "Free",    price: 0    },
  { id: "red_grid", label: "Inferno", desc: "A glowing grid of pure energy",       preview: "linear-gradient(135deg,#220803,#1a0400)", border: "#992200", unlock: "1599 PC", price: 1599 },
  { id: "ice_grid", label: "Glacier", desc: "A crystalline grid of frozen energy", preview: "linear-gradient(135deg,#01040e,#01081c)", border: "#50a0dc", unlock: "1599 PC", price: 1599 },
];

const STORE_BANNERS = [
  { id: "default", label: "Default", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", unlock: "Free" },
];

const STORE_BORDERS = [
  { id: "default_border", label: "None", desc: "No border around profile", preview: "transparent", unlock: "Free" }
];

function ProtoSVG({ size = 16, color }: { size?: number, color?: string }) {
  // If color is passed, we shouldn't necessarily override since it's an SVG string, but we can set fill/stroke via CSS or just use standard SVG.
  // The svg string has its own colors. 
  return <div style={{ width: size, height: size, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: PROTO_DARK_SVG.replace("<svg ", `<svg width="${size}" height="${size}" `) }} />;
}

type Bundle = {
  id: string; label: string; tagline: string; desc: string;
  boardId: string; pieceId: string; boardLabel: string; pieceLabel: string;
  accentColor: string; bgGradient: string;
  bundlePrice: number; boardPrice: number; piecePrice: number; tags: string[];
  isIce: boolean;
};

const BUNDLES: Bundle[] = [
  {
    id: "bundle_fire", label: "INFERNO BUNDLE", tagline: "Command fire and death",
    desc: "A smoldering battlefield pulsing with crimson energy. Flame surges with living light, the skull stares through the void. Built for the relentless.",
    boardId: "red_grid", pieceId: "piece_flame_skull", boardLabel: "Inferno", pieceLabel: "Flame & Skull",
    accentColor: "#FF3300", bgGradient: "linear-gradient(160deg,#140200,#2a0600,#1a0300)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["FIRE THEME", "ANIMATED", "BOARD + PIECES"], isIce: false,
  },
  {
    id: "bundle_ice", label: "GLACIER BUNDLE", tagline: "Cool, calculated, absolutely deadly",
    desc: "Crystalline frost spreads across the board. Snowflake geometry meets ice shard aggression. Built for the strategist who plays cold.",
    boardId: "ice_grid", pieceId: "piece_snowflake_shard", boardLabel: "Glacier", pieceLabel: "Snow & Shard",
    accentColor: "#50a0dc", bgGradient: "linear-gradient(160deg,#010c1f,#01152e,#010a1a)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["ICE THEME", "CRYSTALLINE", "BOARD + PIECES"], isIce: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function SectionHeader({ label, icon, accent }: { label: string; icon: React.ReactNode; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text)", letterSpacing: "0.04em" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)", marginLeft: 8 }} />
    </div>
  );
}

function UnlockBadge({ text, accent }: { text: string; accent: string }) {
  const isFree = text === "Free" || text === "FREE";
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: isFree ? "#4CAF50" : accent, background: isFree ? "#4CAF5018" : `${accent}18`, border: `1px solid ${isFree ? "#4CAF5044" : accent + "44"}`, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", whiteSpace: "nowrap" as const }}>
      {isFree ? "FREE" : text.toUpperCase()}
    </span>
  );
}

// ── Real board preview using actual GamePieces components ──────────────────────
function BundleAnimatedPreview({ bundle, tick }: { bundle: Bundle; tick: number }) {
  const GRID = 5;
  const CELL = "52px";

  const p1Cells = [12, 6, 18, 2, 22];
  const p2Cells = [8, 16, 4, 20, 10];
  const totalMoves = p1Cells.length + p2Cells.length;
  const move = tick % (totalMoves + 5);

  const placedP1 = new Set<number>();
  const placedP2 = new Set<number>();
  for (let i = 0; i < move && i < totalMoves; i++) {
    if (i % 2 === 0) placedP1.add(p1Cells[Math.floor(i / 2)]);
    else             placedP2.add(p2Cells[Math.floor(i / 2)]);
  }

  const board: (string | null)[][] = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => {
      const idx = r * GRID + c;
      if (placedP1.has(idx)) return "P1";
      if (placedP2.has(idx)) return "P2";
      return null;
    })
  );

  const p1c = bundle.isIce ? "#C8EEFF" : "#FF4400";
  const p2c = bundle.isIce ? "#64C8FF" : "#BBBBBB";
  const useFlameSkull     = !bundle.isIce;
  const useSnowflakeShard = bundle.isIce;
  const pieceSymbols = { p1: bundle.isIce ? "❄" : "🔥", p2: bundle.isIce ? "◆" : "💀" };

  return (
    <div style={{
      width: "100%",
      background: bundle.isIce ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : "rgba(10,2,1,0.99)",
      borderRadius: 12,
      border: `2px solid ${bundle.isIce ? "rgba(80,160,220,0.28)" : "rgba(140,20,0,0.35)"}`,
      boxShadow: bundle.isIce ? "0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)" : "0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)",
      padding: 6, position: "relative", overflow: "hidden",
    }}>
      {!bundle.isIce && <Embers count={16} />}
      {!bundle.isIce && <HeatOverlay />}
      {bundle.isIce  && <FrostCrystals />}
      {bundle.isIce  && <IceOverlay />}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${CELL})`, gridTemplateRows: `repeat(${GRID}, ${CELL})`, gap: 4, position: "relative", zIndex: 2 }}>
        {board.map((row, r) => row.map((cell, c) => {
          const noop = () => {};
          const cellKey = `${r}-${c}`;
          const sharedProps = { cellSize: CELL, player: cell, isWinCell: false, isHov: false, canPlay: false, blk: false, pieceSymbols, p1c, p2c, fontDisplay: "'Courier New', monospace", onClick: noop, onMouseEnter: noop, onMouseLeave: noop };
          if (bundle.isIce) return <IceCell key={cellKey} {...sharedProps} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} />;
          return <RedCell key={cellKey} {...sharedProps} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} />;
        }))}
      </div>
      <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: bundle.isIce ? "rgba(140,210,255,0.55)" : "rgba(200,60,40,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
      <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: bundle.isIce ? "rgba(100,200,255,0.45)" : "rgba(180,40,0,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
    </div>
  );
}

// ── Bundle Preview Modal ───────────────────────────────────────────────────────
function BundleModal({ bundle, t, isGuest, buyingId, purchasedItems, balance, onClose, onBuy, onOpenBuyCredits }: {
  bundle: Bundle; t: any; isGuest: boolean; buyingId: string | null;
  purchasedItems: string[]; balance: number;
  onClose: () => void; onBuy: (id: string, price: number, label: string) => void; onOpenBuyCredits: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [hovOpt, setHovOpt] = useState<string | null>(null);
  useEffect(() => { const iv = setInterval(() => setTick(v => v + 1), 900); return () => clearInterval(iv); }, []);

  const ownsBoard  = purchasedItems.includes(bundle.boardId);
  const ownsPiece  = purchasedItems.includes(bundle.pieceId);
  const ownsBundle = ownsBoard && ownsPiece;
  const ac = bundle.accentColor;

  const options = [
    {
      id: "bundle",
      label: ownsBoard ? `Add ${bundle.pieceLabel}` : ownsPiece ? `Add ${bundle.boardLabel}` : "Buy Bundle",
      sublabel: ownsBoard || ownsPiece ? "Complete your set" : `Save ${bundle.boardPrice + bundle.piecePrice - bundle.bundlePrice} vs buying separate`,
      price: ownsBoard ? bundle.piecePrice : ownsPiece ? bundle.boardPrice : bundle.bundlePrice,
      includes: ownsBoard ? [bundle.pieceLabel] : ownsPiece ? [bundle.boardLabel] : [bundle.boardLabel, bundle.pieceLabel],
      disabled: ownsBundle, owned: ownsBundle, highlight: true,
      purchaseId: ownsBoard ? bundle.pieceId : ownsPiece ? bundle.boardId : "bundle_purchase_" + bundle.id,
    },
    { id: bundle.boardId, label: bundle.boardLabel, sublabel: "Board skin only", price: bundle.boardPrice, includes: [bundle.boardLabel], disabled: ownsBoard, owned: ownsBoard, highlight: false, purchaseId: bundle.boardId },
    { id: bundle.pieceId, label: bundle.pieceLabel, sublabel: "Piece skin only", price: bundle.piecePrice, includes: [bundle.pieceLabel], disabled: ownsPiece, owned: ownsPiece, highlight: false, purchaseId: bundle.pieceId },
  ];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.16s ease", overflowY: "auto" }}>
      <div style={{ background: bundle.bgGradient, border: `1.5px solid ${ac}44`, borderRadius: 22, width: "100%", maxWidth: 680, position: "relative", animation: "previewSlideUp 0.26s cubic-bezier(.22,.68,0,1.2)", overflow: "hidden", margin: "auto" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 400, height: 200, borderRadius: "50%", background: `${ac}14`, filter: "blur(60px)", pointerEvents: "none" }} />
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, zIndex: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${ac}44`, borderRadius: 8, color: "#fff", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

        <div style={{ padding: "24px 24px 0" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
            {bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}44`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}
            {ownsBoard  && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 7px", borderRadius: 4 }}>BOARD OWNED ✓</span>}
            {ownsPiece  && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 7px", borderRadius: 4 }}>PIECES OWNED ✓</span>}
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: `${ac}cc`, fontStyle: "italic", marginBottom: 14 }}>{bundle.tagline}</div>
          <BundleAnimatedPreview bundle={bundle} tick={tick} />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}2A`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 7, background: bundle.isIce ? "linear-gradient(135deg,rgba(5,12,25,0.96),rgba(2,7,16,0.98))" : "rgba(14,3,1,0.97)", border: `1.5px solid ${bundle.isIce ? "rgba(200,240,255,0.65)" : "rgba(255,80,0,0.7)"}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {bundle.isIce ? <SnowflakePiece size={42} /> : <Flame size={42} />}
              </div>
              <div><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}77`, letterSpacing: "0.12em" }}>P1 PIECE</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsPiece ? "#4CAF50" : "#fff" }}>{bundle.isIce ? "Snowflake" : "Flame"} {ownsPiece ? "✓" : ""}</div></div>
            </div>
            <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}2A`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 7, background: bundle.isIce ? "linear-gradient(135deg,rgba(5,12,25,0.96),rgba(2,7,16,0.98))" : "rgba(14,3,1,0.97)", border: `1.5px solid ${bundle.isIce ? "rgba(100,200,255,0.65)" : "rgba(200,0,0,0.7)"}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {bundle.isIce ? <IceShardPiece size={42} /> : <Skull size={42} />}
              </div>
              <div><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}77`, letterSpacing: "0.12em" }}>P2 PIECE</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsPiece ? "#4CAF50" : "#fff" }}>{bundle.isIce ? "Ice Shard" : "Skull"} {ownsPiece ? "✓" : ""}</div></div>
            </div>
            <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}2A`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 7, background: bundle.isIce ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : "rgba(10,2,1,0.99)", border: `1.5px solid ${bundle.isIce ? "rgba(80,160,220,0.35)" : "rgba(140,20,0,0.35)"}`, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, padding: 4, position: "relative", overflow: "hidden" }}>
                {bundle.isIce ? <FrostCrystals /> : <Embers count={4} />}
                {Array.from({ length: 9 }).map((_, i) => (<div key={i} style={{ background: bundle.isIce ? "rgba(80,160,220,0.12)" : "rgba(150,20,0,0.15)", border: `1px solid ${bundle.isIce ? "rgba(80,160,220,0.3)" : "rgba(150,20,0,0.3)"}`, borderRadius: 1 }} />))}
              </div>
              <div><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}77`, letterSpacing: "0.12em" }}>BOARD</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsBoard ? "#4CAF50" : "#fff" }}>{bundle.boardLabel} {ownsBoard ? "✓" : ""}</div></div>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 24px 0" }}>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 16 }}>{bundle.desc}</div>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: `${ac}77`, letterSpacing: "0.2em", marginBottom: 10 }}>PURCHASE OPTIONS</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {options.map(opt => {
              const isHov = hovOpt === opt.id && !opt.disabled;
              const isBuying = buyingId === opt.purchaseId || buyingId === opt.id;
              const canAfford = balance >= opt.price;
              return (
                <div key={opt.id} onMouseEnter={() => !opt.disabled && setHovOpt(opt.id)} onMouseLeave={() => setHovOpt(null)}
                  style={{ background: opt.owned ? "#4CAF5010" : opt.highlight ? `${ac}16` : "rgba(255,255,255,0.04)", border: `1.5px solid ${opt.owned ? "#4CAF5033" : opt.highlight ? `${ac}44` : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s", transform: isHov ? "translateX(4px)" : "none", boxShadow: opt.highlight && !opt.owned ? `0 0 18px ${ac}1E` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 800, color: opt.owned ? "#4CAF50" : "#fff" }}>{opt.label}</span>
                      {opt.highlight && !opt.owned && <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, color: "#000", background: ac, padding: "1px 6px", borderRadius: 8, letterSpacing: "0.08em" }}>BEST VALUE</span>}
                      {opt.owned && <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5033", padding: "1px 6px", borderRadius: 8 }}>OWNED</span>}
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 5 }}>{opt.sublabel}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
                      {opt.includes.map(inc => (<span key={inc} style={{ fontFamily: "monospace", fontSize: 9, color: opt.owned ? "#4CAF5077" : `${ac}88`, background: opt.owned ? "#4CAF5010" : `${ac}0C`, border: `1px solid ${opt.owned ? "#4CAF5022" : ac + "22"}`, padding: "1px 6px", borderRadius: 4 }}>+ {inc}</span>))}
                    </div>
                  </div>
                  {opt.owned ? (
                    <div style={{ fontFamily: "monospace", fontSize: 20, color: "#4CAF50" }}>✓</div>
                  ) : isGuest ? (
                    <button onClick={onClose} style={{ flexShrink: 0, background: ac, border: "none", borderRadius: 8, padding: "8px 14px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const }}>SIGN IN</button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: canAfford ? ac : "#EF4444", lineHeight: 1 }}>
                        {opt.price.toLocaleString()}
                        <ProtoSVG size={16} />
                      </div>
                      {!canAfford && <div style={{ fontFamily: "monospace", fontSize: 9, color: "#EF4444" }}>need {(opt.price - balance).toLocaleString()} more</div>}
                      <button disabled={isBuying}
                        onClick={() => { if (!canAfford) { onOpenBuyCredits(); return; } onBuy(opt.purchaseId, opt.price, opt.label); }}
                        style={{ background: isBuying ? `${ac}44` : canAfford ? ac : "#EF444422", border: `1.5px solid ${canAfford ? ac : "#EF4444"}`, borderRadius: 7, padding: "6px 13px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: isBuying ? "rgba(255,255,255,0.3)" : canAfford ? "#000" : "#EF4444", cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all 0.18s" }}>
                        {isBuying ? "..." : canAfford ? "UNLOCK" : "TOP UP"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!isGuest && (<div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.28)" }}>Your balance: <span style={{ color: ac, display: "flex", alignItems: "center", gap: 4 }}>{balance.toLocaleString()} <ProtoSVG size={14} /></span></div>)}
        </div>
      </div>
    </div>
  );
}

// ── Bundle Card ───────────────────────────────────────────────────────────────
function BundleCard({ bundle, purchasedItems, t, onClick }: { bundle: Bundle; purchasedItems: string[]; t: any; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const ownsBoard = purchasedItems.includes(bundle.boardId);
  const ownsPiece = purchasedItems.includes(bundle.pieceId);
  const ownsAll   = ownsBoard && ownsPiece;
  const ac = bundle.accentColor;

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: bundle.bgGradient, border: `2px solid ${hov ? ac : ac + "33"}`, borderRadius: 18, padding: "24px", cursor: "pointer", position: "relative", overflow: "hidden", transform: hov ? "translateY(-6px) scale(1.01)" : "none", boxShadow: hov ? `0 20px 60px ${ac}30, 0 0 0 1px ${ac}20` : `0 4px 20px ${ac}14`, transition: "all 0.28s cubic-bezier(.22,.68,0,1.2)" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `${ac}14`, filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "flex-end", maxWidth: 160 }}>
        {ownsAll ? <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 8px", borderRadius: 10 }}>FULLY OWNED ✓</span>
          : <>{ownsBoard && <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4CAF50", background: "#4CAF5010", border: "1px solid #4CAF5033", padding: "2px 6px", borderRadius: 8 }}>BOARD ✓</span>}{ownsPiece && <span style={{ fontFamily: "monospace", fontSize: 9, color: "#4CAF50", background: "#4CAF5010", border: "1px solid #4CAF5033", padding: "2px 6px", borderRadius: 8 }}>PIECES ✓</span>}</>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>
        {bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}33`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}
      </div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: `${ac}bb`, fontStyle: "italic", marginBottom: 16 }}>{bundle.tagline}</div>
      <div style={{ height: 72, borderRadius: 10, marginBottom: 14, overflow: "hidden", position: "relative", background: bundle.isIce ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : "rgba(10,2,1,0.99)", border: `1px solid ${bundle.isIce ? "rgba(80,160,220,0.28)" : "rgba(140,20,0,0.35)"}` }}>
        {!bundle.isIce && <Embers count={6} />}{!bundle.isIce && <HeatOverlay />}{bundle.isIce && <FrostCrystals />}{bundle.isIce && <IceOverlay />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2, padding: 6, height: "100%", position: "relative", zIndex: 2 }}>
          {Array.from({ length: 10 }).map((_, i) => (<div key={i} style={{ background: bundle.isIce ? "rgba(80,160,220,0.12)" : "rgba(150,20,0,0.15)", border: `1px solid ${bundle.isIce ? "rgba(80,160,220,0.3)" : "rgba(150,20,0,0.3)"}`, borderRadius: 2 }} />))}
        </div>
        {hov && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", zIndex: 10, fontFamily: "monospace", fontSize: 11, color: `${ac}cc`, letterSpacing: "0.1em" }}>CLICK TO PREVIEW →</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}1A`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 8, color: `${ac}66`, letterSpacing: "0.1em" }}>BOARD</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsBoard ? "#4CAF50" : "#fff" }}>{bundle.boardLabel} {ownsBoard ? "✓" : ""}</div></div>
        <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}1A`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 8, color: `${ac}66`, letterSpacing: "0.1em" }}>PIECES</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsPiece ? "#4CAF50" : "#fff" }}>{bundle.pieceLabel} {ownsPiece ? "✓" : ""}</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          {!ownsAll ? (
            <>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}66`, letterSpacing: "0.15em", marginBottom: 2 }}>FROM</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900, color: ac, lineHeight: 1 }}>
                {(ownsBoard ? bundle.piecePrice : ownsPiece ? bundle.boardPrice : bundle.bundlePrice).toLocaleString()}
                <ProtoSVG size={20} />
              </div>
            </>
          ) : (<div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: "#4CAF50" }}>Collection complete ✓</div>)}
        </div>
        <div style={{ background: ownsAll ? "#4CAF5018" : ac, border: ownsAll ? "1px solid #4CAF5044" : "none", borderRadius: 10, padding: "9px 18px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, color: ownsAll ? "#4CAF50" : "#000", letterSpacing: "0.06em" }}>{ownsAll ? "OWNED" : "VIEW BUNDLE →"}</div>
      </div>
    </div>
  );
}

// ── Main StoreScreen ──────────────────────────────────────────────────────────
export default function StoreScreen({ setScreen, themeId }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, token, updateUser } = useAuthStore();
  const isGuest = !user;

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selected,     setSelected]     = useState("plus");
  const [loading,      setLoading]      = useState(false);
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [hovPkg,       setHovPkg]       = useState<string | null>(null);
  const [hovCard,      setHovCard]      = useState<string | null>(null);
  const [buyingId,     setBuyingId]     = useState<string | null>(null);
  const [openBundle,   setOpenBundle]   = useState<string | null>(null);
  const [confirmBuy,   setConfirmBuy]   = useState<{ id: string, price: number, label: string } | null>(null);

  const pkg = PACKAGES.find(p => p.id === selected)!;
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";
  const accent = isClassic ? "#CC0000" : t.accent;
  const balance = (user as any)?.protocredits ?? 0;
  const purchasedItems: string[] = (user as any)?.purchased_items ?? [];

  useEffect(() => {
    if (!token) return;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => updateUser(res.data))
      .catch(() => {});
  }, [token]);

  // Helper to show error msg that auto-clears after 1s
  const showError = (text: string) => {
    setMsg({ text, ok: false });
    setTimeout(() => setMsg(null), 1000);
  };

  const cssVars = { "--font-display": t.fontDisplay, "--font-mono": t.fontMono, "--font-body": t.fontBody, "--text": t.text, "--text-muted": t.textMuted, "--border": t.border, "--accent": accent } as React.CSSProperties;

  const loadRazorpay = () => new Promise<boolean>(resolve => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
  });

  const handleBuy = async () => {
    if (isGuest) { setShowBuyModal(false); showError("Sign in to buy ProtoCredits."); return; }
    setLoading(true); setMsg(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load payment gateway.");
      let data: any;
      for (let i = 0; i < 3; i++) {
        try { const res = await API.post("/api/store/create-order", { package_id: selected }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); data = res.data; break; }
        catch (e) { if (i === 2) throw e; await new Promise(r => setTimeout(r, 2000)); }
      }
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({ key: data.key_id, amount: data.amount, currency: data.currency, name: "PentaProtocol", description: `${pkg.credits + pkg.bonus} ProtoCredits`, order_id: data.order_id, prefill: { name: user!.username, email: (user as any).email || "" }, theme: { color: accent }, modal: { ondismiss: () => reject(new Error("dismissed")) },
          handler: async (response: any) => {
            try {
              const verifyRes = await API.post("/api/store/verify-payment", { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, package_id: selected }, { headers: { Authorization: `Bearer ${token}` } });
              updateUser({ protocredits: balance + verifyRes.data.credits_added }); resolve();
            } catch (e) { reject(e); }
          },
        }); rz.open();
      });
      setMsg({ text: `✓ Payment successful! ${pkg.credits + pkg.bonus} ProtoCredits added.`, ok: true });
    } catch (e: any) {
      if (e?.message === "dismissed") showError("Payment cancelled.");
      else showError(e?.response?.data?.detail || e?.message || "Payment failed. Please try again.");
    } finally { setLoading(false); }
  };

  const handleBuyCosmetic = (id: string, price: number, label: string) => {
    if (isGuest) { showError("Sign in to purchase."); return; }
    if (balance < price) { setOpenBundle(null); setMsg(null); setShowBuyModal(true); return; }
    setConfirmBuy({ id, price, label });
  };

  const proceedBuyCosmetic = async () => {
    if (!confirmBuy) return;
    const { id, price, label } = confirmBuy;
    setConfirmBuy(null);
    setBuyingId(id);
    const isBundlePurchase = id.startsWith("bundle_purchase_");
    const bundleData = isBundlePurchase ? BUNDLES.find(b => b.id === id.replace("bundle_purchase_", "")) : null;
    try {
      if (bundleData) {
        await API.post("/api/store/purchase-item", { item_id: bundleData.boardId, price: bundleData.boardPrice }, { headers: { Authorization: `Bearer ${token}` } });
        await API.post("/api/store/purchase-item", { item_id: bundleData.pieceId, price: bundleData.piecePrice }, { headers: { Authorization: `Bearer ${token}` } });
        const existing = (user as any).purchased_items ?? [];
        updateUser({ protocredits: balance - price, purchased_items: [...existing, bundleData.boardId, bundleData.pieceId] });
      } else {
        await API.post("/api/store/purchase-item", { item_id: id, price }, { headers: { Authorization: `Bearer ${token}` } });
        const existing = (user as any).purchased_items ?? [];
        updateUser({ protocredits: balance - price, purchased_items: [...existing, id] });
      }
      setMsg({ text: `✓ ${label} unlocked! Equip it in your Collection.`, ok: true });
      setOpenBundle(null);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      showError(e?.response?.data?.detail || "Purchase failed. Try again.");
    } finally { setBuyingId(null); }
  };

  const GuestBuyBtn = () => (
    <button onClick={() => setScreen("auth")} style={{ flexShrink: 0, background: t.accent, border: "none", borderRadius: 8, padding: "6px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 4 }}>SIGN IN</button>
  );

  const activeBundleData = openBundle ? BUNDLES.find(b => b.id === openBundle) : null;

  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: t.bg, transition: "background 0.4s", paddingTop: 84, overflowY: "auto" }}>
      <style>{`
        .store-card { transition: transform 0.22s cubic-bezier(.22,.68,0,1.2), box-shadow 0.22s ease, border-color 0.18s ease; cursor: pointer; }
        .store-card:hover { transform: translateY(-4px) scale(1.02); }
        .store-buy-btn:hover { filter: brightness(1.12); transform: scale(1.01); }
        .store-buy-btn,.store-pkg { transition: all 0.18s ease; cursor: pointer; }
        .store-pkg:hover { filter: brightness(1.08); }
        .modal-backdrop { animation: fadeIn 0.18s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes previewSlideUp { from{opacity:0;transform:translateY(32px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes heatDrift0{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,18px) scale(1.1)}}
        @keyframes heatDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-15px,8px) scale(0.95)}}
        @keyframes heatDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(8px,-12px) scale(1.08)}}
        @keyframes iceD0{from{transform:translate(0,0)}to{transform:translate(8px,12px)}}
        @keyframes iceD1{from{transform:translate(0,0)}to{transform:translate(-10px,6px)}}
        @keyframes iceD2{from{transform:translate(0,0)}to{transform:translate(6px,-9px)}}
        @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7)}}
        @keyframes iceWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(100,200,255,0.3)}50%{box-shadow:0 0 28px rgba(100,200,255,0.7)}}
        .modal-panel { animation: slideUp 0.22s cubic-bezier(.22,.68,0,1.2); }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {activeBundleData && (
        <BundleModal bundle={activeBundleData} t={t} isGuest={isGuest} buyingId={buyingId} purchasedItems={purchasedItems} balance={balance}
          onClose={() => setOpenBundle(null)} onBuy={handleBuyCosmetic}
          onOpenBuyCredits={() => { setOpenBundle(null); setMsg(null); setShowBuyModal(true); }} />
      )}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 72px" }}>

        {isGuest && (
          <div style={{ background: `${accent}10`, border: `1px solid ${accent}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: accent }}>Browsing as Guest</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>Sign in to purchase ProtoCredits and unlock premium equipment.</div>
            </div>
            <button onClick={() => setScreen("auth")} style={{ marginLeft: "auto", flexShrink: 0, background: accent, border: "none", color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, padding: "7px 16px", borderRadius: 7, cursor: "pointer", letterSpacing: "0.06em" }}>SIGN IN</button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 48, gap: 24, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.3em", marginBottom: 10 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: t.text, lineHeight: 1.05, marginBottom: 10 }}>UNLOCK YOUR<br /><span style={{ color: accent }}>ARSENAL</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, maxWidth: 420 }}>Earn rewards through ranked play and achievements — or top up ProtoCredits to unlock exclusive cosmetics instantly.</div>
          </div>
          <div className="store-card"
            onClick={() => { if (isGuest) { showError("Sign in to buy ProtoCredits."); return; } setMsg(null); setShowBuyModal(true); }}
            style={{ flexShrink: 0, minWidth: 260, maxWidth: 320, background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `2px solid ${isGuest ? t.border : accent + "55"}`, borderRadius: 18, padding: "22px 24px", boxShadow: `0 0 40px ${accent}22`, position: "relative", overflow: "hidden", opacity: isGuest ? 0.75 : 1 }}>
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${accent}22`, filter: "blur(40px)", pointerEvents: "none" }} />
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, letterSpacing: "0.25em", marginBottom: 10 }}>PROTOCREDITS</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 6, lineHeight: 1.1 }}>Buy<br /><span style={{ color: accent }}>ProtoCredits</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Starting from ₹49 · Instant delivery</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 18 }}>
              {PACKAGES.map(p => (<div key={p.id} style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 8px" }}>{p.credits + p.bonus}</div>))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color: isGuest ? t.textMuted : "#000", background: isGuest ? t.bgCard : accent, borderRadius: 8, padding: "9px 16px", justifyContent: "center", border: isGuest ? `1px solid ${t.border}` : "none" }}>
              {isGuest ? "SIGN IN TO BUY" : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/></svg> OPEN STORE</>)}
            </div>
            {!isGuest && <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: t.fontMono, fontSize: 11, color: t.textMuted }}>Balance: <span style={{ color: accent, display: "flex", alignItems: "center", gap: 4 }}>{balance.toLocaleString()} <ProtoSVG size={14}/></span></div>}
          </div>
        </div>

        {/* ── BUNDLES ── */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="Bundles" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {BUNDLES.map(bundle => <BundleCard key={bundle.id} bundle={bundle} purchasedItems={purchasedItems} t={t} onClick={() => setOpenBundle(bundle.id)} />)}
          </div>
        </div>

        {/* ── THEMES ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Themes" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {STORE_THEMES.map(item => (
              <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hovCard === item.id ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hovCard === item.id ? `0 8px 32px ${accent}22` : "none" }}>
                <div style={{ height: 90, background: item.preview }} />
                <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div><div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div><div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div></div>
                  <UnlockBadge text={item.unlock} accent={accent} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOARD SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Board Skins" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {STORE_BOARD_SKINS.filter(item => !(item.price > 0 && purchasedItems.includes(item.id))).map(item => {
              const hov = hovCard === `board_${item.id}`;
              const isPurchasable = item.price > 0;
              const isBuying = buyingId === item.id;
              const relatedBundle = BUNDLES.find(b => b.boardId === item.id);
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(`board_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hov ? accent + "88" : isPurchasable ? accent + "33" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none", position: "relative" }}>
                  <div style={{ height: 90, background: item.preview, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,16px)", gap: 3, opacity: 0.65 }}>
                      {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 16, height: 16, background: item.border ?? "#555", borderRadius: 2 }} />)}
                    </div>
                    {isPurchasable && <div style={{ position: "absolute", top: 8, left: 8, background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 6, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>}
                    {relatedBundle && <div style={{ position: "absolute", bottom: 8, right: 8, fontFamily: "monospace", fontSize: 9, color: `${relatedBundle.accentColor}88`, letterSpacing: "0.06em" }}>IN BUNDLE</div>}
                  </div>
                  <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {isPurchasable ? (isGuest ? <GuestBuyBtn /> : (
                      <button disabled={isBuying} onClick={e => { e.stopPropagation(); handleBuyCosmetic(item.id, item.price, item.label); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: isBuying ? `${accent}33` : `${accent}18`, border: `1.5px solid ${accent}${isBuying ? "33" : "66"}`, borderRadius: 8, padding: "6px 11px", fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, color: isBuying ? t.textMuted : accent, cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all 0.18s" }}>
                        {isBuying ? "..." : (
                          <>
                            {item.price.toLocaleString()}
                            <ProtoSVG size={14} />
                          </>
                        )}
                      </button>
                    )) : <UnlockBadge text={item.unlock} accent={accent} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PIECE SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Piece Skins" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
            {[
              { id: "default", label: "Classic", desc: "Default pieces", p1: "X", p2: "Y", p1c: "#FFFFFF", p2c: "#CC0000", price: 0, isFlame: false, isSnow: false },
              { id: "piece_flame_skull", label: "Flame & Skull", desc: "Animated flame + skull SVG pieces. Equip on Red Grid board.", p1: "🔥", p2: "💀", p1c: "#FF4400", p2c: "#AAAAAA", price: 599, isFlame: true, isSnow: false },
              { id: "piece_snowflake_shard", label: "Snow & Shard", desc: "Crystalline snowflake + ice shard SVG pieces. Pairs with Ice Grid.", p1: "❄", p2: "◆", p1c: "#C8EEFF", p2c: "#64C8FF", price: 599, isFlame: false, isSnow: true },
            ].filter(item => !(item.price > 0 && purchasedItems.includes(item.id))).map(item => {
              const hov = hovCard === item.id;
              const isPurchasable = item.price > 0;
              const isBuying = buyingId === item.id;
              const relatedBundle = BUNDLES.find(b => b.pieceId === item.id);
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 16px", border: `1.5px solid ${hov ? accent + "88" : isPurchasable ? accent + "33" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none", position: "relative" }}>
                  {isPurchasable && <div style={{ position: "absolute", top: 8, left: 8, background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 6, padding: "2px 8px", fontFamily: t.fontMono, fontSize: 9, color: accent, fontWeight: 700, letterSpacing: "0.08em" }}>FOR SALE</div>}
                  {relatedBundle && <div style={{ position: "absolute", top: 8, right: 8, fontFamily: "monospace", fontSize: 9, color: `${relatedBundle.accentColor}88`, letterSpacing: "0.06em" }}>IN BUNDLE</div>}
                  <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 14, marginTop: isPurchasable ? 18 : 0 }}>
                    {item.isFlame ? (
                      <><div style={{ width: 52, height: 52, borderRadius: 8, background: "rgba(14,3,1,0.97)", border: "1.5px solid rgba(255,80,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}><Embers count={3}/><Flame size={52}/></div>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: "rgba(14,3,1,0.97)", border: "1.5px solid rgba(200,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}><Embers count={3}/><Skull size={52}/></div></>
                    ) : item.isSnow ? (
                      <><div style={{ width: 52, height: 52, borderRadius: 8, background: "linear-gradient(135deg,rgba(5,12,25,0.96),rgba(2,7,16,0.98))", border: "1.5px solid rgba(200,240,255,0.65)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}><FrostCrystals/><SnowflakePiece size={52}/></div>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: "linear-gradient(135deg,rgba(5,12,25,0.96),rgba(2,7,16,0.98))", border: "1.5px solid rgba(100,200,255,0.65)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}><FrostCrystals/><IceShardPiece size={52}/></div></>
                    ) : (
                      <><div style={{ width: 52, height: 52, borderRadius: 8, background: `${item.p1c}18`, border: `2px solid ${item.p1c}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 28, fontWeight: 900, color: item.p1c }}>{item.p1}</div>
                        <div style={{ width: 52, height: 52, borderRadius: 8, background: `${item.p2c}18`, border: `2px solid ${item.p2c}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 28, fontWeight: 900, color: item.p2c }}>{item.p2}</div></>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {isPurchasable ? (isGuest ? <GuestBuyBtn /> : (
                      <button disabled={isBuying} onClick={e => { e.stopPropagation(); handleBuyCosmetic(item.id, item.price, item.label); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, background: isBuying ? `${accent}33` : `${accent}18`, border: `1.5px solid ${accent}${isBuying ? "33" : "66"}`, borderRadius: 8, padding: "6px 11px", fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, color: isBuying ? t.textMuted : accent, cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                        {isBuying ? "..." : (
                          <>
                            {item.price.toLocaleString()}
                            <ProtoSVG size={14} />
                          </>
                        )}
                      </button>
                    )) : <UnlockBadge text="Free" accent={accent} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COIN SKINS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Coin Skins" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[{ id: "default", label: "Standard", desc: "Default coin skins", c1: "#F59E0B", c2: "#4FC3F7", unlock: "Free" }].map(item => {
              const hov = hovCard === `coin_${item.id}`;
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(`coin_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 22px", border: `1.5px solid ${hov ? accent + "88" : t.border}`, background: t.bgCard, display: "flex", alignItems: "center", gap: 20, boxShadow: hov ? `0 8px 28px ${accent}22` : "none" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%,${item.c1}FF,${item.c1}88)`, boxShadow: `0 0 16px ${item.c1}66`, display: "flex", alignItems: "center", justifyContent: "center" }}><img src="/penta-coin.png" alt="penta" style={{ width: 34, height: 34, objectFit: "contain" }} /></div>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%,${item.c2}FF,${item.c2}88)`, boxShadow: `0 0 16px ${item.c2}66`, display: "flex", alignItems: "center", justifyContent: "center" }}><ProtoSVG size={34} /></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text }}>{item.label}</span><UnlockBadge text={item.unlock} accent={accent} /></div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted }}>{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── TOSS ANIMATIONS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Toss Animations" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
            {[{ id: "default_toss", label: "Classic Flip", desc: "The standard coin toss", color: accent }].map(item => {
              const hov = hovCard === item.id;
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "20px 22px", border: `1.5px solid ${hov ? item.color + "88" : t.border}`, background: t.bgCard, display: "flex", alignItems: "center", gap: 18, boxShadow: hov ? `0 8px 28px ${item.color}22` : "none" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg,${item.color},${item.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 0 16px ${item.color}44` }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  </div>
                  <div style={{ flex: 1 }}><div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 3 }}>{item.label}</div><div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted }}>{item.desc}</div></div>
                  <UnlockBadge text="Free" accent={accent} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PROFILE BANNERS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Profile Banners" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
            {STORE_BANNERS.map(item => {
              const hov = hovCard === `banner_${item.id}`;
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(`banner_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, overflow: "hidden", border: `1.5px solid ${hov ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none" }}>
                  <div style={{ height: 70, background: item.gradient }} />
                  <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                    <UnlockBadge text={item.unlock} accent={accent} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PROFILE BORDERS ── */}
        <div style={{ marginBottom: 52 }}>
          <SectionHeader label="Profile Borders" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
            {STORE_BORDERS.map(item => {
              const hov = hovCard === `border_${item.id}`;
              return (
                <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(`border_${item.id}`)} onMouseLeave={() => setHovCard(null)}
                  style={{ borderRadius: 14, padding: "13px 14px", border: `1.5px solid ${hov ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hov ? `0 8px 28px ${accent}22` : "none", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, border: item.id === "default_border" ? `2px dashed ${t.border}` : `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: `${accent}11` }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: t.bg }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <UnlockBadge text={item.unlock} accent={accent} />
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: "center" as const }}>
          <button onClick={() => setScreen("home")} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>← GO BACK</button>
        </div>

        {msg && (
          <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: msg.ok ? "#1a2e1a" : "#2e1a1a", border: `1px solid ${msg.ok ? "#4CAF50" : "#EF4444"}`, borderRadius: 10, padding: "10px 22px", fontFamily: t.fontMono, fontSize: 13, color: msg.ok ? "#4CAF50" : "#EF4444", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em" }}>
            {msg.ok ? "✓" : ""} {msg.text}
          </div>
        )}
      </div>

      {/* ── ProtoCredits Buy Modal ── */}
      {showBuyModal && !isGuest && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowBuyModal(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="modal-panel" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setShowBuyModal(false)} style={{ position: "absolute", top: 16, right: 16, background: `${t.border}44`, border: "none", borderRadius: 8, color: t.textMuted, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.25em", marginBottom: 8 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: t.text, marginBottom: 4 }}>BUY PROTO<span style={{ color: accent }}>CREDITS</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 24 }}>Use ProtoCredits to unlock cosmetics and exclusive content.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {PACKAGES.map(p => {
                const isSel = selected === p.id; const isHov = hovPkg === p.id;
                return (
                  <div key={p.id} className="store-pkg" onClick={() => setSelected(p.id)} onMouseEnter={() => setHovPkg(p.id)} onMouseLeave={() => setHovPkg(null)}
                    style={{ position: "relative", background: isSel ? `${accent}14` : isHov ? `${accent}08` : t.bgCard, border: `2px solid ${isSel ? accent : isHov ? accent + "55" : t.border}`, borderRadius: 12, padding: "16px 14px", boxShadow: isSel ? `0 0 20px ${accent}22` : "none" }}>
                    {p.popular && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: accent, color: "#000", fontFamily: t.fontMono, fontSize: 9, fontWeight: 800, padding: "2px 10px", borderRadius: 20, letterSpacing: "0.12em", whiteSpace: "nowrap" as const }}>POPULAR</div>}
                    <div style={{ fontFamily: t.fontMono, fontSize: 10, color: isSel ? accent : t.textMuted, letterSpacing: "0.18em", marginBottom: 6 }}>{p.label}</div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: isSel ? accent : t.text, lineHeight: 1, marginBottom: 2 }}>{p.credits.toLocaleString()}</div>
                    {p.bonus > 0 && <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "#4CAF50", marginBottom: 6 }}>+{p.bonus} bonus</div>}
                    {p.bonus === 0 && <div style={{ marginBottom: 14 }} />}
                    <div style={{ height: 1, background: isSel ? `${accent}33` : t.border, marginBottom: 10 }} />
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: isSel ? accent : t.text }}>₹{p.price}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{p.desc}</div>
                    {isSel && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 900 }}>✓</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ background: t.bgPanel || t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12 }}>ORDER SUMMARY</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>{pkg.label} Package</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: t.text }}>₹{pkg.price}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: pkg.bonus > 0 ? 8 : 0 }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>ProtoCredits</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: accent }}>{pkg.credits.toLocaleString()}</span></div>
              {pkg.bonus > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: "#4CAF50" }}>Bonus Credits</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: "#4CAF50" }}>+{pkg.bonus}</span></div>}
              <div style={{ height: 1, background: t.border, margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: t.text }}>Total</span>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: accent }}>₹{pkg.price}</div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>{pkg.credits + pkg.bonus} credits</div>
                </div>
              </div>
            </div>
            {msg && <div style={{ background: msg.ok ? "#4CAF5014" : `${t.danger}14`, border: `1px solid ${msg.ok ? "#4CAF50" : t.danger}`, borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontFamily: t.fontBody, fontSize: 13, color: msg.ok ? "#4CAF50" : t.danger }}>{msg.text}</div>}
            <button onClick={handleBuy} disabled={loading} className="store-buy-btn"
              style={{ width: "100%", padding: "14px", background: loading ? `${accent}55` : accent, border: "none", borderRadius: 10, color: "#000", fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 900, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.06em", boxShadow: loading ? "none" : `0 0 24px ${accent}44` }}>
              {loading ? "Processing…" : `PAY ₹${pkg.price} WITH RAZORPAY`}
            </button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
              {["Card", "UPI", "Net Banking", "Wallet"].map(m => <span key={m} style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{m}</span>)}
            </div>
            <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, textAlign: "center" as const, marginTop: 14, lineHeight: 1.6 }}>Secure payments via Razorpay. ProtoCredits are non-refundable.</div>
          </div>
        </div>
      )}

      {/* ── In-game Purchase Confirmation Modal ── */}
      {confirmBuy && (
        <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, paddingBottom: "10vh" }}>
          <div className="modal-panel" style={{ background: t.bg, border: `1px solid ${accent}55`, borderRadius: 20, padding: 36, width: "100%", maxWidth: 420, textAlign: "center", boxShadow: `0 0 40px ${accent}22` }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 20 }}>CONFIRM PURCHASE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 16 }}>Unlock <span style={{ color: accent }}>{confirmBuy.label}</span>?</div>
            <div style={{ display: "inline-block", padding: "10px 24px", background: `${accent}14`, border: `1px solid ${accent}44`, borderRadius: 12, marginBottom: 36 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{confirmBuy.price.toLocaleString()} <ProtoSVG size={22} /></div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <button
                onClick={() => setConfirmBuy(null)}
                style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              >CANCEL</button>
              <button
                onClick={proceedBuyCosmetic}
                style={{ flex: 1, padding: "14px", background: accent, border: "none", borderRadius: 10, color: "#000", fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: `0 0 20px ${accent}44`, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
              >CONFIRM</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}