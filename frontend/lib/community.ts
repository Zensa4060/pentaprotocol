/**
 * Single source of truth for community / social links surfaced in-game.
 *
 * The Discord invite is rendered in three places (Home, Profile, and the
 * Community / friends screen) plus the navbar label, so we centralize the
 * URL here to keep them in sync. Update this constant when the invite is
 * ever rotated.
 */
export const DISCORD_INVITE_URL = "https://discord.gg/DFA6tm7E";

/**
 * Opens the Discord invite in a new tab. Centralised so all entry points
 * share consistent rel/target hardening (noopener so the new tab can't
 * reach back into our window via window.opener).
 */
export function openDiscordInvite(): void {
  if (typeof window === "undefined") return;
  const a = document.createElement("a");
  a.href = DISCORD_INVITE_URL;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}
