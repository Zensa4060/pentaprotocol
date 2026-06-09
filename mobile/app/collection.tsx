/**
 * Native collection — equip owned **themes** and **banners**.
 *
 * Equipping is applied live (fixes BUG-10):
 *   - Theme  → ``useTheme().setTheme`` re-renders the board + every
 *     themed surface immediately and persists the preference.
 *   - Banner → ``updateProfile({ banner })`` persists server-side and
 *     the home/profile banner updates as soon as the profile refreshes.
 *
 * Grids equip ``board_style``; badges equip profile ``title``.
 */

import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
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
import { BannerRenderer } from "@/components/BannerRenderer";
import {
  COLLECTION_ENTRIES,
  type CollectionEntry,
  type CollectionTab,
} from "@/lib/collection/catalog";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { THEMES, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

const TABS: CollectionTab[] = ["themes", "banners", "grids", "coins", "badges"];

export default function CollectionScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId, setTheme } = useTheme();
  const [tab, setTab] = useState<CollectionTab>("themes");
  const [busy, setBusy] = useState<string | null>(null);

  useSyncAudioTheme(themeId);

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
      if (!entry.owned(owned, user)) {
        Alert.alert("Locked", "Unlock this item in the Store or via missions.");
        return;
      }
      if (entry.equipField === "coin") {
        Alert.alert("Coin toss skin", "Owned on your account. Rulebreaker coin animation uses this on web; mobile syncs ownership.");
        return;
      }
      setBusy(entryId);
      try {
        if (entry.equipField === "theme") {
          await setTheme(entry.equipValue as ThemeId);
        } else if (entry.equipField === "banner") {
          await updateProfile({ banner: entry.equipValue });
        } else if (entry.equipField === "board_style") {
          await updateProfile({ board_style: entry.equipValue });
        } else if (entry.equipField === "title") {
          await updateProfile({ title: entry.equipValue });
        }
        Alert.alert("Equipped", `${entry.label} is now active.`);
      } catch (err) {
        Alert.alert("Could not equip", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusy(null);
      }
    },
    [busy, owned, setTheme, tab, user],
  );

  const isEquipped = (entry: CollectionEntry) => {
    if (!user) return false;
    if (entry.equipField === "theme") return themeId === entry.equipValue;
    if (entry.equipField === "banner") return (user.banner ?? "default") === entry.equipValue;
    if (entry.equipField === "board_style") return (user.board_style ?? "default") === entry.equipValue;
    if (entry.equipField === "title") return (user.title ?? "newcomer") === entry.equipValue;
    return false;
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>Collection</Title>
      <Body tone="muted" style={{ marginTop: space[2] }}>
        Equip themes, banners, board grids, and profile badges. Coin toss skins sync ownership
        across devices.
      </Body>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[4] }}>
        <Row gap={2}>
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
      </ScrollView>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {entries.map((entry) => {
          const hasIt = entry.owned(owned, user);
          const equipped = isEquipped(entry);
          return (
            <View key={entry.id} style={styles.card}>
              <Row justify="between" align="center">
                <Heading>{entry.label}</Heading>
                {!hasIt ? (
                  <Caption tone="warn">LOCKED</Caption>
                ) : equipped ? (
                  <Caption tone="accent">ACTIVE</Caption>
                ) : null}
              </Row>
              <Body tone="muted">{entry.description}</Body>

              {/* Live preview */}
              {entry.equipField === "theme" ? (
                <ThemeSwatch themeId={entry.equipValue as ThemeId} />
              ) : entry.equipField === "banner" ? (
                <BannerRenderer
                  bannerId={entry.equipValue}
                  themeId={themeId}
                  style={styles.bannerPreview}
                />
              ) : entry.equipField === "title" ? (
                <View style={[styles.bannerPreview, { justifyContent: "center", alignItems: "center" }]}>
                  <Caption tone="accent">{entry.label}</Caption>
                </View>
              ) : (
                <View style={[styles.bannerPreview, { backgroundColor: colors.bgRaised }]} />
              )}

              <View style={{ marginTop: space[3] }}>
                <Btn
                  variant={equipped ? "ghost" : "secondary"}
                  disabled={!hasIt || equipped || busy === entry.id}
                  loading={busy === entry.id}
                  onPress={() => onEquip(entry.id)}
                >
                  {entry.equipField === "coin"
                    ? hasIt
                      ? "Owned"
                      : "Get in Store"
                    : equipped
                      ? "Equipped"
                      : hasIt
                        ? "Equip"
                        : "Get in Store"}
                </Btn>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

/** Mini board + palette swatch so the user sees the theme before equipping. */
function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const p = THEMES[themeId];
  return (
    <View style={[styles.swatch, { backgroundColor: p.bg, borderColor: p.border }]}>
      <View style={[styles.swatchBoard, { backgroundColor: p.boardBg, borderColor: p.boardLine }]}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={styles.swatchRow}>
            {[0, 1, 2].map((c) => {
              const owner = (r + c) % 3;
              return (
                <View
                  key={c}
                  style={[styles.swatchCell, { backgroundColor: p.boardCell, borderColor: p.boardLine }]}
                >
                  {owner === 1 ? (
                    <View style={[styles.swatchDot, { backgroundColor: p.p1 }]} />
                  ) : owner === 2 ? (
                    <View style={[styles.swatchDot, { backgroundColor: p.p2 }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <View style={[styles.chip, { backgroundColor: p.accent }]} />
        <View style={[styles.chip, { backgroundColor: p.p1 }]} />
        <View style={[styles.chip, { backgroundColor: p.p2 }]} />
        <View style={[styles.chip, { backgroundColor: p.bgCard, borderWidth: 1, borderColor: p.border }]} />
      </View>
    </View>
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
  bannerPreview: {
    height: 64,
    borderRadius: radii.md,
    marginTop: space[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatch: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    marginTop: space[3],
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  swatchBoard: {
    padding: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: 3,
  },
  swatchRow: { flexDirection: "row", gap: 3 },
  swatchCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchDot: { width: 8, height: 8, borderRadius: 4 },
  chip: { width: 22, height: 22, borderRadius: 6 },
});
