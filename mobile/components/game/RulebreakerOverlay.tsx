/**
 * In-match Protocol Breaker UI (Rulebreaker / Timebreaker / Mindbreaker).
 * Payload keys align with web ``GameScreen`` / backend ``room.py``.
 *
 * Phase flow (web ``RulebreakerFlow`` parity):
 *  - 5×5 Rulebreaker: decide first player / block C3.
 *  - 6×6 Timebreaker: toss winner picks OWN SPECIAL GRID CELL (warning →
 *    1:00 timer → secret cell select → loser picks who plays first) or
 *    CHOOSE WHO WILL PLAY FIRST (loser gets the cell + 1:00 timer).
 *  - 7×7 Mindbreaker: toss winner picks EXTRA TURN TOKEN or BAN A PATTERN;
 *    the other side automatically gets the remaining perk. Bans (2) hit only
 *    the banner's opponent and stay hidden from them; the toss loser always
 *    picks who plays first.
 *
 * Full-screen takeover: the coin toss spins the real PENTA / PROTO coin
 * faces on a Y-axis flip and reveals the winning face.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { PatternDiagram } from "@/components/game/PatternDiagram";
import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import { TOSS_SKIN_GLOW, useTossSkin } from "@/lib/cosmetics/tossSkin";
import { boardModeFromGrid, isCorePatternId, type GridSize } from "@/lib/game/boardConfig";
import { patternMetadataForGrid } from "@/lib/game/patterns";
import { breakerTitle, type RbPhase } from "@/lib/multiplayer/rulebreakerPhases";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

const PENTA_COIN = require("../../assets/images/penta-coin.png");
const PROTO_COIN = require("../../assets/images/proto-coin.png");

/** PENTA face colour (P1) / PROTO face colour (P2) — mirror web p1c/p2c. */
const PENTA_COLOR = "#E53935";
const PROTO_COLOR = "#42A5F5";

/** Per-phase choice windows (web ``PHASE_TIMERS``). */
const PHASE_TIMERS: Partial<Record<RbPhase, number>> = {
  rule_choice: 30,
  who_first_winner: 30,
  c3_choice: 30,
  c3_choice_loser: 30,
  who_first_loser: 30,
  ban_pattern_winner: 30,
  ban_pattern_loser: 30,
  grid_block_warning: 30,
  grid_block_selection: 60,
};

interface RulebreakerOverlayProps {
  visible: boolean;
  phase: RbPhase;
  boardMode: string;
  gameNumber: number;
  mySlot: PlayerSlot;
  tossWinner: PlayerSlot | null;
  coinResult: "PENTA" | "PROTO" | null;
  gridSize: GridSize;
  rb6CellChooser?: PlayerSlot | null;
  rb6TimerOwner?: PlayerSlot | null;
  /** Rule the toss winner picked (timer_half / choose_first / extra_turn / ban / first / c3). */
  winnerPickedRule?: string | null;
  firstPlayerChosen?: PlayerSlot | null;
  /** Patterns banned so far (Mindbreaker). */
  bannedPatterns?: string[];
  /** 5×5: C3 blocked outcome for the summary card. */
  c3Blocked?: boolean | null;
  /** Hide banned pattern names from this viewer (banner's opponent). */
  hideBannedFromMe?: boolean;
  /** Active win-pattern pool offered on the ban screen. */
  selectedPatterns?: string[];
  /** Pass-and-play / local — either player can tap on their turn. */
  localOffline?: boolean;
  /** Display names for the toss legend (default P1 / P2). */
  p1Name?: string;
  p2Name?: string;
  onDismiss?: () => void;
  onTossAction: (action: string, payload: Record<string, unknown>) => void;
}

/**
 * Spinning coin — two coin faces back-to-back, each with backface culling,
 * rotating on Y. When ``result`` lands we stop and show the winning face.
 * Shared with the Limitbreaker overlays.
 */
export function CoinFlip({ result, size }: { result: "PENTA" | "PROTO" | null; size: number }) {
  const [tossSkin] = useTossSkin();
  const skinGlow = TOSS_SKIN_GLOW[tossSkin];
  const spin = useRef(new Animated.Value(0)).current;
  const revealScale = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (result) {
      spin.stopAnimation();
      revealScale.setValue(0.7);
      Animated.timing(revealScale, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }).start();
      return;
    }
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 650,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [result, revealScale, spin]);

  const half = size / 2;

  if (result) {
    const winCol = skinGlow ?? (result === "PENTA" ? PENTA_COLOR : PROTO_COLOR);
    return (
      <Animated.View
        style={{
          transform: [{ scale: revealScale }],
          borderRadius: half,
          shadowColor: winCol,
          shadowOpacity: 0.8,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 0 },
          elevation: 24,
        }}
      >
        <Image
          source={result === "PENTA" ? PENTA_COIN : PROTO_COIN}
          style={{ width: size, height: size, borderRadius: half }}
          resizeMode="cover"
        />
      </Animated.View>
    );
  }

  const frontRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const backRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "540deg"] });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.Image
        source={PENTA_COIN}
        resizeMode="cover"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          backfaceVisibility: "hidden",
          transform: [{ perspective: 900 }, { rotateY: frontRotate }],
        }}
      />
      <Animated.Image
        source={PROTO_COIN}
        resizeMode="cover"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: half,
          backfaceVisibility: "hidden",
          transform: [{ perspective: 900 }, { rotateY: backRotate }],
        }}
      />
    </View>
  );
}

export function RulebreakerOverlay({
  visible,
  phase,
  boardMode: _boardMode,
  gameNumber,
  mySlot,
  tossWinner,
  coinResult,
  gridSize,
  rb6CellChooser,
  rb6TimerOwner,
  winnerPickedRule,
  firstPlayerChosen,
  bannedPatterns,
  c3Blocked,
  hideBannedFromMe = false,
  selectedPatterns,
  localOffline = false,
  p1Name = "P1",
  p2Name = "P2",
  onDismiss,
  onTossAction,
}: RulebreakerOverlayProps) {
  const { width: screenWidth } = useWindowDimensions();
  const coinSize = Math.min(Math.round(screenWidth * 0.58), 240);
  // Title always follows the grid in play — boardMode can be a compound
  // mode string mid-leg, the grid never lies.
  const title = breakerTitle(boardModeFromGrid(gridSize), gameNumber);
  const titleColor =
    gridSize === 6 ? "#c4b5fd" : gridSize === 7 ? "#EF4444" : "#22d3ee";
  const nameOf = (slot: PlayerSlot) => (slot === "P1" ? p1Name : p2Name);
  const colorOf = (slot: PlayerSlot) => (slot === "P1" ? PENTA_COLOR : PROTO_COLOR);
  const tossLoser: PlayerSlot | null =
    tossWinner === "P1" ? "P2" : tossWinner === "P2" ? "P1" : null;
  const chooser6: PlayerSlot | null = rb6CellChooser ?? tossWinner ?? null;

  const winnerPhases: RbPhase[] = ["rule_choice", "who_first_winner", "c3_choice", "ban_pattern_winner"];
  const loserPhases: RbPhase[] = ["c3_choice_loser", "who_first_loser", "ban_pattern_loser"];
  const actorForPhase: PlayerSlot | null =
    phase === "grid_block_warning" || phase === "grid_block_selection"
      ? chooser6
      : winnerPhases.includes(phase)
      ? tossWinner
      : loserPhases.includes(phase)
      ? tossLoser
      : null;
  const canAct = localOffline ? actorForPhase !== null : actorForPhase === mySlot;

  const banLimit = gridSize === 7 ? 2 : 1;
  const bansSoFar = bannedPatterns ?? [];
  const patternMeta = patternMetadataForGrid(gridSize);
  // LINE / DIAGONAL are core rules — always active, never bannable.
  const banPool = (
    selectedPatterns && selectedPatterns.length > 0
      ? selectedPatterns
      : Object.keys(patternMeta)
  ).filter((p) => !isCorePatternId(p));

  const [choiceTimer, setChoiceTimer] = useState(30);
  const [summaryTimer, setSummaryTimer] = useState(5);
  const timedOutPhaseRef = useRef<RbPhase | null>(null);

  useEffect(() => {
    const max = PHASE_TIMERS[phase];
    if (max !== undefined) {
      setChoiceTimer(max);
      const iv = setInterval(() => setChoiceTimer((v) => Math.max(0, v - 1)), 1000);
      return () => clearInterval(iv);
    }
    if (phase === "toss_summary") {
      setSummaryTimer(5);
      const iv = setInterval(() => setSummaryTimer((v) => Math.max(0, v - 1)), 1000);
      return () => clearInterval(iv);
    }
  }, [phase]);

  const broadcastPhase = (ph: string, extra: Record<string, unknown> = {}) => {
    onTossAction("phase_choice", { phase: ph, ...extra });
  };

  // ── Choice handlers (broadcast payload keys mirror web GameScreen) ──

  const pickRuleChoice = (side: "left" | "right") => {
    if (!tossWinner || !tossLoser) return;
    if (gridSize === 7) {
      const pre = [...banPool];
      if (side === "left") {
        broadcastPhase("ban_pattern_loser", {
          winnerPickedRule: "extra_turn",
          rbHideBannedPatternFromSlot: tossWinner,
          rbPatternsPreBan: pre,
        });
      } else {
        broadcastPhase("ban_pattern_winner", {
          winnerPickedRule: "ban",
          rbHideBannedPatternFromSlot: tossLoser,
          rbPatternsPreBan: pre,
        });
      }
      return;
    }
    if (gridSize === 6) {
      if (side === "left") {
        broadcastPhase("grid_block_warning", {
          winnerPickedRule: "timer_half",
          rb6TimerOwner: tossWinner,
          rb6CellChooser: tossWinner,
        });
      } else {
        broadcastPhase("who_first_winner", { winnerPickedRule: "choose_first" });
      }
      return;
    }
    if (side === "left") {
      broadcastPhase("who_first_winner", { winnerPickedRule: "first" });
    } else {
      broadcastPhase("c3_choice", { winnerPickedRule: "c3" });
    }
  };

  const pickFirst = (who: "self" | "opponent") => {
    if (!tossWinner || !tossLoser) return;
    const fp = who === "self" ? tossWinner : tossLoser;
    if (gridSize === 7) {
      broadcastPhase("ban_pattern_loser", { firstPlayerChosen: fp, winnerPickedFirst: fp });
      return;
    }
    if (gridSize === 6) {
      // Winner chose who plays first → the LOSER owns the special cell
      // and plays the round with the 1:00 timer.
      const forcedOther = tossWinner === "P1" ? "P2" : "P1";
      broadcastPhase("grid_block_selection", {
        firstPlayerChosen: fp,
        winnerPickedFirst: fp,
        rb6TimerOwner: forcedOther,
        rb6CellChooser: forcedOther,
        winnerPickedRule: "choose_first",
      });
      return;
    }
    broadcastPhase("c3_choice_loser", {
      firstPlayerChosen: fp,
      winnerPickedFirst: fp,
    });
  };

  const pickC3 = (block: boolean) => {
    broadcastPhase("who_first_loser", {
      rbC3Blocked: block,
      winnerPickedC3: block,
    });
  };

  const pickC3Loser = (block: boolean) => {
    broadcastPhase("toss_summary", {
      rbC3Blocked: block,
      summaryTimer: 5,
    });
  };

  const pickWhoFirstLoser = (who: "self" | "opponent") => {
    if (!tossWinner || !tossLoser) return;
    const fp = who === "self" ? tossLoser : tossWinner;
    broadcastPhase("toss_summary", {
      firstPlayerChosen: fp,
      summaryTimer: 5,
      ...(rb6TimerOwner ? { rb6TimerOwner } : null),
    });
  };

  const pickBanPattern = (patternId: string) => {
    if (bansSoFar.includes(patternId)) return;
    const next = [...bansSoFar, patternId];
    if (next.length >= banLimit) {
      broadcastPhase("who_first_loser", { rb_banned_patterns: next });
    } else {
      broadcastPhase(phase, { rb_banned_patterns: next });
    }
  };

  const pickSpecialCell = (r: number, c: number) => {
    if (!chooser6) return;
    const cell = { r, c, owner: chooser6 };
    if (winnerPickedRule === "timer_half" || chooser6 === tossWinner) {
      // Winner-owned cell: the toss loser still chooses who plays first.
      broadcastPhase("who_first_loser", {
        rb6_special_cell: cell,
        rb6TimerOwner: chooser6,
        winnerPickedRule: winnerPickedRule ?? "timer_half",
      });
    } else {
      broadcastPhase("toss_summary", {
        rb6_special_cell: cell,
        summaryTimer: 5,
      });
    }
  };

  const confirmGridBlockWarning = () => {
    broadcastPhase("grid_block_selection", {
      rb6TimerOwner: rb6TimerOwner ?? tossWinner,
      rb6CellChooser: chooser6,
      winnerPickedRule: winnerPickedRule ?? "timer_half",
    });
  };

  const changeRuleChoice = () => {
    broadcastPhase("rule_choice", {
      winnerPickedRule: null,
      rb6TimerOwner: null,
      rb6CellChooser: null,
    });
  };

  // ── Actor-side timeout auto-pick (multiplayer / vs-bot; pass-and-play
  // timeouts live in useLocalRulebreaker) ─────────────────────────────
  useEffect(() => {
    if (localOffline) return;
    if (choiceTimer > 0) return;
    if (!canAct) return;
    if (PHASE_TIMERS[phase] === undefined) return;
    if (timedOutPhaseRef.current === phase) return;
    timedOutPhaseRef.current = phase;

    if (phase === "grid_block_warning") {
      confirmGridBlockWarning();
    } else if (phase === "grid_block_selection") {
      pickSpecialCell(Math.floor(Math.random() * 6), Math.floor(Math.random() * 6));
    } else if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
      const avail = banPool.filter((p) => !bansSoFar.includes(p));
      if (avail.length > 0) pickBanPattern(avail[Math.floor(Math.random() * avail.length)]!);
    } else if (phase === "rule_choice") {
      pickRuleChoice(Math.random() < 0.5 ? "left" : "right");
    } else if (phase === "who_first_winner") {
      pickFirst(Math.random() < 0.5 ? "self" : "opponent");
    } else if (phase === "c3_choice") {
      pickC3(Math.random() < 0.5);
    } else if (phase === "c3_choice_loser") {
      pickC3Loser(Math.random() < 0.5);
    } else if (phase === "who_first_loser") {
      pickWhoFirstLoser(Math.random() < 0.5 ? "self" : "opponent");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceTimer, phase, canAct, localOffline]);

  useEffect(() => {
    if (PHASE_TIMERS[phase] !== undefined && timedOutPhaseRef.current !== phase) {
      timedOutPhaseRef.current = null;
    }
  }, [phase]);

  // ── Phase bodies ─────────────────────────────────────────────────────

  let body: ReactNode = null;

  const actorName = actorForPhase ? nameOf(actorForPhase) : "";
  const actorColor = actorForPhase ? colorOf(actorForPhase) : colors.accent;

  const TimerBar = ({ label }: { label: string }) => {
    const max = PHASE_TIMERS[phase] ?? 30;
    const pct = max > 0 ? Math.max(0, choiceTimer / max) : 0;
    const urgent = choiceTimer <= 10;
    return (
      <View style={styles.timerBlock}>
        <View style={styles.timerHead}>
          <Caption tone="muted">{label}</Caption>
          <Text style={[styles.timerValue, { color: urgent ? colors.danger : actorColor }]}>
            {choiceTimer}s
          </Text>
        </View>
        <View style={styles.timerTrack}>
          <View
            style={[
              styles.timerFill,
              {
                width: `${pct * 100}%`,
                backgroundColor: urgent ? colors.danger : actorColor,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const WaitingNote = ({ text }: { text: string }) => (
    <View style={styles.waitingNote}>
      <Caption tone="muted">{text}</Caption>
    </View>
  );

  if (phase === "rb_splash") {
    body = (
      <>
        <Title style={StyleSheet.flatten([styles.splashTitle, { color: titleColor }])}>{title}</Title>
        <View style={[styles.splashRule, { backgroundColor: titleColor }]} />
      </>
    );
  } else if (phase === "rb_coin") {
    const winCol = coinResult === "PENTA" ? PENTA_COLOR : PROTO_COLOR;
    body = (
      <View style={styles.coinStage}>
        <Text style={styles.commencing}>COMMENCING</Text>
        <View style={styles.commencingRule} />
        <View style={styles.coinLegend}>
          <View style={styles.coinLegendItem}>
            <Image source={PENTA_COIN} style={styles.coinLegendIcon} resizeMode="cover" />
            <Caption tone="muted">PENTA = {p1Name}</Caption>
          </View>
          <Caption tone="muted">|</Caption>
          <View style={styles.coinLegendItem}>
            <Image source={PROTO_COIN} style={styles.coinLegendIcon} resizeMode="cover" />
            <Caption tone="muted">PROTO = {p2Name}</Caption>
          </View>
        </View>
        <View style={{ marginVertical: space[6] }}>
          <CoinFlip result={coinResult} size={coinSize} />
        </View>
        {coinResult ? (
          <>
            <Text style={[styles.coinResultLabel, { color: winCol }]}>{coinResult}</Text>
            <Text style={styles.tossWinnerLine}>
              <Text style={{ color: winCol }}>{tossWinner ? nameOf(tossWinner) : ""}</Text>
              <Text style={{ color: colors.textMuted }}> WINS THE TOSS</Text>
            </Text>
          </>
        ) : (
          <Caption tone="muted">Flipping…</Caption>
        )}
      </View>
    );
  } else if (phase === "rule_choice") {
    const labels =
      gridSize === 7
        ? { left: "Extra turn\ntoken", right: "Ban a\npattern" }
        : gridSize === 6
        ? { left: "Own special\ngrid cell", right: "Choose who\nwill play first" }
        : { left: "Decide who\nplays first", right: "Block C3\nfirst move" };
    body = (
      <>
        <Heading style={styles.phaseTitle}>
          {tossWinner ? `${nameOf(tossWinner)} WON THE TOSS — CHOOSE YOUR RULE` : "CHOOSE YOUR RULE"}
        </Heading>
        <TimerBar label={`${actorName} IS CHOOSING`} />
        {canAct ? (
          <TossCards
            left={labels.left}
            right={labels.right}
            color={actorColor}
            onLeft={() => pickRuleChoice("left")}
            onRight={() => pickRuleChoice("right")}
          />
        ) : (
          <WaitingNote text={`Waiting for ${actorName}…`} />
        )}
      </>
    );
  } else if (phase === "who_first_winner") {
    body = (
      <>
        <Heading style={styles.phaseTitle}>
          {tossWinner ? `${nameOf(tossWinner)} — WHO PLAYS FIRST IN ROUND 3?` : "WHO PLAYS FIRST?"}
        </Heading>
        <TimerBar label={`${actorName} IS CHOOSING`} />
        {canAct && tossWinner && tossLoser ? (
          <TossCards
            left={`${nameOf(tossWinner)}\nplays first`}
            right={`${nameOf(tossLoser)}\nplays first`}
            color={actorColor}
            onLeft={() => pickFirst("self")}
            onRight={() => pickFirst("opponent")}
          />
        ) : (
          <WaitingNote text={`Waiting for ${actorName}…`} />
        )}
      </>
    );
  } else if (phase === "c3_choice" || phase === "c3_choice_loser") {
    const isLoser = phase === "c3_choice_loser";
    body = (
      <>
        <Heading style={styles.phaseTitle}>{`${actorName} — CHOOSE C3 RULE`}</Heading>
        {isLoser && firstPlayerChosen ? (
          <Caption tone="muted" style={{ textAlign: "center" }}>
            {tossWinner ? `${nameOf(tossWinner)} already chose — plays first: ${nameOf(firstPlayerChosen)}` : ""}
          </Caption>
        ) : null}
        <TimerBar label={`${actorName} IS CHOOSING`} />
        {canAct ? (
          <TossCards
            left={"Block C3"}
            right={"Allow C3"}
            color={actorColor}
            onLeft={() => (isLoser ? pickC3Loser(true) : pickC3(true))}
            onRight={() => (isLoser ? pickC3Loser(false) : pickC3(false))}
          />
        ) : (
          <WaitingNote text={`Waiting for ${actorName}…`} />
        )}
      </>
    );
  } else if (phase === "who_first_loser") {
    body = (
      <>
        <Heading style={styles.phaseTitle}>
          {tossLoser ? `${nameOf(tossLoser)} — CHOOSE WHO PLAYS FIRST (ROUND 3)` : "WHO PLAYS FIRST?"}
        </Heading>
        {gridSize === 6 && rb6TimerOwner ? (
          <Caption tone="muted" style={{ textAlign: "center" }}>
            {nameOf(rb6TimerOwner)} took the special cell and plays with a 1:00 timer.
          </Caption>
        ) : null}
        {gridSize === 7 && bansSoFar.length > 0 ? (
          <Caption tone="muted" style={{ textAlign: "center" }}>
            {hideBannedFromMe
              ? "Opponent banned 2 patterns — hidden for the full game."
              : `Banned: ${bansSoFar
                  .map((p) => patternMeta[p]?.label ?? p.toUpperCase())
                  .join(", ")}`}
          </Caption>
        ) : null}
        <TimerBar label={`${actorName} IS CHOOSING`} />
        {canAct && tossWinner && tossLoser ? (
          <TossCards
            left={`${nameOf(tossLoser)}\nplays first`}
            right={`${nameOf(tossWinner)}\nplays first`}
            color={actorColor}
            onLeft={() => pickWhoFirstLoser("self")}
            onRight={() => pickWhoFirstLoser("opponent")}
          />
        ) : (
          <WaitingNote text={`Waiting for ${actorName}…`} />
        )}
      </>
    );
  } else if (phase === "grid_block_warning") {
    body = (
      <>
        <Heading style={StyleSheet.flatten([styles.phaseTitle, { color: actorColor }])}>
          WARNING — {actorName} WILL PLAY WITH 1:00 TIMER
        </Heading>
        <Caption tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
          You chose <Caption tone="accent">OWN SPECIAL GRID CELL</Caption>. Your timer is
          reduced to 1:00 in Round 3. Continue to select your secret cell.
        </Caption>
        <TimerBar label="CONFIRM WINDOW" />
        {canAct ? (
          <View style={{ width: "100%", gap: space[3], marginTop: space[3] }}>
            <Btn variant="primary" onPress={confirmGridBlockWarning}>
              Continue to cell select
            </Btn>
            <Btn variant="secondary" onPress={changeRuleChoice}>
              Change rule choice
            </Btn>
          </View>
        ) : (
          <WaitingNote text={`Waiting for ${actorName} to confirm…`} />
        )}
      </>
    );
  } else if (phase === "grid_block_selection") {
    body = canAct ? (
      <>
        <Heading style={styles.phaseTitle}>{`${actorName} — CHOOSE SPECIAL GRID CELL`}</Heading>
        <Caption tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
          Tap one cell. It stays hidden from opponent; any stone there always counts as{" "}
          {actorName}&apos;s symbol.
        </Caption>
        <TimerBar label="TIME" />
        <SpecialCellGrid color={actorColor} onPick={pickSpecialCell} />
      </>
    ) : (
      <>
        <Heading style={styles.phaseTitle}>Other player is choosing their option</Heading>
        <Caption tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
          Wait until they finish selecting their special grid cell. You will then choose who
          plays first (or see the toss summary).
        </Caption>
      </>
    );
  } else if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
    body = canAct ? (
      <>
        <Heading style={styles.phaseTitle}>
          {`${actorName} — BAN ${banLimit === 2 ? "TWO PATTERNS" : "ONE PATTERN"}`}
        </Heading>
        <Caption tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
          Choose {banLimit === 2 ? "two patterns" : "one pattern"} to remove from Round 3 —
          they stop counting as win conditions for your opponent only. ({bansSoFar.length}/
          {banLimit}) Your ban stays hidden from them for the entire game.
        </Caption>
        <TimerBar label={`${actorName} IS CHOOSING`} />
        <ScrollView style={{ maxHeight: 380, width: "100%" }} contentContainerStyle={styles.banGrid}>
          {banPool.map((p) => {
            const info = patternMeta[p];
            const isBanned = bansSoFar.includes(p);
            return (
              <Pressable
                key={p}
                disabled={isBanned}
                onPress={() => pickBanPattern(p)}
                style={({ pressed }) => [
                  styles.banCard,
                  isBanned && styles.banCardBanned,
                  pressed && !isBanned && { borderColor: colors.danger },
                ]}
              >
                {info ? (
                  <PatternDiagram info={info} accent={isBanned ? colors.danger : actorColor} cellSize={7} />
                ) : null}
                <Caption style={{ marginTop: space[2], fontWeight: "800", textAlign: "center" }}>
                  {info?.label ?? p.toUpperCase()}
                </Caption>
                <Caption tone={isBanned ? "muted" : "danger"} style={{ marginTop: 2 }}>
                  {isBanned ? "SELECTED" : "BAN"}
                </Caption>
              </Pressable>
            );
          })}
        </ScrollView>
      </>
    ) : (
      <>
        <Heading style={styles.phaseTitle}>Other player is banning patterns</Heading>
        <Caption tone="muted" style={{ textAlign: "center", lineHeight: 20 }}>
          Wait until they finish selecting which win conditions to remove for Round 3. Their
          ban stays hidden from you for the entire game.
        </Caption>
        <TimerBar label={`${actorName} IS CHOOSING`} />
      </>
    );
  } else if (phase === "toss_summary") {
    body = (
      <>
        <Title style={styles.summaryTitle}>ROUND 3 RULES</Title>
        <Caption tone="muted" style={{ letterSpacing: 2 }}>
          PREPARING FOR COMMENCEMENT...
        </Caption>
        <View style={styles.summaryCards}>
          {(["P1", "P2"] as const).map((p) => (
            <SummaryCard
              key={p}
              slot={p}
              name={nameOf(p)}
              color={colorOf(p)}
              isWinner={p === tossWinner}
              isMe={!localOffline && p === mySlot}
              gridSize={gridSize}
              winnerPickedRule={winnerPickedRule ?? null}
              firstPlayerChosen={firstPlayerChosen ?? null}
              rb6TimerOwner={rb6TimerOwner ?? null}
              c3Blocked={c3Blocked ?? null}
              bansSoFar={bansSoFar}
              hideBannedFromMe={hideBannedFromMe}
              patternMeta={patternMeta}
              nameOf={nameOf}
            />
          ))}
        </View>
        <View style={styles.battlePill}>
          <Caption tone="accent" style={{ fontWeight: "800", letterSpacing: 1.5 }}>
            BATTLE STARTS IN {Math.max(1, summaryTimer)}S
          </Caption>
        </View>
      </>
    );
  } else {
    body = (
      <Caption tone="muted">
        {phase.replace(/_/g, " ").toUpperCase()} — waiting…
      </Caption>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          {phase !== "rb_splash" && phase !== "toss_summary" ? (
            <Eyebrow tone="accent">{title}</Eyebrow>
          ) : null}
          {body}
          {localOffline && onDismiss ? (
            <View style={{ marginTop: space[5], width: "100%" }}>
              <Btn variant="ghost" onPress={onDismiss}>
                Back to menu
              </Btn>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TossCards({
  left,
  right,
  color,
  onLeft,
  onRight,
}: {
  left: string;
  right: string;
  color: string;
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <View style={styles.tossCards}>
      {[
        { label: left, onPress: onLeft },
        { label: right, onPress: onRight },
      ].map(({ label, onPress }, i) => (
        <Pressable
          key={i}
          onPress={onPress}
          style={({ pressed }) => [
            styles.tossCard,
            pressed && { borderColor: color, backgroundColor: `${color}14` },
          ]}
        >
          <Text style={styles.tossCardLabel}>{label.toUpperCase()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SpecialCellGrid({
  color,
  onPick,
}: {
  color: string;
  onPick: (r: number, c: number) => void;
}) {
  const cell = 38;
  const cols = ["A", "B", "C", "D", "E", "F"];
  return (
    <View style={{ marginTop: space[3], alignItems: "center" }}>
      <View style={{ flexDirection: "row", marginLeft: 20 }}>
        {cols.map((l) => (
          <Text key={l} style={[styles.gridAxisLabel, { width: cell + 4, color }]}>
            {l}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.gridAxisLabel, { width: 20, color }]}>{r + 1}</Text>
          {Array.from({ length: 6 }, (_, c) => (
            <Pressable
              key={c}
              onPress={() => onPick(r, c)}
              style={({ pressed }) => [
                {
                  width: cell,
                  height: cell,
                  margin: 2,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: pressed ? color : colors.border,
                  backgroundColor: `${color}12`,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function SummaryCard({
  slot,
  name,
  color,
  isWinner,
  isMe,
  gridSize,
  winnerPickedRule,
  firstPlayerChosen,
  rb6TimerOwner,
  c3Blocked,
  bansSoFar,
  hideBannedFromMe,
  patternMeta,
  nameOf,
}: {
  slot: PlayerSlot;
  name: string;
  color: string;
  isWinner: boolean;
  isMe: boolean;
  gridSize: GridSize;
  winnerPickedRule: string | null;
  firstPlayerChosen: PlayerSlot | null;
  rb6TimerOwner: PlayerSlot | null;
  c3Blocked: boolean | null;
  bansSoFar: string[];
  hideBannedFromMe: boolean;
  patternMeta: Record<string, { label: string }>;
  nameOf: (slot: PlayerSlot) => string;
}) {
  const fp = firstPlayerChosen;
  const banLabels = bansSoFar.map((p) => patternMeta[p]?.label ?? p.toUpperCase());

  let pill = "RULE SELECTED";
  const lines: string[] = [];

  if (gridSize === 7 && (winnerPickedRule === "extra_turn" || winnerPickedRule === "ban")) {
    const holderIsMe =
      (winnerPickedRule === "extra_turn" && isWinner) ||
      (winnerPickedRule === "ban" && !isWinner);
    if (holderIsMe) {
      pill = "EXTRA TURN TOKEN";
      lines.push("One bonus consecutive move later · center opening off");
      if (winnerPickedRule === "ban" && fp) {
        lines.push(`Plays first: ${nameOf(fp)}`);
      }
    } else {
      pill = "PATTERNS BANNED";
      const showNames = !hideBannedFromMe;
      lines.push(
        banLabels.length > 0
          ? `Banned: ${showNames ? banLabels.join(", ") : "? (hidden)"}`
          : "Banned: —",
      );
      if (winnerPickedRule === "extra_turn" && fp) {
        lines.push(`Plays first: ${nameOf(fp)}`);
      }
    }
  } else if (gridSize === 6) {
    const ownsTimer = rb6TimerOwner === slot;
    if (ownsTimer) {
      pill = "TIMER & SPECIAL CELL";
      lines.push(`Timer 1:00: ${name}`, `Special cell: ${name}`);
    } else {
      pill = "PLAYS FIRST";
      lines.push(`Plays first: ${fp ? nameOf(fp) : "—"}`);
    }
  } else {
    const winnerPickedFirstTurn = winnerPickedRule === "first";
    const showsFirst = isWinner === winnerPickedFirstTurn;
    if (showsFirst) {
      pill = "PLAYS FIRST";
      lines.push(`Plays first: ${fp ? nameOf(fp) : "—"}`);
    } else {
      pill = c3Blocked ? "CENTER BLOCKED" : "CENTER ALLOWED";
      lines.push(c3Blocked === null ? "C3 choice locked" : `C3: ${c3Blocked ? "BLOCKED" : "ALLOWED"}`);
    }
  }

  return (
    <View
      style={[
        styles.summaryCard,
        { borderColor: isMe ? color : `${color}55`, opacity: isMe ? 1 : 0.82 },
      ]}
    >
      <Text style={[styles.summaryName, { color }]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.summaryPill, { borderColor: `${color}66` }]}>
        <Text style={[styles.summaryPillText, { color }]}>{pill}</Text>
      </View>
      <Caption tone="muted" style={{ letterSpacing: 1.5 }}>
        {isWinner ? "TOSS WINNER" : "TOSS LOSER"}
        {isMe ? "  [YOU]" : ""}
      </Caption>
      <View style={styles.summaryDetail}>
        {lines.map((l, i) => (
          <Caption key={i} style={{ textAlign: "center", lineHeight: 18 }}>
            {l}
          </Caption>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen takeover, parity with web RulebreakerFlow (opaque bg, not
  // a small floating card).
  backdrop: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: space[5],
  },
  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    alignItems: "center",
    gap: space[3],
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 3,
    marginVertical: space[4],
    textAlign: "center",
  },
  splashRule: {
    width: 220,
    height: 2,
    opacity: 0.7,
    borderRadius: 1,
  },
  phaseTitle: {
    textAlign: "center",
    letterSpacing: 0.5,
  },
  coinStage: {
    width: "100%",
    alignItems: "center",
    marginTop: space[4],
  },
  commencing: {
    color: colors.accent,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 3,
  },
  commencingRule: {
    width: 180,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.6,
    marginTop: space[2],
    marginBottom: space[4],
    borderRadius: 1,
  },
  coinLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    flexWrap: "wrap",
    justifyContent: "center",
  },
  coinLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
  },
  coinLegendIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  coinResultLabel: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 4,
    marginBottom: space[2],
  },
  tossWinnerLine: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
  },
  timerBlock: {
    width: "100%",
    gap: 4,
    marginTop: space[2],
  },
  timerHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  timerTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    borderRadius: 3,
  },
  waitingNote: {
    marginTop: space[4],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  tossCards: {
    width: "100%",
    gap: space[3],
    marginTop: space[3],
  },
  tossCard: {
    width: "100%",
    minHeight: 96,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    padding: space[4],
  },
  tossCardLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    lineHeight: 24,
  },
  banGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: space[2],
    paddingBottom: space[2],
  },
  banCard: {
    width: 104,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    paddingVertical: space[3],
    paddingHorizontal: space[2],
  },
  banCardBanned: {
    borderColor: colors.danger,
    opacity: 0.6,
  },
  gridAxisLabel: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
  },
  summaryTitle: {
    textAlign: "center",
    letterSpacing: 2,
  },
  summaryCards: {
    width: "100%",
    gap: space[3],
    marginTop: space[3],
  },
  summaryCard: {
    width: "100%",
    borderRadius: radii.lg,
    borderWidth: 2,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    padding: space[4],
    gap: space[2],
  },
  summaryName: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  summaryPill: {
    borderWidth: 1.5,
    borderRadius: radii.md,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
  },
  summaryPillText: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  summaryDetail: {
    width: "100%",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: space[3],
    gap: 4,
    alignItems: "center",
  },
  battlePill: {
    marginTop: space[4],
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    paddingVertical: space[2],
    paddingHorizontal: space[5],
    backgroundColor: colors.bgCard,
  },
});
