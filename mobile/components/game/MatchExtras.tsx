/**
 * Match HUD: clocks, move log, center-rule hint, win overlay.
 */

import { useEffect, useRef } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Body, Caption, Eyebrow } from "@/components/ui";
import { centerCell, type GridSize } from "@/lib/game/boardConfig";
import { type MoveLogEntry, type Player7 } from "@/lib/game/matchRules";
import { colors, radii, space } from "@/theme/tokens";

export function MatchClockRow({
  p1Label,
  p2Label,
  active,
  p1Name = "X",
  p2Name = "Y",
}: {
  p1Label: string;
  p2Label: string;
  active: Player7 | null;
  p1Name?: string;
  p2Name?: string;
}) {
  return (
    <View style={styles.clockRow}>
      <ClockChip label={p1Name} time={p1Label} hot={active === "P1"} color={colors.p1} />
      <Caption tone="muted">MATCH</Caption>
      <ClockChip label={p2Name} time={p2Label} hot={active === "P2"} color={colors.p2} />
    </View>
  );
}

function ClockChip({
  label,
  time,
  hot,
  color,
}: {
  label: string;
  time: string;
  hot: boolean;
  color: string;
}) {
  return (
    <View style={[styles.clockChip, hot && { borderColor: color }]}>
      <Caption tone="muted">{label}</Caption>
      <Eyebrow style={{ color: hot ? color : colors.textMuted }}>{time}</Eyebrow>
    </View>
  );
}

export function CenterRuleBanner({
  visible,
  gridSize = 7,
}: {
  visible: boolean;
  gridSize?: GridSize;
}) {
  if (!visible) return null;
  const c = centerCell(gridSize);
  return (
    <View style={styles.centerBanner}>
      <Caption tone="accent" center>
        Center ({String.fromCharCode(65 + c)}{c + 1}) — opener grants opponent 2 extra turns
      </Caption>
    </View>
  );
}

export function ExtraTurnsBadge({ count, player }: { count: number; player: Player7 | null }) {
  if (count <= 0 || !player) return null;
  return (
    <View style={styles.extraBadge}>
      <Caption tone="warn" center>
        {player === "P1" ? "X" : "Y"} has {count} extra turn{count > 1 ? "s" : ""}
      </Caption>
    </View>
  );
}

export function MoveLogPanel({
  entries,
  style,
}: {
  entries: MoveLogEntry[];
  style?: StyleProp<ViewStyle>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [entries.length]);

  return (
    <View style={[styles.logPanel, style]}>
      <Caption tone="muted" style={{ marginBottom: space[2] }}>
        MOVE LOG
      </Caption>
      <ScrollView
        ref={scrollRef}
        style={styles.logScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <Caption tone="muted">No moves yet.</Caption>
        ) : (
          entries.map((e, i) => (
            <Caption
              key={`${i}-${e.text}`}
              tone={e.player === "P1" ? "accent" : "info"}
              style={styles.logLine}
            >
              {e.text}
            </Caption>
          ))
        )}
      </ScrollView>
    </View>
  );
}

export function WinOverlay({
  visible,
  title,
  subtitle,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
}) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.9);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.winOverlay, { opacity, transform: [{ scale }] }]}>
      <Eyebrow tone="accent" center>
        {title}
      </Eyebrow>
      {subtitle ? (
        <Body tone="muted" center style={{ marginTop: space[2] }}>
          {subtitle}
        </Body>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[2],
  },
  clockChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space[2],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  centerBanner: {
    marginTop: space[2],
    padding: space[2],
    borderRadius: radii.sm,
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  extraBadge: {
    marginTop: space[2],
    paddingVertical: space[1],
  },
  logPanel: {
    // Fixed height so appending move-log rows never grows the panel
    // and pushes / resizes the board above it (BUG-07).
    marginTop: space[3],
    height: 124,
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  logScroll: {
    flex: 1,
  },
  logLine: {
    fontFamily: "monospace",
    marginBottom: 2,
  },
  winOverlay: {
    marginTop: space[3],
    padding: space[5],
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
  },
});
