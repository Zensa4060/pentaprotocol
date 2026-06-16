/**
 * Native Google Sign-In wrapper.
 *
 * The SDK is loaded lazily so Expo Go can boot without
 * ``RNGoogleSignin`` in the native binary. Dev/production builds
 * load the module on first sign-in attempt.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

/** Thrown for any non-success path callers should surface to the user. */
export class GoogleAuthError extends Error {
  code: "expo_go" | "missing_config" | "cancelled" | "in_progress" | "no_play_services" | "no_id_token" | "unknown";
  constructor(message: string, code: GoogleAuthError["code"]) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

export function isGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

function loadGoogleSignin(): GoogleSigninModule {
  if (!isGoogleSignInAvailable()) {
    throw new GoogleAuthError(
      "Google Sign-In requires a development build. Use email login in Expo Go, or install your EAS dev APK.",
      "expo_go",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@react-native-google-signin/google-signin") as GoogleSigninModule;
}

let configured = false;

function ensureConfigured(GoogleSignin: GoogleSigninModule["GoogleSignin"]): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  if (!webClientId) {
    throw new GoogleAuthError(
      "Google Sign-In isn't configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and rebuild the dev client.",
      "missing_config",
    );
  }
  if (Platform.OS === "android" && !androidClientId) {
    throw new GoogleAuthError(
      "Google Sign-In isn't configured for Android. Set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (Android OAuth client from Google Cloud) and rebuild.",
      "missing_config",
    );
  }
  // Android resolves its OAuth client from the package name + SHA registered in
  // Google Cloud and uses ``webClientId`` for the ID-token audience — the native
  // module has no ``androidClientId`` config field (the env var is still
  // validated above so a misconfigured build fails loudly).
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
  configured = true;
}

export async function signInWithGoogleNative(): Promise<string> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = loadGoogleSignin();
  ensureConfigured(GoogleSignin);

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch {
    throw new GoogleAuthError(
      "Google Play Services is unavailable or outdated. Update Play Services and try again.",
      "no_play_services",
    );
  }

  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new GoogleAuthError("Sign-in cancelled.", "cancelled");
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      throw new GoogleAuthError(
        "Google didn't return an ID token. Confirm the OAuth Web Client ID is set in mobile/.env.",
        "no_id_token",
      );
    }
    return idToken;
  } catch (err) {
    if (err instanceof GoogleAuthError) throw err;
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          throw new GoogleAuthError("Sign-in cancelled.", "cancelled");
        case statusCodes.IN_PROGRESS:
          throw new GoogleAuthError("Sign-in is already in progress.", "in_progress");
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          throw new GoogleAuthError(
            "Google Play Services is unavailable on this device.",
            "no_play_services",
          );
      }
    }
    const msg = err instanceof Error ? err.message : "Google sign-in failed.";
    if (/DEVELOPER_ERROR/i.test(msg)) {
      throw new GoogleAuthError(
        "Google Sign-In DEVELOPER_ERROR: register the EAS SHA-1 in Google Cloud (Android OAuth client, package com.pentaprotocol.app). Run: npm run android:sha1",
        "unknown",
      );
    }
    throw new GoogleAuthError(msg, "unknown");
  }
}

/**
 * Forget the cached Google account on this device.
 *
 * The native SDK remembers the last account that signed in, so a plain
 * app logout leaves it in place and the *next* ``signIn()`` silently
 * re-selects it instead of showing the account chooser. Calling
 * ``signOut()`` clears that cache, so the picker (with all accounts)
 * shows again next time.
 *
 * Best-effort by design: it must never block or fail the app's own
 * logout. In Expo Go (no native module) or with missing config it's a
 * no-op, and any SDK error is swallowed.
 */
export async function signOutGoogleNative(): Promise<void> {
  if (!isGoogleSignInAvailable()) return;
  try {
    const { GoogleSignin } = loadGoogleSignin();
    ensureConfigured(GoogleSignin);
    await GoogleSignin.signOut();
  } catch {
    // Clearing the cached Google account is opportunistic — never let it
    // stop the user from signing out of the app.
  }
}
