/**
 * Native collection — equip owned themes, boards, banners.
 */

import { router, Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Heading,
  Row,
  Screen,
  Title,
} from "@/components/ui";
import {
  COLLECTION_ENTRIES,
  type CollectionTab,
} from "@/lib/collection/catalog";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { loadThemePreference, saveThemePreference } from "@/lib/themePreference";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { colors, radii, space } from "@/theme/tokens";

const TABS: CollectionTab[] = ["themes", "grids", "banners"];

export default function CollectionScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<CollectionTab>("themes");
  const [themeId, setThemeId] = useState("classic_dark");
  const [busy, setBusy] = useState<string | null>(null);

  useSyncAudioTheme(themeId);

  useEffect(() => {
    loadThemePreference().then(setThemeId).catch(() => undefined);
  }, []);

  const owned = user?.purchased_items ?? [];
  const entries = COLLECTION_ENTRIES.filter((e) => e.tab === tab);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const onEquip = useCallback(
    async (entryId: string) => {
      const entry = COLLECTION_ENTRIES.find((e) => e.id === entryId && e.tab === tab);
      if (!entry || !user || busy) return;
      if (!entry.owned(owned)) {
        Alert.alert("Locked", "Purchase this item in the Store first.");
        return;
      }
      setBusy(entryId);
      try {
        if (entry.equipField === "theme") {
          await saveThemePreference(entry.equipValue);
          setThemeId(entry.equipValue);
        } else if (entry.equipField === "banner") {
          await updateProfile({ banner: entry.equipValue });
        } else {
          await updateProfile({ board_style: entry.equipValue });
        }
        Alert.alert("Equipped", `${entry.label} is now active.`);
      } catch (err) {
        Alert.alert("Could not equip", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusy(null);
      }
    },
    [busy, owned, tab, user],
  );

  const isEquipped = (entry: (typeof COLLECTION_ENTRIES)[0]) => {
    if (entry.equipField === "theme") return themeId === entry.equipValue;
    if (entry.equipField === "banner") return user?.banner === entry.equipValue;
    return user?.board_style === entry.equipValue;
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>Collection</Title>
      <Body tone="muted" style={{ marginTop: space[2] }}>
        Equip cosmetics you own. Themes also switch lobby / match music packs.
      </Body>

      <Row gap={2} style={{ marginTop: space[4] }}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabOn]}
          >
            <Caption tone={tab === t ? "accent" : "muted"}>{t.toUpperCase()}</Caption>
          </Pressable>
        ))}
      </Row>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {entries.map((entry, idx) => {
          const key = `${entry.tab}-${entry.equipValue}-${idx}`;
          const hasIt = entry.owned(owned);
          const equipped = isEquipped(entry);
          return (
            <View key={key} style={styles.card}>
              <Row justify="between" align="center">
                <Heading>{entry.label}</Heading>
                {!hasIt ? <Caption tone="warn">LOCKED</Caption> : equipped ? (
                  <Caption tone="accent">ACTIVE</Caption>
                ) : null}
              </Row>
              <Body tone="muted">{entry.description}</Body>
              <View style={{ marginTop: space[3] }}>
                <Btn
                  variant={equipped ? "ghost" : "secondary"}
                  disabled={!hasIt || equipped || busy === entry.id}
                  loading={busy === entry.id}
                  onPress={() => onEquip(entry.id)}
                >
                  {equipped ? "Equipped" : hasIt ? "Equip" : "Get in Store"}
                </Btn>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    paddingVertical: space[2],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabOn: {
    borderColor: colors.accent,
    backgroundColor: colors.bgRaised,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    marginBottom: space[3],
  },
});
