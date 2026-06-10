/**
 * Community link row — Discord, Reddit, Instagram, itch.io, feedback.
 */

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { Body, Caption, Eyebrow } from "@/components/ui";
import {
  COMMUNITY_LINKS,
  openExternalUrl,
  openFeedbackEmail,
} from "@/lib/community";
import { colors, radii, space } from "@/theme/tokens";

interface CommunityLinksProps {
  title?: string;
}

const LINK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  discord: "logo-discord",
  reddit: "logo-reddit",
  instagram: "logo-instagram",
  itch: "game-controller",
};

function LinkRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      android_ripple={{ color: colors.bgRaised }}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Body style={{ fontWeight: "700" }}>{label}</Body>
        <Caption tone="muted">{subtitle}</Caption>
      </View>
      <Ionicons name="open-outline" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function CommunityLinks({ title = "COMMUNITY" }: CommunityLinksProps) {
  return (
    <View>
      {title ? (
        <Eyebrow tone="muted" style={{ marginBottom: space[2] }}>{title}</Eyebrow>
      ) : null}
      {COMMUNITY_LINKS.map((link) => (
        <LinkRow
          key={link.id}
          icon={LINK_ICONS[link.id] ?? "globe-outline"}
          label={link.label}
          subtitle={link.subtitle}
          onPress={() => void openExternalUrl(link.url)}
        />
      ))}
      <LinkRow
        icon="mail-outline"
        label="Send feedback"
        subtitle="Email the team"
        onPress={() => void openFeedbackEmail()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    marginBottom: space[2],
  },
  rowPressed: {
    backgroundColor: colors.bgRaised,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgRaised,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
