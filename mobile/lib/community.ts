/**
 * Community / social links — mirrors ``frontend/lib/community.ts``.
 */

import { Alert, Linking } from "react-native";

export const DISCORD_INVITE_URL = "https://discord.gg/W6prvWmrR3";
export const REDDIT_URL = "https://www.reddit.com/r/PentaProtocol/";
export const ITCH_IO_URL = "https://zensa4070.itch.io/pentaprotocol";
export const INSTAGRAM_URL = "https://www.instagram.com/pentaprotocol";
export const FEEDBACK_EMAIL = "support@pentaprotocol.com";

export interface CommunityLink {
  id: string;
  label: string;
  subtitle: string;
  url: string;
}

export const COMMUNITY_LINKS: CommunityLink[] = [
  { id: "discord", label: "Join Discord", subtitle: "Chat with the community", url: DISCORD_INVITE_URL },
  { id: "reddit", label: "Reddit", subtitle: "r/PentaProtocol", url: REDDIT_URL },
  { id: "instagram", label: "Instagram", subtitle: "@pentaprotocol", url: INSTAGRAM_URL },
  { id: "itch", label: "itch.io", subtitle: "Dev builds & lore", url: ITCH_IO_URL },
];

export async function openExternalUrl(url: string): Promise<void> {
  // Don't gate on Linking.canOpenURL — on Android 11+ it reports false
  // for schemes not declared in the manifest <queries> block, which made
  // every community link a silent no-op. openURL itself resolves https
  // intents fine; just catch the rare genuine failure.
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open link", url);
  }
}

export async function openFeedbackEmail(): Promise<void> {
  const subject = encodeURIComponent("PentaProtocol — Feedback");
  const body = encodeURIComponent(
    "Hey PentaProtocol team,\n\n(Share your feedback, bug report, or suggestion below.)\n\n—\nSent from PentaProtocol mobile",
  );
  try {
    await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
  } catch {
    Alert.alert("No email app found", `Write to us at ${FEEDBACK_EMAIL}.`);
  }
}
