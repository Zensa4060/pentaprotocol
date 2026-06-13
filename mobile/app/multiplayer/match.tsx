/**
 * Multiplayer match screen — web ``GameScreen`` + ``MatchSidebar`` parity,
 * stacked for phones.
 *
 * Server frames are the source of truth (``room.py``): every state
 * transition arrives over the WS; this screen renders one ``room``
 * snapshot. On top of the board it carries the sidebar features:
 *   - both players' match clocks (client-ticked, server-authoritative
 *     flag fall via the ``timeout`` frame),
 *   - chat with an unread badge,
 *   - per-game move log (server-seeded on rejoin),
 *   - full match history G1…LIMITB with breaker rows,
 *   - add friend / report during the match,
 *   - head-to-head record vs the opponent,
 *   - Protocol Breakers (Rulebreaker / Timebreaker / Mindbreaker) via
 *     ``RulebreakerOverlay`` and the Limitbreaker decider.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Card,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Spinner,
  Title,
} from "@/components/ui";
import { BoardGrid } from "@/components/game/BoardGrid";
import {
  ExtraTurnTokenRow,
  MatchClockRow,
  MoveLogPanel,
} from "@/components/game/MatchExtras";
import { MatchResultOverlay } from "@/components/game/MatchResultOverlay";
import { MpLimitbreakerOverlay } from "@/components/game/MpLimitbreakerOverlay";
import { PatternsToggle } from "@/components/game/PatternsToggle";
import { RulebreakerOverlay } from "@/components/game/RulebreakerOverlay";
import { RulesShowOverlay } from "@/components/game/RulesShowOverlay";
import { XpLevelUpOverlay } from "@/components/game/XpLevelUpOverlay";
import {
  ChatButton,
  ChatSheet,
  HeadToHeadCard,
  MatchHistoryPanel,
  MpReadyOverlay,
  type HeadToHead,
} from "@/components/multiplayer/MatchPanels";
import API from "@/lib/api";
import { isRbPhase } from "@/lib/multiplayer/rulebreakerPhases";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { legBoardLabel, legGameIndex } from "@/lib/audio/series";
import {
  emptyBoard,
  gridFromBoardMode,
  matchMsForGrid,
  TIMEBREAKER_CUT_MS,
} from "@/lib/game/boardConfig";
import { boardSideForGrid } from "@/lib/game/boardLayout";
import { formatClock } from "@/lib/game/matchRules";
import {
  useMatchGameBgm,
  useRulebreakerPendingSound,
} from "@/lib/hooks/useMatchSounds";
import type {
  PlayerSlot,
  Room,
} from "@/lib/multiplayer/types";
import { useMatchSocket } from "@/lib/multiplayer/useMatchSocket";
import { useAuthStore } from "@/lib/store";
import { listFriends, reportPlayer, sendPeerRequest } from "@/lib/social/friends";
import { colors, radii, space } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";

export default function MultiplayerMatch() {
  const params = useLocalSearchParams<{ code?: string; slot?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const slot: PlayerSlot = params.slot === "P2" ? "P2" : "P1";

  const {
    room,
    status,
    lastError,
    disbanded,
    placeStone,
    readyForNextGame,
    quitMatch,
    setOnGameScreen,
    dismissError,
    rbPhase,
    sendTossAction,
    sendUseExtraTurn,
    lbState,
    sendLimitbreakerAction,
    matchResult,
    dismissMatchResult,
    rulesReady,
    sendLevelupReady,
    winLine,
    readyStates,
    moveLog,
    chatMessages,
    unreadChat,
    sendChat,
    markChatRead,
    sendTimeout,
    reconnectCountdown,
  } = useMatchSocket({ roomCode: code, slot });

  const patchUser = useAuthStore((s) => s.patchUser);
  const [mpLevelUp, setMpLevelUp] = useState<{ from: number; to: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [headToHead, setHeadToHead] = useState<HeadToHead | null>(null);

  const audio = useGameAudio();
  const palette = usePalette();
  const { width: screenWidth } = useWindowDimensions();
  useMatchGameBgm();
  const prevGameStatus = useRef<string | null>(null);
  const gridSize = room ? gridFromBoardMode(room.board_mode) : 5;
  const boardSide = useMemo(
    () => boardSideForGrid(gridSize, screenWidth),
    [gridSize, screenWidth],
  );

  // Rules-show gate for the current leg (server `awaiting_*_rules_ready`).
  const rulesGateActive = Boolean(
    room &&
      !room.series_winner &&
      !room.awaiting_rulebreaker &&
      !room.awaiting_limitbreaker &&
      ((gridSize === 5 && room.awaiting_5x5_rules_ready) ||
        (gridSize === 6 && room.awaiting_6x6_rules_ready) ||
        (gridSize === 7 && room.awaiting_7x7_rules_ready)),
  );

  const inRulebreaker = rbPhase !== null && isRbPhase(rbPhase);
  useRulebreakerPendingSound(inRulebreaker || !!room?.awaiting_rulebreaker);

  // ── Match clocks ────────────────────────────────────────────
  // Client-ticked mirror of the server-side game pace (web parity —
  // the server doesn't stream clocks; both clients tick the current
  // player and either may report the flag fall, which the server
  // resolves authoritatively against `current_player`).
  const gameKey = `${room?.game_number ?? 0}|${room?.board_mode ?? ""}`;
  const [clocks, setClocks] = useState<Record<PlayerSlot, number>>({
    P1: matchMsForGrid(5),
    P2: matchMsForGrid(5),
  });
  const timeoutSentForRef = useRef<string | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    const r = roomRef.current;
    const grid = r ? gridFromBoardMode(r.board_mode) : 5;
    const base = matchMsForGrid(grid);
    let p1 = base;
    let p2 = base;
    if (grid === 6 && r?.rb6_timer_owner === "P1") p1 = TIMEBREAKER_CUT_MS;
    if (grid === 6 && r?.rb6_timer_owner === "P2") p2 = TIMEBREAKER_CUT_MS;
    setClocks({ P1: p1, P2: p2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey, room?.rb6_timer_owner]);

  const clocksRunning = Boolean(
    room &&
      room.game_status === "playing" &&
      !room.series_winner &&
      !inRulebreaker &&
      !room.awaiting_rulebreaker &&
      !rulesGateActive &&
      !lbState &&
      status === "open",
  );

  useEffect(() => {
    if (!clocksRunning || !room) return;
    const who = room.current_player;
    const id = setInterval(() => {
      setClocks((prev) => ({ ...prev, [who]: Math.max(0, prev[who] - 1000) }));
    }, 1000);
    return () => clearInterval(id);
  }, [clocksRunning, room?.current_player, room]);

  useEffect(() => {
    if (!room || room.game_status !== "playing") return;
    const who = room.current_player;
    if (clocks[who] > 0) return;
    if (timeoutSentForRef.current === gameKey) return;
    timeoutSentForRef.current = gameKey;
    sendTimeout();
  }, [clocks, room, gameKey, sendTimeout]);

  // ── Opponent reconnect countdown (server forfeits them at 0) ─
  const [, setCountdownTick] = useState(0);
  useEffect(() => {
    if (!reconnectCountdown) return;
    const id = setInterval(() => setCountdownTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [reconnectCountdown]);
  const opponentDropped =
    reconnectCountdown !== null && reconnectCountdown.slot !== slot;
  const reconnectRemaining = reconnectCountdown
    ? Math.max(0, Math.ceil((reconnectCountdown.deadlineMs - Date.now()) / 1000))
    : 0;

  // ── Head-to-head record (web MatchSidebar HISTORY card) ─────
  const opponentId = slot === "P1" ? room?.player2_id : room?.player1_id;
  useEffect(() => {
    if (!opponentId) return;
    let cancelled = false;
    const mode = room?.format === "ranked" ? "ranked" : "unranked";
    API.get<HeadToHead>(`/api/profile/head-to-head/${opponentId}?mode=${mode}`)
      .then((res) => {
        if (!cancelled) setHeadToHead(res.data);
      })
      .catch(() => {
        if (!cancelled) setHeadToHead({ wins: 0, losses: 0, draws: 0, total: 0, recent: [] });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentId]);

  useEffect(() => {
    if (!matchResult) {
      setMpLevelUp(null);
      return;
    }
    const me = slot === "P1" ? matchResult.p1 : matchResult.p2;
    if (me.level_after > me.level_before) {
      setMpLevelUp({ from: me.level_before, to: me.level_after });
    } else {
      setMpLevelUp(null);
    }
  }, [matchResult, slot]);

  const applyMatchResultProfile = () => {
    if (!matchResult) return;
    const me = slot === "P1" ? matchResult.p1 : matchResult.p2;
    patchUser({
      level: me.level_after,
      xp: me.xp_after,
      elo: me.elo_after,
      ranked_rating: me.rr_after,
    });
    useAuthStore.getState().setPendingLevelUp(null);
  };

  const handleMatchResultDismiss = () => {
    applyMatchResultProfile();
    dismissMatchResult();
    router.replace("/multiplayer");
  };

  const handleFindNewMatch = () => {
    const format = matchResult?.format ?? "unranked";
    applyMatchResultProfile();
    dismissMatchResult();
    router.replace({
      pathname: "/multiplayer/queue",
      params: { format },
    });
  };

  const handleViewCareer = () => {
    const entryId = matchResult?.careerEntryId;
    if (!entryId) return;
    applyMatchResultProfile();
    dismissMatchResult();
    router.replace({
      pathname: "/career/[id]",
      params: { id: entryId },
    } as never);
  };

  // ── Android hardware-back guard ───────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (room?.game_status === "playing") {
        confirmQuit();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.game_status]);

  // ── Server-side disband ─────────────────────────────────────
  useEffect(() => {
    if (!disbanded) return;
    Alert.alert(
      "Match ended",
      disbanded.reason ?? "The match ended.",
      [{ text: "Back to lobby", onPress: () => router.replace("/multiplayer") }],
    );
  }, [disbanded]);

  // ── Pop a server error toast briefly ────────────────────────
  useEffect(() => {
    if (!lastError) return;
    const id = setTimeout(dismissError, 2400);
    return () => clearTimeout(id);
  }, [lastError, dismissError]);

  useEffect(() => {
    if (!room) return;
    const wasPlaying = prevGameStatus.current === "playing";
    if (wasPlaying && room.game_status === "finished" && room.winner) {
      if (room.winner === "DRAW") return;
      if (room.winner === slot) audio.sfx.victory();
      else audio.sfx.defeat();
    }
    prevGameStatus.current = room.game_status;
  }, [room, slot, audio]);

  const confirmQuit = () => {
    Alert.alert(
      "Forfeit match?",
      "You'll lose this series and your opponent will be credited the win.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Forfeit",
          style: "destructive",
          onPress: () => {
            quitMatch("user_forfeit");
            router.replace("/multiplayer");
          },
        },
      ],
    );
  };

  // ── Loading state ───────────────────────────────────────────
  if (!room) {
    return (
      <Screen padded>
        <Stack.Screen options={{ headerShown: false }} />
        <Row gap={3} align="center" justify="center" fill>
          <Spinner tone="muted" />
          <Body tone="muted">
            {status === "reconnecting" ? "Reconnecting…" : "Loading match…"}
          </Body>
        </Row>
      </Screen>
    );
  }

  const isMyTurn = room.current_player === slot && room.game_status === "playing";
  const gameOver = room.game_status === "finished";
  const seriesOver = room.series_winner !== null;
  const legLabel = `G${legGameIndex(room.game_number)} · ${legBoardLabel(room.board_mode)}`;

  // Accumulated Protocol Breaker selections (kept current by useMatchSocket
  // merging every phase_choice payload, mirroring the server).
  const rbPayload = (room.rb_phase_payload ?? {}) as Record<string, unknown>;
  const rbWinnerPickedRule =
    typeof rbPayload.winnerPickedRule === "string" ? rbPayload.winnerPickedRule : null;
  const rbFirstPlayerChosen =
    rbPayload.firstPlayerChosen === "P1" || rbPayload.firstPlayerChosen === "P2"
      ? rbPayload.firstPlayerChosen
      : null;
  const rbBannedPatterns = Array.isArray(rbPayload.rb_banned_patterns)
    ? (rbPayload.rb_banned_patterns as string[])
    : room.rb_banned_patterns ?? [];
  const rbHideFromMe =
    rbPayload.rbHideBannedPatternFromSlot === slot ||
    room.rb_hide_banned_from_slot === slot;

  // Ready overlay between games (full-screen, both players' states).
  const showReadyOverlay =
    gameOver &&
    !seriesOver &&
    !matchResult &&
    !inRulebreaker &&
    !rulesGateActive &&
    !lbState &&
    !mpLevelUp;

  const p1Name = room.player1_name ?? "P1";
  const p2Name = room.player2_name ?? "P2";

  return (
    <Screen
      scrollable
      padded
      background={palette.bg}
      contentContainerStyle={{ paddingBottom: space[10] }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ───────────────────────────────────────────── */}
      <Row justify="between" align="center" style={{ marginTop: space[3] }}>
        <Pressable onPress={confirmQuit} hitSlop={12} accessibilityRole="button">
          <Caption tone="muted">← QUIT</Caption>
        </Pressable>
        <Row gap={2} align="center">
          <ChatButton
            unread={unreadChat}
            onPress={() => {
              markChatRead();
              setChatOpen(true);
            }}
          />
          <PatternsToggle
            gridSize={gridSize}
            enabled={!seriesOver}
            activePatternIds={room.selected_patterns}
            bannedPatternIds={rbHideFromMe ? undefined : rbBannedPatterns}
          />
          <Caption tone="muted">
            {room.room_code} · {legLabel}
          </Caption>
        </Row>
      </Row>

      {/* ── Scoreboard ────────────────────────────────────────── */}
      <Row gap={3} style={{ marginTop: space[3] }}>
        <PlayerCard
          slot="P1"
          self={slot === "P1"}
          name={room.player1_name}
          elo={room.player1_elo}
          points={room.p1_series_points}
          active={room.current_player === "P1" && !gameOver}
          color={colors.accent}
        />
        <PlayerCard
          slot="P2"
          self={slot === "P2"}
          name={room.player2_name}
          elo={room.player2_elo}
          points={room.p2_series_points}
          active={room.current_player === "P2" && !gameOver}
          color={colors.info}
        />
      </Row>

      {/* ── Opponent actions (web sidebar parity — during the match) ── */}
      <OpponentActionsRow
        opponentId={slot === "P1" ? room.player2_id : room.player1_id}
        opponentName={slot === "P1" ? room.player2_name : room.player1_name}
        roomCode={room.room_code}
      />

      {/* ── Match timer ───────────────────────────────────────── */}
      <View style={{ marginTop: space[3] }}>
        <MatchClockRow
          p1Label={formatClock(clocks.P1)}
          p2Label={formatClock(clocks.P2)}
          active={clocksRunning ? room.current_player : null}
          p1Name={p1Name.toUpperCase()}
          p2Name={p2Name.toUpperCase()}
        />
      </View>

      {/* ── Status banner + error (fixed slot so the board stays put) ── */}
      <View style={styles.hudSlot}>
        <View style={styles.statusRow}>
          <Eyebrow
            tone={opponentDropped ? "warn" : statusToneFor(room, slot, status)}
            numberOfLines={1}
          >
            {opponentDropped
              ? `OPPONENT DISCONNECTED — FORFEITS IN ${reconnectRemaining}s`
              : statusLabelFor(room, slot, status)}
          </Eyebrow>
        </View>
        <View style={styles.errorRow}>
          {lastError ? (
            <View style={styles.errorToast}>
              <Caption tone="danger" numberOfLines={1}>
                {lastError}
              </Caption>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Board ─────────────────────────────────────────────── */}
      <View style={[styles.boardSlot, { height: boardSide }]}>
        <BoardGrid
          gridSize={gridSize}
          sideLength={boardSide}
          board={room.board ?? emptyBoard(gridSize)}
          lastMove={null}
          winningLine={winLine}
          disabled={!isMyTurn || gameOver}
          onCellPress={(r, c) => {
            if (!isMyTurn) return;
            audio.sfx.place();
            placeStone(r, c);
          }}
        />
      </View>

      {/* ── Mindbreaker extra-turn token (fixed-height row) ───── */}
      {gridSize === 7 && room.game_status === "playing" ? (
        <ExtraTurnTokenRow
          holder={room.rb_extra_turn_token_holder ?? null}
          holderName={room.rb_extra_turn_token_holder === "P1" ? p1Name : p2Name}
          used={room.rb_extra_turn_token_used ?? false}
          current={room.current_player}
          canUse={
            room.rb_extra_turn_token_holder === slot &&
            isMyTurn &&
            (room.extra_turns ?? 0) === 0
          }
          onUse={sendUseExtraTurn}
        />
      ) : null}

      {/* ── Sidebar panels (stacked) ──────────────────────────── */}
      <MatchHistoryPanel room={room} />
      <HeadToHeadCard record={headToHead} />
      <MoveLogPanel entries={moveLog} />

      {/* ── Series end ────────────────────────────────────────── */}
      {seriesOver && !matchResult ? (
        <SeriesEndPanel room={room} mySlot={slot} />
      ) : null}

      <ChatSheet
        visible={chatOpen}
        messages={chatMessages}
        mySlot={slot}
        p1Name={p1Name}
        p2Name={p2Name}
        onSend={sendChat}
        onClose={() => {
          markChatRead();
          setChatOpen(false);
        }}
      />

      {showReadyOverlay ? (
        <MpReadyOverlay
          visible
          room={room}
          mySlot={slot}
          readyStates={readyStates}
          onReady={() => {
            readyForNextGame();
            setOnGameScreen(true);
            if (room.awaiting_rulebreaker && slot === "P1") {
              sendTossAction("start_rb", {});
            }
          }}
        />
      ) : null}

      {room && rulesGateActive ? (
        <RulesShowOverlay
          visible
          gridSize={gridSize}
          gameNumber={room.game_number}
          selectedPatterns={room.selected_patterns}
          mySlot={slot}
          p1Name={p1Name.toUpperCase()}
          p2Name={p2Name.toUpperCase()}
          rulesReady={rulesReady}
          onToggleReady={sendLevelupReady}
        />
      ) : null}

      {inRulebreaker && rbPhase ? (
        <RulebreakerOverlay
          visible
          phase={rbPhase}
          boardMode={room.board_mode}
          gameNumber={room.game_number}
          mySlot={slot}
          tossWinner={room.rb_toss_winner ?? null}
          coinResult={room.rb_coin_result ?? null}
          gridSize={gridSize}
          rb6CellChooser={room.rb6_cell_chooser ?? null}
          rb6TimerOwner={room.rb6_timer_owner ?? null}
          winnerPickedRule={rbWinnerPickedRule}
          firstPlayerChosen={rbFirstPlayerChosen}
          bannedPatterns={rbBannedPatterns}
          c3Blocked={room.c3_blocked ?? null}
          hideBannedFromMe={rbHideFromMe}
          selectedPatterns={room.selected_patterns}
          p1Name={p1Name}
          p2Name={p2Name}
          onTossAction={sendTossAction}
        />
      ) : null}

      {lbState ? (
        <MpLimitbreakerOverlay
          visible
          state={lbState}
          mySlot={slot}
          onAction={sendLimitbreakerAction}
        />
      ) : null}

      {mpLevelUp ? (
        <XpLevelUpOverlay
          visible
          fromLevel={mpLevelUp.from}
          toLevel={mpLevelUp.to}
          onDone={() => setMpLevelUp(null)}
        />
      ) : null}

      {matchResult && !mpLevelUp ? (
        <MatchResultOverlay
          visible
          result={matchResult}
          mySlot={slot}
          onDismiss={handleMatchResultDismiss}
          onFindNewMatch={handleFindNewMatch}
          onViewCareer={matchResult.careerEntryId ? handleViewCareer : undefined}
        />
      ) : null}
    </Screen>
  );
}

// ─── Sub-panels ──────────────────────────────────────────────────────────────

function PlayerCard({
  slot,
  self,
  name,
  elo,
  points,
  active,
  color,
}: {
  slot: PlayerSlot;
  self: boolean;
  name: string | null;
  elo: number | null;
  points: number;
  active: boolean;
  color: string;
}) {
  return (
    <View
      style={[
        styles.playerCard,
        { borderColor: active ? color : colors.border, opacity: active ? 1 : 0.75 },
      ]}
    >
      <Row gap={2} align="center">
        <View style={[styles.playerSwatch, { backgroundColor: color }]} />
        <Caption tone="muted">{slot}{self ? " · YOU" : ""}</Caption>
      </Row>
      <Heading numberOfLines={1}>{name ?? "—"}</Heading>
      <Row gap={3} align="baseline">
        <Caption tone="muted">{elo !== null ? `${elo} ELO` : "—"}</Caption>
        <Caption tone="accent" style={{ fontWeight: "800" }}>
          {points} pt
        </Caption>
      </Row>
    </View>
  );
}

/** Compact ADD FRIEND / REPORT row, available for the whole match. */
function OpponentActionsRow({
  opponentId,
  opponentName,
  roomCode,
}: {
  opponentId: string | null;
  opponentName: string | null;
  roomCode: string;
}) {
  const [friendSent, setFriendSent] = useState(false);
  // Pre-check friend status so the "Add friend" button hides immediately for
  // opponents already in your friends list (matches the web client) — leaving
  // only the Report button.
  const [alreadyFriend, setAlreadyFriend] = useState(false);

  useEffect(() => {
    if (!opponentId) return;
    let cancelled = false;
    (async () => {
      try {
        const { friends } = await listFriends();
        const isFriend = friends.some((f) => String(f.id) === String(opponentId));
        if (!cancelled && isFriend) setAlreadyFriend(true);
      } catch {
        // best-effort precheck — leave the Add friend button in place on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opponentId]);

  if (!opponentId) return null;
  const name = opponentName ?? "opponent";

  const addFriend = async () => {
    try {
      await sendPeerRequest(opponentId);
      setFriendSent(true);
      Alert.alert("Sent", `Friend request sent to ${name}.`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
    }
  };

  const report = () => {
    Alert.alert("Report player", `Report ${name} for abuse?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await reportPlayer({ userId: opponentId, category: "abuse", roomCode });
            Alert.alert("Reported", "Thanks — our team will review.");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  };

  return (
    <Row gap={2} style={{ marginTop: space[2] }}>
      {!alreadyFriend ? (
        <View style={{ flex: 1 }}>
          <Btn variant="secondary" size="sm" onPress={addFriend} disabled={friendSent}>
            {friendSent ? "Request sent" : "Add friend"}
          </Btn>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Btn variant="ghost" size="sm" onPress={report}>
          Report
        </Btn>
      </View>
    </Row>
  );
}

function SeriesEndPanel({
  room,
  mySlot,
}: {
  room: Room;
  mySlot: PlayerSlot;
}) {
  const won = room.series_winner === mySlot;
  const headline = won ? "Series win" : "Series lost";
  const tone = won ? "accent" : "info";
  return (
    <Card variant="surface" padding="lg" style={{ marginTop: space[3] }}>
      <Eyebrow tone={tone}>FINAL · {room.p1_series_points} — {room.p2_series_points}</Eyebrow>
      <View style={{ height: space[2] }} />
      <Title>{headline}</Title>
      <View style={{ height: space[3] }} />
      <Btn variant="primary" onPress={() => router.replace("/multiplayer")}>
        Back to lobby
      </Btn>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusLabelFor(room: Room, mySlot: PlayerSlot, conn: string): string {
  if (room.series_winner) return room.series_winner === mySlot ? "YOU WIN THE SERIES" : "SERIES OVER";
  if (room.awaiting_rulebreaker) return "PROTOCOL BREAKER PENDING";
  if (room.game_status === "finished") {
    return room.winner === "DRAW"
      ? "GAME DRAW"
      : room.winner === mySlot
      ? "GAME WIN"
      : "GAME LOSS";
  }
  if (conn === "reconnecting") return "RECONNECTING…";
  if (conn === "connecting") return "CONNECTING…";
  return room.current_player === mySlot ? "YOUR TURN" : "OPPONENT TURN";
}

function statusToneFor(
  room: Room,
  mySlot: PlayerSlot,
  conn: string,
): "default" | "accent" | "muted" | "info" | "warn" | "danger" {
  if (room.series_winner) return room.series_winner === mySlot ? "accent" : "info";
  if (room.awaiting_rulebreaker) return "warn";
  if (room.game_status === "finished") {
    return room.winner === "DRAW"
      ? "warn"
      : room.winner === mySlot
      ? "accent"
      : "info";
  }
  if (conn === "reconnecting" || conn === "connecting") return "muted";
  return room.current_player === mySlot ? "accent" : "info";
}

const styles = StyleSheet.create({
  hudSlot: {
    height: 84,
    marginTop: space[2],
    marginBottom: space[2],
    justifyContent: "flex-start",
  },
  statusRow: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space[2],
  },
  errorRow: {
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space[2],
  },
  boardSlot: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  errorToast: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    backgroundColor: colors.bgCard,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    alignSelf: "center",
    maxWidth: "100%",
  },
  playerCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 2,
    padding: space[3],
    gap: space[1],
  },
  playerSwatch: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
});
