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

import { colors } from "@/theme/tokens";

export interface SpinnerProps extends Omit<ActivityIndicatorProps, "color"> {
  /** Token-named color choice. */
  tone?: "default" | "accent" | "muted" | "inverse";
}

const TONE: Record<NonNullable<SpinnerProps["tone"]>, string> = {
  default: colors.text,
  accent: colors.accent,
  muted: colors.textMuted,
  inverse: colors.textInverse,
};

export function Spinner({ tone = "default", size = "small", ...rest }: SpinnerProps) {
  return <ActivityIndicator size={size} color={TONE[tone]} {...rest} />;
}
