/**
 * Account level-up celebration — mirrors web XpLevelUpScreen.
 */

import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";

import { Btn, Caption, Eyebrow, Title } from "@/components/ui";
import { colors, radii, space } from "@/theme/tokens";

interface XpLevelUpOverlayProps {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  onDone: () => void;
}

export function XpLevelUpOverlay({
  visible,
  fromLevel,
  toLevel,
  onDone,
}: XpLevelUpOverlayProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!visible) {
      setRevealed(false);
      return;
    }
    setRevealed(false);
    const id = setTimeout(() => setRevealed(true), 1800);
    return () => clearTimeout(id);
  }, [visible, fromLevel, toLevel]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {!revealed ? (
            <>
              <Eyebrow tone="muted">LEVEL UP</Eyebrow>
              <Caption tone="muted" style={{ marginTop: space[4] }}>
                Charging…
              </Caption>
            </>
          ) : (
            <>
              <Eyebrow tone="accent">LEVEL UP</Eyebrow>
              <Title style={styles.level}>
                {fromLevel} → {toLevel}
              </Title>
              <Caption tone="muted" center style={{ marginTop: space[2] }}>
                New level unlocked
              </Caption>
              <Btn variant="primary" onPress={onDone} style={{ marginTop: space[6], width: "100%" }}>
                Continue
              </Btn>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2,3,6,0.97)",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[8],
    alignItems: "center",
  },
  level: {
    marginTop: space[5],
    fontSize: 48,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: 2,
  },
});
