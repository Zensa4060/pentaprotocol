/**
 * Multiplayer match-screen panels — web ``MatchSidebar`` parity, stacked
 * vertically for phones: between-games ready overlay, match history list
 * (G1…LIMITB), chat sheet with unread badge, head-to-head record, and the
 * in-match add-friend / report row.
 */

import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Body, Btn, Caption, Eyebrow, Heading, Row, Title } from "@/components/ui";
import type { ChatMessage, MatchHistoryEntry, PlayerSlot, Room } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

const P1_COLOR = colors.accent;
const P2_COLOR = colors.info;

// ─── Between-games ready overlay ─────────────────────────────────────────────

export function MpReadyOverlay({
  visible,
  room,
  mySlot,
  readyStates,
  onReady,
}: {
  visible: boolean;
  room: Room;
  mySlot: PlayerSlot;
  readyStates: Record<PlayerSlot, boolean>;
  onReady: () => void;
}) {
  const winnerLabel =
    room.winner === "DRAW"
      ? "DRAW"
      : room.winner === mySlot
      ? "YOU WON"
      : "OPPONENT WON";
  const winnerTone =
    room.winner === "DRAW" ? "warn" : room.winner === mySlot ? "accent" : "info";
  const iAmReady = readyStates[mySlot];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.readyBackdrop}>
        <View style={styles.readyCard}>
          <Eyebrow tone={winnerTone}>GAME {room.game_number}</Eyebrow>
          <Title style={{ marginTop: space[2] }}>{winnerLabel}</Title>
          <Body tone="muted" style={{ marginTop: space[2], textAlign: "center" }}>
            Series at {room.p1_series_points} — {room.p2_series_points}. First to 3 wins
            the match.
          </Body>

          <View style={{ height: space[5] }} />
          {(["P1", "P2"] as const).map((p) => {
            const name = p === "P1" ? room.player1_name ?? "P1" : room.player2_name ?? "P2";
            const col = p === "P1" ? P1_COLOR : P2_COLOR;
            const ready = readyStates[p];
            return (
              <View key={p} style={[styles.readyRow, { borderColor: ready ? col : colors.border }]}>
                <Row gap={2} align="center">
                  <View style={[styles.readyDot, { backgroundColor: ready ? col : colors.border }]} />
                  <Body numberOfLines={1} style={{ fontWeight: "700", maxWidth: 180 }}>
                    {name}
                    {p === mySlot ? "  (you)" : ""}
                  </Body>
                </Row>
                <Caption tone={ready ? "accent" : "muted"}>
                  {ready ? "READY" : "WAITING…"}
                </Caption>
              </View>
            );
          })}

          <View style={{ height: space[4] }} />
          <Btn variant="primary" size="lg" disabled={iAmReady} onPress={onReady}>
            {iAmReady ? "Waiting for opponent…" : "Ready for next game"}
          </Btn>
        </View>
      </View>
    </Modal>
  );
}

// ─── Match history (G1 … LIMITB) ─────────────────────────────────────────────

const BREAKER_LABELS: Record<number, string> = { 3: "RULEB", 6: "TIMEB", 9: "MINDB" };

export function MatchHistoryPanel({ room }: { room: Room }) {
  const fullMode = room.board_mode_full ?? room.board_mode ?? "";
  const tripleLeg =
    fullMode.includes("_") ||
    Boolean((room as { ranked_triple_leg?: boolean }).ranked_triple_leg);
  const start = room.history_display_start_index ?? 0;
  const hist: MatchHistoryEntry[] = (room.match_history ?? []).slice(start);
  const currentN = room.series_winner ? -1 : hist.length + 1;
  const slots = tripleLeg ? 9 : Math.max(hist.length + (room.series_winner ? 0 : 1), 3);

  const nameOf = (w: MatchHistoryEntry["winner"]) =>
    w === "DRAW" ? "DRAW" : w === "P1" ? room.player1_name ?? "P1" : room.player2_name ?? "P2";
  const colorOf = (w: MatchHistoryEntry["winner"]) =>
    w === "DRAW" ? colors.textMuted : w === "P1" ? P1_COLOR : P2_COLOR;

  return (
    <View style={styles.panel}>
      <Caption tone="muted" style={{ marginBottom: space[2] }}>
        MATCH HISTORY
      </Caption>
      <View style={styles.seriesHeader}>
        <Caption tone="muted" style={{ letterSpacing: 1 }}>
          SERIES POINTS · FIRST TO 3
        </Caption>
        <Row gap={2} align="center" style={{ marginTop: 2 }}>
          <Text style={[styles.seriesName, { color: P1_COLOR }]} numberOfLines={1}>
            {room.player1_name ?? "P1"} {room.p1_series_points}
          </Text>
          <Caption tone="muted">—</Caption>
          <Text style={[styles.seriesName, { color: P2_COLOR }]} numberOfLines={1}>
            {room.player2_name ?? "P2"} {room.p2_series_points}
          </Text>
        </Row>
      </View>
      {Array.from({ length: slots }, (_, i) => {
        const n = i + 1;
        const label = tripleLeg ? BREAKER_LABELS[n] ?? `G${n}` : `G${n}`;
        const entry = hist[i];
        const isCurrent = n === currentN;
        return (
          <Row key={n} justify="between" align="center" style={styles.historyRow}>
            <Caption tone={isCurrent ? "accent" : "muted"}>
              {label}
              {isCurrent ? " *" : ""}
            </Caption>
            {entry ? (
              <Caption style={{ color: colorOf(entry.winner), fontWeight: "700" }} numberOfLines={1}>
                {nameOf(entry.winner)}
              </Caption>
            ) : (
              <Caption tone="muted">—</Caption>
            )}
          </Row>
        );
      })}
      {tripleLeg ? (
        <Row justify="between" align="center" style={styles.historyRow}>
          <Caption tone={room.awaiting_limitbreaker ? "accent" : "muted"}>LIMITB</Caption>
          <Caption tone="muted">{hist.length >= 10 ? nameOf(hist[9]!.winner) : "—"}</Caption>
        </Row>
      ) : null}
    </View>
  );
}

// ─── Head-to-head record ─────────────────────────────────────────────────────

export interface HeadToHead {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  recent: ("win" | "loss" | "draw")[];
}

export function HeadToHeadCard({ record }: { record: HeadToHead | null }) {
  return (
    <View style={styles.panel}>
      <Row justify="between" align="center" style={{ marginBottom: space[2] }}>
        <Caption tone="muted">HISTORY</Caption>
        {record && record.total === 0 ? <Caption tone="muted">FIRST MEETING</Caption> : null}
      </Row>
      {!record ? (
        <Caption tone="muted">Loading head-to-head…</Caption>
      ) : record.total === 0 ? (
        <Caption tone="muted">No prior matches. This game will be logged.</Caption>
      ) : (
        <>
          <Row gap={3} align="baseline">
            <Body style={{ fontWeight: "800" }}>
              {record.wins}W — {record.losses}L — {record.draws}D
            </Body>
            <Caption tone="muted">{record.total} played</Caption>
          </Row>
          <Row gap={2} align="center" style={{ marginTop: space[2] }}>
            <Caption tone="muted">RECENT</Caption>
            {record.recent.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.recentDot,
                  {
                    backgroundColor:
                      r === "win" ? colors.accent : r === "loss" ? colors.info : colors.border,
                  },
                ]}
              />
            ))}
          </Row>
        </>
      )}
    </View>
  );
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export function ChatButton({
  unread,
  onPress,
}: {
  unread: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.chatBtn} hitSlop={6}>
      <Text style={styles.chatBtnText}>CHAT</Text>
      {unread > 0 ? (
        <View style={styles.chatBadge}>
          <Text style={styles.chatBadgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChatSheet({
  visible,
  messages,
  mySlot,
  p1Name,
  p2Name,
  onSend,
  onClose,
}: {
  visible: boolean;
  messages: ChatMessage[];
  mySlot: PlayerSlot;
  p1Name: string;
  p2Name: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
      return () => clearTimeout(id);
    }
  }, [visible, messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.chatBackdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.chatSheet}>
          <Row justify="between" align="center" style={{ marginBottom: space[2] }}>
            <Heading>Match chat</Heading>
            <Pressable onPress={onClose} hitSlop={10}>
              <Caption tone="muted">CLOSE</Caption>
            </Pressable>
          </Row>
          <ScrollView
            ref={scrollRef}
            style={styles.chatScroll}
            contentContainerStyle={{ paddingBottom: space[2] }}
          >
            {messages.length === 0 ? (
              <Caption tone="muted">No messages yet — say hi.</Caption>
            ) : (
              messages.map((m, i) => {
                const mine = m.from === mySlot;
                const name = m.from === "P1" ? p1Name : p2Name;
                const col = m.from === "P1" ? P1_COLOR : P2_COLOR;
                return (
                  <View
                    key={`${m.ts}-${i}`}
                    style={[styles.chatBubble, mine ? styles.chatBubbleMine : null]}
                  >
                    <Caption style={{ color: col, fontWeight: "800" }}>{name}</Caption>
                    <Body style={{ marginTop: 2 }}>{m.text}</Body>
                  </View>
                );
              })
            )}
          </ScrollView>
          <Row gap={2} align="center" style={{ marginTop: space[2] }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.textMuted}
              style={styles.chatInput}
              maxLength={300}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <View style={{ width: 84 }}>
              <Btn variant="primary" size="sm" onPress={send} disabled={!draft.trim()}>
                Send
              </Btn>
            </View>
          </Row>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  readyBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,4,10,0.96)",
    justifyContent: "center",
    padding: space[5],
  },
  readyCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
    alignItems: "stretch",
  },
  readyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radii.md,
    backgroundColor: colors.bgCard,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    marginBottom: space[2],
  },
  readyDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  panel: {
    marginTop: space[3],
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  seriesHeader: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgRaised,
    padding: space[2],
    marginBottom: space[2],
  },
  seriesName: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  historyRow: {
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
  chatBtn: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chatBtnText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  chatBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  chatBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: "900",
  },
  chatBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,4,10,0.6)",
  },
  chatSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    maxHeight: "70%",
  },
  chatScroll: {
    maxHeight: 320,
    minHeight: 140,
  },
  chatBubble: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
    marginBottom: space[2],
    maxWidth: "88%",
    alignSelf: "flex-start",
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    borderColor: colors.borderAccent,
  },
  chatInput: {
    flex: 1,
    color: colors.text,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 14,
  },
});
