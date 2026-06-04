/**
 * ``<Btn />`` — the canonical interactive surface for the app.
 *
 * Variants:
 *   - ``primary``   — blood-red filled. The default for "do the thing".
 *   - ``secondary`` — dark filled, subtle border. For non-destructive
 *                     alternates ("Skip", "Maybe later").
 *   - ``ghost``     — transparent, label-only. For tertiary nav.
 *   - ``danger``    — red, used for destructive confirmation steps.
 *   - ``inverse``   — white surface (Google-button style).
 *
 * Sizes:
 *   - ``lg`` (56 pt height) — primary CTA on a form.
 *   - ``md`` (48 pt) — default.
 *   - ``sm`` (40 pt) — inline / list-row actions.
 *
 * Always renders as a ``Pressable`` so we get the full
 * touchable contract: accessibility role, disabled state,
 * Android ripple, ``pressed`` callback style. The login screen
 * inlines its buttons with the same pattern — this file is the
 * promoted, reusable version of that.
 *
 * Loading state shows an ``ActivityIndicator`` and disables
 * interaction, so callers don't have to remember to wire two
 * props every time they want a "submit + spinner" button.
 */

import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";

import { fontSizes, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
type Size = "sm" | "md" | "lg";

export interface BtnProps extends Omit<PressableProps, "style" | "children"> {
  children?: ReactNode;
  /** Accessible label override; defaults to ``children`` text. */
  label?: string;
  variant?: Variant;
  size?: Size;
  /** Show a spinner and block interaction. */
  loading?: boolean;
  /** Render full-width (``alignSelf: stretch``). Defaults to true. */
  block?: boolean;
  /** Inline style escape hatch. */
  style?: StyleProp<ViewStyle>;
  /** Optional leading element (icon, badge). */
  leading?: ReactNode;
  /** Optional trailing element. */
  trailing?: ReactNode;
}

interface VariantStyle {
  bg: string;
  bgPressed: string;
  border: string;
  label: string;
  ripple: string;
}

/** Variant colors built from the *active* theme palette (reskins live). */
function variantStyle(p: ThemePalette, variant: Variant): VariantStyle {
  switch (variant) {
    case "secondary":
      return { bg: p.bgCard, bgPressed: p.bgRaised, border: p.border, label: p.text, ripple: p.bgRaised };
    case "ghost":
      return { bg: "transparent", bgPressed: p.bgRaised, border: "transparent", label: p.textMuted, ripple: p.bgRaised };
    case "danger":
      return { bg: p.danger, bgPressed: "#CC3D3D", border: "transparent", label: "#FFFFFF", ripple: "#CC3D3D" };
    case "inverse":
      return { bg: "#FFFFFF", bgPressed: "#EAEAEA", border: "transparent", label: "#0A0A0A", ripple: "rgba(0,0,0,0.08)" };
    default:
      return { bg: p.accent, bgPressed: p.accentDeep, border: "transparent", label: "#FFFFFF", ripple: p.accentDeep };
  }
}

interface SizeStyle {
  minHeight: number;
  paddingHorizontal: number;
  fontSize: number;
  letterSpacing: number;
}

const SIZES: Record<Size, SizeStyle> = {
  sm: {
    minHeight: 40,
    paddingHorizontal: space[3],
    fontSize: fontSizes.sm,
    letterSpacing: 1.4,
  },
  md: {
    minHeight: 48,
    paddingHorizontal: space[4],
    fontSize: fontSizes.base,
    letterSpacing: 1.6,
  },
  lg: {
    minHeight: 56,
    paddingHorizontal: space[5],
    fontSize: fontSizes.base,
    letterSpacing: 2,
  },
};

export function Btn({
  children,
  label,
  variant = "primary",
  size = "md",
  loading = false,
  block = true,
  disabled,
  style,
  leading,
  trailing,
  onPress,
  ...rest
}: BtnProps) {
  const palette = usePalette();
  const v = variantStyle(palette, variant);
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  const baseStyle: ViewStyle = {
    minHeight: s.minHeight,
    paddingHorizontal: s.paddingHorizontal,
    borderRadius: radii.md,
    backgroundColor: v.bg,
    borderWidth: v.border === "transparent" ? 0 : 1,
    borderColor: v.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: space[2],
    alignSelf: block ? "stretch" : "flex-start",
  };

  // Press feedback mirrors the web ``button:active`` (scale 0.97).
  const pressedStyle: ViewStyle = { backgroundColor: v.bgPressed, transform: [{ scale: 0.97 }] };
  const disabledStyle: ViewStyle = { opacity: 0.5 };

  const labelStyle: TextStyle = {
    color: v.label,
    fontFamily: palette.fontDisplay,
    fontSize: s.fontSize,
    fontWeight: "800",
    letterSpacing: s.letterSpacing,
    textTransform: variant === "ghost" ? "none" : "uppercase",
  };

  const accessibleLabel = label ?? (typeof children === "string" ? children : undefined);

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={isDisabled}
      android_ripple={{ color: v.ripple }}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        baseStyle,
        pressed && !isDisabled ? pressedStyle : null,
        isDisabled ? disabledStyle : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.label} />
      ) : (
        <>
          {leading ? <View style={styles.affix}>{leading}</View> : null}
          {typeof children === "string" ? (
            <Text style={labelStyle}>{children}</Text>
          ) : (
            children
          )}
          {trailing ? <View style={styles.affix}>{trailing}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  affix: { alignItems: "center", justifyContent: "center" },
});
