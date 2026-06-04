/**
 * ``<Wordmark />`` — the PENTA·PROTOCOL brand lockup.
 *
 * Ported from the web brand row (``frontend/components/HomeScreen.tsx``):
 * ``PENTA`` in the text color + ``PROTOCOL`` in the accent, both in the
 * active theme's display font with wide tracking. Centralising it here
 * keeps the wordmark identical on Home, auth, and profile headers and
 * makes it reskin with the theme automatically.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { usePalette } from "@/theme/ThemeProvider";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 16, md: 20, lg: 28 };
const TRACKING: Record<Size, number> = { sm: 2.5, md: 3, lg: 4 };

export interface WordmarkProps {
  size?: Size;
  style?: StyleProp<ViewStyle>;
}

export function Wordmark({ size = "md", style }: WordmarkProps) {
  const p = usePalette();
  const base = {
    fontSize: SIZE_PX[size],
    letterSpacing: TRACKING[size],
    fontFamily: p.fontDisplay,
    fontWeight: "900" as const,
  };
  return (
    <View style={[styles.row, style]} accessibilityLabel="PentaProtocol" accessibilityRole="header">
      <Text style={[base, { color: p.text }]}>PENTA</Text>
      <Text style={[base, { color: p.accent }]}>PROTOCOL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: 6 },
});
