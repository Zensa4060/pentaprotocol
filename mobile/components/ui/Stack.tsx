/**
 * ``<Stack />`` / ``<Row />`` — layout primitives.
 *
 * 90% of React Native layouts boil down to "stack these things
 * with N pixels of gap". Rather than typing
 * ``style={{ gap: 12, flexDirection: 'column' }}`` everywhere we
 * just say ``<Stack gap={3}>`` (token step → 12 px).
 *
 *   - ``<Stack>``: column flex with token-driven gap.
 *   - ``<Row>``:   row flex with token-driven gap + sensible defaults.
 *
 * Both accept ``align`` / ``justify`` shortcuts so callers don't
 * have to memorize the React Native names (which differ from CSS:
 * ``alignItems`` / ``justifyContent``).
 */

import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { type SpaceToken, space } from "@/theme/tokens";

type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";

const ALIGN_MAP: Record<Align, ViewStyle["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

const JUSTIFY_MAP: Record<Justify, ViewStyle["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

interface BaseProps {
  children: ReactNode;
  gap?: SpaceToken;
  align?: Align;
  justify?: Justify;
  /** Make the container fill its parent (flex: 1). */
  fill?: boolean;
  /** Wrap children when they don't fit. */
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Stack({
  children,
  gap = 3,
  align,
  justify,
  fill = false,
  wrap = false,
  style,
}: BaseProps) {
  const containerStyle: ViewStyle = {
    flexDirection: "column",
    gap: space[gap],
    flex: fill ? 1 : undefined,
    flexWrap: wrap ? "wrap" : undefined,
    alignItems: align ? ALIGN_MAP[align] : undefined,
    justifyContent: justify ? JUSTIFY_MAP[justify] : undefined,
  };
  return <View style={[containerStyle, style]}>{children}</View>;
}

export function Row({
  children,
  gap = 3,
  align = "center",
  justify,
  fill = false,
  wrap = false,
  style,
}: BaseProps) {
  const containerStyle: ViewStyle = {
    flexDirection: "row",
    gap: space[gap],
    flex: fill ? 1 : undefined,
    flexWrap: wrap ? "wrap" : undefined,
    alignItems: ALIGN_MAP[align],
    justifyContent: justify ? JUSTIFY_MAP[justify] : undefined,
  };
  return <View style={[containerStyle, style]}>{children}</View>;
}
