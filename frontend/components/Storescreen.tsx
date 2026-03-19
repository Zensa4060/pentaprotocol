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

declare global { interface Window { Razorpay: any; } }

const STORE_THEMES = [
  { id: "space", label: "Space", desc: "Deep space atmosphere", preview: "linear-gradient(135deg,#020410,#0d1b4b)", unlock: "3,000 PC", price: 2999, purchaseId: "theme_space" },
  { id: "pixel", label: "Pixel", desc: "Retro pixel art style", preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", unlock: "3,000 PC", price: 2999, purchaseId: "theme_pixel" },
];

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
  previewKind: "fire" | "ice" | "glacier" | "bloodmoon" | "egypt" | "synthwave" | "matrix" | "arcane" | "bio" | "forge" | "void" | "space" | "pixel" | "tokyo";
};

const BUNDLES: Bundle[] = [
  {
    id: "bundle_fire", label: "INFERNO BUNDLE", tagline: "Command fire and death",
    desc: "A smoldering battlefield pulsing with crimson energy. Flame surges with living light, the skull stares through the void. Built for the relentless.",
    boardId: "red_grid", pieceId: "piece_flame_skull", boardLabel: "Inferno", pieceLabel: "Flame & Skull",
    accentColor: "#FF3300", bgGradient: "linear-gradient(160deg,#140200,#2a0600,#1a0300)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["FIRE THEME", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "fire",
  },
  {
    id: "bundle_ice", label: "ICE BUNDLE", tagline: "Cool, calculated, absolutely deadly",
    desc: "Crystalline frost spreads across the board. Snowflake geometry meets ice shard aggression. Built for the strategist who plays cold.",
    boardId: "ice_grid", pieceId: "piece_snowflake_shard", boardLabel: "Ice Board", pieceLabel: "Snow & Shard",
    accentColor: "#50a0dc", bgGradient: "linear-gradient(160deg,#010c1f,#01152e,#010a1a)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["ICE THEME", "CRYSTALLINE", "BOARD + PIECES"], isIce: true, previewKind: "ice",
  },
  {
    id: "bundle_glaciergrid", label: "GLACIER BUNDLE", tagline: "Aurora-lit frost, precision first",
    desc: "A deep arctic battleground with aurora glow and crystalline intersections. Includes GlacierGrid board skin and matching Snowflake & Ice Shard piece skin.",
    boardId: "glacier_grid", pieceId: "piece_glacier_shard", boardLabel: "Glacier Board", pieceLabel: "Glacier Sigils",
    accentColor: "#7DD3FC", bgGradient: "linear-gradient(160deg,#020b1a,#031329,#041f35)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["GLACIERGRID", "AURORA", "BOARD + PIECES"], isIce: true, previewKind: "glacier",
  },
  {
    id: "bundle_bloodmoon", label: "BLOODMOON BUNDLE", tagline: "Ritual crimson and violet omen",
    desc: "A cursed battleground under a pulsing blood moon. Dripping crimson, violet lattice lines, and occult sigils that ignite with every move.",
    boardId: "bloodmoon_grid", pieceId: "piece_bloodmoon_sigils", boardLabel: "Bloodmoon Board", pieceLabel: "Pentagram & Eye",
    accentColor: "#DC2626", bgGradient: "linear-gradient(160deg,#070000,#170006,#0a0002)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["BLOODMOON", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "bloodmoon",
  },
  {
    id: "bundle_egypt", label: "EGYPT BUNDLE", tagline: "Golden dunes and ancient sigils",
    desc: "A desert night beneath pyramids and hieroglyph walls. Heat-shimmer lines and sand grains drift as Ankhs and the Eye of Ra blaze into place.",
    boardId: "egypt_grid", pieceId: "piece_egypt_sigils", boardLabel: "Egypt Board", pieceLabel: "Ankh & Eye of Ra",
    accentColor: "#F59E0B", bgGradient: "linear-gradient(160deg,#070400,#1a0f00,#0a0500)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["EGYPT", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "egypt",
  },
  {
    id: "bundle_synthwave", label: "SYNTHWAVE BUNDLE", tagline: "Neon horizon and retro pulse",
    desc: "A neon sunset over a receding grid floor with city silhouettes and glowing nodes. Retro Sun and Neon Palm ignite with every move.",
    boardId: "synthwave_grid", pieceId: "piece_synthwave_sigils", boardLabel: "Synthwave Board", pieceLabel: "Sun & Palm",
    accentColor: "#FF00B4", bgGradient: "linear-gradient(160deg,#0a002a,#1a004a,#cc2060)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["SYNTHWAVE", "NEON", "BOARD + PIECES"], isIce: false, previewKind: "synthwave",
  },
  {
    id: "bundle_matrix", label: "MATRIX BUNDLE", tagline: "Code rain and green pulse",
    desc: "A near-black green battleground with matrix rain, scanlines, glitch blocks, and pulsing code nodes. Brackets and binary sigils render with neon glow.",
    boardId: "matrix_grid", pieceId: "piece_matrix_sigils", boardLabel: "Matrix Board", pieceLabel: "Bracket & Pill",
    accentColor: "#00FF41", bgGradient: "linear-gradient(160deg,#000300,#001000,#000400)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["MATRIX", "GLITCH", "BOARD + PIECES"], isIce: false, previewKind: "matrix",
  },
  {
    id: "bundle_arcane", label: "ARCANE BUNDLE", tagline: "Runes, mist, and magic circles",
    desc: "A deep void board with drifting arcane mist, rotating magic circles, and glowing runes. Portal and gold sigils flare with every move.",
    boardId: "arcane_grid", pieceId: "piece_arcane_sigils", boardLabel: "Arcane Board", pieceLabel: "Portal & Sigil",
    accentColor: "#A855F7", bgGradient: "linear-gradient(160deg,#0a0012,#060008,#030004)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["ARCANE", "RUNES", "BOARD + PIECES"], isIce: false, previewKind: "arcane",
  },
  {
    id: "bundle_bio", label: "BIO BUNDLE", tagline: "Abyss glow and bioluminescence",
    desc: "A deep-sea board with drifting spores, glowing creatures, and bioluminescent gridlines. Jellyfish and angler sigils pulse on placement.",
    boardId: "bio_grid", pieceId: "piece_bio_sigils", boardLabel: "Bio Board", pieceLabel: "Jellyfish & Angler",
    accentColor: "#00FFD0", bgGradient: "linear-gradient(160deg,#000a0f,#000608,#000304)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["BIO", "ABYSS", "BOARD + PIECES"], isIce: false, previewKind: "bio",
  },
  {
    id: "bundle_forge", label: "FORGE BUNDLE", tagline: "Molten veins and rising embers",
    desc: "An obsidian forge board with molten pools, glowing veins, and drifting embers. Hammer and molten sigils ignite each move.",
    boardId: "forge_grid", pieceId: "piece_forge_sigils", boardLabel: "Forge Board", pieceLabel: "Hammer & Molten Sigil",
    accentColor: "#FF6600", bgGradient: "linear-gradient(160deg,#0a0200,#150400,#080100)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["FORGE", "LAVA", "BOARD + PIECES"], isIce: false, previewKind: "forge",
  },
  {
    id: "bundle_void", label: "VOID BUNDLE", tagline: "Nebulae, stars, and cosmic pulses",
    desc: "A deep-space board with drifting nebulae, twinkling stars, shooting streaks, and a pulsing singularity. Pulsar and Quasar sigils flare on placement.",
    boardId: "void_grid", pieceId: "piece_void_sigils", boardLabel: "Void Board", pieceLabel: "Pulsar & Quasar",
    accentColor: "#8B5CF6", bgGradient: "linear-gradient(160deg,#04011a,#020110,#000008)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["VOID", "COSMIC", "BOARD + PIECES"], isIce: false, previewKind: "void",
  },
  {
    id: "bundle_space", label: "SPACE BUNDLE", tagline: "Protocol rockets and satellite signals",
    desc: "A deep-space grid where rockets and satellites ignite on placement. Nebula drift, star twinkles, and targeting arcs light up the board.",
    boardId: "space_grid", pieceId: "piece_space_sigils", boardLabel: "Space Board", pieceLabel: "Rocket & Satellite",
    accentColor: "#00D9FF", bgGradient: "linear-gradient(160deg,#020410,#0b1a3b,#000008)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["SPACE", "ANIMATED", "BOARD + PIECES"], isIce: false, previewKind: "space",
  },
  {
    id: "bundle_pixel", label: "PIXEL BUNDLE", tagline: "8-bit CRT chaos and dither glow",
    desc: "A chunky pixel grid with dithered tiles, CRT scanlines, and floating sprites. Coins and Hearts pop in with crisp 8-bit punch.",
    boardId: "pixel_grid", pieceId: "piece_pixel_sigils", boardLabel: "Pixel Board", pieceLabel: "Coin & Heart",
    accentColor: "#FFDD00", bgGradient: "linear-gradient(160deg,#0a0a18,#0f3460,#2d132c)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["PIXEL", "CRT", "BOARD + PIECES"], isIce: false, previewKind: "pixel",
  },
  {
    id: "bundle_tokyo", label: "TOKYO BUNDLE", tagline: "Neon rain and city glow",
    desc: "A neon city board with animated rain, glowing signage, reflections, and vivid grid tubes. Dragon seals and katanas flash with every move.",
    boardId: "tokyo_grid", pieceId: "piece_tokyo_sigils", boardLabel: "Tokyo Board", pieceLabel: "Dragon Seal & Katana",
    accentColor: "#FF0066", bgGradient: "linear-gradient(160deg,#040008,#070012,#030008)",
    bundlePrice: 1999, boardPrice: 1599, piecePrice: 599,
    tags: ["TOKYO", "NEON", "BOARD + PIECES"], isIce: false, previewKind: "tokyo",
  },
];

type CoinBundle = { id: string; label: string; tagline: string; desc: string; accentColor: string; bgGradient: string; bundlePrice: number; tags: string[] };
const COIN_BUNDLES: CoinBundle[] = [];

type ProfileBundle = { id: string; label: string; tagline: string; accentColor: string; bgGradient: string; tags: string[] };
const PROFILE_BUNDLES: ProfileBundle[] = [];

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

function BannerRenderer({ banner, style = {}, hideLabels = false }: { banner: any; style?: React.CSSProperties; hideLabels?: boolean }) {
  if (banner.component) {
    const BannerComp = banner.component;
    return <BannerComp style={{ width: "100%", height: "100%", ...style }} hideLabels={hideLabels} />;
  }
  return <div style={{ width: "100%", height: "100%", background: banner.gradient, ...style }} />;
}

// ── Real board preview using actual GamePieces components ──────────────────────
function BundleAnimatedPreview({ bundle, tick }: { bundle: Bundle; tick: number }) {
  if (bundle.previewKind === "glacier") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(3,10,22,0.99),rgba(2,8,18,0.99))",
        borderRadius: 12,
        border: "2px solid rgba(125,211,252,0.35)",
        boxShadow: "0 0 56px rgba(80,170,255,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <GlacierAurora />
          <GlacierSnow count={20} />
        </div>
        <div style={{ position: "absolute", left: "50%", top: 10, transform: "translateX(-50%) scale(0.6)", transformOrigin: "top center" }}>
          <GlacierGrid />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(170,230,255,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(130,210,255,0.65)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "bloodmoon") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(10,0,0,0.99),rgba(20,0,8,0.99))",
        borderRadius: 12,
        border: "2px solid rgba(220,38,38,0.35)",
        boxShadow: "0 0 56px rgba(220,38,38,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <BloodMoonGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,120,0.68)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(220,140,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "egypt") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(7,4,0,0.99),rgba(14,7,0,0.99))",
        borderRadius: 12,
        border: "2px solid rgba(245,158,11,0.35)",
        boxShadow: "0 0 56px rgba(245,158,11,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <EgyptGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,210,120,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,230,160,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "synthwave") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(10,0,42,0.99),rgba(204,32,96,0.92))",
        borderRadius: 12,
        border: "2px solid rgba(255,0,180,0.35)",
        boxShadow: "0 0 56px rgba(255,0,180,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <SynthwaveGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,220,0.75)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(140,240,255,0.6)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "matrix") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(0,3,0,0.99),rgba(0,16,0,0.92))",
        borderRadius: 12,
        border: "2px solid rgba(0,255,65,0.35)",
        boxShadow: "0 0 56px rgba(0,255,65,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <MatrixGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(150,255,150,0.7)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(0,255,65,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "arcane") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(10,0,18,0.99),rgba(3,0,4,0.96))",
        borderRadius: 12,
        border: "2px solid rgba(168,85,247,0.35)",
        boxShadow: "0 0 56px rgba(168,85,247,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <ArcaneGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(220,170,255,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,220,140,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "bio") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(0,10,15,0.99),rgba(0,3,4,0.96))",
        borderRadius: 12,
        border: "2px solid rgba(0,255,208,0.32)",
        boxShadow: "0 0 56px rgba(0,255,208,0.12), inset 0 0 44px rgba(0,0,0,0.78)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <BioGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(140,255,230,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(190,140,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "forge") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(10,2,0,0.99),rgba(8,1,0,0.98))",
        borderRadius: 12,
        border: "2px solid rgba(255,102,0,0.30)",
        boxShadow: "0 0 56px rgba(255,102,0,0.16), inset 0 0 44px rgba(0,0,0,0.72)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <ForgeGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,180,120,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,220,140,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "void") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(4,1,26,0.99),rgba(0,0,8,0.98))",
        borderRadius: 12,
        border: "2px solid rgba(139,92,246,0.30)",
        boxShadow: "0 0 56px rgba(139,92,246,0.16), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <VoidGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(200,170,255,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(180,220,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "space") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(2,4,16,0.99),rgba(13,27,59,0.98))",
        borderRadius: 12,
        border: "2px solid rgba(0,200,255,0.30)",
        boxShadow: "0 0 56px rgba(0,200,255,0.14), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <SpaceGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(150,220,255,0.70)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,200,120,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "pixel") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(10,10,24,0.99),rgba(15,52,96,0.94))",
        borderRadius: 12,
        border: "2px solid rgba(255,221,0,0.32)",
        boxShadow: "0 0 56px rgba(255,180,0,0.12), inset 0 0 44px rgba(0,0,0,0.78)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) scale(1.0)" }}>
          <PixelGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,221,0,0.75)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,120,0,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }
  if (bundle.previewKind === "tokyo") {
    return (
      <div style={{
        width: "100%",
        height: 360,
        background: "linear-gradient(135deg,rgba(4,0,8,0.99),rgba(3,0,8,0.98))",
        borderRadius: 12,
        border: "2px solid rgba(255,0,102,0.30)",
        boxShadow: "0 0 56px rgba(255,0,102,0.16), inset 0 0 44px rgba(0,0,0,0.74)",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <TokyoGrid showLabels={false} cellSize={56} />
        </div>
        <div style={{ position: "absolute", top: 8, left: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(255,80,140,0.72)", letterSpacing: "0.18em", zIndex: 10, pointerEvents: "none" }}>{bundle.boardLabel.toUpperCase()}</div>
        <div style={{ position: "absolute", bottom: 8, right: 12, fontFamily: "monospace", fontSize: 9, color: "rgba(0,200,255,0.55)", letterSpacing: "0.1em", zIndex: 10, pointerEvents: "none" }}>LIVE PREVIEW</div>
      </div>
    );
  }

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

  const isIcePreview = bundle.previewKind === "ice";
  const p1c = isIcePreview ? "#C8EEFF" : "#FF4400";
  const p2c = isIcePreview ? "#64C8FF" : "#BBBBBB";
  const useFlameSkull     = !isIcePreview;
  const useSnowflakeShard = isIcePreview;
  const pieceSymbols = { p1: isIcePreview ? "❄" : "🔥", p2: isIcePreview ? "◆" : "💀" };

  return (
    <div style={{
      width: "100%",
      background: isIcePreview ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : "rgba(10,2,1,0.99)",
      borderRadius: 12,
      border: `2px solid ${isIcePreview ? "rgba(80,160,220,0.28)" : "rgba(140,20,0,0.35)"}`,
      boxShadow: isIcePreview ? "0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)" : "0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)",
      padding: 6, position: "relative", overflow: "hidden",
    }}>
      {!isIcePreview && <Embers count={16} />}
      {!isIcePreview && <HeatOverlay />}
      {isIcePreview  && <FrostCrystals />}
      {isIcePreview  && <IceOverlay />}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${CELL})`, gridTemplateRows: `repeat(${GRID}, ${CELL})`, gap: 4, position: "relative", zIndex: 2 }}>
        {board.map((row, r) => row.map((cell, c) => {
          const noop = () => {};
          const cellKey = `${r}-${c}`;
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

// ── Bundle Preview Modal ───────────────────────────────────────────────────────
function BundleModal({ bundle, t, isGuest, buyingId, purchasedItems, balance, onClose, onBuy, onOpenBuyCredits }: {
  bundle: Bundle; t: any; isGuest: boolean; buyingId: string | null;
  purchasedItems: string[]; balance: number;
  onClose: () => void; onBuy: (id: string, price: number, label: string) => void; onOpenBuyCredits: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [hovOpt, setHovOpt] = useState<string | null>(null);
  useEffect(() => { const iv = setInterval(() => setTick(v => v + 1), 900); return () => clearInterval(iv); }, []);

  const ownsBundle = purchasedItems.includes(bundle.boardId) && purchasedItems.includes(bundle.pieceId);
  const ac = bundle.accentColor;

  const options = [
    {
      id: "bundle",
      label: ownsBundle ? "Bundle Owned" : "Buy Bundle",
      sublabel: ownsBundle ? "Board + Pieces unlocked" : `Includes ${bundle.boardLabel} + ${bundle.pieceLabel}`,
      price: bundle.bundlePrice,
      includes: [bundle.boardLabel, bundle.pieceLabel],
      disabled: ownsBundle, owned: ownsBundle, highlight: true,
      purchaseId: "bundle_purchase_" + bundle.id,
    },
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
  const [tick, setTick] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const ownsBoard = purchasedItems.includes(bundle.boardId);
  const ownsPiece = purchasedItems.includes(bundle.pieceId);
  const ownsAll   = ownsBoard && ownsPiece;
  const ac = bundle.accentColor;
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => { setIsVisible(entries[0]?.isIntersecting ?? true); },
      { root: null, threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const previewActive = hov && isVisible;

  useEffect(() => {
    if (!previewActive) return;
    const iv = setInterval(() => setTick(v => v + 1), 650);
    return () => clearInterval(iv);
  }, [previewActive]);
  const p1Cells = [12, 6, 18, 2, 22];
  const p2Cells = [8, 16, 4, 20, 10];
  const totalMoves = p1Cells.length + p2Cells.length;
  const move = tick % (totalMoves + 4);
  const placedP1 = new Set<number>();
  const placedP2 = new Set<number>();
  for (let i = 0; i < move && i < totalMoves; i++) {
    if (i % 2 === 0) placedP1.add(p1Cells[Math.floor(i / 2)]);
    else placedP2.add(p2Cells[Math.floor(i / 2)]);
  }

  return (
    <div ref={cardRef} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: bundle.bgGradient, border: `2px solid ${hov ? ac : ac + "33"}`, borderRadius: 18, padding: "24px", cursor: "pointer", position: "relative", overflow: "hidden", transform: hov ? "translateY(-6px) scale(1.01)" : "none", boxShadow: hov ? `0 20px 60px ${ac}30, 0 0 0 1px ${ac}20` : `0 4px 20px ${ac}14`, transition: "all 0.28s cubic-bezier(.22,.68,0,1.2)" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: `${ac}14`, filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 5, flexWrap: "wrap" as const, justifyContent: "flex-end", maxWidth: 160 }}>
        {ownsAll && <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "#4CAF50", background: "#4CAF5018", border: "1px solid #4CAF5044", padding: "2px 8px", borderRadius: 10 }}>BUNDLE OWNED ✓</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" as const }}>
        {bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: ac, background: `${ac}18`, border: `1px solid ${ac}33`, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.1em" }}>{tag}</span>))}
      </div>
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
            <div style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: `${ac}cc`, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>
              Hover to animate
            </div>
          </div>
        ) : bundle.previewKind === "bloodmoon" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <BloodMoonGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "egypt" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <EgyptGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "synthwave" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <SynthwaveGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "matrix" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <MatrixGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "arcane" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <ArcaneGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "bio" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <BioGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "forge" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <ForgeGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "void" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <VoidGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "space" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <SpaceGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "pixel" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <PixelGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : bundle.previewKind === "tokyo" ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ opacity: 0.98 }}>
              <TokyoGrid showLabels={false} cellSize={10} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gridTemplateRows: "repeat(5,1fr)", gap: 2, padding: 6, height: "100%", position: "relative", zIndex: 2 }}>
            {Array.from({ length: 25 }).map((_, i) => {
              const isP1 = placedP1.has(i);
              const isP2 = placedP2.has(i);
              return (
                <div key={i} style={{ background: bundle.previewKind === "fire" ? "rgba(150,20,0,0.15)" : "rgba(80,160,220,0.12)", border: `1px solid ${bundle.previewKind === "fire" ? "rgba(150,20,0,0.3)" : bundle.previewKind === "glacier" ? "rgba(125,211,252,0.4)" : "rgba(80,160,220,0.3)"}`, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: isP1 ? (bundle.previewKind === "fire" ? "#FF4400" : "#C8EEFF") : isP2 ? (bundle.previewKind === "fire" ? "#AAAAAA" : "#64C8FF") : "transparent", fontSize: 8, fontWeight: 800, lineHeight: 1 }}>
                  {isP1 ? (bundle.previewKind === "fire" ? "🔥" : "❄") : isP2 ? (bundle.previewKind === "fire" ? "💀" : "◆") : ""}
                </div>
              );
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
          {!ownsAll ? (
            <>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: `${ac}66`, letterSpacing: "0.15em", marginBottom: 2 }}>BUNDLE PRICE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900, color: ac, lineHeight: 1 }}>
                {bundle.bundlePrice.toLocaleString()}
                <ProtoSVG size={20} />
              </div>
            </>
          ) : (<div style={{ fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700, color: "#4CAF50" }}>Bundle owned ✓</div>)}
        </div>
        <div style={{ background: ownsAll ? "#4CAF5018" : ac, border: ownsAll ? "1px solid #4CAF5044" : "none", borderRadius: 10, padding: "9px 18px", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, color: ownsAll ? "#4CAF50" : "#000", letterSpacing: "0.06em" }}>{ownsAll ? "OWNED" : "VIEW BUNDLE →"}</div>
      </div>
    </div>
  );
}

// ── Main StoreScreen ──────────────────────────────────────────────────────────
export default function StoreScreen({ setScreenAction, themeId }: Props) {
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

  const ownsBundle = (b: Bundle) => purchasedItems.includes(b.boardId) && purchasedItems.includes(b.pieceId);
  const visibleBundles = BUNDLES.filter((b) => !ownsBundle(b));

  const PROFILE_FETCH_TIMEOUT = 15000;
  useEffect(() => {
    if (!token) return;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: PROFILE_FETCH_TIMEOUT })
      .then(res => updateUser(res.data))
      .catch(() => {});
  }, [token]);

  // If a bundle becomes owned (after purchase / refresh), hide it + close modal.
  useEffect(() => {
    if (!openBundle) return;
    const b = BUNDLES.find((x) => x.id === openBundle);
    if (b && ownsBundle(b)) setOpenBundle(null);
  }, [openBundle, purchasedItems]);

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
              const verifyRes = await API.post("/api/store/verify-payment", { razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, package_id: selected }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
              // ✅ Always fetch full profile
const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
updateUser(me.data); resolve();
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
        const owned = new Set(purchasedItems);
        const needBoard = !owned.has(bundleData.boardId);
        const needPiece = !owned.has(bundleData.pieceId);

        if (!needBoard && !needPiece) {
          setMsg({ text: "✓ Bundle already owned.", ok: true });
          setOpenBundle(null);
          setTimeout(() => setMsg(null), 2500);
          return;
        }

        // Bundle purchases must charge exactly `bundlePrice` total (store discount).
        // If partially owned, charge the full bundle price to the missing item.
        const boardCharge = needBoard ? (needPiece ? Math.min(bundleData.boardPrice, price) : price) : 0;
        const pieceCharge = needPiece ? (needBoard ? Math.max(0, price - boardCharge) : price) : 0;

        const postPurchase = async (item_id: string, p: number) => {
          if (p < 0) p = 0;
          if (p === 0) {
            // Still call backend so item is granted if missing (price 0 is allowed).
            await API.post("/api/store/purchase-item", { item_id, price: 0 }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
            return;
          }
          await API.post("/api/store/purchase-item", { item_id, price: p }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        };

        // Buy missing parts only
        if (needBoard) await postPurchase(bundleData.boardId, boardCharge);
        if (needPiece) await postPurchase(bundleData.pieceId, pieceCharge);
      } else {
        await API.post("/api/store/purchase-item", { item_id: id, price }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      }

      // Always refresh profile after purchases so ownership never desyncs.
      try {
        const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        updateUser(me.data);
      } catch {}

      setMsg({ text: `✓ ${label} unlocked! Equip it in your Collection.`, ok: true });
      setOpenBundle(null);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      // If the backend says it's already owned, immediately sync profile and the item will disappear from store.
      if (detail && String(detail).toLowerCase().includes("already owned")) {
        try {
          const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
          updateUser(me.data);
        } catch {}
      }
      showError(detail || "Purchase failed. Try again.");
    } finally { setBuyingId(null); }
  };

  const GuestBuyBtn = () => (
    <button onClick={() => setScreenAction("auth")} style={{ flexShrink: 0, background: t.accent, border: "none", borderRadius: 8, padding: "6px 12px", fontFamily: t.fontDisplay, fontSize: 11, fontWeight: 800, color: "#000", cursor: "pointer", whiteSpace: "nowrap" as const, display: "flex", alignItems: "center", gap: 4 }}>SIGN IN</button>
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
          onOpenBuyCredits={() => { setOpenBundle(null); setMsg(null); setShowBuyModal(true); }} />
      )}

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px 72px" }}>

        {isGuest && (
          <div style={{ background: `${accent}10`, border: `1px solid ${accent}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
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

        {/* ── BOARD BUNDLES ── */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="BOARD BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {visibleBundles.map(bundle => <BundleCard key={bundle.id} bundle={bundle} purchasedItems={purchasedItems} t={t} onClick={() => setOpenBundle(bundle.id)} />)}
          </div>
        </div>

        {/* ── THEME BUNDLES ── */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="THEME BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {STORE_THEMES.map(item => (
              (() => {
                const owned = item.purchaseId ? purchasedItems.includes(item.purchaseId) : false;
                const price = item.price ?? 0;
                return (
              <div key={item.id} className="store-card" onMouseEnter={() => setHovCard(item.id)} onMouseLeave={() => setHovCard(null)}
                style={{ borderRadius: 18, overflow: "hidden", border: `2px solid ${hovCard === item.id ? accent + "88" : t.border}`, background: t.bgCard, boxShadow: hovCard === item.id ? `0 8px 32px ${accent}22` : "none" }}>
                <div style={{ height: 120, background: item.preview }} />
                <div style={{ padding: "22px 24px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 700, color: t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4 }}>{item.desc}</div>
                    </div>
                    <UnlockBadge text={owned ? "Owned" : item.unlock} accent={owned ? "#4CAF50" : accent} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    {owned ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.06em" }}>
                        OWNED
                      </div>
                    ) : (
                      <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: accent, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                        {price.toLocaleString()} <ProtoSVG size={16} />
                      </div>
                    )}

                    {owned ? (
                      <button
                        disabled
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: `1px solid ${t.border}`,
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontFamily: t.fontDisplay,
                          fontSize: 12,
                          fontWeight: 900,
                          color: "rgba(255,255,255,0.65)",
                          cursor: "not-allowed",
                        }}
                      >
                        ✓
                      </button>
                    ) : isGuest ? (
                      <button
                        onClick={() => setScreenAction("auth")}
                        style={{
                          background: accent,
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontFamily: t.fontDisplay,
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#000",
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        SIGN IN
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuyCosmetic(item.purchaseId, price, `${item.label} Theme`)}
                        disabled={!item.purchaseId || price <= 0}
                        style={{
                          background: accent,
                          border: "none",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontFamily: t.fontDisplay,
                          fontSize: 12,
                          fontWeight: 900,
                          color: "#000",
                          cursor: !item.purchaseId || price <= 0 ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap" as const,
                          opacity: !item.purchaseId || price <= 0 ? 0.7 : 1,
                        }}
                      >
                        UNLOCK
                      </button>
                    )}
                  </div>
                </div>
              </div>
                );
              })()
            ))}
          </div>
        </div>

        {/* ── COIN BUNDLES ── */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="COIN BUNDLES" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 010 3H9"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {COIN_BUNDLES.map(bundle => (
              <div key={bundle.id} className="store-card" style={{ borderRadius: 18, overflow: "hidden", border: `2px solid ${bundle.accentColor}33`, background: bundle.bgGradient, padding: "24px", position: "relative" }}>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 3 }}>{bundle.label}</div>
                <div style={{ fontFamily: t.fontBody, fontSize: 13, color: `${bundle.accentColor}cc`, fontStyle: "italic", marginBottom: 14 }}>{bundle.tagline}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>{bundle.tags.map(tag => (<span key={tag} style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: bundle.accentColor, background: `${bundle.accentColor}18`, border: `1px solid ${bundle.accentColor}44`, padding: "2px 7px", borderRadius: 4 }}>{tag}</span>))}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BANNERS ── */}
        <div style={{ marginBottom: 56 }}>
          <SectionHeader label="BANNERS" accent={accent} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/></svg>}/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 20 }}>
            {STORE_BANNERS.map(banner => {
              const owned = banner.id === "default" || purchasedItems.includes(banner.id);
              const price = banner.price ?? 0;
              return (
                <div
                  key={banner.id}
                  className="store-card"
                  style={{
                    borderRadius: 18,
                    overflow: "hidden",
                    border: `2px solid ${owned ? "#4CAF50" : accent + "33"}`,
                    background: banner.gradient,
                    padding: "0",
                    position: "relative",
                    boxShadow: owned ? "none" : `0 8px 32px ${accent}22`,
                  }}
                >
                  <div style={{ height: 120, position: "relative" }}>
                    <BannerRenderer banner={banner} style={{ position: "absolute", inset: 0 }} hideLabels={true} />
                    {!owned && (
                      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                        <UnlockBadge text={banner.unlock} accent={accent} />
                      </div>
                    )}
                    {owned && (
                      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2 }}>
                        <UnlockBadge text="Owned" accent="#4CAF50" />
                      </div>
                    )}
                  </div>

                  <div style={{ padding: 24 }}>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", marginBottom: 6 }}>
                      {banner.label}
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "rgba(255,255,255,0.74)", fontStyle: "italic", marginBottom: 16 }}>
                      {banner.unlock === "Free" ? "Free to unlock" : `Unlock for ${banner.unlock}`}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      {owned ? (
                        <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: "#4CAF50", letterSpacing: "0.06em" }}>
                          OWNED
                        </div>
                      ) : (
                        <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 900, color: accent, letterSpacing: "0.06em" }}>
                          {price.toLocaleString()} <span style={{ fontFamily: t.fontBody, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>PC</span>
                        </div>
                      )}

                      {owned ? (
                        <button
                          disabled
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: `1px solid rgba(255,255,255,0.14)`,
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontFamily: t.fontDisplay,
                            fontSize: 12,
                            fontWeight: 900,
                            color: "rgba(255,255,255,0.65)",
                            cursor: "not-allowed",
                          }}
                        >
                          ✓
                        </button>
                      ) : isGuest ? (
                        <button
                          onClick={() => setScreenAction("auth")}
                          style={{
                            background: accent,
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontFamily: t.fontDisplay,
                            fontSize: 12,
                            fontWeight: 900,
                            color: "#000",
                            cursor: "pointer",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          SIGN IN
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuyCosmetic(banner.id, price, `${banner.label} Banner`)}
                          disabled={price <= 0}
                          style={{
                            background: accent,
                            border: "none",
                            borderRadius: 10,
                            padding: "10px 14px",
                            fontFamily: t.fontDisplay,
                            fontSize: 12,
                            fontWeight: 900,
                            color: "#000",
                            cursor: price <= 0 ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap" as const,
                            opacity: price <= 0 ? 0.7 : 1,
                          }}
                        >
                          {price <= 0 ? "UNAVAILABLE" : "UNLOCK"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: "center" as const }}>
          <button onClick={() => setScreenAction("home")} style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, padding: "10px 28px", borderRadius: 8, cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s" }}
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