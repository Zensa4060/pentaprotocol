/**
 * Username change screen.
 *
 * Client-side validation mirrors the backend's checks in
 * ``backend/app/routers/profile.py::update_profile`` so the user
 * sees instant feedback without round-tripping a 400:
 *
 *   - 3–12 chars
 *   - ASCII only (we explicitly block emoji + non-ASCII chars
 *     because the server's regex does)
 *   - Allowed set: letters / digits / underscore / ``@``
 *   - 90-day server-enforced cooldown after the previous change
 *
 * The cooldown banner above the field is computed locally from
 * ``user.username_changed_at`` — if the cooldown is active we
 * disable the save button outright so the user never gets to
 * fire a request that's guaranteed to fail.
 */

import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Screen,
  TextField,
} from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import { ApiError, updateProfile } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { space } from "@/theme/tokens";

const COOLDOWN_DAYS = 90;
const MIN_LEN = 3;
const MAX_LEN = 12;
const ALLOWED = /^[A-Za-z0-9@_]+$/;

interface CooldownInfo {
  active: boolean;
  daysLeft: number;
}

function computeCooldown(lastIso: string | null): CooldownInfo {
  if (!lastIso) return { active: false, daysLeft: 0 };
  const last = new Date(lastIso).getTime();
  if (Number.isNaN(last)) return { active: false, daysLeft: 0 };
  const cooldownEnd = last + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const remaining = cooldownEnd - Date.now();
  if (remaining <= 0) return { active: false, daysLeft: 0 };
  return {
    active: true,
    daysLeft: Math.ceil(remaining / (24 * 60 * 60 * 1000)),
  };
}

function validate(next: string, current: string): string | null {
  if (next === current) return "That's already your username.";
  if (next.length < MIN_LEN) return `At least ${MIN_LEN} characters.`;
  if (next.length > MAX_LEN) return `At most ${MAX_LEN} characters.`;
  if (!ALLOWED.test(next)) return "Letters, numbers, @ and _ only.";
  return null;
}

export default function UsernameEditScreen() {
  const user = useAuthStore((s) => s.user);
  const [value, setValue] = useState(user?.username ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const cooldown = useMemo(
    () => computeCooldown(user?.username_changed_at ?? null),
    [user?.username_changed_at],
  );

  const trimmed = value.trim();
  const error = touched ? validate(trimmed, user?.username ?? "") : null;
  const canSubmit = !error && !cooldown.active && trimmed.length > 0 && !submitting;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile/edit");
  };

  const onSave = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await updateProfile({ username: trimmed });
      goBack();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail
          ? err.detail
          : "Could not change username. Try again.";
      Alert.alert("Not changed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader title="CHANGE USERNAME" eyebrow="ACCOUNT · USERNAME" onBack={goBack} />

      <Body tone="muted" style={{ marginTop: space[4] }}>
        You can change your username once every {COOLDOWN_DAYS} days. Letters, numbers, @ and _
        only.
      </Body>

      {cooldown.active ? (
        <View style={{ marginTop: space[5] }}>
          <Caption tone="warn">
            On cooldown. You can change your username again in {cooldown.daysLeft} day
            {cooldown.daysLeft === 1 ? "" : "s"}.
          </Caption>
        </View>
      ) : null}

      <View style={{ height: space[6] }} />
      <TextField
        label="Username"
        value={value}
        onChangeText={(t) => {
          setValue(t);
          if (!touched) setTouched(true);
        }}
        onBlur={() => setTouched(true)}
        editable={!cooldown.active}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAX_LEN}
        characterCount={{ current: trimmed.length, max: MAX_LEN }}
        error={error ?? undefined}
        hint={cooldown.active ? undefined : "3–12 characters."}
      />

      <View style={{ height: space[7] }} />
      <Btn variant="primary" size="lg" loading={submitting} disabled={!canSubmit} onPress={onSave}>
        Save
      </Btn>
    </Screen>
  );
}
