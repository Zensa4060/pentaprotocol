"use client";

/**
 * First-run flow wrapper: the three guided "play & win" games, then the
 * spotlight tour of the live Home/nav, then persistence. Mounted by AppShell
 * at the tutorial gate in place of the old slide `TutorialScreen`. Mirrors that
 * component's contract (`themeId` / `token` / `onDoneAction`) so the AppShell
 * gate logic is unchanged apart from which component renders.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ThemeId } from "@/lib/themes";
import { ROUTES } from "@/lib/routes";
import { persistTutorialState, type TutorialState } from "@/lib/tutorialState";
import { HOME_TOUR } from "@/lib/guidedGames";
import { useSyrosVoice } from "@/hooks/useSyrosVoice";
import GuidedOnboarding from "@/components/GuidedOnboarding";
import SpotlightTour from "@/components/SpotlightTour";

export interface GuidedOnboardingFlowProps {
  themeId: ThemeId;
  token: string;
  /** Persist the outcome to the server (only true for the first-run gate, not
   *  for replays from Training → Tutorial). */
  persist?: boolean;
  onDoneAction: (result: TutorialState) => void;
}

export default function GuidedOnboardingFlow({
  themeId,
  token,
  persist = true,
  onDoneAction,
}: GuidedOnboardingFlowProps) {
  const router = useRouter();
  const voice = useSyrosVoice();
  const [phase, setPhase] = useState<"games" | "tour">("games");

  const finish = (state: TutorialState) => {
    if (persist) void persistTutorialState(token, state);
    onDoneAction(state);
  };

  if (phase === "games") {
    return (
      <GuidedOnboarding
        themeId={themeId}
        onComplete={() => {
          // Drop the player on the real Home so the spotlight can target it.
          try {
            router.replace(ROUTES.HOME);
          } catch {
            /* noop */
          }
          setPhase("tour");
        }}
        onSkip={() => finish("skipped")}
      />
    );
  }

  return (
    <SpotlightTour
      steps={HOME_TOUR}
      themeId={themeId}
      voice={voice}
      onDone={() => finish("completed")}
    />
  );
}
