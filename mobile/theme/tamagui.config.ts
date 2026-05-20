/**
 * Minimal Tamagui config wired to our design tokens.
 *
 * We start from ``@tamagui/config/v3`` (the official baseline) and
 * override only the surfaces we actually own: colors, space, size,
 * radius. Tamagui's optimizing compiler (the babel plugin) does its
 * static analysis against the keys defined here — keeping the
 * override list small means faster cold starts and smaller bundles.
 *
 * Screens never import this file directly. They import
 * ``createTamagui`` typing through the ``tamagui.d.ts`` augmentation
 * at the bottom, which gives autocomplete on token names without
 * dragging the whole config into the bundle on every screen.
 */

import { createTamagui, createTokens } from "tamagui";
import { config as baseConfig } from "@tamagui/config/v3";

import { colors, radii, space } from "./tokens";

const tokens = createTokens({
  color: {
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
    border: colors.border,
    borderStrong: colors.borderStrong,
    borderAccent: colors.borderAccent,
    overlay: colors.overlay,
    scrim: colors.scrim,
  },
  space: {
    0: space[0],
    1: space[1],
    2: space[2],
    3: space[3],
    4: space[4],
    5: space[5],
    6: space[6],
    7: space[7],
    8: space[8],
    9: space[9],
    10: space[10],
    11: space[11],
    12: space[12],
    true: space[3],
  },
  size: {
    0: space[0],
    1: space[1],
    2: space[2],
    3: space[3],
    4: space[4],
    5: space[5],
    6: space[6],
    7: space[7],
    8: space[8],
    9: space[9],
    10: space[10],
    11: space[11],
    12: space[12],
    true: space[3],
  },
  radius: {
    0: radii.none,
    1: radii.xs,
    2: radii.sm,
    3: radii.md,
    4: radii.lg,
    5: radii.xl,
    pill: radii.pill,
    true: radii.md,
  },
  zIndex: {
    0: 0,
    1: 10,
    2: 100,
    3: 1000,
    4: 10000,
  },
});

export const tamaguiConfig = createTamagui({
  ...baseConfig,
  tokens,
  themes: {
    dark: {
      background: colors.bg,
      color: colors.text,
      borderColor: colors.border,
    },
    // Only ship the dark theme on v1 — the brand identity assumes a
    // dark surface. Light theme can come post-launch if we hear
    // requests.
  },
  defaultTheme: "dark",
});

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default tamaguiConfig;
