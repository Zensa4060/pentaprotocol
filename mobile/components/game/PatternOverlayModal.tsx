/**
 * Full-screen pattern reference — active / inactive pools + core rules.
 */

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PatternDiagram } from "@/components/game/PatternDiagram";
import type { GridSize } from "@/lib/game/boardConfig";
import { defaultPatternsForGrid } from "@/lib/game/boardConfig";
import { coreRulesForGrid, patternMetadataForGrid } from "@/lib/game/patterns";
import { colors, radii, space } from "@/theme/tokens";

interface PatternOverlayModalProps {
  visible: boolean;
  gridSize: GridSize;
  activePatternIds: string[];
  /** Mindbreaker bans — still active for the banner, dead for the opponent.
   *  Callers must pass [] when the ban is hidden from this viewer. */
  bannedPatternIds?: string[];
  onClose: () => void;
}

export function PatternOverlayModal({
  visible,
  gridSize,
  activePatternIds,
  bannedPatternIds = [],
  onClose,
}: PatternOverlayModalProps) {
  const allMeta = patternMetadataForGrid(gridSize);
  const coreRules = coreRulesForGrid(gridSize);
  const active = activePatternIds
    .filter((id) => !bannedPatternIds.includes(id))
    .map((id) => allMeta[id])
    .filter(Boolean);
  const banned = bannedPatternIds.map((id) => allMeta[id]).filter(Boolean);
  const inactive = Object.values(allMeta).filter(
    (p) => !activePatternIds.includes(p.id) && !bannedPatternIds.includes(p.id),
  );
  const coreList = Object.values(coreRules);
  const cellSize = gridSize === 7 ? 10 : gridSize === 6 ? 11 : 12;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.eyebrow}>ACTIVE PATTERNS THIS GAME</Text>
            <Text style={styles.title}>PATTERN REFERENCE</Text>

            <View style={styles.grid}>
              {active.map((p) => (
                <PatternCard
                  key={p.id}
                  label={p.label}
                  desc={p.desc}
                  info={p}
                  accent={colors.accent}
                  selected
                  cellSize={cellSize}
                />
              ))}
              {banned.map((p) => (
                <PatternCard
                  key={`banned-${p.id}`}
                  label={p.label}
                  desc="Banned in the Protocol Breaker — still counts for the player who banned it, dead for their opponent."
                  info={p}
                  accent="#ef4444"
                  selected={false}
                  inactive
                  inactiveTag="BANNED"
                  cellSize={cellSize}
                />
              ))}
              {inactive.map((p) => (
                <PatternCard
                  key={`inactive-${p.id}`}
                  label={p.label}
                  desc="This pattern is not active this match."
                  info={p}
                  accent="#ef4444"
                  selected={false}
                  inactive
                  cellSize={cellSize}
                />
              ))}
            </View>

            <Text style={[styles.eyebrow, { marginTop: space[5] }]}>CORE RULES — ALWAYS ACTIVE</Text>
            <View style={styles.grid}>
              {coreList.map((p) => (
                <PatternCard
                  key={p.id}
                  label={p.label}
                  desc={p.desc}
                  info={p}
                  accent={colors.accent}
                  selected
                  cellSize={cellSize}
                />
              ))}
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PatternCard({
  label,
  desc,
  info,
  accent,
  selected,
  inactive,
  inactiveTag = "INACTIVE",
  cellSize,
}: {
  label: string;
  desc: string;
  info: Parameters<typeof PatternDiagram>[0]["info"];
  accent: string;
  selected: boolean;
  inactive?: boolean;
  inactiveTag?: string;
  cellSize: number;
}) {
  return (
    <View style={[styles.card, inactive && styles.cardInactive]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardLabel, inactive && styles.cardLabelInactive]}>{label}</Text>
        {inactive ? <Text style={styles.inactiveTag}>{inactiveTag}</Text> : null}
      </View>
      <Text style={[styles.cardDesc, inactive && styles.cardDescInactive]}>{desc}</Text>
      <PatternDiagram info={info} accent={accent} isSelected={selected} cellSize={cellSize} />
    </View>
  );
}

/** Default active pattern ids for practice / engine matches. */
export function defaultActivePatterns(gridSize: GridSize): string[] {
  return defaultPatternsForGrid(gridSize);
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,7,14,0.92)",
    justifyContent: "center",
    padding: space[4],
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  scroll: {
    padding: space[5],
    paddingBottom: space[8],
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2.2,
    textAlign: "center",
  },
  title: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginTop: space[2],
    marginBottom: space[5],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[3],
    justifyContent: "center",
  },
  card: {
    width: "46%",
    minWidth: 150,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  cardInactive: {
    backgroundColor: "rgba(96,0,0,0.35)",
    borderColor: "rgba(255,70,70,0.7)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[2],
  },
  cardLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  cardLabelInactive: { color: "#ffb0b0" },
  inactiveTag: {
    fontSize: 9,
    fontWeight: "900",
    color: "#ffd2d2",
    backgroundColor: "rgba(255,40,40,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.72)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.8,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  cardDescInactive: { color: "#ffc0c0" },
  closeBtn: {
    marginTop: space[6],
    alignSelf: "center",
    paddingVertical: space[3],
    paddingHorizontal: space[8],
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  closeBtnText: {
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 12,
  },
});
