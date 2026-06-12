/**
 * Friend profile sheet — replaces the old system Alert popups with a
 * proper in-game card (web FriendsScreen parity): banner backdrop,
 * avatar + rank badge, presence, W/L/D record, and the full action set
 * (message / career / ranked history / remove / block / report).
 */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { BannerRenderer } from "@/components/BannerRenderer";
import { RankBadge } from "@/components/RankBadge";
import { Avatar, Body, Caption, Eyebrow, Heading, Row } from "@/components/ui";
import { getFriendProfile } from "@/lib/social/friends";
import type { PublicUser } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

interface FriendProfileSheetProps {
  friend: PublicUser | null;
  onClose: () => void;
  onMessage: (f: PublicUser) => void;
  onCareer: (f: PublicUser, filter: "all" | "ranked" | "unranked") => void;
  onRemove: (f: PublicUser) => void;
  onBlock: (f: PublicUser) => void;
  onReport: (f: PublicUser) => void;
}

export function FriendProfileSheet({
  friend,
  onClose,
  onMessage,
  onCareer,
  onRemove,
  onBlock,
  onReport,
}: FriendProfileSheetProps) {
  const { themeId } = useTheme();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const slide = useRef(new Animated.Value(60)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // Fresh fetch on open — the list row carries stale presence/record.
  useEffect(() => {
    setProfile(null);
    if (!friend) return;
    let cancelled = false;
    getFriendProfile(friend.id)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(friend);
      });
    slide.setValue(60);
    fade.setValue(0);
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    return () => {
      cancelled = true;
    };
  }, [friend, slide, fade]);

  if (!friend) return null;
  const p = profile ?? friend;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={[styles.sheetWrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* ── Banner backdrop + identity ── */}
              <View style={styles.bannerWrap}>
                <BannerRenderer
                  bannerId={p.banner || "default"}
                  themeId={themeId}
                  overlayOpacity={0.45}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.identity}>
                  <Avatar uri={p.avatar} name={p.username} size="lg" highlighted />
                  <View style={{ flex: 1 }}>
                    <Heading numberOfLines={1}>{p.username}</Heading>
                    <Row gap={2} align="center" style={{ marginTop: 2 }}>
                      <View
                        style={[
                          styles.presenceDot,
                          { backgroundColor: p.online ? colors.success : colors.textDim },
                        ]}
                      />
                      <Caption tone={p.online ? "success" : "muted"}>
                        {p.online ? "ONLINE · AVAILABLE" : "OFFLINE"}
                      </Caption>
                    </Row>
                  </View>
                </View>
              </View>

              {/* ── Rank / level / record ── */}
              <Row gap={2} style={{ marginTop: space[3] }}>
                <View style={styles.statCard}>
                  <Caption tone="muted">RANK</Caption>
                  <Row gap={2} align="center" style={{ marginTop: 2 }}>
                    <RankBadge
                      elo={p.elo ?? 0}
                      isPlacement={(p.placement_matches ?? 0) < 5 && (p.elo ?? 0) === 0}
                      size={22}
                    />
                    <Body style={{ fontWeight: "800" }} numberOfLines={1}>
                      {p.rank ?? "—"}
                    </Body>
                  </Row>
                </View>
                <View style={styles.statCard}>
                  <Caption tone="muted">LEVEL</Caption>
                  <Body style={{ fontWeight: "800", marginTop: 2 }}>{p.level ?? 1}</Body>
                </View>
                <View style={styles.statCard}>
                  <Caption tone="muted">ELO</Caption>
                  <Body style={{ fontWeight: "800", marginTop: 2 }}>{p.elo ?? 0}</Body>
                </View>
              </Row>

              <View style={styles.recordRow}>
                <RecordChip label="WINS" value={p.wins ?? 0} color={colors.success} />
                <RecordChip label="LOSSES" value={p.losses ?? 0} color={colors.danger} />
                <RecordChip label="DRAWS" value={p.draws ?? 0} color={colors.warn} />
              </View>

              {p.bio ? (
                <Caption tone="muted" style={{ marginTop: space[3] }} numberOfLines={3}>
                  “{p.bio}”
                </Caption>
              ) : null}

              {/* ── Actions ── */}
              <Eyebrow tone="muted" style={{ marginTop: space[4], marginBottom: space[2] }}>
                ACTIONS
              </Eyebrow>
              <ActionRow label="Message" accent onPress={() => onMessage(friend)} />
              <ActionRow label="View career" onPress={() => onCareer(friend, "all")} />
              <ActionRow label="Ranked history" onPress={() => onCareer(friend, "ranked")} />
              <ActionRow label="Unranked history" onPress={() => onCareer(friend, "unranked")} />

              <Eyebrow tone="muted" style={{ marginTop: space[3], marginBottom: space[2] }}>
                MANAGE
              </Eyebrow>
              <Row gap={2}>
                <DangerChip label="Remove" onPress={() => onRemove(friend)} />
                <DangerChip label="Block" onPress={() => onBlock(friend)} />
                <DangerChip label="Report" onPress={() => onReport(friend)} />
              </Row>

              <View style={{ height: space[3] }} />
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
                <Caption tone="muted" style={{ fontWeight: "800", letterSpacing: 1.5 }}>
                  CLOSE
                </Caption>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function RecordChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.recordChip, { borderColor: `${color}66` }]}>
      <Heading style={{ color }}>{value}</Heading>
      <Caption tone="muted" style={{ fontSize: 9, letterSpacing: 1 }}>
        {label}
      </Caption>
    </View>
  );
}

function ActionRow({
  label,
  accent,
  onPress,
}: {
  label: string;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        accent && { borderColor: colors.borderAccent },
        pressed && { backgroundColor: colors.bgRaised },
      ]}
      accessibilityRole="button"
    >
      <Body style={{ fontWeight: "700" }} tone={accent ? "accent" : "default"}>
        {label}
      </Body>
      <Caption tone="muted">›</Caption>
    </Pressable>
  );
}

function DangerChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dangerChip, pressed && { backgroundColor: "rgba(239,68,68,0.15)" }]}
      accessibilityRole="button"
    >
      <Caption tone="danger" style={{ fontWeight: "800" }}>
        {label}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(2,4,10,0.85)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    maxHeight: "88%",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[4],
  },
  bannerWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    padding: space[4],
  },
  presenceDot: {
    width: 9,
    height: 9,
    borderRadius: radii.pill,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  recordRow: {
    flexDirection: "row",
    gap: space[2],
    marginTop: space[2],
  },
  recordChip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1.5,
    paddingVertical: space[2],
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    marginBottom: space[2],
  },
  dangerChip: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.6)",
    paddingVertical: space[2],
  },
  closeBtn: {
    alignItems: "center",
    paddingVertical: space[3],
  },
});
