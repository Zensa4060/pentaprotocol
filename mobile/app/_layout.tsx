/**
 * Root layout — everything in the app renders inside this tree.
 *
 * Responsibilities, in order:
 *   1. Provide ``GestureHandlerRootView`` (required by Reanimated +
 *      most gesture libs — without it any swipe/long-press will
 *      silently fail).
 *   2. Provide ``SafeAreaProvider`` so child screens can read notch +
 *      home-indicator insets.
 *   3. Provide ``TamaguiProvider`` so styled components can resolve
 *      tokens.
 *   4. Block initial render until the persisted auth store has
 *      hydrated, so the entry redirect doesn't flicker.
 *   5. Hide the native splash screen once hydration is done.
 *
 * Auth gating itself lives in ``app/index.tsx`` — that file picks
 * the destination (login vs tabs) based on store state. Keeping
 * the redirect *out* of the root layout avoids the "blank flash"
 * you get when the root layout has to remount everything on auth
 * transitions.
 */

import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider } from "tamagui";

import { AudioProvider } from "@/lib/audio/AudioProvider";
import { useGlobalNotifySocket } from "@/lib/hooks/useGlobalNotifySocket";
import { useProfileSync } from "@/lib/hooks/useProfileSync";
import { useAuthStore } from "@/lib/store";
import { tamaguiConfig } from "@/theme/tamagui.config";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Keep the splash up until React + the store have both settled.
// ``preventAutoHideAsync`` is safe to call multiple times; if it
// throws (e.g. unsupported env) we just continue without it.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export const unstable_settings = {
  // Default group when the URL doesn't pin one — Expo Router uses
  // this as the fallback target for nested layouts.
  anchor: "(tabs)",
};

export default function RootLayout() {
  // Display fonts per theme (``themes.ts`` ``fontDisplay``) — body stays system.
  const [fontsLoaded] = useFonts({
    Cinzel: require("../assets/fonts/Cinzel-Variable.ttf"),
    Orbitron: require("../assets/fonts/Orbitron-Variable.ttf"),
    PentaPixel: require("../assets/fonts/PentaPixel-Regular.ttf"),
  });

  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (fontsLoaded && hydrated) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, hydrated]);

  // While we wait, render nothing. The native splash screen is still
  // covering the surface, so the user sees the brand splash — not a
  // white frame.
  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
          <ThemeProvider>
            <AudioProvider>
              <StatusBar style="light" backgroundColor="#030303" translucent={false} />
              <AuthSyncedTree />
            </AudioProvider>
          </ThemeProvider>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Mounts ``useProfileSync`` inside the providers (so it can hit the
 * API + read the auth store), then renders the actual navigator.
 *
 * Pulled into its own component because hooks have to be called
 * unconditionally and we only want the sync to start *after* the
 * hydration gate above resolves. Without this split the hook
 * would either flash a request before AsyncStorage hydrates, or we'd
 * have to add a "skip if not hydrated" branch to the hook itself.
 */
function AuthSyncedTree() {
  useProfileSync();
  useGlobalNotifySocket();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#030303" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="training" />
      <Stack.Screen name="engine" />
      <Stack.Screen name="multiplayer" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="legal-gate" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="store" />
      <Stack.Screen name="collection" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="career" />
      <Stack.Screen name="syros" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="pregame" />
    </Stack>
  );
}
