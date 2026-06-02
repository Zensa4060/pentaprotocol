/**
 * Profile-edit stack — sits outside the tab navigator so the
 * tab bar is hidden during edit flows (a hub + 4 sub-pages
 * shouldn't have a tab bar fighting for the bottom).
 *
 * Routes:
 *   /profile/edit         — hub
 *   /profile/username     — username change with cooldown
 *   /profile/bio          — bio editor
 *   /profile/password     — OTP-gated password change
 *   /profile/two-factor   — TOTP setup
 */

import { Stack } from "expo-router";

export default function ProfileEditLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#030303" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="edit" />
      <Stack.Screen name="avatar" />
      <Stack.Screen name="username" />
      <Stack.Screen name="bio" />
      <Stack.Screen name="password" />
      <Stack.Screen name="two-factor" />
    </Stack>
  );
}
