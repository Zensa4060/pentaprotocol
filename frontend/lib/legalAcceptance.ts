/** Session flag: user id string after signup until policies are accepted or user declines. */
export const POLICY_GATE_SESSION_KEY = "pp_policy_gate_pending";

const LEGAL_ACCEPT_KEY = "pp_legal_accept_v2";
/** Bump with backend `CURRENT_LEGAL_VERSION` when policies change. */
export const LEGAL_VERSION = 3;

export type LegalAcceptRecord = { userId: string; v: number; at: number };

export function getUserId(user: { _id?: string; id?: string } | null | undefined): string {
  if (!user) return "";
  const id = user._id ?? user.id;
  return id != null ? String(id) : "";
}

export function readLegalAcceptance(): LegalAcceptRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGAL_ACCEPT_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as LegalAcceptRecord;
    if (!j || typeof j.userId !== "string" || j.v !== LEGAL_VERSION) return null;
    return j;
  } catch {
    return null;
  }
}

export function hasAcceptedLegal(
  userId: string,
  user?: { legal_accepted?: boolean; legal_accepted_version?: number } | null,
): boolean {
  if (!userId) return false;
  // Server says they already accepted — trust it for any version (existing
  // accounts are not re-prompted on policy bumps).
  if (user?.legal_accepted === true) return true;
  // Device record before /me refresh (e.g. right after accept-legal).
  const rec = readLegalAcceptance();
  return rec?.userId === userId && rec.v === LEGAL_VERSION;
}

export function setLegalAccepted(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  const payload: LegalAcceptRecord = { userId, v: LEGAL_VERSION, at: Date.now() };
  localStorage.setItem(LEGAL_ACCEPT_KEY, JSON.stringify(payload));
}

export function clearPolicyGatePending(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(POLICY_GATE_SESSION_KEY);
}
