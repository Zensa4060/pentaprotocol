/**
 * Renders the global XP level-up modal when profile level increases.
 */

import { XpLevelUpOverlay } from "@/components/game/XpLevelUpOverlay";
import { useAuthStore } from "@/lib/store";

export function GlobalLevelUpHost() {
  const pending = useAuthStore((s) => s.pendingLevelUp);
  const setPending = useAuthStore((s) => s.setPendingLevelUp);

  if (!pending) return null;

  return (
    <XpLevelUpOverlay
      visible
      fromLevel={pending.from}
      toLevel={pending.to}
      onDone={() => setPending(null)}
    />
  );
}
