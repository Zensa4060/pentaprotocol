/**
 * Bio editor.
 *
 * Server allows up to 200 chars. We enforce that client-side so
 * the character counter ticks while typing and the save button
 * disables past the limit (rather than failing the request).
 *
 * Profanity is server-side only — we don't bundle the wordlist
 * to the client (security through obscurity-ish, plus it's a
 * 1KB+ list and would balloon the bundle). The save handler
 * surfaces the server's ``detail`` if the request is rejected.
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  Body,
  Btn,
  Screen,
  TextField,
} from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import { ApiError, updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { space } from "@/theme/tokens";

const MAX_LEN = 200;

export default function BioEditScreen() {
  const user = useAuthStore((s) => s.user);
  const [value, setValue] = useState(user?.bio ?? "");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = value.replace(/\s+$/g, "");
  const overLimit = trimmed.length > MAX_LEN;
  const unchanged = trimmed === (user?.bio ?? "");
  const canSubmit = !overLimit && !unchanged && !submitting;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile/edit");
  };

  const onSave = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // Send the trimmed value to match what the user sees.
      // Sending "" is OK — backend accepts an empty bio.
      await updateProfile({ bio: trimmed });
      goBack();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail
          ? err.detail
          : "Could not update bio. Try again.";
      Alert.alert("Not saved", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader title="EDIT BIO" eyebrow="ACCOUNT · BIO" onBack={goBack} />

      <Body tone="muted" style={{ marginTop: space[4] }}>
        Shown on your public profile. Keep it short — {MAX_LEN} characters max.
      </Body>

      <View style={{ height: space[6] }} />
      <TextField
        label="Bio"
        value={value}
        onChangeText={setValue}
        placeholder="A line about you, your playstyle, or anything else."
        multiline
        autoCapitalize="sentences"
        maxLength={MAX_LEN + 50 /* allow temporary overflow for the live error */}
        characterCount={{ current: trimmed.length, max: MAX_LEN }}
        error={overLimit ? `Trim by ${trimmed.length - MAX_LEN} characters.` : undefined}
      />

      <View style={{ height: space[7] }} />
      <Btn variant="primary" size="lg" loading={submitting} disabled={!canSubmit} onPress={onSave}>
        Save bio
      </Btn>
    </Screen>
  );
}
