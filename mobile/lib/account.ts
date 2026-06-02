/**
 * Account lifecycle — thin wrappers over the existing backend
 * endpoints (``backend/app/routers/auth.py``).
 *
 * ``deleteAccount`` is irreversible: the server requires the account
 * password, or — for password-less (Google-only) accounts — the
 * literal string ``"DELETE"`` as confirmation. On success we clear the
 * local session so the app bounces back to the auth flow.
 */

import { isAxiosError } from "axios";

import API from "./api";
import { logout } from "./auth";
import { ApiError } from "./profile";

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

/**
 * Permanently delete the signed-in account.
 * @param confirmation password (password accounts) or "DELETE" (Google-only).
 */
export async function deleteAccount(confirmation: string): Promise<void> {
  try {
    await API.post("/api/auth/delete-account", { password: confirmation });
  } catch (err) {
    throw toApiError(err, "Could not delete account.");
  }
  // Wipe the local session regardless of what the screen does next.
  await logout();
}

/** Request a copy of the account's data (GDPR-style export). */
export async function requestDataExport(): Promise<unknown> {
  try {
    const res = await API.get("/api/auth/export-data");
    return res.data;
  } catch (err) {
    throw toApiError(err, "Could not export your data.");
  }
}
