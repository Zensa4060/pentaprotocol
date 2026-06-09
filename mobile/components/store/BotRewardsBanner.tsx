import { StyleSheet, View } from "react-native";

import { Body, Caption, Eyebrow } from "@/components/ui";
import { REWARD_SLOT_LABEL } from "@/lib/botRewards";
import { hasPendingBotReward, readBotRewards } from "@/lib/botRewardClaims";
import type { User } from "@/lib/types";
import { colors, radii, space } from "@/theme/tokens";

export function BotRewardsBanner({ user }: { user: User | null | undefined }) {
  const rewards = readBotRewards(user);
  if (!hasPendingBotReward(rewards)) return null;

  const lines: string[] = [];
  if (rewards.banner === "pending") lines.push(REWARD_SLOT_LABEL.banner);
  if (rewards.coin_toss === "pending") lines.push(REWARD_SLOT_LABEL.coin_toss);
  if (rewards.board_skin === "pending") lines.push(REWARD_SLOT_LABEL.board_skin);
  if (rewards.syros_skin === "pending") lines.push(REWARD_SLOT_LABEL.syros_skin);

  return (
    <View style={styles.box}>
      <Eyebrow tone="accent">FREE BOT REWARDS</Eyebrow>
      <Body style={{ marginTop: space[2] }}>
        You have unclaimed rewards from beating AI bots. Tap CLAIM FREE on eligible items below.
      </Body>
      <Caption tone="muted" style={{ marginTop: space[2] }}>
        {lines.join(" · ")}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.bgRaised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[4],
    marginBottom: space[4],
  },
});
