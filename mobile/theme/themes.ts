/**
 * Theme palettes for the mobile app.
 *
 * Mirrors the web definitions in ``frontend/lib/themes.ts`` so an
 * equipped theme reads the same way across surfaces. The mobile token
 * shape (``theme/tokens.ts``) is the superset every screen already
 * consumes; each palette below provides the same keys plus a few
 * board-specific extras (``boardBg`` / ``boardCell`` / ``boardLine`` and
 * the per-theme piece glyphs).
 *
 * ``classic_dark`` is the default and is intentionally identical to the
 * static ``colors`` token map — so screens that haven't migrated to
 * ``useTheme()`` yet stay visually consistent with the default theme.
 *
 * NOTE: only **theme** cosmetics live here (board skins / grids / pieces
 * are deliberately out of scope on mobile — see the bug-fix plan).
 */

import { colors } from "./tokens";

export type ThemeId = "classic_dark" | "classic_light" | "space" | "pixel";

export interface ThemePalette {
  // Surfaces
  bg: string;
  bgElevated: string;
  bgCard: string;
  bgRaised: string;
  // Accent
  accent: string;
  accentHot: string;
  accentDeep: string;
  // Text
  text: string;
  textMuted: string;
  textDim: string;
  textInverse: string;
  // Status
  success: string;
  warn: string;
  danger: string;
  info: string;
  // Pieces (colors)
  p1: string;
  p2: string;
  // Borders / overlays
  border: string;
  borderStrong: string;
  borderAccent: string;
  overlay: string;
  scrim: string;
  // Board surfaces
  boardBg: string;
  boardCell: string;
  boardLine: string;
  // Piece glyphs (per theme — web ``THEMES[id].pieces``)
  glyphP1: string;
  glyphP2: string;
  /** True only for genuine light-mode palettes. */
  isLight: boolean;
}

/** Default — identical to the static ``colors`` token map (mobile blood-red dark). */
const classic_dark: ThemePalette = {
  bg: colors.bg,
  bgElevated: colors.bgElevated,
  bgCard: colors.bgCard,
  bgRaised: colors.bgRaised,
  accent: colors.accent,
  accentHot: colors.accentHot,
  accentDeep: colors.accentDeep,
  text: colors.text,
  textMuted: colors.textMuted,
  textDim: colors.textDim,
  textInverse: colors.textInverse,
  success: colors.success,
  warn: colors.warn,
  danger: colors.danger,
  info: colors.info,
  p1: colors.p1,
  p2: colors.p2,
  border: colors.border,
  borderStrong: colors.borderStrong,
  borderAccent: colors.borderAccent,
  overlay: colors.overlay,
  scrim: colors.scrim,
  boardBg: colors.bgCard,
  boardCell: colors.bgRaised,
  boardLine: colors.border,
  glyphP1: "X",
  glyphP2: "Y",
  isLight: false,
};

/** Warm espresso / amber — mirrors web ``classic_2``. */
const classic_light: ThemePalette = {
  bg: "#1E1410",
  bgElevated: "#261C16",
  bgCard: "#30241E",
  bgRaised: "#3A2C24",
  accent: "#C84C1A",
  accentHot: "#E06030",
  accentDeep: "#8A2E0E",
  text: "#F8EED8",
  textMuted: "#D4B888",
  textDim: "#8A6848",
  textInverse: "#16100C",
  success: "#4AAE58",
  warn: "#D4A020",
  danger: "#E04040",
  info: "#D4A020",
  p1: "#F8EED8",
  p2: "#C84C1A",
  border: "rgba(248,238,216,0.12)",
  borderStrong: "rgba(248,238,216,0.26)",
  borderAccent: "rgba(200,76,26,0.45)",
  overlay: "rgba(0,0,0,0.6)",
  scrim: "rgba(20,10,8,0.85)",
  boardBg: "#16100C",
  boardCell: "#30241E",
  boardLine: "#3A2818",
  glyphP1: "X",
  glyphP2: "Y",
  isLight: false,
};

/** Deep navy space — mirrors web ``space``. */
const space: ThemePalette = {
  bg: "#02040F",
  bgElevated: "#0D1835",
  bgCard: "#101F40",
  bgRaised: "#16294F",
  accent: "#3A78D4",
  accentHot: "#60A8FF",
  accentDeep: "#264F8C",
  text: "#C8E0FF",
  textMuted: "#6898C8",
  textDim: "#304870",
  textInverse: "#04081A",
  success: "#00FF9B",
  warn: "#FFD060",
  danger: "#FF4080",
  info: "#60A8FF",
  p1: "#FFD060",
  p2: "#00E87A",
  border: "rgba(200,224,255,0.12)",
  borderStrong: "rgba(200,224,255,0.26)",
  borderAccent: "rgba(58,120,212,0.5)",
  overlay: "rgba(2,4,15,0.6)",
  scrim: "rgba(2,4,15,0.92)",
  boardBg: "#04081A",
  boardCell: "#0D1835",
  boardLine: "#1A2A52",
  glyphP1: "α",
  glyphP2: "Ω",
  isLight: false,
};

/** Retro pixel forest — mirrors web ``pixel``. */
const pixel: ThemePalette = {
  bg: "#10140B",
  bgElevated: "#181E13",
  bgCard: "#1D2417",
  bgRaised: "#252E1C",
  accent: "#879A77",
  accentHot: "#AFCF94",
  accentDeep: "#5E6E4E",
  text: "#CAEEAC",
  textMuted: "#A8C48C",
  textDim: "#4A6038",
  textInverse: "#0E1209",
  success: "#879A77",
  warn: "#C8D870",
  danger: "#CC4444",
  info: "#AFCF94",
  p1: "#FFE000",
  p2: "#FF50A0",
  border: "rgba(202,238,172,0.12)",
  borderStrong: "rgba(202,238,172,0.26)",
  borderAccent: "rgba(135,154,119,0.5)",
  overlay: "rgba(10,13,7,0.6)",
  scrim: "rgba(10,13,7,0.92)",
  boardBg: "#0E1209",
  boardCell: "#1D2417",
  boardLine: "#3D4D35",
  glyphP1: "⚔",
  glyphP2: "🛡",
  isLight: false,
};

export const THEMES: Record<ThemeId, ThemePalette> = {
  classic_dark,
  classic_light,
  space,
  pixel,
};

export const DEFAULT_THEME_ID: ThemeId = "classic_dark";

const VALID_THEME_IDS = new Set<string>(Object.keys(THEMES));

/** Coerce an arbitrary stored/profile string into a known ThemeId. */
export function normalizeThemeId(id: string | null | undefined): ThemeId {
  if (id && VALID_THEME_IDS.has(id)) return id as ThemeId;
  return DEFAULT_THEME_ID;
}

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
}

/** Display metadata for the collection / store screens. */
export const THEME_META: ThemeMeta[] = [
  { id: "classic_dark", label: "Classic Dark", description: "Default blood-red dark theme." },
  { id: "classic_light", label: "Espresso", description: "Warm espresso & amber palette." },
  { id: "space", label: "Space", description: "Deep navy with neon pieces." },
  { id: "pixel", label: "Pixel", description: "Retro pixel forest palette." },
];
