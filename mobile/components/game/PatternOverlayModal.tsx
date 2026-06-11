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
import { defaultPatternsForGrid, isCorePatternId } from "@/lib/game/boardConfig";
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
  // LINE / DIAGONAL are core rules on every grid — shown alongside the
  // N-point connection rule, never in the selectable/banned pools.
  const active = activePatternIds
    .filter((id) => !bannedPatternIds.includes(id) && !isCorePatternId(id))
    .map((id) => allMeta[id])
    .filter(Boolean);
  const banned = bannedPatternIds
    .filter((id) => !isCorePatternId(id))
    .map((id) => allMeta[id])
    .filter(Boolean);
  const inactive = Object.values(allMeta).filter(
    (p) =>
      !activePatternIds.includes(p.id) &&
      !bannedPatternIds.includes(p.id) &&
      !isCorePatternId(p.id),
  );
  const coreLinePatterns = Object.values(allMeta).filter((p) => isCorePatternId(p.id));
  const coreList = [...Object.values(coreRules), ...coreLinePatterns];
  // Half-size cards (3-up) so the full pattern set AND the core rules fit
  // on one phone screen without scrolling.
  const cellSize = gridSize === 7 ? 5 : gridSize === 6 ? 6 : 7;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
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
        </View>
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
      <Text
        style={[styles.cardLabel, inactive && styles.cardLabelInactive]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
      {inactive ? <Text style={styles.inactiveTag}>{inactiveTag}</Text> : null}
      <Text
        style={[styles.cardDesc, inactive && styles.cardDescInactive]}
        numberOfLines={2}
      >
        {desc}
      </Text>
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
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    marginTop: space[2],
    marginBottom: space[3],
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[2],
    justifyContent: "center",
  },
  // Compact 3-up cards — roughly half the old footprint so all patterns
  // plus the always-active core rules fit a phone screen at once.
  card: {
    width: "31%",
    minWidth: 96,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[2],
    alignItems: "center",
  },
  cardInactive: {
    backgroundColor: "rgba(96,0,0,0.35)",
    borderColor: "rgba(255,70,70,0.7)",
  },
  cardLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  cardLabelInactive: { color: "#ffb0b0" },
  inactiveTag: {
    fontSize: 8,
    fontWeight: "900",
    color: "#ffd2d2",
    backgroundColor: "rgba(255,40,40,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.72)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  cardDesc: {
    color: colors.textMuted,
    fontSize: 8,
    lineHeight: 11,
    marginTop: 2,
    textAlign: "center",
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
