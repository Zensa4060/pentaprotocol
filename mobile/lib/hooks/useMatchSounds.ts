/**
 * Shared match SFX — place on tap, victory/defeat on game end.
 */

import { useEffect, useRef } from "react";

import { useGameAudio, type BgmContext } from "@/lib/audio/AudioProvider";

/**
 * Match BGM. Defaults to the normal "game" track; pass "ranked" for
 * matches that should use the theme's ranked track (ranked PvP and the
 * named hard bots — JR. / HIM / HER — mirroring the web's getBgmCtx).
 */
export function useMatchGameBgm(context: BgmContext = "game") {
  const audio = useGameAudio();
  useEffect(() => {
    audio.playBgm(context);
    return () => {
      audio.pauseBgm();
    };
  }, [audio, context]);
}

export function useLobbyBgm() {
  const audio = useGameAudio();
  useEffect(() => {
    audio.playBgm("lobby");
    return () => {
      audio.pauseBgm();
    };
  }, [audio]);
}

export function useGameEndSounds(
  status: "playing" | "won" | "draw",
  winner: "P1" | "P2" | null,
  perspective: "P1" | "P2" | "any",
) {
  const audio = useGameAudio();
  const prev = useRef(status);

  useEffect(() => {
    if (prev.current === "playing" && status === "won" && winner) {
      const youWin =
        perspective === "any"
          ? true
          : perspective === "P1"
          ? winner === "P1"
          : winner === "P2";
      if (youWin) audio.sfx.victory();
      else audio.sfx.defeat();
    }
    prev.current = status;
  }, [status, winner, perspective, audio]);
}

export function useRulebreakerPendingSound(active: boolean) {
  const audio = useGameAudio();
  const fired = useRef(false);

  useEffect(() => {
    if (active && !fired.current) {
      fired.current = true;
      audio.sfx.rulebreaker();
    }
    if (!active) fired.current = false;
  }, [active, audio]);
}
