/**
 * Rank ladder — shows every rank from UNRANKED (bottom) up to CHRONICLE
 * (top) with its logo + ELO range, highlighting the player's current
 * rank. Reads the single source of truth in ``lib/ranks.ts``.
 */

import { Image, StyleSheet, Text, View } from "react-native";

import { getRank, RANKS, type RankDef } from "@/lib/ranks";
import { usePalette } from "@/theme/ThemeProvider";
import { radii, space } from "@/theme/tokens";

function eloRange(r: RankDef): string {
  if (r.name === "UNRANKED") return "Placement";
  if (r.max >= 1_000_000) return `${r.min}+`;
  return `${r.min}–${r.max - 1}`;
}

export function RankLadder({ elo, isPlacement }: { elo: number | null; isPlacement?: boolean }) {
  const palette = usePalette();
  const current = getRank(elo ?? 0, isPlacement);
  // Highest rank on top, UNRANKED at the bottom.
  const rows = [...RANKS].reverse();

  return (
    <View style={styles.wrap}>
      {rows.map((r) => {
        const active = r.name === current.name;
        return (
          <View
            key={r.name}
            style={[
              styles.row,
              {
                borderColor: active ? r.color : palette.border,
                backgroundColor: active ? palette.bgRaised : palette.bgCard,
              },
            ]}
          >
            <View style={styles.iconBox}>
              {r.image ? (
                <Image source={r.image} style={styles.icon} resizeMode="contain" />
              ) : (
                <View style={[styles.dot, { backgroundColor: r.color }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: active ? r.color : palette.text }]}>{r.name}</Text>
              <Text style={[styles.range, { color: palette.textMuted }]}>ELO {eloRange(r)}</Text>
            </View>
            {active ? <Text style={[styles.current, { color: r.color }]}>● YOU</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  iconBox: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  icon: { width: 36, height: 36 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  name: { fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  range: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  current: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
