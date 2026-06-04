/**
 * ``<Card />`` — bordered, padded surface.
 *
 * The base building block for every grouped piece of content on
 * the app (stats blocks, mode tiles, profile rows). Variants
 * change the *vibe* of the card without you having to remember
 * five hex codes:
 *
 *   - ``surface``  — default: bgCard + soft border (sits on bg).
 *   - ``raised``   — bgRaised + sharper border (sits on top of another card).
 *   - ``accent``   — bgCard + blood-red accent border (CTA / featured).
 *   - ``ghost``    — fully transparent + border only.
 *
 * Tones add a thin colored side-bar on the left for status cues
 * (success/warn/danger/info). Off by default.
 */

import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

type Variant = "surface" | "raised" | "accent" | "ghost";
type Padding = "none" | "sm" | "md" | "lg";
type Tone = null | "success" | "warn" | "danger" | "info" | "accent";

export interface CardProps {
  children: ReactNode;
  variant?: Variant;
  padding?: Padding;
  tone?: Tone;
  /** Add a soft accent glow (used for featured / CTA cards). Auto-on for the ``accent`` variant. */
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Variant surface/border built from the *active* theme palette. */
function variantStyle(p: ThemePalette, variant: Variant): ViewStyle {
  switch (variant) {
    case "raised":
      return { backgroundColor: p.bgRaised, borderColor: p.borderStrong, borderWidth: 1 };
    case "accent":
      return { backgroundColor: p.bgCard, borderColor: p.borderAccent, borderWidth: 1 };
    case "ghost":
      return { backgroundColor: "transparent", borderColor: p.border, borderWidth: 1 };
    default:
      return { backgroundColor: p.bgCard, borderColor: p.border, borderWidth: 1 };
  }
}

function toneBarColor(p: ThemePalette, tone: Exclude<Tone, null>): string {
  switch (tone) {
    case "success": return p.success;
    case "warn": return p.warn;
    case "danger": return p.danger;
    case "info": return p.info;
    default: return p.accent;
  }
}

const PADDING_VALUES: Record<Padding, number> = {
  none: 0,
  sm: space[3],
  md: space[4],
  lg: space[5],
};

export function Card({
  children,
  variant = "surface",
  padding = "md",
  tone = null,
  glow,
  style,
}: CardProps) {
  const palette = usePalette();
  const showGlow = glow ?? variant === "accent";

  const base: ViewStyle = {
    ...variantStyle(palette, variant),
    borderRadius: radii.lg,
    padding: PADDING_VALUES[padding],
    overflow: "hidden",
    ...(showGlow
      ? {
          // Cheap native glow — no blur layers. iOS reads the shadow*,
          // Android reads elevation; we tint the Android shadow too.
          shadowColor: palette.accent,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        }
      : null),
  };

  if (!tone) {
    return <View style={[base, style]}>{children}</View>;
  }

  // Tone bar mode: wrap with an outer container that hosts the
  // 3px colored stripe on the left. We pad the inner content to
  // restore the visual gutter that the stripe steals.
  // ``overflow: hidden`` clips the glow, so drop it in tone-bar mode.
  return (
    <View style={[styles.toneWrap, base, { padding: 0 }, style]}>
      <View style={[styles.toneBar, { backgroundColor: toneBarColor(palette, tone) }]} />
      <View style={{ padding: PADDING_VALUES[padding], flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  toneWrap: {
    flexDirection: "row",
  },
  toneBar: {
    width: 3,
  },
});
