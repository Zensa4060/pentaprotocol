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
import { gridFromBoardMode } from "@/lib/game/boardConfig";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import {
  isQueueMatched,
  joinQueue,
  leaveQueue,
  pollQueueStatus,
  QueueError,
} from "@/lib/multiplayer/queue";
import type { PlayerSlot, RoomFormat } from "@/lib/multiplayer/types";
import { openMatchSocket, type MatchSocket } from "@/lib/multiplayer/ws";
import { colors, radii, space } from "@/theme/tokens";

export default function MatchmakingQueueScreen() {
  const params = useLocalSearchParams<{ format?: string }>();
  const format: RoomFormat = params.format === "ranked" ? "ranked" : "unranked";
  // Every multiplayer match is a full leg (board progresses 5×5 → 6×6 → 7×7),
  // so we always queue into the same pool the web uses. No per-board sub-queues
  // — that isolation was why mobile unranked never found an opponent.
  const boardMode = "5x5_6x6_7x7" as const;

  /** Stop searching and surface a clear message after this long with no match. */
  const SEARCH_TIMEOUT_S = 45;

  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const roomCodeRef = useRef<string | null>(null);
  const slotRef = useRef<PlayerSlot>("P1");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  /** Liveness socket: held open while waiting so the matchmaker can pair us. */
  const socketRef = useRef<MatchSocket | null>(null);

  const closeSocket = () => {
    socketRef.current?.close();
    socketRef.current = null;
  };

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
    closeSocket();
    try {
      await leaveQueue(format, boardMode, roomCodeRef.current ?? undefined);
    } catch {
      /* best effort */
    }
    goLobby();
  }, [boardMode, cancelling, format]);

  /** Give up gracefully — leave the queue and show a no-opponent state. */
  const giveUp = useCallback(async () => {
    cancelledRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    closeSocket();
    try {
      await leaveQueue(format, boardMode, roomCodeRef.current ?? undefined);
    } catch {
      /* best effort */
    }
    setTimedOut(true);
  }, [boardMode, format]);

  const retry = useCallback(() => {
    setTimedOut(false);
    setError(null);
    setElapsed(0);
    roomCodeRef.current = null;
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    setTimedOut(false);
    let tick: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await joinQueue(format, boardMode);
        if (cancelledRef.current) return;
        roomCodeRef.current = res.room_code;
        slotRef.current = res.player_slot;

        if (res.matched && res.room && isQueueMatched(res.room, res.player_slot)) {
          router.replace({
            pathname: "/pregame",
            params: {
              mode: "multiplayer",
              code: res.room_code,
              slot: res.player_slot,
              grid: gridFromBoardMode(res.room.board_mode) === 5 ? "5" : gridFromBoardMode(res.room.board_mode) === 6 ? "6" : "7",
            },
          });
          return;
        }

        // Waiting for an opponent — hold a socket open to our room so the
        // matchmaker's liveness check pairs us (it skips players with no WS).
        socketRef.current = openMatchSocket({
          roomCode: res.room_code,
          slot: res.player_slot,
          onMessage: () => undefined,
          onStatus: () => undefined,
        });

        pollRef.current = setInterval(async () => {
          const code = roomCodeRef.current;
          if (!code || cancelledRef.current) return;
          try {
            const room = await pollQueueStatus(code);
            if (isQueueMatched(room, slotRef.current)) {
              if (pollRef.current) clearInterval(pollRef.current);
              closeSocket();
              const g = gridFromBoardMode(room.board_mode);
              router.replace({
                pathname: "/pregame",
                params: {
                  mode: "multiplayer",
                  code,
                  slot: slotRef.current,
                  grid: g === 5 ? "5" : g === 6 ? "6" : "7",
                },
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

    tick = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= SEARCH_TIMEOUT_S && !cancelledRef.current) {
          if (tick) clearInterval(tick);
          void giveUp();
        }
        return next;
      });
    }, 1000);

    return () => {
      cancelledRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (tick) clearInterval(tick);
      closeSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardMode, format, retryKey]);

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
        {timedOut ? (
          <>
            <Title style={{ marginTop: space[3] }}>No opponent found</Title>
            <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
              We couldn&apos;t match you within {SEARCH_TIMEOUT_S}s. The queue may be quiet right now —
              try again, or play the AI Bot offline.
            </Body>
          </>
        ) : (
          <>
            <Title style={{ marginTop: space[3] }}>Searching…</Title>
            <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
              {format === "ranked"
                ? "Matching by hidden MMR across 5×5 → 6×6 → 7×7 legs."
                : "Full leg · 5×5 → 6×6 → 7×7 · waiting for an opponent."}
            </Body>
            <Text style={styles.timer}>
              {mm}:{ss}
            </Text>
            {!error ? <Spinner style={{ marginTop: space[6] }} /> : null}
          </>
        )}
        {error ? (
          <Caption tone="warn" style={{ marginTop: space[4], textAlign: "center" }}>
            {error}
          </Caption>
        ) : null}
      </View>

      <View style={{ marginTop: space[8] }}>
        {timedOut ? (
          <>
            <Btn variant="primary" onPress={retry}>
              Search again
            </Btn>
            <View style={{ height: space[3] }} />
            <Btn variant="secondary" onPress={goLobby}>
              Back to lobby
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onPress={cancel} disabled={cancelling}>
            {cancelling ? "Leaving…" : "Cancel search"}
          </Btn>
        )}
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
