/**
 * Syros post-game analysis modal — shared across engine + career flows.
 */

import { Image, Modal, Pressable, StyleSheet, View } from "react-native";

import { Body, Btn, Caption, Eyebrow, Heading, Row } from "@/components/ui";
import type { AnalyzeResult } from "@/lib/syros";
import { colors, radii, space } from "@/theme/tokens";

const SYROS_LOGO = require("@/assets/images/syros-pfp.png");

interface SyrosAnalysisModalProps {
  visible: boolean;
  loading: boolean;
  analysis: AnalyzeResult | null;
  p1Label?: string;
  p2Label?: string;
  onClose: () => void;
}

export function SyrosAnalysisModal({
  visible,
  loading,
  analysis,
  p1Label = "YOU",
  p2Label = "OPPONENT",
  onClose,
}: SyrosAnalysisModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Row gap={3} align="center">
            <Image source={SYROS_LOGO} style={styles.logo} resizeMode="contain" />
            <Eyebrow tone="accent">SYROS · ANALYSIS</Eyebrow>
          </Row>
          {loading ? (
            <Body tone="muted" style={{ marginTop: space[4] }}>Syros is reading the board…</Body>
          ) : !analysis ? (
            <Body tone="muted" style={{ marginTop: space[4] }}>
              Analysis unavailable for this game.
            </Body>
          ) : (
            <View style={{ marginTop: space[4] }}>
              <AnalysisRow label={p1Label} s={analysis.summary.P1} />
              <View style={{ height: space[3] }} />
              <AnalysisRow label={p2Label} s={analysis.summary.P2} />
            </View>
          )}
          <View style={{ height: space[4] }} />
          <Btn variant="primary" onPress={onClose}>Close</Btn>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AnalysisRow({ label, s }: { label: string; s: AnalyzeResult["summary"]["P1"] }) {
  return (
    <View style={styles.row}>
      <Row justify="between" align="center">
        <Body style={{ fontWeight: "800" }}>{label}</Body>
        <Heading tone="accent">{s.accuracy}%</Heading>
      </Row>
      <Caption tone="muted" style={{ marginTop: space[1] }}>
        ★ {s.best_moves} best · {s.good} good · {s.inaccuracies} inacc · {s.mistakes} mist · {s.blunders} blund
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  logo: { width: 40, height: 40, borderRadius: radii.pill },
  row: {
    backgroundColor: colors.bgRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
});
