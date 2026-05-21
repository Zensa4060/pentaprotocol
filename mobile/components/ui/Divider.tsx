/**
 * ``<Divider />`` — single-pixel rule.
 *
 * Use ``orientation="horizontal"`` (default) between stacked
 * sections, ``"vertical"`` between inline pills. ``tone`` lets a
 * caller request a slightly more prominent line — the default is
 * the standard low-contrast hairline.
 */

import { View, type ViewStyle } from "react-native";

import { colors, space } from "@/theme/tokens";

export interface DividerProps {
  orientation?: "horizontal" | "vertical";
  tone?: "default" | "strong" | "accent";
  /** Vertical margin (in token steps) added above and below for horizontal dividers. */
  spacing?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export function Divider({
  orientation = "horizontal",
  tone = "default",
  spacing = 0,
}: DividerProps) {
  const color =
    tone === "accent"
      ? colors.borderAccent
      : tone === "strong"
      ? colors.borderStrong
      : colors.border;

  const style: ViewStyle =
    orientation === "horizontal"
      ? {
          height: 1,
          width: "100%",
          backgroundColor: color,
          marginVertical: space[spacing],
        }
      : {
          width: 1,
          alignSelf: "stretch",
          backgroundColor: color,
          marginHorizontal: space[spacing],
        };

  return <View style={style} />;
}
