/**
 * Typography presets.
 *
 * Every text node in the app should pick one of these — no
 * inline ``fontSize={18}`` calls. That guarantees:
 *   - One place to retune the scale globally (e.g. when we add a
 *     "large text" accessibility mode).
 *   - Consistent line-heights paired with sizes (so two
 *     headings always sit at the same rhythm).
 *   - A clear semantic vocabulary in code: a "Heading" is a
 *     Heading whether it's on Home or Profile, instead of
 *     fifteen lookalike text blocks scattered across screens.
 *
 * The presets:
 *   - ``Display``  — hero number / wordmark (48 pt)
 *   - ``Title``    — top-of-screen page title (30 pt)
 *   - ``Heading``  — section heading (24 pt)
 *   - ``Subheading`` — small section heading (20 pt)
 *   - ``Body``     — default paragraph (15 pt)
 *   - ``Caption``  — secondary text under a label (13 pt)
 *   - ``Eyebrow``  — uppercase mini-label above a section (11 pt)
 *   - ``Mono``     — fixed-width text for IDs / codes
 *
 * Each preset accepts the full RN ``TextProps`` so callers can
 * still tune ``numberOfLines``, ``onPress``, etc.
 */

import { type ReactNode } from "react";
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { fontSizes, lineHeights } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

type Tone =
  | "default"
  | "muted"
  | "dim"
  | "accent"
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "inverse";

/** Resolve a tone to a color from the *active* theme palette (reskins live). */
function toneColor(p: ThemePalette, tone: Tone): string {
  switch (tone) {
    case "muted": return p.textMuted;
    case "dim": return p.textDim;
    case "accent": return p.accent;
    case "success": return p.success;
    case "warn": return p.warn;
    case "danger": return p.danger;
    case "info": return p.info;
    case "inverse": return p.textInverse;
    default: return p.text;
  }
}

interface BaseProps extends Omit<RNTextProps, "children" | "style"> {
  children?: ReactNode;
  tone?: Tone;
  /** Center-align the text horizontally. */
  center?: boolean;
  /** Inline style escape hatch. */
  style?: TextStyle;
}

/**
 * @param displayFont  When true, the preset wears the active theme's
 *   display typeface (``palette.fontDisplay`` — Cinzel / Orbitron /
 *   PentaPixel). Used for titles / headings / eyebrows. Body-tier
 *   presets pass false so paragraph copy stays on the system font.
 */
function makePreset(preset: TextStyle, displayName: string, displayFont = false) {
  const Component = ({ children, tone = "default", center, style, ...rest }: BaseProps) => {
    const palette = usePalette();
    const composed: TextStyle = {
      ...preset,
      color: toneColor(palette, tone),
      ...(displayFont ? { fontFamily: palette.fontDisplay } : null),
      ...(center ? { textAlign: "center" } : null),
      ...(style ?? {}),
    };
    return (
      <RNText {...rest} style={composed}>
        {children}
      </RNText>
    );
  };
  Component.displayName = displayName;
  return Component;
}

export const Display = makePreset(
  {
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
    fontWeight: "900",
    letterSpacing: 1,
  },
  "Display",
  true,
);

export const Title = makePreset(
  {
    fontSize: fontSizes["2xl"],
    lineHeight: lineHeights["2xl"],
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  "Title",
  true,
);

export const Heading = makePreset(
  {
    fontSize: fontSizes.xl,
    lineHeight: lineHeights.xl,
    fontWeight: "800",
    letterSpacing: 0.25,
  },
  "Heading",
  true,
);

export const Subheading = makePreset(
  {
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  "Subheading",
  true,
);

export const Body = makePreset(
  {
    fontSize: fontSizes.base,
    lineHeight: lineHeights.base,
    fontWeight: "400",
  },
  "Body",
);

export const Caption = makePreset(
  {
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: "400",
  },
  "Caption",
);

export const Eyebrow = makePreset(
  {
    fontSize: fontSizes.xs,
    lineHeight: lineHeights.xs,
    fontWeight: "700",
    letterSpacing: 2.4,
    textTransform: "uppercase",
  },
  "Eyebrow",
  true,
);

export const Mono = makePreset(
  StyleSheet.flatten({
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
    fontWeight: "400",
    fontFamily: "Menlo",
  }),
  "Mono",
);
