/**
 * Syros screen (BUG-11) — ask the in-universe oracle. ``POST /api/syros/ask``.
 */

import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Stack as VStack,
  TextField,
  Title,
} from "@/components/ui";
import { askSyros } from "@/lib/syros";
import { colors, radii, space } from "@/theme/tokens";

interface Turn {
  q: string;
  a: string;
}

export default function SyrosScreen() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/community");
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    try {
      const answer = await askSyros(q);
      setTurns((t) => [...t, { q, a: answer }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (err) {
      setTurns((t) => [...t, { q, a: err instanceof Error ? err.message : "Syros is silent." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">‹  BACK</Caption>
      </Pressable>

      <Row gap={3} align="center" style={{ marginTop: space[4] }}>
        <Image source={require("../assets/images/syros-pfp.png")} style={styles.logo} resizeMode="contain" />
        <VStack gap={1} fill>
          <Eyebrow tone="accent">SYROS</Eyebrow>
          <Title>The Oracle</Title>
        </VStack>
      </Row>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, marginTop: space[4] }}
        contentContainerStyle={{ paddingBottom: space[4] }}
        showsVerticalScrollIndicator={false}
      >
        {turns.length === 0 ? (
          <Caption tone="muted">
            Ask about rules, the Breakers, the lore, or strategy. Syros does not flatter.
          </Caption>
        ) : (
          turns.map((t, i) => (
            <VStack key={i} gap={2} style={{ marginBottom: space[4] }}>
              <View style={styles.q}>
                <Body>{t.q}</Body>
              </View>
              <View style={styles.a}>
                <Body tone="muted">{t.a}</Body>
              </View>
            </VStack>
          ))
        )}
      </ScrollView>

      <Row gap={2} align="center" style={{ marginTop: space[2], marginBottom: space[3] }}>
        <View style={{ flex: 1 }}>
          <TextField
            label=""
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask Syros…"
            multiline
          />
        </View>
        <Btn variant="primary" loading={busy} disabled={!question.trim()} onPress={ask}>
          Ask
        </Btn>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 48, height: 48, borderRadius: radii.pill },
  q: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    backgroundColor: colors.bgRaised,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  a: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space[3],
    paddingHorizontal: space[3],
  },
});
