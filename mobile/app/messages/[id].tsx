/**
 * Direct-message thread (BUG-08).
 *
 * Loads history (``GET /api/friends/messages/{id}``), sends via
 * ``POST /api/friends/messages``, and live-updates from the DM notify
 * socket (``/api/friends/ws/dm``).
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Row,
  Screen,
  Stack as VStack,
  TextField,
  Title,
} from "@/components/ui";
import { listMessages, openDmSocket, sendMessage, type DmSocket } from "@/lib/social/messages";
import { useAuthStore } from "@/lib/store";
import type { DirectMessage } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export default function DmThreadScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const targetId = params.id ?? "";
  const name = params.name ?? "Chat";
  const myId = useAuthStore((s) => s.user?.id);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const socketRef = useRef<DmSocket | null>(null);

  const scrollDown = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listMessages(targetId)
      .then((m) => {
        if (cancelled) return;
        setMessages(m);
        scrollDown();
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false));

    void openDmSocket((m) => {
      // Only append frames for this conversation.
      if (m.from_user === targetId || m.to_user === targetId) {
        setMessages((prev) => [...prev, m]);
        scrollDown();
      }
    }).then((s) => {
      if (cancelled) s.close();
      else socketRef.current = s;
    });

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [targetId, scrollDown]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/friends");
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    // Optimistic echo (the socket will also broadcast it back).
    try {
      await sendMessage(targetId, t);
    } catch {
      setMessages((prev) => [...prev, { from_user: myId ?? "me", to_user: targetId, text: `⚠ failed: ${t}`, created_at: null }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: space[3] }} />
      <Row justify="between" align="center">
        <Pressable onPress={goBack} hitSlop={12}>
          <Caption tone="muted">‹  BACK</Caption>
        </Pressable>
        <Title numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>{name}</Title>
      </Row>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, marginTop: space[4] }}
          contentContainerStyle={{ paddingBottom: space[4] }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Caption tone="muted">No messages yet. Say hello.</Caption>
          ) : (
            <VStack gap={2}>
              {messages.map((m, i) => {
                const mine = m.from_user === myId;
                return (
                  <View key={i} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                    <Body tone={mine ? "default" : "muted"}>{m.text}</Body>
                  </View>
                );
              })}
            </VStack>
          )}
        </ScrollView>
      )}

      <Row gap={2} align="center" style={{ marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <TextField label="" value={text} onChangeText={setText} placeholder="Message…" />
        </View>
        <Btn variant="primary" loading={sending} disabled={!text.trim()} onPress={send}>
          Send
        </Btn>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "85%",
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: colors.bgRaised,
    borderColor: colors.borderAccent,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  },
});
