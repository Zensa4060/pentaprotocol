/**
 * ``<Wordmark />`` — the PENTA·PROTOCOL brand lockup.
 *
 * Ported from the web brand row (``frontend/components/HomeScreen.tsx``):
 * the active theme's display font with wide tracking, centralised here so
 * the wordmark is identical on Home, auth, and profile headers and reskins
 * with the theme automatically.
 *
 * On the two **classic** themes (dark + espresso) we mirror the web title
 * exactly — a bright white ``PENTA`` and a blood-red ``PROTOCOL``, each with
 * a soft glow (the web ``drop-shadow`` lockup). Other themes (space / pixel)
 * keep their theme-reactive ``text`` / ``accent`` colors.
 */

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 16, md: 20, lg: 28 };
const TRACKING: Record<Size, number> = { sm: 2.5, md: 3, lg: 4 };

export interface WordmarkProps {
  size?: Size;
  style?: StyleProp<ViewStyle>;
}

export function Wordmark({ size = "md", style }: WordmarkProps) {
  const { themeId, theme: p } = useTheme();
  const isClassic = themeId === "classic_dark" || themeId === "classic_light";

  const base = {
    fontSize: SIZE_PX[size],
    letterSpacing: TRACKING[size],
    fontFamily: p.fontDisplay,
    fontWeight: "900" as const,
  };

  // Classic themes mirror the web title's white/red lockup + glow; other
  // themes stay theme-reactive (e.g. space's neon blue).
  const pentaColor = isClassic ? "#FFFFFF" : p.text;
  const protocolColor = isClassic ? "#FF2200" : p.accent;
  const pentaGlow = isClassic
    ? { textShadowColor: "rgba(255,255,255,0.45)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
    : null;
  const protocolGlow = isClassic
    ? { textShadowColor: "rgba(255,30,0,0.7)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }
    : null;

  return (
    <View style={[styles.row, style]} accessibilityLabel="PentaProtocol" accessibilityRole="header">
      <Text style={[base, { color: pentaColor }, pentaGlow]}>PENTA</Text>
      <Text style={[base, { color: protocolColor }, protocolGlow]}>PROTOCOL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "baseline", gap: 6 },
});
