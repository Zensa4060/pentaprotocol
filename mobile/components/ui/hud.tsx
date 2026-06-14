/**
 * HUD kit — futuristic-minimalist primitives shared by the redesigned
 * Store / Collection / Lobby screens so they read as one design language:
 * void canvas, blood-red accent used only as thin ticks/underlines, big
 * tight titles, underline segmented tabs, hairline dividers, mono labels.
 *
 * Presentation only — no data, no logic. Screens keep all their state and
 * handlers and just render through these.
 */

import { type ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Caption, Eyebrow, Title } from "./Text";
import { colors, radii, space } from "@/theme/tokens";

/** Full-width hairline divider. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

/** Short blood-red accent tick used to anchor titles / section labels. */
export function AccentTick({ height = 28 }: { height?: number }) {
  return <View style={[styles.tick, { height }]} />;
}

/** Uppercase micro section label with a leading accent tick. */
export function SectionLabel({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <View style={styles.sectionTick} />
      <Eyebrow tone="dim" style={{ letterSpacing: 1.8 }}>
        {label}
      </Eyebrow>
    </View>
  );
}

export interface HudHeaderProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  /** Optional right-aligned node on the back row (e.g. a wallet readout). */
  right?: ReactNode;
}

/** Standard screen header: back row + big accent-ticked title + eyebrow. */
export function HudHeader({ title, eyebrow, onBack, right }: HudHeaderProps) {
  return (
    <View>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Caption tone="dim" style={styles.back}>
              ‹  BACK
            </Caption>
          </Pressable>
        ) : (
          <View />
        )}
        <View>{right}</View>
      </View>

      <View style={styles.titleRow}>
        <AccentTick height={30} />
        <Title style={styles.title} numberOfLines={1}>
          {title}
        </Title>
      </View>

      {eyebrow ? (
        <Eyebrow tone="dim" style={styles.eyebrow}>
          {eyebrow}
        </Eyebrow>
      ) : null}
    </View>
  );
}

export interface SegTab<T extends string> {
  key: T;
  label: string;
}

export interface SegTabsProps<T extends string> {
  tabs: SegTab<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** Underline segmented tabs (replaces pill tabs) + a hairline baseline. */
export function SegTabs<T extends string>({ tabs, value, onChange, style }: SegTabsProps<T>) {
  return (
    <View style={style}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.segRow}
      >
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              style={styles.segTab}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Caption
                tone={on ? "default" : "dim"}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
                style={on ? { ...styles.segLabel, ...styles.segLabelOn } : styles.segLabel}
              >
                {t.label}
              </Caption>
              <View style={[styles.segUnderline, on && styles.segUnderlineOn]} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Hairline />
    </View>
  );
}

/** Thin-bordered void panel — the minimalist container for grouped content. */
export function Panel({
  children,
  style,
  active = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
}) {
  return <View style={[styles.panel, active && styles.panelActive, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.09)",
    alignSelf: "stretch",
  },
  tick: {
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 20,
  },
  back: {
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    marginTop: space[5],
  },
  title: {
    fontWeight: "900",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  eyebrow: {
    marginTop: space[2],
    marginLeft: 16,
    letterSpacing: 1.6,
  },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  sectionTick: {
    width: 3,
    height: 11,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  segRow: {
    gap: space[5],
    paddingRight: space[4],
  },
  segTab: {
    alignItems: "center",
    gap: 8,
    paddingTop: space[1],
  },
  segLabel: {
    fontWeight: "600",
    letterSpacing: 1,
  },
  segLabelOn: {
    fontWeight: "800",
  },
  segUnderline: {
    height: 2,
    width: "100%",
    borderRadius: 2,
    backgroundColor: "transparent",
  },
  segUnderlineOn: {
    backgroundColor: colors.accent,
  },
  panel: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.10)",
  },
  panelActive: {
    borderColor: colors.borderAccent,
    borderWidth: 1,
  },
});
