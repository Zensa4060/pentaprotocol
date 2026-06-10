/**
 * In-match Protocol Breaker UI (Rulebreaker / Timebreaker / Mindbreaker).
 * Payload keys align with web ``GameScreen`` / backend ``room.py``.
 *
 * Full-screen takeover (mirrors web ``RulebreakerFlow``): the coin toss
 * spins the real PENTA / PROTO coin faces on a Y-axis flip and reveals the
 * winning face, instead of the old small text-only card.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import { TOSS_SKIN_GLOW, useTossSkin } from "@/lib/cosmetics/tossSkin";
import type { GridSize } from "@/lib/game/boardConfig";
import { patternMetadataForGrid } from "@/lib/game/patterns";
import { breakerTitle, type RbPhase } from "@/lib/multiplayer/rulebreakerPhases";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, space } from "@/theme/tokens";

const PENTA_COIN = require("../../assets/images/penta-coin.png");
const PROTO_COIN = require("../../assets/images/proto-coin.png");

/** PENTA face colour (P1) / PROTO face colour (P2) — mirror web p1c/p2c. */
const PENTA_COLOR = "#E53935";
const PROTO_COLOR = "#42A5F5";

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
  boardMode,
  gameNumber,
  mySlot,
  tossWinner,
  coinResult,
  gridSize,
  rb6CellChooser,
  localOffline = false,
  p1Name = "P1",
  p2Name = "P2",
  onDismiss,
  onTossAction,
}: RulebreakerOverlayProps) {
  const { width: screenWidth } = useWindowDimensions();
  const coinSize = Math.min(Math.round(screenWidth * 0.58), 240);
  const title = breakerTitle(boardMode, gameNumber);
  const nameOf = (slot: PlayerSlot) => (slot === "P1" ? p1Name : p2Name);
  const tossLoser = tossWinner === "P1" ? "P2" : tossWinner === "P2" ? "P1" : null;
  const activeChooser: PlayerSlot | null =
    phase === "c3_choice_loser" || phase === "who_first_loser" || phase === "ban_pattern_loser"
      ? tossLoser
      : phase === "grid_block_warning" || phase === "grid_block_selection"
      ? rb6CellChooser ?? tossWinner
      : tossWinner;
  const canAct = localOffline
    ? activeChooser !== null
    : tossWinner === mySlot || (tossLoser === mySlot && (phase.includes("loser") || phase === "c3_choice_loser"));
  const isWinner = localOffline ? activeChooser === tossWinner : tossWinner === mySlot;
  const [choiceTimer, setChoiceTimer] = useState(30);
  const [bannedSoFar, setBannedSoFar] = useState<string[]>([]);

  useEffect(() => {
    if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
      setBannedSoFar([]);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "rule_choice" || phase.startsWith("ban_") || phase.startsWith("who_") || phase.startsWith("c3_") || phase.startsWith("grid_block")) {
      setChoiceTimer(30);
      const iv = setInterval(() => setChoiceTimer((v) => Math.max(0, v - 1)), 1000);
      return () => clearInterval(iv);
    }
  }, [phase]);

  const broadcastPhase = (ph: string, extra: Record<string, unknown> = {}) => {
    onTossAction("phase_choice", { phase: ph, ...extra });
  };

  const pickRuleChoice = (side: "left" | "right") => {
    if (gridSize === 7) {
      if (side === "left") {
        broadcastPhase("ban_pattern_loser", { winnerPickedRule: "extra_turn" });
      } else {
        broadcastPhase("ban_pattern_winner", { winnerPickedRule: "ban" });
      }
      return;
    }
    if (gridSize === 6) {
      if (side === "left" && tossWinner) {
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
    const fp = who === "self" ? tossWinner : tossLoser;
    if (gridSize === 6 && tossWinner) {
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
    const fp = who === "self" ? tossLoser : tossWinner;
    broadcastPhase("toss_summary", {
      firstPlayerChosen: fp,
      summaryTimer: 5,
    });
  };

  const pickBanPattern = (patternId: string) => {
    const next = [...bannedSoFar, patternId];
    setBannedSoFar(next);
    const limit = gridSize === 7 ? 2 : 1;
    if (next.length >= limit) {
      broadcastPhase("who_first_loser", { rb_banned_patterns: next });
    } else {
      broadcastPhase(phase, { rb_banned_patterns: next });
    }
  };

  const pickTrapCell = (r: number, c: number) => {
    const chooser = rb6CellChooser ?? tossWinner;
    if (!chooser) return;
    broadcastPhase("toss_summary", {
      rb6_special_cell: { r, c, owner: chooser },
      summaryTimer: 5,
    });
  };

  const confirmGridBlockWarning = () => {
    broadcastPhase("grid_block_selection", {
      rb6TimerOwner: tossWinner,
      rb6CellChooser: rb6CellChooser ?? tossWinner,
      winnerPickedRule: "timer_half",
    });
  };

  const patternKeys = Object.keys(patternMetadataForGrid(gridSize === 7 ? 7 : gridSize === 6 ? 6 : 5));

  let body: ReactNode = null;

  if (phase === "rb_splash") {
    body = (
      <>
        <Title style={styles.splashTitle}>{title}</Title>
        <Caption tone="muted">Preparing coin toss…</Caption>
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
  } else if (phase === "rule_choice" && (localOffline ? canAct && isWinner : isWinner)) {
    body = (
      <>
        <Heading>Your choice · {choiceTimer}s</Heading>
        {gridSize === 5 ? (
          <RowChoices
            left="Choose who goes first"
            right="Center block (C3) rule"
            onLeft={() => pickRuleChoice("left")}
            onRight={() => pickRuleChoice("right")}
          />
        ) : gridSize === 6 ? (
          <RowChoices
            left="Cut opponent clock to 1:00"
            right="Choose who goes first"
            onLeft={() => pickRuleChoice("left")}
            onRight={() => pickRuleChoice("right")}
          />
        ) : (
          <RowChoices
            left="Extra-turn token"
            right="Ban a pattern"
            onLeft={() => pickRuleChoice("left")}
            onRight={() => pickRuleChoice("right")}
          />
        )}
      </>
    );
  } else if (phase === "rule_choice") {
    body = <Caption tone="muted">Waiting for toss winner to choose…</Caption>;
  } else if (phase === "who_first_winner" && (localOffline ? canAct && isWinner : isWinner)) {
    body = (
      <>
        <Heading>Who goes first? · {choiceTimer}s</Heading>
        <RowChoices
          left="You go first"
          right="Opponent first"
          onLeft={() => pickFirst("self")}
          onRight={() => pickFirst("opponent")}
        />
      </>
    );
  } else if (phase === "c3_choice" && (localOffline ? canAct && isWinner : isWinner)) {
    body = (
      <>
        <Heading>Center rule · {choiceTimer}s</Heading>
        <RowChoices
          left="Block center (C3)"
          right="Allow 2 extra turns on center"
          onLeft={() => pickC3(true)}
          onRight={() => pickC3(false)}
        />
      </>
    );
  } else if (phase === "c3_choice_loser" && (localOffline ? canAct : tossLoser === mySlot)) {
    body = (
      <>
        <Heading>Center rule · {choiceTimer}s</Heading>
        <RowChoices
          left="Block center (C3)"
          right="Allow 2 extra turns on center"
          onLeft={() => pickC3Loser(true)}
          onRight={() => pickC3Loser(false)}
        />
      </>
    );
  } else if (phase === "who_first_loser" && (localOffline ? canAct : tossLoser === mySlot)) {
    body = (
      <>
        <Heading>Who goes first? · {choiceTimer}s</Heading>
        <RowChoices
          left="You go first"
          right="Opponent first"
          onLeft={() => pickWhoFirstLoser("self")}
          onRight={() => pickWhoFirstLoser("opponent")}
        />
      </>
    );
  } else if (phase === "grid_block_warning" && (localOffline ? canAct : (rb6CellChooser ?? tossWinner) === mySlot)) {
    body = (
      <>
        <Heading>Timer halved · pick trap cell next</Heading>
        <Caption tone="muted">Opponent clock will be cut to 1:00.</Caption>
        <View style={{ marginTop: space[4], width: "100%" }}>
          <Btn variant="primary" onPress={confirmGridBlockWarning}>
            Continue to cell pick
          </Btn>
        </View>
      </>
    );
  } else if (phase === "grid_block_selection" && (localOffline ? canAct : (rb6CellChooser ?? tossWinner) === mySlot)) {
    body = (
      <>
        <Heading>Pick trap cell · {choiceTimer}s</Heading>
        <Caption tone="muted">Tap a cell — opponent loses if they play here.</Caption>
        <TrapGrid size={6} onPick={pickTrapCell} />
      </>
    );
  } else if (
    (phase === "ban_pattern_winner" && (localOffline ? canAct && isWinner : isWinner)) ||
    (phase === "ban_pattern_loser" && (localOffline ? canAct : tossLoser === mySlot))
  ) {
    body = (
      <View style={{ gap: space[2], width: "100%" }}>
        <Heading>
          Ban {gridSize === 7 ? `${bannedSoFar.length + 1}/2` : "a"} pattern · {choiceTimer}s
        </Heading>
        {patternKeys
          .filter((p) => !bannedSoFar.includes(p))
          .map((p) => (
            <Btn key={p} variant="secondary" onPress={() => pickBanPattern(p)}>
              Ban {p}
            </Btn>
          ))}
      </View>
    );
  } else if (phase === "toss_summary") {
    body = (
      <>
        <Heading>Rules locked</Heading>
        <Caption tone="muted">Starting next game…</Caption>
        {isWinner && mySlot === "P1" ? (
          <View style={{ marginTop: space[4] }}>
            <Btn
              variant="primary"
              onPress={() =>
                onTossAction("rb_start_game", { first_player: tossWinner ?? "P1" })
              }
            >
              Start game
            </Btn>
          </View>
        ) : null}
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
          <Eyebrow tone="accent">{title}</Eyebrow>
          {body}
          {localOffline && onDismiss ? (
            <View style={{ marginTop: space[5], width: "100%" }}>
              <Btn variant="secondary" onPress={onDismiss}>
                Back to menu
              </Btn>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TrapGrid({ size, onPick }: { size: number; onPick: (r: number, c: number) => void }) {
  const cell = 28;
  return (
    <View style={{ marginTop: space[4], alignItems: "center" }}>
      {Array.from({ length: size }, (_, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {Array.from({ length: size }, (_, c) => (
            <Pressable
              key={c}
              onPress={() => onPick(r, c)}
              style={{
                width: cell,
                height: cell,
                margin: 2,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: colors.borderAccent,
                backgroundColor: colors.bg,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function RowChoices({
  left,
  right,
  onLeft,
  onRight,
}: {
  left: string;
  right: string;
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <View style={{ width: "100%", gap: space[3], marginTop: space[4] }}>
      <Btn variant="primary" onPress={onLeft}>
        {left}
      </Btn>
      <Btn variant="secondary" onPress={onRight}>
        {right}
      </Btn>
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
  },
  splashTitle: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
    marginVertical: space[4],
    textAlign: "center",
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
});
