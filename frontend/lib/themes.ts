export type ThemeId = "classic_light" | "classic_dark" | "space" | "pixel" | "custom";

export type Theme = (typeof THEMES)[ThemeId];

export const THEMES: Record<ThemeId, {
  bg: string; bgPanel: string; bgCard: string;
  border: string; borderAccent: string;
  text: string; textSecondary: string; textMuted: string;
  accent: string; accentGlow: string;
  p1: string; p2: string; danger: string; success: string;
  gold: string; boardBg: string; boardLine: string;
  navBg: string; inputBg: string; overlay: string;
  fontDisplay: string; fontBody: string; fontMono: string;
  pieces: { p1: string; p2: string };
  /**
   * `true` only for "true light-mode" palettes (classic_light). Used by
   * components to flip hardcoded dark backgrounds / shadows into light-
   * theme equivalents without needing the full ThemeId enum threaded
   * through. Defaults to `false` so existing dark/space/pixel/custom
   * themes are unaffected.
   */
  isLight: boolean;
}> = {

  // ── Classic Light — Deep Linen palette.
  // bg is a genuine warm tan/burlap — clearly NOT white.
  // bgCard is light cream — floats ~40 lightness units above bg.
  // That contrast gives cards real visual depth without any dark tones.
  // Deep wine-red accent ties to the game brand.
  // All text tokens verified ≥ 4.5:1 on bgCard surface.
  classic_light: {
    bg:            "#C4B8A0",  // warm burlap/tan — unmistakably coloured
    bgPanel:       "#D8CEBC",  // mid-linen panel — sits between bg and card
    bgCard:        "#F6EED8",  // parchment cream — clearly floats above bg
    border:        "#AEA488",  // warm tan border, visible but not harsh
    borderAccent:  "#8B1E1E",  // deep wine red
    text:          "#1C1408",  // very dark brown-black ~13:1 on card ✓
    textSecondary: "#3A2A18",  // warm dark brown ~7.5:1 on card ✓
    textMuted:     "#6A5640",  // medium warm brown ~4.8:1 on card ✓ AA
    accent:        "#8B1E1E",  // deep wine red
    accentGlow:    "#A82828",  // brighter wine for glows / hover
    p1: "#1C1408", p2: "#8B1E1E",
    danger: "#8B1010", success: "#2A5A30",
    gold: "#8A6E18",           // antique gold — beautiful on parchment
    boardBg: "#BEB49C", boardLine: "#A69E88",
    navBg: "rgba(196,184,160,0.97)",  // matches bg exactly
    inputBg: "#BEB49C", overlay: "rgba(0,0,0,0.38)",
    fontDisplay: "'Cinzel', 'GuildOf', serif",
    fontBody:    "'Cinzel', 'GuildOf', serif",
    fontMono:    "'Cinzel', serif",
    pieces: { p1: "X", p2: "Y" },
    isLight: true,
  },

  classic_dark: {
    bg: "#0A0A0A", bgPanel: "#141414", bgCard: "#1C1C1C",
    border: "#2E2E2E", borderAccent: "#888888",
    text: "#F0F0F0", textSecondary: "#AAAAAA", textMuted: "#555555",
    accent: "#CCCCCC", accentGlow: "#EEEEEE",
    p1: "#FFFFFF", p2: "#CC0000",
    danger: "#AAAAAA", success: "#CCCCCC",
    gold: "#BBBBBB", boardBg: "#111111", boardLine: "#3a3a3a",
    navBg: "rgba(10,10,10,0.96)", inputBg: "#111111", overlay: "rgba(0,0,0,0.90)",
    // Cinzel: classical Roman-inspired serif, refined and readable on dark backgrounds.
    fontDisplay: "'Cinzel', 'GuildOf', serif",
    fontBody: "'Cinzel', 'GuildOf', serif",
    fontMono: "'Cinzel', serif",
    pieces: { p1: "X", p2: "Y" },
    isLight: false,
  },

  space: {
    bg: "#02040F", bgPanel: "#0D1835", bgCard: "#101F40",
    border: "#1E3060", borderAccent: "#3A78D4",
    text: "#C8E0FF", textSecondary: "#6898C8", textMuted: "#304870",
    accent: "#3A78D4", accentGlow: "#60A8FF",
    p1: "#FFD060", p2: "#00E87A",
    danger: "#FF4080", success: "#00FF9B",
    gold: "#FFD060", boardBg: "#04081A", boardLine: "#1a2a52",
    navBg: "rgba(2,4,15,0.96)", inputBg: "#04081A", overlay: "rgba(2,4,15,0.94)",
    // Orbitron: geometric space font, locally hosted, perfectly matches this theme.
    fontDisplay: "'Orbitron', 'GuildOf', sans-serif",
    fontBody: "'Orbitron', 'GuildOf', sans-serif",
    fontMono: "'Orbitron', monospace",
    pieces: { p1: "α", p2: "Ω" },
    isLight: false,
  },

  pixel: {
    bg: "#10140B", bgPanel: "#181E13", bgCard: "#1D2417",
    border: "#2F3A23", borderAccent: "#879A77",
    text: "#CAEEAC", textSecondary: "#A8C48C", textMuted: "#4A6038",
    accent: "#879A77", accentGlow: "#AFCF94",
    p1: "#FFE000", p2: "#FF50A0",
    danger: "#CC4444", success: "#879A77",
    gold: "#C8D870", boardBg: "#0E1209", boardLine: "#3d4d35",
    navBg: "rgba(16,20,11,0.97)", inputBg: "#0E1209", overlay: "rgba(10,13,7,0.95)",
    // PentaPixel: custom 5×7 dot-matrix font with full ASCII coverage,
    // designed to match the pixel-art theme. No fallback needed.
    fontDisplay: "'PentaPixel', monospace",
    fontBody: "'PentaPixel', monospace",
    fontMono: "'PentaPixel', monospace",
    pieces: { p1: "⚔", p2: "🛡" },
    isLight: false,
  },

  custom: {
    bg: "#0A0A0A", bgPanel: "#141414", bgCard: "#1C1C1C",
    border: "#2E2E2E", borderAccent: "#888888",
    text: "#F0F0F0", textSecondary: "#AAAAAA", textMuted: "#555555",
    accent: "#CCCCCC", accentGlow: "#EEEEEE",
    p1: "#FFFFFF", p2: "#CC0000",
    danger: "#AAAAAA", success: "#CCCCCC",
    gold: "#BBBBBB", boardBg: "#111111", boardLine: "#3a3a3a",
    navBg: "rgba(10,10,10,0.96)", inputBg: "#111111", overlay: "rgba(0,0,0,0.90)",
    fontDisplay: "'GuildOf', serif",
    fontBody: "'GuildOf', serif",
    fontMono: "'GuildOf', serif",
    pieces: { p1: "X", p2: "Y" },
    isLight: false,
  },
};