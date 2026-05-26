/**
 * Rank emblem — PNG from ``assets/ranks`` (same art as web navbar).
 */

import { Image, StyleSheet, Text, View } from "react-native";

import { getRank, type RankDef } from "@/lib/ranks";
import { colors, radii, space } from "@/theme/tokens";

interface RankBadgeProps {
  elo: number;
  isPlacement?: boolean;
  size?: number;
  showLabel?: boolean;
  rank?: RankDef;
}

export function RankBadge({
  elo,
  isPlacement = false,
  size = 36,
  showLabel = false,
  rank: rankProp,
}: RankBadgeProps) {
  const rank = rankProp ?? getRank(elo, isPlacement);
  const imgScale = rank.scale ?? 1;
  const imgSize = size * 0.85 * imgScale;
  const borderColor = isPlacement ? "#FF33FF" : rank.color;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor,
          },
        ]}
      >
        {rank.image ? (
          <Image
            source={rank.image}
            style={{ width: imgSize, height: imgSize }}
            resizeMode="contain"
            accessibilityLabel={rank.name}
          />
        ) : (
          <View
            style={{
              width: imgSize * 0.5,
              height: imgSize * 0.5,
              borderRadius: 4,
              backgroundColor: borderColor,
            }}
          />
        )}
      </View>
      {showLabel ? (
        <View style={[styles.rankPill, { borderColor }]}>
          <Text style={styles.rankPillLabel} numberOfLines={1}>
            {rank.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    backgroundColor: colors.bgRaised,
  },
  rankPill: {
    backgroundColor: colors.bgRaised,
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  rankPillLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
});
