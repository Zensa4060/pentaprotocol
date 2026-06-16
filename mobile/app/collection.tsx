/**
 * Native collection — "The Locker". Equip owned **themes, banners, grids,
 * coins** and profile **badges**.
 *
 * Redesign (UI only): a live "Your Loadout" hero showing the four equipped
 * slots at a glance, then a 2-column gallery of live preview tiles. The
 * equipped item gets an accent border + a ``✓ EQUIPPED`` badge; tapping any
 * owned tile equips it directly (live apply + EquipFlash). Locked tiles route
 * to the Store. All equip logic is unchanged.
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
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { Body, Caption, Heading, Mono, Screen } from "@/components/ui";
import { HudHeader, Panel, SectionLabel, SegTabs } from "@/components/ui/hud";
import { BannerRenderer } from "@/components/BannerRenderer";
import { GridLivePreview } from "@/components/cosmetics/GridLivePreview";
import {
  COLLECTION_ENTRIES,
  type CollectionEntry,
  type CollectionTab,
} from "@/lib/collection/catalog";
import { tossSkinFromStoreId, useTossSkin } from "@/lib/cosmetics/tossSkin";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { useSyncAudioTheme } from "@/lib/audio/AudioProvider";
import { THEMES, type ThemeId } from "@/theme/themes";
import { useTheme } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

const TABS: CollectionTab[] = ["themes", "banners", "grids", "badges"];
const SEG_TABS: { key: CollectionTab; label: string }[] = TABS.map((t) => ({
  key: t,
  label: t.toUpperCase(),
}));

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
  const [previewEntry, setPreviewEntry] = useState<CollectionEntry | null>(null);
  const [tossSkin, setTossSkin] = useTossSkin();
  const { width: winW } = useWindowDimensions();

  useSyncAudioTheme(themeId);

  const owned = user?.purchased_items ?? [];
  const entries = COLLECTION_ENTRIES.filter((e) => e.tab === tab);

  // 2-column gallery geometry (Screen `padded` = 20px gutters; 12px column gap).
  const colW = Math.floor((winW - space[5] * 2 - space[3]) / 2);
  const innerW = colW - space[3] * 2;

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

  const onTilePress = (entry: CollectionEntry, hasIt: boolean, equipped: boolean) => {
    if (!hasIt) {
      router.push("/store" as never);
      return;
    }
    if (equipped) return;
    void onEquip(entry.id);
  };

  return (
    <Screen padded>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader title="COLLECTION" eyebrow="EQUIP YOUR LOADOUT" onBack={goBack} />

      {/* ── Your Loadout · the four currently-equipped slots ─────────── */}
      <LoadoutHero
        themeId={themeId}
        banner={user?.banner ?? "default"}
        boardStyle={user?.board_style ?? "default"}
        title={(user?.title ?? "newcomer").toUpperCase()}
      />

      <SegTabs<CollectionTab> tabs={SEG_TABS} value={tab} onChange={setTab} style={{ marginTop: space[5] }} />

      <ScrollView style={{ marginTop: space[4] }} contentContainerStyle={{ paddingBottom: space[10] }}>
        <View style={styles.gallery}>
          {entries.map((entry) => {
            const hasIt = entry.owned(owned, user);
            const equipped = isEquipped(entry);
            return (
              <Pressable
                key={entry.id}
                onPress={() => onTilePress(entry, hasIt, equipped)}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                style={({ pressed }) => [
                  styles.tile,
                  { width: colW },
                  equipped ? styles.tileEquipped : null,
                  !hasIt ? styles.tileLocked : null,
                  pressed ? { transform: [{ scale: 0.985 }] } : null,
                ]}
              >
                <View style={styles.tilePrevWrap}>
                  <TilePreview entry={entry} innerW={innerW} themeId={themeId} onPreview={() => setPreviewEntry(entry)} />
                  {!hasIt ? (
                    <View style={styles.lockOverlay}>
                      <Caption tone="muted" style={{ letterSpacing: 1 }}>🔒</Caption>
                    </View>
                  ) : null}
                </View>

                <Body style={styles.tileName} numberOfLines={1}>{entry.label}</Body>

                <View style={styles.tileFoot}>
                  {!hasIt ? (
                    <Caption tone="warn" style={styles.footTxt}>STORE ›</Caption>
                  ) : equipped ? (
                    <View style={styles.equippedBadge}>
                      <Caption tone="accent" style={styles.equippedTxt}>✓ EQUIPPED</Caption>
                    </View>
                  ) : (
                    <Caption tone={busy === entry.id ? "dim" : "accent"} style={styles.footTxt}>
                      {busy === entry.id ? "···" : "EQUIP"}
                    </Caption>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <EquipFlash label={equipFlash} onDone={() => setEquipFlash(null)} />
      {previewEntry && (
        <PreviewModal 
          entry={previewEntry} 
          themeId={themeId} 
          onClose={() => setPreviewEntry(null)} 
        />
      )}
    </Screen>
  );
}

/** Per-entry live preview inside a gallery tile. */
function TilePreview({
  entry,
  innerW,
  themeId,
  onPreview,
}: {
  entry: CollectionEntry;
  innerW: number;
  themeId: ThemeId;
  onPreview: () => void;
}) {
  if (entry.equipField === "theme") {
    return <ThemeMini themeId={entry.equipValue as ThemeId} width={innerW} />;
  }
  if (entry.equipField === "banner") {
    return (
      <View style={[styles.prevBox, { width: innerW, height: innerW * 0.58 }]}>
        <BannerRenderer bannerId={entry.equipValue} themeId={themeId} style={StyleSheet.absoluteFill} animated={false} />
        <Pressable onPress={onPreview} style={styles.previewBtnOverlay}>
          <Caption tone="accent" style={styles.previewBtnTxt}>PREVIEW</Caption>
        </Pressable>
      </View>
    );
  }
  if (entry.equipField === "board_style") {
    return (
      <View style={[styles.prevBox, { width: innerW, height: innerW * 0.58 }]}>
        <GridLivePreview boardStyle={entry.equipValue} size={innerW} pieces={false} live={false} />
        <Pressable onPress={onPreview} style={styles.previewBtnOverlay}>
          <Caption tone="accent" style={styles.previewBtnTxt}>PREVIEW</Caption>
        </Pressable>
      </View>
    );
  }
  if (entry.equipField === "title") {
    return (
      <View style={[styles.prevBox, styles.badgePrev, { width: innerW, height: innerW * 0.58 }]}>
        <Caption tone="accent" style={{ letterSpacing: 1.4, fontWeight: "800" }} numberOfLines={1}>
          {entry.label.toUpperCase()}
        </Caption>
      </View>
    );
  }
  return null;
}

/** The four equipped slots, rendered live. */
function LoadoutHero({
  themeId,
  banner,
  boardStyle,
  title,
}: {
  themeId: ThemeId;
  banner: string;
  boardStyle: string;
  title: string;
}) {
  return (
    <Panel style={styles.loadout}>
      <SectionLabel label="YOUR LOADOUT" />
      <View style={styles.slots}>
        <View style={styles.slot}>
          <GridLivePreview boardStyle={boardStyle} size={56} pieces={false} style={styles.slotArt} />
          <Caption tone="dim" style={styles.slotLabel}>GRID</Caption>
        </View>
        <View style={styles.slot}>
          <ThemeMini themeId={themeId} width={56} compact />
          <Caption tone="dim" style={styles.slotLabel}>THEME</Caption>
        </View>
        <View style={styles.slot}>
          <View style={[styles.slotArt, { width: 56, height: 56 }]}>
            <BannerRenderer bannerId={banner} themeId={themeId} style={StyleSheet.absoluteFill} animated={false} />
          </View>
          <Caption tone="dim" style={styles.slotLabel}>BANNER</Caption>
        </View>
        <View style={styles.slot}>
          <View style={[styles.slotArt, styles.badgeSlot, { width: 56, height: 56 }]}>
            <Caption tone="accent" style={{ fontSize: 9, letterSpacing: 0.5, textAlign: "center" }} numberOfLines={2}>
              {title}
            </Caption>
          </View>
          <Caption tone="dim" style={styles.slotLabel}>BADGE</Caption>
        </View>
      </View>
    </Panel>
  );
}

/** Mini theme swatch — board + palette dots (compact = single board square). */
function ThemeMini({ themeId, width, compact }: { themeId: ThemeId; width: number; compact?: boolean }) {
  const p = THEMES[themeId];
  if (compact) {
    return (
      <View style={[styles.slotArt, { width, height: width, backgroundColor: p.bg, borderColor: p.border }]}>
        <View style={[styles.miniBoard, { backgroundColor: p.boardBg, borderColor: p.boardLine }]}>
          <View style={[styles.miniDot, { backgroundColor: p.p1 }]} />
          <View style={[styles.miniDot, { backgroundColor: p.p2 }]} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.prevBox, { width, height: width * 0.58, backgroundColor: p.bg, flexDirection: "row", gap: 8 }]}>
      <View style={[styles.miniBoard, { backgroundColor: p.boardBg, borderColor: p.boardLine }]}>
        <View style={[styles.miniDot, { backgroundColor: p.p1 }]} />
        <View style={[styles.miniDot, { backgroundColor: p.p2 }]} />
      </View>
      <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
        <View style={[styles.palChip, { backgroundColor: p.accent }]} />
        <View style={[styles.palChip, { backgroundColor: p.p1 }]} />
        <View style={[styles.palChip, { backgroundColor: p.p2 }]} />
      </View>
    </View>
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

import { Modal } from "react-native";

function PreviewModal({ entry, themeId, onClose }: { entry: CollectionEntry, themeId: ThemeId, onClose: () => void }) {
  const { width } = useWindowDimensions();
  const boxW = Math.min(width - space[8] * 2, 320);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { width: width - space[6] * 2 }]}>
          <Pressable style={styles.modalClose} onPress={onClose}>
            <Caption tone="muted" style={{ fontSize: 16 }}>✕</Caption>
          </Pressable>
          
          <Heading style={{ marginBottom: space[2] }}>{entry.label}</Heading>
          
          <View style={[styles.prevBox, { width: boxW, height: boxW * 0.58, alignSelf: "center", marginVertical: space[4] }]}>
            {entry.equipField === "banner" ? (
              <BannerRenderer bannerId={entry.equipValue} themeId={themeId} style={StyleSheet.absoluteFill} animated={true} />
            ) : (
              <GridLivePreview boardStyle={entry.equipValue} size={boxW} pieces={true} live={true} />
            )}
          </View>
          
          <Caption tone="dim" style={{ textAlign: "center" }}>Live animated preview</Caption>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadout: {
    marginTop: space[4],
    padding: space[4],
  },
  slots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space[3],
  },
  slot: {
    alignItems: "center",
    gap: space[2],
  },
  slotArt: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSlot: {
    backgroundColor: "rgba(204,0,0,0.08)",
    borderColor: colors.borderAccent,
    padding: 4,
  },
  slotLabel: {
    fontSize: 9,
    letterSpacing: 1,
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
  tileEquipped: {
    borderColor: colors.borderAccent,
    borderWidth: 1.5,
    backgroundColor: "rgba(204,0,0,0.06)",
  },
  tileLocked: {
    opacity: 0.85,
  },
  tilePrevWrap: {
    borderRadius: radii.md,
    overflow: "hidden",
  },
  prevBox: {
    borderRadius: radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgePrev: {
    backgroundColor: "rgba(204,0,0,0.06)",
    borderColor: colors.borderAccent,
    paddingHorizontal: space[2],
  },
  coinPrev: {
    backgroundColor: colors.bgRaised,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileName: {
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: space[2],
  },
  tileFoot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    minHeight: 18,
  },
  footTxt: {
    fontWeight: "800",
    letterSpacing: 1,
    fontSize: 10,
  },
  equippedBadge: {
    paddingVertical: 2,
    paddingHorizontal: space[2],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    backgroundColor: "rgba(204,0,0,0.14)",
  },
  equippedTxt: {
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 9.5,
  },
  miniBoard: {
    padding: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
  },
  miniDot: { width: 7, height: 7, borderRadius: 4 },
  palChip: { width: 12, height: 12, borderRadius: 4 },
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
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.xl,
    padding: space[6],
    borderWidth: 1,
    borderColor: colors.borderAccent,
    shadowColor: colors.accent,
    shadowOpacity: 0.15,
    shadowRadius: 32,
    position: "relative",
  },
  modalClose: {
    position: "absolute",
    top: space[4],
    right: space[4],
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgRaised,
    borderRadius: 16,
    zIndex: 10,
  },
});
