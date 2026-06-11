/**
 * PATTERNS / HIDE PATTERNS control + overlay wiring for match screens.
 */

import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  PatternOverlayModal,
  defaultActivePatterns,
} from "@/components/game/PatternOverlayModal";
import type { GridSize } from "@/lib/game/boardConfig";
import { colors, radii, space } from "@/theme/tokens";

interface PatternsToggleProps {
  gridSize: GridSize;
  /** When false, hide the button (e.g. match over). */
  enabled?: boolean;
  activePatternIds?: string[];
  /** Mindbreaker bans for the reference sheet ([] when hidden from viewer). */
  bannedPatternIds?: string[];
}

export function PatternsToggle({
  gridSize,
  enabled = true,
  activePatternIds,
  bannedPatternIds,
}: PatternsToggleProps) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(
    () => activePatternIds ?? defaultActivePatterns(gridSize),
    [activePatternIds, gridSize],
  );

  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!enabled) return null;

  return (
    <>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide patterns" : "Show active patterns"}
        style={({ pressed }) => [
          styles.btn,
          open && styles.btnActive,
          pressed && styles.btnPressed,
        ]}
      >
        <Text style={styles.btnText}>{open ? "HIDE PATTERNS" : "PATTERNS"}</Text>
      </Pressable>
      <PatternOverlayModal
        visible={open}
        gridSize={gridSize}
        activePatternIds={ids}
        bannedPatternIds={bannedPatternIds}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: "rgba(0,229,255,0.55)",
    backgroundColor: "rgba(0,229,255,0.1)",
  },
  btnActive: {
    backgroundColor: "rgba(0,229,255,0.22)",
    borderColor: colors.accent,
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
});
