/**
 * Rules-show ("level up") gate — multiplayer parity with the web
 * RulesShow screen. Shown at the start of each leg while the server's
 * ``awaiting_{5x5,6x6,7x7}_rules_ready`` gate is active: the leg's rules
 * + win-pattern cards, both players' READY state, and a READY / UNREADY
 * toggle that drives the ``levelup_ready`` WS message. The board opens
 * when the server broadcasts ``levelup_start`` (both ready, or the
 * server-side rules-sheet timeout fires).
 */

import { Modal, ScrollView, StyleSheet, View } from "react-native";

import { PatternDiagram } from "@/components/game/PatternDiagram";
import { Body, Btn, Caption, Eyebrow, Heading, Row, Title } from "@/components/ui";
import type { GridSize } from "@/lib/game/boardConfig";
import { matchMsForGrid } from "@/lib/game/boardConfig";
import { formatClock } from "@/lib/game/matchRules";
import { coreRulesForGrid, patternMetadataForGrid } from "@/lib/game/patterns";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

interface RulesShowOverlayProps {
  visible: boolean;
  gridSize: GridSize;
  gameNumber: number;
  /** Patterns active this leg (server ``selected_patterns``); others show INACTIVE. */
  selectedPatterns: string[] | undefined;
  mySlot: PlayerSlot;
  p1Name: string;
  p2Name: string;
  rulesReady: Record<PlayerSlot, boolean>;
  onToggleReady: (ready: boolean) => void;
}

const LEG_TITLE: Record<number, string> = {
  5: "5×5 — OPENING LEG",
  6: "6×6 — MID LEG",
  7: "7×7 — TOP LEG",
};

function centreRuleLine(grid: GridSize): string {
  if (grid === 6) return "No centre rule on 6×6 — even board, no centre cell.";
  const cell = grid === 5 ? "C3" : "D4";
  return `Centre (${cell}) opening hands your opponent 2 consecutive extra turns.`;
}

export function RulesShowOverlay({
  visible,
  gridSize,
  gameNumber,
  selectedPatterns,
  mySlot,
  p1Name,
  p2Name,
  rulesReady,
  onToggleReady,
}: RulesShowOverlayProps) {
  const meta = patternMetadataForGrid(gridSize);
  const coreMeta = coreRulesForGrid(gridSize);
  const allKeys = Object.keys(meta);
  const activeSet =
    selectedPatterns && selectedPatterns.length > 0 ? new Set(selectedPatterns) : null;
  const clock = formatClock(matchMsForGrid(gridSize));
  const myReady = rulesReady[mySlot];
  const oppSlot: PlayerSlot = mySlot === "P1" ? "P2" : "P1";

  return (
    <Modal visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow tone="accent">GAME {gameNumber} · RULES OF ENGAGEMENT</Eyebrow>
          <Title style={styles.title}>{LEG_TITLE[gridSize] ?? `${gridSize}×${gridSize}`}</Title>

          <View style={styles.rulesCard}>
            <Body tone="muted">
              {clock} per player · alternate placing on empty cells · pieces never move ·
              clock at zero loses the game.
            </Body>
            <Body tone="muted" style={{ marginTop: space[2] }}>
              {centreRuleLine(gridSize)}
            </Body>
            {Object.keys(coreMeta).length > 0 ? (
              <Body tone="muted" style={{ marginTop: space[2] }}>
                {coreMeta[Object.keys(coreMeta)[0]].desc}
              </Body>
            ) : null}
          </View>

          <Eyebrow tone="muted" style={styles.section}>
            WIN PATTERNS THIS LEG
          </Eyebrow>
          <View style={styles.patternWrap}>
            {allKeys.map((key) => {
              const inactive = activeSet ? !activeSet.has(key) : false;
              return (
                <View
                  key={key}
                  style={[
                    styles.patternCard,
                    inactive && { borderColor: colors.danger, opacity: 0.55 },
                  ]}
                >
                  <PatternDiagram
                    info={meta[key]}
                    accent={inactive ? colors.danger : colors.accent}
                    cellSize={gridSize >= 7 ? 8 : 10}
                  />
                  <Caption
                    tone={inactive ? "danger" : "default"}
                    style={{ marginTop: space[1], textAlign: "center" }}
                  >
                    {meta[key].label}
                  </Caption>
                  {inactive ? <Caption tone="danger">INACTIVE</Caption> : null}
                </View>
              );
            })}
          </View>

          <Eyebrow tone="muted" style={styles.section}>
            READY CHECK
          </Eyebrow>
          <Row gap={3}>
            <ReadyChip
              name={mySlot === "P1" ? p1Name : p2Name}
              ready={rulesReady[mySlot]}
              isYou
            />
            <ReadyChip
              name={oppSlot === "P1" ? p1Name : p2Name}
              ready={rulesReady[oppSlot]}
            />
          </Row>

          <View style={{ marginTop: space[5] }}>
            <Btn
              variant={myReady ? "secondary" : "primary"}
              size="lg"
              onPress={() => onToggleReady(!myReady)}
            >
              {myReady ? "UNREADY" : "READY"}
            </Btn>
          </View>
          <Caption tone="muted" style={{ marginTop: space[3], textAlign: "center" }}>
            {myReady
              ? "Waiting for your opponent… the board opens when both are ready."
              : "Review the rules, then tap READY."}
          </Caption>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ReadyChip({ name, ready, isYou }: { name: string; ready: boolean; isYou?: boolean }) {
  return (
    <View
      style={[
        styles.readyChip,
        { borderColor: ready ? colors.success : colors.border },
      ]}
    >
      <Heading numberOfLines={1} style={{ textAlign: "center" }}>
        {name}
        {isYou ? " (YOU)" : ""}
      </Heading>
      <Caption tone={ready ? "success" : "muted"} style={{ textAlign: "center" }}>
        {ready ? "READY" : "WAITING…"}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    padding: space[5],
    paddingTop: space[8],
    paddingBottom: space[8],
  },
  title: {
    marginTop: space[2],
  },
  rulesCard: {
    marginTop: space[4],
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  section: { marginTop: space[6], marginBottom: space[3] },
  patternWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[3],
  },
  patternCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    padding: space[3],
    alignItems: "center",
    minWidth: 96,
  },
  readyChip: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
  },
});
