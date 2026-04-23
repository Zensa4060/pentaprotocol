import API from "./api";

/**
 * First-run tutorial state helpers.
 *
 * State values (mirrors the `onboarding_tutorial` field on the user doc):
 *   - "none"      : never shown; show the choice gate
 *   - "skipped"   : user explicitly skipped; do not show again (unless replayed)
 *   - "completed" : user finished the walkthrough; do not show again
 *
 * Legacy users (created before this field existed) are serialized as
 * "completed" by the backend so we never surprise them with a late gate.
 */

export type TutorialState = "none" | "skipped" | "completed";

const LOCAL_KEY = "pp_tutorial_state_v1";

/** Typed shape of the user object fields we care about. */
export interface UserLikeTutorial {
  onboarding_tutorial?: TutorialState | string | null;
  legal_accepted?: boolean;
}

export function normalizeTutorialState(v: unknown): TutorialState {
  if (v === "skipped" || v === "completed" || v === "none") return v;
  return "completed";
}

/**
 * The source of truth is the server user doc; local cache only exists so
 * we can make an immediate UX decision on boot before /me comes back.
 */
export function readLocalTutorialState(userId: string): TutorialState | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { userId?: string; state?: string };
    if (j?.userId !== userId) return null;
    return normalizeTutorialState(j.state);
  } catch {
    return null;
  }
}

export function writeLocalTutorialState(userId: string, state: TutorialState): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ userId, state }));
  } catch {
    /* noop */
  }
}

/**
 * True iff the user should see the tutorial choice gate right now.
 * Requires policy acceptance to already be handled; caller must check that.
 */
export function shouldShowTutorialGate(user: UserLikeTutorial | null | undefined): boolean {
  if (!user) return false;
  if (!user.legal_accepted) return false;
  return normalizeTutorialState(user.onboarding_tutorial) === "none";
}

/**
 * Persist tutorial decision to the server + mirror locally. Resolves even
 * if the network call fails so the UX can continue — we accept the risk
 * that a flaky request delays the server write until the next /me round-trip.
 */
export async function persistTutorialState(
  token: string,
  state: TutorialState,
): Promise<void> {
  try {
    await API.post(
      "/api/profile/tutorial-state",
      { state },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    /* noop — local mirror still updates */
  }
}
