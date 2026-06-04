/**
 * Bottom-tab navigator for the authenticated app.
 *
 * Phase 2 ships two tabs:
 *   - Home    — landing, identity, stats, modes.
 *   - Profile — full user info, settings, sign out.
 *
 * The bar uses the haptic tab + SF Symbol / Material icon adapters
 * from the create-expo-app default (kept because they're already
 * platform-aware) and themes their colors through our tokens so
 * the active state lands on the blood-red accent.
 */

import { Tabs } from "expo-router";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { usePalette } from "@/theme/ThemeProvider";

export default function TabLayout() {
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarStyle: {
          backgroundColor: palette.bgElevated,
          borderTopColor: palette.border,
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
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="trophy.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="missions"
        options={{
          title: "Missions",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
