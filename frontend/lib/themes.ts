export type ThemeId = "classic_light" | "classic_dark" | "space" | "pixel" | "custom";

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
}> = {

  classic_light: {
    bg: "#F4F4F4", bgPanel: "#E8E8E8", bgCard: "#DEDEDE",
    border: "#BBBBBB", borderAccent: "#555555",
    text: "#111111", textSecondary: "#444444", textMuted: "#888888",
    accent: "#333333", accentGlow: "#666666",
    p1: "#111111", p2: "#8B0000",
    danger: "#555555", success: "#444444",
    gold: "#999999", boardBg: "#D8D8D8", boardLine: "#AAAAAA",
    navBg: "rgba(244,244,244,0.96)", inputBg: "#E4E4E4", overlay: "rgba(0,0,0,0.72)",
    fontDisplay: "'GuildOf', serif",
    fontBody: "'GuildOf', serif",
    fontMono: "'GuildOf', serif",
    pieces: { p1: "X", p2: "Y" },
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
    fontDisplay: "'GuildOf', serif",
    fontBody: "'GuildOf', serif",
    fontMono: "'GuildOf', serif",
    pieces: { p1: "X", p2: "Y" },
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
    // Same type stack as Classic (GuildOf); Space differs by palette only.
    fontDisplay: "'GuildOf', serif",
    fontBody: "'GuildOf', serif",
    fontMono: "'GuildOf', serif",
    pieces: { p1: "α", p2: "Ω" },
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
    // PixPixls ships with empty glyphs for several ASCII punctuation
    // marks (`+`, `-`, `>`, `(`, etc.), so we layer 'VT323' (loaded
    // via the global @import in AppShell) right after it. Combined
    // with the `unicode-range` constraint on PixPixls's @font-face
    // in `app/globals.css`, this makes missing glyphs fall through
    // to VT323 — which has the full ASCII set and the same retro
    // pixel feel — instead of rendering as invisible blanks.
    fontDisplay: "'PixPixls', 'VT323', monospace",
    fontBody: "'PixPixls', 'VT323', monospace",
    fontMono: "'PixPixls', 'VT323', monospace",
    pieces: { p1: "⚔", p2: "🛡" },
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
  },
};