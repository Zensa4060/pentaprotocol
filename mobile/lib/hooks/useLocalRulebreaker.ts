/**
 * Offline Protocol Breaker state machine (Rulebreaker / Timebreaker /
 * Mindbreaker). Hosts coin toss locally; bot (P2) auto-picks on its turns.
 *
 * Phase flow mirrors web ``GameScreen`` exactly:
 *  - 5×5: rule_choice → (who_first_winner → c3_choice_loser) | (c3_choice →
 *    who_first_loser) → toss_summary.
 *  - 6×6: rule_choice → [own cell] grid_block_warning → grid_block_selection
 *    → who_first_loser → toss_summary, OR [choose first] who_first_winner →
 *    grid_block_selection (loser owns cell + 1:00 timer) → toss_summary.
 *  - 7×7: rule_choice → ban_pattern_(winner|loser) ×2 → who_first_loser →
 *    toss_summary. Bans hit only the banner's opponent; the non-banner
 *    holds the extra-turn token and the center opening is off.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  winnerPickedRule: string | null;
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
  const patternsKey = useMemo(() => patterns.join("|"), [patterns]);
  const patternsRef = useRef(patterns);
  patternsRef.current = patterns;

  const [phase, setPhase] = useState<RbPhase | null>(null);
  const [tossWinner, setTossWinner] = useState<PlayerSlot | null>(null);
  const [coinResult, setCoinResult] = useState<"PENTA" | "PROTO" | null>(null);
  const [rb6CellChooser, setRb6CellChooser] = useState<PlayerSlot | null>(null);
  const [rb6TimerOwner, setRb6TimerOwner] = useState<PlayerSlot | null>(null);
  const [winnerPickedRule, setWinnerPickedRule] = useState<string | null>(null);
  const [firstPlayerChosen, setFirstPlayerChosen] = useState<PlayerSlot | null>(null);
  const [bannedPatterns, setBannedPatterns] = useState<string[]>([]);
  const [c3Blocked, setC3Blocked] = useState<boolean | null>(null);
  const stateRef = useRef<LocalRbState | null>(null);
  const completedRef = useRef(false);
  const splashDoneRef = useRef(false);
  const coinDoneRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setPhase(null);
      setTossWinner(null);
      setCoinResult(null);
      setRb6CellChooser(null);
      setRb6TimerOwner(null);
      setWinnerPickedRule(null);
      setFirstPlayerChosen(null);
      setBannedPatterns([]);
      setC3Blocked(null);
      stateRef.current = null;
      completedRef.current = false;
      splashDoneRef.current = false;
      coinDoneRef.current = false;
      return;
    }
    completedRef.current = false;
    splashDoneRef.current = false;
    coinDoneRef.current = false;
    const pats = [...patternsRef.current];
    stateRef.current = {
      phase: "rb_splash",
      tossWinner: null,
      coinResult: null,
      firstPlayer: "P1",
      c3Blocked: false,
      winnerPickedRule: null,
      bannedPatterns: [],
      rb6TimerOwner: null,
      rb6CellChooser: null,
      rb6SpecialCell: null,
      activePatterns: pats,
    };
    setPhase("rb_splash");
    setTossWinner(null);
    setCoinResult(null);
    setRb6CellChooser(null);
    setRb6TimerOwner(null);
    setWinnerPickedRule(null);
    setFirstPlayerChosen(null);
    setBannedPatterns([]);
    setC3Blocked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, gameNumber, patternsKey]);

  const finish = useCallback(
    (state: LocalRbState) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const all = [...state.activePatterns];
      const filtered = all.filter((p) => !state.bannedPatterns.includes(p));
      const clocks = clockMsForGameReset(gridSize, gameNumber, state.rb6TimerOwner);

      // Mindbreaker: the banner keeps the full pool; only the opponent
      // loses the banned shapes. Ban actor = toss winner on the "ban"
      // path, toss loser on the "extra_turn" path (web structuralPatterns).
      const tw = state.tossWinner;
      const tl = tw === "P1" ? "P2" : tw === "P2" ? "P1" : null;
      const wr = state.winnerPickedRule;
      const is7 = gridSize === 7;
      const mindbreaker = is7 && (wr === "extra_turn" || wr === "ban");
      let patternsP1: string[] | undefined;
      let patternsP2: string[] | undefined;
      let tokenHolder: SeriesPlayer | null = null;
      if (is7 && state.bannedPatterns.length > 0 && tw && tl) {
        const banActor = wr === "ban" ? tw : tl;
        patternsP1 = banActor === "P1" ? all : filtered;
        patternsP2 = banActor === "P2" ? all : filtered;
      }
      if (mindbreaker && tw && tl) {
        tokenHolder = wr === "extra_turn" ? tw : tl;
      }

      onComplete({
        reset: {
          starter: state.firstPlayer,
          gridSize,
          patterns: filtered.length > 0 ? filtered : patternsRef.current,
          patternsP1,
          patternsP2,
          c3Blocked: state.c3Blocked,
          p1ClockMs: clocks.p1,
          p2ClockMs: clocks.p2,
          rb6SpecialCell: gridSize === 6 ? state.rb6SpecialCell : null,
          suppressCenterOpening: mindbreaker,
          extraTurnTokenHolder: tokenHolder,
        },
      });
      setPhase(null);
    },
    [gameNumber, gridSize, onComplete],
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
    if (typeof payload.winnerPickedRule === "string" || payload.winnerPickedRule === null) {
      s.winnerPickedRule = payload.winnerPickedRule as string | null;
      setWinnerPickedRule(s.winnerPickedRule);
    }
    if (payload.firstPlayerChosen === "P1" || payload.firstPlayerChosen === "P2") {
      s.firstPlayer = payload.firstPlayerChosen;
      setFirstPlayerChosen(payload.firstPlayerChosen);
    }
    if (typeof payload.rbC3Blocked === "boolean") {
      s.c3Blocked = payload.rbC3Blocked;
      setC3Blocked(payload.rbC3Blocked);
    }
    if (Array.isArray(payload.rb_banned_patterns)) {
      s.bannedPatterns = payload.rb_banned_patterns as string[];
      s.activePatterns = patternsRef.current.filter((p) => !s.bannedPatterns.includes(p));
      setBannedPatterns([...s.bannedPatterns]);
    }
    if (payload.rb6TimerOwner === "P1" || payload.rb6TimerOwner === "P2" || payload.rb6TimerOwner === null) {
      s.rb6TimerOwner = payload.rb6TimerOwner as SeriesPlayer | null;
      setRb6TimerOwner(s.rb6TimerOwner);
    }
    if (payload.rb6CellChooser === "P1" || payload.rb6CellChooser === "P2" || payload.rb6CellChooser === null) {
      s.rb6CellChooser = payload.rb6CellChooser as SeriesPlayer | null;
      setRb6CellChooser(s.rb6CellChooser);
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
        setTimeout(() => finish(s), 5000);
      }
    }
  }, [finish]);

  const handleTossAction = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      const s = stateRef.current;
      if (!s) return;

      if (action === "start_rb") {
        applyPayload({ phase: "rb_coin", ...payload });
        return;
      }
      if (action === "coin_result") {
        // Land the coin first (reveal beat), then open the rule choice —
        // jumping straight to rule_choice skipped the toss reveal.
        applyPayload({ phase: "rb_coin", ...payload });
        setTimeout(() => {
          const cur = stateRef.current;
          if (cur && cur.phase === "rb_coin") applyPayload({ phase: "rule_choice" });
        }, 2500);
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

  // Host coin toss locally (do not depend on RulebreakerOverlay mySlot === P1).
  useEffect(() => {
    if (!active || phase !== "rb_splash" || splashDoneRef.current) return;
    const t = setTimeout(() => {
      splashDoneRef.current = true;
      handleTossAction("start_rb", {});
    }, 1600);
    return () => clearTimeout(t);
  }, [active, phase, handleTossAction]);

  useEffect(() => {
    if (!active || phase !== "rb_coin" || coinResult || coinDoneRef.current) return;
    const t = setTimeout(() => {
      coinDoneRef.current = true;
      const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
      handleTossAction("coin_result", {
        result: r,
        toss_winner: r === "PENTA" ? "P1" : "P2",
      });
    }, 2800);
    return () => clearTimeout(t);
  }, [active, phase, coinResult, handleTossAction]);

  const randomPick = useCallback(
    (p: RbPhase) => {
      const s = stateRef.current;
      if (!s) return;
      const tw = s.tossWinner;
      const tl = tw === "P1" ? "P2" : tw === "P2" ? "P1" : null;
      const chooser6 = s.rb6CellChooser ?? tw;

      if (p === "grid_block_warning") {
        handleTossAction("phase_choice", {
          phase: "grid_block_selection",
          rb6TimerOwner: s.rb6TimerOwner ?? tw,
          rb6CellChooser: chooser6,
          winnerPickedRule: s.winnerPickedRule ?? "timer_half",
        });
        return;
      }
      if (p === "grid_block_selection") {
        const cell = {
          r: Math.floor(Math.random() * 6),
          c: Math.floor(Math.random() * 6),
          owner: chooser6,
        };
        // Winner-owned cell (timer_half path): the toss loser still has to
        // pick who plays first. Loser-owned cell (choose_first path): the
        // winner already picked, so the toss resolves now.
        if (s.winnerPickedRule === "timer_half") {
          handleTossAction("phase_choice", {
            phase: "who_first_loser",
            rb6_special_cell: cell,
            rb6TimerOwner: chooser6,
            winnerPickedRule: s.winnerPickedRule,
          });
        } else {
          handleTossAction("phase_choice", {
            phase: "toss_summary",
            rb6_special_cell: cell,
            summaryTimer: 5,
          });
        }
        return;
      }
      if (p === "ban_pattern_winner" || p === "ban_pattern_loser") {
        const avail = s.activePatterns.filter((x) => !s.bannedPatterns.includes(x));
        if (!avail.length) return;
        const pick = avail[Math.floor(Math.random() * avail.length)]!;
        const next = [...s.bannedPatterns, pick];
        const limit = gridSize === 7 ? 2 : 1;
        handleTossAction("phase_choice", {
          phase: next.length >= limit ? "who_first_loser" : p,
          rb_banned_patterns: next,
        });
        return;
      }

      const side = Math.random() < 0.5 ? "left" : "right";
      if (p === "rule_choice") {
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
      if (p === "who_first_winner" && tw) {
        const fp = side === "left" ? tw : tl;
        if (gridSize === 6) {
          const forcedOther = tw === "P1" ? "P2" : "P1";
          handleTossAction("phase_choice", {
            phase: "grid_block_selection",
            firstPlayerChosen: fp,
            rb6TimerOwner: forcedOther,
            rb6CellChooser: forcedOther,
            winnerPickedRule: "choose_first",
          });
        } else {
          handleTossAction("phase_choice", {
            phase: "c3_choice_loser",
            firstPlayerChosen: fp,
          });
        }
        return;
      }
      if (p === "c3_choice") {
        handleTossAction("phase_choice", {
          phase: "who_first_loser",
          rbC3Blocked: side === "left",
          winnerPickedC3: side === "left",
        });
        return;
      }
      if (p === "c3_choice_loser") {
        handleTossAction("phase_choice", {
          phase: "toss_summary",
          rbC3Blocked: side === "left",
          summaryTimer: 5,
        });
        return;
      }
      if (p === "who_first_loser" && tl) {
        const fp = side === "left" ? tl : tw;
        handleTossAction("phase_choice", {
          phase: "toss_summary",
          firstPlayerChosen: fp,
          summaryTimer: 5,
        });
      }
    },
    [gridSize, handleTossAction],
  );

  // Bot auto-picks on P2 turns; pass-and-play uses 30s timeout per choice phase.
  useEffect(() => {
    if (!active || !phase || phase === "rb_splash" || phase === "rb_coin" || phase === "toss_summary") {
      return;
    }
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

    const needsBot =
      botMode &&
      ((winnerPhases.includes(phase) && tw === "P2") ||
        (loserPhases.includes(phase) && tl === "P2") ||
        ((phase === "grid_block_warning" || phase === "grid_block_selection") && chooser6 === "P2"));

    const needsTimeout = !botMode;

    if (!needsBot && !needsTimeout) return;

    const delay = needsBot
      ? 900 + Math.random() * 900
      : phase === "grid_block_selection"
      ? 60_000
      : 30_000;
    const timer = setTimeout(() => randomPick(phase), delay);
    return () => clearTimeout(timer);
  }, [active, botMode, phase, randomPick]);

  return {
    visible: active && phase !== null,
    phase: phase ?? "rb_splash",
    tossWinner,
    coinResult,
    rb6CellChooser,
    rb6TimerOwner,
    winnerPickedRule,
    firstPlayerChosen,
    bannedPatterns,
    c3Blocked,
    boardMode,
    handleTossAction,
  };
}
