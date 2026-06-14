/**
 * Settings screen (BUG-09).
 *
 * Sections:
 *   - Audio       — mute + music / SFX volume (wired to AudioProvider).
 *   - Preferences — notifications toggle (device-local), theme shortcut.
 *   - Account     — export data, delete account (confirm), sign out.
 *   - Legal       — links handled on the web policy pages.
 *
 * ``?focus=delete`` opens the delete-account confirm immediately (used
 * by the Profile "Delete account" shortcut).
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  Body,
  Btn,
  Caption,
  Card,
  Divider,
  Eyebrow,
  Heading,
  Row,
  Screen,
  Stack as VStack,
  TextField,
  Title,
} from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { logout } from "@/lib/auth";
import { deleteAccount, requestDataExport } from "@/lib/account";
import { CommunityLinks } from "@/components/community/CommunityLinks";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

const NOTIF_KEY = "pp_notifications_enabled";

export default function SettingsScreen() {
  const params = useLocalSearchParams<{ focus?: string }>();
  const user = useAuthStore((s) => s.user);
  const audio = useGameAudio();

  const [notif, setNotif] = useState(true);
  const [showDelete, setShowDelete] = useState(params.focus === "delete");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasPassword = !user?.google_linked || false; // best-effort hint only

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY)
      .then((v) => setNotif(v === null ? true : v === "true"))
      .catch(() => undefined);
  }, []);

  const toggleNotif = (v: boolean) => {
    setNotif(v);
    AsyncStorage.setItem(NOTIF_KEY, String(v)).catch(() => undefined);
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const adjust = (cur: number, delta: number) =>
    Math.max(0, Math.min(1, Math.round((cur + delta) * 10) / 10));

  const onExport = async () => {
    setExporting(true);
    try {
      await requestDataExport();
      Alert.alert("Export ready", "Your data export was generated. Check your email / web account.");
    } catch (err) {
      Alert.alert("Export failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (!confirm.trim()) return;
    setDeleting(true);
    try {
      await deleteAccount(confirm.trim());
      setShowDelete(false);
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert("Could not delete", err instanceof Error ? err.message : "Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const signOut = () => {
    Alert.alert("Sign out", "Sign out of this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          // logout() also clears the cached Google account, so the next
          // Google sign-in shows the account chooser again.
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <Title style={{ marginTop: space[4] }}>Settings</Title>

      {/* ── Audio ─────────────────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>AUDIO</Eyebrow>
      <Card variant="surface" padding="md">
        <VStack gap={3}>
          <Row justify="between" align="center">
            <Body tone="muted">Mute all</Body>
            <Switch
              value={audio.muted}
              onValueChange={audio.toggleMute}
              trackColor={{ true: colors.accent, false: colors.bgRaised }}
            />
          </Row>
          <Divider />
          <VolumeRow
            label="Music"
            value={audio.musicVol}
            onDown={() => audio.setMusicVol(adjust(audio.musicVol, -0.1))}
            onUp={() => audio.setMusicVol(adjust(audio.musicVol, 0.1))}
          />
          <Divider />
          <VolumeRow
            label="Sound effects"
            value={audio.sfxVol}
            onDown={() => audio.setSfxVol(adjust(audio.sfxVol, -0.1))}
            onUp={() => audio.setSfxVol(adjust(audio.sfxVol, 0.1))}
          />
        </VStack>
      </Card>

      {/* ── Preferences ───────────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>PREFERENCES</Eyebrow>
      <Card variant="surface" padding="md">
        <VStack gap={3}>
          <Row justify="between" align="center">
            <Body tone="muted">Notifications</Body>
            <Switch
              value={notif}
              onValueChange={toggleNotif}
              trackColor={{ true: colors.accent, false: colors.bgRaised }}
            />
          </Row>
          <Divider />
          <Pressable onPress={() => router.push("/collection")}>
            <Row justify="between" align="center">
              <Body tone="muted">Themes & banners</Body>
              <Caption tone="muted">›</Caption>
            </Row>
          </Pressable>
          <Divider />
          <Pressable onPress={() => router.push("/patchnotes" as never)}>
            <Row justify="between" align="center">
              <Body tone="muted">Patch notes</Body>
              <Caption tone="muted">›</Caption>
            </Row>
          </Pressable>
        </VStack>
      </Card>

      {/* ── Account ───────────────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>ACCOUNT</Eyebrow>
      <Card variant="surface" padding="md">
        <VStack gap={3}>
          <Caption tone="muted">{user?.email ?? "—"}</Caption>
          <Btn variant="secondary" loading={exporting} onPress={onExport}>
            Export my data
          </Btn>
          <Btn variant="secondary" onPress={signOut}>
            Sign out
          </Btn>
          <Btn variant="ghost" onPress={() => setShowDelete(true)}>
            Delete account
          </Btn>
        </VStack>
      </Card>

      {/* ── Community ─────────────────────────────────────────── */}
      <Eyebrow tone="muted" style={styles.section}>COMMUNITY</Eyebrow>
      <Card variant="surface" padding="md">
        <CommunityLinks title="" />
      </Card>

      {/* ── Legal (bundled in-app, with web fallback) ──────────── */}
      <Eyebrow tone="muted" style={styles.section}>LEGAL</Eyebrow>
      <Card variant="surface" padding="md">
        <VStack gap={3}>
          <Pressable onPress={() => router.push("/legal/terms" as never)}>
            <Body tone="muted">Terms of Service ›</Body>
          </Pressable>
          <Divider />
          <Pressable onPress={() => router.push("/legal/privacy" as never)}>
            <Body tone="muted">Privacy Policy ›</Body>
          </Pressable>
          <Divider />
          <Pressable onPress={() => Linking.openURL("https://pentaprotocol.com/refund")}>
            <Body tone="muted">Refund Policy (web) ›</Body>
          </Pressable>
        </VStack>
      </Card>

      {/* ── Delete confirm modal ──────────────────────────────── */}
      <Modal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
        <View style={styles.scrim}>
          <Card variant="surface" padding="lg" style={styles.modalCard}>
            <Heading>Delete account?</Heading>
            <Body tone="muted" style={{ marginTop: space[2] }}>
              This is permanent. Your profile, stats and match history will be erased.
              {hasPassword
                ? " Enter your password to confirm."
                : ' Type "DELETE" to confirm.'}
            </Body>
            <View style={{ height: space[4] }} />
            <TextField
              label={hasPassword ? "Password" : 'Type DELETE'}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={hasPassword}
              autoCapitalize={hasPassword ? "none" : "characters"}
              autoCorrect={false}
              placeholder={hasPassword ? "••••••••" : "DELETE"}
            />
            <View style={{ height: space[4] }} />
            <Row gap={2}>
              <View style={{ flex: 1 }}>
                <Btn variant="secondary" onPress={() => setShowDelete(false)}>
                  Cancel
                </Btn>
              </View>
              <View style={{ flex: 1 }}>
                <Btn variant="primary" loading={deleting} disabled={!confirm.trim()} onPress={onDelete}>
                  Delete
                </Btn>
              </View>
            </Row>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function VolumeRow({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: number;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <Row justify="between" align="center">
      <Body tone="muted">{label}</Body>
      <Row gap={3} align="center">
        <Pressable onPress={onDown} hitSlop={8} style={styles.stepBtn}>
          <Caption tone="accent">−</Caption>
        </Pressable>
        <Caption tone="muted">{Math.round(value * 100)}%</Caption>
        <Pressable onPress={onUp} hitSlop={8} style={styles.stepBtn}>
          <Caption tone="accent">+</Caption>
        </Pressable>
      </Row>
    </Row>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space[6], marginBottom: space[2] },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  modalCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
});
