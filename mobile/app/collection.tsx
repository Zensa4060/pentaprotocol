/**
 * Native collection — equip owned **themes**, **banners**, and **grids**.
 *
 * Equipping is applied live:
 *   - Theme → ``useTheme().setTheme`` re-renders the board + every themed
 *     surface immediately and persists the preference.
 *   - Banner → ``updateProfile({ banner })`` persists server-side.
 *   - Grid  → ``useTheme().equipBundle`` swaps the board skin + auto-paired
 *     piece skin (persisted on-device); the board reskins immediately.
 *
 * Grids are lightweight ports of the web's animated grid skins — colour
 * identity only, no per-frame animation (see ``lib/cosmetics/skins``).
 */

import { router, Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
import {
  BOARD_SKINS,
  PIECE_SKINS,
  SKIN_BUNDLES,
  bundleOwned,
  type SkinBundle,
} from "@/lib/cosmetics/skins";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { THEMES, type ThemeId, type ThemePalette } from "@/theme/themes";
import { useTheme, usePalette } from "@/theme/ThemeProvider";
import { radii, space } from "@/theme/tokens";

type Tab = CollectionTab | "grids";
const TABS: Tab[] = ["themes", "banners", "grids"];

export default function CollectionScreen() {
  const user = useAuthStore((s) => s.user);
  const { themeId, setTheme, boardSkinId, equipBundle } = useTheme();
  const palette = usePalette();
  const [tab, setTab] = useState<Tab>("themes");
  const [busy, setBusy] = useState<string | null>(null);

  useSyncAudioTheme(themeId);

  const owned = useMemo(() => user?.purchased_items ?? [], [user]);
  const entries = tab === "grids" ? [] : COLLECTION_ENTRIES.filter((e) => e.tab === tab);

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
          await setTheme(entry.equipValue as ThemeId);
        } else {
          await updateProfile({ banner: entry.equipValue });
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

  const onEquipBundle = useCallback(
    async (bundle: SkinBundle) => {
      if (!user || busy) return;
      if (!bundleOwned(bundle, owned)) {
        Alert.alert("Locked", "Purchase this grid in the Store first.");
        return;
      }
      setBusy(bundle.id);
      try {
        await equipBundle(bundle.id);
        Alert.alert("Equipped", `${bundle.label} grid is now active.`);
      } catch (err) {
        Alert.alert("Could not equip", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusy(null);
      }
    },
    [busy, owned, equipBundle, user],
  );

  const isEquipped = (entry: CollectionEntry) => {
    if (entry.equipField === "theme") return themeId === entry.equipValue;
    return (user?.banner ?? "default") === entry.equipValue;
  };

  const cardStyle = { backgroundColor: palette.bgCard, borderColor: palette.border };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable onPress={goBack} hitSlop={12}>
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>Collection</Title>
      <Body tone="muted" style={{ marginTop: space[2] }}>
        Equip what you own. Themes restyle the whole app; grids reskin the board & pieces; banners
        show on your home and profile.
      </Body>

      <Row gap={2} style={{ marginTop: space[4] }}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              { borderColor: palette.border },
              tab === t && { borderColor: palette.accent, backgroundColor: palette.bgRaised },
            ]}
          >
            <Caption tone={tab === t ? "accent" : "muted"}>{t.toUpperCase()}</Caption>
          </Pressable>
        ))}
      </Row>

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        {/* ── Grids tab ─────────────────────────────────────────────── */}
        {tab === "grids"
          ? SKIN_BUNDLES.map((bundle) => {
              const hasIt = bundleOwned(bundle, owned);
              const equipped = boardSkinId === bundle.boardId;
              return (
                <View key={bundle.id} style={[styles.card, cardStyle]}>
                  <Row justify="between" align="center">
                    <Heading>{bundle.label}</Heading>
                    {!hasIt ? (
                      <Caption tone="warn">LOCKED</Caption>
                    ) : equipped ? (
                      <Caption tone="accent">ACTIVE</Caption>
                    ) : null}
                  </Row>
                  <Body tone="muted">
                    {bundle.free ? "Default board & pieces." : "Board skin + matching pieces."}
                  </Body>
                  <GridSwatch bundle={bundle} palette={palette} />
                  <View style={{ marginTop: space[3] }}>
                    <Btn
                      variant={equipped ? "ghost" : "secondary"}
                      disabled={!hasIt || equipped || busy === bundle.id}
                      loading={busy === bundle.id}
                      onPress={() => onEquipBundle(bundle)}
                    >
                      {equipped ? "Equipped" : hasIt ? "Equip" : "Get in Store"}
                    </Btn>
                  </View>
                </View>
              );
            })
          : entries.map((entry) => {
              const hasIt = entry.owned(owned);
              const equipped = isEquipped(entry);
              return (
                <View key={entry.id} style={[styles.card, cardStyle]}>
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
                  ) : (
                    <BannerRenderer
                      bannerId={entry.equipValue}
                      themeId={themeId}
                      style={[styles.bannerPreview, { borderColor: palette.border }]}
                    />
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
    </Screen>
  );
}

/** Mini board preview for a grid bundle — gradient bg + paired piece glyphs. */
function GridSwatch({ bundle, palette }: { bundle: SkinBundle; palette: ThemePalette }) {
  const board = BOARD_SKINS[bundle.boardId];
  const piece = PIECE_SKINS[bundle.pieceId];
  const line = board.line ?? palette.boardLine;
  const cell = board.cell ?? palette.boardCell;
  const g1 = piece.p1Glyph || palette.glyphP1;
  const g2 = piece.p2Glyph || palette.glyphP2;
  const c1 = piece.p1 ?? palette.p1;
  const c2 = piece.p2 ?? palette.p2;
  // 3×3 preview; glyphs on the diagonal.
  const glyphAt = (r: number, c: number) =>
    r === c ? { g: r === 1 ? g2 : g1, color: r === 1 ? c2 : c1 } : null;

  return (
    <View style={[styles.gridSwatch, { borderColor: line }]}>
      {board.bgStops ? (
        <LinearGradient
          colors={board.bgStops as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.boardBg }]} />
      )}
      <View style={{ padding: 6, gap: 4 }}>
        {[0, 1, 2].map((r) => (
          <View key={r} style={{ flexDirection: "row", gap: 4 }}>
            {[0, 1, 2].map((c) => {
              const cellGlyph = glyphAt(r, c);
              return (
                <View key={c} style={[styles.gridSwatchCell, { borderColor: line, backgroundColor: cell }]}>
                  {cellGlyph ? (
                    <Text style={{ fontSize: 14, color: cellGlyph.color, fontWeight: "800" }}>
                      {cellGlyph.g}
                    </Text>
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
    alignItems: "center",
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[4],
    marginBottom: space[3],
  },
  bannerPreview: {
    height: 64,
    borderRadius: radii.md,
    marginTop: space[3],
    borderWidth: 1,
  },
  gridSwatch: {
    alignSelf: "flex-start",
    marginTop: space[3],
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  gridSwatchCell: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
