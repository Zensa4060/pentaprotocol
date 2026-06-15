/**
 * Friends tab (BUG-11).
 *
 * Wired to the existing ``/api/friends/*`` backend: friend code,
 * add-by-code, incoming requests (accept/decline), friends list with
 * presence, and per-friend actions (message / remove / block / report).
 *
 * Redesign (UI only): HUD header + accent-ticked sections, a void Panel
 * for the friend code / add-by-code block, and presence-dot rows that match
 * the Store / Collection / Profile aesthetic. All social logic is unchanged.
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, Share, StyleSheet, View } from "react-native";

import {
  Avatar,
  Body,
  Btn,
  Caption,
  Heading,
  Row,
  Screen,
  Stack,
  TextField,
} from "@/components/ui";
import { HudHeader, Panel, SectionLabel } from "@/components/ui/hud";
import {
  FriendCareerModal,
  type FriendCareerFilter,
} from "@/components/social/FriendCareerModal";
import { FriendProfileSheet } from "@/components/social/FriendProfileSheet";
import { CommunityLinks } from "@/components/community/CommunityLinks";
import { TabSwipe } from "@/components/TabSwipe";
import {
  acceptFriendRequest,
  blockUser,
  declineFriendRequest,
  getMyFriendCode,
  listFriendRequests,
  listFriends,
  removeFriend,
  reportPlayer,
  sendFriendRequest,
} from "@/lib/social/friends";
import type { FriendRequestRow, PublicUser } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function FriendsScreen() {
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [requests, setRequests] = useState<FriendRequestRow[]>([]);
  const [myCode, setMyCode] = useState<string>("—");
  const [addCode, setAddCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [careerFriend, setCareerFriend] = useState<PublicUser | null>(null);
  const [careerFilter, setCareerFilter] = useState<FriendCareerFilter>("all");
  const [profileFriend, setProfileFriend] = useState<PublicUser | null>(null);

  const load = useCallback(async (mode: "mount" | "pull") => {
    if (mode === "pull") setRefreshing(true);
    try {
      const [list, reqs, mine] = await Promise.all([
        listFriends(),
        listFriendRequests(),
        getMyFriendCode().catch(() => "—"),
      ]);
      setFriends(list.friends);
      setRequests(reqs);
      setMyCode(mine);
    } catch {
      /* keep last-known data */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("mount");
    }, [load]),
  );

  const onAdd = async () => {
    const c = addCode.trim().toUpperCase();
    if (c.length < 4 || busy) return;
    setBusy(true);
    try {
      await sendFriendRequest(c);
      setAddCode("");
      Alert.alert("Sent", "Friend request sent.");
      void load("mount");
    } catch (err) {
      Alert.alert("Could not add", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async (id: string) => {
    try {
      await acceptFriendRequest(id);
      void load("mount");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
    }
  };
  const onDecline = async (id: string) => {
    try {
      await declineFriendRequest(id);
      void load("mount");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
    }
  };

  const openFriendCareer = (f: PublicUser, filter: FriendCareerFilter = "all") => {
    setCareerFilter(filter);
    setCareerFriend(f);
  };

  // Tapping a friend opens the styled in-game profile sheet (no more
  // generic system alerts). Destructive actions keep a native confirm.
  const onFriendActions = (f: PublicUser) => setProfileFriend(f);

  const onMessageFriend = (f: PublicUser) => {
    setProfileFriend(null);
    router.push(`/messages/${f.id}?name=${encodeURIComponent(f.username)}` as never);
  };

  const onCareerFriend = (f: PublicUser, filter: FriendCareerFilter) => {
    setProfileFriend(null);
    openFriendCareer(f, filter);
  };

  const onRemoveFriend = (f: PublicUser) => {
    Alert.alert("Remove friend?", `Remove ${f.username} from your friends list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(f.id);
            setProfileFriend(null);
            void load("mount");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  };

  const onBlockFriend = (f: PublicUser) => {
    Alert.alert("Block player?", `${f.username} won't be able to contact you.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(f.id);
            setProfileFriend(null);
            void load("mount");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  };

  const onReportFriend = (f: PublicUser) => {
    Alert.alert("Report player", `Report ${f.username} for abuse?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await reportPlayer({ userId: f.id, category: "abuse" });
            Alert.alert("Reported", "Thanks — our team will review.");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen padded>
        <Stack gap={4} fill align="center" justify="center">
          <ActivityIndicator color={colors.accent} />
          <Caption tone="muted">Loading friends…</Caption>
        </Stack>
      </Screen>
    );
  }

  return (
    <TabSwipe index={1}>
    <Screen
      scrollable
      padded
      contentContainerStyle={{ paddingBottom: space[10] }}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={() => load("pull")} tintColor={colors.accent} />
        ),
      }}
    >
      <HudHeader
        title="FRIENDS"
        eyebrow="ADD PLAYERS · REQUESTS · PRESENCE"
        right={
          <Pressable style={styles.communityBtn} onPress={() => router.push("/community")}>
            <Caption tone="accent" style={{ fontWeight: "800" }}>COMMUNITY ›</Caption>
          </Pressable>
        }
      />

      {/* My code + add */}
      <Panel style={styles.codeCard}>
        <SectionLabel label="YOUR FRIEND CODE" />
        <Row justify="between" align="center" style={{ marginTop: space[2] }}>
          <Heading style={{ letterSpacing: 3, fontWeight: "900" }}>{myCode}</Heading>
          <Pressable
            style={styles.copyBtn}
            onPress={() => {
              if (myCode && myCode !== "—") {
                Share.share({ message: `Add me on PentaProtocol — friend code: ${myCode}` }).catch(
                  () => undefined,
                );
              }
            }}
          >
            <Caption tone="accent" style={{ fontWeight: "800", letterSpacing: 0.5 }}>COPY / SHARE</Caption>
          </Pressable>
        </Row>
        <View style={{ height: space[4] }} />
        <TextField
          label="Add by code"
          value={addCode}
          onChangeText={(t) => setAddCode(t.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          placeholder="ABCD"
        />
        <View style={{ height: space[3] }} />
        <Btn variant="primary" loading={busy} disabled={addCode.trim().length < 4} onPress={onAdd}>
          Send request
        </Btn>
      </Panel>

      {/* Requests */}
      {requests.length > 0 ? (
        <>
          <SectionLabel label={`REQUESTS · ${requests.length}`} style={styles.section} />
          <Stack gap={2}>
            {requests.map((r) => (
              <View key={r.id} style={styles.row}>
                <Avatar uri={r.from.avatar} name={r.from.username} size="sm" />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }}>{r.from.username}</Body>
                  <Caption tone="muted">Lvl {r.from.level} · {r.from.rank}</Caption>
                </View>
                <Row gap={2}>
                  <Pressable style={[styles.pill, { borderColor: colors.success }]} onPress={() => onAccept(r.id)}>
                    <Caption tone="success" style={{ fontWeight: "700" }}>Accept</Caption>
                  </Pressable>
                  <Pressable style={[styles.pill, { borderColor: colors.border }]} onPress={() => onDecline(r.id)}>
                    <Caption tone="muted">Decline</Caption>
                  </Pressable>
                </Row>
              </View>
            ))}
          </Stack>
        </>
      ) : null}

      {/* Friends */}
      <SectionLabel label={`ALL FRIENDS · ${friends.length}`} style={styles.section} />
      {friends.length === 0 ? (
        <Panel style={styles.emptyCard}>
          <Caption tone="muted" center>No friends yet. Share your code to add some.</Caption>
        </Panel>
      ) : (
        <Stack gap={2}>
          {friends.map((f) => (
            <Pressable
              key={f.id}
              style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              onPress={() => onFriendActions(f)}
            >
              <View>
                <Avatar uri={f.avatar} name={f.username} size="sm" />
                <View style={[styles.presence, { backgroundColor: f.online ? colors.success : colors.textDim }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700" }}>{f.username}</Body>
                <Caption tone="muted">
                  {f.online ? "Online" : "Offline"} · Lvl {f.level} · {f.rank}
                </Caption>
              </View>
              <Caption tone="dim" style={{ fontSize: 18 }}>›</Caption>
            </Pressable>
          ))}
        </Stack>
      )}

      {/* Community links — moved here from the Home tab (last section). */}
      <SectionLabel label="COMMUNITY" style={styles.section} />
      <CommunityLinks title="" />

      <FriendCareerModal
        visible={!!careerFriend}
        friend={careerFriend}
        filter={careerFilter}
        onClose={() => setCareerFriend(null)}
      />
      <FriendProfileSheet
        friend={profileFriend}
        onClose={() => setProfileFriend(null)}
        onMessage={onMessageFriend}
        onCareer={onCareerFriend}
        onRemove={onRemoveFriend}
        onBlock={onBlockFriend}
        onReport={onReportFriend}
      />
    </Screen>
    </TabSwipe>
  );
}

const styles = StyleSheet.create({
  communityBtn: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.08)",
  },
  copyBtn: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.08)",
  },
  codeCard: {
    marginTop: space[5],
    padding: space[4],
  },
  emptyCard: {
    padding: space[5],
  },
  section: { marginTop: space[6], marginBottom: space[3] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
  },
  rowPressed: {
    borderColor: colors.borderAccent,
    backgroundColor: colors.bgCard,
  },
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  presence: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.bgElevated,
  },
});
