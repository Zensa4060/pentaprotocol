/**
 * Home tab — landing screen after a successful sign-in.
 *
 * Intentionally minimal in v1: a welcome card with the cached
 * username + a sign-out button so the auth flow can be exercised
 * end-to-end without depending on screens we haven't built yet.
 * The full home (Training / Multiplayer / AI Engine entry cards,
 * rank badge, friends panel) lands in Phase 3 once the design
 * system is settled.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { logout } from "@/lib/auth";
import { useAuthStore } from "@/lib/store";
import { colors, fontSizes, radii, space } from "@/theme/tokens";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const onLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space[6] }]}>
      <Text style={styles.eyebrow}>WELCOME</Text>
      <Text style={styles.heading}>
        {user?.username ? user.username : "Operator"}
      </Text>
      <Text style={styles.subheading}>
        Mobile build · v1 scaffold. Modes and matchmaking land in the next phase.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>SESSION</Text>
        <Text style={styles.cardValue}>{user?.email ?? "—"}</Text>
        <Text style={styles.cardLabel}>ELO</Text>
        <Text style={styles.cardValue}>{user?.elo ?? "—"}</Text>
      </View>

      <Pressable
        onPress={onLogout}
        android_ripple={{ color: colors.bgRaised }}
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.logoutBtnPressed]}
        accessibilityRole="button"
      >
        <Text style={styles.logoutLabel}>SIGN OUT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[5],
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    letterSpacing: 3,
  },
  heading: {
    color: colors.text,
    fontSize: fontSizes["2xl"],
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: space[2],
  },
  subheading: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginTop: space[3],
    marginBottom: space[7],
  },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: space[2],
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    letterSpacing: 2,
  },
  cardValue: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "700",
    marginBottom: space[3],
  },

  logoutBtn: {
    marginTop: "auto",
    marginBottom: space[5],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: space[4],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  logoutBtnPressed: {
    backgroundColor: colors.bgRaised,
  },
  logoutLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    fontWeight: "700",
    letterSpacing: 2,
  },
});
