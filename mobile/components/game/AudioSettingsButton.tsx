/**
 * In-match audio settings — a gear pill on the match top bar (next to
 * PATTERNS) that opens a compact modal with mute + music / SFX volume.
 *
 * Exists so players can duck the audio mid-game without leaving the
 * match: the full Settings screen is a navigation away, which would
 * forfeit a live multiplayer game. Controls write straight to
 * ``AudioProvider`` (persisted in AsyncStorage), so levels set here and
 * in Settings are the same values.
 *
 * Volume uses the same ±10% steppers as the Settings screen rather
 * than a slider — no extra dependency, and discrete steps are easier
 * to hit mid-match than a drag. SFX steps play a click at the new
 * level so the change is audible immediately.
 */

import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Switch } from "react-native";

import { Body, Caption, Card, Divider, Heading, Row, Stack as VStack } from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { colors, radii, space } from "@/theme/tokens";

/** Step volume by ±0.1, clamped to [0, 1] (same math as Settings). */
const step = (cur: number, delta: number) =>
  Math.max(0, Math.min(1, Math.round((cur + delta) * 10) / 10));

export function AudioSettingsButton() {
  const audio = useGameAudio();
  const [open, setOpen] = useState(false);

  const stepSfx = (delta: number) => {
    audio.setSfxVol(step(audio.sfxVol, delta));
    // Audible preview at the new level (setSfxVol updates the ref
    // synchronously, so this click already plays at the new volume).
    audio.sfx.click();
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Audio settings"
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <MaterialCommunityIcons name="cog" size={14} color={colors.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Scrim closes; the inner Pressable swallows presses on the card. */}
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.cardWrap}>
            <Card variant="surface" padding="lg" style={styles.card}>
              <Heading>AUDIO</Heading>
              <VStack gap={3} style={{ marginTop: space[4] }}>
                <Row justify="between" align="center">
                  <Body tone="muted">Mute all</Body>
                  <Switch
                    value={audio.muted}
                    onValueChange={audio.toggleMute}
                    trackColor={{ true: colors.accent, false: colors.bgRaised }}
                  />
                </Row>
                <Divider />
                <VolumeRow
                  label="Music"
                  value={audio.musicVol}
                  onDown={() => audio.setMusicVol(step(audio.musicVol, -0.1))}
                  onUp={() => audio.setMusicVol(step(audio.musicVol, 0.1))}
                />
                <Divider />
                <VolumeRow
                  label="Sound effects"
                  value={audio.sfxVol}
                  onDown={() => stepSfx(-0.1)}
                  onUp={() => stepSfx(0.1)}
                />
              </VStack>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
              >
                <Caption tone="accent" style={styles.doneLabel}>
                  DONE
                </Caption>
              </Pressable>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** ±10% stepper row — mirrors the Settings screen's audio card. */
function VolumeRow({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: number;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <Row justify="between" align="center">
      <Body tone="muted">{label}</Body>
      <Row gap={3} align="center">
        <Pressable onPress={onDown} hitSlop={8} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} down`}>
          <Caption tone="accent">−</Caption>
        </Pressable>
        <Caption tone="muted" style={styles.pct}>
          {Math.round(value * 100)}%
        </Caption>
        <Pressable onPress={onUp} hitSlop={8} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} up`}>
          <Caption tone="accent">+</Caption>
        </Pressable>
      </Row>
    </Row>
  );
}

const styles = StyleSheet.create({
  // Same pill language as PatternsToggle so the top bar reads as one set.
  btn: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.1)",
  },
  btnPressed: {
    opacity: 0.85,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  cardWrap: {
    width: "100%",
    maxWidth: 380,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pct: {
    minWidth: 40,
    textAlign: "center",
  },
  doneBtn: {
    alignSelf: "center",
    marginTop: space[5],
    paddingVertical: space[2],
    paddingHorizontal: space[5],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  doneLabel: {
    letterSpacing: 2,
    fontWeight: "700",
  },
});
