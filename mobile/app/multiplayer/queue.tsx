/**
 * Ranked / unranked matchmaking queue.
 *
 * Redesign (UI only): a centered matchmaking "radar" — a pulsing accent ring
 * around the live search timer — over the void canvas, matching the rest of
 * the app. All queue / poll / bot-filler / timeout logic is unchanged.
 */

import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Screen,
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

  const clearBotTimer = () => {
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
  };

  const goMatchFound = useCallback(
    (routeParams: Record<string, string>) => {
      if (matchedRef.current) return;
      matchedRef.current = true;
      clearBotTimer();
      if (pollRef.current) clearInterval(pollRef.current);
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

        // NOTE: no room socket while queueing. Matchmaker liveness is
        // satisfied by the session-wide global-notify socket; a queue-time
        // room socket would disconnect on the match-found navigation and
        // (pre-move) trip the server's reconnect machinery for no benefit.

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardMode, format, retryKey]);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={cancel} hitSlop={12}>
        <Caption tone="muted">‹  CANCEL</Caption>
      </Pressable>

      <View style={styles.center}>
        <Eyebrow tone="accent" style={{ letterSpacing: 2 }}>
          {format === "ranked" ? "RANKED" : "UNRANKED"} QUEUE
        </Eyebrow>
        {timedOut ? (
          <>
            <View style={styles.idleOrb}>
              <Text style={styles.orbX}>×</Text>
            </View>
            <Title style={{ marginTop: space[5] }}>No opponent found</Title>
            <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
              We couldn&apos;t match you within {SEARCH_TIMEOUT_S}s. The queue may be quiet right now —
              try again, or play the AI Bot offline.
            </Body>
          </>
        ) : (
          <>
            <RadarRing>
              <Text style={styles.timer}>
                {mm}:{ss}
              </Text>
              <Caption tone="dim" style={{ letterSpacing: 1.5, marginTop: 2 }}>SEARCHING</Caption>
            </RadarRing>
            <Title style={{ marginTop: space[6] }}>Finding a match…</Title>
            <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
              {format === "ranked"
                ? "Matching by hidden MMR across 5×5 → 6×6 → 7×7 legs."
                : "Full leg · 5×5 → 6×6 → 7×7 · a filler bot may join after ~10s."}
            </Body>
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

/** Matchmaking radar — two concentric static rings + an outward-pulsing ring. */
function RadarRing({ children }: { children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    const l1 = mk(a, 0);
    const l2 = mk(b, 1100);
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [a, b]);

  const ring = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.85] }) }],
    opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.55, 0] }),
  });

  return (
    <View style={styles.ringWrap}>
      <Animated.View style={[styles.pulseRing, ring(a)]} />
      <Animated.View style={[styles.pulseRing, ring(b)]} />
      <View style={styles.ringMid} />
      <View style={styles.ringCore}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: space[8],
  },
  ringWrap: {
    width: 220,
    height: 220,
    marginTop: space[6],
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  ringMid: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ringCore: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1.5,
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    color: colors.accent,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 2,
  },
  idleOrb: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space[6],
  },
  orbX: {
    color: colors.textDim,
    fontSize: 44,
    fontWeight: "300",
  },
});
