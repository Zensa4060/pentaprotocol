/**
 * Fixed-height match HUD above the board — prevents layout shift when
 * center-rule banner / extra-turns badge appear or disappear.
 */

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Caption, Eyebrow } from "@/components/ui";
import { CenterRuleBanner, ExtraTurnsBadge } from "@/components/game/MatchExtras";
import type { GridSize } from "@/lib/game/boardConfig";
import type { Player7 } from "@/lib/game/matchRules";
import { space } from "@/theme/tokens";

interface MatchStatusHudProps {
  gridSize: GridSize;
  showCenterBanner: boolean;
  extraTurns: number;
  extraPlayer: Player7 | null;
  status: string;
  statusTone: "default" | "accent" | "info" | "muted" | "warn";
  scoreLine: string;
  /** Optional spinner row (bot thinking). */
  spinner?: ReactNode;
}

export function MatchStatusHud({
  gridSize,
  showCenterBanner,
  extraTurns,
  extraPlayer,
  status,
  statusTone,
  scoreLine,
  spinner,
}: MatchStatusHudProps) {
  return (
    <View style={styles.slot}>
      <View style={styles.bannerRow}>
        <CenterRuleBanner visible={showCenterBanner} gridSize={gridSize} />
      </View>
      <View style={styles.row}>
        <ExtraTurnsBadge count={extraTurns} player={extraPlayer} />
      </View>
      <View style={styles.row}>
        {spinner}
        <Eyebrow tone={statusTone} center numberOfLines={1}>
          {status}
        </Eyebrow>
      </View>
      <View style={styles.row}>
        <Caption tone="muted" center numberOfLines={1} style={styles.score}>
          {scoreLine}
        </Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: 116,
    marginTop: space[2],
    marginBottom: space[3],
    justifyContent: "flex-start",
  },
  bannerRow: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: space[1],
  },
  row: {
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: space[2],
    paddingHorizontal: space[2],
  },
  score: {
    width: "100%",
  },
});
