/**
 * Native Google Sign-In wrapper.
 *
 * Centralises every interaction with
 * ``@react-native-google-signin/google-signin`` so screens don't have
 * to know about the SDK directly. We expose two functions:
 *
 *   - ``isGoogleSignInAvailable()`` — false in Expo Go (the SDK is a
 *     native module and isn't bundled into the Go client).
 *   - ``signInWithGoogleNative()`` — runs the configure + hasPlayServices
 *     + signIn flow, returns the Google ID-token string the backend
 *     accepts at ``POST /api/auth/google``.
 *
 * The matching backend exchange (``credential`` → app JWT + user) lives
 * in ``signInWithGoogle()`` inside ``./auth.ts``; this file is *only*
 * about getting the ID token out of Google.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

/** Thrown for any non-success path callers should surface to the user. */
export class GoogleAuthError extends Error {
  code: "expo_go" | "missing_config" | "cancelled" | "in_progress" | "no_play_services" | "no_id_token" | "unknown";
  constructor(message: string, code: GoogleAuthError["code"]) {
    super(message);
    this.name = "GoogleAuthError";
    this.code = code;
  }
}

/**
 * Expo Go ships without third-party native modules. In SDK 54
 * ``Constants.executionEnvironment === "storeClient"`` is the
 * canonical way to detect the Expo Go client (the older
 * ``appOwnership`` field is deprecated). Dev builds report
 * ``"bare"`` and production builds ``"standalone"``.
 * We gate on this before touching the SDK so we can show a friendly
 * "needs dev build" message instead of crashing on the TurboModule.
 */
export function isGoogleSignInAvailable(): boolean {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

let configured = false;
function ensureConfigured(): void {
  if (configured) return;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new GoogleAuthError(
      "Google Sign-In isn't configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env and rebuild the dev client.",
      "missing_config",
    );
  }
  // ``webClientId`` is the OAuth 2.0 Web client ID — required so the
  // native SDK can hand us back an ``idToken`` that our FastAPI
  // backend can verify with the same audience.
  GoogleSignin.configure({ webClientId, offlineAccess: false });
  configured = true;
}

/**
 * Run the full native Google Sign-In flow and return the Google
 * ID-token JWT. Caller is expected to forward it to
 * ``signInWithGoogle({ credential })`` from ``./auth.ts``.
 */
export async function signInWithGoogleNative(): Promise<string> {
  if (!isGoogleSignInAvailable()) {
    throw new GoogleAuthError(
      "Google Sign-In requires a development build. Use email login for now or run `npx expo run:android` / `run:ios`.",
      "expo_go",
    );
  }
  ensureConfigured();

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
      // ``cancelled`` and ``noSavedCredentialFound`` both arrive as
      // non-success types. Either way the user didn't complete the
      // flow — surface as cancellation so the UI just resets.
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
    throw new GoogleAuthError(
      err instanceof Error ? err.message : "Google sign-in failed.",
      "unknown",
    );
  }
}
