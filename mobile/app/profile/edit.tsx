/**
 * Profile edit hub.
 *
 * One-screen index that lists every editable thing on the
 * account. Each row pushes a focused sub-screen rather than
 * being inline-editable — the inline pattern looked OK at first
 * pass but inline saves on a tap surface this small bunch up
 * keyboard handling, success/error toasts, and undo affordances
 * really fast. Dedicated screens stay clean.
 *
 * No avatar upload in v1 (needs an image-picker native module
 * and Supabase storage credentials; defer to its own follow-up).
 */

import { router, Stack } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Caption,
  Eyebrow,
  Row,
  Screen,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

interface EditRowDef {
  label: string;
  description: (user: ReturnType<typeof useAuthStore.getState>["user"]) => string;
  route: "/profile/username" | "/profile/bio" | "/profile/password" | "/profile/two-factor";
  badge?: (user: ReturnType<typeof useAuthStore.getState>["user"]) => string | null;
}

const ROWS: EditRowDef[] = [
  {
    label: "Username",
    description: (u) => (u ? `@${u.username}` : "—"),
    route: "/profile/username",
    badge: (u) => {
      if (!u?.username_changed_at) return null;
      const last = new Date(u.username_changed_at).getTime();
      const cooldownEnd = last + 90 * 24 * 60 * 60 * 1000;
      const remaining = cooldownEnd - Date.now();
      if (remaining <= 0) return null;
      const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
      return `${days}d cooldown`;
    },
  },
  {
    label: "Bio",
    description: (u) => (u?.bio ? u.bio : "No bio set."),
    route: "/profile/bio",
  },
  {
    label: "Password",
    description: () => "Change with email verification",
    route: "/profile/password",
  },
  {
    label: "Two-factor auth",
    description: (u) => (u?.totp_enabled ? "Enabled" : "Off — recommended"),
    route: "/profile/two-factor",
    badge: (u) => (u?.totp_enabled ? "ON" : null),
  },
];

export default function ProfileEditHub() {
  const user = useAuthStore((s) => s.user);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ height: space[3] }} />
      <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button">
        <Caption tone="muted">← BACK</Caption>
      </Pressable>

      <VStack gap={3} style={{ marginTop: space[6] }}>
        <Eyebrow tone="muted">ACCOUNT</Eyebrow>
        <Title>Edit profile</Title>
        <Body tone="muted">
          Change your identity, bio, password, or set up two-factor auth.
        </Body>
      </VStack>

      <View style={{ height: space[7] }} />
      <VStack gap={3}>
        {ROWS.map((row) => {
          const badge = row.badge?.(user) ?? null;
          return (
            <Pressable
              key={row.route}
              onPress={() => router.push(row.route)}
              android_ripple={{ color: colors.bgRaised }}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${row.label}`}
              style={({ pressed }) => [
                styles.row,
                pressed ? { backgroundColor: colors.bgRaised } : null,
              ]}
            >
              <View style={{ flex: 1 }}>
                <Row gap={3} align="baseline">
                  <Body style={{ fontWeight: "700" }}>{row.label}</Body>
                  {badge ? <Caption tone="muted">{badge}</Caption> : null}
                </Row>
                <Caption tone="muted" style={{ marginTop: space[1] }} numberOfLines={1}>
                  {row.description(user)}
                </Caption>
              </View>
              <Caption tone="muted">›</Caption>
            </Pressable>
          );
        })}
      </VStack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[4],
    paddingHorizontal: space[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
});
