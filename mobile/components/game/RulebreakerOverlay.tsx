/**
 * In-match Protocol Breaker UI (Rulebreaker / Timebreaker / Mindbreaker).
 * Payload keys align with web ``GameScreen`` / backend ``room.py``.
 */

import { useEffect, useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Btn, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import type { GridSize } from "@/lib/game/boardConfig";
import { patternMetadataForGrid } from "@/lib/game/patterns";
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
  rb6CellChooser?: PlayerSlot | null;
  /** Pass-and-play / local — either player can tap on their turn. */
  localOffline?: boolean;
  onDismiss?: () => void;
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
  rb6CellChooser,
  localOffline = false,
  onDismiss,
  onTossAction,
}: RulebreakerOverlayProps) {
  const title = breakerTitle(boardMode, gameNumber);
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
    body = (
      <>
        <Text style={styles.coin}>{coinResult ?? "…"}</Text>
        <Caption tone="muted">
          {coinResult ? `${tossWinner} wins the toss` : "Flipping…"}
        </Caption>
      </>
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone="accent">{title}</Eyebrow>
          {body}
          {localOffline && onDismiss ? (
            <View style={{ marginTop: space[4], width: "100%" }}>
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
