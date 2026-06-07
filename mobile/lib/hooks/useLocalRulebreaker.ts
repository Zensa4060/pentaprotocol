/**
 * Offline Protocol Breaker state machine (Rulebreaker / Timebreaker /
 * Mindbreaker). P1 hosts the coin toss; bot (P2) auto-picks when it is
 * the toss winner or active chooser.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { GridSize } from "@/lib/game/boardConfig";
import { clockMsForGameReset } from "@/lib/hooks/seriesConfig";
import { isRbPhase, type RbPhase } from "@/lib/multiplayer/rulebreakerPhases";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import type { GameResetOptions, SeriesPlayer } from "./seriesConfig";

export interface RulebreakerOutcome {
  reset: GameResetOptions;
}

interface LocalRbState {
  phase: RbPhase;
  tossWinner: PlayerSlot | null;
  coinResult: "PENTA" | "PROTO" | null;
  firstPlayer: SeriesPlayer;
  c3Blocked: boolean;
  bannedPatterns: string[];
  rb6TimerOwner: SeriesPlayer | null;
  rb6CellChooser: SeriesPlayer | null;
  rb6SpecialCell: { r: number; c: number; owner: SeriesPlayer } | null;
  activePatterns: string[];
}

interface UseLocalRulebreakerOptions {
  active: boolean;
  gridSize: GridSize;
  gameNumber: number;
  boardMode: string;
  patterns: string[];
  /** When true, P2 (bot) makes random choices on its turns. */
  botMode: boolean;
  onComplete: (outcome: RulebreakerOutcome) => void;
}

export function useLocalRulebreaker({
  active,
  gridSize,
  gameNumber,
  boardMode,
  patterns,
  botMode,
  onComplete,
}: UseLocalRulebreakerOptions) {
  const [phase, setPhase] = useState<RbPhase | null>(null);
  const [tossWinner, setTossWinner] = useState<PlayerSlot | null>(null);
  const [coinResult, setCoinResult] = useState<"PENTA" | "PROTO" | null>(null);
  const [rb6CellChooser, setRb6CellChooser] = useState<PlayerSlot | null>(null);
  const stateRef = useRef<LocalRbState | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setPhase(null);
      setTossWinner(null);
      setCoinResult(null);
      setRb6CellChooser(null);
      stateRef.current = null;
      completedRef.current = false;
      return;
    }
    completedRef.current = false;
    stateRef.current = {
      phase: "rb_splash",
      tossWinner: null,
      coinResult: null,
      firstPlayer: "P1",
      c3Blocked: false,
      bannedPatterns: [],
      rb6TimerOwner: null,
      rb6CellChooser: null,
      rb6SpecialCell: null,
      activePatterns: [...patterns],
    };
    setPhase("rb_splash");
    setTossWinner(null);
    setCoinResult(null);
    setRb6CellChooser(null);
  }, [active, gameNumber, patterns]);

  const finish = useCallback(
    (state: LocalRbState) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const filtered = state.activePatterns.filter((p) => !state.bannedPatterns.includes(p));
      const clocks = clockMsForGameReset(gridSize, gameNumber, state.rb6TimerOwner);
      onComplete({
        reset: {
          starter: state.firstPlayer,
          gridSize,
          patterns: filtered.length > 0 ? filtered : patterns,
          c3Blocked: state.c3Blocked,
          p1ClockMs: clocks.p1,
          p2ClockMs: clocks.p2,
        },
      });
      setPhase(null);
    },
    [gameNumber, gridSize, onComplete, patterns],
  );

  const applyPayload = useCallback((payload: Record<string, unknown>) => {
    const s = stateRef.current;
    if (!s) return;
    if (payload.toss_winner === "P1" || payload.toss_winner === "P2") {
      s.tossWinner = payload.toss_winner;
      setTossWinner(payload.toss_winner);
    }
    if (payload.result === "PENTA" || payload.result === "PROTO") {
      s.coinResult = payload.result;
      setCoinResult(payload.result);
    }
    if (payload.firstPlayerChosen === "P1" || payload.firstPlayerChosen === "P2") {
      s.firstPlayer = payload.firstPlayerChosen;
    }
    if (typeof payload.rbC3Blocked === "boolean") s.c3Blocked = payload.rbC3Blocked;
    if (Array.isArray(payload.rb_banned_patterns)) {
      s.bannedPatterns = payload.rb_banned_patterns as string[];
      s.activePatterns = patterns.filter((p) => !s.bannedPatterns.includes(p));
    }
    if (payload.rb6TimerOwner === "P1" || payload.rb6TimerOwner === "P2") {
      s.rb6TimerOwner = payload.rb6TimerOwner;
    }
    if (payload.rb6CellChooser === "P1" || payload.rb6CellChooser === "P2") {
      s.rb6CellChooser = payload.rb6CellChooser;
      setRb6CellChooser(payload.rb6CellChooser);
    }
    if (
      payload.rb6_special_cell &&
      typeof payload.rb6_special_cell === "object" &&
      payload.rb6_special_cell !== null
    ) {
      const cell = payload.rb6_special_cell as { r?: number; c?: number; owner?: SeriesPlayer };
      if (typeof cell.r === "number" && typeof cell.c === "number" && cell.owner) {
        s.rb6SpecialCell = { r: cell.r, c: cell.c, owner: cell.owner };
      }
    }
    if (typeof payload.phase === "string" && isRbPhase(payload.phase)) {
      s.phase = payload.phase;
      setPhase(payload.phase);
      if (payload.phase === "toss_summary") {
        setTimeout(() => finish(s), 1200);
      }
    }
  }, [finish, patterns]);

  const handleTossAction = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      const s = stateRef.current;
      if (!s) return;

      if (action === "start_rb") {
        applyPayload({ phase: "rb_coin", ...payload });
        return;
      }
      if (action === "coin_result") {
        applyPayload({ phase: "rule_choice", ...payload });
        return;
      }
      if (action === "phase_choice") {
        applyPayload(payload);
        return;
      }
      if (action === "rb_start_game") {
        const fp =
          payload.first_player === "P1" || payload.first_player === "P2"
            ? payload.first_player
            : s.firstPlayer;
        s.firstPlayer = fp;
        finish(s);
      }
    },
    [applyPayload, finish],
  );

  // Bot auto-picks on P2's decision turns (mirrors web GameScreen bot RB effect).
  useEffect(() => {
    if (!active || !botMode || !phase || phase === "rb_splash" || phase === "rb_coin") return;
    const s = stateRef.current;
    if (!s) return;
    const tw = s.tossWinner;
    const tl = tw === "P1" ? "P2" : tw === "P2" ? "P1" : null;
    const chooser6 = s.rb6CellChooser ?? tw;

    const winnerPhases: RbPhase[] = [
      "rule_choice",
      "who_first_winner",
      "c3_choice",
      "ban_pattern_winner",
    ];
    const loserPhases: RbPhase[] = [
      "c3_choice_loser",
      "who_first_loser",
      "ban_pattern_loser",
    ];

    const botTurn =
      (winnerPhases.includes(phase) && tw === "P2") ||
      (loserPhases.includes(phase) && tl === "P2") ||
      ((phase === "grid_block_warning" || phase === "grid_block_selection") && chooser6 === "P2");

    if (!botTurn) return;

    const delay = 900 + Math.random() * 900;
    const timer = setTimeout(() => {
      if (phase === "grid_block_warning") {
        handleTossAction("phase_choice", {
          phase: "grid_block_selection",
          rb6TimerOwner: tw,
          rb6CellChooser: chooser6,
          winnerPickedRule: "timer_half",
        });
        return;
      }
      if (phase === "grid_block_selection") {
        handleTossAction("phase_choice", {
          phase: "toss_summary",
          rb6_special_cell: {
            r: Math.floor(Math.random() * 6),
            c: Math.floor(Math.random() * 6),
            owner: chooser6,
          },
          summaryTimer: 5,
        });
        return;
      }
      if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
        const avail = s.activePatterns.filter((p) => !s.bannedPatterns.includes(p));
        if (!avail.length) return;
        const pick = avail[Math.floor(Math.random() * avail.length)]!;
        const next = [...s.bannedPatterns, pick];
        const limit = gridSize === 7 ? 2 : 1;
        handleTossAction("phase_choice", {
          phase: next.length >= limit ? "who_first_loser" : phase,
          rb_banned_patterns: next,
        });
        return;
      }

      // Generic left/right pick — delegate through overlay-equivalent payloads
      const side = Math.random() < 0.5 ? "left" : "right";
      if (phase === "rule_choice") {
        if (gridSize === 7) {
          handleTossAction("phase_choice", {
            phase: side === "left" ? "ban_pattern_loser" : "ban_pattern_winner",
            winnerPickedRule: side === "left" ? "extra_turn" : "ban",
          });
        } else if (gridSize === 6) {
          if (side === "left" && tw) {
            handleTossAction("phase_choice", {
              phase: "grid_block_warning",
              winnerPickedRule: "timer_half",
              rb6TimerOwner: tw,
              rb6CellChooser: tw,
            });
          } else {
            handleTossAction("phase_choice", {
              phase: "who_first_winner",
              winnerPickedRule: "choose_first",
            });
          }
        } else if (side === "left") {
          handleTossAction("phase_choice", {
            phase: "who_first_winner",
            winnerPickedRule: "first",
          });
        } else {
          handleTossAction("phase_choice", { phase: "c3_choice", winnerPickedRule: "c3" });
        }
        return;
      }
      if (phase === "who_first_winner" && tw) {
        const fp = side === "left" ? tw : tl;
        if (gridSize === 6) {
          const forcedOther = tw === "P1" ? "P2" : "P1";
          handleTossAction("phase_choice", {
            phase: "grid_block_selection",
            firstPlayerChosen: fp,
            rb6TimerOwner: forcedOther,
            rb6CellChooser: forcedOther,
          });
        } else {
          handleTossAction("phase_choice", {
            phase: "c3_choice_loser",
            firstPlayerChosen: fp,
          });
        }
        return;
      }
      if (phase === "c3_choice") {
        handleTossAction("phase_choice", {
          phase: "who_first_loser",
          rbC3Blocked: side === "left",
          winnerPickedC3: side === "left",
        });
        return;
      }
      if (phase === "c3_choice_loser") {
        handleTossAction("phase_choice", {
          phase: "toss_summary",
          rbC3Blocked: side === "left",
          summaryTimer: 5,
        });
        return;
      }
      if (phase === "who_first_loser" && tl) {
        const fp = side === "left" ? tl : tw;
        handleTossAction("phase_choice", {
          phase: "toss_summary",
          firstPlayerChosen: fp,
          summaryTimer: 5,
        });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [active, botMode, gridSize, handleTossAction, phase]);

  return {
    visible: active && phase !== null,
    phase: phase ?? "rb_splash",
    tossWinner,
    coinResult,
    rb6CellChooser,
    boardMode,
    handleTossAction,
  };
}
