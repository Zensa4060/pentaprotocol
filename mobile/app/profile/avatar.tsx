/**
 * Avatar screen (BUG-02).
 *
 * Two ways to set a profile picture:
 *   1. **Device photo** — pick from the gallery (``expo-image-picker``),
 *      copy it into app storage (``expo-file-system``) and persist the
 *      local uri. Shows on this device immediately. (The backend has no
 *      upload endpoint, so a device photo cannot sync across devices
 *      without a backend change — noted in the UI.)
 *   2. **Image URL** — persisted server-side via ``PUT /api/profile/me``
 *      (``avatar``), so it syncs everywhere.
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import {
  Avatar,
  Body,
  Btn,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Stack as VStack,
  TextField,
  Title,
} from "@/components/ui";
import { setLocalAvatar, useLocalAvatar } from "@/lib/avatar";
import { updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

export default function AvatarScreen() {
  const user = useAuthStore((s) => s.user);
  const localAvatar = useLocalAvatar();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"pick" | "url" | "clear" | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const pickPhoto = async () => {
    if (busy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo access to set a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBusy("pick");
      const src = result.assets[0].uri;
      // Copy into the document dir so it survives cache eviction.
      const ext = src.split(".").pop()?.split("?")[0] || "jpg";
      const dest = `${FileSystem.documentDirectory}avatar_${Date.now()}.${ext}`;
      try {
        await FileSystem.copyAsync({ from: src, to: dest });
        await setLocalAvatar(dest);
      } catch {
        // If the copy fails (e.g. content:// uri), fall back to the
        // picker uri directly — still works for this session.
        await setLocalAvatar(src);
      }
      Alert.alert("Updated", "Profile picture set on this device.");
    } catch (err) {
      Alert.alert("Could not set photo", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const saveUrl = async () => {
    const u = url.trim();
    if (!u) return;
    if (!/^https?:\/\//i.test(u)) {
      Alert.alert("Invalid URL", "Enter a full image URL starting with https://");
      return;
    }
    setBusy("url");
    try {
      await updateProfile({ avatar: u });
      await setLocalAvatar(null); // server avatar now wins
      setUrl("");
      Alert.alert("Saved", "Avatar updated and synced to your account.");
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  };

  const clearLocal = async () => {
    setBusy("clear");
    await setLocalAvatar(null);
    setBusy(null);
  };

  const previewUri = localAvatar ?? user?.avatar ?? null;

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }} align="center">
        <Eyebrow tone="muted">PROFILE PICTURE</Eyebrow>
        <Avatar uri={previewUri} name={user?.username} size="xl" highlighted />
      </VStack>

      <View style={{ height: space[7] }} />
      <Btn variant="primary" size="lg" loading={busy === "pick"} onPress={pickPhoto}>
        Choose from gallery
      </Btn>

      {localAvatar ? (
        <>
          <View style={{ height: space[2] }} />
          <Btn variant="ghost" loading={busy === "clear"} onPress={clearLocal}>
            Remove device photo
          </Btn>
        </>
      ) : null}

      <View style={styles.note}>
        <Caption tone="muted">
          Device photos are stored on this device. To use a picture across all your devices, set an
          image URL below (syncs to your account).
        </Caption>
      </View>

      <Eyebrow tone="muted" style={{ marginTop: space[7], marginBottom: space[3] }}>
        IMAGE URL
      </Eyebrow>
      <View style={styles.card}>
        <TextField
          label="Image URL"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://…/me.jpg"
        />
        <View style={{ height: space[4] }} />
        <Btn variant="secondary" size="lg" loading={busy === "url"} disabled={!url.trim()} onPress={saveUrl}>
          Save URL avatar
        </Btn>
        <View style={{ height: space[3] }} />
        <Body tone="muted">Current synced avatar: {user?.avatar ? "set" : "none"}.</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: space[4],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
  },
});
