/**
 * Native store — buy **themes** and **banners** with ProtoCredits /
 * PentaShards. Every item opens a live **preview** before purchase
 * (fixes BUG-04: stale listings + no preview).
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Title,
} from "@/components/ui";
import { BannerRenderer } from "@/components/BannerRenderer";
import { CurrencyChip } from "@/components/CurrencyChip";
import { purchaseStoreItem } from "@/lib/store/api";
import {
  STORE_BANNERS,
  STORE_THEMES,
  type StoreItem,
} from "@/lib/store/catalog";
import { useAuthStore } from "@/lib/store";
import { THEMES, normalizeThemeId, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

type Tab = "themes" | "banners";

const TABS: { key: Tab; label: string; items: StoreItem[] }[] = [
  { key: "themes", label: "THEMES", items: STORE_THEMES },
  { key: "banners", label: "BANNERS", items: STORE_BANNERS },
];

/** Store item id → mobile ThemeId (themes only). */
function themeIdForItem(itemId: string): ThemeId {
  if (itemId === "theme_space") return "space";
  if (itemId === "theme_pixel") return "pixel";
  return normalizeThemeId(itemId);
}

export default function StoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId } = useTheme();
  const [tab, setTab] = useState<Tab>("themes");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoreItem | null>(null);

  const items = TABS.find((t) => t.key === tab)?.items ?? [];
  const owned = new Set(user?.purchased_items ?? []);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const onBuy = async (item: StoreItem) => {
    if (!user || busy) return;
    if (owned.has(item.id)) {
      Alert.alert("Owned", "You already own this item.");
      return;
    }
    if (user.protocredits < item.pricePc || user.shards < item.pricePs) {
      Alert.alert("Insufficient balance", "Not enough ProtoCredits or PentaShards.");
      return;
    }
    setBusy(item.id);
    try {
      await purchaseStoreItem(item.id, item.pricePc, item.pricePs);
      setPreview(null);
      Alert.alert("Purchased", `${item.label} added to your collection. Equip it from Collection.`);
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>ProtoShop</Title>
      <Row gap={4} style={{ marginTop: space[2] }} align="center">
        <CurrencyChip kind="pc" value={user?.protocredits ?? 0} size={20} />
        <CurrencyChip kind="ps" value={user?.shards ?? 0} size={20} />
      </Row>

      <Row gap={2} style={{ marginTop: space[4] }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key && styles.tabOn]}
          >
            <Caption tone={tab === t.key ? "accent" : "muted"}>{t.label}</Caption>
          </Pressable>
        ))}
      </Row>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          return (
            <View key={item.id} style={styles.card}>
              {/* Inline preview thumbnail */}
              {item.category === "banner" ? (
                <BannerRenderer bannerId={item.id} themeId={themeId} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: THEMES[themeIdForItem(item.id)].bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }]}>
                  <View style={[styles.dot, { backgroundColor: THEMES[themeIdForItem(item.id)].accent }]} />
                  <View style={[styles.dot, { backgroundColor: THEMES[themeIdForItem(item.id)].p1 }]} />
                  <View style={[styles.dot, { backgroundColor: THEMES[themeIdForItem(item.id)].p2 }]} />
                </View>
              )}
              <Heading style={{ marginTop: space[3] }}>{item.label}</Heading>
              <Body tone="muted">{item.description}</Body>
              <Caption tone="muted" style={{ marginTop: space[2] }}>
                {item.pricePc > 0 ? `${item.pricePc} PC` : ""}
                {item.pricePc > 0 && item.pricePs > 0 ? " + " : ""}
                {item.pricePs > 0 ? `${item.pricePs} PS` : ""}
              </Caption>
              <Row gap={2} style={{ marginTop: space[3] }}>
                <View style={{ flex: 1 }}>
                  <Btn variant="secondary" onPress={() => setPreview(item)}>
                    Preview
                  </Btn>
                </View>
                <View style={{ flex: 1 }}>
                  <Btn
                    variant={isOwned ? "ghost" : "primary"}
                    disabled={isOwned || busy === item.id}
                    loading={busy === item.id}
                    onPress={() => onBuy(item)}
                  >
                    {isOwned ? "Owned" : "Purchase"}
                  </Btn>
                </View>
              </Row>
            </View>
          );
        })}
        <Eyebrow tone="muted" style={{ marginTop: space[6] }}>
          UPI TOP-UPS
        </Eyebrow>
        <Body tone="muted" style={{ marginTop: space[2] }}>
          INR purchases via UPI are completed on pentaprotocol.com (scan QR + submit UTR). Balance
          syncs to this account automatically after ops verification.
        </Body>
      </ScrollView>

      {/* ── Preview modal ─────────────────────────────────────────── */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPreview(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {preview ? (
              <>
                <Eyebrow tone="accent">{preview.category === "theme" ? "THEME PREVIEW" : "BANNER PREVIEW"}</Eyebrow>
                <Heading style={{ marginTop: space[2] }}>{preview.label}</Heading>
                {preview.category === "banner" ? (
                  <BannerRenderer
                    bannerId={preview.id}
                    themeId={themeId}
                    style={styles.previewBig}
                  />
                ) : (
                  <ThemePreview themeId={themeIdForItem(preview.id)} />
                )}
                <Body tone="muted" style={{ marginTop: space[3] }}>
                  {preview.description}
                </Body>
                <Row gap={2} style={{ marginTop: space[4] }}>
                  <View style={{ flex: 1 }}>
                    <Btn variant="secondary" onPress={() => setPreview(null)}>
                      Close
                    </Btn>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Btn
                      variant="primary"
                      disabled={owned.has(preview.id) || busy === preview.id}
                      loading={busy === preview.id}
                      onPress={() => onBuy(preview)}
                    >
                      {owned.has(preview.id) ? "Owned" : "Purchase"}
                    </Btn>
                  </View>
                </Row>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** Board-on-palette preview for a theme. */
function ThemePreview({ themeId }: { themeId: ThemeId }) {
  const p = THEMES[themeId];
  return (
    <View style={[styles.previewBig, { backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }]}>
      <View style={{ padding: 6, borderRadius: 8, backgroundColor: p.boardBg, borderWidth: 1, borderColor: p.boardLine, gap: 4 }}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 4 }}>
            {[0, 1, 2].map((c) => {
              const owner = (r * 3 + c) % 3;
              return (
                <View
                  key={c}
                  style={{ width: 26, height: 26, borderRadius: 4, backgroundColor: p.boardCell, borderWidth: 1, borderColor: p.boardLine, alignItems: "center", justifyContent: "center" }}
                >
                  {owner === 1 ? <View style={[styles.dot, { backgroundColor: p.p1 }]} /> : owner === 2 ? <View style={[styles.dot, { backgroundColor: p.p2 }]} /> : null}
                </View>
              );
            })}
          </View>
        ))}
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
  thumb: {
    height: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  previewBig: {
    height: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: space[3],
    overflow: "hidden",
  },
});
