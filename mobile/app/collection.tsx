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

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from "react-native";

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
import { boardSkinFor } from "@/lib/cosmetics/boardSkin";
import { tossSkinFromStoreId, useTossSkin } from "@/lib/cosmetics/tossSkin";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { THEMES, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

const TABS: CollectionTab[] = ["themes", "banners", "grids", "coins", "badges"];

export default function CollectionScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: CollectionTab = TABS.includes(params.tab as CollectionTab)
    ? (params.tab as CollectionTab)
    : "themes";
  const user = useAuthStore((s) => s.user);
  const { themeId, setTheme } = useTheme();
  const [tab, setTab] = useState<CollectionTab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [equipFlash, setEquipFlash] = useState<string | null>(null);
  const [tossSkin, setTossSkin] = useTossSkin();

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
        } else if (entry.equipField === "coin") {
          const skin =
            entry.equipValue === "default"
              ? ("default" as const)
              : tossSkinFromStoreId(entry.equipValue);
          if (!skin) throw new Error("Unknown coin toss skin.");
          await setTossSkin(skin);
        }
        setEquipFlash(entry.label);
      } catch (err) {
        Alert.alert("Could not equip", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusy(null);
      }
    },
    [busy, owned, setTheme, setTossSkin, tab, user],
  );

  const isEquipped = (entry: CollectionEntry) => {
    if (!user) return false;
    if (entry.equipField === "theme") return themeId === entry.equipValue;
    if (entry.equipField === "banner") return (user.banner ?? "default") === entry.equipValue;
    if (entry.equipField === "board_style") return (user.board_style ?? "default") === entry.equipValue;
    if (entry.equipField === "title") return (user.title ?? "newcomer") === entry.equipValue;
    if (entry.equipField === "coin") {
      const skin =
        entry.equipValue === "default" ? "default" : tossSkinFromStoreId(entry.equipValue);
      return skin !== null && skin === tossSkin;
    }
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
        Equip themes, banners, board grids, coin toss skins, and profile badges.
      </Body>

      {/* flexGrow/flexShrink 0: the flex column otherwise compresses this
          horizontal scroller vertically and clips the chip labels. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: space[4], flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ alignItems: "center" }}
      >
        <Row gap={2}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabOn]}
            >
              <Caption
                tone={tab === t ? "accent" : "muted"}
                maxFontSizeMultiplier={1.2}
                numberOfLines={1}
                style={{ lineHeight: 18, includeFontPadding: false }}
              >
                {t.toUpperCase()}
              </Caption>
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
              ) : entry.equipField === "board_style" ? (
                <GridSwatch boardStyle={entry.equipValue} />
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
                  {equipped ? "Equipped" : hasIt ? "Equip" : "Get in Store"}
                </Btn>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <EquipFlash label={equipFlash} onDone={() => setEquipFlash(null)} />
    </Screen>
  );
}

/**
 * Animated equip confirmation — scales/glows in over the screen and
 * auto-dismisses, replacing the old bare system alert.
 */
function EquipFlash({ label, onDone }: { label: string | null; onDone: () => void }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!label) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    ring.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) onDone();
        },
      );
    }, 1500);
    return () => clearTimeout(id);
  }, [label, onDone, opacity, ring, scale]);

  if (!label) return null;

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.7, 0] });

  return (
    <View pointerEvents="none" style={styles.flashWrap}>
      <Animated.View
        style={[
          styles.flashRing,
          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
        ]}
      />
      <Animated.View style={[styles.flashCard, { opacity, transform: [{ scale }] }]}>
        <Caption tone="accent" style={{ letterSpacing: 2, fontWeight: "900" }}>
          ✓ EQUIPPED
        </Caption>
        <Heading style={{ marginTop: space[1], textAlign: "center" }}>{label}</Heading>
        <Caption tone="muted" style={{ marginTop: 2 }}>
          now active
        </Caption>
      </Animated.View>
    </View>
  );
}

/** Mini board preview rendered with the grid bundle's skin colors. */
function GridSwatch({ boardStyle }: { boardStyle: string }) {
  const skin = boardSkinFor(boardStyle);
  const boardBg = skin?.boardBg ?? colors.bgRaised;
  const line = skin?.boardLine ?? colors.border;
  const cellBg = skin?.cellBg ?? colors.bgCard;
  const cellBorder = skin?.cellBorder ?? colors.border;
  const accent = skin?.accent ?? colors.textMuted;
  return (
    <View style={[styles.gridSwatch, { backgroundColor: boardBg, borderColor: line }]}>
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.swatchRow}>
          {[0, 1, 2, 3, 4].map((c) => (
            <View
              key={c}
              style={[
                styles.gridSwatchCell,
                { backgroundColor: cellBg, borderColor: cellBorder },
              ]}
            >
              {(r + c) % 4 === 1 ? (
                <View style={[styles.swatchDot, { backgroundColor: accent }]} />
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
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
  // Size each chip to its label — `flex: 1` inside the horizontal
  // ScrollView squeezed the chips and clipped the text edges.
  tab: {
    minHeight: 40,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
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
  gridSwatch: {
    marginTop: space[3],
    padding: space[2],
    borderRadius: radii.md,
    borderWidth: 1.5,
    gap: 3,
    alignItems: "center",
  },
  gridSwatchCell: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 3,
  },
  flashWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  flashRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  flashCard: {
    minWidth: 220,
    maxWidth: "80%",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.borderAccent,
    paddingVertical: space[5],
    paddingHorizontal: space[6],
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
});
