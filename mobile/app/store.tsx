/**
 * Native store — buy cosmetics with ProtoCredits / PentaShards.
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

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
import { purchaseStoreItem } from "@/lib/store/api";
import {
  STORE_BANNERS,
  STORE_GRIDS,
  STORE_PIECES,
  STORE_THEMES,
  type StoreItem,
} from "@/lib/store/catalog";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

type Tab = "themes" | "banners" | "grids" | "pieces";

const TABS: { key: Tab; label: string; items: StoreItem[] }[] = [
  { key: "themes", label: "THEMES", items: STORE_THEMES },
  { key: "banners", label: "BANNERS", items: STORE_BANNERS },
  { key: "grids", label: "GRIDS", items: STORE_GRIDS },
  { key: "pieces", label: "PIECES", items: STORE_PIECES },
];

export default function StoreScreen() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("themes");
  const [busy, setBusy] = useState<string | null>(null);

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
      Alert.alert("Purchased", `${item.label} added to your collection.`);
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
      <Row gap={4} style={{ marginTop: space[2] }}>
        <Caption tone="accent">⬡ {user?.protocredits ?? 0} PC</Caption>
        <Caption tone="muted">◆ {user?.shards ?? 0} PS</Caption>
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[4] }}>
        <Row gap={2}>
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
      </ScrollView>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          return (
            <View key={item.id} style={styles.card}>
              <Heading>{item.label}</Heading>
              <Body tone="muted">{item.description}</Body>
              <Caption tone="muted" style={{ marginTop: space[2] }}>
                {item.pricePc > 0 ? `${item.pricePc} PC` : ""}
                {item.pricePc > 0 && item.pricePs > 0 ? " + " : ""}
                {item.pricePs > 0 ? `${item.pricePs} PS` : ""}
              </Caption>
              <View style={{ marginTop: space[3] }}>
                <Btn
                  variant={isOwned ? "ghost" : "primary"}
                  disabled={isOwned || busy === item.id}
                  loading={busy === item.id}
                  onPress={() => onBuy(item)}
                >
                  {isOwned ? "Owned" : "Purchase"}
                </Btn>
              </View>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
