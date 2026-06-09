/**
 * Multiplayer Limitbreaker (G10 decider) — server-authoritative phases.
 */

import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";

import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import type { MpLimitbreakerState } from "@/lib/multiplayer/matchResult";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

interface MpLimitbreakerOverlayProps {
  visible: boolean;
  state: MpLimitbreakerState;
  mySlot: PlayerSlot;
  onAction: (payload: {
    choice?: "choose_first_player" | "ban_first";
    first_player?: PlayerSlot;
    board_mode?: string;
  }) => void;
}

export function MpLimitbreakerOverlay({
  visible,
  state,
  mySlot,
  onAction,
}: MpLimitbreakerOverlayProps) {
  const isMyTurn = state.nextSlot === mySlot;
  const [coinSecs, setCoinSecs] = useState(0);

  useEffect(() => {
    if (!visible || state.phase !== "coin" || state.coinDueMs == null) {
      setCoinSecs(0);
      return;
    }
    const tick = () => {
      setCoinSecs(Math.max(0, Math.ceil((state.coinDueMs! - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [visible, state.phase, state.coinDueMs]);

  const phaseTitle =
    state.phase === "coin"
      ? "COIN TOSS"
      : state.phase === "choice"
        ? "CHOOSE THE TRACK"
        : state.phase === "choose_first_player"
          ? "CHOOSE WHO PLAYS FIRST"
          : state.phase === "ban_first"
            ? "FIRST BOARD BAN"
            : "SECOND BOARD BAN";

  let body = null;
  if (state.phase === "coin") {
    body = (
      <>
        <Caption tone="muted" center>
          Series tied at {state.p1SeriesPts}–{state.p2SeriesPts}. G10 decides the match.
        </Caption>
        <Caption tone="accent" style={{ marginTop: space[3] }}>
          {state.tossWinner} won the toss
        </Caption>
        {coinSecs > 0 ? (
          <Caption tone="muted" style={{ marginTop: space[2] }}>
            Next step in {coinSecs}s…
          </Caption>
        ) : (
          <Caption tone="muted" style={{ marginTop: space[2] }}>
            Preparing next step…
          </Caption>
        )}
      </>
    );
  } else if (state.phase === "choice" && isMyTurn) {
    body = (
      <View style={styles.actions}>
        <Btn variant="primary" onPress={() => onAction({ choice: "choose_first_player" })}>
          Pick who goes first
        </Btn>
        <Btn variant="secondary" onPress={() => onAction({ choice: "ban_first" })}>
          Ban board sizes first
        </Btn>
      </View>
    );
  } else if (state.phase === "choose_first_player" && isMyTurn) {
    body = (
      <View style={styles.actions}>
        <Btn variant="primary" onPress={() => onAction({ first_player: "P1" })}>
          P1 opens G10
        </Btn>
        <Btn variant="secondary" onPress={() => onAction({ first_player: "P2" })}>
          P2 opens G10
        </Btn>
      </View>
    );
  } else if ((state.phase === "ban_first" || state.phase === "ban_second") && isMyTurn) {
    const modes = ["5x5", "6x6", "7x7"].filter((m) => !state.bans.includes(m));
    body = (
      <View style={styles.actions}>
        <Caption tone="muted" center style={{ marginBottom: space[2] }}>
          Banned: {state.bans.length ? state.bans.join(", ") : "none"}
        </Caption>
        {modes.map((m) => (
          <Btn key={m} variant="secondary" onPress={() => onAction({ board_mode: m })}>
            Ban {m}
          </Btn>
        ))}
      </View>
    );
  } else {
    body = <Caption tone="muted">Waiting for opponent…</Caption>;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone="accent">LIMITBREAKER</Eyebrow>
          <Title style={styles.splashTitle}>G10 DECIDER</Title>
          <Heading style={{ marginBottom: space[3], textAlign: "center" }}>{phaseTitle}</Heading>
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
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
    marginVertical: space[3],
  },
  actions: {
    gap: space[3],
    width: "100%",
    marginTop: space[2],
  },
});
