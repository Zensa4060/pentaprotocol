/**
 * Native store — buy **themes**, **banners** and **grids** with
 * ProtoCredits / PentaShards. Every item opens a live **preview** before
 * purchase. Grids are lightweight board skins (gradient identity + paired
 * pieces); their id is the backend-priced ``*_grid`` id, so purchasing
 * needs no backend changes. After buying, equip from Collection.
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
import { purchaseStoreItem } from "@/lib/store/api";
import {
  STORE_BANNERS,
  STORE_GRIDS,
  STORE_THEMES,
  type StoreItem,
} from "@/lib/store/catalog";
import { BOARD_SKINS, PIECE_SKINS, SKIN_BUNDLES } from "@/lib/cosmetics/skins";
import { useAuthStore } from "@/lib/store";
import { THEMES, normalizeThemeId, type ThemeId, type ThemePalette } from "@/theme/themes";
import { useTheme, usePalette } from "@/theme/ThemeProvider";
import { radii, space } from "@/theme/tokens";

type Tab = "themes" | "banners" | "grids";

const TABS: { key: Tab; label: string; items: StoreItem[] }[] = [
  { key: "themes", label: "THEMES", items: STORE_THEMES },
  { key: "grids", label: "GRIDS", items: STORE_GRIDS },
  { key: "banners", label: "BANNERS", items: STORE_BANNERS },
];

/** Store item id → mobile ThemeId (themes only). */
function themeIdForItem(itemId: string): ThemeId {
  if (itemId === "theme_space") return "space";
  if (itemId === "theme_pixel") return "pixel";
  return normalizeThemeId(itemId);
}

/** Bundle whose board == this grid store id (for the piece preview). */
function bundleForGrid(itemId: string) {
  return SKIN_BUNDLES.find((b) => b.boardId === itemId);
}

export default function StoreScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId } = useTheme();
  const palette = usePalette();
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

  const cardStyle = { backgroundColor: palette.bgCard, borderColor: palette.border };

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

      <Row gap={2} style={{ marginTop: space[4] }}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[
              styles.tab,
              { borderColor: palette.border },
              tab === t.key && { borderColor: palette.accent, backgroundColor: palette.bgRaised },
            ]}
          >
            <Caption tone={tab === t.key ? "accent" : "muted"}>{t.label}</Caption>
          </Pressable>
        ))}
      </Row>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {items.map((item) => {
          const isOwned = owned.has(item.id);
          return (
            <View key={item.id} style={[styles.card, cardStyle]}>
              {/* Inline preview thumbnail */}
              {item.category === "banner" ? (
                <BannerRenderer bannerId={item.id} themeId={themeId} style={[styles.thumb, { borderColor: palette.border }]} />
              ) : item.category === "grid" ? (
                <GridThumb itemId={item.id} palette={palette} />
              ) : (
                <View style={[styles.thumb, { borderColor: palette.border, backgroundColor: THEMES[themeIdForItem(item.id)].bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }]}>
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
        <Pressable style={[styles.modalScrim, { backgroundColor: palette.scrim }]} onPress={() => setPreview(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: palette.bgCard, borderColor: palette.borderAccent }]} onPress={() => undefined}>
            {preview ? (
              <>
                <Eyebrow tone="accent">
                  {preview.category === "theme" ? "THEME PREVIEW" : preview.category === "grid" ? "GRID PREVIEW" : "BANNER PREVIEW"}
                </Eyebrow>
                <Heading style={{ marginTop: space[2] }}>{preview.label}</Heading>
                {preview.category === "banner" ? (
                  <BannerRenderer bannerId={preview.id} themeId={themeId} style={[styles.previewBig, { borderColor: palette.border }]} />
                ) : preview.category === "grid" ? (
                  <GridPreview itemId={preview.id} palette={palette} />
                ) : (
                  <ThemePreview themeId={themeIdForItem(preview.id)} palette={palette} />
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

/** Small gradient board thumbnail for a grid store item. */
function GridThumb({ itemId, palette }: { itemId: string; palette: ThemePalette }) {
  const board = BOARD_SKINS[itemId];
  const bundle = bundleForGrid(itemId);
  const piece = bundle ? PIECE_SKINS[bundle.pieceId] : PIECE_SKINS.default;
  if (!board) return null;
  return (
    <View style={[styles.thumb, { borderColor: palette.border, alignItems: "center", justifyContent: "center" }]}>
      {board.bgStops ? (
        <LinearGradient
          colors={board.bgStops as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Row gap={3} align="center">
        <Text style={{ fontSize: 22, color: piece.p1 ?? palette.p1, fontWeight: "800" }}>
          {piece.p1Glyph || palette.glyphP1}
        </Text>
        <Text style={{ fontSize: 22, color: piece.p2 ?? palette.p2, fontWeight: "800" }}>
          {piece.p2Glyph || palette.glyphP2}
        </Text>
      </Row>
    </View>
  );
}

/** Larger gradient board preview (modal) for a grid. */
function GridPreview({ itemId, palette }: { itemId: string; palette: ThemePalette }) {
  const board = BOARD_SKINS[itemId];
  const bundle = bundleForGrid(itemId);
  const piece = bundle ? PIECE_SKINS[bundle.pieceId] : PIECE_SKINS.default;
  if (!board) return null;
  const line = board.line ?? palette.boardLine;
  const cell = board.cell ?? palette.boardCell;
  const g1 = piece.p1Glyph || palette.glyphP1;
  const g2 = piece.p2Glyph || palette.glyphP2;
  const c1 = piece.p1 ?? palette.p1;
  const c2 = piece.p2 ?? palette.p2;
  const glyphAt = (r: number, c: number) =>
    r === c ? { g: r === 1 ? g2 : g1, color: r === 1 ? c2 : c1 } : null;
  return (
    <View style={[styles.previewBig, { borderColor: palette.border, alignItems: "center", justifyContent: "center" }]}>
      {board.bgStops ? (
        <LinearGradient
          colors={board.bgStops as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={{ padding: 6, borderRadius: 8, borderWidth: 1, borderColor: line, gap: 4 }}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 4 }}>
            {[0, 1, 2].map((c) => {
              const cellGlyph = glyphAt(r, c);
              return (
                <View
                  key={c}
                  style={{ width: 30, height: 30, borderRadius: 4, backgroundColor: cell, borderWidth: 1, borderColor: line, alignItems: "center", justifyContent: "center" }}
                >
                  {cellGlyph ? (
                    <Text style={{ fontSize: 16, color: cellGlyph.color, fontWeight: "800" }}>{cellGlyph.g}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Board-on-palette preview for a theme. */
function ThemePreview({ themeId, palette }: { themeId: ThemeId; palette: ThemePalette }) {
  const p = THEMES[themeId];
  return (
    <View style={[styles.previewBig, { borderColor: palette.border, backgroundColor: p.bg, alignItems: "center", justifyContent: "center" }]}>
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
    alignItems: "center",
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[4],
    marginBottom: space[3],
  },
  thumb: {
    height: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  modalScrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  modalCard: {
    width: "100%",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[5],
  },
  previewBig: {
    height: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: space[3],
    overflow: "hidden",
  },
});
