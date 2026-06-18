/**
 * ProtoShop — themes, banners, grids, coins, bot reward claims, UPI top-up links.
 *
 * Futuristic-minimalist redesign (UI only): a 2-column **live preview gallery**
 * — every grid and banner renders its real animated skin as a framed tile, with
 * name, price and an ACQUIRE / OWNED / CLAIM pill. Tapping a tile opens the
 * existing full-screen live preview + purchase sheet. All purchase / claim /
 * top-up logic is unchanged.
 */

import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { BotRewardsBanner } from "@/components/store/BotRewardsBanner";
import { GridLivePreview } from "@/components/cosmetics/GridLivePreview";
import { Body, Btn, Caption, Eyebrow, Mono, Screen } from "@/components/ui";
import { Hairline, HudHeader, SectionLabel, SegTabs } from "@/components/ui/hud";
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
  LIVE_GRID_BUNDLES,
  STORE_THEMES,
  type GridBundle,
  type StoreItem,
} from "@/lib/store/catalog";
import { useAuthStore } from "@/lib/store";
import { THEMES, normalizeThemeId, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

type Tab = "themes" | "banners" | "grids" | "topup";

const TABS: { key: Tab; label: string }[] = [
  { key: "themes", label: "THEMES" },
  { key: "banners", label: "BANNERS" },
  { key: "grids", label: "GRIDS" },
  { key: "topup", label: "TOP-UP" },
];

/** Developer UPI QR — same asset the web store shows (public/creator-payment-qr.png). */
const PAYMENT_QR = require("../assets/images/creator-payment-qr.png");

/** Translucent version of a #rrggbb accent — used for the live grid tile border. */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

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
  const [previewGrid, setPreviewGrid] = useState<GridBundle | null>(null);
  const { width: winW } = useWindowDimensions();
  const gridPreviewSize = Math.min(winW - 96, 300);

  // 2-column gallery geometry (Screen `padded` = 20px gutters; 12px column gap).
  const colW = Math.floor((winW - space[5] * 2 - space[3]) / 2);
  const innerW = colW - space[3] * 2;

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

  // In-app top-up sheet (no web redirect): pack details + the developer's
  // UPI QR while the Razorpay gateway is being integrated.
  const [topup, setTopup] = useState<{
    label: string;
    amount: number;
    currency: "PC" | "PS";
    priceInr: number;
  } | null>(null);

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader
        title="PROTOSHOP"
        eyebrow="ACQUIRE COSMETICS · PROTOCREDITS / PENTASHARDS"
        onBack={goBack}
        right={
          <View style={styles.wallet}>
            <CurrencyChip kind="pc" value={user?.protocredits ?? 0} size={18} />
            <CurrencyChip kind="ps" value={user?.shards ?? 0} size={18} />
          </View>
        }
      />

      <BotRewardsBanner user={user} />

      <SegTabs<Tab> tabs={TABS} value={tab} onChange={setTab} style={{ marginTop: space[5] }} />

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {/* ── Themes · live palette tiles ──────────────────────────── */}
        {tab === "themes" && (
          <View style={styles.gallery}>
            {STORE_THEMES.map((item) => {
              const isOwned = owned.has(item.id);
              const p = THEMES[themeIdForItem(item.id)];
              return (
                <Tile
                  key={item.id}
                  width={colW}
                  name={item.label}
                  meta={`${item.pricePc} PC · +${item.pricePs} PS`}
                  pill={<StatusPill kind={isOwned ? "owned" : "acquire"} loading={busy === item.id} />}
                  onOpen={() => setPreview(item)}
                >
                  <View style={[styles.prev, { width: innerW, height: innerW * 0.62, backgroundColor: p.bg }]}>
                    <View style={[styles.themeBoard, { backgroundColor: p.boardBg, borderColor: p.boardLine }]}>
                      <View style={[styles.themeDot, { backgroundColor: p.accent }]} />
                    </View>
                  </View>
                </Tile>
              );
            })}
          </View>
        )}

        {/* ── Banners · live animated tiles ────────────────────────── */}
        {tab === "banners" && (
          <View style={styles.gallery}>
            {STORE_BANNERS.map((item) => {
              const isOwned = owned.has(item.id);
              const canClaim = rewards.banner === "pending" && !isOwned;
              return (
                <Tile
                  key={item.id}
                  width={colW}
                  name={item.label}
                  meta={isOwned ? "owned" : canClaim ? "free reward" : `${item.pricePc} PC`}
                  pill={
                    <StatusPill
                      kind={isOwned ? "owned" : canClaim ? "claim" : "acquire"}
                      loading={busy === item.id || busy === `claim-${item.id}`}
                      onPress={canClaim ? () => onClaim("banner", item.id, item.label) : undefined}
                    />
                  }
                  onOpen={() => setPreview(item)}
                >
                  <View style={[styles.prev, { width: innerW, height: innerW * 0.6 }]}>
                    <BannerRenderer bannerId={item.id} themeId={themeId} style={StyleSheet.absoluteFill} animated={false} />
                    <View style={styles.previewBtnOverlay}>
                      <Caption tone="accent" style={styles.previewBtnTxt}>PREVIEW</Caption>
                    </View>
                  </View>
                </Tile>
              );
            })}
          </View>
        )}

        {/* ── Grids · verbatim live board tiles ────────────────────── */}
        {tab === "grids" && (
          <View style={styles.gallery}>
            {LIVE_GRID_BUNDLES.map((bundle) => {
              const isOwned = owned.has(bundle.boardId) && owned.has(bundle.pieceId);
              const canClaim =
                (rewards.board_skin === "pending" || rewards.syros_skin === "pending") &&
                !owned.has(bundle.boardId);
              return (
                <Tile
                  key={bundle.id}
                  width={colW}
                  accent={bundle.accentColor}
                  name={bundle.label}
                  meta={isOwned ? "owned" : canClaim ? "free reward" : `${bundle.bundlePrice} PC`}
                  pill={
                    <StatusPill
                      kind={isOwned ? "owned" : canClaim ? "claim" : "acquire"}
                      loading={busy === bundle.id || busy === `claim-${bundle.boardId}`}
                      onPress={
                        canClaim
                          ? () => onClaim(boardSkinClaimSlot(rewards), bundle.boardId, bundle.label)
                          : undefined
                      }
                    />
                  }
                  onOpen={() => setPreviewGrid(bundle)}
                >
                  <View style={[styles.prev, { width: innerW, height: innerW * 0.6 }]}>
                    <GridLivePreview
                      boardStyle={bundle.boardId}
                      size={innerW}
                      pieces={false}
                      live={false}
                      style={{ borderColor: hexA(bundle.accentColor, 0.5) }}
                    />
                    <View style={styles.previewBtnOverlay}>
                      <Caption tone="accent" style={styles.previewBtnTxt}>PREVIEW</Caption>
                    </View>
                  </View>
                </Tile>
              );
            })}
          </View>
        )}


        {/* ── Top-up · INR / UPI packages ──────────────────────────── */}
        {tab === "topup" && (
          <>
            <SectionLabel label="PROTOCREDITS · INR / UPI" style={{ marginBottom: space[2] }} />
            <Caption tone="muted" style={{ marginBottom: space[3], lineHeight: 18 }}>
              Buy in-app — your balance is credited to this account after verification.
            </Caption>
            {PC_PACKAGES.map((p) => (
              <View key={p.id}>
                <View style={styles.packageRow}>
                  <View style={{ flex: 1 }}>
                    <Body style={styles.itemName}>{p.label}</Body>
                    <Mono tone="dim" style={styles.itemMeta}>
                      {(p.credits + p.bonus).toLocaleString()} PC · ₹{p.priceInr}
                    </Mono>
                  </View>
                  <RowAction
                    label="BUY"
                    onPress={() =>
                      setTopup({
                        label: p.label,
                        amount: p.credits + p.bonus,
                        currency: "PC",
                        priceInr: p.priceInr,
                      })
                    }
                  />
                </View>
                <Hairline />
              </View>
            ))}
            <SectionLabel label="PENTASHARDS" style={{ marginTop: space[6], marginBottom: space[2] }} />
            {PS_PACKAGES.map((p) => (
              <View key={`ps-${p.id}`}>
                <View style={styles.packageRow}>
                  <View style={{ flex: 1 }}>
                    <Body style={styles.itemName}>{p.label}</Body>
                    <Mono tone="dim" style={styles.itemMeta}>
                      {(p.credits + p.bonus).toLocaleString()} PS · ₹{p.priceInr}
                    </Mono>
                  </View>
                  <RowAction
                    label="BUY"
                    onPress={() =>
                      setTopup({
                        label: p.label,
                        amount: p.credits + p.bonus,
                        currency: "PS",
                        priceInr: p.priceInr,
                      })
                    }
                  />
                </View>
                <Hairline />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* ── In-app top-up sheet (web redirect removed) ─────────────── */}
      <Modal visible={!!topup} transparent animationType="slide" onRequestClose={() => setTopup(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setTopup(null)}>
          <Pressable style={styles.topupCard} onPress={() => undefined}>
            {topup ? (
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <Eyebrow tone="accent">CHECKOUT · {topup.currency === "PC" ? "PROTOCREDITS" : "PENTASHARDS"}</Eyebrow>
                <Body style={{ ...styles.itemName, fontSize: 20, marginTop: space[2] }}>{topup.label}</Body>
                <Mono tone="muted" style={{ marginTop: 2 }}>
                  {topup.amount.toLocaleString()} {topup.currency} · ₹{topup.priceInr}
                </Mono>

                <View style={styles.gatewayNote}>
                  <Eyebrow tone="warn">PAYMENT GATEWAY COMING SOON</Eyebrow>
                  <Caption tone="muted" style={{ marginTop: space[1], lineHeight: 18 }}>
                    Razorpay checkout is on the way. Until then you can pay by UPI
                    using the QR below.
                  </Caption>
                </View>

                <View style={styles.qrWrap}>
                  <Image source={PAYMENT_QR} style={styles.qrImage} resizeMode="contain" />
                </View>
                <Caption tone="muted" center style={{ marginTop: space[2], lineHeight: 18 }}>
                  This QR belongs directly to the developer. Purchases are still
                  honored — pay ₹{topup.priceInr} via any UPI app and your{" "}
                  {topup.currency} balance is credited to this account after
                  verification.
                </Caption>

                <View style={{ height: space[4] }} />
                <Btn variant="primary" onPress={() => setTopup(null)}>
                  Done
                </Btn>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!previewGrid} transparent animationType="fade" onRequestClose={() => setPreviewGrid(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPreviewGrid(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {previewGrid ? (
              (() => {
                const gOwned = owned.has(previewGrid.boardId) && owned.has(previewGrid.pieceId);
                return (
                  <>
                    <Eyebrow tone="accent">GRID PREVIEW · LIVE</Eyebrow>
                    <Body style={{ ...styles.itemName, fontSize: 20, marginTop: space[2] }}>{previewGrid.label}</Body>
                    <View style={{ alignItems: "center", marginTop: space[3] }}>
                      <GridLivePreview boardStyle={previewGrid.boardId} size={gridPreviewSize} />
                    </View>
                    <Body tone="muted" style={{ marginTop: space[3] }}>{previewGrid.description}</Body>
                    <Mono tone="dim" style={{ marginTop: space[1] }}>
                      {previewGrid.bundlePrice} PC · board 1599 + pieces 599
                    </Mono>
                    <View style={styles.previewActions}>
                      <View style={{ flex: 1 }}>
                        <Btn variant="secondary" onPress={() => setPreviewGrid(null)}>
                          Close
                        </Btn>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Btn
                          variant="primary"
                          disabled={gOwned || busy === previewGrid.id}
                          loading={busy === previewGrid.id}
                          onPress={() => onBuyGrid(previewGrid)}
                        >
                          {gOwned ? "Owned" : "Purchase"}
                        </Btn>
                      </View>
                    </View>
                  </>
                );
              })()
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPreview(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {preview ? (
              <>
                <Eyebrow tone="accent">PREVIEW</Eyebrow>
                <Body style={{ ...styles.itemName, fontSize: 20, marginTop: space[2] }}>{preview.label}</Body>
                {preview.category === "banner" ? (
                  <BannerRenderer bannerId={preview.id} themeId={themeId} style={styles.previewBig} />
                ) : (
                  <ThemePreview themeId={themeIdForItem(preview.id)} />
                )}
                <Body tone="muted" style={{ marginTop: space[3] }}>
                  {preview.description}
                </Body>
                <View style={styles.previewActions}>
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
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** Framed gallery tile — live preview on top, name + meta + status pill below. */
function Tile({
  width,
  name,
  meta,
  pill,
  accent,
  onOpen,
  children,
}: {
  width: number;
  name: string;
  meta: string;
  pill: React.ReactNode;
  accent?: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.tile,
        { width },
        accent ? { borderColor: hexA(accent, 0.32) } : null,
        pressed ? { transform: [{ scale: 0.985 }] } : null,
      ]}
    >
      <View style={styles.tilePrevWrap}>{children}</View>
      <Body style={styles.tileName} numberOfLines={1}>{name}</Body>
      <View style={styles.tileFoot}>
        <Mono tone="dim" style={styles.tileMeta} numberOfLines={1}>{meta}</Mono>
        {pill}
      </View>
    </Pressable>
  );
}

/** Status / action pill: ACQUIRE (decorative), OWNED (dim), CLAIM (tappable). */
function StatusPill({
  kind,
  loading,
  onPress,
}: {
  kind: "acquire" | "owned" | "claim";
  loading?: boolean;
  onPress?: () => void;
}) {
  const label = kind === "owned" ? "OWNED" : kind === "claim" ? "CLAIM" : "GET";
  const owned = kind === "owned";
  const inner = (
    <Caption tone={owned ? "dim" : "accent"} style={styles.pillTxt}>
      {loading ? "···" : label}
    </Caption>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
        style={({ pressed }) => [styles.pill, pressed ? { backgroundColor: "rgba(204,0,0,0.18)" } : null]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.pill, owned && styles.pillOwned]}>{inner}</View>;
}

/** Minimalist row action — ghost-by-default, accent border; mono caps label. */
function RowAction({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const isOwned = label === "OWNED";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        isOwned && styles.actionOwned,
        pressed && !disabled ? { backgroundColor: "rgba(204,0,0,0.16)" } : null,
      ]}
    >
      <Caption tone={isOwned ? "dim" : "accent"} style={styles.actionLabel}>
        {loading ? "···" : label}
      </Caption>
    </Pressable>
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
  wallet: {
    flexDirection: "row",
    gap: space[2],
    alignItems: "center",
  },
  gallery: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  tile: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[3],
    marginBottom: space[3],
  },
  tilePrevWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  prev: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  themeBoard: {
    padding: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeDot: { width: 18, height: 18, borderRadius: 9 },
  tileName: {
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: space[2],
  },
  tileFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: space[2],
  },
  tileMeta: {
    fontSize: 11,
    flexShrink: 1,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: space[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.08)",
  },
  pillOwned: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "transparent",
  },
  pillTxt: {
    fontWeight: "800",
    letterSpacing: 1,
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
  },
  rowMid: {
    flex: 1,
    gap: 4,
  },
  coinFace: {
    width: 58,
    height: 58,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  itemName: {
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  itemMeta: {
    fontSize: 11,
    lineHeight: 15,
  },
  action: {
    minWidth: 92,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionOwned: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "transparent",
  },
  actionLabel: {
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  packageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
  },
  topupCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
    width: "100%",
    maxHeight: "88%",
  },
  gatewayNote: {
    marginTop: space[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warn,
    backgroundColor: colors.bgCard,
    padding: space[3],
  },
  qrWrap: {
    marginTop: space[4],
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    padding: space[3],
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  previewActions: {
    flexDirection: "row",
    gap: space[2],
    marginTop: space[4],
  },
  previewBig: {
    height: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginTop: space[3],
    overflow: "hidden",
  },
  previewBtnOverlay: {
    position: "absolute",
    bottom: space[1],
    right: space[1],
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  previewBtnTxt: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
