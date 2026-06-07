/**
 * Bot defeat reward toast — XP and store unlock after series win.
 */

import { Modal, StyleSheet, View } from "react-native";

import { Btn, Body, Caption, Eyebrow, Heading, Title } from "@/components/ui";
import {
  BOT_LABEL,
  BOT_XP_REWARD,
  REWARD_SLOT_LABEL,
  rewardSlotForBot,
  type BotId,
} from "@/lib/botRewards";
import { colors, radii, space } from "@/theme/tokens";

interface BotRewardOverlayProps {
  visible: boolean;
  botId: BotId | null;
  xpAwarded: number;
  rewardUnlocked: string | null;
  onDismiss: () => void;
}

export function BotRewardOverlay({
  visible,
  botId,
  xpAwarded,
  rewardUnlocked,
  onDismiss,
}: BotRewardOverlayProps) {
  if (!botId) return null;
  const botLabel = BOT_LABEL[botId];
  const maxXp = BOT_XP_REWARD[botId] ?? 0;
  const slot = rewardUnlocked as keyof typeof REWARD_SLOT_LABEL | null;
  const prizeLabel = slot && REWARD_SLOT_LABEL[slot] ? REWARD_SLOT_LABEL[slot] : null;
  const capstoneSlot = rewardSlotForBot(botId);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Eyebrow tone="accent">VICTORY REWARD</Eyebrow>
          <Title style={styles.title}>{botLabel} DEFEATED</Title>
          {xpAwarded > 0 ? (
            <Heading tone="accent" style={{ marginTop: space[4] }}>
              +{xpAwarded.toLocaleString()} XP
            </Heading>
          ) : maxXp > 0 ? (
            <Caption tone="muted" style={{ marginTop: space[3] }}>
              XP already claimed for this bot
            </Caption>
          ) : null}
          {prizeLabel ? (
            <Body style={{ marginTop: space[4], textAlign: "center" }}>
              {prizeLabel} unlocked — redeem in the Store!
            </Body>
          ) : capstoneSlot ? (
            <Caption tone="muted" style={{ marginTop: space[3] }}>
              First defeat unlocks a free {REWARD_SLOT_LABEL[capstoneSlot]} in the Store.
            </Caption>
          ) : null}
          <View style={{ marginTop: space[6], width: "100%" }}>
            <Btn variant="primary" onPress={onDismiss}>
              Continue
            </Btn>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  card: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[6],
    alignItems: "center",
  },
  title: {
    marginTop: space[2],
    textAlign: "center",
  },
});
