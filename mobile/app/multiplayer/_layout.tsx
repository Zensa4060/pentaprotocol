/**
 * Multiplayer stack — lobby → waiting → match.
 *
 * Mirrors the training stack structure: header hidden everywhere
 * (each screen has its own back affordance), default
 * slide-from-right animation, dark canvas color.
 */

import { Stack } from "expo-router";

export default function MultiplayerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#030303" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="waiting" />
      <Stack.Screen name="match" />
      <Stack.Screen name="queue" />
      <Stack.Screen name="match-found" options={{ animation: "fade" }} />
    </Stack>
  );
}
