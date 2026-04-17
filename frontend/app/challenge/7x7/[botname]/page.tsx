"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BOT_MAP, buildChallengeUrl } from "@/lib/routes";

export default function Challenge7x7Redirect() {
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
