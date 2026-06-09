/**
 * Match-found VS splash — shown after queue pairs a human or filler bot.
 */

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";

import { MatchFoundVs } from "@/components/multiplayer/MatchFoundVs";
import { Screen } from "@/components/ui";
import { useGameAudio } from "@/lib/audio/AudioProvider";
import { gridParamFromBoardMode } from "@/lib/game/boardConfig";
import { MATCH_FOUND_HOLD_MS } from "@/lib/unrankedBots";
import { styleForLevel, type UnrankedBotLevel } from "@/lib/unrankedBots";
import { useAuthStore } from "@/lib/store";
import type { PlayerSlot } from "@/lib/multiplayer/types";

export default function MatchFoundScreen() {
  const params = useLocalSearchParams<{
    flow?: string;
    format?: string;
    code?: string;
    slot?: string;
    board_mode?: string;
    opp_name?: string;
    opp_elo?: string;
    opp_level?: string;
    opp_avatar?: string;
    opp_banner?: string;
    opp_placement?: string;
    bot_name?: string;
    bot_tier?: string;
    bot_level?: string;
    bot_emoji?: string;
    bot_banner?: string;
    bot_syros?: string;
    patterns?: string;
  }>();

  const user = useAuthStore((s) => s.user);
  const audio = useGameAudio();
  const armedRef = useRef(false);

  const flow = params.flow === "filler" ? "filler" : "human";
  const format = params.format === "ranked" ? "ranked" : "unranked";
  const isRanked = format === "ranked";

  useEffect(() => {
    if (armedRef.current) return;
    armedRef.current = true;
    audio.sfx.matchFound();

    const timer = setTimeout(() => {
      if (flow === "filler") {
        router.replace({
          pathname: "/engine/match",
          params: {
            unrankedFiller: "1",
            label: params.bot_name ?? "BOT",
            botTier: params.bot_tier ?? "SKILLED",
            botLevel: params.bot_level ?? "1",
            botSyros: params.bot_syros ?? "0",
            patterns: params.patterns ?? "",
          },
        });
        return;
      }

      const code = (params.code ?? "").toUpperCase();
      const slot: PlayerSlot = params.slot === "P2" ? "P2" : "P1";
      router.replace({
        pathname: "/pregame",
        params: {
          mode: "multiplayer",
          code,
          slot,
          grid: gridParamFromBoardMode(params.board_mode),
          board_mode: params.board_mode ?? "5x5_6x6_7x7",
        },
      });
    }, MATCH_FOUND_HOLD_MS);

    return () => clearTimeout(timer);
  }, [
    audio.sfx,
    flow,
    params.board_mode,
    params.bot_level,
    params.bot_name,
    params.bot_syros,
    params.bot_tier,
    params.code,
    params.patterns,
    params.slot,
  ]);

  const me = {
    name: (user?.username ?? "YOU").toUpperCase(),
    level: user?.level ?? 1,
    elo: user?.elo ?? null,
    avatar: user?.avatar,
    banner: user?.banner ?? "default",
    placementMatches: user?.placement_matches ?? 0,
  };

  const opponent =
    flow === "filler"
      ? (() => {
          const tier = (params.bot_tier ?? "SKILLED") as UnrankedBotLevel;
          const style = styleForLevel(tier);
          return {
            name: (params.bot_name ?? "OPPONENT").toUpperCase(),
            level: Number(params.bot_level ?? 1),
            elo: null,
            avatar: null,
            avatarEmoji: params.bot_syros === "1" ? undefined : params.bot_emoji ?? "🎮",
            banner: params.bot_banner ?? "void_rift",
            tierLabel: style.label,
            tierColor: style.color,
            isBot: true,
            isSyros: params.bot_syros === "1",
            placementMatches: 5,
          };
        })()
      : {
          name: (params.opp_name ?? "OPPONENT").toUpperCase(),
          level: Number(params.opp_level ?? 1),
          elo: params.opp_elo ? Number(params.opp_elo) : null,
          avatar: params.opp_avatar || null,
          banner: params.opp_banner ?? "default",
          placementMatches: Number(params.opp_placement ?? 5),
        };

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <MatchFoundVs format={isRanked ? "ranked" : "unranked"} me={me} opponent={opponent} />
    </Screen>
  );
}
