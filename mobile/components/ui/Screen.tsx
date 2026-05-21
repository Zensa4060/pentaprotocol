/**
 * ``<Screen />`` — base wrapper every screen mounts at its root.
 *
 * Responsibilities:
 *   - Honour the device safe-area (notch + home indicator). The
 *     login screen does this inline; pulling it into a primitive
 *     keeps every other screen from re-implementing the same math.
 *   - Provide the brand dark surface so we never see the system
 *     white flash between screen transitions.
 *   - Optional scroll mode for screens whose content can overflow
 *     (Profile, Career, anything list-y).
 *   - Optional ``edges`` prop to override which sides get padded —
 *     handy for screens that want to bleed art into the top inset
 *     (e.g. profile banner).
 *
 * NOT responsible for:
 *   - Horizontal padding. We keep that at the screen / section
 *     level so list cells can bleed edge-to-edge while the section
 *     header stays inset.
 *   - Header bars. Those live in their own ``<Header />`` once we
 *     have more than one screen that needs one.
 */

import { type ReactNode } from "react";
import {
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, space } from "@/theme/tokens";

type Edge = "top" | "bottom" | "left" | "right";

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView. Defaults to false. */
  scrollable?: boolean;
  /** Sides that receive safe-area padding. Defaults to all four. */
  edges?: Edge[];
  /** Extra horizontal padding (defaults to none — screens choose their own gutters). */
  padded?: boolean;
  /** Override the surface color. Defaults to the brand background. */
  background?: string;
  /** Inline style escape hatch — use sparingly. */
  style?: ViewStyle;
  /** Forwarded to the inner ScrollView when ``scrollable`` is true. */
  scrollViewProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle">;
  contentContainerStyle?: ViewStyle;
}

const DEFAULT_EDGES: Edge[] = ["top", "bottom", "left", "right"];

export function Screen({
  children,
  scrollable = false,
  edges = DEFAULT_EDGES,
  padded = false,
  background,
  style,
  scrollViewProps,
  contentContainerStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  const gutter: ViewStyle = padded
    ? { paddingHorizontal: space[5] }
    : {};

  const bg = background ?? colors.bg;

  if (scrollable) {
    return (
      <View style={[styles.root, { backgroundColor: bg }, padding, style]}>
        <ScrollView
          {...scrollViewProps}
          contentContainerStyle={[gutter, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }, padding, gutter, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
