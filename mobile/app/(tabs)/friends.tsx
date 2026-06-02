/**
 * Friends tab (BUG-11).
 *
 * Wired to the existing ``/api/friends/*`` backend: friend code,
 * add-by-code, incoming requests (accept/decline), friends list with
 * presence, and per-friend actions (message / remove / block / report).
 */

import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import {
  Avatar,
  Body,
  Btn,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack,
  TextField,
  Title,
} from "@/components/ui";
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

  const onFriendActions = (f: PublicUser) => {
    Alert.alert(f.username, undefined, [
      { text: "Message", onPress: () => router.push(`/messages/${f.id}?name=${encodeURIComponent(f.username)}` as never) },
      {
        text: "Remove friend",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFriend(f.id);
            void load("mount");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(f.id);
            void load("mount");
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
      {
        text: "Report",
        style: "destructive",
        onPress: () =>
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
          ]),
      },
      { text: "Cancel", style: "cancel" },
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
      <View style={{ height: space[3] }} />
      <Title>Friends</Title>

      {/* My code + add */}
      <View style={styles.card}>
        <Caption tone="muted">YOUR FRIEND CODE</Caption>
        <Heading style={{ letterSpacing: 2, marginTop: space[1] }}>{myCode}</Heading>
        <View style={{ height: space[3] }} />
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
      </View>

      {/* Requests */}
      {requests.length > 0 ? (
        <>
          <Eyebrow tone="muted" style={styles.section}>REQUESTS</Eyebrow>
          <Stack gap={2}>
            {requests.map((r) => (
              <View key={r.id} style={styles.row}>
                <Avatar uri={r.from.avatar} name={r.from.username} size="sm" />
                <View style={{ flex: 1 }}>
                  <Body>{r.from.username}</Body>
                  <Caption tone="muted">Lvl {r.from.level} · {r.from.rank}</Caption>
                </View>
                <Row gap={2}>
                  <Pressable style={[styles.pill, { borderColor: colors.success }]} onPress={() => onAccept(r.id)}>
                    <Caption tone="success">Accept</Caption>
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
      <Eyebrow tone="muted" style={styles.section}>
        ALL FRIENDS · {friends.length}
      </Eyebrow>
      {friends.length === 0 ? (
        <Caption tone="muted">No friends yet. Share your code to add some.</Caption>
      ) : (
        <Stack gap={2}>
          {friends.map((f) => (
            <Pressable key={f.id} style={styles.row} onPress={() => onFriendActions(f)}>
              <View>
                <Avatar uri={f.avatar} name={f.username} size="sm" />
                <View style={[styles.presence, { backgroundColor: f.online ? colors.success : colors.textDim }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Body>{f.username}</Body>
                <Caption tone="muted">
                  {f.online ? "Online" : "Offline"} · Lvl {f.level} · {f.rank}
                </Caption>
              </View>
              <Caption tone="muted">›</Caption>
            </Pressable>
          ))}
        </Stack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space[4],
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  section: { marginTop: space[6], marginBottom: space[2] },
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
  pill: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.sm,
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
    borderColor: colors.bgCard,
  },
});
