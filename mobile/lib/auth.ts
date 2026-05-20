/**
 * Auth orchestration — the glue between the login UI, the API
 * client, the secure store, and the zustand cache.
 *
 * Screens shouldn't talk to ``API`` + ``setToken`` + ``setUser``
 * directly — they call one of these functions and get back either
 * a clean result or a typed error. Keeping the orchestration here
 * means the same exact flow runs whether the user signed in via
 * email, Google, biometrics-restored session, or (later) deeplink
 * recovery — no copy-paste between screens.
 */

import { isAxiosError } from "axios";

import API from "./api";
import { useAuthStore } from "./store";
import type { LoginResponse, User } from "./types";

export class AuthError extends Error {
  /** HTTP status, when the failure came from the server. */
  status?: number;
  /** Backend ``detail`` string (already i18n-ed by the server). */
  detail?: string;

  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.detail = detail;
  }
}

function toAuthError(err: unknown, fallback: string): AuthError {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)?.detail;
    return new AuthError(
      typeof detail === "string" ? detail : fallback,
      status,
      typeof detail === "string" ? detail : undefined,
    );
  }
  if (err instanceof Error) return new AuthError(err.message);
  return new AuthError(fallback);
}

/**
 * Sign in with username/email + password.
 *
 * Returns the user on the happy path; throws ``AuthError`` on
 * everything else (invalid creds, server down, 2FA-required, etc.).
 * 2FA + merge consent + policy-gate branches are intentionally not
 * exposed here yet — the login screen surfaces a generic error for
 * those cases until we wire dedicated screens for each.
 */
export async function signInWithPassword(input: {
  username: string;
  password: string;
}): Promise<User> {
  try {
    const res = await API.post<LoginResponse>("/api/auth/login", {
      username: input.username,
      password: input.password,
    });
    if (res.data.requires_2fa) {
      throw new AuthError(
        "Two-factor authentication required. Open in the web app to complete sign-in (native 2FA screen coming soon).",
        200,
      );
    }
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete login response.");
    }
    await useAuthStore.getState().setUser(res.data.user, res.data.access_token);
    return res.data.user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Invalid credentials or server error.");
  }
}

/**
 * Sign in with a Google ID-token JWT.
 *
 * ``@react-native-google-signin/google-signin`` returns an
 * ``idToken`` on a successful native sign-in; the backend's
 * ``POST /api/auth/google`` accepts both ID-token JWTs (mobile /
 * iOS-Safari path) and OAuth access tokens (desktop popup path),
 * verified through ``google-auth``. So we can hand the value
 * straight through.
 */
export async function signInWithGoogle(input: {
  credential: string;
}): Promise<User> {
  try {
    const res = await API.post<LoginResponse>("/api/auth/google", {
      credential: input.credential,
    });
    if (res.data.requires_merge_consent) {
      throw new AuthError(
        "An account with this email exists. Open in the web app to merge it (native merge screen coming soon).",
        409,
      );
    }
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete login response.");
    }
    await useAuthStore.getState().setUser(res.data.user, res.data.access_token);
    return res.data.user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Google sign-in failed.");
  }
}

/**
 * Clear the session — both SecureStore and the cached profile.
 * Convenience re-export so screens don't have to ``import { useAuthStore }``
 * just to call ``logout()``.
 */
export async function logout(): Promise<void> {
  await useAuthStore.getState().logout();
}
