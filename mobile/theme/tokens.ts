/**
 * Design tokens for the PentaProtocol native app.
 *
 * These are the single source of truth for color, spacing, typography,
 * radius and motion in mobile. Every screen consumes from here — no
 * inline hex codes, no magic numbers. Keeping all primitives here also
 * lets us re-skin the whole app (alternate themes, A/B tests, future
 * "Halloween edition", etc.) by swapping one map instead of grepping
 * through 50 screens.
 *
 * Naming convention follows Tamagui's: tokens are accessed as
 * ``$bg``, ``$accent``, ``$space.4``, ``$size.lg`` etc. in styled
 * components. The raw values are also exported so React Native
 * primitives can read them directly when we deliberately bypass
 * Tamagui (e.g. on perf-critical surfaces or when the user
 * explicitly asks for primitive-only code).
 */

export const colors = {
  // Surfaces — deep void > card > raised. We avoid pure black so OLED
  // dimming doesn't crush the gradient stops; #030303 reads as black
  // against the system UI while still showing the card layers.
  bg: "#030303",
  bgElevated: "#0d0d0d",
  bgCard: "#1a1a1a",
  bgRaised: "#222222",

  // Accent — kept identical to the web blood-red so the brand reads
  // as the same product across surfaces.
  accent: "#CC0000",
  accentHot: "#FF1100",
  accentDeep: "#8B0000",

  // Text — softer than pure white on mobile (held closer to the eye).
  text: "#F2F2F2",
  textMuted: "#9AA0A6",
  textDim: "#6E6E6E",
  textInverse: "#0A0A0A",

  // Status — matches what the backend OTP/validation flows expect on
  // the web side, so error/success copy reads the same way.
  success: "#00C850",
  warn: "#FFB020",
  danger: "#FF4D4D",
  info: "#4DA3FF",

  // Borders & hairlines.
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.22)",
  borderAccent: "rgba(204,0,0,0.4)",

  // Overlays.
  overlay: "rgba(0,0,0,0.55)",
  scrim: "rgba(0,0,0,0.82)",
} as const;

/**
 * 4px base spacing scale. Tamagui consumes these as ``$space.1`` etc.;
 * RN primitives read ``space[3]`` directly.
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
  11: 80,
  12: 96,
} as const;

export const radii = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/**
 * Type scale — mobile-tuned (smaller than web). Each entry pairs a
 * font size with the line-height we use for that size. Display fonts
 * pick up the Cinzel/Courier vibe via fontFamily strings; we load
 * them lazily in ``app/_layout.tsx`` via ``expo-font``.
 */
export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  "2xl": 30,
  "3xl": 38,
  display: 48,
} as const;

export const lineHeights = {
  xs: 16,
  sm: 18,
  base: 22,
  md: 24,
  lg: 28,
  xl: 32,
  "2xl": 38,
  "3xl": 46,
  display: 54,
} as const;

export const fonts = {
  // System fonts ship with zero asset overhead and remove the
  // first-render flash you get when waiting for a remote font. We
  // can swap to Cinzel/Courier via expo-font later for the display
  // headline only — body remains system for legibility.
  display: "System",
  body: "System",
  mono: "Menlo",
} as const;

/**
 * Motion — reanimated reads these for shared timing constants.
 * Keeping them small + named avoids the "every screen picks a
 * different animation duration" drift that web `framer-motion`
 * sites usually develop.
 */
export const motion = {
  duration: {
    instant: 80,
    fast: 160,
    base: 220,
    slow: 360,
  },
  easing: {
    standard: [0.22, 0.68, 0, 1.2] as const,
    decelerate: [0.0, 0.0, 0.2, 1] as const,
    accelerate: [0.4, 0.0, 1, 1] as const,
  },
} as const;

export type ColorToken = keyof typeof colors;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radii;
export type FontSizeToken = keyof typeof fontSizes;
