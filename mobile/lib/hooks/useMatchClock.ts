import { useCallback, useEffect, useRef, useState } from "react";

import { MATCH_MS_7, formatClock, type Player7 } from "@/lib/game/matchRules7";

export interface MatchClock {
  p1Ms: number;
  p2Ms: number;
  p1Label: string;
  p2Label: string;
  active: Player7 | null;
  reset: () => void;
}

export function useMatchClock(
  activePlayer: Player7,
  playing: boolean,
  initialMs: number = MATCH_MS_7,
): MatchClock {
  const [p1Ms, setP1Ms] = useState(initialMs);
  const [p2Ms, setP2Ms] = useState(initialMs);
  const activeRef = useRef(activePlayer);
  activeRef.current = activePlayer;

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const who = activeRef.current;
      if (who === "P1") setP1Ms((t) => Math.max(0, t - 100));
      else setP2Ms((t) => Math.max(0, t - 100));
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  const reset = useCallback(() => {
    setP1Ms(initialMs);
    setP2Ms(initialMs);
  }, [initialMs]);

  return {
    p1Ms,
    p2Ms,
    p1Label: formatClock(p1Ms),
    p2Label: formatClock(p2Ms),
    active: playing ? activePlayer : null,
    reset,
  };
}
