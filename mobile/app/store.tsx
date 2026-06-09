/**
 * ProtoShop — themes, banners, grids, coins, bot reward claims, UPI top-up links.
 */

import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { BotRewardsBanner } from "@/components/store/BotRewardsBanner";
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
import {
  boardSkinClaimSlot,
  claimBotReward,
  readBotRewards,
} from "@/lib/botRewardClaims";
import { purchaseGridBundle, purchaseStoreItem } from "@/lib/store/api";
import {
  PC_PACKAGES,
  PS_PACKAGES,
  STORE_BANNERS,
  STORE_COINS,
  STORE_GRID_BUNDLES,
  STORE_THEMES,
  type GridBundle,
  type StoreItem,
} from "@/lib/store/catalog";
import { useAuthStore } from "@/lib/store";
import { THEMES, normalizeThemeId, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

type Tab = "themes" | "banners" | "grids" | "coins" | "topup";

const TABS: { key: Tab; label: string }[] = [
  { key: "themes", label: "THEMES" },
  { key: "banners", label: "BANNERS" },
  { key: "grids", label: "GRIDS" },
  { key: "coins", label: "COINS" },
  { key: "topup", label: "TOP-UP" },
];

const WEB_STORE = "https://pentaprotocol.com/store";

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

  const owned = useMemo(() => new Set(user?.purchased_items ?? []), [user?.purchased_items]);
  const rewards = readBotRewards(user);

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
      Alert.alert("Purchased", `${item.label} added to your collection.`);
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async (
    slot: "banner" | "coin_toss" | "board_skin" | "syros_skin",
    itemId: string,
    label: string,
  ) => {
    if (busy) return;
    setBusy(`claim-${itemId}`);
    try {
      await claimBotReward(slot, itemId);
      Alert.alert("Claimed", `${label} unlocked — equip in Collection.`);
    } catch (err) {
      Alert.alert("Claim failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onBuyGrid = async (bundle: GridBundle) => {
    if (!user || busy) return;
    const hasBoard = owned.has(bundle.boardId);
    const hasPiece = owned.has(bundle.pieceId);
    if (hasBoard && hasPiece) {
      Alert.alert("Owned", "You already own this bundle.");
      return;
    }
    const needPc = (hasBoard ? 0 : 1599) + (hasPiece ? 0 : 599);
    if (user.protocredits < needPc) {
      Alert.alert("Insufficient balance", `Need ${needPc} ProtoCredits.`);
      return;
    }
    setBusy(bundle.id);
    try {
      await purchaseGridBundle(bundle, owned);
      Alert.alert("Purchased", `${bundle.label} added to your collection.`);
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const openWebTopUp = (path: "buypc" | "buyps") => {
    Linking.openURL(`${WEB_STORE}/${path}`).catch(() => {
      Alert.alert("Could not open browser", `Visit ${WEB_STORE}/${path} to buy currency.`);
    });
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

      <BotRewardsBanner user={user} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[3] }}>
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
        {tab === "themes" &&
          STORE_THEMES.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              owned={owned.has(item.id)}
              busy={busy === item.id}
              themeId={themeId}
              onPreview={() => setPreview(item)}
              onBuy={() => onBuy(item)}
            />
          ))}

        {tab === "banners" &&
          STORE_BANNERS.map((item) => {
            const isOwned = owned.has(item.id);
            const canClaim = rewards.banner === "pending" && !isOwned;
            return (
              <ItemCard
                key={item.id}
                item={item}
                owned={isOwned}
                busy={busy === item.id || busy === `claim-${item.id}`}
                themeId={themeId}
                claimFree={canClaim}
                onClaimFree={() => onClaim("banner", item.id, item.label)}
                onPreview={() => setPreview(item)}
                onBuy={() => onBuy(item)}
              />
            );
          })}

        {tab === "grids" &&
          STORE_GRID_BUNDLES.map((bundle) => {
            const isOwned = owned.has(bundle.boardId) && owned.has(bundle.pieceId);
            const canClaim =
              (rewards.board_skin === "pending" || rewards.syros_skin === "pending") && !owned.has(bundle.boardId);
            return (
              <View key={bundle.id} style={styles.card}>
                <View style={[styles.thumb, { backgroundColor: bundle.accentColor + "33", borderColor: bundle.accentColor }]} />
                <Heading style={{ marginTop: space[3] }}>{bundle.label}</Heading>
                <Body tone="muted">{bundle.description}</Body>
                <Caption tone="muted" style={{ marginTop: space[2] }}>
                  {bundle.bundlePrice} PC (board 1599 + pieces 599)
                </Caption>
                <Row gap={2} style={{ marginTop: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Btn
                      variant={canClaim ? "primary" : isOwned ? "ghost" : "primary"}
                      disabled={isOwned || busy === bundle.id}
                      loading={busy === bundle.id || busy === `claim-${bundle.boardId}`}
                      onPress={() =>
                        canClaim
                          ? onClaim(boardSkinClaimSlot(rewards), bundle.boardId, bundle.label)
                          : onBuyGrid(bundle)
                      }
                    >
                      {isOwned ? "Owned" : canClaim ? "Claim free" : "Purchase"}
                    </Btn>
                  </View>
                </Row>
              </View>
            );
          })}

        {tab === "coins" &&
          STORE_COINS.map((item) => {
            const isOwned = owned.has(item.id);
            const canClaim = rewards.coin_toss === "pending" && !isOwned;
            return (
              <ItemCard
                key={item.id}
                item={item}
                owned={isOwned}
                busy={busy === item.id || busy === `claim-${item.id}`}
                themeId={themeId}
                claimFree={canClaim}
                onClaimFree={() => onClaim("coin_toss", item.id, item.label)}
                onBuy={() => onBuy(item)}
              />
            );
          })}

        {tab === "topup" && (
          <>
            <Eyebrow tone="accent">PROTOCREDITS (INR / UPI)</Eyebrow>
            <Body tone="muted" style={{ marginTop: space[2], marginBottom: space[3] }}>
              Complete purchases on the web store — balance syncs to this account after verification.
            </Body>
            {PC_PACKAGES.map((p) => (
              <View key={p.id} style={styles.packageRow}>
                <View style={{ flex: 1 }}>
                  <Heading>{p.label}</Heading>
                  <Caption tone="muted">
                    {(p.credits + p.bonus).toLocaleString()} PC · ₹{p.priceInr}
                  </Caption>
                </View>
                <Btn variant="secondary" onPress={() => openWebTopUp("buypc")}>
                  Buy
                </Btn>
              </View>
            ))}
            <Eyebrow tone="accent" style={{ marginTop: space[6] }}>
              PENTASHARDS
            </Eyebrow>
            {PS_PACKAGES.map((p) => (
              <View key={`ps-${p.id}`} style={styles.packageRow}>
                <View style={{ flex: 1 }}>
                  <Heading>{p.label}</Heading>
                  <Caption tone="muted">
                    {(p.credits + p.bonus).toLocaleString()} PS · ₹{p.priceInr}
                  </Caption>
                </View>
                <Btn variant="secondary" onPress={() => openWebTopUp("buyps")}>
                  Buy
                </Btn>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPreview(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {preview ? (
              <>
                <Eyebrow tone="accent">PREVIEW</Eyebrow>
                <Heading style={{ marginTop: space[2] }}>{preview.label}</Heading>
                {preview.category === "banner" ? (
                  <BannerRenderer bannerId={preview.id} themeId={themeId} style={styles.previewBig} />
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

function ItemCard({
  item,
  owned: isOwned,
  busy,
  themeId,
  claimFree,
  onClaimFree,
  onPreview,
  onBuy,
}: {
  item: StoreItem;
  owned: boolean;
  busy: boolean;
  themeId: ThemeId;
  claimFree?: boolean;
  onClaimFree?: () => void;
  onPreview?: () => void;
  onBuy: () => void;
}) {
  return (
    <View style={styles.card}>
      {item.category === "banner" ? (
        <BannerRenderer bannerId={item.id} themeId={themeId} style={styles.thumb} />
      ) : item.category === "theme" ? (
        <View style={[styles.thumb, { backgroundColor: THEMES[themeIdForItem(item.id)].bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }]}>
          <View style={[styles.dot, { backgroundColor: THEMES[themeIdForItem(item.id)].accent }]} />
        </View>
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.bgRaised }]} />
      )}
      <Heading style={{ marginTop: space[3] }}>{item.label}</Heading>
      <Body tone="muted">{item.description}</Body>
      <Caption tone="muted" style={{ marginTop: space[2] }}>
        {item.pricePc > 0 ? `${item.pricePc} PC` : ""}
        {item.pricePc > 0 && item.pricePs > 0 ? " + " : ""}
        {item.pricePs > 0 ? `${item.pricePs} PS` : ""}
      </Caption>
      <Row gap={2} style={{ marginTop: space[3] }}>
        {onPreview ? (
          <View style={{ flex: 1 }}>
            <Btn variant="secondary" onPress={onPreview}>
              Preview
            </Btn>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Btn
            variant={claimFree ? "primary" : isOwned ? "ghost" : "primary"}
            disabled={isOwned && !claimFree}
            loading={busy}
            onPress={claimFree && onClaimFree ? onClaimFree : onBuy}
          >
            {isOwned ? "Owned" : claimFree ? "Claim free" : "Purchase"}
          </Btn>
        </View>
      </Row>
    </View>
  );
}

function ThemePreview({ themeId }: { themeId: ThemeId }) {
  const p = THEMES[themeId];
  return (
    <View style={[styles.previewBig, { backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }]}>
      <View style={{ padding: 6, borderRadius: 8, backgroundColor: p.boardBg, borderWidth: 1, borderColor: p.boardLine }}>
        <View style={{ width: 26, height: 26, borderRadius: 4, backgroundColor: p.boardCell }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingVertical: space[2],
    paddingHorizontal: space[3],
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
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
