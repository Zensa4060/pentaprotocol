/**
 * In-match Protocol Breaker UI (Rulebreaker / Timebreaker / Mindbreaker).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import type { GridSize } from "@/lib/game/boardConfig";
import { breakerTitle, type RbPhase } from "@/lib/multiplayer/rulebreakerPhases";
import type { PlayerSlot } from "@/lib/multiplayer/types";
import { colors, radii, space } from "@/theme/tokens";

interface RulebreakerOverlayProps {
  visible: boolean;
  phase: RbPhase;
  boardMode: string;
  gameNumber: number;
  mySlot: PlayerSlot;
  tossWinner: PlayerSlot | null;
  coinResult: "PENTA" | "PROTO" | null;
  gridSize: GridSize;
  onTossAction: (action: string, payload: Record<string, unknown>) => void;
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
  onTossAction,
}: RulebreakerOverlayProps) {
  const title = breakerTitle(boardMode, gameNumber);
  const isWinner = tossWinner === mySlot;
  const splashSent = useRef(false);
  const coinSent = useRef(false);
  const [choiceTimer, setChoiceTimer] = useState(30);

  useEffect(() => {
    if (!visible || phase !== "rb_splash") {
      splashSent.current = false;
      return;
    }
    if (mySlot !== "P1" || splashSent.current) return;
    const t = setTimeout(() => {
      splashSent.current = true;
      onTossAction("start_rb", {});
    }, 800);
    return () => clearTimeout(t);
  }, [visible, phase, mySlot, onTossAction]);

  useEffect(() => {
    if (!visible || phase !== "rb_coin" || coinResult) {
      coinSent.current = false;
      return;
    }
    if (mySlot !== "P1" || coinSent.current) return;
    const t = setTimeout(() => {
      coinSent.current = true;
      const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
      onTossAction("coin_result", {
        result: r,
        toss_winner: r === "PENTA" ? "P1" : "P2",
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [visible, phase, coinResult, mySlot, onTossAction]);

  useEffect(() => {
    if (phase === "rule_choice" || phase.startsWith("ban_") || phase.startsWith("who_")) {
      setChoiceTimer(30);
      const iv = setInterval(() => setChoiceTimer((v) => Math.max(0, v - 1)), 1000);
      return () => clearInterval(iv);
    }
  }, [phase]);

  const pickRuleChoice = (side: "left" | "right") => {
    if (gridSize === 7) {
      const rule = side === "left" ? "extra_turn" : "ban";
      onTossAction("phase_choice", {
        phase: "ban_pattern_winner",
        winnerPickedRule: rule,
      });
      return;
    }
    if (gridSize === 6) {
      if (side === "left") {
        onTossAction("phase_choice", {
          phase: "grid_block_warning",
          winnerPickedRule: "timer",
          rb6TimerOwner: mySlot === "P1" ? "P2" : "P1",
        });
      } else {
        onTossAction("phase_choice", {
          phase: "grid_block_selection",
          winnerPickedRule: "trap",
          rb6CellChooser: mySlot,
        });
      }
      return;
    }
    const rule = side === "left" ? "center_block" : "force_first";
    onTossAction("phase_choice", {
      phase: "who_first_winner",
      winnerPickedRule: rule,
    });
  };

  const pickFirst = (who: "self" | "opponent") => {
    const fp = who === "self" ? mySlot : mySlot === "P1" ? "P2" : "P1";
    onTossAction("phase_choice", {
      phase: "toss_summary",
      firstPlayerChosen: fp,
      summaryTimer: 5,
    });
  };

  const pickBanPattern = (patternId: string) => {
    onTossAction("phase_choice", {
      phase: "toss_summary",
      rb_banned_patterns: [patternId],
      winnerPickedRule: "ban",
      firstPlayerChosen: tossWinner,
      summaryTimer: 5,
    });
  };

  let body: ReactNode = null;

  if (phase === "rb_splash") {
    body = (
      <>
        <Title style={styles.splashTitle}>{title}</Title>
        <Caption tone="muted">Preparing coin toss…</Caption>
      </>
    );
  } else if (phase === "rb_coin") {
    body = (
      <>
        <Text style={styles.coin}>{coinResult ?? "…"}</Text>
        <Caption tone="muted">
          {coinResult ? `${tossWinner} wins the toss` : "Flipping…"}
        </Caption>
      </>
    );
  } else if (phase === "rule_choice" && isWinner) {
    body = (
      <>
        <Heading>Your choice · {choiceTimer}s</Heading>
        {gridSize === 5 ? (
          <RowChoices
            left="Center block"
            right="Force opponent first"
            onLeft={() => pickRuleChoice("left")}
            onRight={() => pickRuleChoice("right")}
          />
        ) : gridSize === 6 ? (
          <RowChoices
            left="Cut opponent clock to 1:00"
            right="Secret trap cell"
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
  } else if (phase === "who_first_winner" && isWinner) {
    body = (
      <RowChoices
        left="You go first"
        right="Opponent first"
        onLeft={() => pickFirst("self")}
        onRight={() => pickFirst("opponent")}
      />
    );
  } else if (phase === "ban_pattern_winner" && isWinner) {
    const patterns = gridSize === 7
      ? ["Y", "L", "T", "V", "zigzag"]
      : ["ZZ", "T", "L"];
    body = (
      <View style={{ gap: space[2], width: "100%" }}>
        <Heading>Ban a pattern</Heading>
        {patterns.map((p) => (
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
              onPress={() => onTossAction("rb_start_game", { first_player: tossWinner ?? "P1" })}
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
        {phase.replace(/_/g, " ").toUpperCase()} — follow prompts…
      </Caption>
    );
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone="accent">{title}</Eyebrow>
          {body}
        </View>
      </View>
    </Modal>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[6],
    alignItems: "center",
  },
  splashTitle: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginVertical: space[4],
  },
  coin: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.text,
    marginVertical: space[4],
  },
});
