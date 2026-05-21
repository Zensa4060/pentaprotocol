/**
 * Entry route — auth + first-run gate.
 *
 * The persisted store has already hydrated by the time this file
 * mounts (see ``app/_layout.tsx``). We read it once and emit a
 * single ``<Redirect />`` based on the user's state:
 *
 *   - Not authenticated     → /(auth)/login
 *   - Authed, no legal      → /legal-gate
 *   - Authed, no tutorial   → /onboarding
 *   - Authed, fully set up  → /(tabs)
 *
 * Keeping this in its own route (rather than redirecting from the
 * root layout) means tab navigation back to ``/`` from inside the
 * app still works as a quick "send me wherever auth says". The
 * gate runs on every visit, so once the user accepts legal or
 * finishes onboarding the next /  visit lands them on tabs.
 */

import { Redirect } from "expo-router";

import { POLICY_VERSION } from "@/lib/profile";
import { useAuthStore } from "@/lib/store";

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Legal gate first — Play Store + EU privacy regs require this
  // happens before any account-bound feature surfaces. Both an
  // accepted-but-stale and a never-accepted user end up here.
  if (user && (!user.legal_accepted || user.legal_accepted_version < POLICY_VERSION)) {
    return <Redirect href="/legal-gate" />;
  }

  // Then onboarding for brand-new accounts. "skipped" and
  // "completed" both pass.
  if (user && user.onboarding_tutorial === "none") {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
