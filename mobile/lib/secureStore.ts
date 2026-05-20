/**
 * Thin wrapper around ``expo-secure-store`` for the JWT lifecycle.
 *
 * The web app keeps the session in an HttpOnly cookie because that's
 * the only safe place to put it inside a browser (the JS context
 * isn't trusted enough). React Native flips that: there's no cookie
 * jar by default, but the OS *does* expose hardware-backed secure
 * storage:
 *   - iOS: Keychain (Secure Enclave on supported devices).
 *   - Android: EncryptedSharedPreferences backed by KeyStore.
 * ``expo-secure-store`` is the cross-platform adapter for both.
 *
 * Why a separate module and not just inlining ``SecureStore``
 * everywhere:
 *   1. Single import path → mocking / fakes in tests stays trivial.
 *   2. Defensive try/catch — SecureStore *can* throw on weird device
 *      states (locked Keychain on jailbroken devices, full disk on
 *      Android Go). We catch + log and return ``null`` so the app
 *      degrades to "logged out" instead of crash-on-launch.
 *   3. Keeps the key name (``pp_jwt``) in exactly one place.
 */

import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "pp_jwt";

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    if (__DEV__) console.warn("[secureStore] getToken failed", err);
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      // We don't require biometric/passcode unlock for the JWT —
      // doing so would block every cold start behind FaceID, which
      // is a UX regression. The OS-level keystore already protects
      // the value from other apps.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (err) {
    if (__DEV__) console.warn("[secureStore] setToken failed", err);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    if (__DEV__) console.warn("[secureStore] clearToken failed", err);
  }
}
