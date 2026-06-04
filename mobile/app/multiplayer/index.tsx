/**
 * Multiplayer lobby.
 *
 * Three actions:
 *   - **Create room**: spins up a private 7×7 unranked room and
 *     navigates to the waiting screen (showing the joinable code).
 *   - **Join by code**: prompts for the 4-char code and joins.
 *   - **Rejoin**: surfaces when ``/api/room/active/check`` finds
 *     the user is mid-match — bypasses the lobby entirely.
 *
 * v1 deliberately ships a private-rooms-only flow (no public
 * matchmaking, no ranked queue, no chat). Most invites in the wild
 * happen through a friend channel anyway (share the 4-char code
 * over messages), and the queue server-side is more complex to
 * surface honestly without skin-level cosmetics.
 */

import { router, Stack, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Spinner,
  Stack as VStack,
  TextField,
  Title,
} from "@/components/ui";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import { useAuthStore } from "@/lib/store";
import {
  createRoom,
  getActiveRoom,
  joinRoom,
  RoomError,
} from "@/lib/multiplayer/rooms";
import type { ActiveRoomCheck } from "@/lib/multiplayer/types";
import { gridFromBoardMode, type BoardMode } from "@/lib/game/boardConfig";
import { colors, radii, space } from "@/theme/tokens";

export default function MultiplayerLobby() {
  const user = useAuthStore((s) => s.user);
  useLobbyBgm();
  const [code, setCode] = useState("");
  const [active, setActive] = useState<ActiveRoomCheck | null>(null);
  const [activeChecking, setActiveChecking] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>("7x7");

  // ── Active-room probe ───────────────────────────────────────
  // Run on every focus so a backgrounded app that comes back has
  // a fresh state — a match that timed out in the meantime
  // shouldn't leave a stale "rejoin" banner up.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setActiveChecking(true);
      getActiveRoom()
        .then((res) => {
          if (cancelled) return;
          setActive(res.room_code ? res : null);
        })
        .catch(() => {
          if (cancelled) return;
          setActive(null);
        })
        .finally(() => {
          if (cancelled) return;
          setActiveChecking(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const onCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const room = await createRoom(boardMode);
      router.replace({
        pathname: "/multiplayer/waiting",
        params: {
          code: room.room_code,
          slot: room.player_slot ?? "P1",
        },
      });
    } catch (err) {
      const msg = err instanceof RoomError && err.detail ? err.detail : "Could not create room.";
      Alert.alert("Try again", msg);
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async () => {
    if (joining) return;
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      Alert.alert("Bad code", "Enter the room code your opponent shared.");
      return;
    }
    setJoining(true);
    try {
      const room = await joinRoom(cleaned);
      // After joining, the server flips status to "active". Show the
      // pre-game lobby (rules / patterns / ready) before the board.
      const g = gridFromBoardMode(room.board_mode);
      router.replace({
        pathname: "/pregame",
        params: {
          mode: "multiplayer",
          code: room.room_code,
          slot: room.player_slot ?? "P2",
          grid: g === 5 ? "5" : g === 6 ? "6" : "7",
        },
      });
    } catch (err) {
      const msg = err instanceof RoomError && err.detail ? err.detail : "Could not join room.";
      Alert.alert("Couldn't join", msg);
    } finally {
      setJoining(false);
    }
  };

  const onRejoin = () => {
    if (!active?.room_code || !active.player_slot) return;
    router.push({
      pathname: "/multiplayer/match",
      params: { code: active.room_code, slot: active.player_slot },
    });
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <Eyebrow tone="muted">MULTIPLAYER</Eyebrow>
        <Title>Multiplayer</Title>
        <Body tone="muted">
          Queue for ranked or unranked matches, or create a private room for a friend.
        </Body>
      </VStack>

      <Eyebrow tone="muted" style={{ marginTop: space[6], marginBottom: space[2] }}>
        MATCHMAKING
      </Eyebrow>
      <Row gap={3}>
        <View style={{ flex: 1 }}>
          <Btn
            variant="primary"
            onPress={() =>
              router.push({
                pathname: "/multiplayer/queue",
                params: { format: "unranked", board: boardMode },
              } as unknown as Href)
            }
          >
            Unranked queue
          </Btn>
        </View>
        <View style={{ flex: 1 }}>
          <Btn
            variant="secondary"
            disabled={(user?.level ?? 1) < 5 || !user?.ranked_allowed}
            onPress={() =>
              router.push({
                pathname: "/multiplayer/queue",
                params: { format: "ranked" },
              } as unknown as Href)
            }
          >
            Ranked queue
          </Btn>
        </View>
      </Row>
      {(user?.level ?? 1) < 5 ? (
        <Caption tone="warn" style={{ marginTop: space[2] }}>
          Ranked unlocks at account level 5.
        </Caption>
      ) : null}

      <Eyebrow tone="muted" style={{ marginTop: space[6], marginBottom: space[2] }}>
        BOARD SIZE (PRIVATE CREATE)
      </Eyebrow>
      <Row gap={2}>
        {(["5x5", "6x6", "7x7"] as BoardMode[]).map((mode) => {
          const on = boardMode === mode;
          const label = mode.replace("x", "×");
          return (
            <Pressable
              key={mode}
              onPress={() => setBoardMode(mode)}
              style={[styles.sizeChip, on && styles.sizeChipOn]}
            >
              <Caption tone={on ? "accent" : "muted"} style={{ fontWeight: "800" }}>
                {label}
              </Caption>
            </Pressable>
          );
        })}
      </Row>

      {/* ── Active match banner ────────────────────────────────── */}
      {activeChecking ? (
        <Row gap={2} align="center" style={{ marginTop: space[6] }}>
          <Spinner tone="muted" />
          <Caption tone="muted">Checking for active matches…</Caption>
        </Row>
      ) : active ? (
        <View style={styles.activeBanner}>
          <Eyebrow tone="accent">REJOIN</Eyebrow>
          <View style={{ height: space[2] }} />
          <Body>
            You have an active match in room {" "}
            <Body tone="accent" style={{ fontWeight: "800" }}>
              {active.room_code}
            </Body>
            .
          </Body>
          <View style={{ height: space[3] }} />
          <Btn variant="primary" onPress={onRejoin}>
            Rejoin match
          </Btn>
        </View>
      ) : null}

      {/* ── Create ─────────────────────────────────────────────── */}
      <Eyebrow tone="muted" style={{ marginTop: space[8], marginBottom: space[3] }}>
        CREATE A ROOM
      </Eyebrow>
      <View style={styles.actionCard}>
        <Body tone="muted">
          Creates a {boardMode.replace("x", "×")} room — opponent must join the same board size.
        </Body>
        <View style={{ height: space[4] }} />
        <Btn variant="primary" size="lg" loading={creating} onPress={onCreate}>
          Create room
        </Btn>
      </View>

      {/* ── Join ───────────────────────────────────────────────── */}
      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[3] }}>
        JOIN BY CODE
      </Eyebrow>
      <View style={styles.actionCard}>
        <TextField
          label="Room code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABCD"
          characterCount={{ current: code.length, max: 4 }}
        />
        <View style={{ height: space[4] }} />
        <Btn
          variant="secondary"
          size="lg"
          loading={joining}
          disabled={code.length < 4 || joining}
          onPress={onJoin}
        >
          Join
        </Btn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sizeChip: {
    flex: 1,
    paddingVertical: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: "center",
  },
  sizeChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.bgRaised,
  },
  actionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
  },
  activeBanner: {
    marginTop: space[6],
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
});
