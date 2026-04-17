"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BOT_MAP, buildChallengeUrl } from "@/lib/routes";

/**
 * Legacy bot-game URL. Bot games now live at /game/g{n}/{15-digit-id}?bot={name}
 * so they share the same coin-toss / game-id flow as singleplayer games.
 * This page just redirects to a freshly-built URL for the same bot.
 */
export default function Challenge5x5Redirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const botname = (params.botname as string || "").toLowerCase();
    const bot = BOT_MAP[botname];
    if (!bot) { router.replace("/challenge"); return; }
    router.replace(buildChallengeUrl(bot.boardMode, bot.difficulty));
  }, [params, router]);

  return null;
}
