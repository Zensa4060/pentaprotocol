/**
 * Limitbreaker overlay for local triple-leg decider (G10).
 */

import { Modal, StyleSheet, View } from "react-native";

import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import type { BoardMode } from "@/lib/game/boardConfig";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import type { LbPhase } from "@/lib/hooks/useLocalLimitbreaker";
import type { SeriesPlayer } from "@/lib/hooks/seriesConfig";
import { colors, radii, space } from "@/theme/tokens";

interface LimitbreakerOverlayProps {
  visible: boolean;
  phase: LbPhase | null;
  tossWinner: PlayerSlot | null;
  coinResult: "PENTA" | "PROTO" | null;
  mySlot: PlayerSlot;
  nextSlot: PlayerSlot;
  bans: BoardMode[];
  remainingBoard: BoardMode;
  onPickChoice: (c: "choose_first_player" | "ban_first") => void;
  onPickFirst: (fp: SeriesPlayer) => void;
  onPickBan: (mode: BoardMode) => void;
}

export function LimitbreakerOverlay({
  visible,
  phase,
  tossWinner,
  coinResult,
  mySlot,
  nextSlot,
  bans,
  remainingBoard,
  onPickChoice,
  onPickFirst,
  onPickBan,
}: LimitbreakerOverlayProps) {
  const isMyTurn = nextSlot === mySlot;

  let body = null;
  if (phase === "coin") {
    body = (
      <>
        <Title style={styles.splashTitle}>LIMITBREAKER</Title>
        <Caption tone="muted">{coinResult ?? "Flipping coin…"}</Caption>
        {tossWinner ? (
          <Caption tone="accent" style={{ marginTop: space[2] }}>
            {tossWinner} wins the toss
          </Caption>
        ) : null}
      </>
    );
  } else if (phase === "choice" && isMyTurn) {
    body = (
      <>
        <Heading>Your choice</Heading>
        <View style={{ gap: space[3], width: "100%", marginTop: space[4] }}>
          <Btn variant="primary" onPress={() => onPickChoice("choose_first_player")}>
            Pick who goes first
          </Btn>
          <Btn variant="secondary" onPress={() => onPickChoice("ban_first")}>
            Ban board sizes first
          </Btn>
        </View>
      </>
    );
  } else if (phase === "pick_first" && isMyTurn) {
    body = (
      <>
        <Heading>Who opens G10?</Heading>
        <View style={{ gap: space[3], width: "100%", marginTop: space[4] }}>
          <Btn variant="primary" onPress={() => onPickFirst("P1")}>
            P1 (you) first
          </Btn>
          <Btn variant="secondary" onPress={() => onPickFirst("P2")}>
            P2 first
          </Btn>
        </View>
      </>
    );
  } else if ((phase === "ban_first" || phase === "ban_second") && isMyTurn) {
    const modes: BoardMode[] = ["5x5", "6x6", "7x7"];
    body = (
      <>
        <Heading>Ban a board size</Heading>
        <Caption tone="muted" style={{ marginBottom: space[3] }}>
          Banned: {bans.length ? bans.join(", ") : "none"}
        </Caption>
        <View style={{ gap: space[2], width: "100%" }}>
          {modes
            .filter((m) => !bans.includes(m))
            .map((m) => (
              <Btn key={m} variant="secondary" onPress={() => onPickBan(m)}>
                Ban {m}
              </Btn>
            ))}
        </View>
      </>
    );
  } else if (phase === "summary") {
    body = (
      <>
        <Heading>Rules locked</Heading>
        <Caption tone="muted">
          G10 on {remainingBoard} — starting…
        </Caption>
      </>
    );
  } else {
    body = <Caption tone="muted">Waiting for opponent…</Caption>;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone="accent">PROTOCOLBREAKER</Eyebrow>
          {body}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[6],
    alignItems: "center",
  },
  splashTitle: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
    marginVertical: space[4],
  },
});
