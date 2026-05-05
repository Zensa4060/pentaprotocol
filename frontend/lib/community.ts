/**
 * Single source of truth for community / social links surfaced in-game.
 *
 * These links are rendered in multiple places (Home, Profile, the
 * Community page, etc.) so we centralise the URLs here to keep every
 * entry point in sync. Update these constants whenever a link rotates.
 */
export const DISCORD_INVITE_URL = "https://discord.gg/DFA6tm7E";
export const REDDIT_URL         = "https://www.reddit.com/r/PentaProtocol/";
export const ITCH_IO_URL        = "https://zensa4070.itch.io/pentaprotocol";

/**
 * Address used for the in-game "Send Feedback" surface. Same inbox as
 * `support@` — kept as a separate constant so we can swap it (e.g. to
 * a dedicated feedback@ alias) without hunting through call sites.
 */
export const FEEDBACK_EMAIL     = "support@pentaprotocol.com";

/**
 * Opens an external URL in a new tab with rel/target hardening
 * (noopener so the new tab can't reach back into our window via
 * window.opener).
 */
function openExternal(href: string): void {
  if (typeof window === "undefined") return;
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

export function openDiscordInvite(): void {
  openExternal(DISCORD_INVITE_URL);
}

export function openRedditCommunity(): void {
  openExternal(REDDIT_URL);
}

export function openItchIoPage(): void {
  openExternal(ITCH_IO_URL);
}

/**
 * Triggers the OS mail client with a feedback-prefixed subject so any
 * incoming mail is easy to triage. Uses `location.href = mailto:` so the
 * current tab handles the protocol; this is the most reliable way to
 * launch native mail across browsers (a synthetic <a target="_blank"> on
 * `mailto:` opens an empty popup in some browsers).
 */
export function openFeedbackEmail(): void {
  if (typeof window === "undefined") return;
  const subject = encodeURIComponent("PentaProtocol — Feedback");
  const body = encodeURIComponent(
    "Hey PentaProtocol team,\n\n" +
      "(Share your feedback, bug report, or suggestion below.)\n\n" +
      "—\nSent from PentaProtocol",
  );
  window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`;
}
