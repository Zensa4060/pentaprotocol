/**
 * Offline Limitbreaker (Protocolbreaker) — coin toss + board bans + G10 start.
 */

import { useCallback, useEffect, useState } from "react";

import type { BoardMode } from "@/lib/game/boardConfig";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import type { GameResetOptions, SeriesPlayer } from "./seriesConfig";

export type LbPhase = "coin" | "choice" | "pick_first" | "ban_first" | "ban_second" | "summary";

export interface LimitbreakerOutcome {
  reset: GameResetOptions;
}

interface UseLocalLimitbreakerOptions {
  active: boolean;
  botMode: boolean;
  onComplete: (outcome: LimitbreakerOutcome) => void;
}

const ALL_MODES: BoardMode[] = ["5x5", "6x6", "7x7"];

export function useLocalLimitbreaker({
  active,
  botMode,
  onComplete,
}: UseLocalLimitbreakerOptions) {
  const [phase, setPhase] = useState<LbPhase | null>(null);
  const [tossWinner, setTossWinner] = useState<PlayerSlot | null>(null);
  const [coinResult, setCoinResult] = useState<"PENTA" | "PROTO" | null>(null);
  const [choice, setChoice] = useState<"choose_first_player" | "ban_first" | null>(null);
  const [firstPlayer, setFirstPlayer] = useState<SeriesPlayer>("P1");
  const [bans, setBans] = useState<BoardMode[]>([]);
  const [nextSlot, setNextSlot] = useState<PlayerSlot>("P1");

  useEffect(() => {
    if (!active) {
      setPhase(null);
      setTossWinner(null);
      setCoinResult(null);
      setChoice(null);
      setBans([]);
      return;
    }
    setPhase("coin");
    setTossWinner(null);
    setCoinResult(null);
    setChoice(null);
    setBans([]);
    setNextSlot("P1");
  }, [active]);

  useEffect(() => {
    if (!active || phase !== "coin" || coinResult) return;
    const t = setTimeout(() => {
      const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
      const tw: PlayerSlot = r === "PENTA" ? "P1" : "P2";
      setCoinResult(r);
      setTossWinner(tw);
      setNextSlot(tw);
      setPhase("choice");
    }, 2800);
    return () => clearTimeout(t);
  }, [active, phase, coinResult]);

  const remainingBoard = useCallback((): BoardMode => {
    const left = ALL_MODES.filter((m) => !bans.includes(m));
    return left[0] ?? "5x5";
  }, [bans]);

  const finish = useCallback(() => {
    const mode = remainingBoard();
    const gridSize = mode === "5x5" ? 5 : mode === "6x6" ? 6 : 7;
    onComplete({
      reset: {
        starter: firstPlayer,
        gridSize,
      },
    });
    setPhase(null);
  }, [firstPlayer, onComplete, remainingBoard]);

  const pickChoice = useCallback(
    (c: "choose_first_player" | "ban_first") => {
      if (!tossWinner || nextSlot !== tossWinner) return;
      setChoice(c);
      setPhase(c === "choose_first_player" ? "pick_first" : "ban_first");
      setNextSlot(c === "choose_first_player" ? tossWinner : tossWinner === "P1" ? "P2" : "P1");
    },
    [nextSlot, tossWinner],
  );

  const pickFirst = useCallback(
    (fp: SeriesPlayer) => {
      setFirstPlayer(fp);
      if (choice === "choose_first_player") {
        setPhase("ban_first");
        setNextSlot(tossWinner === "P1" ? "P2" : "P1");
      } else {
        setPhase("ban_second");
        setNextSlot(tossWinner ?? "P1");
      }
    },
    [choice, tossWinner],
  );

  const pickBan = useCallback(
    (mode: BoardMode) => {
      if (bans.includes(mode)) return;
      const next = [...bans, mode];
      setBans(next);
      if (next.length >= 2) {
        setPhase("summary");
        setTimeout(finish, 800);
        return;
      }
      if (choice === "ban_first") {
        setPhase("pick_first");
        setNextSlot(tossWinner === "P1" ? "P2" : "P1");
      } else {
        setPhase("ban_second");
        setNextSlot(tossWinner ?? "P1");
      }
    },
    [bans, choice, finish, tossWinner],
  );

  // Bot auto-picks on P2 turns.
  useEffect(() => {
    if (!active || !botMode || !phase || phase === "coin" || phase === "summary") return;
    if (nextSlot !== "P2") return;
    const t = setTimeout(() => {
      if (phase === "choice") {
        pickChoice(Math.random() < 0.5 ? "choose_first_player" : "ban_first");
      } else if (phase === "pick_first") {
        pickFirst(Math.random() < 0.5 ? "P2" : "P1");
      } else if (phase === "ban_first" || phase === "ban_second") {
        const avail = ALL_MODES.filter((m) => !bans.includes(m));
        if (avail.length) pickBan(avail[Math.floor(Math.random() * avail.length)]!);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [active, bans, botMode, phase, nextSlot, pickBan, pickChoice, pickFirst]);

  return {
    visible: active && phase !== null,
    phase,
    tossWinner,
    coinResult,
    choice,
    firstPlayer,
    bans,
    nextSlot,
    remainingBoard: remainingBoard(),
    pickChoice,
    pickFirst,
    pickBan,
    finish,
  };
}
