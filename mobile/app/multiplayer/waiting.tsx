/**
 * Waiting-for-opponent screen.
 *
 * Reached after the creator finishes ``/api/room/create``. Shows
 * the joinable room code (big + copyable + shareable), opens a
 * WebSocket to the room so we get notified when the opponent
 * arrives, and routes to the match screen as soon as the room
 * transitions to ``active``.
 *
 * We also offer:
 *   - **Share**: native share sheet with a short invite string.
 *   - **Cancel**: forfeits + leaves the room. Necessary because
 *     a creator who closes the app without explicit cancel would
 *     otherwise have to wait for the server's stale-room cleanup
 *     before they could create another.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";

import {
  Body,
  Btn,
  Caption,
  Heading,
  Row,
  Screen,
  Spinner,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { SectionLabel } from "@/components/ui/hud";
import {
  forfeitMatch,
  RoomError,
} from "@/lib/multiplayer/rooms";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { useMatchSocket } from "@/lib/multiplayer/useMatchSocket";
import { gridParamFromBoardMode } from "@/lib/game/boardConfig";
import { colors, radii, space } from "@/theme/tokens";

export default function MultiplayerWaiting() {
  const params = useLocalSearchParams<{ code?: string; slot?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const slot: PlayerSlot = params.slot === "P2" ? "P2" : "P1";

  const { room, status, disbanded } = useMatchSocket({ roomCode: code, slot });

  // ── Auto-transition once P2 joins ─────────────────────────
  // The server flips the room's ``status`` to "active" inside the
  // /join endpoint and also broadcasts a ``player_joined`` frame
  // to the creator's socket. Either path lands us here with
  // ``room.status === 'active'``, so we just react to that.
  useEffect(() => {
    if (!room) return;
    if (room.status === "active") {
      router.replace({
        pathname: "/pregame",
        params: {
          mode: "multiplayer",
          code,
          slot,
          grid: gridParamFromBoardMode(room.board_mode),
          board_mode: room.board_mode,
        },
      });
    }
  }, [room, code, slot]);

  // ── Server disbanded the room while we were waiting ────────
  useEffect(() => {
    if (!disbanded) return;
    Alert.alert(
      "Match cancelled",
      disbanded.reason ?? "The match was cancelled by the server.",
      [
        {
          text: "Back to lobby",
          onPress: () => router.replace("/multiplayer"),
        },
      ],
    );
  }, [disbanded]);

  // The native share sheet on both iOS and Android exposes a
  // "Copy" action, so we route the dedicated "Copy code" button
  // through Share as well. This lets us avoid the ``expo-clipboard``
  // native module dependency (which requires a fresh dev build to
  // be available — Expo Go and stale dev clients crash on require).
  const onCopy = async () => {
    if (!code) return;
    try {
      await Share.share({ message: code });
    } catch {
      // Share sheet dismissed.
    }
  };

  const onShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Play me on PentaProtocol — join room ${code}.`,
      });
    } catch {
      // Share dialog dismissed; nothing to do.
    }
  };

  const onCancel = () => {
    Alert.alert(
      "Cancel the room?",
      "Your opponent won't be able to join with this code anymore.",
      [
        { text: "Keep waiting", style: "cancel" },
        {
          text: "Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await forfeitMatch(code);
            } catch (err) {
              // Even if forfeit fails (e.g. room was already cleaned
              // up), bounce back to the lobby — the user's choice
              // was to leave.
              if (err instanceof RoomError && __DEV__) {
                console.warn("[waiting] forfeit failed", err);
              }
            }
            router.replace("/multiplayer");
          },
        },
      ],
    );
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">‹  CANCEL</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <SectionLabel label="ROOM CODE — SHARE WITH A FRIEND" />
        <View style={styles.codeBox}>
          <Heading style={styles.code}>{code || "----"}</Heading>
        </View>
        <Row gap={3} justify="center" style={{ marginTop: space[4] }}>
          <View style={{ flex: 1 }}>
            <Btn variant="secondary" onPress={onCopy}>
              Copy code
            </Btn>
          </View>
          <View style={{ flex: 1 }}>
            <Btn variant="primary" onPress={onShare}>
              Share
            </Btn>
          </View>
        </Row>
      </VStack>

      <View style={{ flex: 1 }} />

      <View style={styles.statusBox}>
        <Row gap={3} align="center" justify="center">
          <Spinner tone="muted" />
          <Title>Waiting for opponent…</Title>
        </Row>
        <Body tone="muted" center style={{ marginTop: space[2] }}>
          {status === "connecting" || status === "reconnecting"
            ? "Connecting to the server…"
            : "Send the code to a friend. They tap Join in the lobby."}
        </Body>
      </View>

      <View style={{ flex: 1 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    paddingVertical: space[7],
    alignItems: "center",
    justifyContent: "center",
  },
  code: {
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 8,
    fontWeight: "900",
  },
  statusBox: {
    paddingVertical: space[5],
  },
});
