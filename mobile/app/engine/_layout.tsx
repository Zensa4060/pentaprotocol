import { Stack } from "expo-router";

export default function EngineLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#030303" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="match" />
    </Stack>
  );
}
