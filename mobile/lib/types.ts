/**
 * Shared TypeScript surface for the mobile app.
 *
 * Types here mirror the backend response shapes (FastAPI / Pydantic
 * on the server). When the server adds a field, add it here; never
 * silently widen with ``any``.
 *
 * The ``User`` shape mirrors the dict returned by
 * ``backend/app/routers/profile.py::_serialize_user`` — that's the
 * single source of truth on the backend, and we deliberately keep
 * field names byte-for-byte identical so the client never needs a
 * remap layer.
 */

/**
 * Promotion state for an AI-bot reward slot. We surface the raw
 * state and let the home / profile screens decide how to render it.
 */
export type BotRewardSlot = null | "pending" | "claimed";

export interface BotRewards {
  banner: BotRewardSlot;
  coin_toss: BotRewardSlot;
  board_skin: BotRewardSlot;
}

/**
 * Onboarding gate state. ``"none"`` triggers the first-run tutorial,
 * ``"skipped"`` / ``"completed"`` allow the home flow.
 */
export type OnboardingState = "none" | "skipped" | "completed";

/**
 * Authenticated user profile as returned by ``GET /api/profile/me``
 * and the various auth endpoints.
 *
 * Most fields are non-optional because the backend always emits
 * them (with sensible defaults — 0 / "" / false). The few that
 * stay optional are ones the backend can omit entirely.
 */
export interface User {
  // ── identity ─────────────────────────────────────────────────
  id: string;
  username: string;
  email: string;

  // ── progression ──────────────────────────────────────────────
  level: number;
  xp: number;
  shards: number;
  protocredits: number;

  // ── rating ───────────────────────────────────────────────────
  /** Hidden ELO. May be null for brand-new accounts. */
  elo: number | null;
  /** Public ranked rating once placements are done. */
  ranked_rating: number | null;
  /** Server-computed rank string (e.g. "BRONZE I"). */
  rank: string;
  ranked_ban_until: string | null;
  ranked_allowed: boolean;

  // ── match record ─────────────────────────────────────────────
  wins: number;
  losses: number;
  draws: number;
  placement_matches: number;
  is_placement: boolean;
  rb_wins: number;

  // ── security ─────────────────────────────────────────────────
  totp_enabled: boolean;
  google_linked: boolean;

  // ── profile ──────────────────────────────────────────────────
  bio: string;
  avatar: string | null;
  username_changed_at: string | null;

  // ── cosmetics ────────────────────────────────────────────────
  banner: string;
  border_style: string;
  board_style: string;
  title: string;
  purchased_items: string[];

  // ── legal / onboarding ───────────────────────────────────────
  legal_accepted: boolean;
  legal_accepted_version: number;
  onboarding_tutorial: OnboardingState;

  // ── trust / review ───────────────────────────────────────────
  under_review: boolean;

  // ── AI-bot progression ───────────────────────────────────────
  bot_defeats: Record<string, boolean>;
  bot_rewards: BotRewards;
}

/**
 * Shape of ``POST /api/auth/login`` and ``POST /api/auth/google``
 * happy-path responses. We deliberately do NOT model the
 * ``requires_2fa`` / ``requires_merge_consent`` / ``requires_policy_gate``
 * branches here yet — the login screen surfaces a generic error
 * for those cases until we wire dedicated screens.
 */
export interface LoginResponse {
  access_token: string;
  token_type?: string;
  user: User;
  requires_2fa?: boolean;
  requires_merge_consent?: boolean;
  requires_policy_gate?: boolean;
  temp_token?: string;
}

/**
 * Convenience: derived stats we compute client-side from a User.
 * Kept here (rather than spread across screens) so the win-rate
 * formula stays consistent everywhere.
 */
export function winRate(u: Pick<User, "wins" | "losses" | "draws">): number {
  const total = u.wins + u.losses + u.draws;
  if (total === 0) return 0;
  return Math.round((u.wins / total) * 100);
}
