/**
 * Entry route — single-purpose auth gate.
 *
 * The persisted store has already hydrated by the time this file
 * mounts (see ``app/_layout.tsx``). We just read it and redirect
 * once. No spinner, no flash — the splash is still up until the
 * root layout calls ``hideAsync``.
 *
 * Keeping this in its own route (rather than redirecting from the
 * root layout) means tab navigation back to ``/`` from inside the
 * app still works as a quick "send me wherever auth says".
 */

import { Redirect } from "expo-router";

import { useAuthStore } from "@/lib/store";

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? "/(tabs)" : "/(auth)/login"} />;
}
