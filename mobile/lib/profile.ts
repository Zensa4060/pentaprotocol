/**
 * Profile + security service — thin typed wrappers around the
 * backend's profile / auth endpoints that the rest of the app
 * uses.
 *
 * Why a dedicated module:
 *   - Screens shouldn't talk to ``API`` directly. Doing so leaks
 *     URL strings, request shapes, and error parsing across the
 *     UI layer, and the day the backend renames an endpoint we'd
 *     be grepping for it across a dozen TSX files.
 *   - Centralizing also lets us update the zustand store from
 *     a single chokepoint after a successful PUT/POST, so the
 *     UI always reflects the server's authoritative response
 *     without screens having to remember to call ``patchUser``.
 *
 * Every function here:
 *   1. Calls the backend.
 *   2. On success, updates ``useAuthStore`` with the server's
 *      response (so derived UI is consistent).
 *   3. On failure, normalizes to an ``ApiError`` with the
 *      backend's ``detail`` string when present.
 */

import { isAxiosError } from "axios";

import API from "./api";
import { logout } from "./auth";
import { useAuthStore } from "./store";
import type { User } from "./types";

export class ApiError extends Error {
  status?: number;
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function toApiError(err: unknown, fallback: string): ApiError {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return new ApiError(
      typeof detail === "string" ? detail : fallback,
      status,
      typeof detail === "string" ? detail : undefined,
    );
  }
  if (err instanceof Error) return new ApiError(err.message);
  return new ApiError(fallback);
}

// ─── Read: fetch the authoritative profile from the server ─────────────────

/**
 * Fetch ``GET /api/profile/me`` and patch the zustand cache with
 * the response. Returns the fresh ``User``.
 *
 * Use this when:
 *   - The profile screen mounts and wants to refresh the cached
 *     value (or hydrate it for the first time when the cached
 *     ``user`` is null but ``isAuthenticated`` is true).
 *   - A pull-to-refresh gesture wants a fresh snapshot.
 *
 * A 401 here means our cached JWT has been invalidated server-side
 * (rotated, banned, account deleted). We force a logout so the
 * next render bounces the user to the login screen instead of
 * leaving them stuck on an empty profile.
 */
export async function fetchProfile(): Promise<User> {
  try {
    const res = await API.get<User>("/api/profile/me");
    useAuthStore.getState().setProfile(res.data);
    return res.data;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      await logout();
    }
    throw toApiError(err, "Could not load your profile.");
  }
}

// ─── Legal acceptance ────────────────────────────────────────────────────────

/** Current policy version the mobile client renders. Bump when ToS changes. */
export const POLICY_VERSION = 1;

/**
 * Accept the current legal version. Server records the timestamp,
 * IP, and user-agent, and flips the user's ``legal_accepted`` flag.
 * After a successful POST we patch the cached profile so the auth
 * gate immediately moves past the legal screen.
 */
export async function acceptLegal(version = POLICY_VERSION): Promise<void> {
  try {
    await API.post("/api/auth/accept-legal", { version });
    useAuthStore.getState().patchUser({
      legal_accepted: true,
      legal_accepted_version: version,
    });
  } catch (err) {
    throw toApiError(err, "Could not record acceptance. Try again.");
  }
}

// ─── Onboarding tutorial state ───────────────────────────────────────────────

export type TutorialState = "skipped" | "completed";

/**
 * Mark the first-run tutorial as ``skipped`` or ``completed``.
 * Both values gate the user past ``/onboarding`` — the distinction
 * lets a future "what's new" reset target ``"skipped"`` users
 * without re-prompting completers.
 */
export async function setTutorialState(state: TutorialState): Promise<void> {
  try {
    const res = await API.post<{ ok: boolean; profile: User | null }>(
      "/api/profile/tutorial-state",
      { state },
    );
    if (res.data.profile) {
      useAuthStore.getState().setProfile(res.data.profile);
    } else {
      // Server returned ok without a profile — patch locally so the
      // auth gate still progresses (defensive: this branch is rare).
      useAuthStore.getState().patchUser({ onboarding_tutorial: state });
    }
  } catch (err) {
    throw toApiError(err, "Could not save tutorial state. Try again.");
  }
}

// ─── Profile editing (PUT /api/profile/me) ───────────────────────────────────

/**
 * Fields we let the mobile client patch in v1. Avatar URL is
 * supported by the server but we don't ship an image-picker UI
 * yet; banners / borders / titles are server-validated cosmetic
 * fields tied to the web-only shop and stay off the mobile
 * surface for the launch build.
 */
export interface ProfilePatchInput {
  username?: string;
  bio?: string;
  banner?: string;
  board_style?: string;
  /** Active UI theme (classic_dark, space, pixel, …). */
  theme?: string;
}

export async function updateProfile(patch: ProfilePatchInput): Promise<User> {
  try {
    const res = await API.put<User>("/api/profile/me", patch);
    useAuthStore.getState().setProfile(res.data);
    return res.data;
  } catch (err) {
    throw toApiError(err, "Could not update profile.");
  }
}

// ─── Password change (OTP-gated) ─────────────────────────────────────────────

/**
 * Step 1 — request an OTP to the user's email. Server side-effect
 * only; no client state to update.
 */
export async function sendChangePasswordOtp(): Promise<void> {
  try {
    await API.post("/api/otp/change-password/send");
  } catch (err) {
    throw toApiError(err, "Could not send verification code.");
  }
}

/**
 * Step 2 — verify the OTP + current password and set the new one.
 * Server validates min-length / OTP freshness / current-password
 * match; we just forward the strings.
 */
export async function changePassword(input: {
  currentPassword: string;
  otp: string;
  newPassword: string;
}): Promise<void> {
  try {
    await API.post("/api/otp/change-password/verify", {
      current_password: input.currentPassword,
      otp: input.otp,
      new_password: input.newPassword,
    });
  } catch (err) {
    throw toApiError(err, "Could not change password.");
  }
}

// ─── 2FA enrolment ───────────────────────────────────────────────────────────

export interface TwoFaSetupResponse {
  /** Base32 TOTP secret. Display as fallback if the QR image fails. */
  secret: string;
  /** ``data:image/png;base64,…`` of the otpauth URI. */
  qr_code: string;
  message?: string;
}

/**
 * Begin TOTP enrolment. Returns a fresh secret + a base64-encoded
 * QR-code PNG the user scans with Google Authenticator / Authy /
 * 1Password. The user is NOT 2FA-enabled until they call
 * ``confirmTwoFa`` with a valid 6-digit code.
 */
export async function setupTwoFa(): Promise<TwoFaSetupResponse> {
  try {
    const res = await API.post<TwoFaSetupResponse>("/api/auth/2fa/setup");
    return res.data;
  } catch (err) {
    throw toApiError(err, "Could not start 2FA setup.");
  }
}

/**
 * Confirm enrolment with a 6-digit TOTP code. On success the server
 * flips ``totp_enabled`` true; we patch the cached profile so the
 * profile screen immediately reflects the new state.
 */
export async function confirmTwoFa(code: string): Promise<void> {
  try {
    await API.post("/api/auth/2fa/confirm", { code });
    useAuthStore.getState().patchUser({ totp_enabled: true });
  } catch (err) {
    throw toApiError(err, "Invalid code — try again.");
  }
}
