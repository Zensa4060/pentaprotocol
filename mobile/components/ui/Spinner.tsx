/**
 * ``<Spinner />`` — themed wrapper around RN's ``ActivityIndicator``.
 *
 * Why even bother wrapping it? Two reasons:
 *   - One import path for "loading affordance" across the app.
 *   - Single place to swap to a custom Reanimated/SVG spinner
 *     later (when the design team gives us a branded one) without
 *     touching 30 callsites.
 */

import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";

import { usePalette } from "@/theme/ThemeProvider";

export interface SpinnerProps extends Omit<ActivityIndicatorProps, "color"> {
  /** Token-named color choice. */
  tone?: "default" | "accent" | "muted" | "inverse";
}

export function Spinner({ tone = "default", size = "small", ...rest }: SpinnerProps) {
  const p = usePalette();
  const color =
    tone === "accent" ? p.accent : tone === "muted" ? p.textMuted : tone === "inverse" ? p.textInverse : p.text;
  return <ActivityIndicator size={size} color={color} {...rest} />;
}
