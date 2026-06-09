/**
 * Ranked / unranked matchmaking queue.
 */

import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
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
import {
  fillerMatchFoundParams,
  humanMatchFoundParams,
} from "@/lib/multiplayer/matchFound";
import { useLobbyBgm } from "@/lib/hooks/useMatchSounds";
import {
  isQueueMatched,
  joinQueue,
  leaveQueue,
  pollQueueStatus,
  QueueError,
} from "@/lib/multiplayer/queue";
import type { PlayerSlot, RoomFormat } from "@/lib/multiplayer/types";
import { openMatchSocket, waitForSocketOpen, type MatchSocket } from "@/lib/multiplayer/ws";
import {
  isUnrankedBotsAllowed,
  numericLevelForTier,
  pickQueueWaitMs,
  pickRandomPatterns5x5,
  pickUnrankedBot,
  pickUnrankedBotBanner,
  pickUnrankedBotEmoji,
} from "@/lib/unrankedBots";
import { colors, space } from "@/theme/tokens";

export default function MatchmakingQueueScreen() {
  const params = useLocalSearchParams<{ format?: string }>();
  const format: RoomFormat = params.format === "ranked" ? "ranked" : "unranked";
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
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchedRef = useRef(false);
  const cancelledRef = useRef(false);
  const socketRef = useRef<MatchSocket | null>(null);

  const clearBotTimer = () => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
  };

  const closeSocket = () => {
    socketRef.current?.close();
    socketRef.current = null;
  };

  const goMatchFound = useCallback(
    (routeParams: Record<string, string>) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      clearBotTimer();
      if (pollRef.current) clearInterval(pollRef.current);
      closeSocket();
      router.replace({
        pathname: "/multiplayer/match-found",
        params: routeParams,
      } as unknown as Href);
    },
    [],
  );

  useLobbyBgm();

  const goLobby = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/multiplayer");
  };

  const cancel = useCallback(async () => {
    if (cancelling) return;
    cancelledRef.current = true;
    setCancelling(true);
    clearBotTimer();
    if (pollRef.current) clearInterval(pollRef.current);
    closeSocket();
    try {
      await leaveQueue(format, boardMode, roomCodeRef.current ?? undefined);
    } catch {
      /* best effort */
    }
    goLobby();
  }, [boardMode, cancelling, format]);

  const giveUp = useCallback(async () => {
    cancelledRef.current = true;
    clearBotTimer();
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
    matchedRef.current = false;
    setTimedOut(false);
    setError(null);
    setElapsed(0);
    roomCodeRef.current = null;
    setRetryKey((k) => k + 1);
  }, []);

  const scheduleUnrankedBot = useCallback(
    async (queueCode: string) => {
      const allowed = await isUnrankedBotsAllowed();
      if (!allowed) return;

      clearBotTimer();
      const waitMs = pickQueueWaitMs();
      botTimerRef.current = setTimeout(async () => {
        botTimerRef.current = null;
        if (cancelledRef.current || matchedRef.current) return;
        if (!(await isUnrankedBotsAllowed())) return;

        const bot = pickUnrankedBot();
        const patterns = pickRandomPatterns5x5();
        const botLevel = numericLevelForTier(bot.level);
        const botEmoji = bot.isSyros ? "" : pickUnrankedBotEmoji();
        const botBanner = bot.isSyros ? "void_rift" : pickUnrankedBotBanner();

        try {
          await leaveQueue(format, boardMode, queueCode);
        } catch {
          /* proceed into filler match even if leave fails */
        }

        goMatchFound(
          fillerMatchFoundParams({
            botName: bot.name,
            botTier: bot.level,
            botLevel,
            botEmoji,
            botBanner,
            isSyros: bot.isSyros,
            patterns,
          }),
        );
      }, waitMs);
    },
    [boardMode, format, goMatchFound],
  );

  useEffect(() => {
    cancelledRef.current = false;
    matchedRef.current = false;
    setTimedOut(false);
    let tick: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const res = await joinQueue(format, boardMode);
        if (cancelledRef.current) return;
        roomCodeRef.current = res.room_code;
        slotRef.current = res.player_slot;

        if (res.matched && res.room && isQueueMatched(res.room, res.player_slot)) {
          goMatchFound(
            humanMatchFoundParams(format, res.room_code, res.player_slot, res.room),
          );
          return;
        }

        socketRef.current = openMatchSocket({
          roomCode: res.room_code,
          slot: res.player_slot,
          onMessage: () => undefined,
          onStatus: () => undefined,
        });
        try {
          await waitForSocketOpen(socketRef.current);
        } catch {
          /* global notify may still satisfy liveness; keep polling */
        }

        if (format === "unranked") {
          void scheduleUnrankedBot(res.room_code);
        }

        pollRef.current = setInterval(async () => {
          const code = roomCodeRef.current;
          if (!code || cancelledRef.current || matchedRef.current) return;
          try {
            const room = await pollQueueStatus(code);
            if (isQueueMatched(room, slotRef.current)) {
              goMatchFound(
                humanMatchFoundParams(format, code, slotRef.current, room),
              );
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
        if (next >= SEARCH_TIMEOUT_S && !cancelledRef.current && !matchedRef.current) {
          if (tick) clearInterval(tick);
          void giveUp();
        }
        return next;
      });
    }, 1000);

    return () => {
      cancelledRef.current = true;
      clearBotTimer();
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
                : "Full leg · 5×5 → 6×6 → 7×7 · a filler bot may join after ~10s."}
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
