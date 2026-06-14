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

/** Password sign-in either completes, or hands back a 2FA challenge. */
export type PasswordSignInResult =
  | { status: "ok"; user: User }
  | { status: "2fa_required"; tempToken: string };

/**
 * Sign in with username/email + password.
 *
 * Resolves ``{status:"ok"}`` on the happy path or
 * ``{status:"2fa_required"}`` when the account has TOTP enabled (the
 * caller then collects the 6-digit code and calls
 * ``completeTwoFactorLogin``). Throws ``AuthError`` on everything else.
 */
export async function signInWithPassword(input: {
  username: string;
  password: string;
  /** "Stay signed in for 30 days" — defaults to a session-only login. */
  keepSignedIn?: boolean;
}): Promise<PasswordSignInResult> {
  try {
    const res = await API.post<LoginResponse>("/api/auth/login", {
      username: input.username,
      password: input.password,
    });
    if (res.data.requires_2fa) {
      if (!res.data.temp_token) {
        throw new AuthError("Server returned an incomplete 2FA challenge.");
      }
      return { status: "2fa_required", tempToken: res.data.temp_token };
    }
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete login response.");
    }
    await useAuthStore
      .getState()
      .setUser(res.data.user, res.data.access_token, input.keepSignedIn ?? false);
    return { status: "ok", user: res.data.user };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Invalid credentials or server error.");
  }
}

/** Step 2 of a 2FA login — exchanges the temp token + TOTP code for a session. */
export async function completeTwoFactorLogin(input: {
  tempToken: string;
  code: string;
  /** Carried over from the login screen's "stay signed in" checkbox. */
  keepSignedIn?: boolean;
}): Promise<User> {
  try {
    const res = await API.post<LoginResponse>("/api/auth/2fa/login", {
      temp_token: input.tempToken,
      code: input.code.trim(),
    });
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete login response.");
    }
    await useAuthStore
      .getState()
      .setUser(res.data.user, res.data.access_token, input.keepSignedIn ?? false);
    return res.data.user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Invalid authenticator code.");
  }
}

/** Google sign-in either completes, or asks consent to merge with an email account. */
export type GoogleSignInResult =
  | { status: "ok"; user: User }
  | { status: "merge_consent"; email: string };

/**
 * Sign in with a Google ID-token JWT.
 *
 * ``@react-native-google-signin/google-signin`` returns an
 * ``idToken`` on a successful native sign-in; the backend's
 * ``POST /api/auth/google`` accepts both ID-token JWTs (mobile /
 * iOS-Safari path) and OAuth access tokens (desktop popup path),
 * verified through ``google-auth``. So we can hand the value
 * straight through.
 *
 * When the Google email matches an existing password account the
 * server replies ``requires_merge_consent`` — surface the consent
 * prompt, then call again with ``confirmMerge: true``.
 */
export async function signInWithGoogle(input: {
  credential: string;
  confirmMerge?: boolean;
  /** "Stay signed in for 30 days" — defaults to a session-only login. */
  keepSignedIn?: boolean;
}): Promise<GoogleSignInResult> {
  try {
    const res = await API.post<LoginResponse>("/api/auth/google", {
      credential: input.credential,
      confirm_merge: input.confirmMerge ?? false,
    });
    if (res.data.requires_merge_consent) {
      return { status: "merge_consent", email: res.data.email ?? "" };
    }
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete login response.");
    }
    await useAuthStore
      .getState()
      .setUser(res.data.user, res.data.access_token, input.keepSignedIn ?? false);
    return { status: "ok", user: res.data.user };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Google sign-in failed.");
  }
}

/** Request a 6-digit password-reset code (always resolves — no account enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await API.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
  } catch (err) {
    throw toAuthError(err, "Could not send the reset code.");
  }
}

/** Complete the reset with the emailed code + new password (8+ chars). */
export async function resetPasswordWithCode(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  try {
    await API.post("/api/auth/reset-password", {
      email: input.email.trim().toLowerCase(),
      code: input.code.trim(),
      new_password: input.newPassword,
    });
  } catch (err) {
    throw toAuthError(err, "Invalid or expired reset code.");
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

/** Step 1 — email OTP for new account (same as web signup). */
export async function sendSignupOtp(email: string): Promise<void> {
  try {
    await API.post("/api/otp/signup/send", { email: email.trim().toLowerCase() });
  } catch (err) {
    throw toAuthError(err, "Could not send verification code.");
  }
}

/** Step 2 — verify OTP then register; stores session like login. */
export async function verifySignupOtpAndRegister(input: {
  email: string;
  otp: string;
  username: string;
  password: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  try {
    await API.post("/api/otp/signup/verify", { email, otp: input.otp.trim() });
    const res = await API.post<LoginResponse>("/api/auth/register", {
      username: input.username.trim(),
      email,
      password: input.password,
    });
    if (!res.data.access_token || !res.data.user) {
      throw new AuthError("Server returned an incomplete signup response.");
    }
    await useAuthStore.getState().setUser(res.data.user, res.data.access_token);
    return res.data.user;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw toAuthError(err, "Invalid or expired code.");
  }
}
