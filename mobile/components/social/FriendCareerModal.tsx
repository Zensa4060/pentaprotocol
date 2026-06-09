/**
 * Friend career peek — mirrors web FriendsScreen career modal.
 */

import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Body, Btn, Caption, Eyebrow, Row, Title } from "@/components/ui";
import { formatCareerDate } from "@/lib/careerHelpers";
import { getFriendCareer } from "@/lib/social/friends";
import type { CareerMatch, PublicUser } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export type FriendCareerFilter = "all" | "ranked" | "unranked";

interface FriendCareerModalProps {
  visible: boolean;
  friend: PublicUser | null;
  filter: FriendCareerFilter;
  onClose: () => void;
}

export function FriendCareerModal({ visible, friend, filter, onClose }: FriendCareerModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CareerMatch[]>([]);

  useEffect(() => {
    if (!visible || !friend) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFriendCareer(friend.id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load career.");
          setHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, friend?.id]);

  const filtered = useMemo(() => {
    if (filter === "ranked") return history.filter((m) => m.mode === "ranked");
    if (filter === "unranked") {
      return history.filter(
        (m) => m.mode === "unranked" || m.mode === "custom" || !m.mode,
      );
    }
    return history;
  }, [filter, history]);

  const title =
    filter === "ranked"
      ? "Ranked history"
      : filter === "unranked"
        ? "Unranked history"
        : "Match history";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Row justify="between" align="center">
            <View style={{ flex: 1 }}>
              <Eyebrow tone="muted">FRIEND CAREER</Eyebrow>
              <Title style={{ marginTop: space[1] }}>{friend?.username ?? "—"}</Title>
              <Caption tone="muted">{title}</Caption>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Caption tone="muted">✕</Caption>
            </Pressable>
          </Row>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : error ? (
            <Caption tone="warn" style={{ marginTop: space[4] }}>{error}</Caption>
          ) : filtered.length === 0 ? (
            <Caption tone="muted" style={{ marginTop: space[4] }}>
              No matches in this filter.
            </Caption>
          ) : (
            <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ gap: space[2] }}>
              {filtered.map((m) => (
                <View key={m.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Body>vs {m.opponent_username}</Body>
                    <Caption tone="muted">
                      {m.mode}
                      {m.board_mode ? ` · ${m.board_mode}` : ""}
                      {" · "}
                      {formatCareerDate(m.played_at)}
                    </Caption>
                  </View>
                  <Eyebrow
                    tone={
                      m.result === "win"
                        ? "success"
                        : m.result === "draw"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {m.result.toUpperCase()}
                  </Eyebrow>
                </View>
              ))}
            </ScrollView>
          )}

          <Btn variant="secondary" onPress={onClose} style={{ marginTop: space[5] }}>
            Close
          </Btn>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "82%",
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  center: {
    paddingVertical: space[8],
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
});
