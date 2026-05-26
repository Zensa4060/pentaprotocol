/**
 * Stack layout for the unauthenticated routes.
 *
 * Currently a single screen (``login``), but kept as a group so we
 * can drop in signup / forgot / 2fa / merge / verify-otp screens
 * without restructuring the router.
 */

import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#030303" } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
