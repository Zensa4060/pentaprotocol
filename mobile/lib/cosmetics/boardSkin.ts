/**
 * Board grid skins — the ``board_style`` cosmetic equipped from the
 * Collection (store grid bundles). Applied in ``BoardGrid``.
 *
 * Currently ONLY ``glacier_grid`` is implemented (rendered 1:1 from the web
 * via a WebView canvas + SVG pieces). Every other ``board_style`` resolves to
 * ``null`` here, so those boards fall back to the plain theme board — i.e. all
 * other grid skins are intentionally removed from the game for now. The
 * remaining 13 get re-added here as each is ported.
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
  // Glacier Bundle — aurora-lit arctic grid + glacier shard pieces. Rendered
  // via the verbatim web GlacierGrid canvas (WebView) + SVG snowflake/shard.
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
  // Matrix Bundle — falling code rain + glowing green grid, code-bracket &
  // binary-pill pieces. Rendered via the verbatim web MatrixGrid canvas.
  matrix_grid: {
    id: "matrix_grid",
    boardBg: "#000800",
    boardLine: "rgba(0,255,65,0.45)",
    cellBg: "#02160A",
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
  // Inferno Bundle — molten-ember board + flame / skull pieces. Rendered via
  // the verbatim web RedGrid backdrop (embers + diagonal heat wash).
  red_grid: {
    id: "red_grid",
    boardBg: "#140300",
    boardLine: "rgba(255,50,0,0.30)",
    cellBg: "rgba(255,50,0,0.02)",
    cellBorder: "rgba(255,50,0,0.12)",
    accent: "#FF6633",
    p1Color: "#FF7722",
    p2Color: "#CC0000",
    pieceGlow: "rgba(255,90,0,0.85)",
    p1Glyph: "🔥",
    p2Glyph: "☠",
    atmosphereInner: "rgba(255,90,0,0.12)",
    atmosphereOuter: "rgba(204,0,0,0.08)",
  },
  // Synthwave Bundle — retro sunset, neon skyline + perspective grid, with
  // retro-sun / neon-palm pieces. Rendered via the verbatim web SynthwaveGrid.
  synthwave_grid: {
    id: "synthwave_grid",
    boardBg: "#1A004A",
    boardLine: "rgba(255,0,180,0.40)",
    cellBg: "rgba(40,0,60,0.30)",
    cellBorder: "rgba(255,0,180,0.18)",
    accent: "#FF00B4",
    p1Color: "#FF2DB4",
    p2Color: "#00DCFF",
    pieceGlow: "rgba(255,0,200,0.85)",
    p1Glyph: "◎",
    p2Glyph: "⩘",
    atmosphereInner: "rgba(255,0,180,0.14)",
    atmosphereOuter: "rgba(0,200,255,0.08)",
  },
  // Bloodmoon Bundle — eclipse-red moon, blood drips + flickering crimson/violet
  // grid, with pentagram & evil-eye pieces. Verbatim web BloodMoonGrid canvas.
  bloodmoon_grid: {
    id: "bloodmoon_grid",
    boardBg: "#0A0204",
    boardLine: "rgba(220,38,38,0.40)",
    cellBg: "rgba(40,0,8,0.30)",
    cellBorder: "rgba(220,38,38,0.20)",
    accent: "#DC2626",
    p1Color: "#DC2626",
    p2Color: "#7C3AED",
    pieceGlow: "rgba(220,38,38,0.85)",
    p1Glyph: "⛧",
    p2Glyph: "◉",
    atmosphereInner: "rgba(220,38,38,0.14)",
    atmosphereOuter: "rgba(124,58,237,0.10)",
  },
  // Egypt Bundle — moonlit dunes, pyramids + hieroglyph grid lines, with ankh
  // & eye-of-Ra pieces. Verbatim web EgyptGrid canvas.
  egypt_grid: {
    id: "egypt_grid",
    boardBg: "#080400",
    boardLine: "rgba(245,158,11,0.40)",
    cellBg: "rgba(40,24,0,0.30)",
    cellBorder: "rgba(245,158,11,0.20)",
    accent: "#F59E0B",
    p1Color: "#FBBF24",
    p2Color: "#C084FC",
    pieceGlow: "rgba(245,158,11,0.85)",
    p1Glyph: "☥",
    p2Glyph: "𓂀",
    atmosphereInner: "rgba(245,158,11,0.14)",
    atmosphereOuter: "rgba(168,85,247,0.10)",
  },
  // Arcane Bundle — violet mist, rotating magic circles + rune grid, with
  // rune-portal & gold-sigil pieces. Verbatim web ArcaneGrid canvas.
  arcane_grid: {
    id: "arcane_grid",
    boardBg: "#08000F",
    boardLine: "rgba(168,85,247,0.40)",
    cellBg: "rgba(24,0,40,0.30)",
    cellBorder: "rgba(168,85,247,0.20)",
    accent: "#A855F7",
    p1Color: "#CC88FF",
    p2Color: "#FFDD60",
    pieceGlow: "rgba(168,85,247,0.85)",
    p1Glyph: "◉",
    p2Glyph: "✶",
    atmosphereInner: "rgba(168,85,247,0.14)",
    atmosphereOuter: "rgba(255,180,0,0.10)",
  },
  // Bio Bundle — bioluminescent abyss: drifting jelly-creatures, tendrils +
  // teal/violet grid, with jellyfish & anglerfish pieces. Verbatim web BioGrid.
  bio_grid: {
    id: "bio_grid",
    boardBg: "#000A0F",
    boardLine: "rgba(0,255,200,0.40)",
    cellBg: "rgba(0,30,28,0.30)",
    cellBorder: "rgba(0,255,200,0.20)",
    accent: "#00FFD0",
    p1Color: "#00FFCC",
    p2Color: "#B464FF",
    pieceGlow: "rgba(0,255,200,0.85)",
    p1Glyph: "✺",
    p2Glyph: "◑",
    atmosphereInner: "rgba(0,255,200,0.14)",
    atmosphereOuter: "rgba(140,0,255,0.10)",
  },
  // Forge Bundle — molten pools, ember rain + heat-glowing grid, with hammer
  // & molten-sigil pieces. Verbatim web ForgeGrid canvas.
  forge_grid: {
    id: "forge_grid",
    boardBg: "#0A0200",
    boardLine: "rgba(255,102,0,0.40)",
    cellBg: "rgba(40,12,0,0.30)",
    cellBorder: "rgba(255,102,0,0.20)",
    accent: "#FF6600",
    p1Color: "#FF7722",
    p2Color: "#FFAA00",
    pieceGlow: "rgba(255,90,0,0.85)",
    p1Glyph: "⚒",
    p2Glyph: "✷",
    atmosphereInner: "rgba(255,90,0,0.14)",
    atmosphereOuter: "rgba(255,160,0,0.10)",
  },
  // Void Bundle — deep-space nebulae, white-hole pulse + star grid, with
  // pulsar & quasar pieces. Verbatim web VoidGrid canvas.
  void_grid: {
    id: "void_grid",
    boardBg: "#02011A",
    boardLine: "rgba(139,92,246,0.40)",
    cellBg: "rgba(20,8,40,0.30)",
    cellBorder: "rgba(139,92,246,0.20)",
    accent: "#8B5CF6",
    p1Color: "#B464FF",
    p2Color: "#40C0FF",
    pieceGlow: "rgba(140,60,255,0.85)",
    p1Glyph: "✶",
    p2Glyph: "◈",
    atmosphereInner: "rgba(139,92,246,0.14)",
    atmosphereOuter: "rgba(0,160,255,0.10)",
  },
  // Space Bundle — planets, asteroids, meteors + cyan/amber HUD grid, with
  // rocket & satellite pieces. Verbatim web SpaceGrid canvas.
  space_grid: {
    id: "space_grid",
    boardBg: "#030610",
    boardLine: "rgba(0,200,255,0.40)",
    cellBg: "rgba(0,20,40,0.30)",
    cellBorder: "rgba(0,150,255,0.20)",
    accent: "#00D9FF",
    p1Color: "#00DDFF",
    p2Color: "#FF9922",
    pieceGlow: "rgba(0,200,255,0.85)",
    p1Glyph: "▲",
    p2Glyph: "⬡",
    atmosphereInner: "rgba(0,200,255,0.14)",
    atmosphereOuter: "rgba(255,120,0,0.10)",
  },
  // Pixel Bundle — 8-bit CRT: dithered tiles, drifting sprites + blocky neon
  // grid, with pixel-coin & pixel-heart pieces. Verbatim web PixelGrid canvas.
  pixel_grid: {
    id: "pixel_grid",
    boardBg: "#0A0A18",
    boardLine: "rgba(255,221,0,0.40)",
    cellBg: "rgba(20,20,40,0.30)",
    cellBorder: "rgba(255,140,0,0.22)",
    accent: "#FFDD00",
    p1Color: "#FFD700",
    p2Color: "#FF4455",
    pieceGlow: "rgba(255,200,0,0.85)",
    p1Glyph: "$",
    p2Glyph: "♥",
    atmosphereInner: "rgba(255,221,0,0.12)",
    atmosphereOuter: "rgba(255,68,85,0.10)",
  },
  // Tokyo Bundle — rainy neon city: billboards, downpour + rainbow grid, with
  // dragon-seal & katana pieces. Verbatim web TokyoGrid canvas.
  tokyo_grid: {
    id: "tokyo_grid",
    boardBg: "#050010",
    boardLine: "rgba(255,0,102,0.40)",
    cellBg: "rgba(30,0,30,0.30)",
    cellBorder: "rgba(255,0,102,0.20)",
    accent: "#FF0066",
    p1Color: "#FF0066",
    p2Color: "#00CCFF",
    pieceGlow: "rgba(255,0,102,0.85)",
    p1Glyph: "✶",
    p2Glyph: "+",
    atmosphereInner: "rgba(255,0,102,0.14)",
    atmosphereOuter: "rgba(0,200,255,0.10)",
  },
};

/** Skin for an equipped ``board_style`` — null for default/unknown/removed ids. */
export function boardSkinFor(boardStyle: string | null | undefined): BoardSkin | null {
  if (!boardStyle || boardStyle === "default") return null;
  return SKINS[boardStyle] ?? null;
}
