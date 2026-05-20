/**
 * Bottom-tab navigator for the authenticated app.
 *
 * v1 ships only the Home tab — we register it once and let it
 * stand on its own so the tab bar isn't visually empty (no orphan
 * single icon hovering at the bottom). As the rest of the app
 * (Multiplayer, Training, Profile, Store, …) lands, each becomes
 * its own ``Tabs.Screen`` here.
 *
 * Haptic tab + SF Symbols / Material icon support are pulled from
 * the create-expo-app default components — they're already wired
 * for both platforms, so we keep them.
 */

import { Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { colors } from "@/theme/tokens";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
