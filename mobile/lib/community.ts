/**
 * Community / social links — mirrors ``frontend/lib/community.ts``.
 */

import { Linking } from "react-native";

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
  const can = await Linking.canOpenURL(url);
  if (can) await Linking.openURL(url);
}

export async function openFeedbackEmail(): Promise<void> {
  const subject = encodeURIComponent("PentaProtocol — Feedback");
  const body = encodeURIComponent(
    "Hey PentaProtocol team,\n\n(Share your feedback, bug report, or suggestion below.)\n\n—\nSent from PentaProtocol mobile",
  );
  await Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`);
}
