/**
 * ``<Avatar />`` — circular profile image with fallback initials.
 *
 * Used by the home identity card and (later) the friends list,
 * leaderboard rows, and chat bubbles. Falls back to the first
 * letter of the username on the brand background — handles the
 * common case where the user hasn't uploaded a photo without
 * exploding the UI.
 *
 * Size is a token-named choice rather than a free number so we
 * keep avatars consistent across screens.
 */

import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, fontSizes, radii } from "@/theme/tokens";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  sm: 32,
  md: 44,
  lg: 64,
  xl: 96,
};

const INITIAL_FONT: Record<Size, number> = {
  sm: fontSizes.sm,
  md: fontSizes.md,
  lg: fontSizes.xl,
  xl: fontSizes["2xl"],
};

export interface AvatarProps {
  /** Public URL of the avatar image, or null/undefined for fallback. */
  uri?: string | null;
  /** Username/email — first letter used as the fallback glyph. */
  name?: string | null;
  size?: Size;
  /** Outline the avatar with the accent color (e.g. for current player). */
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ uri, name, size = "md", highlighted = false, style }: AvatarProps) {
  const dim = SIZE_PX[size];
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      width: dim,
      height: dim,
      borderRadius: radii.pill,
      borderWidth: highlighted ? 2 : 1,
      borderColor: highlighted ? colors.accent : colors.border,
    },
    style,
  ];

  if (uri) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={[styles.initial, { fontSize: INITIAL_FONT[size] }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.bgRaised,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  initial: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
