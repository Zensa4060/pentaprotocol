/**
 * Board grid skins — the ``board_style`` cosmetic equipped from the
 * Collection (store grid bundles). Applied as color overrides on top of
 * the active theme palette in ``BoardGrid``.
 */

export interface BoardSkin {
  id: string;
  /** Board frame background. */
  boardBg: string;
  /** Frame border / grid line color. */
  boardLine: string;
  /** Empty cell fill. */
  cellBg: string;
  /** Cell border. */
  cellBorder: string;
  /** Accent used for last-move ring / coordinate labels. */
  accent: string;
  /** Bundle piece skin: per-player stone colors + glow. */
  p1Color: string;
  p2Color: string;
  pieceGlow: string;
  /** Bundle piece glyphs — REPLACE the theme glyphs (e.g. glacier shards). */
  p1Glyph: string;
  p2Glyph: string;
  /** Animated atmosphere overlay tints (slow-breathing wash on the board). */
  atmosphereInner: string;
  atmosphereOuter: string;
}

const SKINS: Record<string, BoardSkin> = {
  // Inferno Bundle — charred forge board, ember-glow lines + flame & skull
  // pieces. Ports the web ``RedGrid`` palette (#140300 board, #ff6633 glow,
  // rising embers) into the phone-optimized skin model.
  red_grid: {
    id: "red_grid",
    boardBg: "#160400",
    boardLine: "rgba(255,80,0,0.5)",
    cellBg: "#240700",
    cellBorder: "rgba(255,80,0,0.26)",
    accent: "#FF6633",
    p1Color: "#FFD9B0",
    p2Color: "#FF6A3D",
    pieceGlow: "rgba(255,80,0,0.85)",
    p1Glyph: "✸",
    p2Glyph: "☠︎",
    atmosphereInner: "rgba(255,80,0,0.16)",
    atmosphereOuter: "rgba(190,18,60,0.10)",
  },
  // Glacier Bundle — aurora-lit arctic grid + glacier shard pieces.
  glacier_grid: {
    id: "glacier_grid",
    boardBg: "#04101E",
    boardLine: "rgba(125,211,252,0.45)",
    cellBg: "#081A2E",
    cellBorder: "rgba(125,211,252,0.28)",
    accent: "#7DD3FC",
    p1Color: "#E0F2FE",
    p2Color: "#38BDF8",
    pieceGlow: "rgba(125,211,252,0.85)",
    p1Glyph: "❅",
    p2Glyph: "❖",
    atmosphereInner: "rgba(56,189,248,0.16)",
    atmosphereOuter: "rgba(167,139,250,0.10)",
  },
  // Bloodmoon Bundle — ritual crimson & violet omen + sigil pieces.
  bloodmoon_grid: {
    id: "bloodmoon_grid",
    boardBg: "#170404",
    boardLine: "rgba(220,38,38,0.5)",
    cellBg: "#220707",
    cellBorder: "rgba(220,38,38,0.3)",
    accent: "#F87171",
    p1Color: "#FCA5A5",
    p2Color: "#C4B5FD",
    pieceGlow: "rgba(220,38,38,0.85)",
    p1Glyph: "✠",
    p2Glyph: "☾",
    atmosphereInner: "rgba(220,38,38,0.16)",
    atmosphereOuter: "rgba(139,92,246,0.10)",
  },
  // Ice Bundle — crystalline frost board + snowflake/shard pieces. (Web
  // ``ice_grid`` reuses the glacier/IceCell renderer; cyan-keyed variant.)
  ice_grid: {
    id: "ice_grid",
    boardBg: "#03101F",
    boardLine: "rgba(96,200,255,0.42)",
    cellBg: "#07182E",
    cellBorder: "rgba(96,200,255,0.24)",
    accent: "#64C8FF",
    p1Color: "#C8EEFF",
    p2Color: "#64C8FF",
    pieceGlow: "rgba(96,200,255,0.85)",
    p1Glyph: "❄",
    p2Glyph: "◆",
    atmosphereInner: "rgba(96,200,255,0.16)",
    atmosphereOuter: "rgba(125,211,252,0.10)",
  },
  // Egypt Bundle — golden dunes & hieroglyphs (web ``EgyptGrid``). Eye-of-
  // Horus glyph swapped for ❖ (the hieroglyph tofus in Android system fonts).
  egypt_grid: {
    id: "egypt_grid",
    boardBg: "#0A0600",
    boardLine: "rgba(214,160,48,0.45)",
    cellBg: "#160E02",
    cellBorder: "rgba(214,160,48,0.26)",
    accent: "#FBBF24",
    p1Color: "#FBBF24",
    p2Color: "#C084FC",
    pieceGlow: "rgba(245,200,90,0.82)",
    p1Glyph: "☥",
    p2Glyph: "❖",
    atmosphereInner: "rgba(214,160,48,0.16)",
    atmosphereOuter: "rgba(192,132,252,0.10)",
  },
  // Synthwave Bundle — neon horizon retro pulse (web ``SynthwaveGrid``).
  synthwave_grid: {
    id: "synthwave_grid",
    boardBg: "#1A0035",
    boardLine: "rgba(255,77,109,0.5)",
    cellBg: "#240046",
    cellBorder: "rgba(0,229,255,0.28)",
    accent: "#FF4D6D",
    p1Color: "#FF4D6D",
    p2Color: "#00E5FF",
    pieceGlow: "rgba(255,77,109,0.85)",
    p1Glyph: "☀",
    p2Glyph: "✦",
    atmosphereInner: "rgba(255,77,109,0.16)",
    atmosphereOuter: "rgba(0,229,255,0.12)",
  },
  // Matrix Bundle — falling code & green pulse (web ``MatrixGrid``).
  matrix_grid: {
    id: "matrix_grid",
    boardBg: "#001400",
    boardLine: "rgba(0,255,65,0.4)",
    cellBg: "#031F03",
    cellBorder: "rgba(0,255,65,0.22)",
    accent: "#00FF41",
    p1Color: "#00FF41",
    p2Color: "#4ADE80",
    pieceGlow: "rgba(0,255,65,0.85)",
    p1Glyph: "[ ]",
    p2Glyph: "01",
    atmosphereInner: "rgba(0,255,65,0.14)",
    atmosphereOuter: "rgba(0,200,40,0.08)",
  },
  // Arcane Bundle — runes, mist & magic circles (web ``ArcaneGrid``).
  arcane_grid: {
    id: "arcane_grid",
    boardBg: "#0A0014",
    boardLine: "rgba(168,85,247,0.45)",
    cellBg: "#140022",
    cellBorder: "rgba(168,85,247,0.25)",
    accent: "#C084FC",
    p1Color: "#C084FC",
    p2Color: "#FBBF24",
    pieceGlow: "rgba(168,85,247,0.85)",
    p1Glyph: "◌",
    p2Glyph: "✶",
    atmosphereInner: "rgba(168,85,247,0.16)",
    atmosphereOuter: "rgba(251,191,36,0.08)",
  },
  // Bio Bundle — bioluminescent abyss glow (web ``BioGrid``).
  bio_grid: {
    id: "bio_grid",
    boardBg: "#00100F",
    boardLine: "rgba(0,255,208,0.42)",
    cellBg: "#02201C",
    cellBorder: "rgba(0,255,208,0.24)",
    accent: "#00FFD0",
    p1Color: "#00FFD0",
    p2Color: "#B464FF",
    pieceGlow: "rgba(0,255,208,0.85)",
    p1Glyph: "❖",
    p2Glyph: "◉",
    atmosphereInner: "rgba(0,255,208,0.16)",
    atmosphereOuter: "rgba(180,100,255,0.10)",
  },
  // Forge Bundle — molten veins & embers (web ``ForgeGrid``).
  forge_grid: {
    id: "forge_grid",
    boardBg: "#140400",
    boardLine: "rgba(255,102,0,0.5)",
    cellBg: "#200800",
    cellBorder: "rgba(255,102,0,0.26)",
    accent: "#FF6600",
    p1Color: "#FF6600",
    p2Color: "#FFCC00",
    pieceGlow: "rgba(255,140,0,0.85)",
    p1Glyph: "✦",
    p2Glyph: "✺",
    atmosphereInner: "rgba(255,102,0,0.16)",
    atmosphereOuter: "rgba(255,204,0,0.10)",
  },
  // Void Bundle — nebulae & cosmic pulses (web ``VoidGrid``).
  void_grid: {
    id: "void_grid",
    boardBg: "#04011A",
    boardLine: "rgba(140,80,255,0.5)",
    cellBg: "#0A0526",
    cellBorder: "rgba(140,80,255,0.26)",
    accent: "#B464FF",
    p1Color: "#B464FF",
    p2Color: "#40C0FF",
    pieceGlow: "rgba(140,80,255,0.85)",
    p1Glyph: "✷",
    p2Glyph: "◎",
    atmosphereInner: "rgba(140,80,255,0.16)",
    atmosphereOuter: "rgba(64,192,255,0.10)",
  },
  // Space Bundle — rockets & satellite signals (web ``SpaceGrid``). Emoji
  // glyphs render in their own colors (piece tint does not apply).
  space_grid: {
    id: "space_grid",
    boardBg: "#050818",
    boardLine: "rgba(0,217,255,0.4)",
    cellBg: "#0A1228",
    cellBorder: "rgba(0,217,255,0.22)",
    accent: "#00D9FF",
    p1Color: "#00DDFF",
    p2Color: "#FF8C00",
    pieceGlow: "rgba(0,217,255,0.8)",
    p1Glyph: "🚀",
    p2Glyph: "🛰",
    atmosphereInner: "rgba(0,217,255,0.14)",
    atmosphereOuter: "rgba(255,140,0,0.08)",
  },
  // Pixel Bundle — 8-bit CRT dither glow (web ``PixelGrid``).
  pixel_grid: {
    id: "pixel_grid",
    boardBg: "#140700",
    boardLine: "rgba(255,85,0,0.5)",
    cellBg: "#0B0300",
    cellBorder: "rgba(255,140,0,0.38)",
    accent: "#FFDD00",
    p1Color: "#FFDD00",
    p2Color: "#FF4455",
    pieceGlow: "rgba(255,221,0,0.8)",
    p1Glyph: "◉",
    p2Glyph: "♥",
    atmosphereInner: "rgba(255,221,0,0.12)",
    atmosphereOuter: "rgba(255,68,85,0.10)",
  },
  // Tokyo Bundle — neon rain & city glow (web ``TokyoGrid``). Web's mathy
  // glyphs swapped for ✦/✧ (the originals tofu in Android system fonts).
  tokyo_grid: {
    id: "tokyo_grid",
    boardBg: "#070012",
    boardLine: "rgba(255,0,102,0.5)",
    cellBg: "#10001E",
    cellBorder: "rgba(0,204,255,0.26)",
    accent: "#FF0066",
    p1Color: "#FF0066",
    p2Color: "#00CCFF",
    pieceGlow: "rgba(255,0,102,0.85)",
    p1Glyph: "✦",
    p2Glyph: "✧",
    atmosphereInner: "rgba(255,0,102,0.16)",
    atmosphereOuter: "rgba(0,204,255,0.12)",
  },
};

/** Skin for an equipped ``board_style`` — null for default/unknown ids. */
export function boardSkinFor(boardStyle: string | null | undefined): BoardSkin | null {
  if (!boardStyle || boardStyle === "default") return null;
  return SKINS[boardStyle] ?? null;
}
