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

import { colors, radii, space } from "@/theme/tokens";

type Variant = "surface" | "raised" | "accent" | "ghost";
type Padding = "none" | "sm" | "md" | "lg";
type Tone = null | "success" | "warn" | "danger" | "info" | "accent";

export interface CardProps {
  children: ReactNode;
  variant?: Variant;
  padding?: Padding;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<Variant, ViewStyle> = {
  surface: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
    borderWidth: 1,
  },
  raised: {
    backgroundColor: colors.bgRaised,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  accent: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderAccent,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: colors.border,
    borderWidth: 1,
  },
};

const PADDING_VALUES: Record<Padding, number> = {
  none: 0,
  sm: space[3],
  md: space[4],
  lg: space[5],
};

const TONE_BAR: Record<Exclude<Tone, null>, string> = {
  success: colors.success,
  warn: colors.warn,
  danger: colors.danger,
  info: colors.info,
  accent: colors.accent,
};

export function Card({
  children,
  variant = "surface",
  padding = "md",
  tone = null,
  style,
}: CardProps) {
  const base: ViewStyle = {
    ...VARIANT_STYLES[variant],
    borderRadius: radii.lg,
    padding: PADDING_VALUES[padding],
    overflow: "hidden",
  };

  if (!tone) {
    return <View style={[base, style]}>{children}</View>;
  }

  // Tone bar mode: wrap with an outer container that hosts the
  // 3px colored stripe on the left. We pad the inner content to
  // restore the visual gutter that the stripe steals.
  return (
    <View style={[styles.toneWrap, base, { padding: 0 }, style]}>
      <View style={[styles.toneBar, { backgroundColor: TONE_BAR[tone] }]} />
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
