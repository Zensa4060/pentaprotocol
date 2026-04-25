"use client";

import { useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import GameScreen from "@/components/GameScreen";
import { useApp } from "@/components/AppShell";
import { BOT_MAP, parseMatchPath } from "@/lib/routes";
import type { BoardMode } from "@/lib/types";
import type { Difficulty } from "@/lib/botEngine";
import {
  UNRANKED_5X5_PATTERN_POOL,
  UNRANKED_BOT_LEVELS,
  difficultyForLevel,
  type CoreBoardSize,
  type UnrankedBotLevel,
} from "@/lib/unrankedBots";

type LastGameRouteRef = {
  boardMode: BoardMode;
  variant?: string;
};

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  const ctx = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastGameRouteRef = useRef<LastGameRouteRef | null>(null);

  const matchInfo = useMemo(() => parseMatchPath(pathname), [pathname]);
  if (!matchInfo) return <>{children}</>;

  if (matchInfo.phasePath === "game" && matchInfo.boardMode) {
    lastGameRouteRef.current = {
      boardMode: matchInfo.boardMode,
      variant: matchInfo.variant,
    };
  }

  const inferredBoardMode = matchInfo.boardMode ?? lastGameRouteRef.current?.boardMode ?? ctx.boardMode ?? "5x5";
  const inferredVariant = matchInfo.variant ?? lastGameRouteRef.current?.variant;

  const isMulti = !!ctx.multiRoomCode;
  const botQuery = (searchParams.get("bot") || "").toLowerCase();
  const botEntry = botQuery ? BOT_MAP[botQuery] : undefined;

  // Unranked queue filler bots ride the normal AI game flow but are not in
  // BOT_MAP (there are many and they're size-agnostic), so we accept them
  // when ?unranked_bot=1 is present with a valid level + size.
  const isUnrankedBotUrl = searchParams.get("unranked_bot") === "1";
  const levelParam = searchParams.get("level") || "";
  const sizeParam = (searchParams.get("size") || "").toLowerCase();
  const isValidUnrankedBot =
    isUnrankedBotUrl &&
    !!botQuery &&
    (UNRANKED_BOT_LEVELS as readonly string[]).includes(levelParam) &&
    (sizeParam === "5x5" || sizeParam === "6x6" || sizeParam === "7x7");

  // Filler bots encode the concrete starting leg on the URL (`?size=5x5`)
  // but may have been queued from a compound mode (e.g. `5x5_6x6_7x7`).
  // Using that compound as the layout's boardMode would bleed into
  // `/api/bot/move`, `matchTimeMs`, win-check dispatch, etc. — the bot
  // endpoint rejects compound values with 422. For filler matches we
  // therefore override the inferred mode with the concrete first-leg size;
  // subsequent legs still escalate internally via `doAdvanceAfterReady`
  // (5x5 → 6x6 → 7x7). Regular AI/multi/custom paths are untouched.
  const effectiveBoardMode: BoardMode = isValidUnrankedBot
    ? (sizeParam as BoardMode)
    : inferredBoardMode;

  const unrankedDifficulty: Difficulty | undefined = isValidUnrankedBot
    ? difficultyForLevel(levelParam as UnrankedBotLevel, sizeParam as CoreBoardSize)
    : undefined;

  const isBot = !isMulti && (!!botEntry || isValidUnrankedBot);
  const difficulty: Difficulty | undefined =
    unrankedDifficulty ?? botEntry?.difficulty;
  const botId: string | undefined = isBot ? botQuery : undefined;

  // Unranked filler bots pin their banner / numeric level / fallback
  // emoji into the URL from `armUnrankedBotMatchSequence`. We read them
  // here so GameScreen can render the opposing banner strip in the
  // sidebar and the sidebar's match-history card can display "LEVEL
  // NNN" consistently with whatever the VS card showed a moment earlier.
  // Refreshing the page no longer re-rolls these values because they
  // ride the URL.
  const unrankedBotBanner = isValidUnrankedBot
    ? (searchParams.get("banner") || "") || undefined
    : undefined;
  const unrankedBotEmoji = isValidUnrankedBot
    ? (searchParams.get("emoji") || "") || undefined
    : undefined;
  const unrankedBotNumericLevelRaw = isValidUnrankedBot
    ? Number(searchParams.get("lvl") || "")
    : NaN;
  const unrankedBotNumericLevel =
    Number.isFinite(unrankedBotNumericLevelRaw) && unrankedBotNumericLevelRaw > 0
      ? Math.min(1000, Math.max(1, Math.floor(unrankedBotNumericLevelRaw)))
      : undefined;

  // Unranked filler-bot matches pin the randomly-sampled 5×5 pattern pool
  // into the URL (`?patterns=V,L,T,LINE,DIAGONAL`) so hydration is
  // deterministic and race-free. When present we ignore `ctx.selectedPatterns`
  // (which might still be the previous match's list until React commits the
  // new value from `armUnrankedBotMatchSequence`). We defensively dedupe,
  // validate against the 5×5 pool and pad to 5 picks so the SHOW-PATTERNS
  // overlay always renders the full active set.
  const effectiveSelectedPatterns = useMemo(() => {
    if (!isValidUnrankedBot) return ctx.selectedPatterns;
    const raw = searchParams.get("patterns");
    if (!raw) return ctx.selectedPatterns;
    const pool = new Set(UNRANKED_5X5_PATTERN_POOL);
    const parsed: string[] = [];
    const seen = new Set<string>();
    for (const p of raw.split(",").map(s => s.trim()).filter(Boolean)) {
      if (!seen.has(p) && pool.has(p)) {
        parsed.push(p);
        seen.add(p);
      }
    }
    if (sizeParam === "5x5") {
      // 5×5 is the only size with a randomised pool — pad up to 5 distinct
      // ids from the pool so the overlay never under-renders.
      for (const id of UNRANKED_5X5_PATTERN_POOL) {
        if (parsed.length >= 5) break;
        if (!seen.has(id)) {
          parsed.push(id);
          seen.add(id);
        }
      }
      return parsed.slice(0, 5);
    }
    return parsed.length > 0 ? parsed : ctx.selectedPatterns;
  }, [isValidUnrankedBot, searchParams, sizeParam, ctx.selectedPatterns]);

  return (
    <AuthGuard>
      <GameScreen
        themeId={ctx.themeId}
        isSingleplayer={!isMulti}
        gameMode={isMulti ? (ctx.isRanked ? "ranked" : "unranked") : isBot ? "ai" : "singleplayer"}
        difficulty={difficulty}
        botId={botId}
        setScreenAction={ctx.navigate}
        roomCode={isMulti ? ctx.multiRoomCode : undefined}
        playerSlot={isMulti ? (ctx.multiPlayerSlot ?? undefined) : undefined}
        matchupData={isMulti ? (ctx.multiMatchup ?? undefined) : undefined}
        p1Name={ctx.user?.username}
        graphicsQuality={ctx.graphicsQuality}
        boardMode={effectiveBoardMode}
        variant={inferredVariant}
        gameId={matchInfo.gameId}
        phasePath={matchInfo.phasePath}
        selectedPatterns={effectiveSelectedPatterns}
        multiplayerRulesBootstrap={isMulti ? ctx.multiplayerRulesBootstrap : undefined}
        setHomeNoticeAction={ctx.setHomeNotice}
        unrankedBotBanner={unrankedBotBanner}
        unrankedBotNumericLevel={unrankedBotNumericLevel}
        unrankedBotEmoji={unrankedBotEmoji}
        onMultiplayerBoardSync={
          isMulti
            ? (mode, pats) => {
                ctx.setBoardMode(mode);
                ctx.setSelectedPatterns(pats);
              }
            : undefined
        }
        onMultiplayerSeriesSealedAction={isMulti ? ctx.sealMultiSeriesNavigation : undefined}
        onMultiplayerSeriesResumedAction={isMulti ? ctx.resumeMultiSeriesNavigation : undefined}
        onMultiplayerNavLockChange={isMulti ? ctx.setMultiplayerNavUnlocked : undefined}
        playHoverAction={ctx.sfx.hover}
        playPlaceAction={ctx.sfx.place}
        playVictoryAction={ctx.sfx.victory}
        playDefeatAction={ctx.sfx.defeat}
        playRulebreakerAction={ctx.sfx.rulebreaker}
        playTransitionAction={ctx.sfx.transition}
        playClickAction={ctx.sfx.click}
        onOpenSettingsAction={() => {
          ctx.sfx.click();
          ctx.setShowSettings(true);
        }}
      />
      {children}
    </AuthGuard>
  );
}
