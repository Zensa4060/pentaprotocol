import { useCallback, useEffect, useRef, useState } from "react";

import { MATCH_MS_7, formatClock, type Player7 } from "@/lib/game/matchRules7";

export interface MatchClock {
  p1Ms: number;
  p2Ms: number;
  p1Label: string;
  p2Label: string;
  active: Player7 | null;
  reset: (p1Ms?: number, p2Ms?: number) => void;
}

export function useMatchClock(
  activePlayer: Player7,
  playing: boolean,
  initialMs: number = MATCH_MS_7,
  initialP2Ms?: number,
): MatchClock {
  const p2Start = initialP2Ms ?? initialMs;
  const [p1Ms, setP1Ms] = useState(initialMs);
  const [p2Ms, setP2Ms] = useState(p2Start);
  const activeRef = useRef(activePlayer);
  activeRef.current = activePlayer;

  useEffect(() => {
    setP1Ms(initialMs);
    setP2Ms(initialP2Ms ?? initialMs);
  }, [initialMs, initialP2Ms]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const who = activeRef.current;
      if (who === "P1") setP1Ms((t) => Math.max(0, t - 100));
      else setP2Ms((t) => Math.max(0, t - 100));
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  const reset = useCallback(
    (p1?: number, p2?: number) => {
      setP1Ms(p1 ?? initialMs);
      setP2Ms(p2 ?? p2Start);
    },
    [initialMs, p2Start],
  );

  return {
    p1Ms,
    p2Ms,
    p1Label: formatClock(p1Ms),
    p2Label: formatClock(p2Ms),
    active: playing ? activePlayer : null,
    reset,
  };
}
