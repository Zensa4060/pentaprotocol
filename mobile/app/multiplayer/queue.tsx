/**
 * Ranked / unranked matchmaking queue.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Spinner,
  Title,
} from "@/components/ui";
import type { BoardMode } from "@/lib/game/boardConfig";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import {
  isQueueMatched,
  joinQueue,
  leaveQueue,
  pollQueueStatus,
  QueueError,
} from "@/lib/multiplayer/queue";
import type { PlayerSlot, RoomFormat } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

export default function MatchmakingQueueScreen() {
  const params = useLocalSearchParams<{ format?: string; board?: string }>();
  const format: RoomFormat = params.format === "ranked" ? "ranked" : "unranked";
  const boardMode: BoardMode | "5x5_6x6_7x7" =
    format === "ranked" ? "5x5_6x6_7x7" : ((params.board as BoardMode) ?? "5x5");

  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const roomCodeRef = useRef<string | null>(null);
  const slotRef = useRef<PlayerSlot>("P1");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useLobbyBgm();

  const goLobby = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/multiplayer");
  };

  const cancel = useCallback(async () => {
    if (cancelling) return;
    cancelledRef.current = true;
    setCancelling(true);
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await leaveQueue(format, boardMode, roomCodeRef.current ?? undefined);
    } catch {
      /* best effort */
    }
    goLobby();
  }, [boardMode, cancelling, format]);

  useEffect(() => {
    cancelledRef.current = false;
    let tick: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await joinQueue(format, boardMode);
        if (cancelledRef.current) return;
        roomCodeRef.current = res.room_code;
        slotRef.current = res.player_slot;

        if (res.matched && res.room && isQueueMatched(res.room, res.player_slot)) {
          router.replace({
            pathname: "/multiplayer/match",
            params: { code: res.room_code, slot: res.player_slot },
          });
          return;
        }

        pollRef.current = setInterval(async () => {
          const code = roomCodeRef.current;
          if (!code || cancelledRef.current) return;
          try {
            const room = await pollQueueStatus(code);
            if (isQueueMatched(room, slotRef.current)) {
              if (pollRef.current) clearInterval(pollRef.current);
              router.replace({
                pathname: "/multiplayer/match",
                params: { code, slot: slotRef.current },
              });
            }
          } catch {
            /* keep polling */
          }
        }, 2000);
      } catch (err) {
        if (cancelledRef.current) return;
        const msg = err instanceof QueueError ? err.message : "Could not join queue.";
        setError(msg);
        if (err instanceof QueueError && err.status === 403) {
          Alert.alert("Queue unavailable", msg, [{ text: "OK", onPress: goLobby }]);
        }
      }
    })();

    tick = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      cancelledRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (tick) clearInterval(tick);
    };
  }, [boardMode, format]);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={cancel} hitSlop={12}>
        <Caption tone="muted">← CANCEL</Caption>
      </Pressable>

      <View style={styles.center}>
        <Eyebrow tone="accent">{format === "ranked" ? "RANKED" : "UNRANKED"} QUEUE</Eyebrow>
        <Title style={{ marginTop: space[3] }}>Searching…</Title>
        <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
          {format === "ranked"
            ? "Matching by hidden MMR across 5×5 → 6×6 → 7×7 legs."
            : `Board: ${boardMode} · waiting for an opponent.`}
        </Body>
        <Text style={styles.timer}>
          {mm}:{ss}
        </Text>
        {!error ? <Spinner style={{ marginTop: space[6] }} /> : null}
        {error ? (
          <Caption tone="warn" style={{ marginTop: space[4], textAlign: "center" }}>
            {error}
          </Caption>
        ) : null}
      </View>

      <View style={{ marginTop: space[8] }}>
        <Btn variant="secondary" onPress={cancel} disabled={cancelling}>
          {cancelling ? "Leaving…" : "Cancel search"}
        </Btn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: space[10],
  },
  timer: {
    marginTop: space[5],
    color: colors.accent,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
