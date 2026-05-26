/**
 * Native Google Sign-In wrapper.
 *
 * The SDK is loaded lazily so Expo Go can boot without
 * ``RNGoogleSignin`` in the native binary. Dev/production builds
 * load the module on first sign-in attempt.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";

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
  if (!webClientId) {
    throw new GoogleAuthError(
      "Google Sign-In isn't configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and rebuild the dev client.",
      "missing_config",
    );
  }
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  GoogleSignin.configure({
    webClientId,
    ...(androidClientId ? { androidClientId } : {}),
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
        "Google Sign-In DEVELOPER_ERROR: add your EAS production SHA-1 to Google Cloud → Credentials → Android OAuth client (package com.pentaprotocol.app). Run: eas credentials -p android",
        "unknown",
      );
    }
    throw new GoogleAuthError(msg, "unknown");
  }
}
