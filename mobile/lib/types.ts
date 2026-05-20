/**
 * Shared TypeScript surface for the mobile app.
 *
 * Types here mirror the backend response shapes (FastAPI / Pydantic
 * on the server) and the persisted store schema. When the server
 * adds a field, add it here; never silently widen with ``any``.
 */

/**
 * Authenticated user profile as returned by ``GET /api/profile/me``
 * and the various auth endpoints. Marked partial-ish because the
 * server can omit fields the mobile build doesn't need yet
 * (battlepass, missions, etc.) — we add to this as we wire each
 * screen.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  elo?: number;
  rank?: string;
  placement_matches?: number;
  avatar_url?: string;
  created_at?: string;
}

/**
 * Shape of ``POST /api/auth/login`` and ``POST /api/auth/google``
 * happy-path responses. We deliberately do NOT model the
 * ``requires_2fa`` / ``requires_merge_consent`` / ``requires_policy_gate``
 * branches here yet — the login screen currently only handles the
 * direct-login branch and re-prompts the user on the other shapes.
 * Wire those in once their dedicated screens land.
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
