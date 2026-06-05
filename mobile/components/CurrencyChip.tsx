/**
 * Currency chip — logo + value, used wherever ProtoCredits / PentaShards
 * balances are shown (home, profile, store). Both variants render at an
 * identical size so the two chips are visually symmetric.
 *
 * Logos are the official currency marks (the same ones the web NavBar
 * uses): the "PR" circle for ProtoCredits and the octagonal gem for
 * PentaShards — NOT the coin-toss coins. Stored as white-on-transparent
 * PNGs and tinted to the brand currency colours (gold PC / blue PS),
 * matching the web's coloured balances.
 */

import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radii, space } from "@/theme/tokens";

const PROTO = require("../assets/images/proto-credits.png");
const PENTA = require("../assets/images/penta-shards.png");

/** Brand currency colours (mirror web NavBar: ProtoCredits gold, PentaShards blue). */
const PC_COLOR = "#FFD700";
const PS_COLOR = "#4FC3F7";

export type CurrencyKind = "pc" | "ps";

export interface CurrencyChipProps {
  kind: CurrencyKind;
  value: number;
  /** Coin diameter in px (text scales with it). Default 22. */
  size?: number;
  /** Render as a full bordered tile (home/profile) vs inline chip (store header). */
  variant?: "tile" | "inline";
  style?: StyleProp<ViewStyle>;
}

export function CurrencyChip({ kind, value, size = 22, variant = "inline", style }: CurrencyChipProps) {
  const source = kind === "pc" ? PROTO : PENTA;
  const label = kind === "pc" ? "PROTOCREDITS" : "PENTASHARDS";
  const color = kind === "pc" ? PC_COLOR : PS_COLOR;

  if (variant === "tile") {
    return (
      <View style={[styles.tile, style]}>
        <View style={styles.tileRow}>
          <Image source={source} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
          <Text style={[styles.tileValue, { color }]}>{value.toLocaleString()}</Text>
        </View>
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.inline, style]}>
      <Image source={source} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
      <Text style={[styles.inlineValue, { color }]}>{value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    height: 76,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: space[3],
  },
  tileRow: { flexDirection: "row", alignItems: "center", gap: space[2] },
  tileValue: { fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  tileLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  inlineValue: { fontSize: 14, fontWeight: "800" },
});
