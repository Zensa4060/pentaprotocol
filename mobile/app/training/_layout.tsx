/**
 * Training stack — picker → match.
 *
 * Kept as a Stack (not a tab) so a back-swipe / hardware-back from
 * the match returns to the difficulty picker, and another back
 * exits to the home tab. This matches user expectation on
 * Android (where back is hardware) and on iOS (where the edge
 * gesture mirrors browser back).
 */

import { Stack } from "expo-router";

export default function TrainingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#030303" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="match" />
    </Stack>
  );
}
