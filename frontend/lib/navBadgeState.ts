import { PATCH_NOTES_STAMP } from "./patchNotesVersion";

export const PP_NAV_BADGES_EVENT = "pp_nav_badges_refresh";

const LS = {
  patchSeen: "pp_nav_patch_seen_stamp",
  storeCatalogSeen: "pp_nav_store_catalog_sig",
  careerPending: "pp_nav_career_mp_pending",
  profileCount: "pp_nav_profile_notify_count",
  collectionCount: "pp_nav_collection_unviewed",
  friendsCount: "pp_nav_friends_notify_count",
} as const;

function dispatchNavBadgesRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PP_NAV_BADGES_EVENT));
}

function rankTierIndex(elo: number): number {
  const mins = [0, 500, 1000, 1500, 2000, 2500];
  for (let i = mins.length - 1; i >= 0; i--) if (elo >= mins[i]) return i;
  return 0;
}

export function markCareerAfterMultiplayerSeriesEnd() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.careerPending, "1");
  dispatchNavBadgesRefresh();
}

export function clearCareerNavBadge() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS.careerPending);
  dispatchNavBadgesRefresh();
}

export function getCareerNavBadgeCount(): number {
  if (typeof window === "undefined") return 0;
  return localStorage.getItem(LS.careerPending) === "1" ? 1 : 0;
}

export function noteProfileProgressAfterMerge(prev: Record<string, unknown> | null, next: Record<string, unknown>) {
  if (typeof window === "undefined" || !prev) return;
  const oldElo = Number(prev.elo ?? 0);
  const newElo = Number(next.elo ?? oldElo);
  const oldLv = Number(prev.level ?? 1);
  const newLv = Number(next.level ?? oldLv);
  const rankUp = rankTierIndex(newElo) > rankTierIndex(oldElo);
  const levelUp = newLv > oldLv;
  if (!rankUp && !levelUp) return;
  const cur = parseInt(localStorage.getItem(LS.profileCount) || "0", 10) || 0;
  localStorage.setItem(LS.profileCount, String(cur + 1));
  dispatchNavBadgesRefresh();
}

export function getProfileNavBadgeCount(): number {
  if (typeof window === "undefined") return 0;
  return Math.min(99, parseInt(localStorage.getItem(LS.profileCount) || "0", 10) || 0);
}

export function clearProfileNavBadge() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS.profileCount);
  dispatchNavBadgesRefresh();
}

export function getPatchNavBadgeCount(): number {
  if (typeof window === "undefined") return 0;
  const seen = localStorage.getItem(LS.patchSeen);
  return seen === PATCH_NOTES_STAMP ? 0 : 1;
}

export function recordPatchNotesOpened() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.patchSeen, PATCH_NOTES_STAMP);
  dispatchNavBadgesRefresh();
}

export function getStoreNewCatalogBadgeCount(currentCatalogSig: string): number {
  if (typeof window === "undefined") return 0;
  const seen = localStorage.getItem(LS.storeCatalogSeen);
  if (!seen) return 0;
  return currentCatalogSig !== seen ? 1 : 0;
}

export function recordStoreCatalogSeen(currentCatalogSig: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS.storeCatalogSeen, currentCatalogSig);
  dispatchNavBadgesRefresh();
}

export function bumpCollectionNavBadge(delta = 1) {
  if (typeof window === "undefined") return;
  const cur = parseInt(localStorage.getItem(LS.collectionCount) || "0", 10) || 0;
  localStorage.setItem(LS.collectionCount, String(cur + delta));
  dispatchNavBadgesRefresh();
}

export function getCollectionNavBadgeCount(): number {
  if (typeof window === "undefined") return 0;
  return Math.min(99, parseInt(localStorage.getItem(LS.collectionCount) || "0", 10) || 0);
}

export function clearCollectionNavBadge() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS.collectionCount);
  dispatchNavBadgesRefresh();
}

/* ── Friends nav badge ───────────────────────────────────────────────────── */

/**
 * Number of pending friend requests + friend invites the user has not
 * handled yet. Set by AppShell's friends poller; read by NavBar.
 */
export function setFriendsNavBadgeCount(n: number) {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0, Math.min(999, Math.floor(n)));
  const prev = parseInt(localStorage.getItem(LS.friendsCount) || "0", 10) || 0;
  if (prev === clamped) return;
  localStorage.setItem(LS.friendsCount, String(clamped));
  dispatchNavBadgesRefresh();
}

export function getFriendsNavBadgeCount(): number {
  if (typeof window === "undefined") return 0;
  return Math.min(99, parseInt(localStorage.getItem(LS.friendsCount) || "0", 10) || 0);
}

export function clearFriendsNavBadge() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS.friendsCount);
  dispatchNavBadgesRefresh();
}
