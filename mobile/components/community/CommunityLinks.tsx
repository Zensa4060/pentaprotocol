/**
 * Community link row — Discord, Reddit, Instagram, itch.io, feedback.
 */

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

export function CommunityLinks({ title = "COMMUNITY" }: CommunityLinksProps) {
  return (
    <View>
      {title ? (
        <Eyebrow tone="muted" style={{ marginBottom: space[2] }}>{title}</Eyebrow>
      ) : null}
      {COMMUNITY_LINKS.map((link) => (
        <Pressable
          key={link.id}
          style={styles.row}
          onPress={() => void openExternalUrl(link.url)}
        >
          <Body style={{ fontWeight: "700" }}>{link.label}</Body>
          <Caption tone="muted">{link.subtitle}</Caption>
        </Pressable>
      ))}
      <Pressable style={styles.row} onPress={() => void openFeedbackEmail()}>
        <Body style={{ fontWeight: "700" }}>Send feedback</Body>
        <Caption tone="muted">Email the team</Caption>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    marginBottom: space[2],
  },
});
