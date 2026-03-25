"use client";
import { useState, useRef, useEffect } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { PROTO_DARK_SVG, SHARDS_DARK_SVG } from "@/lib/currencyIcons";
import {
  Embers, HeatOverlay, FrostCrystals, IceOverlay,
  RedCell, IceCell, GlacierAurora, GlacierSnow,
} from "./GamePieces";
import GlacierGrid from "./GlacierGrid";
import BloodMoonGrid from "./BloodMoonGrid";
import EgyptGrid from "./EgyptGrid";
import SynthwaveGrid from "./SynthwaveGrid";
import MatrixGrid from "./MatrixGrid";
import ArcaneGrid from "./ArcaneGrid";
import BioGrid from "./BioGrid";
import ForgeGrid from "./ForgeGrid";
import VoidGrid from "./VoidGrid";
import TokyoGrid from "./TokyoGrid";
import SpaceGrid from "./SpaceGrid";
import PixelGrid from "./PixelGrid";
import VoidRiftBanner from "./VoidRiftBanner";
import BloodMoonBanner from "./BloodMoonBanner";
import PhantomStrikeBanner from "./PhantomStrikeBanner";
import SolarFlareBanner from "./SolarFlareBanner";
import CryoStormBanner from "./CryoStormBanner";
import NeonCircuitBanner from "./NeonCircuitBanner";
import StaticGlitchBanner from "./StaticGlitchBanner";
import GoldenNexusBanner from "./GoldenNexusBanner";
import PlasmaCoreBanner from "./PlasmaCoreBanner";
import ToxicSpillBanner from "./ToxicSpillBanner";
import StormProtocolBanner from "./StormProtocolBanner";
import ArcticVeilBanner from "./ArcticVeilBanner";
import StarfieldBanner from "./StarfieldBanner";
import DigitalRainBanner from "./DigitalRainBanner";
import InfernoBanner from "./InfernoBanner";

// Payment: PayPal + UPI/manual verification; see Refund Policy for creator QR.

function InteractivePreview({ Grid, gridProps }: { Grid: React.ComponentType<any>; gridProps?: Record<string, any> }) {
  const [board, setBoard] = useState<(("X" | "O") | null)[][]>(() =>
    Array(5).fill(null).map(() => Array(5).fill(null))
  );
  const turnRef = useRef<"X" | "O">("X");
  const handleClick = (r: number, c: number) => {
    if (board[r][c]) return;
    const nb = board.map(row => [...row]);
    nb[r][c] = turnRef.current;
    turnRef.current = turnRef.current === "X" ? "O" : "X";
    setBoard(nb);
  };
  return <Grid board={board} onCellClickAction={handleClick} {...gridProps} />;
}

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
}

const PACKAGES = [
  { id: "starter", credits: 100,  price: 49,  bonus: 0,   label: "STARTER", popular: false, desc: "Try it out" },
  { id: "plus",    credits: 500,  price: 199, bonus: 50,  label: "PLUS",    popular: true,  desc: "Most popular" },
  { id: "pro",     credits: 1200, price: 399, bonus: 200, label: "PRO",     popular: false, desc: "Best value" },
  { id: "elite",   credits: 3000, price: 799, bonus: 600, label: "ELITE",   popular: false, desc: "Power user" },
];
const SHARD_PACKAGES = PACKAGES.map((p) => ({
  ...p,
  price: Math.max(1, Math.floor(p.price / 2)),
}));
const PACKAGES_USD = [
  { id: "starter", usdPrice: 0.99 },
  { id: "plus",    usdPrice: 2.99 },
  { id: "pro",     usdPrice: 4.99 },
  { id: "mega",    usdPrice: 7.99 },
  { id: "elite",   usdPrice: 9.99 },
];
const SHARD_PACKAGES_USD = [
  { id: "starter", usdPrice: 0.49 },
  { id: "plus",    usdPrice: 1.49 },
  { id: "pro",     usdPrice: 1.99 },
  { id: "mega",    usdPrice: 3.99 },
  { id: "elite",   usdPrice: 4.99 },
];
const STORE_THEMES = [
  { id: "space", label: "SPACE THEME", tagline: "Cosmic premium atmosphere", desc: "Deep-space visuals, high-contrast panels, and premium ambient glow.", preview: "linear-gradient(135deg,#020410,#0d1b4b)", unlock: "2,999 PC + 1,000 PS", price: 2999, shardPrice: 1000, purchaseId: "theme_space", boardId: "space_grid", boardLabel: "Space Board", musicLabel: "Space Ranked OST", fontLabel: "Space Font Pack", bgLabel: "Space Backgrounds", accentColor: "#4DA3FF", tags: ["PREMIUM", "THEME + BOARD"] },
  { id: "pixel", label: "PIXEL THEME", tagline: "8-bit premium aesthetic", desc: "Retro pixel visuals, arcade contrast, and upgraded UI glow intensity.", preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", unlock: "2,999 PC + 1,000 PS", price: 2999, shardPrice: 1000, purchaseId: "theme_pixel", boardId: "pixel_grid", boardLabel: "Pixel Board", musicLabel: "Pixel Ranked OST", fontLabel: "Pixel Font Pack", bgLabel: "Pixel Backgrounds", accentColor: "#A4FF3B", tags: ["PREMIUM", "THEME + BOARD"] },
];

const THEME_MUSIC_PREVIEWS: Record<string, { key: "lobby" | "game" | "ranked"; label: string; file: string }[]> = {
  space: [
    { key: "lobby", label: "Lobby BGM", file: "space_lobby.mp3" },
    { key: "game", label: "Game BGM", file: "space_game.mp3" },
    { key: "ranked", label: "Ranked BGM", file: "space_ranked.mp3" },
    { key: "lobby", label: "SFX: UI Transition", file: "Space UI transition.wav" },
    { key: "game", label: "SFX: Rulebreaker", file: "Space Rulebreaker.wav" },
    { key: "ranked", label: "SFX: Match Found", file: "Space match found.wav" },
  ],
  pixel: [
    { key: "lobby", label: "Lobby BGM", file: "pixel_lobby.mp3" },
    { key: "game", label: "Game BGM", file: "pixel_game.mp3" },
    { key: "ranked", label: "Ranked BGM", file: "pixel_ranked.mp3" },
    { key: "lobby", label: "SFX: UI Transition", file: "Pixel UI Transition.wav" },
    { key: "game", label: "SFX: Rulebreaker", file: "Pixel Rulebreaker.wav" },
    { key: "ranked", label: "SFX: Match Found", file: "Pixel Match Found.wav" },
  ],
};

const STORE_BANNERS: { id: string; label: string; gradient: string; unlock: string; price?: number; component?: any }[] = [
  { id: "default",   label: "Default",   gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", unlock: "Free" },
  { id: "void_rift", label: "Void Rift", gradient: "linear-gradient(135deg,#0e0020,#020005)", unlock: "299 PC", price: 299, component: VoidRiftBanner },
  { id: "blood_moon", label: "Blood Moon", gradient: "linear-gradient(135deg,#000008,#180008)", unlock: "299 PC", price: 299, component: BloodMoonBanner },
  { id: "phantom_strike", label: "Phantom Strike", gradient: "linear-gradient(135deg,#060010,#110028)", unlock: "199 PC", price: 199, component: PhantomStrikeBanner },
  { id: "solar_flare", label: "Solar Flare", gradient: "linear-gradient(135deg,#060200,#f97316)", unlock: "299 PC", price: 299, component: SolarFlareBanner },
  { id: "cryo_storm", label: "Cryo Storm", gradient: "linear-gradient(135deg,#030c20,#081840)", unlock: "299 PC", price: 299, component: CryoStormBanner },
  { id: "neon_circuit", label: "Neon Circuit", gradient: "linear-gradient(135deg,#020a04,#00ff66)", unlock: "299 PC", price: 299, component: NeonCircuitBanner },
  { id: "static_glitch", label: "Static Glitch", gradient: "linear-gradient(135deg,#050505,#a00038)", unlock: "299 PC", price: 299, component: StaticGlitchBanner },
  { id: "golden_nexus", label: "Golden Nexus", gradient: "linear-gradient(135deg,#060200,#fbbf24)", unlock: "299 PC", price: 299, component: GoldenNexusBanner },
  { id: "plasma_core", label: "Plasma Core", gradient: "linear-gradient(135deg,#12082a,#6d28d9)", unlock: "299 PC", price: 299, component: PlasmaCoreBanner },
  { id: "toxic_spill", label: "Toxic Spill", gradient: "linear-gradient(135deg,#010d03,#0a3d22)", unlock: "299 PC", price: 299, component: ToxicSpillBanner },
  { id: "storm_protocol", label: "Storm Protocol", gradient: "linear-gradient(135deg,#060810,#0b1a3b)", unlock: "299 PC", price: 299, component: StormProtocolBanner },
  { id: "arctic_veil", label: "Arctic Veil", gradient: "linear-gradient(135deg,#d8f0fc,#c5e8fb)", unlock: "299 PC", price: 299, component: ArcticVeilBanner },
  { id: "starfield", label: "Starfield", gradient: "linear-gradient(135deg,#050210,#312e81)", unlock: "299 PC", price: 299, component: StarfieldBanner },
  { id: "digital_rain", label: "Digital Rain", gradient: "linear-gradient(135deg,#000702,#14532d)", unlock: "299 PC", price: 299, component: DigitalRainBanner },
  { id: "inferno", label: "Inferno", gradient: "linear-gradient(135deg,#070100,#ea580c)", unlock: "299 PC", price: 299, component: InfernoBanner },
];

const STORE_BORDERS = [
  { id: "default_border", label: "None", desc: "No border around profile", preview: "transparent", unlock: "Free" }
];
function ProtoSVG({ size = 16, color }: { size?: number, color?: string }) {
  const scaled = Math.round(size * 2);
  return <div style={{ width: scaled, height: scaled, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: PROTO_DARK_SVG.replace("<svg ", `<svg width="${scaled}" height="${scaled}" `) }} />;
}

function ShardSVG({ size = 16 }: { size?: number }) {
  const scaled = Math.round(size * 2);
  return <div style={{ width: scaled, height: scaled, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: SHARDS_DARK_SVG.replace("<svg ", `<svg width="${scaled}" height="${scaled}" `) }} />;
}

type Bundle = {
  id: string; label: string; tagline: string; desc: string;
  boardId: string; pieceId: string; boardLabel: string; pieceLabel: string;
  accentColor: string; bgGradient: string;
  bundlePrice: number; boardPrice: number; piecePrice: number; tags: string[];
  isIce: boolean;
  previewKind: "fire" | "ice" | "glacier" | "bloodmoon" | "egypt" | "synthwave" | "matrix" | "arcane" | "bio" | "forge" | "void" | "space" | "pixel" | "tokyo";
};

const BUNDLES: Bundle[] = [
  { id: "bundle_fire", label: "INFERNO BUNDLE", tagline: "Command fire and death", desc: "A smoldering battlefield pulsing with crimson energy. Flame surges with living light, the skull stares through the void. Built for the relentless.", boardId: "red_grid", pieceId: "piece_flame_skull", boardLabel: "Inferno", pieceLabel: "Flame & Skull", accentColor: "#FF3300", bgGradient: "linear-gradient(160deg,#140200,#2a0600,#1a0300)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["FIRE THEME", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "fire" },
  { id: "bundle_ice", label: "ICE BUNDLE", tagline: "Cool, calculated, absolutely deadly", desc: "Crystalline frost spreads across the board. Snowflake geometry meets ice shard aggression. Built for the strategist who plays cold.", boardId: "ice_grid", pieceId: "piece_snowflake_shard", boardLabel: "Ice Board", pieceLabel: "Snow & Shard", accentColor: "#50a0dc", bgGradient: "linear-gradient(160deg,#010c1f,#01152e,#010a1a)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["ICE THEME", "CRYSTALLINE", "BOARD + PIECES"], isIce: true, previewKind: "ice" },
  { id: "bundle_glaciergrid", label: "GLACIER BUNDLE", tagline: "Aurora-lit frost, precision first", desc: "A deep arctic battleground with aurora glow and crystalline intersections. Includes GlacierGrid board skin and matching Snowflake & Ice Shard piece skin.", boardId: "glacier_grid", pieceId: "piece_glacier_shard", boardLabel: "Glacier Board", pieceLabel: "Glacier Sigils", accentColor: "#7DD3FC", bgGradient: "linear-gradient(160deg,#020b1a,#031329,#041f35)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["GLACIERGRID", "AURORA", "BOARD + PIECES"], isIce: true, previewKind: "glacier" },
  { id: "bundle_bloodmoon", label: "BLOODMOON BUNDLE", tagline: "Ritual crimson and violet omen", desc: "A cursed battleground under a pulsing blood moon. Dripping crimson, violet lattice lines, and occult sigils that ignite with every move.", boardId: "bloodmoon_grid", pieceId: "piece_bloodmoon_sigils", boardLabel: "Bloodmoon Board", pieceLabel: "Pentagram & Eye", accentColor: "#DC2626", bgGradient: "linear-gradient(160deg,#070000,#170006,#0a0002)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["BLOODMOON", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "bloodmoon" },
  { id: "bundle_egypt", label: "EGYPT BUNDLE", tagline: "Golden dunes and ancient sigils", desc: "A desert night beneath pyramids and hieroglyph walls. Heat-shimmer lines and sand grains drift as Ankhs and the Eye of Ra blaze into place.", boardId: "egypt_grid", pieceId: "piece_egypt_sigils", boardLabel: "Egypt Board", pieceLabel: "Ankh & Eye of Ra", accentColor: "#F59E0B", bgGradient: "linear-gradient(160deg,#070400,#1a0f00,#0a0500)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["EGYPT", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "egypt" },
  { id: "bundle_synthwave", label: "SYNTHWAVE BUNDLE", tagline: "Neon horizon and retro pulse", desc: "A neon sunset over a receding grid floor with city silhouettes and glowing nodes. Retro Sun and Neon Palm ignite with every move.", boardId: "synthwave_grid", pieceId: "piece_synthwave_sigils", boardLabel: "Synthwave Board", pieceLabel: "Sun & Palm", accentColor: "#FF00B4", bgGradient: "linear-gradient(160deg,#0a002a,#1a004a,#cc2060)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["SYNTHWAVE", "NEON", "BOARD + PIECES"], isIce: false, previewKind: "synthwave" },
  { id: "bundle_matrix", label: "MATRIX BUNDLE", tagline: "Code rain and green pulse", desc: "A near-black green battleground with matrix rain, scanlines, glitch blocks, and pulsing code nodes. Brackets and binary sigils render with neon glow.", boardId: "matrix_grid", pieceId: "piece_matrix_sigils", boardLabel: "Matrix Board", pieceLabel: "Bracket & Pill", accentColor: "#00FF41", bgGradient: "linear-gradient(160deg,#000300,#001000,#000400)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["MATRIX", "GLITCH", "BOARD + PIECES"], isIce: false, previewKind: "matrix" },
  { id: "bundle_arcane", label: "ARCANE BUNDLE", tagline: "Runes, mist, and magic circles", desc: "A deep void board with drifting arcane mist, rotating magic circles, and glowing runes. Portal and gold sigils flare with every move.", boardId: "arcane_grid", pieceId: "piece_arcane_sigils", boardLabel: "Arcane Board", pieceLabel: "Portal & Sigil", accentColor: "#A855F7", bgGradient: "linear-gradient(160deg,#0a0012,#060008,#030004)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["ARCANE", "RUNES", "BOARD + PIECES"], isIce: false, previewKind: "arcane" },
  { id: "bundle_bio", label: "BIO BUNDLE", tagline: "Abyss glow and bioluminescence", desc: "A deep-sea board with drifting spores, glowing creatures, and bioluminescent gridlines. Jellyfish and angler sigils pulse on placement.", boardId: "bio_grid", pieceId: "piece_bio_sigils", boardLabel: "Bio Board", pieceLabel: "Jellyfish & Angler", accentColor: "#00FFD0", bgGradient: "linear-gradient(160deg,#000a0f,#000608,#000304)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["BIO", "ABYSS", "BOARD + PIECES"], isIce: false, previewKind: "bio" },
  { id: "bundle_forge", label: "FORGE BUNDLE", tagline: "Molten veins and rising embers", desc: "An obsidian forge board with molten pools, glowing veins, and drifting embers. Hammer and molten sigils ignite each move.", boardId: "forge_grid", pieceId: "piece_forge_sigils", boardLabel: "Forge Board", pieceLabel: "Hammer & Molten Sigil", accentColor: "#FF6600", bgGradient: "linear-gradient(160deg,#0a0200,#150400,#080100)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["FORGE", "LAVA", "BOARD + PIECES"], isIce: false, previewKind: "forge" },
  { id: "bundle_void", label: "VOID BUNDLE", tagline: "Nebulae, stars, and cosmic pulses", desc: "A deep-space board with drifting nebulae, twinkling stars, shooting streaks, and a pulsing singularity. Pulsar and Quasar sigils flare on placement.", boardId: "void_grid", pieceId: "piece_void_sigils", boardLabel: "Void Board", pieceLabel: "Pulsar & Quasar", accentColor: "#8B5CF6", bgGradient: "linear-gradient(160deg,#04011a,#020110,#000008)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["VOID", "COSMIC", "BOARD + PIECES"], isIce: false, previewKind: "void" },
  { id: "bundle_space", label: "SPACE BUNDLE", tagline: "Protocol rockets and satellite signals", desc: "A deep-space grid where rockets and satellites ignite on placement. Nebula drift, star twinkles, and targeting arcs light up the board.", boardId: "space_grid", pieceId: "piece_space_sigils", boardLabel: "Space Board", pieceLabel: "Rocket & Satellite", accentColor: "#00D9FF", bgGradient: "linear-gradient(160deg,#020410,#0b1a3b,#000008)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["SPACE", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "space" },
  { id: "bundle_pixel", label: "PIXEL BUNDLE", tagline: "8-bit CRT chaos and dither glow", desc: "A chunky pixel grid with dithered tiles, CRT scanlines, and floating sprites. Coins and Hearts pop in with crisp 8-bit punch.", boardId: "pixel_grid", pieceId: "piece_pixel_sigils", boardLabel: "Pixel Board", pieceLabel: "Coin & Heart", accentColor: "#FFDD00", bgGradient: "linear-gradient(160deg,#0a0a18,#0f3460,#2d132c)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["PIXEL", "CRT", "BOARD + PIECES"], isIce: false, previewKind: "pixel" },
  { id: "bundle_tokyo", label: "TOKYO BUNDLE", tagline: "Neon rain and city glow", desc: "A neon city board with animated rain, glowing signage, reflections, and vivid grid tubes. Dragon seals and katanas flash with every move.", boardId: "tokyo_grid", pieceId: "piece_tokyo_sigils", boardLabel: "Tokyo Board", pieceLabel: "Dragon Seal & Katana", accentColor: "#FF0066", bgGradient: "linear-gradient(160deg,#040008,#070012,#030008)", bundlePrice: 1999, boardPrice: 1599, piecePrice: 599, tags: ["TOKYO", "NEON", "BOARD + PIECES"], isIce: false, previewKind: "tokyo" },
];

type CoinBundle = { id: string; label: string; tagline: string; desc: string; accentColor: string; bgGradient: string; bundlePrice: number; shardPrice: number; purchaseId: string; tags: string[] };
const COIN_BUNDLES: CoinBundle[] = [
  { id: "wraith_king_coin", label: "WRAITH KING COIN", tagline: "DOMINION & SERVITUDE — Rulebreaker toss skin", desc: "Crowned skull (PENTA) and soul portal (PROTO), spectral particles, and a full Rulebreaker toss animation. Equip the toss in Collection after unlock.", accentColor: "#aa66ee", bgGradient: "linear-gradient(160deg,#0c0618,#12041c,#06020c)", bundlePrice: 299, shardPrice: 50, purchaseId: "coin_bundle_wraith_king", tags: ["COIN", "RULEBREAKER", "BUNDLE"] },
];

type ProfileBundle = { id: string; label: string; tagline: string; accentColor: string; bgGradient: string; tags: string[] };
const PROFILE_BUNDLES: ProfileBundle[] = [];
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
  const pcMatch = text.match(/^([\d,]+)\s*PC$/i);
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: isFree ? "#4CAF50" : accent, background: isFree ? "#4CAF5018" : `${accent}18`, border: `1px solid ${isFree ? "#4CAF5044" : accent + "44"}`, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.06em", whiteSpace: "nowrap" as const, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {isFree ? "FREE" : pcMatch ? (<><span>{pcMatch[1]}</span><ProtoSVG size={10} /></>) : text.toUpperCase()}
    </span>
  );
}

function InfiniteCarouselRow<T>({ items, itemWidth, gap = 20, renderItem }: { items: T[]; itemWidth: number; gap?: number; renderItem: (item: T, idx: number) => React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory" as const }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ minWidth: itemWidth, maxWidth: itemWidth, flex: `0 0 ${itemWidth}px`, scrollSnapAlign: "start" }}>
          {renderItem(item, idx)}
        </div>
      ))}
    </div>
  );
}

function BannerRenderer({ banner, style = {}, hideLabels = false }: { banner: any; style?: React.CSSProperties; hideLabels?: boolean }) {
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} hideLabels={hideLabels} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}
function BundleAnimatedPreview({ bundle, tick }: { bundle: Bundle; tick: number }) {
  if (bundle.previewKind === "glacier") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(3,10,22,0.99),rgba(2,8,18,0.99))", borderRadius: 12, border: "2px solid rgba(125,211,252,0.35)", boxShadow: "0 0 56px rgba(80,170,255,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><GlacierAurora /><GlacierSnow count={20} /></div>
        <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%) scale(0.6)", transformOrigin: "top center" }}><InteractivePreview Grid={GlacierGrid} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(170,230,255,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(130,210,255,0.65)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "bloodmoon") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(10,0,0,0.99),rgba(20,0,8,0.99))", borderRadius: 12, border: "2px solid rgba(220,38,38,0.35)", boxShadow: "0 0 56px rgba(220,38,38,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={BloodMoonGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,120,0.68)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(220,140,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "egypt") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(7,4,0,0.99),rgba(14,7,0,0.99))", borderRadius: 12, border: "2px solid rgba(245,158,11,0.35)", boxShadow: "0 0 56px rgba(245,158,11,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={EgyptGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,210,120,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,230,160,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "synthwave") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(10,0,42,0.99),rgba(204,32,96,0.92))", borderRadius: 12, border: "2px solid rgba(255,0,180,0.35)", boxShadow: "0 0 56px rgba(255,0,180,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={SynthwaveGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,220,0.75)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(140,240,255,0.6)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "matrix") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(0,3,0,0.99),rgba(0,16,0,0.92))", borderRadius: 12, border: "2px solid rgba(0,255,65,0.35)", boxShadow: "0 0 56px rgba(0,255,65,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={MatrixGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(150,255,150,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(0,255,65,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "arcane") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(10,0,18,0.99),rgba(3,0,4,0.96))", borderRadius: 12, border: "2px solid rgba(168,85,247,0.35)", boxShadow: "0 0 56px rgba(168,85,247,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={ArcaneGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(220,170,255,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,220,140,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "bio") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(0,10,15,0.99),rgba(0,3,4,0.96))", borderRadius: 12, border: "2px solid rgba(0,255,208,0.32)", boxShadow: "0 0 56px rgba(0,255,208,0.12), inset 0 0 44px rgba(0,0,0,0.78)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={BioGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(140,255,230,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(190,140,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "forge") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(10,2,0,0.99),rgba(8,1,0,0.98))", borderRadius: 12, border: "2px solid rgba(255,102,0,0.30)", boxShadow: "0 0 56px rgba(255,102,0,0.16), inset 0 0 44px rgba(0,0,0,0.72)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={ForgeGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,180,120,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,220,140,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "void") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(4,1,26,0.99),rgba(0,0,8,0.98))", borderRadius: 12, border: "2px solid rgba(139,92,246,0.30)", boxShadow: "0 0 56px rgba(139,92,246,0.16), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={VoidGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(200,170,255,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(180,220,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "space") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(2,4,16,0.99),rgba(13,27,59,0.98))", borderRadius: 12, border: "2px solid rgba(0,200,255,0.30)", boxShadow: "0 0 56px rgba(0,200,255,0.14), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={SpaceGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(150,220,255,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,200,120,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "pixel") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(10,10,24,0.99),rgba(15,52,96,0.94))", borderRadius: 12, border: "2px solid rgba(255,221,0,0.32)", boxShadow: "0 0 56px rgba(255,180,0,0.12), inset 0 0 44px rgba(0,0,0,0.78)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) scale(1.0)" }}><InteractivePreview Grid={PixelGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,221,0,0.75)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,0,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "tokyo") {
    return (
      <div style={{ width: "100%", height: 360, background: "linear-gradient(135deg,rgba(4,0,8,0.99),rgba(3,0,8,0.98))", borderRadius: 12, border: "2px solid rgba(255,0,102,0.30)", boxShadow: "0 0 56px rgba(255,0,102,0.16), inset 0 0 44px rgba(0,0,0,0.74)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}><InteractivePreview Grid={TokyoGrid} gridProps={{ showLabels: false }} /></div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,80,140,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(0,200,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  const GRID = 5; const CELL = "52px";
  const p1Cells = [12, 6, 18, 2, 22]; const p2Cells = [8, 16, 4, 20, 10];
  const totalMoves = p1Cells.length + p2Cells.length;
  const move = tick % (totalMoves + 5);
  const placedP1 = new Set<number>(); const placedP2 = new Set<number>();
  for (let i = 0; i < move && i < totalMoves; i++) {
    if (i % 2 === 0) placedP1.add(p1Cells[Math.floor(i / 2)]);
    else             placedP2.add(p2Cells[Math.floor(i / 2)]);
  }
  const board: (string | null)[][] = Array.from({ length: GRID }, (_, r) => Array.from({ length: GRID }, (_, c) => { const idx = r * GRID + c; if (placedP1.has(idx)) return "P1"; if (placedP2.has(idx)) return "P2"; return null; }));
  const isIcePreview = bundle.previewKind === "ice";
  const p1c = isIcePreview ? "#C8EEFF" : "#FF4400"; const p2c = isIcePreview ? "#64C8FF" : "#BBBBBB";
  const useFlameSkull = !isIcePreview; const useSnowflakeShard = isIcePreview;
  const pieceSymbols = { p1: isIcePreview ? "❄" : "🔥", p2: isIcePreview ? "◆" : "💀" };
  return (
    <div style={{ width: "100%", background: isIcePreview ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : "rgba(10,2,1,0.99)", borderRadius: 12, border: `2px solid ${isIcePreview ? "rgba(80,160,220,0.28)" : "rgba(140,20,0,0.35)"}`, boxShadow: isIcePreview ? "0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)" : "0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)", padding: 6, position: "relative", overflow: "hidden" }}>
      {!isIcePreview && <Embers count={16} />}{!isIcePreview && <HeatOverlay />}
      {isIcePreview && <FrostCrystals />}{isIcePreview && <IceOverlay />}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${CELL})`, gridTemplateRows: `repeat(${GRID}, ${CELL})`, gap: 4, position: "relative", zIndex: 2 }}>
        {board.map((row, r) => row.map((cell, c) => {
          const noop = () => {}; const cellKey = `${r}-${c}`;
          const sharedProps = { cellSize: CELL, player: cell, isWinCell: false, isHov: false, canPlay: false, blk: false, pieceSymbols, p1c, p2c, fontDisplay: "'Courier New', monospace", onClick: noop, onMouseEnter: noop, onMouseLeave: noop };
          if (isIcePreview) return <IceCell key={cellKey} {...sharedProps} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={false} />;
          return <RedCell key={cellKey} {...sharedProps} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={false} />;
        }))}
      </div>
      <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: isIcePreview ? "rgba(140,210,255,0.55)" : "rgba(200,60,40,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
      <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: isIcePreview ? "rgba(100,200,255,0.45)" : "rgba(180,40,0,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
    </div>
  );
}
function BundleModal({ bundle, t, isGuest, buyingId, purchasedItems, balance, onClose, onBuy, onOpenBuyCredits }: { bundle: Bundle; t: any; isGuest: boolean; buyingId: string | null; purchasedItems: string[]; balance: number; onClose: () => void; onBuy: (id: string, price: number, label: string) => void; onOpenBuyCredits: () => void }) {
  const [tick, setTick] = useState(0);
  const [hovOpt, setHovOpt] = useState<string | null>(null);
  useEffect(() => { const iv = setInterval(() => setTick(v => v + 1), 900); return () => clearInterval(iv); }, []);
  const ownsBundle = purchasedItems.includes(bundle.boardId) && purchasedItems.includes(bundle.pieceId);
  const ac = bundle.accentColor;
  const options = [{ id: "bundle", label: ownsBundle ? "Bundle Owned" : "Buy Bundle", sublabel: ownsBundle ? "Board + Pieces unlocked" : `Includes ${bundle.boardLabel} + ${bundle.pieceLabel}`, price: bundle.bundlePrice, includes: [bundle.boardLabel, bundle.pieceLabel], disabled: ownsBundle, owned: ownsBundle, highlight: true, purchaseId: "bundle_purchase_" + bundle.id }];
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.16s ease", overflowY: "auto" }}>
      <div style={{ background: bundle.bgGradient, border: `1.5px solid ${ac}44`, borderRadius: 22, width: "100%", maxWidth: 680, position: "relative", animation: "previewSlideUp 0.26s cubic-bezier(.22,.68,0,1.2)", overflow: "hidden", margin: "auto" }}>
        <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 400, height: 200, borderRadius: "50%", background: `${ac}14`, filter: "blur(60px)", pointerEvents: "none" }} />
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, zIndex: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${ac}44`, borderRadius: 8, color: "#fff", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <div style={{ padding: "24px 24px 0" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
            {bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}44`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}
            {ownsBundle && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 7px", borderRadius: 4 }}>BUNDLE OWNED ✓</span>}
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: `${ac}cc`, fontStyle: "italic", marginBottom: 14 }}>{bundle.tagline}</div>
          <BundleAnimatedPreview bundle={bundle} tick={tick} />
        </div>
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, marginBottom: 16 }}>{bundle.desc}</div>
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: `${ac}77`, letterSpacing: "0.2em", marginBottom: 10 }}>PURCHASE OPTIONS</div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {options.map(opt => {
              const isHov = hovOpt === opt.id && !opt.disabled; const isBuying = buyingId === opt.purchaseId || buyingId === opt.id; const canAfford = balance >= opt.price;
              return (
                <div key={opt.id} onMouseEnter={() => !opt.disabled && setHovOpt(opt.id)} onMouseLeave={() => setHovOpt(null)} style={{ background: opt.owned ? "#4CAF5010" : opt.highlight ? `${ac}16` : "rgba(255,255,255,0.04)", border: `1.5px solid ${opt.owned ? "#4CAF5033" : opt.highlight ? `${ac}44` : "rgba(255,255,255,0.09)"}`, borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s", transform: isHov ? "translateX(4px)" : "none", boxShadow: opt.highlight && !opt.owned ? `0 0 18px ${ac}1E` : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 800, color: opt.owned ? "#4CAF50" : "#fff" }}>{opt.label}</span>
                      {opt.highlight && !opt.owned && <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, color: "#000", background: ac, padding: "1px 6px", borderRadius: 8, letterSpacing: "0.08em" }}>BEST VALUE</span>}
                      {opt.owned && <span style={{ fontFamily: "monospace", fontSize: 8, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5033", padding: "1px 6px", borderRadius: 8 }}>OWNED</span>}
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "rgba(255,255,255,0.38)", marginBottom: 5 }}>{opt.sublabel}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>{opt.includes.map(inc => (<span key={inc} style={{ fontFamily: "monospace", fontSize: 9, color: opt.owned ? "#4CAF5077" : `${ac}88`, background: opt.owned ? "#4CAF5010" : `${ac}0C`, border: `1px solid ${opt.owned ? "#4CAF5022" : ac + "22"}`, padding: "1px 6px", borderRadius: 4 }}>+ {inc}</span>))}</div>
                  </div>
                  {opt.owned ? (<div style={{ fontFamily: "monospace", fontSize: 20, color: "#4CAF50" }}>✓</div>) : isGuest ? (<button onClick={onClose} style={{ flexShrink: 0, background: ac, border: "none", borderRadius: 8, padding: "8px 14px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const }}>SIGN IN</button>) : (
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 900, color: canAfford ? ac : "#EF4444", lineHeight: 1 }}>{opt.price.toLocaleString()}<ProtoSVG size={16} /></div>
                      {!canAfford && <div style={{ fontFamily: "monospace", fontSize: 9, color: "#EF4444" }}>need {(opt.price - balance).toLocaleString()} more</div>}
                      <button disabled={isBuying} onClick={() => { if (!canAfford) { onOpenBuyCredits(); return; } onBuy(opt.purchaseId, opt.price, opt.label); }} style={{ background: isBuying ? `${ac}44` : canAfford ? ac : "#EF444422", border: `1.5px solid ${canAfford ? ac : "#EF4444"}`, borderRadius: 7, padding: "6px 13px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: isBuying ? "rgba(255,255,255,0.3)" : canAfford ? "#000" : "#EF4444", cursor: isBuying ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, transition: "all 0.18s" }}>{isBuying ? "..." : canAfford ? "UNLOCK" : "TOP UP"}</button>
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

function ThemePreviewModal({ item, t, onClose }: { item: any; t: any; onClose: () => void }) {
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [trackErr, setTrackErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ac = item.accentColor ?? "#4DA3FF";
  const tracks = THEME_MUSIC_PREVIEWS[item.id] ?? [];
  useEffect(() => { return () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; } }; }, []);
  const stopCurrent = () => { if (!audioRef.current) return; audioRef.current.pause(); audioRef.current.currentTime = 0; setActiveTrack(null); };
  const playTrack = (file: string) => {
    setTrackErr(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const audio = new Audio(`/sounds/${file}`); audioRef.current = audio;
    audio.currentTime = 0; audio.volume = 0.7;
    audio.addEventListener("timeupdate", () => { if (audio.currentTime >= 30) audio.pause(); });
    audio.addEventListener("pause", () => setActiveTrack(null));
    audio.addEventListener("ended", () => setActiveTrack(null));
    audio.play().then(() => setActiveTrack(file)).catch(() => { setTrackErr("Could not play this track on your browser."); setActiveTrack(null); });
  };
  return (
    <div onClick={e => { if (e.target === e.currentTarget) { stopCurrent(); onClose(); } }} style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fadeIn 0.16s ease", overflowY: "auto" }}>
      <div style={{ background: item.preview, border: `1.5px solid ${ac}66`, borderRadius: 22, width: "100%", maxWidth: 700, position: "relative", animation: "previewSlideUp 0.26s cubic-bezier(.22,.68,0,1.2)", overflow: "hidden", margin: "auto", boxShadow: `0 20px 70px ${ac}30` }}>
        <button onClick={() => { stopCurrent(); onClose(); }} style={{ position: "absolute", top: 14, right: 14, zIndex: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${ac}44`, borderRadius: 8, color: "#fff", width: 30, height: 30, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <div style={{ padding: "24px 24px 0" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>{(item.tags ?? []).map((tag: string) => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}44`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}</div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{item.label} PREVIEW</div>
          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: `${ac}cc`, fontStyle: "italic", marginBottom: 14 }}>{item.tagline}</div>
          <div style={{ width: "100%", borderRadius: 12, border: `2px solid ${ac}55`, boxShadow: `0 0 40px ${ac}25`, padding: 8, position: "relative", overflow: "hidden", background: "rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 320 }}>
              {item.id === "space" ? <InteractivePreview Grid={SpaceGrid} gridProps={{ showLabels: false }} /> : <InteractivePreview Grid={PixelGrid} gridProps={{ showLabels: false }} />}
            </div>
            <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: `${ac}cc`, letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{String(item.boardLabel || "").toUpperCase()}</div>
            <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: `${ac}aa`, letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>INTERACTIVE PREVIEW</div>
          </div>
        </div>
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
            <div style={{ background: `${ac}10`, border: `1px solid ${ac}33`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}88`, letterSpacing: "0.12em" }}>BOARD</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.boardLabel}</div></div>
            <div style={{ background: `${ac}10`, border: `1px solid ${ac}33`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}88`, letterSpacing: "0.12em" }}>MUSIC PACK</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.musicLabel}</div></div>
            <div style={{ background: `${ac}10`, border: `1px solid ${ac}33`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}88`, letterSpacing: "0.12em" }}>FONT</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.fontLabel}</div></div>
            <div style={{ background: `${ac}10`, border: `1px solid ${ac}33`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}88`, letterSpacing: "0.12em" }}>BACKGROUNDS</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, color: "#fff", fontWeight: 700 }}>{item.bgLabel}</div></div>
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: `${ac}77`, letterSpacing: "0.2em", marginBottom: 10 }}>MUSIC + SFX PREVIEW (30 SEC EACH)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 8 }}>
            {tracks.map((trk) => (<button key={trk.file} onClick={() => playTrack(trk.file)} style={{ background: activeTrack === trk.file ? ac : "rgba(0,0,0,0.42)", border: `1.5px solid ${ac}66`, borderRadius: 9, padding: "8px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: activeTrack === trk.file ? "#000" : "#fff", cursor: "pointer", letterSpacing: "0.04em" }}>{activeTrack === trk.file ? `PLAYING ${trk.label.toUpperCase()}` : `PLAY ${trk.label.toUpperCase()}`}</button>))}
            <button onClick={stopCurrent} style={{ background: "rgba(0,0,0,0.42)", border: `1.5px solid ${ac}44`, borderRadius: 9, padding: "8px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#fff", cursor: "pointer", letterSpacing: "0.04em" }}>STOP</button>
          </div>
          {trackErr && <div style={{ fontFamily: "monospace", fontSize: 10, color: "#EF4444", marginBottom: 8 }}>{trackErr}</div>}
        </div>
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ fontFamily: t.fontBody, fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>Preview includes board visuals and all bundle contents: {item.boardLabel}, {item.musicLabel}, {item.fontLabel}, and {item.bgLabel}.</div>
        </div>
      </div>
    </div>
  );
}
function BundleCard({ bundle, purchasedItems, t, onClick }: { bundle: Bundle; purchasedItems: string[]; t: any; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const [tick, setTick] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const ownsBoard = purchasedItems.includes(bundle.boardId); const ownsPiece = purchasedItems.includes(bundle.pieceId); const ownsAll = ownsBoard && ownsPiece;
  const ac = bundle.accentColor;
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entries) => { setIsVisible(entries[0]?.isIntersecting ?? true); }, { root: null, threshold: 0.05 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  const previewActive = hov && isVisible;
  useEffect(() => { if (!previewActive) return; const iv = setInterval(() => setTick(v => v + 1), 650); return () => clearInterval(iv); }, [previewActive]);
  const p1Cells = [12, 6, 18, 2, 22]; const p2Cells = [8, 16, 4, 20, 10];
  const totalMoves = p1Cells.length + p2Cells.length; const move = tick % (totalMoves + 4);
  const placedP1 = new Set<number>(); const placedP2 = new Set<number>();
  for (let i = 0; i < move && i < totalMoves; i++) { if (i % 2 === 0) placedP1.add(p1Cells[Math.floor(i / 2)]); else placedP2.add(p2Cells[Math.floor(i / 2)]); }
  return (
    <div ref={cardRef} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ background: bundle.bgGradient, border: `2px solid ${hov ? ac : ac + "33"}`, borderRadius: 18, padding: "24px", cursor: "pointer", position: "relative", overflow: "hidden", transform: hov ? "translateY(-6px) scale(1.01)" : "none", boxShadow: hov ? `0 20px 60px ${ac}30, 0 0 0 1px ${ac}20` : `0 4px 20px ${ac}14`, transition: "all 0.28s cubic-bezier(.22,.68,0,1.2)" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `${ac}14`, filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "flex-end", maxWidth: 160 }}>
        {ownsAll && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 8px", borderRadius: 10 }}>BUNDLE OWNED ✓</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>{bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}33`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: `${ac}bb`, fontStyle: "italic", marginBottom: 16 }}>{bundle.tagline}</div>
      <div style={{ height: 72, borderRadius: 10, marginBottom: 14, overflow: "hidden", position: "relative", background: bundle.previewKind === "fire" ? "rgba(10,2,1,0.99)" : bundle.previewKind === "bloodmoon" ? "linear-gradient(135deg,rgba(10,0,0,0.99),rgba(18,0,10,0.99))" : bundle.previewKind === "egypt" ? "linear-gradient(135deg,rgba(7,4,0,0.99),rgba(14,7,0,0.99))" : bundle.previewKind === "synthwave" ? "linear-gradient(135deg,rgba(10,0,42,0.99),rgba(204,32,96,0.92))" : bundle.previewKind === "matrix" ? "linear-gradient(135deg,rgba(0,3,0,0.99),rgba(0,16,0,0.92))" : bundle.previewKind === "arcane" ? "linear-gradient(135deg,rgba(10,0,18,0.99),rgba(3,0,4,0.96))" : bundle.previewKind === "bio" ? "linear-gradient(135deg,rgba(0,10,15,0.99),rgba(0,3,4,0.96))" : bundle.previewKind === "forge" ? "linear-gradient(135deg,rgba(10,2,0,0.99),rgba(8,1,0,0.98))" : bundle.previewKind === "void" ? "linear-gradient(135deg,rgba(4,1,26,0.99),rgba(0,0,8,0.98))" : bundle.previewKind === "space" ? "linear-gradient(135deg,rgba(2,4,16,0.99),rgba(13,27,59,0.98))" : bundle.previewKind === "pixel" ? "linear-gradient(135deg,rgba(10,10,24,0.99),rgba(15,52,96,0.94))" : bundle.previewKind === "tokyo" ? "linear-gradient(135deg,rgba(4,0,8,0.99),rgba(3,0,8,0.98))" : "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))", border: `1px solid ${bundle.previewKind === "fire" ? "rgba(140,20,0,0.35)" : bundle.previewKind === "glacier" ? "rgba(125,211,252,0.42)" : bundle.previewKind === "bloodmoon" ? "rgba(220,38,38,0.42)" : bundle.previewKind === "egypt" ? "rgba(245,158,11,0.42)" : bundle.previewKind === "synthwave" ? "rgba(255,0,180,0.42)" : bundle.previewKind === "matrix" ? "rgba(0,255,65,0.42)" : bundle.previewKind === "arcane" ? "rgba(168,85,247,0.42)" : bundle.previewKind === "bio" ? "rgba(0,255,208,0.42)" : bundle.previewKind === "forge" ? "rgba(255,102,0,0.42)" : bundle.previewKind === "void" ? "rgba(139,92,246,0.42)" : bundle.previewKind === "space" ? "rgba(0,200,255,0.42)" : bundle.previewKind === "pixel" ? "rgba(255,221,0,0.38)" : bundle.previewKind === "tokyo" ? "rgba(255,0,102,0.42)" : "rgba(80,160,220,0.28)"}` }}>
        {previewActive && bundle.previewKind === "fire" && <Embers count={6} />}
        {previewActive && bundle.previewKind === "fire" && <HeatOverlay />}
        {previewActive && bundle.previewKind === "ice" && <FrostCrystals />}
        {previewActive && bundle.previewKind === "ice" && <IceOverlay />}
        {previewActive && bundle.previewKind === "glacier" && <GlacierAurora />}
        {previewActive && bundle.previewKind === "glacier" && <GlacierSnow count={12} />}
        {!previewActive ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: `${ac}cc`, boxShadow: `0 0 14px ${ac}88` }} />
            <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: `${ac}cc`, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Hover to animate</div>
          </div>
        ) : bundle.previewKind === "bloodmoon" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><BloodMoonGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "egypt" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><EgyptGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "synthwave" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><SynthwaveGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "matrix" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><MatrixGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "arcane" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><ArcaneGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "bio" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><BioGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "forge" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><ForgeGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "void" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><VoidGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "space" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><SpaceGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "pixel" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><PixelGrid showLabels={false} /></div></div>)
        : bundle.previewKind === "tokyo" ? (<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ opacity: 0.98 }}><TokyoGrid showLabels={false} /></div></div>)
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gridTemplateRows: "repeat(5,1fr)", gap: 2, padding: 6, height: "100%", position: "relative", zIndex: 2 }}>
            {Array.from({ length: 25 }).map((_, i) => {
              const isP1 = placedP1.has(i); const isP2 = placedP2.has(i);
              return (<div key={i} style={{ background: bundle.previewKind === "fire" ? "rgba(150,20,0,0.15)" : "rgba(80,160,220,0.12)", border: `1px solid ${bundle.previewKind === "fire" ? "rgba(150,20,0,0.3)" : bundle.previewKind === "glacier" ? "rgba(125,211,252,0.4)" : "rgba(80,160,220,0.3)"}`, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: isP1 ? (bundle.previewKind === "fire" ? "#FF4400" : "#C8EEFF") : isP2 ? (bundle.previewKind === "fire" ? "#AAAAAA" : "#64C8FF") : "transparent", fontSize: 8, fontWeight: 800, lineHeight: 1 }}>{isP1 ? (bundle.previewKind === "fire" ? "🔥" : "❄") : isP2 ? (bundle.previewKind === "fire" ? "💀" : "◆") : ""}</div>);
            })}
          </div>
        )}
        {hov && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", zIndex: 10, fontFamily: "monospace", fontSize: 11, color: `${ac}cc`, letterSpacing: "0.1em" }}>CLICK TO PREVIEW →</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}1A`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 8, color: `${ac}66`, letterSpacing: "0.1em" }}>BOARD</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsAll ? "#4CAF50" : "#fff" }}>{bundle.boardLabel} {ownsAll ? "✓" : ""}</div></div>
        <div style={{ flex: 1, background: `${ac}0C`, border: `1px solid ${ac}1A`, borderRadius: 8, padding: "8px 10px" }}><div style={{ fontFamily: "monospace", fontSize: 8, color: `${ac}66`, letterSpacing: "0.1em" }}>PIECES</div><div style={{ fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 700, color: ownsAll ? "#4CAF50" : "#fff" }}>{bundle.pieceLabel} {ownsAll ? "✓" : ""}</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          {!ownsAll ? (<><div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}66`, letterSpacing: "0.15em", marginBottom: 2 }}>BUNDLE PRICE</div><div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900, color: ac, lineHeight: 1 }}>{bundle.bundlePrice.toLocaleString()}<ProtoSVG size={20} /></div></>) : (<div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: "#4CAF50" }}>Bundle owned ✓</div>)}
        </div>
        <div style={{ background: ownsAll ? "#4CAF5018" : ac, border: ownsAll ? "1px solid #4CAF5044" : "none", borderRadius: 10, padding: "9px 18px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, color: ownsAll ? "#4CAF50" : "#000", letterSpacing: "0.06em" }}>{ownsAll ? "OWNED" : "VIEW BUNDLE →"}</div>
      </div>
    </div>
  );
}
export default function StoreScreen({ setScreenAction, themeId }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, token, updateUser } = useAuthStore();
  const isGuest = !user;

  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyCurrencyType, setBuyCurrencyType] = useState<"protocredits" | "shards">("protocredits");
  const [selectedProto, setSelectedProto] = useState("plus");
  const [selectedShards, setSelectedShards] = useState("plus");
  const [payRedirect, setPayRedirect] = useState<null | "paypal">(null);
  // ── UPI state ──────────────────────────────────────────────────────────────
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiStep, setUpiStep]           = useState<"qr" | "utr" | "success">("qr");
  const [upiUtr, setUpiUtr]             = useState("");
  // ──────────────────────────────────────────────────────────────────────────
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [hovPkg,       setHovPkg]       = useState<string | null>(null);
  const [hovCard,      setHovCard]      = useState<string | null>(null);
  const [buyingId,     setBuyingId]     = useState<string | null>(null);
  const [openBundle,   setOpenBundle]   = useState<string | null>(null);
  const [openThemePreview, setOpenThemePreview] = useState<string | null>(null);
  const [confirmBuy,   setConfirmBuy]   = useState<{ id: string, price: number, shardPrice?: number, label: string } | null>(null);

  const activePackages = buyCurrencyType === "shards" ? SHARD_PACKAGES : PACKAGES;
  const selectedPackageId = buyCurrencyType === "shards" ? selectedShards : selectedProto;
  const pkg = activePackages.find(p => p.id === selectedPackageId)!;
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";
  const accent = isClassic ? "#CC0000" : t.accent;
  const balance = (user as any)?.protocredits ?? 0;
  const shardBalance = (user as any)?.pentashards ?? (user as any)?.shards ?? 0;
  const purchasedItems: string[] = (user as any)?.purchased_items ?? [];

  const ownsBundle = (b: Bundle) => purchasedItems.includes(b.boardId) && purchasedItems.includes(b.pieceId);
  const visibleBundles = BUNDLES.filter((b) => b.id !== "bundle_space" && b.id !== "bundle_pixel" && !ownsBundle(b));

  const PROFILE_FETCH_TIMEOUT = 15000;
  useEffect(() => {
    if (!token) return;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: PROFILE_FETCH_TIMEOUT })
      .then(res => updateUser(res.data)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!showBuyModal) setPayRedirect(null);
  }, [showBuyModal]);

  useEffect(() => {
    if (!openBundle) return;
    const b = BUNDLES.find((x) => x.id === openBundle);
    if (b && ownsBundle(b)) setOpenBundle(null);
  }, [openBundle, purchasedItems]);

  const showError = (text: string) => { setMsg({ text, ok: false }); setTimeout(() => setMsg(null), 1000); };

  const cssVars = { "--font-display": t.fontDisplay, "--font-mono": t.fontMono, "--font-body": t.fontBody, "--text": t.text, "--text-muted": t.textMuted, "--border": t.border, "--accent": accent } as React.CSSProperties;

  const handleBuyPayPal = async () => {
    if (isGuest) { setShowBuyModal(false); showError(`Sign in to buy ${buyCurrencyType === "shards" ? "PentaShards" : "ProtoCredits"}.`); return; }
    setPayRedirect("paypal"); setMsg(null);
    try {
      sessionStorage.setItem("pp_paypal_package_id", selectedPackageId);
      sessionStorage.setItem("pp_paypal_currency_type", buyCurrencyType);
      const res = await API.post("/api/paypal/create-order", { package_id: selectedPackageId, currency_type: buyCurrencyType }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      window.location.href = res.data.approve_url;
    } catch (e: any) {
      showError(e?.response?.data?.detail || e?.message || "Payment failed. Please try again.");
      setPayRedirect(null);
    }
  };

  const payBusy = payRedirect !== null;

  const handleBuyCosmetic = (id: string, price: number, label: string, shardPrice = 0) => {
    if (isGuest) { showError("Sign in to purchase."); return; }
    if (shardPrice > 0) {
      if (balance < price || shardBalance < shardPrice) { setOpenBundle(null); setMsg(null); setBuyCurrencyType(balance < price ? "protocredits" : "shards"); setShowBuyModal(true); showError(`Need ${price.toLocaleString()} ProtoCredits and ${shardPrice.toLocaleString()} PentaShards.`); return; }
    }
    if (balance < price) { setOpenBundle(null); setMsg(null); setBuyCurrencyType("protocredits"); setShowBuyModal(true); return; }
    setConfirmBuy({ id, price, shardPrice, label });
  };

  const proceedBuyCosmetic = async () => {
    if (!confirmBuy) return;
    const { id, price, shardPrice = 0, label } = confirmBuy;
    setConfirmBuy(null); setBuyingId(id);
    const isBundlePurchase = id.startsWith("bundle_purchase_");
    const bundleData = isBundlePurchase ? BUNDLES.find(b => b.id === id.replace("bundle_purchase_", "")) : null;
    const isThemeBundlePurchase = id.startsWith("theme_bundle_");
    const themeBundleData = isThemeBundlePurchase ? STORE_THEMES.find(ti => ti.id === id.replace("theme_bundle_", "")) : null;
    try {
      const postPurchase = async (item_id: string, p: number, sp = 0) => {
        let safePrice = p; if (safePrice < 0) safePrice = 0;
        let safeShardPrice = sp; if (safeShardPrice < 0) safeShardPrice = 0;
        if (safePrice === 0 && safeShardPrice === 0) { await API.post("/api/store/purchase-item", { item_id, price: 0, shard_price: 0 }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); return; }
        await API.post("/api/store/purchase-item", { item_id, price: safePrice, shard_price: safeShardPrice }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      };
      if (bundleData) {
        const owned = new Set(purchasedItems); const needBoard = !owned.has(bundleData.boardId); const needPiece = !owned.has(bundleData.pieceId);
        if (!needBoard && !needPiece) { setMsg({ text: "✓ Bundle already owned.", ok: true }); setOpenBundle(null); setTimeout(() => setMsg(null), 2500); return; }
        const boardCharge = needBoard ? (needPiece ? Math.min(bundleData.boardPrice, price) : price) : 0;
        const pieceCharge = needPiece ? (needBoard ? Math.max(0, price - boardCharge) : price) : 0;
        if (needBoard) await postPurchase(bundleData.boardId, boardCharge);
        if (needPiece) await postPurchase(bundleData.pieceId, pieceCharge);
      } else if (themeBundleData) {
        const owned = new Set(purchasedItems); const themeItemId = themeBundleData.purchaseId; const boardItemId = themeBundleData.boardId;
        const needTheme = !owned.has(themeItemId); const needBoard = !owned.has(boardItemId);
        if (!needTheme && !needBoard) { setMsg({ text: "✓ Theme bundle already owned.", ok: true }); setTimeout(() => setMsg(null), 2500); return; }
        const themeSuggested = Math.round(price * 0.7); const themeCharge = needTheme ? (needBoard ? themeSuggested : price) : 0; const boardCharge = needBoard ? (needTheme ? Math.max(0, price - themeCharge) : price) : 0;
        const shardTarget = themeBundleData.shardPrice ?? shardPrice; const themeShardSuggested = Math.round(shardTarget * 0.7); const themeShardCharge = needTheme ? (needBoard ? themeShardSuggested : shardTarget) : 0; const boardShardCharge = needBoard ? (needTheme ? Math.max(0, shardTarget - themeShardCharge) : shardTarget) : 0;
        if (needTheme) await postPurchase(themeItemId, themeCharge, themeShardCharge);
        if (needBoard) await postPurchase(boardItemId, boardCharge, boardShardCharge);
      } else {
        await API.post("/api/store/purchase-item", { item_id: id, price, shard_price: shardPrice ?? 0 }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      }
      try { const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); updateUser(me.data); } catch {}
      setMsg({ text: `✓ ${label} unlocked! Equip it in your Collection.`, ok: true }); setOpenBundle(null); setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (detail && String(detail).toLowerCase().includes("already owned")) { try { const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }); updateUser(me.data); } catch {} }
      showError(detail || "Purchase failed. Try again.");
    } finally { setBuyingId(null); }
  };

  const GuestBuyBtn = () => (<button onClick={() => setScreenAction("auth")} style={{ flexShrink: 0, background: t.accent, border: "none", borderRadius: 8, padding: "6px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 4 }}>SIGN IN</button>);

  const activeBundleData = openBundle ? BUNDLES.find(b => b.id === openBundle) : null;
  const activeThemePreview = openThemePreview ? STORE_THEMES.find(ti => ti.id === openThemePreview) : null;
  return (
    <div style={{ ...cssVars, minHeight: "100vh", background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg, transition: "background 0.4s", paddingTop: 84, overflowY: "auto", position: "relative", zIndex: 2 }}>
      <style>{`
        .store-card { transition: transform 0.22s cubic-bezier(.22,.68,0,1.2), box-shadow 0.22s ease, border-color 0.18s ease; cursor: pointer; }
        .store-card:hover { transform: translateY(-4px) scale(1.02); }
        .store-card.no-lift:hover { transform: none; }
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
        @keyframes glAurora1{from{transform:translate(-2%,0) scale(1)}to{transform:translate(4%,8%) scale(1.08)}}
        @keyframes glAurora2{from{transform:translate(0,0) scale(1)}to{transform:translate(-5%,6%) scale(1.06)}}
        @keyframes glAurora3{from{transform:translate(0,0) scale(1)}to{transform:translate(3%,-7%) scale(1.05)}}
        @keyframes glSnowFall{0%{transform:translateY(-8px) translateX(0px);opacity:0}8%{opacity:.88}85%{opacity:.45}100%{transform:translateY(800px) translateX(var(--gl-dx,12px));opacity:0}}
        @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7)}}
        @keyframes iceWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(100,200,255,0.3)}50%{box-shadow:0 0 28px rgba(100,200,255,0.7)}}
        .modal-panel { animation: slideUp 0.22s cubic-bezier(.22,.68,0,1.2); }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {activeBundleData && (
        <BundleModal bundle={activeBundleData} t={t} isGuest={isGuest} buyingId={buyingId} purchasedItems={purchasedItems} balance={balance}
          onClose={() => setOpenBundle(null)} onBuy={handleBuyCosmetic}
          onOpenBuyCredits={() => { setOpenBundle(null); setMsg(null); setBuyCurrencyType("protocredits"); setShowBuyModal(true); }} />
      )}
      {activeThemePreview && (<ThemePreviewModal item={activeThemePreview} t={t} onClose={() => setOpenThemePreview(null)} />)}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 72px" }}>

        {isGuest && (
          <div style={{ background: `${accent}10`, border: `1px solid ${accent}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: accent }}>Browsing as Guest</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>Sign in to purchase ProtoCredits and unlock premium equipment.</div>
            </div>
            <button onClick={() => setScreenAction("auth")} style={{ marginLeft: "auto", flexShrink: 0, background: accent, border: "none", color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, padding: "7px 16px", borderRadius: 7, cursor: "pointer", letterSpacing: "0.06em" }}>SIGN IN</button>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 48, gap: 24, flexWrap: "wrap" as const }}>
          <div>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accent, letterSpacing: "0.3em", marginBottom: 10 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, color: t.text, lineHeight: 1.05, marginBottom: 10 }}>UNLOCK YOUR<br /><span style={{ color: accent }}>ARSENAL</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, maxWidth: 420 }}>Earn rewards through ranked play and achievements — or top up ProtoCredits to unlock exclusive cosmetics instantly.</div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "stretch" }}>
            <div className="store-card" onClick={() => { if (isGuest) { showError("Sign in to buy PentaShards."); return; } setMsg(null); setBuyCurrencyType("shards"); setShowBuyModal(true); }} style={{ flexShrink: 0, minWidth: 260, maxWidth: 320, background: "linear-gradient(135deg, rgba(79,195,247,0.18), rgba(79,195,247,0.08))", border: `2px solid ${isGuest ? t.border : "#4FC3F755"}`, borderRadius: 18, padding: "22px 24px", boxShadow: "0 0 40px rgba(79,195,247,0.22)", position: "relative", overflow: "hidden", opacity: isGuest ? 0.75 : 1 }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(79,195,247,0.22)", filter: "blur(40px)", pointerEvents: "none" }} />
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: "#4FC3F7", letterSpacing: "0.25em", marginBottom: 10 }}>PENTASHARDS</div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 6, lineHeight: 1.1 }}>Buy<br /><span style={{ color: "#4FC3F7" }}>PentaShards</span></div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Starting from ₹25 · Instant delivery</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 18 }}>{SHARD_PACKAGES.map(p => (<div key={`shard_${p.id}`} style={{ fontFamily: t.fontMono, fontSize: 10, color: "#4FC3F7", background: "rgba(79,195,247,0.14)", border: "1px solid rgba(79,195,247,0.33)", borderRadius: 6, padding: "3px 8px" }}>{p.credits + p.bonus}</div>))}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color: isGuest ? t.textMuted : "#000", background: isGuest ? t.bgCard : "#4FC3F7", borderRadius: 8, padding: "9px 16px", justifyContent: "center", border: isGuest ? `1px solid ${t.border}` : "none" }}>{isGuest ? "SIGN IN TO BUY" : (<><ShardSVG size={16} /> OPEN STORE</>)}</div>
              {!isGuest && <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: t.fontMono, fontSize: 22, color: t.textMuted }}>Balance: <span style={{ color: "#4FC3F7", display: "flex", alignItems: "center", gap: 6 }}>{shardBalance.toLocaleString()} <ShardSVG size={21} /></span></div>}
            </div>
            <div className="store-card" onClick={() => { if (isGuest) { showError("Sign in to buy ProtoCredits."); return; } setMsg(null); setBuyCurrencyType("protocredits"); setShowBuyModal(true); }} style={{ flexShrink: 0, minWidth: 260, maxWidth: 320, background: `linear-gradient(135deg, ${accent}18, ${accent}08)`, border: `2px solid ${isGuest ? t.border : accent + "55"}`, borderRadius: 18, padding: "22px 24px", boxShadow: `0 0 40px ${accent}22`, position: "relative", overflow: "hidden", opacity: isGuest ? 0.75 : 1 }}>
              <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `${accent}22`, filter: "blur(40px)", pointerEvents: "none" }} />
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, letterSpacing: "0.25em", marginBottom: 10 }}>PROTOCREDITS</div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900, color: t.text, marginBottom: 6, lineHeight: 1.1 }}>Buy<br /><span style={{ color: accent }}>ProtoCredits</span></div>
              <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginBottom: 16 }}>Starting from ₹49 · Instant delivery</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 18 }}>{PACKAGES.map(p => (<div key={p.id} style={{ fontFamily: t.fontMono, fontSize: 10, color: accent, background: `${accent}14`, border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px 8px" }}>{p.credits + p.bonus}</div>))}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color: isGuest ? t.textMuted : "#000", background: isGuest ? t.bgCard : accent, borderRadius: 8, padding: "9px 16px", justifyContent: "center", border: isGuest ? `1px solid ${t.border}` : "none" }}>{isGuest ? "SIGN IN TO BUY" : (<><ProtoSVG size={16} /> OPEN STORE</>)}</div>
              {!isGuest && <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: t.fontMono, fontSize: 22, color: t.textMuted }}>Balance: <span style={{ color: accent, display: "flex", alignItems: "center", gap: 6 }}>{balance.toLocaleString()} <ProtoSVG size={21}/></span></div>}
            </div>
          </div>
        </div>
        {/* THEME BUNDLES */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="THEME BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>}/>
          <div style={{ paddingTop: 14, paddingInline: 10 }}>
            <InfiniteCarouselRow items={STORE_THEMES} itemWidth={380} gap={28} renderItem={(item) => (
              (() => {
                const themeOwned = item.purchaseId ? purchasedItems.includes(item.purchaseId) : false;
                const boardOwned = item.boardId ? purchasedItems.includes(item.boardId) : false;
                const owned = themeOwned && boardOwned;
                const price = item.price ?? 0; const shardPrice = item.shardPrice ?? 0;
                const glow = item.accentColor ?? accent;
                return (
                  <div className="store-card no-lift" onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)} style={{ borderRadius: 18, overflow: "hidden", border: `2px solid ${owned ? "#4CAF50" : hovCard === item.id ? glow + "CC" : glow + "66"}`, background: t.bgCard, boxShadow: owned ? `0 0 44px ${glow}44` : hovCard === item.id ? `0 0 56px ${glow}66` : `0 0 34px ${glow}33`, minHeight: 402 }}>
                    <div style={{ height: 120, background: item.preview, position: "relative", borderBottom: `1px solid ${glow}33` }}>
                      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 75% 20%, ${glow}55, transparent 45%)` }} />
                      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}><UnlockBadge text={owned ? "Owned" : item.unlock} accent={owned ? "#4CAF50" : glow} /></div>
                      {hovCard === item.id && (
                        <div style={{ position: "absolute", inset: 0, zIndex: 3, background: "rgba(0,0,0,0.36)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 8 }}>
                          <div style={{ height: 72, borderRadius: 8, overflow: "hidden", border: `1px solid ${glow}66`, background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {item.id === "space" ? <div style={{ opacity: 0.98 }}><SpaceGrid showLabels={false} /></div> : <div style={{ opacity: 0.98 }}><PixelGrid showLabels={false} /></div>}
                          </div>
                          <div style={{ fontFamily: t.fontMono, fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.52)", border: `1px solid ${glow}55`, borderRadius: 6, padding: "4px 6px", lineHeight: 1.2 }}>{item.boardLabel} | {item.musicLabel} | {item.fontLabel} | {item.bgLabel}</div>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "26px 26px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: t.text, letterSpacing: "0.04em" }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: glow, marginTop: 4, marginBottom: 8, fontStyle: "italic" }}>{item.tagline}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 12 }}>{item.desc}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 }}>{(item.tags ?? []).map((tag) => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: glow, background: `${glow}18`, border: `1px solid ${glow}55`, padding: "2px 7px", borderRadius: 4 }}>{tag}</span>))}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                        <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>Includes: <span style={{ color: glow }}>{item.boardLabel}</span>, {item.musicLabel}, {item.fontLabel}, {item.bgLabel}</div>
                        {!owned && <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted }}>Owned now: Theme {themeOwned ? "✓" : "✗"} · Board {boardOwned ? "✓" : "✗"}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {owned ? (<div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.06em" }}>OWNED</div>) : (<div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: glow, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>{price.toLocaleString()} <ProtoSVG size={16} /> {shardPrice.toLocaleString()} <ShardSVG size={16} /></div>)}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                          <button type="button" onClick={() => setOpenThemePreview(item.id)} style={{ width: "100%", boxSizing: "border-box" as const, background: "rgba(0,0,0,0.35)", border: `1.5px solid ${glow}66`, borderRadius: 10, padding: "10px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 900, color: glow, cursor: "pointer" }}>VIEW PREVIEW</button>
                          {owned ? (<button type="button" disabled style={{ width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,0.06)", border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.65)", cursor: "not-allowed" }}>✓</button>) : isGuest ? (<button type="button" onClick={() => setScreenAction("auth")} style={{ width: "100%", boxSizing: "border-box" as const, background: glow, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: "pointer" }}>SIGN IN</button>) : (<button type="button" onClick={() => handleBuyCosmetic(`theme_bundle_${item.id}`, price, `${item.label} Bundle`, shardPrice)} disabled={!item.purchaseId || price <= 0} style={{ width: "100%", boxSizing: "border-box" as const, background: glow, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: !item.purchaseId || price <= 0 ? "not-allowed" : "pointer", opacity: !item.purchaseId || price <= 0 ? 0.7 : 1 }}>UNLOCK</button>)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )} />
          </div>
        </div>

        {/* BOARD BUNDLES */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="BOARD BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}/>
          <InfiniteCarouselRow items={visibleBundles} itemWidth={360} gap={20} renderItem={(bundle) => <BundleCard bundle={bundle} purchasedItems={purchasedItems} t={t} onClick={() => setOpenBundle(bundle.id)} />} />
        </div>

        {/* COIN BUNDLES */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="COIN BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {COIN_BUNDLES.map(bundle => {
              const owned = purchasedItems.includes(bundle.purchaseId); const glow = bundle.accentColor;
              return (
                <div key={bundle.id} className="store-card" style={{ borderRadius: 18, overflow: "hidden", border: `2px solid ${owned ? "#4CAF50" : bundle.accentColor + "33"}`, background: bundle.bgGradient, padding: "24px", position: "relative", boxShadow: owned ? "none" : `0 8px 32px ${bundle.accentColor}22` }}>
                  <div style={{ position: "absolute", top: 14, right: 14, zIndex: 2 }}>
                    {owned ? <UnlockBadge text="Owned" accent="#4CAF50" /> : (<span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.45)", border: `1px solid ${glow}55`, padding: "4px 10px", borderRadius: 8 }}>{bundle.bundlePrice.toLocaleString()} <ProtoSVG size={12} /> {bundle.shardPrice.toLocaleString()} <ShardSVG size={12} /></span>)}
                  </div>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
                  <div style={{ fontFamily: t.fontBody, fontSize: 13, color: `${bundle.accentColor}cc`, fontStyle: "italic", marginBottom: 10 }}>{bundle.tagline}</div>
                  <div style={{ fontFamily: t.fontBody, fontSize: 12, color: "rgba(255,255,255,0.72)", marginBottom: 14, lineHeight: 1.45 }}>{bundle.desc}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 18 }}>{bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: bundle.accentColor, background: `${bundle.accentColor}18`, border: `1px solid ${bundle.accentColor}44`, padding: "2px 7px", borderRadius: 4 }}>{tag}</span>))}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    {owned ? (<span style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.06em" }}>OWNED — equip in Collection</span>) : (<span style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: glow, letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 6 }}>{bundle.bundlePrice.toLocaleString()} <ProtoSVG size={16} /> + {bundle.shardPrice.toLocaleString()} <ShardSVG size={16} /></span>)}
                    {owned ? (<button type="button" disabled style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.65)", cursor: "not-allowed" }}>✓</button>) : isGuest ? (<button type="button" onClick={() => setScreenAction("auth")} style={{ background: glow, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: "pointer" }}>SIGN IN</button>) : (<button type="button" onClick={() => handleBuyCosmetic(bundle.purchaseId, bundle.bundlePrice, bundle.label, bundle.shardPrice)} style={{ background: glow, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: "pointer", boxShadow: `0 4px 20px ${glow}44` }}>UNLOCK</button>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BANNERS */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="BANNERS" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/></svg>}/>
          <InfiniteCarouselRow items={STORE_BANNERS} itemWidth={360} gap={20} renderItem={(banner) => {
            const owned = banner.id === "default" || purchasedItems.includes(banner.id); const price = banner.price ?? 0;
            return (
              <div className="store-card" style={{ borderRadius: 18, overflow: "hidden", border: `2px solid ${owned ? "#4CAF50" : accent + "33"}`, background: banner.gradient, padding: "0", position: "relative", boxShadow: owned ? "none" : `0 8px 32px ${accent}22` }}>
                <div style={{ height: 120, position: "relative" }}>
                  <BannerRenderer banner={banner} style={{ position: "absolute", inset: 0 }} hideLabels={true} />
                  <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}><UnlockBadge text={owned ? "Owned" : banner.unlock} accent={owned ? "#4CAF50" : accent} /></div>
                </div>
                <div style={{ padding: 24 }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 6 }}>{banner.label}</div>
                  <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "rgba(255,255,255,0.74)", fontStyle: "italic", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>{banner.unlock === "Free" ? "Free to unlock" : (<><span>Unlock for {price.toLocaleString()}</span><ProtoSVG size={12} /></>)}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    {owned ? (<div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.06em" }}>OWNED</div>) : (<div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: accent, letterSpacing: "0.06em", display: "inline-flex", alignItems: "center", gap: 6 }}><span>{price.toLocaleString()}</span><ProtoSVG size={16} /></div>)}
                    {owned ? (<button disabled style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.14)`, borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.65)", cursor: "not-allowed" }}>✓</button>) : isGuest ? (<button onClick={() => setScreenAction("auth")} style={{ background: accent, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const }}>SIGN IN</button>) : (<button onClick={() => handleBuyCosmetic(banner.id, price, `${banner.label} Banner`)} disabled={price <= 0} style={{ background: accent, border: "none", borderRadius: 10, padding: "10px 14px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 900, color: "#000", cursor: price <= 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, opacity: price <= 0 ? 0.7 : 1 }}>{price <= 0 ? "UNAVAILABLE" : "UNLOCK"}</button>)}
                  </div>
                </div>
              </div>
            );
          }} />
        </div>

        <div style={{ textAlign: "center" as const }}>
          <button onClick={() => setScreenAction("home")} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>← GO BACK</button>
        </div>

        {msg && (<div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: msg.ok ? "#1a2e1a" : "#2e1a1a", border: `1px solid ${msg.ok ? "#4CAF50" : "#EF4444"}`, borderRadius: 10, padding: "10px 22px", fontFamily: t.fontMono, fontSize: 13, color: msg.ok ? "#4CAF50" : "#EF4444", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em" }}>{msg.ok ? "✓" : ""} {msg.text}</div>)}
      </div>
      {/* ── Currency Buy Modal ── */}
      {showBuyModal && !isGuest && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowBuyModal(false); }} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="modal-panel" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setShowBuyModal(false)} style={{ position: "absolute", top: 16, right: 16, background: `${t.border}44`, border: "none", borderRadius: 8, color: t.textMuted, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, color: buyCurrencyType === "shards" ? "#4FC3F7" : accent, letterSpacing: "0.25em", marginBottom: 8 }}>PROTOCOL STORE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: t.text, marginBottom: 4 }}>{buyCurrencyType === "shards" ? (<>BUY PENTA<span style={{ color: "#4FC3F7" }}>SHARDS</span></>) : (<>BUY PROTO<span style={{ color: accent }}>CREDITS</span></>)}</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 24 }}>{buyCurrencyType === "shards" ? "Use PentaShards for shard-based progression rewards." : "Use ProtoCredits to unlock cosmetics and exclusive content."}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {activePackages.map(p => {
                const isSel = selectedPackageId === p.id; const isHov = hovPkg === p.id;
                return (
                  <div key={p.id} className="store-pkg" onClick={() => (buyCurrencyType === "shards" ? setSelectedShards(p.id) : setSelectedProto(p.id))} onMouseEnter={() => setHovPkg(p.id)} onMouseLeave={() => setHovPkg(null)} style={{ position: "relative", background: isSel ? `${buyCurrencyType === "shards" ? "#4FC3F7" : accent}14` : isHov ? `${buyCurrencyType === "shards" ? "#4FC3F7" : accent}08` : t.bgCard, border: `2px solid ${isSel ? (buyCurrencyType === "shards" ? "#4FC3F7" : accent) : isHov ? (buyCurrencyType === "shards" ? "#4FC3F755" : accent + "55") : t.border}`, borderRadius: 12, padding: "16px 14px", boxShadow: isSel ? `0 0 20px ${buyCurrencyType === "shards" ? "#4FC3F7" : accent}22` : "none" }}>
                    {p.popular && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: buyCurrencyType === "shards" ? "#4FC3F7" : accent, color: "#000", fontFamily: t.fontMono, fontSize: 9, fontWeight: 800, padding: "2px 10px", borderRadius: 20, letterSpacing: "0.12em", whiteSpace: "nowrap" as const }}>POPULAR</div>}
                    <div style={{ fontFamily: t.fontMono, fontSize: 10, color: isSel ? (buyCurrencyType === "shards" ? "#4FC3F7" : accent) : t.textMuted, letterSpacing: "0.18em", marginBottom: 6 }}>{p.label}</div>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: isSel ? (buyCurrencyType === "shards" ? "#4FC3F7" : accent) : t.text, lineHeight: 1, marginBottom: 2 }}>{p.credits.toLocaleString()}</div>
                    {p.bonus > 0 && <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "#4CAF50", marginBottom: 6 }}>+{p.bonus} bonus</div>}
                    {p.bonus === 0 && <div style={{ marginBottom: 14 }} />}
                    <div style={{ height: 1, background: isSel ? `${buyCurrencyType === "shards" ? "#4FC3F7" : accent}33` : t.border, marginBottom: 10 }} />
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: isSel ? (buyCurrencyType === "shards" ? "#4FC3F7" : accent) : t.text }}>₹{p.price}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted }}>{p.desc}</div>
                    {isSel && <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: buyCurrencyType === "shards" ? "#4FC3F7" : accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 900 }}>✓</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ background: t.bgPanel || t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12 }}>ORDER SUMMARY</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>{pkg.label} Package</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: t.text }}>₹{pkg.price}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: pkg.bonus > 0 ? 8 : 0 }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted }}>{buyCurrencyType === "shards" ? "PentaShards" : "ProtoCredits"}</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: buyCurrencyType === "shards" ? "#4FC3F7" : accent }}>{pkg.credits.toLocaleString()}</span></div>
              {pkg.bonus > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontFamily: t.fontBody, fontSize: 13, color: "#4CAF50" }}>Bonus Credits</span><span style={{ fontFamily: t.fontMono, fontSize: 13, color: "#4CAF50" }}>+{pkg.bonus}</span></div>}
              <div style={{ height: 1, background: t.border, margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: t.text }}>Total</span>
                <div style={{ textAlign: "right" as const }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 900, color: buyCurrencyType === "shards" ? "#4FC3F7" : accent }}>₹{pkg.price}</div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>{pkg.credits + pkg.bonus} {buyCurrencyType === "shards" ? "shards" : "credits"}</div>
                </div>
              </div>
            </div>
            {msg && <div style={{ background: msg.ok ? "#4CAF5014" : `${t.danger}14`, border: `1px solid ${msg.ok ? "#4CAF50" : t.danger}`, borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontFamily: t.fontBody, fontSize: 13, color: msg.ok ? "#4CAF50" : t.danger }}>{msg.text}</div>}

            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 10 }}>CHOOSE PAYMENT METHOD</div>

            {/* PayPal */}
            <button onClick={handleBuyPayPal} disabled={payBusy} className="store-buy-btn" style={{ width: "100%", padding: "14px", background: payBusy ? "#00308788" : "#003087", border: "2px solid #003087", borderRadius: 10, color: "#fff", fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 900, cursor: payBusy ? "not-allowed" : "pointer", letterSpacing: "0.06em", boxShadow: payBusy ? "none" : "0 0 24px rgba(0,48,135,0.5)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M20.067 8.478c.492.315.844.825.983 1.39C21.6 12.525 20.2 15 17.5 15H15l-.8 4H10l2.5-13H17c1.657 0 2.757.693 3.067 2.478z" opacity=".6"/><path d="M7 5h7c1.657 0 2.757.693 3.067 2.478.492.315.844.825.983 1.39C18.6 11.525 17.2 14 14.5 14H12l-.8 4H7l2.5-13z"/></svg>
              {payRedirect === "paypal" ? "Redirecting to PayPal…" : `PAY $${(buyCurrencyType === "shards" ? SHARD_PACKAGES_USD : PACKAGES_USD).find(p => p.id === pkg.id)?.usdPrice.toFixed(2) ?? pkg.price} · PAY WITH PAYPAL`}
            </button>

            <button
              type="button"
              onClick={() => window.open("/refund#creator-payment-qr", "_blank", "noopener,noreferrer")}
              style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.06)", border: `2px solid ${t.border}`, borderRadius: 10, color: t.text, fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h7v7h-7z"/></svg>
              CREATOR QR (INR) — OPEN REFUND PAGE
            </button>
            {/* ── UPI / QR Code button ── */}
            <button
              onClick={() => { setShowBuyModal(false); setUpiStep("qr"); setUpiUtr(""); setShowUpiModal(true); }}
              disabled={payBusy}
              className="store-buy-btn"
              style={{ width: "100%", padding: "14px", background: payBusy ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg,#052e16,#166534)", border: `2px solid ${payBusy ? t.border : "#16a34a"}`, borderRadius: 10, color: "#fff", fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 900, cursor: payBusy ? "not-allowed" : "pointer", letterSpacing: "0.06em", boxShadow: payBusy ? "none" : "0 0 20px rgba(22,163,74,0.4)", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/><rect x="18" y="19" width="3" height="2"/></svg>
              PAY ₹{pkg.price} · UPI / QR CODE
            </button>

            <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, textAlign: "center" as const, marginTop: 4, lineHeight: 1.6 }}>
              PayPal (USD) for international cards &amp; wallets · UPI / creator QR (INR) as on the Refund Policy page. {buyCurrencyType === "shards" ? "PentaShards" : "ProtoCredits"} are non-refundable except as stated in the Refund Policy.
            </div>
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
              <div style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 700, color: accent, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {confirmBuy.price.toLocaleString()} <ProtoSVG size={22} />
                {(confirmBuy.shardPrice ?? 0) > 0 && (<><span style={{ color: t.textMuted }}>+</span>{confirmBuy.shardPrice?.toLocaleString()} <ShardSVG size={22} /></>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <button onClick={() => setConfirmBuy(null)} style={{ flex: 1, padding: "14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>CANCEL</button>
              <button onClick={proceedBuyCosmetic} style={{ flex: 1, padding: "14px", background: accent, border: "none", borderRadius: 10, color: "#000", fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, cursor: "pointer", boxShadow: `0 0 20px ${accent}44`, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; e.currentTarget.style.transform = "translateY(-1px)"; }} onMouseLeave={e => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPI QR Modal ── */}
      {showUpiModal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowUpiModal(false); setUpiStep("qr"); setUpiUtr(""); } }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="modal-panel" style={{ background: t.bg, border: "1px solid #16a34a55", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 440, position: "relative" }}>
            <button onClick={() => { setShowUpiModal(false); setUpiStep("qr"); setUpiUtr(""); }} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, color: t.textMuted, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

            {upiStep !== "success" && (
              <>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: "#16a34a", letterSpacing: "0.25em", marginBottom: 8 }}>UPI PAYMENT</div>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900, color: t.text, marginBottom: 4 }}>
                  Scan &amp; Pay <span style={{ color: "#16a34a" }}>₹{pkg.price}</span>
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 20 }}>
                  Open PhonePe, Paytm, or GPay — tap Scan and point at the QR below.
                </div>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 12, border: "2px solid #16a34a44" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=9773809183@pthdfc&pn=Yagya%20Mishra&am=${pkg.price}&cu=INR&tn=PentaProtocol%20Payment`)}`}
                      alt="UPI QR Code"
                      width={180}
                      height={180}
                      style={{ display: "block", borderRadius: 4 }}
                    />
                  </div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, color: "#16a34a", background: "#16a34a14", border: "1px solid #16a34a33", borderRadius: 8, padding: "6px 14px" }}>
                    9773809183@pthdfc
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["PhonePe", "Paytm", "GPay", "BHIM"].map(app => (
                      <span key={app} style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 20, padding: "3px 10px" }}>{app}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>
                  AFTER PAYING — ENTER UTR / TRANSACTION ID
                </div>
                <input
                  type="text"
                  placeholder="e.g. 426831900234"
                  value={upiUtr}
                  onChange={e => setUpiUtr(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" as const, marginBottom: 12, background: t.bgCard, border: `1px solid ${upiUtr.length > 5 ? "#16a34a" : t.border}`, borderRadius: 10, padding: "12px 14px", color: t.text, fontFamily: t.fontMono, fontSize: 14, outline: "none" }}
                />
                <button
                  onClick={async () => {
                    if (upiUtr.trim().length < 6) return;
                    try {
                      await API.post("/api/store/upi-submit", {
                        utr:           upiUtr.trim(),
                        amount:        pkg.price,
                        package_id:    selectedPackageId,
                        currency_type: buyCurrencyType,
                      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
                    } catch {}
                    setUpiStep("success");
                  }}
                  disabled={upiUtr.trim().length < 6}
                  style={{ width: "100%", padding: "13px", background: upiUtr.trim().length < 6 ? "rgba(22,163,74,0.3)" : "#16a34a", border: "none", borderRadius: 10, color: "#fff", fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, cursor: upiUtr.trim().length < 6 ? "not-allowed" : "pointer", letterSpacing: "0.06em" }}>
                  I HAVE PAID — SUBMIT
                </button>
              </>
            )}

            {upiStep === "success" && (
              <div style={{ textAlign: "center" as const, padding: "12px 0" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#16a34a18", border: "2px solid #16a34a44", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7"/></svg>
                </div>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: t.text, marginBottom: 8 }}>Payment Submitted</div>
                <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
                  We'll verify your payment and credit{" "}
                  <span style={{ color: buyCurrencyType === "shards" ? "#4FC3F7" : accent }}>
                    {(pkg.credits + pkg.bonus).toLocaleString()} {buyCurrencyType === "shards" ? "PentaShards" : "ProtoCredits"}
                  </span>{" "}
                  within a few hours.
                </div>
                <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, textAlign: "left" as const }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, fontFamily: t.fontBody, color: t.text }}><span style={{ color: t.textMuted }}>Amount</span><span>₹{pkg.price}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, fontFamily: t.fontBody, color: t.text }}><span style={{ color: t.textMuted }}>UTR</span><span style={{ fontFamily: t.fontMono, fontSize: 12 }}>{upiUtr}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, fontFamily: t.fontBody }}><span style={{ color: t.textMuted }}>Status</span><span style={{ color: "#f59e0b" }}>Pending verification</span></div>
                </div>
                <button onClick={() => { setShowUpiModal(false); setUpiStep("qr"); setUpiUtr(""); }} style={{ width: "100%", padding: "12px", background: "#16a34a", border: "none", borderRadius: 10, color: "#fff", fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 900, cursor: "pointer" }}>DONE</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}