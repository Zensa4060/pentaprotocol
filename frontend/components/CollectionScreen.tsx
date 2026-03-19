"use client";
import { useEffect, useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { TITLES } from "./ProfileScreen";
import { BannerRenderer } from "./BannerRenderer";
import { GlacierSigilPiece, GlacierPrismPiece } from "./GamePieces";

// Profile borders — only default for now, more coming later
const PROFILE_BORDERS = [
  { id: "none", label: "No Border", tier: "basic", css: "none", unlockDesc: "Default — always unlocked", condition: (_p: any) => true },
];
import type { CustomThemeConfig, SfxPack, BoardSkin, CoinSkin, TossAnim, PieceSkin, BgSource } from "@/lib/customTheme";
import { DEFAULT_CUSTOM_THEME, loadCustomTheme, saveCustomTheme } from "@/lib/customTheme";

// ── Icon helpers ──────────────────────────────────────────────────────────────
const LockIcon = ({ size = 14, color = "#666" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const CheckIcon = ({ size = 14, color = "#000" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);


const CatIcon = ({ id, size = 16, color }: { id: string; size?: number; color: string }) => {
  const s = { width: size, height: size };
  if (id === "palette") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>;
  if (id === "board") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>;
  if (id === "banner") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="13" rx="2"/><path d="M3 18h18"/><path d="M3 21h18"/></svg>;
  if (id === "border") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>;
  if (id === "coin") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h4.5a1.5 1.5 0 0 1 0 3H9"/></svg>;
  if (id === "toss") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
  if (id === "title") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>;
  if (id === "piece") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  if (id === "custom") return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
  return null;
};

// ── Collection data ───────────────────────────────────────────────────────────
const COLLECTION_THEMES = [
  { id: "classic_light", label: "Classic Light", desc: "The original light aesthetic", owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#f5f0e8,#e8e0d0)" },
  { id: "classic_dark",  label: "Classic Dark",  desc: "Dark mode classic",            owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)" },
  { id: "space",         label: "Space",         desc: "Deep space atmosphere",       owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#020410,#0d1b4b)" },
  { id: "pixel",         label: "Pixel",         desc: "Retro pixel art style",        owned: true,  comingSoon: false, preview: "linear-gradient(135deg,#0d1007,#1a2e0a)" },
];

const BOARD_SKINS: { id: string; label: string; desc: string; condition: (p: any) => boolean; preview: string; border: string; price?: number }[] = [
  { id: "default",  label: "Standard", desc: "Clean default board",                       condition: (_p: any) => true,                                                   preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", border: "#333" },
  { id: "red_grid", label: "Inferno", desc: "A glowing grid of pure energy",             condition: (p: any) => (p?.purchased_items ?? []).includes("red_grid"),         preview: "linear-gradient(135deg,#220803,#1a0400)",  border: "#992200", price: 1599 },
  { id: "ice_grid", label: "Ice Board", desc: "A frozen board sealed in eternal frost",    condition: (p: any) => (p?.purchased_items ?? []).includes("ice_grid"),         preview: "linear-gradient(135deg,#010610,#021428)",  border: "#1a4a6a", price: 1599 },
  { id: "glacier_grid", label: "Glacier Board", desc: "Aurora ice lattice with crystalline glow", condition: (p: any) => (p?.purchased_items ?? []).includes("glacier_grid"), preview: "linear-gradient(135deg,#020b1a,#031329)", border: "#7dd3fc", price: 1599 },
];

const COIN_SKINS = [
  { id: "default", label: "Standard", desc: "Default", owned: true, c1: "#F59E0B", c2: "#4FC3F7", img1: "/penta-coin.png", img2: "/proto-coin.png" },
];

const COIN_TOSS_ANIMS: { id: string; label: string; desc: string; condition: (p: any) => boolean; price?: number }[] = [
  { id: "default", label: "Classic Flip", desc: "Default animation", condition: (_p: any) => true },
];

const PIECE_SKINS: { id: string; label: string; desc: string; condition: (p: any) => boolean; p1: string; p2: string; p1c: string; p2c: string; price?: number; isFlameSkull?: boolean; isSnowShard?: boolean; isGlacierShard?: boolean }[] = [
  { id: "default",          label: "Classic",      desc: "Default pieces",     condition: (_p: any) => true,                                                             p1: "X",  p2: "Y",  p1c: "#FFFFFF", p2c: "#CC0000" },
  { id: "flame_skull",      label: "Flame & Skull", desc: "Purchase for 599 ⬡", condition: (p: any) => (p?.purchased_items ?? []).includes("piece_flame_skull"),       p1: "🔥", p2: "💀", p1c: "#FF4400", p2c: "#AAAAAA", price: 599, isFlameSkull: true },
  { id: "snowflake_shard",  label: "Snow & Shard",  desc: "Purchase for 599 ⬡", condition: (p: any) => (p?.purchased_items ?? []).includes("piece_snowflake_shard"),   p1: "❄",  p2: "◆",  p1c: "#C8EEFF", p2c: "#64C8FF", price: 599, isSnowShard: true },
  { id: "glacier_shard",    label: "Glacier Sigils",  desc: "Purchase for 599 ⬡", condition: (p: any) => (p?.purchased_items ?? []).includes("piece_glacier_shard"),   p1: "❅",  p2: "◇",  p1c: "#A5F3FC", p2c: "#93C5FD", price: 599, isGlacierShard: true },
];

const BANNERS: { id: string; label: string; gradient: string; condition: (p: any) => boolean }[] = [
  { id: "default",   label: "Default",   gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", condition: () => true },
  { id: "void_rift", label: "Void Rift", gradient: "linear-gradient(135deg,#0e0020,#020005)", condition: (p: any) => (p?.purchased_items ?? []).includes("void_rift") },
  { id: "blood_moon", label: "Blood Moon", gradient: "linear-gradient(135deg,#000008,#180008)", condition: (p: any) => (p?.purchased_items ?? []).includes("blood_moon") },
  { id: "phantom_strike", label: "Phantom Strike", gradient: "linear-gradient(135deg,#060010,#110028)", condition: (p: any) => (p?.purchased_items ?? []).includes("phantom_strike") },
  { id: "solar_flare", label: "Solar Flare", gradient: "linear-gradient(135deg,#060200,#f97316)", condition: (p: any) => (p?.purchased_items ?? []).includes("solar_flare") },
  { id: "cryo_storm", label: "Cryo Storm", gradient: "linear-gradient(135deg,#030c20,#081840)", condition: (p: any) => (p?.purchased_items ?? []).includes("cryo_storm") },
  { id: "neon_circuit", label: "Neon Circuit", gradient: "linear-gradient(135deg,#020a04,#00ff66)", condition: (p: any) => (p?.purchased_items ?? []).includes("neon_circuit") },
  { id: "static_glitch", label: "Static Glitch", gradient: "linear-gradient(135deg,#050505,#a00038)", condition: (p: any) => (p?.purchased_items ?? []).includes("static_glitch") },
  { id: "golden_nexus", label: "Golden Nexus", gradient: "linear-gradient(135deg,#060200,#fbbf24)", condition: (p: any) => (p?.purchased_items ?? []).includes("golden_nexus") },
  { id: "plasma_core", label: "Plasma Core", gradient: "linear-gradient(135deg,#12082a,#6d28d9)", condition: (p: any) => (p?.purchased_items ?? []).includes("plasma_core") },
  { id: "toxic_spill", label: "Toxic Spill", gradient: "linear-gradient(135deg,#010d03,#0a3d22)", condition: (p: any) => (p?.purchased_items ?? []).includes("toxic_spill") },
  { id: "storm_protocol", label: "Storm Protocol", gradient: "linear-gradient(135deg,#060810,#0b1a3b)", condition: (p: any) => (p?.purchased_items ?? []).includes("storm_protocol") },
  { id: "arctic_veil", label: "Arctic Veil", gradient: "linear-gradient(135deg,#d8f0fc,#c5e8fb)", condition: (p: any) => (p?.purchased_items ?? []).includes("arctic_veil") },
  { id: "starfield", label: "Starfield", gradient: "linear-gradient(135deg,#050210,#312e81)", condition: (p: any) => (p?.purchased_items ?? []).includes("starfield") },
  { id: "digital_rain", label: "Digital Rain", gradient: "linear-gradient(135deg,#000702,#14532d)", condition: (p: any) => (p?.purchased_items ?? []).includes("digital_rain") },
  { id: "inferno", label: "Inferno", gradient: "linear-gradient(135deg,#070100,#ea580c)", condition: (p: any) => (p?.purchased_items ?? []).includes("inferno") },
];

const STORE_BANNER_ITEM_IDS = ["void_rift", "blood_moon", "phantom_strike", "solar_flare", "cryo_storm", "neon_circuit", "static_glitch", "golden_nexus", "plasma_core", "toxic_spill", "storm_protocol", "arctic_veil", "starfield", "digital_rain", "inferno"] as const;

// Sound pack options
const SFX_PACKS: { id: SfxPack; label: string; desc: string; owned: boolean; color: string }[] = [
  { id: "classic", label: "Classic", desc: "Refined, minimal clicks",  owned: true, color: "#CCCCCC" },
  { id: "space",   label: "Space",   desc: "Atmospheric space sounds",  owned: true, color: "#3A78D4" },
  { id: "pixel",   label: "Pixel",   desc: "Retro 8-bit sound effects", owned: true, color: "#879A77" },
];

// Background sources
const BG_SOURCES: { id: BgSource; label: string; preview: string; owned: boolean }[] = [
  { id: "classic_light", label: "Classic Light", preview: "linear-gradient(135deg,#f5f0e8,#e8e0d0)", owned: true },
  { id: "classic_dark",  label: "Classic Dark",  preview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", owned: true },
  { id: "space",         label: "Space",         preview: "linear-gradient(135deg,#020410,#0d1b4b)", owned: true },
  { id: "pixel",         label: "Pixel",         preview: "linear-gradient(135deg,#0d1007,#1a2e0a)", owned: true },
];

// ── Board Bundle definitions (board + piece paired) ──────────────────────────
const BOARD_BUNDLES = [
  {
    id: "default", label: "Classic", tagline: "Default board & pieces",
    boardId: "default", boardLabel: "Standard", boardPreview: "linear-gradient(135deg,#1a1a1a,#2a2a2a)", boardBorder: "#444",
    pieceId: "default", pieceLabel: "Classic", pieceP1: "X", pieceP2: "Y", pieceP1c: "#FFFFFF", pieceP2c: "#CC0000",
    accentColor: "#888888", isDefault: true, price: 0,
    bOwned: (_p: any) => true,
    pOwned: (_p: any) => true,
  },
  {
    id: "inferno", label: "INFERNO BUNDLE", tagline: "Command fire and death",
    boardId: "red_grid", boardLabel: "Inferno Board", boardPreview: "linear-gradient(135deg,#220803,#1a0400)", boardBorder: "#992200",
    pieceId: "flame_skull", pieceLabel: "Flame & Skull", pieceP1: "🔥", pieceP2: "💀", pieceP1c: "#FF4400", pieceP2c: "#AAAAAA",
    accentColor: "#FF4400", isDefault: false, isFlameSkull: true, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("red_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_flame_skull"),
  },
  {
    id: "ice", label: "ICE BUNDLE", tagline: "Cool, calculated, absolutely deadly",
    boardId: "ice_grid", boardLabel: "Ice Board", boardPreview: "linear-gradient(135deg,#010610,#021428)", boardBorder: "#1a4a6a",
    pieceId: "snowflake_shard", pieceLabel: "Snow & Shard", pieceP1: "❄", pieceP2: "◆", pieceP1c: "#C8EEFF", pieceP2c: "#64C8FF",
    accentColor: "#7dd3fc", isDefault: false, isSnowShard: true, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("ice_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_snowflake_shard"),
  },
  {
    id: "glacier", label: "GLACIER BUNDLE", tagline: "Aurora-lit frost, precision first",
    boardId: "glacier_grid", boardLabel: "Glacier Board", boardPreview: "linear-gradient(135deg,#020b1a,#031329)", boardBorder: "#7dd3fc",
    pieceId: "glacier_shard", pieceLabel: "Glacier Sigils", pieceP1: "❅", pieceP2: "◇", pieceP1c: "#A5F3FC", pieceP2c: "#93C5FD",
    accentColor: "#a5f3fc", isDefault: false, isGlacierShard: true, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("glacier_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_glacier_shard"),
  },
  {
    id: "bloodmoon", label: "BLOODMOON BUNDLE", tagline: "Ritual crimson and violet omen",
    boardId: "bloodmoon_grid", boardLabel: "Bloodmoon Board", boardPreview: "linear-gradient(135deg,#080000,#1a0004)", boardBorder: "#dc2626",
    pieceId: "bloodmoon_sigils", pieceLabel: "Pentagram & Eye", pieceP1: "⛧", pieceP2: "◉", pieceP1c: "#DC2626", pieceP2c: "#7C3AED",
    accentColor: "#dc2626", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("bloodmoon_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_bloodmoon_sigils"),
  },
  {
    id: "egypt", label: "EGYPT BUNDLE", tagline: "Golden dunes and ancient sigils",
    boardId: "egypt_grid", boardLabel: "Egypt Board", boardPreview: "linear-gradient(135deg,#04020a,#0a0500)", boardBorder: "#F59E0B",
    pieceId: "egypt_sigils", pieceLabel: "Ankh & Eye of Ra", pieceP1: "☥", pieceP2: "𓂀", pieceP1c: "#FBBF24", pieceP2c: "#C084FC",
    accentColor: "#F59E0B", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("egypt_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_egypt_sigils"),
  },
  {
    id: "synthwave", label: "SYNTHWAVE BUNDLE", tagline: "Neon horizon and retro pulse",
    boardId: "synthwave_grid", boardLabel: "Synthwave Board", boardPreview: "linear-gradient(135deg,#0a002a,#cc2060)", boardBorder: "#ff00b4",
    pieceId: "synthwave_sigils", pieceLabel: "Sun & Palm", pieceP1: "☀", pieceP2: "✦", pieceP1c: "#FF4D6D", pieceP2c: "#00E5FF",
    accentColor: "#ff00b4", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("synthwave_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_synthwave_sigils"),
  },
  {
    id: "matrix", label: "MATRIX BUNDLE", tagline: "Code rain and green pulse",
    boardId: "matrix_grid", boardLabel: "Matrix Board", boardPreview: "linear-gradient(135deg,#000300,#000800)", boardBorder: "#00ff41",
    pieceId: "matrix_sigils", pieceLabel: "Bracket & Pill", pieceP1: "[ ]", pieceP2: "01", pieceP1c: "#00FF41", pieceP2c: "#4ADE80",
    accentColor: "#00ff41", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("matrix_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_matrix_sigils"),
  },
  {
    id: "arcane", label: "ARCANE BUNDLE", tagline: "Runes, mist, and magic circles",
    boardId: "arcane_grid", boardLabel: "Arcane Board", boardPreview: "linear-gradient(135deg,#0a0012,#030004)", boardBorder: "#a855f7",
    pieceId: "arcane_sigils", pieceLabel: "Portal & Sigil", pieceP1: "◌", pieceP2: "✶", pieceP1c: "#C084FC", pieceP2c: "#FBBF24",
    accentColor: "#a855f7", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("arcane_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_arcane_sigils"),
  },
  {
    id: "bio", label: "BIO BUNDLE", tagline: "Abyss glow and bioluminescence",
    boardId: "bio_grid", boardLabel: "Bio Board", boardPreview: "linear-gradient(135deg,#000a0f,#000304)", boardBorder: "#00ffd0",
    pieceId: "bio_sigils", pieceLabel: "Jellyfish & Angler", pieceP1: "⟡", pieceP2: "◉", pieceP1c: "#00FFD0", pieceP2c: "#B464FF",
    accentColor: "#00ffd0", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("bio_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_bio_sigils"),
  },
  {
    id: "forge", label: "FORGE BUNDLE", tagline: "Molten veins and rising embers",
    boardId: "forge_grid", boardLabel: "Forge Board", boardPreview: "linear-gradient(135deg,#0a0200,#080100)", boardBorder: "#ff6600",
    pieceId: "forge_sigils", pieceLabel: "Hammer & Molten Sigil", pieceP1: "⛏", pieceP2: "✺", pieceP1c: "#FF6600", pieceP2c: "#FFCC00",
    accentColor: "#ff6600", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("forge_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_forge_sigils"),
  },
  {
    id: "void", label: "VOID BUNDLE", tagline: "Nebulae, stars, and cosmic pulses",
    boardId: "void_grid", boardLabel: "Void Board", boardPreview: "linear-gradient(135deg,#04011a,#000008)", boardBorder: "#8b5cf6",
    pieceId: "void_sigils", pieceLabel: "Pulsar & Quasar", pieceP1: "✷", pieceP2: "◎", pieceP1c: "#B464FF", pieceP2c: "#40C0FF",
    accentColor: "#8b5cf6", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("void_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_void_sigils"),
  },
  {
    id: "space", label: "SPACE BUNDLE", tagline: "Protocol rockets and satellite signals",
    boardId: "space_grid", boardLabel: "Space Board", boardPreview: "linear-gradient(135deg,#020410,#0b1a3b)", boardBorder: "#00d9ff",
    pieceId: "space_sigils", pieceLabel: "Rocket & Satellite", pieceP1: "🚀", pieceP2: "🛰", pieceP1c: "#00ddff", pieceP2c: "#ff8c00",
    accentColor: "#00d9ff", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("space_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_space_sigils"),
  },
  {
    id: "pixel", label: "PIXEL BUNDLE", tagline: "8-bit CRT chaos and dither glow",
    boardId: "pixel_grid", boardLabel: "Pixel Board", boardPreview: "linear-gradient(135deg,#0a0a18,#0f3460)", boardBorder: "#ffdd00",
    pieceId: "pixel_sigils", pieceLabel: "Coin & Heart", pieceP1: "◉", pieceP2: "♥", pieceP1c: "#ffdd00", pieceP2c: "#ff4455",
    accentColor: "#ffdd00", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("pixel_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_pixel_sigils"),
  },
  {
    id: "tokyo", label: "TOKYO BUNDLE", tagline: "Neon rain and city glow",
    boardId: "tokyo_grid", boardLabel: "Tokyo Board", boardPreview: "linear-gradient(135deg,#040008,#030008)", boardBorder: "#ff0066",
    pieceId: "tokyo_sigils", pieceLabel: "Dragon Seal & Katana", pieceP1: "⟟", pieceP2: "⟐", pieceP1c: "#FF0066", pieceP2c: "#00CCFF",
    accentColor: "#ff0066", isDefault: false, price: 2999,
    bOwned: (p: any) => (p?.purchased_items ?? []).includes("tokyo_grid"),
    pOwned: (p: any) => (p?.purchased_items ?? []).includes("piece_tokyo_sigils"),
  },
] as const;
type BoardBundle = typeof BOARD_BUNDLES[number];

// ── Category definitions ──────────────────────────────────────────────────────
type CatId = "themes" | "board_bundles" | "profile_bundles" | "coin_bundles" | "titles";

const CATEGORIES: { id: CatId; label: string; icon: string; count: (p: any) => number }[] = [
  { id: "themes",          label: "Themes",          icon: "palette", count: () => COLLECTION_THEMES.filter(x => x.owned).length },
  { id: "board_bundles",   label: "GRIDS",           icon: "board",   count: (p) => BOARD_BUNDLES.filter(b => b.bOwned(p) || b.pOwned(p)).length },
  { id: "profile_bundles", label: "BANNERS",         icon: "banner",  count: (p) => BANNERS.filter(x => x.condition(p)).length + PROFILE_BORDERS.filter(x => x.condition(p)).length },
  { id: "coin_bundles",    label: "COINS",           icon: "coin",    count: () => COIN_SKINS.filter(x => x.owned).length + COIN_TOSS_ANIMS.length },
  { id: "titles",          label: "BADGES",          icon: "title",   count: (p) => TITLES.filter(ti => ti.condition(p)).length },
];

function getSlotOptions(key: keyof CustomThemeConfig, profile?: any) {
  if (key === "sfxPack")    return SFX_PACKS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.owned, preview: null, color: x.color }));
  if (key === "background") return BG_SOURCES.map(x => ({ id: x.id, label: x.label, desc: "", owned: x.owned, preview: x.preview, color: null }));
  if (key === "boardSkin")  return BOARD_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: x.preview, color: x.border }));
  if (key === "coinSkin")   return COIN_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.owned, preview: null, color: x.c1 }));
  if (key === "tossSkin")   return COIN_TOSS_ANIMS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: null, color: null }));
  if (key === "pieceSkin")  return PIECE_SKINS.map(x => ({ id: x.id, label: x.label, desc: x.desc, owned: x.condition(profile ?? {}), preview: null, color: x.p1c }));
  return [];
}

function getSlotLabel(key: keyof CustomThemeConfig, value: string, profile?: any): string {
  const opts = getSlotOptions(key, profile);
  return opts.find(o => o.id === value)?.label ?? value;
}

type CustomSlot = { key: keyof CustomThemeConfig; label: string; icon: string };
const CUSTOM_SLOTS: CustomSlot[] = [
  { key: "sfxPack",    label: "Sound Pack",     icon: "🔊" },
  { key: "background", label: "Background",     icon: "🖼" },
  { key: "boardSkin",  label: "Board Skin",     icon: "⬛" },
  { key: "coinSkin",   label: "Coin Skin",      icon: "🪙" },
  { key: "tossSkin",   label: "Toss Animation", icon: "🌀" },
  { key: "pieceSkin",  label: "Piece Skin",     icon: "✖" },
];

// ── CustomThemeSection ────────────────────────────────────────────────────────
interface CustomThemeSectionProps {
  t: typeof THEMES[ThemeId];
  ip: boolean;
  themeId: ThemeId;
  setThemeIdAction?: (id: ThemeId) => void;
  profile?: any;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

function CustomThemeSection({ t, ip, themeId, profile, setThemeIdAction, onHoverAction, onClickAction }: CustomThemeSectionProps) {
  const [cfg, setCfg] = useState<CustomThemeConfig>(() => loadCustomTheme());
  const [activeSlot, setActiveSlot] = useState<keyof CustomThemeConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const isActive = themeId === "custom" as ThemeId;
  const accentHex = t.accent;

  const update = (key: keyof CustomThemeConfig, value: string) => {
    onClickAction?.();
    const next = { ...cfg, [key]: value };
    setCfg(next);
    saveCustomTheme(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    onClickAction?.();
    setCfg({ ...DEFAULT_CUSTOM_THEME });
    saveCustomTheme({ ...DEFAULT_CUSTOM_THEME });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const bgPreview = BG_SOURCES.find(b => b.id === cfg.background)?.preview ?? "linear-gradient(135deg,#1a1a1a,#2a2a2a)";
  
  const currentPiece = PIECE_SKINS.find(p => p.id === cfg.pieceSkin) || PIECE_SKINS[0];
  const p1Color = currentPiece.p1c;
  const p2Color = currentPiece.p2c;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.5s ease-out" }}>
      {/* ── Dashboard Header ── */}
      <div style={{ 
        position: "relative", borderRadius: 24, overflow: "hidden", 
        border: `1px solid ${isActive ? accentHex : "rgba(255,255,255,0.1)"}`, 
        background: "rgba(20,20,20,0.6)", backdropFilter: "blur(20px)",
        boxShadow: isActive ? `0 0 40px ${accentHex}22` : "0 20px 50px rgba(0,0,0,0.3)" 
      }}>
        <div style={{ height: 120, background: bgPreview, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
           {/* Animated Grid Decoration */}
           <div style={{ position: "absolute", inset: 0, opacity: 0.15, background: `linear-gradient(90deg, ${accentHex} 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(${accentHex} 1px, transparent 1px) 0 0 / 40px 40px` }} />
           
           <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 24 }}>
             <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 18px)", gap: 3, transform: "rotate(-10deg)" }}>
               {Array.from({ length: 25 }).map((_, i) => (
                 <div key={i} style={{ width: 18, height: 18, background: BOARD_SKINS.find(b => b.id === cfg.boardSkin)?.border ?? "#444", borderRadius: 3, boxShadow: `0 0 5px ${BOARD_SKINS.find(b => b.id === cfg.boardSkin)?.border}44` }} />
               ))}
              </div>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${p1Color}, ${p2Color})`, boxShadow: `0 0 30px ${p1Color}44` }} />
           </div>

           {isActive && (
             <div style={{ position: "absolute", top: 16, right: 16, background: accentHex, borderRadius: 12, padding: "6px 16px", fontFamily: t.fontMono, fontSize: 10, color: "#000", fontWeight: 950, letterSpacing: "0.1em", boxShadow: "0 4px 15px rgba(0,0,0,0.4)", zIndex: 3 }}>ENGINE ACTIVE</div>
           )}
        </div>

        <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, background: "rgba(255,255,255,0.02)" }}>
           <div>
             <div style={{ fontFamily: t.fontMono, fontSize: 10, color: accentHex, letterSpacing: "0.4em", fontWeight: 800, marginBottom: 4 }}>SIGNATURE STYLE</div>
             <div style={{ fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 950, color: t.text, letterSpacing: "-0.01em" }}>Custom Theme Builder</div>
             <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>Mix and match assets from your entire collection</div>
           </div>

           <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
             {saved && <div style={{ fontFamily: t.fontMono, fontSize: 11, color: accentHex, fontWeight: 800, animation: "fadeIn 0.2s" }}>✓ SAVED</div>}
             <button onClick={() => { onClickAction?.(); reset(); }}
               style={{ background: "rgba(255,b255,255,0.05)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 12, color: t.textMuted, fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, padding: "10px 18px", cursor: "pointer", transition: "all 0.2s" }}>
               RESET
             </button>
             {setThemeIdAction && (
               <button onClick={() => { onClickAction?.(); setThemeIdAction("custom" as ThemeId); }}
                 style={{ 
                   background: isActive ? accentHex : "rgba(255,255,255,0.03)", 
                   border: `1px solid ${isActive ? accentHex : t.border}`, 
                   borderRadius: 12, color: isActive ? "#000" : t.text, 
                   fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 800, 
                   padding: "10px 28px", cursor: "pointer", 
                   boxShadow: isActive ? `0 0 20px ${accentHex}44` : "none",
                   transition: "all 0.2s" 
                 }}>
                 {isActive ? "LIVE" : "APPLY ENGINE"}
               </button>
             )}
           </div>
        </div>
      </div>

      {/* ── Configuration Slots ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {CUSTOM_SLOTS.map(slot => {
          const isOpen = activeSlot === slot.key;
          const options = getSlotOptions(slot.key, profile);
          const currentLabel = getSlotLabel(slot.key, cfg[slot.key] as string, profile);
          return (
            <div key={slot.key} style={{ 
              borderRadius: 20, border: `1px solid ${isOpen ? accentHex : "rgba(255,255,255,0.08)"}`, 
              background: isOpen ? "rgba(255,b255,255,0.03)" : "rgba(255,255,255,0.01)", 
              overflow: "hidden", transition: "all 0.3s cubic-bezier(.2,.8,.2,1)",
              backdropFilter: "blur(10px)"
            }}>
              <button 
                onClick={() => { onClickAction?.(); setActiveSlot(isOpen ? null : slot.key); }} 
                onMouseEnter={() => onHoverAction?.()}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" as const }}>
                <div style={{ 
                  width: 44, height: 44, borderRadius: 12, 
                  background: isOpen ? `${accentHex}22` : "rgba(255,255,255,0.03)", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isOpen ? `0 0 15px ${accentHex}22` : "none",
                  fontSize: 20, transition: "all 0.3s"
                }}>
                  {slot.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.1em", fontWeight: 800, marginBottom: 2 }}>{slot.label.toUpperCase()}</div>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 17, fontWeight: 800, color: isOpen ? accentHex : t.text }}>{currentLabel}</div>
                </div>
                <div style={{ 
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
                  transition: "transform 0.4s cubic-bezier(.2,.8,.2,1)", 
                  color: isOpen ? accentHex : t.textMuted, opacity: 0.6 
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "8px 16px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, animation: "fadeIn 0.3s ease", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {options.map((opt, idx) => {
                    const isSelected = cfg[slot.key] === opt.id;
                    const locked = !opt.owned;
                    return (
                      <div key={idx}
                        onClick={() => { if (!locked) update(slot.key, opt.id as string); }}
                        style={{ 
                          borderRadius: 14, border: `1.5px solid ${isSelected ? accentHex : locked ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.08)"}`, 
                          background: isSelected ? `${accentHex}14` : "rgba(255,255,255,0.02)", 
                          padding: "12px", cursor: locked ? "default" : "pointer", 
                          opacity: locked ? 0.4 : 1, position: "relative", transition: "all 0.2s" 
                        }}>
                        {opt.preview && <div style={{ height: 32, borderRadius: 6, background: opt.preview, marginBottom: 8, boxShadow: "0 4px 10px rgba(0,0,0,0.2)" }} />}
                        {!opt.preview && opt.color && <div style={{ width: 20, height: 20, borderRadius: "50%", background: opt.color, marginBottom: 6, boxShadow: `0 0 10px ${opt.color}44` }} />}
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800, color: isSelected ? accentHex : t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt.label}</div>
                        {locked && <div style={{ position: "absolute", top: 8, right: 8 }}><LockIcon size={12} color="#666" /></div>}
                        {isSelected && !locked && (
                          <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: accentHex, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 8px ${accentHex}66` }}>
                            <CheckIcon size={9} color="#000" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ThemesWithCustomize ───────────────────────────────────────────────────────
interface ThemesWithCustomizeProps {
  t: typeof THEMES[ThemeId];
  ip: boolean;
  themeId: ThemeId;
  setThemeIdAction?: (id: ThemeId) => void;
  profile?: any;
  activeTheme: string;
  setActiveTheme: (id: string) => void;
  showAll: boolean;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

function ThemesWithCustomize({ t, ip, themeId, setThemeIdAction, profile, activeTheme, setActiveTheme, showAll, onHoverAction, onClickAction }: ThemesWithCustomizeProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const accentHex = t.accent;
  const themes = showAll ? COLLECTION_THEMES : COLLECTION_THEMES.filter(x => x.owned || x.comingSoon);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
        {themes.map(item => (
          <div key={item.id} className={`coll-item ${item.comingSoon || !item.owned ? "coll-locked" : ""}`}
            onClick={() => { if (item.owned && !item.comingSoon && setThemeIdAction) { onClickAction?.(); setThemeIdAction(item.id as ThemeId); setActiveTheme(item.id); } }}
            onMouseEnter={() => { if (item.owned && !item.comingSoon) onHoverAction?.(); }}
            style={{ 
              borderRadius: 16, overflow: "hidden", 
              border: `1px solid ${activeTheme === item.id ? accentHex : "rgba(255,255,255,0.1)"}`, 
              background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
              boxShadow: activeTheme === item.id ? `0 0 20px ${accentHex}33` : "0 10px 30px rgba(0,0,0,0.2)", 
              cursor: item.owned && !item.comingSoon ? "pointer" : "default" 
            }}>
            {(item.comingSoon || !item.owned) && (
              <div className="coll-locked-overlay">
                <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                  <LockIcon size={14} color="#888" />
                  <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>
                    {item.comingSoon ? "COMING SOON" : "LOCKED"}
                  </span>
                </div>
              </div>
            )}
            <div style={{ height: 90, background: item.preview, position: "relative", overflow: "hidden" }}>
              {item.owned && activeTheme === item.id && (
                <div style={{ position: "absolute", top: 12, right: 12, background: accentHex, borderRadius: 12, padding: "4px 12px", fontFamily: t.fontMono, fontSize: 10, color: "#000", fontWeight: 900, letterSpacing: "0.05em", zIndex: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>ACTIVE</div>
              )}
              {/* Shiny Overlay for Active */}
              {item.owned && activeTheme === item.id && (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 3s infinite linear", zIndex: 1, pointerEvents: "none" }} />
              )}
            </div>
            <div style={{ padding: "16px" }}>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: activeTheme === item.id ? accentHex : t.text }}>{item.label}</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>
                {item.comingSoon ? "Expansion content" : item.owned ? (activeTheme === item.id ? "Current theme" : "Ready to apply") : "Not yet acquired"}
              </div>
            </div>
          </div>
        ))}

        {/* Customize card */}
        <div className="coll-item"
          onClick={() => { onClickAction?.(); setCustomizeOpen(v => !v); }}
          onMouseEnter={() => onHoverAction?.()}
          style={{ 
            borderRadius: 16, overflow: "hidden", 
            border: `1px solid ${customizeOpen ? accentHex : "rgba(255,b255,255,0.1)"}`, 
            background: customizeOpen ? `${accentHex}0d` : "rgba(30,30,30,0.4)", 
            backdropFilter: "blur(12px)",
            boxShadow: customizeOpen ? `0 0 20px ${accentHex}33` : "0 10px 30px rgba(0,0,0,0.2)", 
            cursor: "pointer" 
          }}>
          <div style={{ height: 90, background: `linear-gradient(135deg, ${accentHex}22, ${accentHex}08)`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, position: "relative" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${accentHex}22`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 15px ${accentHex}33` }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div style={{ position: "absolute", top: 12, right: 12, background: customizeOpen ? accentHex : "rgba(255,255,255,0.1)", borderRadius: 10, padding: "3px 10px", fontFamily: t.fontMono, fontSize: 9, color: customizeOpen ? "#000" : t.accent, fontWeight: 900, letterSpacing: "0.08em" }}>
              {customizeOpen ? "OPENED" : "CUSTOM"}
            </div>
          </div>
          <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: accentHex }}>Customize</div>
              <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500 }}>Create your signature style</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="2.5" strokeLinecap="round" style={{ transform: customizeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {customizeOpen && (
        <div style={{ borderRadius: ip ? 2 : 14, border: `1px solid ${accentHex}44`, background: `${accentHex}06`, padding: "20px 18px" }}>
          <CustomThemeSection t={t} ip={ip} themeId={themeId} profile={profile} setThemeIdAction={setThemeIdAction} onHoverAction={onHoverAction} onClickAction={onClickAction} />
        </div>
      )}
    </div>
  );
}

// ── Main CollectionScreen ─────────────────────────────────────────────────────
interface Props { themeId: ThemeId; setThemeIdAction?: (id: ThemeId) => void; onHoverAction?: () => void; onClickAction?: () => void; }

export default function CollectionScreen({ themeId, setThemeIdAction, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, token, updateUser } = useAuthStore();
  const [activeCat, setActiveCat] = useState<CatId>("themes");
  const [showAll, setShowAll] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(themeId);
  const [activeBoard,  setActiveBoard]  = useState<string>(() => loadCustomTheme().boardSkin  ?? (user as any)?.board_style ?? "default");
  const [activePiece,  setActivePiece]  = useState<string>(() => loadCustomTheme().pieceSkin  ?? "default");
  const [activeToss,   setActiveToss]   = useState<string>(() => loadCustomTheme().tossSkin   ?? "default");
  const [activeBanner, setActiveBanner] = useState<string>(() => loadCustomTheme().bannerSkin ?? (user as any)?.banner_style ?? "default");
  const [equipping, setEquipping] = useState<string | null>(null);
  const [equippingBanner, setEquippingBanner] = useState<string | null>(null);
  const [equipMsg, setEquipMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<{ id: string; label: string; price: number } | null>(null);
  const [insufficientModal, setInsufficientModal] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);

  const profile = user || {};
  const ip = themeId === "pixel";
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";
  const hoverColor = isClassic ? "#CC0000" : t.accent;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const PROFILE_FETCH_TIMEOUT = 15000;
  useEffect(() => {
    if (!token) return;
    API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: PROFILE_FETCH_TIMEOUT })
      .then(res => updateUser(res.data))
      .catch(() => {});
  }, [token]);

  // Keep banner selection synced when cosmetics are changed from other screens (e.g. ProfileScreen).
  useEffect(() => {
    const syncBanner = () => {
      setActiveBanner(loadCustomTheme().bannerSkin ?? "default");
    };
    window.addEventListener("pp_custom_theme_changed", syncBanner);
    return () => window.removeEventListener("pp_custom_theme_changed", syncBanner);
  }, []);
  const emitThemeChanged = () => window.dispatchEvent(new Event("pp_custom_theme_changed"));

  const equipBoard = (id: string) => {
    if (!token) return;
    
    // Optimistic UI Update
    setEquipping(id);
    setActiveBoard(id);
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, boardSkin: id as any });
    emitThemeChanged();
    updateUser({ board_style: id });
    
    setEquipMsg({ text: "Board skin equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
    setTimeout(() => setEquipping((cur) => (cur === id ? null : cur)), 350);

    // Non-blocking server sync. Keep local selection to avoid lag/flicker.
    API.put("/api/profile/me", { board_style: id }, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 })
      .then((res) => updateUser(res.data))
      .catch(() => {});
  };

  const equipPiece = (id: string) => {
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, pieceSkin: id as any });
    emitThemeChanged();
    setActivePiece(id);
    setEquipMsg({ text: "Piece skin equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
  };

  const equipToss = (id: string) => {
    const current = loadCustomTheme();
    saveCustomTheme({ ...current, tossSkin: id as any });
    emitThemeChanged();
    setActiveToss(id);
    setEquipMsg({ text: "Toss animation equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
  };

  const equipBanner = (id: string) => {
    if (!token) return;
    setEquippingBanner(id);
    setActiveBanner(id);
    const cur = loadCustomTheme();
    saveCustomTheme({ ...cur, bannerSkin: id as any });
    emitThemeChanged();
    updateUser({ banner: id });
    setEquipMsg({ text: "Banner equipped!", ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
    setTimeout(() => setEquippingBanner((cur) => (cur === id ? null : cur)), 350);

    API.put("/api/profile/me", { banner: id }, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 })
      .then((res) => updateUser(res.data))
      .catch(() => {});
  };

  const handleBuyItem = (id: string, label: string, price: number) => {
    if (!user) { setEquipMsg({ text: "Sign in to purchase", ok: false }); return; }
    const bal = (user as any).protocredits ?? 0;
    if (bal < price) { setInsufficientModal(true); return; }
    setPurchaseModal({ id, label, price });
  };

  const confirmPurchase = async () => {
    if (!purchaseModal || !token) return;
    setBuyLoading(true);
    try {
      await API.post("/api/store/purchase-item", { item_id: purchaseModal.id, price: purchaseModal.price }, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      // Always refresh profile to avoid any local-state desync
      try {
        const me = await API.get("/api/profile/me", { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
        updateUser(me.data);
      } catch {}
      setPurchaseModal(null);
      const id = purchaseModal.id;
      const cur = loadCustomTheme();
      if (BOARD_SKINS.some(b => b.id === id)) {
        saveCustomTheme({ ...cur, boardSkin: id as any });
        setActiveBoard(id);
        emitThemeChanged();
      } else if (id.startsWith("piece_")) {
        const skinId = id.replace("piece_", "");
        saveCustomTheme({ ...cur, pieceSkin: skinId as any });
        setActivePiece(skinId);
        emitThemeChanged();
      } else if ((STORE_BANNER_ITEM_IDS as readonly string[]).includes(id)) {
        saveCustomTheme({ ...cur, bannerSkin: id as any });
        setActiveBanner(id);
        emitThemeChanged();
      }
      setEquipMsg({ text: `✓ ${purchaseModal.label} unlocked & equipped!`, ok: true });
      setTimeout(() => setEquipMsg(null), 2200);
    } catch (e: any) {
      setEquipMsg({ text: e?.response?.data?.detail || "Purchase failed", ok: false });
      setTimeout(() => setEquipMsg(null), 2500);
    } finally { setBuyLoading(false); }
  };

  const catData = CATEGORIES.find(c => c.id === activeCat)!;

  const TIER_COLOR: Record<string, string> = {
    basic: "#9CA3AF", rare: "#60A5FA", epic: "#A78BFA", legendary: "#F59E0B",
  };

  const totalForCat = (id: CatId) => {
    if (id === "titles")          return TITLES.length;
    if (id === "themes")          return COLLECTION_THEMES.length;
    if (id === "board_bundles")   return BOARD_BUNDLES.length;
    if (id === "profile_bundles") return BANNERS.length + PROFILE_BORDERS.length;
    if (id === "coin_bundles")    return COIN_SKINS.length + COIN_TOSS_ANIMS.length;
    return 0;
  };

  const equipBundle = async (bundle: BoardBundle) => {
    const bOk = bundle.bOwned(profile);
    const pOk = bundle.pOwned(profile);
    if (bOk) equipBoard(bundle.boardId);
    if (pOk) equipPiece(bundle.pieceId);
    if (!bOk && !pOk) return;
    if (bOk && pOk) setEquipMsg({ text: `${bundle.label} equipped!`, ok: true });
    else if (bOk) setEquipMsg({ text: `${bundle.boardLabel} board equipped!`, ok: true });
    else setEquipMsg({ text: `${bundle.pieceLabel} pieces equipped!`, ok: true });
    setTimeout(() => setEquipMsg(null), 1800);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2, background: t.bg, paddingTop: 84, overflowY: "auto", transition: "background 0.4s" }}>

      {equipMsg && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: equipMsg.ok ? "#1a2e1a" : "#2e1a1a", border: `1px solid ${equipMsg.ok ? "#4CAF50" : "#EF4444"}`, borderRadius: 10, padding: "9px 20px", fontFamily: t.fontMono, fontSize: 12, color: equipMsg.ok ? "#4CAF50" : "#EF4444", boxShadow: "0 8px 28px rgba(0,0,0,0.5)", pointerEvents: "none", letterSpacing: "0.06em" }}>
          {equipMsg.ok ? "✓" : ""} {equipMsg.text}
        </div>
      )}

      {insufficientModal && (
        <div onClick={() => setInsufficientModal(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "28px 24px", maxWidth: 340, width: "90%", textAlign: "center" as const }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 8 }}>Not Enough Credits</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>Balance: <span style={{ color: hoverColor }}>{(user as any)?.protocredits ?? 0} ⬡</span></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setInsufficientModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontFamily: t.fontMono, fontSize: 12, cursor: "pointer" }}>CANCEL</button>
              <button onClick={() => { setInsufficientModal(false); window.dispatchEvent(new Event("pp_goto_store")); }} style={{ flex: 1, padding: "10px", background: hoverColor, border: "none", borderRadius: 8, color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>GET CREDITS →</button>
            </div>
          </div>
        </div>
      )}

      {purchaseModal && (
        <div onClick={() => !buyLoading && setPurchaseModal(null)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 16, padding: "28px 24px", maxWidth: 340, width: "90%" }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 10, color: hoverColor, letterSpacing: "0.2em", marginBottom: 8 }}>CONFIRM PURCHASE</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 6 }}>{purchaseModal.label}</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 6 }}>Cost: <span style={{ color: hoverColor, fontWeight: 700 }}>{purchaseModal.price.toLocaleString()} ⬡</span></div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 18 }}>Balance after: <span style={{ color: t.text }}>{((user as any)?.protocredits ?? 0) - purchaseModal.price} ⬡</span></div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPurchaseModal(null)} disabled={buyLoading} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, fontFamily: t.fontMono, fontSize: 12, cursor: "pointer" }}>CANCEL</button>
              <button onClick={confirmPurchase} disabled={buyLoading} style={{ flex: 1, padding: "10px", background: buyLoading ? `${hoverColor}55` : hoverColor, border: "none", borderRadius: 8, color: "#000", fontFamily: t.fontDisplay, fontSize: 12, fontWeight: 800, cursor: buyLoading ? "not-allowed" : "pointer" }}>
                {buyLoading ? "..." : "CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bannerShine { from { background-position: -100% 0; } to { background-position: 100% 0; } }
        .coll-tab { transition: all 0.22s cubic-bezier(.22,.68,0,1.1); position: relative; overflow: hidden; }
        .coll-tab:hover { transform: translateY(-1px); }
        .coll-item { transition: transform 0.28s cubic-bezier(.22,.68,0,1.2), box-shadow 0.28s cubic-bezier(.22,.68,0,1.2), border-color 0.2s ease, background 0.2s ease; cursor: pointer; position: relative; }
        .coll-item:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.4) !important; z-index: 10; }
        .coll-item:active { transform: translateY(-2px) scale(1.01); }
        .coll-locked { position: relative; }
        .coll-locked-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); z-index: 5; display: flex; alignItems: center; justifyContent: center; border-radius: inherit; }
        * { -webkit-font-smoothing: antialiased; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      <div style={{ maxWidth: 1600, margin: "0 auto", padding: isMobile ? "0 20px 60px" : "0 40px 60px" }}>

        {/* ── Main content ── */}
        <div style={{ minWidth: 0 }}>
          {isMobile && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.accent, letterSpacing: "0.4em", fontWeight: 800, marginBottom: 4, opacity: 0.8 }}>ARSENAL</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 950, color: t.text }}>Collection</div>
                <div onClick={() => { onClickAction?.(); setShowAll(v => !v); }} style={{ 
                  fontFamily: t.fontMono, fontSize: 10, color: t.accent, cursor: "pointer", fontWeight: 800, 
                  background: `${t.accent}14`, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.accent}33`
                }}>
                  {showAll ? "OWNED ONLY" : "SHOW ALL"}
                </div>
              </div>
            </div>
          )}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${t.border}44` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2 }}>
                {CATEGORIES.map(cat => {
                  const isActive = activeCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      className="coll-tab"
                      onClick={() => { onClickAction?.(); setActiveCat(cat.id); setShowAll(false); }}
                      onMouseEnter={() => onHoverAction?.()}
                      style={{
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: isActive ? `${t.accent}18` : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isActive ? `${t.accent}55` : "rgba(255,255,255,0.06)"}`,
                        color: isActive ? t.accent : t.textMuted,
                        fontFamily: t.fontDisplay,
                        fontSize: 13,
                        fontWeight: isActive ? 950 : 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase" as const,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow: isActive ? `0 0 18px ${t.accent}22, inset 0 0 18px ${t.accent}10` : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      <CatIcon id={cat.icon} size={16} color={isActive ? t.accent : t.textMuted} />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => { onClickAction?.(); setShowAll(v => !v); }}
                onMouseEnter={() => onHoverAction?.()}
                style={{
                  flexShrink: 0,
                  background: showAll ? t.accent : "rgba(255,255,255,0.03)",
                  border: `1px solid ${showAll ? t.accent : t.border}`,
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  fontWeight: 800,
                  color: showAll ? "#000" : t.textMuted,
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                  transition: "all 0.2s",
                }}
              >
                {showAll ? "SHOWING ALL" : "FILTER OWNED"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 32 : 0 }}>
            {(isMobile ? CATEGORIES : [{ id: activeCat, icon: catData.icon, label: catData.label } as any]).map(renderCat => {
              const cat = renderCat.id;
              return (
                <div key={cat} style={{ width: "100%" }}>
                  {isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${t.accent}14`, border: `1px solid ${t.accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}><CatIcon id={renderCat.icon} size={18} color={t.accent} /></div>
                      <span style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: t.text, letterSpacing: "0.04em" }}>{renderCat.label}</span>
                      <div style={{ flex: 1, height: 1, background: t.border, marginLeft: 8 }} />
                    </div>
                  )}

                  {/* ── THEMES ── */}
                  {cat === "themes" && (
            <ThemesWithCustomize t={t} ip={ip} themeId={themeId} profile={profile} setThemeIdAction={setThemeIdAction} activeTheme={activeTheme} setActiveTheme={setActiveTheme} showAll={showAll} onHoverAction={onHoverAction} onClickAction={onClickAction} />
          )}

          {/* ── GRIDS ── */}
          {cat === "board_bundles" && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? 260 : 320}px,1fr))`, gap: isMobile ? 16 : 18 }}>
              {BOARD_BUNDLES.filter(b => showAll || b.bOwned(profile) || b.pOwned(profile) || b.isDefault).map(bundle => {
                const bOk = bundle.bOwned(profile);
                const pOk = bundle.pOwned(profile);
                const anyOwned = bOk || pOk || !!bundle.isDefault;
                const fullyOwned = (bOk && pOk) || !!bundle.isDefault;
                const isActive = activeBoard === bundle.boardId && activePiece === bundle.pieceId;
                const ac = bundle.accentColor;
                return (
                  <div key={bundle.id}
                    onClick={() => { if (anyOwned && !isActive) { onClickAction?.(); equipBundle(bundle as any); } }}
                    onMouseEnter={() => { if (anyOwned) onHoverAction?.(); }}
                    style={{ borderRadius: 18, overflow: "hidden", border: `1.5px solid ${anyOwned ? (isActive ? ac : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.04)"}`, background: "rgba(18,18,26,0.9)", backdropFilter: "blur(14px)", boxShadow: isActive ? `0 0 28px ${ac}28` : "none", cursor: anyOwned && !isActive ? "pointer" : "default", position: "relative", transition: "box-shadow 0.2s, border-color 0.2s" }}>
                    {/* Board preview banner */}
                    <div style={{ height: 110, background: bundle.boardPreview, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!anyOwned && (<div className="coll-locked-overlay"><div style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}><LockIcon size={14} color="#888" /><span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span></div></div>)}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,20px)", gap: 2, transform: "rotate(-5deg)", opacity: 0.7 }}>{Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 20, height: 20, background: `${bundle.boardBorder}22`, border: `1px solid ${bundle.boardBorder}77`, borderRadius: 2 }} />)}</div>
                      {isActive && (<><div style={{ position: "absolute", top: 10, right: 10, background: ac, borderRadius: 10, padding: "3px 10px", fontFamily: t.fontMono, fontSize: 9, color: "#000", fontWeight: 900, letterSpacing: "0.06em", zIndex: 3 }}>EQUIPPED</div><div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 3s infinite linear", pointerEvents: "none" }} /></>)}
                      {!fullyOwned && anyOwned && <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.75)", border: `1px solid ${ac}44`, borderRadius: 8, padding: "3px 8px", fontFamily: t.fontMono, fontSize: 8, color: ac, fontWeight: 800, letterSpacing: "0.08em" }}>PARTIAL</div>}
                    </div>
                    {/* Content */}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 17, fontWeight: 800, color: isActive ? ac : anyOwned ? t.text : t.textMuted, letterSpacing: "0.02em", marginBottom: 2 }}>{bundle.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, opacity: 0.65, marginBottom: 12 }}>{bundle.tagline}</div>
                      {/* Piece + board previews */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {/* P1 */}
                        <div style={{ flex: 1, background: pOk || bundle.isDefault ? `${ac}0D` : "#0c0c14", border: `1px solid ${pOk || bundle.isDefault ? `${ac}2A` : "rgba(255,255,255,0.05)"}`, borderRadius: 8, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ width: 32, height: 32, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {(bundle as any).isFlameSkull ? (<svg width="22" height="22" viewBox="0 0 100 120" fill="none"><path d="M50 10 C30 30 15 50 25 70 C20 60 35 55 30 70 C25 85 35 100 50 110 C65 100 75 85 70 70 C65 55 80 60 75 70 C85 50 70 30 50 10Z" fill={pOk ? "#FF4400" : "#333"} opacity={pOk ? 0.9 : 0.3}/></svg>)
                            : (bundle as any).isGlacierShard ? (pOk ? <GlacierSigilPiece cssSize="26px" /> : <span style={{ fontSize: 14, color: "#333" }}>✶</span>)
                            : <span style={{ fontFamily: t.fontMono, fontSize: 16, fontWeight: 900, color: pOk || bundle.isDefault ? bundle.pieceP1c : "#333" }}>{bundle.pieceP1}</span>}
                          </div>
                          <span style={{ fontFamily: t.fontMono, fontSize: 7, color: pOk || bundle.isDefault ? `${ac}77` : "#333", letterSpacing: "0.1em", fontWeight: 700 }}>P1</span>
                        </div>
                        {/* P2 */}
                        <div style={{ flex: 1, background: pOk || bundle.isDefault ? `${ac}0D` : "#0c0c14", border: `1px solid ${pOk || bundle.isDefault ? `${ac}2A` : "rgba(255,255,255,0.05)"}`, borderRadius: 8, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ width: 32, height: 32, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {(bundle as any).isFlameSkull ? (<svg width="18" height="18" viewBox="0 0 100 110" fill="none" stroke={pOk ? "#CCCCCC" : "#333"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity={pOk ? 1 : 0.3}><path d="M20 65 C20 35 80 35 80 65 C80 80 72 88 72 95 L28 95 C28 88 20 80 20 65Z"/><circle cx="37" cy="62" r="10" fill={pOk ? "#EEE" : "#333"}/><circle cx="63" cy="62" r="10" fill={pOk ? "#EEE" : "#333"}/></svg>)
                            : (bundle as any).isGlacierShard ? (pOk ? <GlacierPrismPiece cssSize="26px" /> : <span style={{ fontSize: 14, color: "#333" }}>◈</span>)
                            : <span style={{ fontFamily: t.fontMono, fontSize: 16, fontWeight: 900, color: pOk || bundle.isDefault ? bundle.pieceP2c : "#333" }}>{bundle.pieceP2}</span>}
                          </div>
                          <span style={{ fontFamily: t.fontMono, fontSize: 7, color: pOk || bundle.isDefault ? `${ac}77` : "#333", letterSpacing: "0.1em", fontWeight: 700 }}>P2</span>
                        </div>
                        {/* Board mini */}
                        <div style={{ flex: 1.4, background: bOk || bundle.isDefault ? bundle.boardPreview : "#0c0c14", border: `1px solid ${bOk || bundle.isDefault ? bundle.boardBorder + "55" : "rgba(255,255,255,0.05)"}`, borderRadius: 8, padding: "8px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,9px)", gap: 1, opacity: bOk || bundle.isDefault ? 0.85 : 0.2 }}>{Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ width: 9, height: 9, background: `${bundle.boardBorder}44`, border: `1px solid ${bundle.boardBorder}77`, borderRadius: 1 }} />)}</div>
                          <span style={{ fontFamily: t.fontMono, fontSize: 7, color: bOk || bundle.isDefault ? `${ac}77` : "#333", letterSpacing: "0.07em", fontWeight: 700 }}>BOARD</span>
                        </div>
                      </div>
                      {/* Status row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, opacity: 0.65 }}>
                          {isActive ? "Active loadout" : anyOwned ? "Click to equip" : "Available in Store"}
                        </span>
                        {!anyOwned && !bundle.isDefault && (
                          <span style={{ flexShrink: 0, background: `${ac}0E`, border: `1px solid ${ac}28`, borderRadius: 10, padding: "5px 10px", fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, color: `${ac}99`, whiteSpace: "nowrap" }}>
                            {bundle.price.toLocaleString()} ⬡
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── OLD board skins (hidden) ── */}
          {cat === "board_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {BOARD_SKINS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                return (
                  <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                    onClick={() => { if (owned && activeBoard !== item.id && equipping !== item.id) { onClickAction?.(); equipBoard(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ 
                      borderRadius: 16, overflow: "hidden", 
                      border: `1px solid ${owned ? (activeBoard === item.id ? hoverColor : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, 
                      background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                      boxShadow: activeBoard === item.id ? `0 0 20px ${hoverColor}33` : "none", 
                      cursor: owned && activeBoard !== item.id ? "pointer" : "default" 
                    }}>
                    {!owned && (
                      <div className="coll-locked-overlay">
                         <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                          <LockIcon size={14} color="#888" />
                          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span>
                         </div>
                      </div>
                    )}
                    <div style={{ height: 100, background: item.preview, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,16px)", gap: 2, opacity: 0.85, transform: "rotate(-5deg)" }}>
                        {Array.from({ length: 16 }).map((_, i) => <div key={i} style={{ width: 16, height: 16, background: item.border, borderRadius: 2 }} />)}
                      </div>
                      
                      {isPurchasable && <div style={{ position: "absolute", top: 12, left: 12, background: `linear-gradient(135deg, ${hoverColor}, #000)`, border: `1px solid ${hoverColor}88`, borderRadius: 8, padding: "4px 10px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 800, letterSpacing: "0.08em", zIndex: 6, boxShadow: `0 4px 10px rgba(0,0,0,0.4)` }}>BOUTIQUE</div>}
                      {owned && activeBoard === item.id && (
                        <>
                          <div style={{ position: "absolute", top: 12, right: 12, background: hoverColor, borderRadius: 12, padding: "4px 12px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 900, letterSpacing: "0.05em", zIndex: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>EQUIPPED</div>
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 3s infinite linear", zIndex: 1, pointerEvents: "none" }} />
                        </>
                      )}
                    </div>
                    <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: activeBoard === item.id ? hoverColor : t.text }}>{item.label}</div>
                        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>
                          {equipping === item.id ? "Synchronizing…" : owned ? (activeBoard === item.id ? "Active battlefield" : "Click to select") : "Available in shop"}
                        </div>
                      </div>
                      {isPurchasable && (
                        <button onClick={e => { e.stopPropagation(); handleBuyItem(item.id, item.label, item.price!); }}
                          style={{ flexShrink: 0, background: `${hoverColor}22`, border: `1px solid ${hoverColor}44`, borderRadius: 10, padding: "8px 14px", fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, color: hoverColor, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                          {item.price!.toLocaleString()} ⬡
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BANNERS (+ borders) ── */}
          {cat === "profile_bundles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12, opacity: 0.7 }}>BANNERS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
                  {BANNERS.filter(x => showAll || x.condition(profile)).map(item => {
                    const owned = item.condition(profile);
                    const isActive = activeBanner === item.id;
                    return (
                      <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                        onClick={() => { if (owned && !isActive) { onClickAction?.(); equipBanner(item.id); } }}
                        style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${owned ? (isActive ? hoverColor : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)", cursor: owned && !isActive ? "pointer" : "default", boxShadow: isActive ? `0 0 20px ${hoverColor}33` : "none" }}>
                        {!owned && (<div className="coll-locked-overlay"><div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}><LockIcon size={14} color="#888" /><span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span></div></div>)}
                        <div style={{ height: 110, overflow: "hidden", position: "relative" }}>
                          <BannerRenderer bannerId={item.id} />
                          {owned && isActive && (<><div style={{ position: "absolute", top: 12, right: 12, background: hoverColor, borderRadius: 12, padding: "4px 12px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 900, letterSpacing: "0.05em", zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>EQUIPPED</div><div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 3s infinite linear", zIndex: 2, pointerEvents: "none" }} /></>)}
                        </div>
                        <div style={{ padding: "16px" }}>
                          <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: isActive ? hoverColor : t.text }}>{item.label}</div>
                          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{equippingBanner === item.id ? "Calibrating…" : owned ? (isActive ? "Current banner" : "Click to showcase") : "Unlock via progress"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12, opacity: 0.7 }}>PROFILE BORDERS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
                  {PROFILE_BORDERS.filter(x => showAll || x.condition(profile)).map(item => {
                    const owned = item.condition(profile);
                    const tc = TIER_COLOR[item.tier];
                    const isRainbow = item.id === "rainbow_halo";
                    return (
                      <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                        style={{ borderRadius: 16, padding: "24px 16px", border: `1px solid ${owned ? (item.id === "none" ? "rgba(255,255,255,0.1)" : tc + "aa") : "rgba(255,255,255,0.05)"}`, background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, boxShadow: owned && item.id !== "none" ? `0 0 25px ${tc}22` : "none" }}>
                        <div style={{ width: 72, height: 72, borderRadius: "50%", background: `linear-gradient(135deg,${t.p1},${t.p2})`, boxShadow: owned && item.id !== "none" ? (isRainbow ? "0 0 0 4px #FF6B6B, 0 0 0 8px #FFD700, 0 0 30px #FF6B6BAA" : item.css) : "none", border: item.id === "none" ? `1px dashed ${t.border}` : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>{!owned && <LockIcon size={20} color="#555" />}</div>
                        <div style={{ textAlign: "center" as const }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 8 }}>
                            <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800, color: owned ? t.text : t.textMuted }}>{item.label}</span>
                            <span style={{ fontFamily: t.fontMono, fontSize: 9, color: tc, background: `${tc}18`, padding: "2px 8px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.1em" }}>{item.tier.toUpperCase()} LEVEL</span>
                          </div>
                          <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, fontWeight: 500, opacity: 0.8 }}>{owned ? "Aura active" : item.unlockDesc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── OLD banners (hidden — merged into profile_bundles) ── */}
          {cat === "banners_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
              {BANNERS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isActive = activeBanner === item.id;
                return (
                  <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                    onClick={() => { if (owned && !isActive) { onClickAction?.(); equipBanner(item.id); } }}
                    style={{ 
                      borderRadius: 16, overflow: "hidden", 
                      border: `1px solid ${owned ? (isActive ? hoverColor : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, 
                      background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                      cursor: owned && !isActive ? "pointer" : "default", 
                      boxShadow: isActive ? `0 0 20px ${hoverColor}33` : "none" 
                    }}>
                    {!owned && (
                      <div className="coll-locked-overlay">
                         <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                          <LockIcon size={14} color="#888" />
                          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span>
                         </div>
                      </div>
                    )}
                    <div style={{ height: 110, overflow: "hidden", position: "relative" }}>
                      <BannerRenderer bannerId={item.id} />
                      {owned && isActive && (
                        <>
                          <div style={{ position: "absolute", top: 12, right: 12, background: hoverColor, borderRadius: 12, padding: "4px 12px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 900, letterSpacing: "0.05em", zIndex: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>EQUIPPED</div>
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 3s infinite linear", zIndex: 2, pointerEvents: "none" }} />
                        </>
                      )}
                    </div>
                    <div style={{ padding: "16px" }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: isActive ? hoverColor : t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>
                        {equippingBanner === item.id ? "Calibrating…" : owned ? (isActive ? "Current banner" : "Click to showcase") : "Unlock via progress"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── OLD borders (hidden) ── */}
          {cat === "borders_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {PROFILE_BORDERS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const tc = TIER_COLOR[item.tier];
                const isRainbow = item.id === "rainbow_halo";
                return (
                  <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                    style={{ 
                      borderRadius: 16, padding: "24px 16px", 
                      border: `1px solid ${owned ? (item.id === "none" ? "rgba(255,b255,255,0.1)" : tc + "aa") : "rgba(255,255,255,0.05)"}`, 
                      background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
                      boxShadow: owned && item.id !== "none" ? `0 0 25px ${tc}22` : "none"
                    }}>
                    <div style={{ 
                      width: 72, height: 72, borderRadius: "50%", 
                      background: `linear-gradient(135deg,${t.p1},${t.p2})`, 
                      boxShadow: owned && item.id !== "none" ? (isRainbow ? "0 0 0 4px #FF6B6B, 0 0 0 8px #FFD700, 0 0 30px #FF6B6BAA" : item.css) : "none",
                      border: item.id === "none" ? `1px dashed ${t.border}` : "none",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {!owned && <LockIcon size={20} color="#555" />}
                    </div>
                    <div style={{ textAlign: "center" as const }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 8 }}>
                        <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800, color: owned ? t.text : t.textMuted }}>{item.label}</span>
                        <span style={{ fontFamily: t.fontMono, fontSize: 9, color: tc, background: `${tc}18`, padding: "2px 8px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.1em" }}>{item.tier.toUpperCase()} LEVEL</span>
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, fontWeight: 500, opacity: 0.8 }}>{owned ? "Aura active" : item.unlockDesc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── COINS (coin skins + toss animations) ── */}
          {cat === "coin_bundles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12, opacity: 0.7 }}> COINS </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
                  {COIN_SKINS.filter(x => showAll || x.owned).map(item => (
                    <div key={item.id} className={`coll-item ${!item.owned ? "coll-locked" : ""}`}
                      style={{ borderRadius: 16, padding: "24px 16px", border: `1px solid ${item.owned ? item.c1 + "44" : "rgba(255,255,255,0.05)"}`, background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, position: "relative", boxShadow: item.owned ? `0 0 20px ${item.c1}11` : "none" }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 52, height: 52, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c1}FF, ${item.c1}88)` : "#1a1a1a", boxShadow: item.owned ? `0 0 15px ${item.c1}55` : "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}><img src={item.img1} alt="penta" style={{ width: 32, height: 32, objectFit: "contain", opacity: item.owned ? 1 : 0.15 }} />{item.owned && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 4s infinite linear" }} />}</div>
                          <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c1 : t.textMuted, letterSpacing: "0.1em", fontWeight: 800 }}>PENTA</span>
                        </div>
                        <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 52, height: 52, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c2}FF, ${item.c2}88)` : "#1a1a1a", boxShadow: item.owned ? `0 0 15px ${item.c2}55` : "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}><img src={item.img2} alt="proto" style={{ width: 32, height: 32, objectFit: "contain", opacity: item.owned ? 1 : 0.15 }} />{item.owned && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 4s infinite linear" }} />}</div>
                          <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c2 : t.textMuted, letterSpacing: "0.1em", fontWeight: 800 }}>PROTO</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "center" as const }}><div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: item.owned ? t.text : t.textMuted }}>{item.label}</div><div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{item.owned ? "Active mint" : item.desc}</div></div>
                      {!item.owned && (<div className="coll-locked-overlay"><LockIcon size={16} color="#666" /></div>)}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, letterSpacing: "0.18em", marginBottom: 12, opacity: 0.7 }}>TOSS ANIMATIONS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
                  {COIN_TOSS_ANIMS.filter(x => showAll || x.condition(profile)).map(item => {
                    const owned = item.condition(profile);
                    const isPurchasable = !!item.price && !owned;
                    const ac = t.accent;
                    return (
                      <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                        onClick={() => { if (owned && activeToss !== item.id) { onClickAction?.(); equipToss(item.id); } }}
                        onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                        style={{ borderRadius: 16, padding: "20px 16px", border: `1px solid ${owned ? (activeToss === item.id ? ac : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", gap: 16, position: "relative", boxShadow: activeToss === item.id ? `0 0 20px ${ac}33` : "none", cursor: owned && activeToss !== item.id ? "pointer" : "default" }}>
                        {!owned && (<div className="coll-locked-overlay"><div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}><LockIcon size={12} color="#888" /><span style={{ fontFamily: t.fontMono, fontSize: 9, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span></div></div>)}
                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: owned ? `linear-gradient(135deg,${ac},${ac}88)` : "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: owned ? `0 0 15px ${ac}44` : "none", position: "relative", overflow: "hidden" }}>
                          {owned ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>}
                          {owned && activeToss === item.id && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.3) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 2s infinite linear" }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: activeToss === item.id ? ac : t.text }}>{item.label}</div>
                          <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{owned ? (activeToss === item.id ? "Currently active" : "Impact selection") : item.desc}</div>
                        </div>
                        {owned && activeToss === item.id && <div style={{ position: "absolute", top: 12, right: 12, background: ac, borderRadius: 10, padding: "3px 10px", fontFamily: t.fontMono, fontSize: 9, color: "#000", fontWeight: 900, letterSpacing: "0.05em", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>ACTIVE</div>}
                        {isPurchasable && <div style={{ position: "absolute", top: 12, left: 12, background: `linear-gradient(135deg, ${hoverColor}, #000)`, border: `1px solid ${hoverColor}88`, borderRadius: 8, padding: "4px 10px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 800, letterSpacing: "0.08em", zIndex: 6, boxShadow: `0 4px 10px rgba(0,0,0,0.4)` }}>EXCLUSIVE</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── OLD coin skins (hidden) ── */}
          {cat === "coins_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14 }}>
              {COIN_SKINS.filter(x => showAll || x.owned).map(item => (
                <div key={item.id} className={`coll-item ${!item.owned ? "coll-locked" : ""}`}
                  style={{ 
                    borderRadius: 16, padding: "24px 16px", 
                    border: `1px solid ${item.owned ? item.c1 + "44" : "rgba(255,255,255,0.05)"}`, 
                    background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 16, position: "relative",
                    boxShadow: item.owned ? `0 0 20px ${item.c1}11` : "none"
                  }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c1}FF, ${item.c1}88)` : "#1a1a1a", boxShadow: item.owned ? `0 0 15px ${item.c1}55` : "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <img src={item.img1} alt="penta" style={{ width: 32, height: 32, objectFit: "contain", opacity: item.owned ? 1 : 0.15 }} />
                        {item.owned && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 4s infinite linear" }} />}
                      </div>
                      <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c1 : t.textMuted, letterSpacing: "0.1em", fontWeight: 800 }}>PENTA</span>
                    </div>
                    <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 52, height: 52, borderRadius: "50%", background: item.owned ? `radial-gradient(circle at 35% 35%, ${item.c2}FF, ${item.c2}88)` : "#1a1a1a", boxShadow: item.owned ? `0 0 15px ${item.c2}55` : "none", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        <img src={item.img2} alt="proto" style={{ width: 32, height: 32, objectFit: "contain", opacity: item.owned ? 1 : 0.15 }} />
                        {item.owned && <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.2) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 4s infinite linear" }} />}
                      </div>
                      <span style={{ fontFamily: t.fontMono, fontSize: 9, color: item.owned ? item.c2 : t.textMuted, letterSpacing: "0.1em", fontWeight: 800 }}>PROTO</span>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" as const }}>
                    <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: item.owned ? t.text : t.textMuted }}>{item.label}</div>
                    <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{item.owned ? "Active mint" : item.desc}</div>
                  </div>
                  {!item.owned && (
                    <div className="coll-locked-overlay">
                      <LockIcon size={16} color="#666" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── OLD toss (hidden) ── */}
          {cat === "toss_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {COIN_TOSS_ANIMS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                const ac = t.accent;
                return (
                  <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                    onClick={() => { if (owned && activeToss !== item.id) { onClickAction?.(); equipToss(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ 
                      borderRadius: 16, padding: "20px 16px", 
                      border: `1px solid ${owned ? (activeToss === item.id ? ac : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, 
                      background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                      display: "flex", alignItems: "center", gap: 16, position: "relative", 
                      boxShadow: activeToss === item.id ? `0 0 20px ${ac}33` : "none", 
                      cursor: owned && activeToss !== item.id ? "pointer" : "default" 
                    }}>
                    {!owned && (
                      <div className="coll-locked-overlay">
                         <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                          <LockIcon size={12} color="#888" />
                          <span style={{ fontFamily: t.fontMono, fontSize: 9, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span>
                         </div>
                      </div>
                    )}
                    <div style={{ width: 48, height: 48, borderRadius: "50%", background: owned ? `linear-gradient(135deg,${ac},${ac}88)` : "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: owned ? `0 0 15px ${ac}44` : "none", position: "relative", overflow: "hidden" }}>
                      {owned
                        ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/></svg>}
                      {owned && activeToss === item.id && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.3) 55%, transparent 60%)", backgroundSize: "200% 100%", animation: "bannerShine 2s infinite linear" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: activeToss === item.id ? ac : t.text }}>{item.label}</div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{owned ? (activeToss === item.id ? "Currently active" : "Impact selection") : item.desc}</div>
                    </div>
                    {owned && activeToss === item.id && <div style={{ position: "absolute", top: 12, right: 12, background: ac, borderRadius: 10, padding: "3px 10px", fontFamily: t.fontMono, fontSize: 9, color: "#000", fontWeight: 900, letterSpacing: "0.05em", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>ACTIVE</div>}
                    {isPurchasable && <div style={{ position: "absolute", top: 12, left: 12, background: `linear-gradient(135deg, ${hoverColor}, #000)`, border: `1px solid ${hoverColor}88`, borderRadius: 8, padding: "4px 10px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 800, letterSpacing: "0.08em", zIndex: 6, boxShadow: `0 4px 10px rgba(0,0,0,0.4)` }}>EXCLUSIVE</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BADGES ── */}
          {cat === "titles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TITLES.filter(ti => showAll || ti.condition(profile)).map(ti => {
                const owned = ti.condition(profile);
                return (
                  <div key={ti.id} className="coll-item"
                    style={{ 
                      display: "flex", alignItems: "center", gap: 16, padding: "18px 24px", 
                      borderRadius: 16, border: `1px solid ${owned ? ti.color + "44" : "rgba(255,255,255,0.05)"}`, 
                      background: owned ? `${ti.color}0a` : "rgba(30,30,30,0.6)", 
                      backdropFilter: "blur(12px)",
                      opacity: owned ? 1 : 0.4 
                    }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: owned ? ti.color : "#333", boxShadow: owned ? `0 0 12px ${ti.glow}` : "none", flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontFamily: t.fontMono, fontSize: 16, fontWeight: 800, color: owned ? ti.color : t.textMuted, letterSpacing: "0.06em" }}>{ti.label}</span>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>{ti.unlockDesc}</div>
                    </div>
                    {owned
                      ? <span style={{ fontFamily: t.fontMono, fontSize: 10, color: ti.color, background: `${ti.color}1e`, border: `1px solid ${ti.color}33`, padding: "4px 12px", borderRadius: 8, fontWeight: 900, letterSpacing: "0.05em" }}>CLAIMED</span>
                      : <LockIcon size={16} color="#666" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── OLD piece skins (hidden — merged into board_bundles) ── */}
          {cat === "pieces_hidden" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
              {PIECE_SKINS.filter(x => showAll || x.condition(profile)).map(item => {
                const owned = item.condition(profile);
                const isPurchasable = !!item.price && !owned;
                return (
                  <div key={item.id} className={`coll-item ${!owned ? "coll-locked" : ""}`}
                    onClick={() => { if (owned && activePiece !== item.id) { onClickAction?.(); equipPiece(item.id); } }}
                    onMouseEnter={() => { if (owned) onHoverAction?.(); }}
                    style={{ 
                      borderRadius: 16, padding: "18px", 
                      border: `1px solid ${owned ? (activePiece === item.id ? hoverColor : "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.05)"}`, 
                      background: "rgba(30,30,30,0.6)", backdropFilter: "blur(12px)",
                      position: "relative", boxShadow: activePiece === item.id ? `0 0 20px ${hoverColor}33` : "none", 
                      cursor: owned && activePiece !== item.id ? "pointer" : "default" 
                    }}>
                    {!owned && (
                      <div className="coll-locked-overlay">
                         <div style={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,b255,255,0.15)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                          <LockIcon size={14} color="#888" />
                          <span style={{ fontFamily: t.fontMono, fontSize: 10, color: "#888", fontWeight: 800, letterSpacing: "0.1em" }}>LOCKED</span>
                         </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16, marginTop: isPurchasable ? 12 : 0, position: "relative" }}>
                      {owned && activePiece === item.id && (
                        <div style={{ position: "absolute", inset: -10, background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)", animation: "fadeIn 1s infinite alternate" }} />
                      )}
                      {item.isFlameSkull ? (
                        <>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? "rgba(255,68,0,0.15)" : "#1a1a1a", border: `2px solid ${owned ? "#FF4400" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: owned ? "0 0 15px #FF440033" : "none" }}>
                            <svg width="24" height="24" viewBox="0 0 100 120" fill="none">
                              <path d="M50 10 C30 30 15 50 25 70 C20 60 35 55 30 70 C25 85 35 100 50 110 C65 100 75 85 70 70 C65 55 80 60 75 70 C85 50 70 30 50 10Z" fill={owned ? "#FF4400" : "#444"} opacity={owned ? 0.95 : 0.3}/>
                              <path d="M50 40 C40 55 38 65 45 75 C43 68 50 65 48 75 C46 85 50 95 50 100 C55 90 58 80 55 70 C53 62 60 58 58 68 C65 55 58 42 50 40Z" fill={owned ? "#FFB300" : "#333"} opacity={owned ? 0.9 : 0.25}/>
                            </svg>
                          </div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? "rgba(200,200,200,0.1)" : "#1a1a1a", border: `2px solid ${owned ? "#CCCCCC" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: owned ? "0 0 15px rgba(255,255,255,0.1)" : "none" }}>
                            <svg width="24" height="24" viewBox="0 0 100 110" fill="none" stroke={owned ? "#EEEEEE" : "#444"} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity={owned ? 1 : 0.3}>
                              <path d="M20 65 C20 35 80 35 80 65 C80 80 72 88 72 95 L28 95 C28 88 20 80 20 65Z"/>
                              <rect x="30" y="95" width="40" height="10" rx="4"/>
                              <circle cx="37" cy="62" r="10" fill={owned ? "#EEEEEE" : "#444"}/>
                              <circle cx="63" cy="62" r="10" fill={owned ? "#EEEEEE" : "#444"}/>
                            </svg>
                          </div>
                        </>
                      ) : item.isGlacierShard ? (
                        <>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? "rgba(125,211,252,0.12)" : "#0a1020", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : "#7dd3fc") : "rgba(125,211,252,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: owned ? "0 0 15px rgba(125,211,252,0.2)" : "none", opacity: owned ? 1 : 0.4 }}>
                            <GlacierSigilPiece cssSize="30px" />
                          </div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? "rgba(147,197,253,0.12)" : "#0a1020", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : "#93c5fd") : "rgba(147,197,253,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: owned ? "0 0 15px rgba(147,197,253,0.2)" : "none", opacity: owned ? 1 : 0.4 }}>
                            <GlacierPrismPiece cssSize="30px" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? `${item.p1c}15` : "#1a1a1a", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : item.p1c) : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: 28, fontWeight: 900, color: owned ? item.p1c : "#333", boxShadow: owned ? `0 0 15px ${item.p1c}22` : "none" }}>{item.p1}</div>
                          <div style={{ width: 44, height: 44, borderRadius: 10, background: owned ? `${item.p2c}15` : "#1a1a1a", border: `2px solid ${owned ? (activePiece === item.id ? hoverColor : item.p2c) : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: 28, fontWeight: 900, color: owned ? item.p2c : "#333", boxShadow: owned ? `0 0 15px ${item.p2c}22` : "none" }}>{item.p2}</div>
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: activePiece === item.id ? hoverColor : t.text }}>{item.label}</div>
                        <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginTop: 4, fontWeight: 500, opacity: 0.7 }}>
                          {owned ? (activePiece === item.id ? "Battle ready" : "Select pieces") : "Vaulted skin"}
                        </div>
                      </div>
                      {isPurchasable && (
                        <button onClick={e => { e.stopPropagation(); handleBuyItem(`piece_${item.id}`, item.label, item.price!); }}
                          style={{ flexShrink: 0, background: `${hoverColor}22`, border: `1px solid ${hoverColor}44`, borderRadius: 10, padding: "8px 14px", fontFamily: t.fontMono, fontSize: 11, fontWeight: 800, color: hoverColor, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}>
                          {item.price!.toLocaleString()} ⬡
                        </button>
                      )}
                    </div>
                    {isPurchasable && <div style={{ position: "absolute", top: 12, left: 12, background: `linear-gradient(135deg, ${hoverColor}, #000)`, border: `1px solid ${hoverColor}88`, borderRadius: 8, padding: "4px 10px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 800, letterSpacing: "0.08em", zIndex: 6, boxShadow: `0 4px 10px rgba(0,0,0,0.4)` }}>BOUTIQUE</div>}
                    {owned && activePiece === item.id && <div style={{ position: "absolute", top: 12, right: 12, background: hoverColor, borderRadius: 12, padding: "4px 12px", fontFamily: t.fontMono, fontSize: 10, color: "#fff", fontWeight: 900, letterSpacing: "0.05em", zIndex: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}>ACTIVE</div>}
                  </div>
                );
              })}
            </div>
          )}

                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
