/**
 * Post-match series result — ELO / RR / XP deltas (web MatchResultScreen parity).
 */

import { Modal, StyleSheet, View } from "react-native";

import { Btn, Caption, Eyebrow, Heading, Row, Title } from "@/components/ui";
import { getRank } from "@/lib/ranks";
import type { MatchSeriesComplete } from "@/lib/multiplayer/matchResult";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

interface MatchResultOverlayProps {
  visible: boolean;
  result: MatchSeriesComplete;
  mySlot: PlayerSlot;
  onDismiss: () => void;
  onFindNewMatch?: () => void;
  onViewCareer?: () => void;
}

export function MatchResultOverlay({
  visible,
  result,
  mySlot,
  onDismiss,
  onFindNewMatch,
  onViewCareer,
}: MatchResultOverlayProps) {
  const me = mySlot === "P1" ? result.p1 : result.p2;
  const isRanked = result.format === "ranked";
  const isWinner = result.series_winner === mySlot;
  const isDraw = result.series_winner === "DRAW";

  const eloDiff = me.elo_after - (me.elo_before ?? 0);
  const rrDiff = me.rr_after - me.rr_before;
  const xpGained = me.xp_after - me.xp_before;
  const levelUp = me.level_after > me.level_before;

  const rankBefore = getRank(me.elo_before ?? 0, me.was_placement);
  const rankAfter = getRank(me.elo_after ?? 0, me.was_placement);

  const headline = isDraw ? "SERIES DRAW" : isWinner ? "SERIES WIN" : "SERIES LOSS";
  const tone = isDraw ? "warn" : isWinner ? "accent" : "info";

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone={tone}>{result.format.toUpperCase()}</Eyebrow>
          <Title style={styles.headline}>{headline}</Title>
          <Caption tone="muted" center style={{ marginBottom: space[4] }}>
            {result.p1.name} vs {result.p2.name}
          </Caption>

          <View style={styles.statBlock}>
            {isRanked && me.elo_before != null && me.elo_after != null ? (
              <StatRow
                label="ELO"
                value={`${me.elo_before} → ${me.elo_after}`}
                delta={eloDiff}
              />
            ) : null}
            {isRanked ? (
              <StatRow label="RR" value={`${me.rr_before} → ${me.rr_after}`} delta={rrDiff} />
            ) : null}
            <StatRow label="XP" value={`+${xpGained}`} delta={xpGained} positiveOnly />
            {levelUp ? (
              <Caption tone="accent" center style={{ marginTop: space[2] }}>
                Level {me.level_before} → {me.level_after}
              </Caption>
            ) : null}
            {isRanked && rankBefore.name !== rankAfter.name ? (
              <Caption tone="muted" center style={{ marginTop: space[2] }}>
                {rankBefore.name} → {rankAfter.name}
              </Caption>
            ) : null}
          </View>

          {onViewCareer ? (
            <Btn
              variant="primary"
              onPress={onViewCareer}
              style={{ marginTop: space[5], width: "100%" }}
            >
              View match in career
            </Btn>
          ) : null}
          {onFindNewMatch ? (
            <Btn
              variant={onViewCareer ? "secondary" : "primary"}
              onPress={onFindNewMatch}
              style={{ marginTop: space[3], width: "100%" }}
            >
              Find new match
            </Btn>
          ) : null}
          <Btn
            variant={onViewCareer || onFindNewMatch ? "secondary" : "primary"}
            onPress={onDismiss}
            style={{ marginTop: space[3], width: "100%" }}
          >
            Back to lobby
          </Btn>
        </View>
      </View>
    </Modal>
  );
}

function StatRow({
  label,
  value,
  delta,
  positiveOnly = false,
}: {
  label: string;
  value: string;
  delta: number;
  positiveOnly?: boolean;
}) {
  const deltaStr =
    delta === 0
      ? ""
      : positiveOnly
        ? ""
        : ` (${delta > 0 ? "+" : ""}${delta})`;
  const deltaTone = delta > 0 ? "accent" : delta < 0 ? "danger" : "muted";
  return (
    <Row justify="between" align="center" style={styles.statRow}>
      <Caption tone="muted">{label}</Caption>
      <Row gap={1} align="center">
        <Heading>{value}</Heading>
        {!positiveOnly && delta !== 0 ? (
          <Caption tone={deltaTone}>{deltaStr}</Caption>
        ) : null}
      </Row>
    </Row>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[6],
    alignItems: "center",
  },
  headline: {
    marginVertical: space[3],
    textAlign: "center",
  },
  statBlock: {
    width: "100%",
    gap: space[2],
  },
  statRow: {
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
