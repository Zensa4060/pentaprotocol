"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useAudio } from "@/hooks/useAudio";
import API, { getWsBaseUrl, openWs } from "@/lib/api";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import type { MatchupData, BoardMode, Screen, SetScreenOptions } from "@/lib/types";
import { loadCustomTheme, resolveCustomTheme } from "@/lib/customTheme";
import {
  LEGAL_VERSION,
  POLICY_GATE_SESSION_KEY,
  getUserId,
  hasAcceptedLegal,
} from "@/lib/legalAcceptance";
import {
  multiplayerRulesBootstrapFromRoom,
  type MultiplayerRulesBootstrap,
} from "@/lib/effectiveBoardMode";
import { generateGameId } from "@/lib/gameId";
import {
  screenToUrl,
  pathnameToScreen,
  buildGameUrl,
  buildChallengeUrl,
  buildRulesShowUrl,
  difficultyToBotName,
  ROUTES,
  MAIN_NAV_PREFETCH_PATHS,
} from "@/lib/routes";
import {
  MYTHOS_PFP_URL,
  buildUnrankedBotGameUrl,
  buildUnrankedBotRulesShowUrl,
  numericLevelForTier,
  pickQueueWaitMs,
  pickRandomPatterns5x5,
  pickUnrankedBot,
  pickUnrankedBotBanner,
  pickUnrankedBotEmoji,
  simpleSizeFromBoardMode,
  styleForLevel,
  type PickedBot,
} from "@/lib/unrankedBots";

/**
 * Paths that do NOT require an authenticated session. Everything else
 * is app gameplay surface — if the user isn't logged in when we mount
 * one of those, we bounce them to /auth. Guest mode was removed, so
 * this list is the single source of truth for "public" routes.
 */
const PUBLIC_PATH_PREFIXES = [
  "/auth",
  "/privacy",
  "/cookies",
  "/terms",
  "/refund",
  "/rules",
  "/patchnotes",
];

function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

import NavBar from "@/components/NavBar";
import SettingsModal from "@/components/SettingsModal";
import SpaceBg from "@/components/SpaceBg";
import PolicyAcceptanceGate from "@/components/PolicyAcceptanceGate";
import TutorialScreen from "@/components/TutorialScreen";
import { shouldShowTutorialGate, normalizeTutorialState } from "@/lib/tutorialState";
import SessionReplacedModal from "@/components/SessionReplacedModal";
import ActiveMatchRejoinModal from "@/components/ActiveMatchRejoinModal";
import GlobalLevelUpShowcase from "@/components/GlobalLevelUpShowcase";
import LobbyScreen from "@/components/LobbyScreen";
import MythosIntroScreen from "@/components/MythosIntroScreen";

THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;

const PP_MULTI_SERIES_FINISHED_KEY = "pp_multi_series_finished";
const PP_HOME_NOTICE_KEY = "pp_home_notice";
const DISCONNECT_HOME_NOTICE = "last match ended due to connection issues or going afk";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Context type                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

export interface AppContextType {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  fadingOut: boolean;

  audio: ReturnType<typeof useAudio>;
  sfx: ReturnType<typeof useAudio>["sfx"];

  user: any;
  token: string | null;
  appReady: boolean;

  /** Legacy navigation – maps old Screen names to URLs via router.push */
  navigate: (screen: Screen, opts?: SetScreenOptions) => void;
  currentScreen: Screen;

  boardMode: BoardMode;
  setBoardMode: (m: BoardMode) => void;
  selectedPatterns: string[];
  setSelectedPatterns: (p: string[]) => void;

  aiDifficulty: Difficulty;
  setAiDifficulty: (d: Difficulty) => void;

  queuePhase: "none" | "queuing" | "matchup";
  queueElapsed: number;
  matchupOpponent: any;
  queueError: string | null;
  inQueue: boolean;
  startMatchmaking: (mode: "ranked" | "unranked") => void;
  cancelMatchmaking: () => void;

  multiRoomCode: string;
  multiPlayerSlot: "P1" | "P2" | null;
  multiMatchup: MatchupData | null;
  multiplayerRulesBootstrap: MultiplayerRulesBootstrap | null;
  isRanked: boolean;
  handleRoomReady: (
    roomCode: string,
    playerSlot: "P1" | "P2",
    format: string,
    matchup?: MatchupData,
    roomFromServer?: any,
  ) => void;
  multiplayerNavUnlocked: boolean;
  setMultiplayerNavUnlocked: (v: boolean) => void;

  graphicsQuality: "quality";
  homeNotice: string | null;
  setHomeNotice: (v: string | null) => void;
  /**
   * Dismiss the home-notice banner. Call this when the user explicitly
   * acknowledges the notification (e.g. by clicking the banner). Hides
   * the banner immediately, clears the nav-bar friends badge, and
   * persists a baseline so the banner won't re-appear until a fresh
   * notification arrives.
   */
  dismissHomeNotice: () => void;

  showSettings: boolean;
  setShowSettings: (v: boolean) => void;

  sealMultiSeriesNavigation: () => void;
  resumeMultiSeriesNavigation: () => void;

  /** Navigate directly to a game URL (bypasses screenToUrl mapping). */
  navigateToGame: (boardMode: BoardMode, variant?: string) => void;
  /** Navigate directly to a challenge URL. */
  navigateToChallenge: (boardMode: BoardMode, difficulty: Difficulty) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used inside <AppShell>");
  return ctx;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  AppShell component                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // When a game URL carries ?bot=<name>, treat the current screen as an AI game.
  // This restores the "exit AI game?" confirmation after the routing restructure
  // moved bot games from /challenge/* to /game/g{n}/{id}?bot={name}.
  const isMatchPath =
    pathname.startsWith("/game/") ||
    pathname.startsWith("/ready/") ||
    pathname.startsWith("/rulebreaker/") ||
    pathname.startsWith("/rulechoice/") ||
    pathname.startsWith("/rulesshow/");
  const botQueryName = (searchParams?.get("bot") || "").toLowerCase();
  const isBotGameRoute = !!(pathname?.startsWith("/game/") && botQueryName);
  /* MYTHOS filler-bot sessions carry `?unranked_bot=1&mythos=1&level=MYTHOS`.
   * We surface them here so BGM selection can promote the match to the
   * ranked track without changing any routing.
   *
   * Detection is anchored to `isMatchPath` (covers /game/, /rulesshow/,
   * /ready/, /rulebreaker/, /rulechoice/) rather than `isBotGameRoute`
   * alone — otherwise the rules-show interlude that runs BEFORE /game/
   * mounts plays the regular "game" track for ~5 s and then snaps to
   * the ranked track once the game URL takes over. Promoting the whole
   * match flow to ranked keeps the boss-tier soundtrack continuous from
   * the moment the player lands on /rulesshow/. */
  const isMythosBotRoute =
    isMatchPath &&
    !!botQueryName &&
    searchParams?.get("unranked_bot") === "1" &&
    searchParams?.get("mythos") === "1" &&
    (searchParams?.get("level") || "").toUpperCase() === "MYTHOS";
  const isStaticSilentPage =
    pathname === "/patchnotes" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/refund";
  const isClassicForcedLegalPage =
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/refund";

  /* ── Theme ──────────────────────────────────────────────────────────────── */
  const [themeId, setThemeIdRaw] = useState<ThemeId>("classic_dark");
  const [fadingOut, setFadingOut] = useState(false);
  const pendingTheme = useRef<ThemeId | null>(null);
  const [customRev, setCustomRev] = useState(0);

  /* ── App readiness ──────────────────────────────────────────────────────── */
  const [appReady, setAppReady] = useState(false);

  /* ── Audio ──────────────────────────────────────────────────────────────── */
  const audio = useAudio();
  const { sfx } = audio;
  const [audioStarted, setAudioStarted] = useState(false);
  const audioStartedRef = useRef(false);

  /* ── Auth ────────────────────────────────────────────────────────────────── */
  const { user, token, logout, logoutReason, setLogoutReason } = useAuthStore();

  /* ── Matchmaking ────────────────────────────────────────────────────────── */
  const [inQueue, setInQueue] = useState(false);
  const [isRanked, setIsRanked] = useState(false);
  const [queuePhase, setQueuePhase] = useState<"none" | "queuing" | "matchup">("none");
  const [queueElapsed, setQueueElapsed] = useState(0);
  const [queueRoomCode, setQueueRoomCode] = useState<string | null>(null);
  const [queuePlayerSlot, setQueuePlayerSlot] = useState<"P1" | "P2">("P1");
  const [matchupOpponent, setMatchupOpponent] = useState<any>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);
  const queueCancelledRef = useRef(false);
  const matchmakingActiveRef = useRef(false);
  const queueRoomCodeRef = useRef<string | null>(null);
  const queuePlayerSlotRef = useRef<"P1" | "P2">("P1");
  /** Prevents overlapping /queue/status polls from each firing the VS screen (race: 2s interval, slow HTTP). */
  const matchFoundArmRef = useRef(false);
  const matchFoundPostVsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Show the bespoke "PREPARING MYTHOS..." charging overlay before the
   *  matchup VS card on a MYTHOS roll. Lives in AppShell rather than
   *  LobbyScreen so it can sit above the queue route and survive the
   *  router.push to /play/matchfound. Cleared once the intro's onDone
   *  fires (or on cancel/unmount). */
  const [mythosIntroVisible, setMythosIntroVisible] = useState(false);
  const mythosIntroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearMythosIntroTimer = useCallback(() => {
    if (mythosIntroTimerRef.current) {
      clearTimeout(mythosIntroTimerRef.current);
      mythosIntroTimerRef.current = null;
    }
  }, []);

  /* Unranked filler-bot race timer (1–10 s). Fires only if no real match
   * has been found yet. Cleared on real match, cancel, and unmount. */
  const unrankedBotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMatchFoundPostVsTimer = useCallback(() => {
    if (matchFoundPostVsTimerRef.current) {
      clearTimeout(matchFoundPostVsTimerRef.current);
      matchFoundPostVsTimerRef.current = null;
    }
  }, []);

  const clearUnrankedBotTimer = useCallback(() => {
    if (unrankedBotTimerRef.current) {
      clearTimeout(unrankedBotTimerRef.current);
      unrankedBotTimerRef.current = null;
    }
  }, []);

  /* ── Board / game state ─────────────────────────────────────────────────── */
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [aiMatchBgmCtx, setAiMatchBgmCtx] = useState<"game" | "ranked" | null>(null);
  const [aiMatchBotName, setAiMatchBotName] = useState<string | null>(null);
  const graphicsQuality: "quality" = "quality";

  /* ── Multiplayer ────────────────────────────────────────────────────────── */
  const [multiRoomCode, setMultiRoomCode] = useState<string>("");
  const [multiPlayerSlot, setMultiPlayerSlot] = useState<"P1" | "P2" | null>(null);
  const [multiMatchup, setMultiMatchup] = useState<MatchupData | null>(null);
  const [multiplayerRulesBootstrap, setMultiplayerRulesBootstrap] =
    useState<MultiplayerRulesBootstrap | null>(null);
  const [multiplayerNavUnlocked, setMultiplayerNavUnlocked] = useState(false);
  const suppressSettingsAccountActions =
    multiRoomCode !== "" &&
    !isBotGameRoute &&
    (isMatchPath || !!pathname?.startsWith("/play/matchfound"));

  /* ── Modals / overlays ──────────────────────────────────────────────────── */
  const [showSettings, setShowSettings] = useState(false);
  const [showAiExitModal, setShowAiExitModal] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<Screen | null>(null);
  const [showSessionReplaced, setShowSessionReplaced] = useState(false);
  const [activeMatchData, setActiveMatchData] = useState<any>(null);
  const [homeNotice, setHomeNotice] = useState<string | null>(null);
  const [socialToast, setSocialToast] = useState<{
    text: string;
    friendId?: string;
    actionLabel?: string;
  } | null>(null);

  /* ── Refs ────────────────────────────────────────────────────────────────── */
  const themeRef = useRef(themeId);
  const rankedRef = useRef(isRanked);
  const aiDiffRef = useRef(aiDifficulty);
  const profileRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socialToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSocialToastRef = useRef<{ key: string; at: number } | null>(null);
  /** Highest "friend notification count" the user has acknowledged.
   *  Persists across re-renders and useEffect re-runs (which the old
   *  closure-local `lastSeen` did NOT — every pathname change reset it
   *  to 0, so the home banner would silently re-appear the moment the
   *  user came back to /home with `n > 0`).
   *
   *  Updated in two places:
   *    • The friends-poller `tick`: after an explicit "fire banner" or
   *      after the queue empties (`n === 0`, reset to 0 so the next
   *      arrival still triggers a fresh banner).
   *    • The pathname watcher below: visiting `/friends` snapshots the
   *      current count as acknowledged, so coming back to /home does
   *      NOT re-surface a banner for notifications the user has
   *      already seen on the friends tab. */
  const friendsBadgeAcknowledgedRef = useRef(0);
  themeRef.current = themeId;
  rankedRef.current = isRanked;
  aiDiffRef.current = aiDifficulty;

  useEffect(() => { queueRoomCodeRef.current = queueRoomCode; }, [queueRoomCode]);
  useEffect(() => { queuePlayerSlotRef.current = queuePlayerSlot; }, [queuePlayerSlot]);

  /* While both players see match-found (no room WS yet), poll so a tab close / queue cancel on the peer disbands the room and we surface "opponent aborted". */
  useEffect(() => {
    if (queuePhase !== "matchup" || !queueRoomCode || !token) return;
    let stopped = false;
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const tick = async () => {
      if (stopped || queueCancelledRef.current) return;
      try {
        const poll = await API.get(`/api/room/queue/status/${queueRoomCode}`, { ...authHeader, timeout: 10000 });
        if (stopped || queueCancelledRef.current) return;
        if (poll.data?.game_status === "disbanded") {
          stopped = true;
          clearMatchFoundPostVsTimer();
          matchFoundArmRef.current = false;
          matchmakingActiveRef.current = false;
          setMatchupOpponent(null);
          setInQueue(false);
          setQueuePhase("none");
          setQueueRoomCode(null);
          setQueuePlayerSlot("P1");
          setQueueError("Your opponent aborted this match.");
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/play/matchfound")) {
            router.replace(ROUTES.PLAY_LOBBY);
          }
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 2000);
    void tick();
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [queuePhase, queueRoomCode, token, clearMatchFoundPostVsTimer, router]);

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const currentScreen: Screen = isBotGameRoute ? "aiGame" : pathnameToScreen(pathname);
  const routeThemeId: ThemeId = isClassicForcedLegalPage ? "classic_dark" : themeId;
  const t = THEMES[routeThemeId];
  const ip = routeThemeId === "pixel";

  const getBgmCtx = (
    scr: Screen,
    ranked: boolean,
    aiDiff: Difficulty,
    lockedMatchCtx: "game" | "ranked" | null = null,
  ): "lobby" | "game" | "ranked" => {
    if (lockedMatchCtx) return lockedMatchCtx;
    // MYTHOS encounters always play the ranked track, regardless of which
    // segment of the match flow we're currently on (lobby → matchfound →
    // /rulesshow/ → /ready/ → /game/ → /rulebreaker/...). The `scr`
    // resolution treats /rulesshow/ etc. as `"game"` rather than
    // `"aiGame"` because the path doesn't start with `/game/`, so we
    // gate on `isMythosBotRoute` ahead of the per-screen branches.
    if (isMythosBotRoute) return "ranked";
    if (scr === "aiGame") {
      const rankedBotNames = new Set(["jr", "him", "her"]);
      const inferredBotName = difficultyToBotName(boardMode, aiDiff).toLowerCase();
      return rankedBotNames.has(inferredBotName) ? "ranked" : "game";
    }
    if (scr === "game") return "game";
    if (scr === "multiGame") return ranked ? "ranked" : "game";
    return "lobby";
  };

  useEffect(() => {
    if (isBotGameRoute && isMatchPath && botQueryName) {
      setAiMatchBotName(prev => (prev === botQueryName ? prev : botQueryName));
      return;
    }
    if (!isMatchPath) {
      setAiMatchBotName(prev => (prev === null ? prev : null));
    }
  }, [isBotGameRoute, isMatchPath, botQueryName]);

  useEffect(() => {
    const rankedBotNames = new Set(["jr", "him", "her"]);
    if (isBotGameRoute && isMatchPath) {
      const activeBotName = (aiMatchBotName || "").toLowerCase();
      const inferredBotName = difficultyToBotName(boardMode, aiDifficulty).toLowerCase();
      const botName = activeBotName || inferredBotName;
      // MYTHOS filler-bot sessions are pinned to the ranked BGM track even
      // though their bot name (NADAF / SARAH / …) isn't in the ranked set.
      const next: "game" | "ranked" =
        isMythosBotRoute || rankedBotNames.has(botName) ? "ranked" : "game";
      setAiMatchBgmCtx(prev => (prev === next ? prev : next));
      return;
    }
    if (!isMatchPath) {
      setAiMatchBgmCtx(prev => (prev === null ? prev : null));
    }
  }, [isBotGameRoute, isMatchPath, isMythosBotRoute, aiDifficulty, aiMatchBotName, boardMode]);

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Startup restore (pre-paint)                                           */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const pendingScreenRestoreRef = useRef<{
    screen: Screen;
    multiRoomCode: string;
    multiPlayerSlot: "P1" | "P2" | null;
    isRanked: boolean;
  } | null>(null);
  const startupNeedsSessionProbeRef = useRef(false);

  useLayoutEffect(() => {
    const savedTheme = localStorage.getItem("pp_theme") as ThemeId;
    if (savedTheme && THEMES[savedTheme]) setThemeIdRaw(savedTheme);

    const tok = useAuthStore.getState().token;
    const savedBoard =
      (localStorage.getItem("pp_boardMode") as BoardMode | null) ||
      (sessionStorage.getItem("pp_boardMode") as BoardMode | null);
    const savedPats =
      localStorage.getItem("pp_selectedPatterns") ||
      sessionStorage.getItem("pp_selectedPatterns");
    const savedDifficulty = localStorage.getItem("pp_ai_difficulty") as Difficulty | null;

    if (
      savedBoard &&
      ["5x5", "6x6", "7x7", "5x5_7x7", "5x5_6x6", "6x6_7x7", "5x5_6x6_7x7"].includes(
        savedBoard,
      )
    ) {
      setBoardMode(savedBoard);
    }
    if (savedDifficulty) setAiDifficulty(savedDifficulty);
    if (savedPats) {
      try {
        const arr = JSON.parse(savedPats);
        if (Array.isArray(arr)) {
          setSelectedPatterns(
            Array.from(new Set(arr.map((p: string) => (p === "H" ? "Y" : p)))),
          );
        }
      } catch {
        /* ignore */
      }
    }

    if (!tok) {
      startupNeedsSessionProbeRef.current = !isPublicPath(pathname);
      setAppReady(true);
      return;
    }

    const savedRoom = sessionStorage.getItem("pp_multiRoomCode");
    const savedSlot = sessionStorage.getItem("pp_multiPlayerSlot") as "P1" | "P2" | null;
    const savedRanked = sessionStorage.getItem("pp_isRanked") === "true";

    pendingScreenRestoreRef.current = {
      screen: pathnameToScreen(pathname),
      multiRoomCode: savedRoom || "",
      multiPlayerSlot: savedSlot,
      isRanked: savedRanked,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Profile verification gate ──────────────────────────────────────── */
  useEffect(() => {
    const restore = pendingScreenRestoreRef.current;
    const shouldProbeSession = startupNeedsSessionProbeRef.current;
    if (!restore && !shouldProbeSession) return;
    startupNeedsSessionProbeRef.current = false;

    const tok = useAuthStore.getState().token;
    if (!tok) {
      if (shouldProbeSession) {
        API.get("/api/profile/me", { timeout: 10000 })
          .then((res) => {
            useAuthStore.getState().setAuth(res.data);
            setAppReady(true);
          })
          .catch(() => {
            router.replace(ROUTES.AUTH);
            setAppReady(true);
          });
        return;
      }
      setAppReady(true);
      return;
    }
    if (!restore) {
      setAppReady(true);
      return;
    }

    API.get("/api/profile/me", {
      headers: { Authorization: `Bearer ${tok}` },
      timeout: 10000,
    })
      .then((res) => {
        useAuthStore.getState().updateUser(res.data);
        if (restore.screen === "home" || restore.screen === "auth") {
          API.get("/api/room/active/check", {
            headers: { Authorization: `Bearer ${tok}` },
          })
            .then((activeRes) => {
              const d = activeRes.data;
              const fmt = String(d?.format ?? "").toLowerCase();
              if (d?.room_code && (fmt === "ranked" || fmt === "unranked")) {
                setActiveMatchData(d);
              }
            })
            .catch(() => {});
        }
        if (restore.multiRoomCode) setMultiRoomCode(restore.multiRoomCode);
        if (restore.multiPlayerSlot) setMultiPlayerSlot(restore.multiPlayerSlot);
        setIsRanked(restore.isRanked);

        if (pathname === "/" || pathname === ROUTES.AUTH || pathname === "/auth") {
          router.replace("/home");
        }
        setAppReady(true);
      })
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 404 || status === 401) useAuthStore.getState().logout();
        // Public legal/info pages (/terms, /privacy, /refund, /patchnotes,
        // /cookies, /rules, ...) must remain reachable even if the logged-in
        // profile fetch fails — we silently drop the session and keep the
        // user on the page they requested.
        if (!isPublicPath(pathname)) {
          router.replace(ROUTES.AUTH);
        }
        setAppReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Global auth gate ──────────────────────────────────────────────────
   *
   * With guest mode removed, every gameplay route (``/home``, ``/career``,
   * ``/play/*``, ``/game/*``, ``/store``, ``/collection/*``, ``/profile``,
   * ``/missions/*``, ``/friends``, ``/training/*``, ``/challenge/*``, ...)
   * requires an authenticated user. The small public surface —
   * ``PUBLIC_PATH_PREFIXES`` at the top of this file — still renders for
   * unauthenticated visitors (``/auth`` itself, legal pages, rules,
   * patchnotes).
   *
   * We deliberately wait until ``appReady`` so we don't redirect during
   * the brief window between mount and the /auth/me bootstrap — that
   * would bounce a freshly-logged-in user back to /auth because their
   * Zustand state hadn't hydrated yet.
   *
   * Why this is all client-side: the backend and frontend live on
   * different origins in production (Railway vs. Vercel), so the
   * ``pp_auth`` presence cookie set by the backend is NOT visible to
   * the frontend origin — the Next.js edge proxy cannot read it and
   * any server-side gate would always false-negative. See the comment
   * block at the top of ``frontend/proxy.ts`` for the full history.
   */
  useEffect(() => {
    if (!appReady) return;
    if (user && token) return;
    if (isPublicPath(pathname)) return;
    const target =
      pathname && pathname !== "/" && !pathname.startsWith("/auth")
        ? `${ROUTES.AUTH}?next=${encodeURIComponent(pathname)}`
        : ROUTES.AUTH;
    try {
      router.replace(target);
    } catch {
      if (typeof window !== "undefined") {
        window.location.replace(target);
      }
    }
  }, [appReady, user, token, pathname, router]);

  /* ── Policy gate ────────────────────────────────────────────────────── */
  const [showPolicyGate, setShowPolicyGate] = useState(false);
  const showPolicyGateRef = useRef(false);
  showPolicyGateRef.current = showPolicyGate;

  useEffect(() => {
    if (!appReady || !user || !token) return;
    const uid = getUserId(user);
    if (!uid) return;
    const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
    if (pending === uid && !hasAcceptedLegal(uid, user)) setShowPolicyGate(true);
  }, [appReady, user, token]);

  /* ── First-run tutorial gate ───────────────────────────────────────────
   *
   * Shown after a user has accepted the legal policies but has not yet
   * decided on the tutorial. Also reopens when Profile fires a
   * "pp_replay_tutorial" custom event ("replay" mode — does not re-persist).
   */
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialMode, setTutorialMode] = useState<"gate" | "replay">("gate");
  const tutorialOpenRef = useRef(false);
  tutorialOpenRef.current = tutorialOpen;

  useEffect(() => {
    if (!appReady || !user || !token) return;
    if (showPolicyGate) return;
    if (!shouldShowTutorialGate(user)) return;
    if (tutorialOpenRef.current) return;
    setTutorialMode("gate");
    setTutorialOpen(true);
  }, [appReady, user, token, showPolicyGate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onReplay = () => {
      setTutorialMode("replay");
      setTutorialOpen(true);
    };
    window.addEventListener("pp_replay_tutorial", onReplay);
    return () => window.removeEventListener("pp_replay_tutorial", onReplay);
  }, []);

  /* ── Warm shell routes (navbar) so tab switches use prefetched segments ─ */
  useEffect(() => {
    if (!appReady || typeof window === "undefined") return;
    const prefetchAll = () => {
      for (const href of MAIN_NAV_PREFETCH_PATHS) {
        try {
          router.prefetch(href);
        } catch {
          /* noop */
        }
      }
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(prefetchAll, { timeout: 3500 });
    } else {
      timeoutId = setTimeout(prefetchAll, 500);
    }
    return () => {
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [appReady, router]);

  /* ── Global notify WebSocket ────────────────────────────────────────── */
  useEffect(() => {
    if (!appReady || !token) return;
    useAuthStore.getState().refreshProfile();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let cancelled = false;

    const refreshSocialBadge = async () => {
      try {
        // Match-invite endpoint no longer polled — invites were removed
        // from the client in favour of sharing custom-room codes via DM.
        const [reqRes, listRes] = await Promise.all([
          API.get("/api/friends/requests"),
          API.get("/api/friends/list"),
        ]);
        const n =
          (reqRes.data?.requests?.length ?? 0) +
          Number(listRes.data?.unread_dm_count ?? 0);
        const { setFriendsNavBadgeCount } = await import("@/lib/navBadgeState");
        setFriendsNavBadgeCount(n);
      } catch {
        /* transient */
      }
    };

    const pushSocialToast = (
      msg: string,
      opts: { friendId?: string; actionLabel?: string } = {},
      toastKey?: string,
    ) => {
      const key = toastKey || `${msg}|${opts.friendId || ""}|${opts.actionLabel || ""}`;
      const now = Date.now();
      const last = lastSocialToastRef.current;
      if (last && last.key === key && now - last.at < 1500) return;
      lastSocialToastRef.current = { key, at: now };
      setSocialToast({ text: msg, ...opts });
      if (socialToastTimerRef.current) clearTimeout(socialToastTimerRef.current);
      socialToastTimerRef.current = setTimeout(() => setSocialToast(null), 2500);
    };

    const openFriendChat = (friendId: string) => {
      if (!friendId) return;
      if (isMatchPath) {
        window.dispatchEvent(new CustomEvent("pp_open_friend_chat", { detail: { friendId } }));
        return;
      }
      try {
        sessionStorage.setItem("pp_open_dm_friend_id", friendId);
      } catch {}
      window.dispatchEvent(new CustomEvent("pp_open_friend_chat", { detail: { friendId } }));
      router.push(ROUTES.FRIENDS);
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("pp_open_friend_chat", { detail: { friendId } }));
      }, 120);
    };

    const connect = async () => {
      if (cancelled) return;
      try {
        // Phase 2.3: fetch a one-shot ticket instead of putting the
        // JWT in the WS URL. If the user has spammed reconnects the
        // server will 429 us; back off 10s and let it try again.
        ws = await openWs("/api/room/ws/global/notify");
      } catch {
        if (!cancelled && useAuthStore.getState().token) {
          reconnectTimeout = setTimeout(connect, 10000);
        }
        return;
      }
      if (cancelled) { ws.close(); return; }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "duplicate_session") useAuthStore.getState().logout("duplicate_session");
          if (
            msg.type === "friend_request_created" ||
            msg.type === "friend_request_updated" ||
            msg.type === "friend_dm_received" ||
            msg.type === "friend_dm_sent" ||
            msg.type === "friend_removed"
          ) {
            void refreshSocialBadge();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("pp_social_refresh", { detail: msg }));
            }
          }
          // `friend_invite_*` WS events are ignored — match invites were
          // removed from the client; players share custom-room codes via
          // DM instead. The server may still emit these for legacy reasons
          // but we deliberately drop them rather than surfacing a UI for
          // a flow the app no longer supports.
          if (msg.type === "friend_request_created") {
            pushSocialToast("New friend request received.", {}, `request:${String(msg.from_user || "")}`);
          } else if (msg.type === "friend_dm_received") {
            const fid = String(msg.from_user || "");
            pushSocialToast("New message received.", { friendId: fid, actionLabel: "Open Chat" }, `dm_recv:${fid}`);
          } else if (msg.type === "friend_dm_sent") {
            const fid = String(msg.to_user || "");
            pushSocialToast("Message sent.", { friendId: fid, actionLabel: "Open Chat" }, `dm_sent:${fid}`);
          } else if (msg.type === "friend_removed") {
            pushSocialToast("A friend was removed.", {}, `removed:${String(msg.friend_id || "")}`);
          } else if (msg.type === "open_chat" && msg.friend_id) {
            openFriendChat(String(msg.friend_id));
          }
        } catch {}
      };
      ws.onclose = () => {
        if (!cancelled && useAuthStore.getState().token) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (ws) { ws.onclose = null; ws.close(); }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socialToastTimerRef.current) {
        clearTimeout(socialToastTimerRef.current);
        socialToastTimerRef.current = null;
      }
    };
  }, [appReady, token, isMatchPath, router]);

  /* ── Token-cleared guard ────────────────────────────────────────────── */
  useEffect(() => {
    if (!appReady) return;
    if (
      !token &&
      pathname !== ROUTES.AUTH &&
      pathname !== "/" &&
      !isPublicPath(pathname)
    ) {
      setMultiRoomCode("");
      setMultiPlayerSlot(null);
      setInQueue(false);
      setQueuePhase("none");
      if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
      router.replace(ROUTES.AUTH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, token]);

  /* ── Session-kick (duplicate session) ───────────────────────────────── */
  useEffect(() => {
    if (logoutReason === "duplicate_session") {
      setMultiRoomCode("");
      setMultiPlayerSlot(null);
      setInQueue(false);
      setQueuePhase("none");
      if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
      setShowSessionReplaced(true);
      router.replace(ROUTES.AUTH);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutReason]);

  /* ── Home notice ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (pathname !== "/home" || typeof window === "undefined") {
      if (pathname !== "/home") setHomeNotice(null);
      return;
    }
    const msg = sessionStorage.getItem(PP_HOME_NOTICE_KEY);
    if (!msg) return;
    setHomeNotice(msg);
    sessionStorage.removeItem(PP_HOME_NOTICE_KEY);
  }, [pathname]);

  /* ── Profile refresh on visibility change ───────────────────────────── */
  useEffect(() => {
    if (!token) return;
    const scheduleRefresh = () => {
      if (profileRefreshDebounceRef.current) clearTimeout(profileRefreshDebounceRef.current);
      profileRefreshDebounceRef.current = setTimeout(() => {
        profileRefreshDebounceRef.current = null;
        useAuthStore.getState().refreshProfile();
      }, 1000);
    };
    const onVis = () => { if (document.visibilityState === "visible") scheduleRefresh(); };
    const onFocus = () => scheduleRefresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      if (profileRefreshDebounceRef.current) {
        clearTimeout(profileRefreshDebounceRef.current);
        profileRefreshDebounceRef.current = null;
      }
    };
  }, [token]);

  /* ── Friends nav badge poller ───────────────────────────────────────── */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // Ref-free dedupe so the home-notice banner doesn't flash the SAME
    // "friend request" line on every tick while the count stays put. We
    // only surface it when the count rises ABOVE the baseline the user
    // has already acknowledged (see `friendsBadgeAcknowledgedRef`); we
    // clear it the moment the user drops it back to zero by opening the
    // chat / accepting the request (see the `pp_friends_badge_refresh`
    // listener below which is fired by the components that perform
    // those actions), and we also clear it whenever the user visits the
    // /friends tab (the dedicated effect after this one).
    const isFriendNoticeText = (text: string | null) =>
      !!text && /\bfriend\b/i.test(text);

    const tick = async () => {
      try {
        // Match-invite endpoint removed from the client — the badge now
        // counts pending friend requests + unread DMs only.
        const [reqRes, listRes] = await Promise.all([
          API.get("/api/friends/requests"),
          API.get("/api/friends/list"),
        ]);
        if (cancelled) return;
        const n =
          (reqRes.data?.requests?.length ?? 0) +
          Number(listRes.data?.unread_dm_count ?? 0);
        const {
          setFriendsNavBadgeCount,
          getFriendsNotificationsDismissedAt,
          resetFriendsNotificationsDismissed,
        } = await import("@/lib/navBadgeState");

        // Persistent dismissal baseline (set when the user clicks the
        // home-notice banner). The nav-bar dot AND home banner only
        // re-arm when the live count rises ABOVE this baseline — i.e.
        // a *new* friend request / DM has arrived since dismissal. We
        // never inflate the badge beyond reality: visibleN is clamped
        // to n so the user never sees a stale count.
        const dismissedAt = getFriendsNotificationsDismissedAt();
        const visibleN = n > dismissedAt ? n : 0;
        setFriendsNavBadgeCount(visibleN);

        // Reset BOTH the in-memory acknowledged baseline AND the
        // persistent dismissal floor whenever the queue empties.
        // Otherwise the next single notification (n=1) wouldn't fire
        // because 1 ≤ a stale dismissal of e.g. 3.
        if (n === 0) {
          friendsBadgeAcknowledgedRef.current = 0;
          resetFriendsNotificationsDismissed();
        }

        // Effective floor for "have I already shown this banner?": the
        // higher of the in-memory ack ref (set on /friends visit) and
        // the persistent dismissal baseline (set on banner click).
        const ackFloor = Math.max(
          friendsBadgeAcknowledgedRef.current,
          dismissedAt,
        );

        // Post-match nudge: if we're on home and new notifications
        // appeared since the user last acknowledged or dismissed,
        // surface a gentle home-notice banner.
        if (n > ackFloor && pathname === "/home") {
          setHomeNotice(
            n === 1
              ? "You have a new friend request or message."
              : `You have ${n} pending friend notifications.`,
          );
        } else if (n <= ackFloor) {
          // Either the queue is empty (n=0) or the user has already
          // acknowledged at least this many — retire any lingering
          // friend-related home banner so the homescreen stops
          // showing stale notifications.
          setHomeNotice((prev) => (isFriendNoticeText(prev) ? null : prev));
        }
      } catch {
        /* transient — next tick will retry */
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);

    // Instant-refresh hook: FriendsScreen / FriendsSidePanel dispatch
    // `pp_friends_badge_refresh` after the user opens a DM thread
    // (which marks inbound messages as read server-side) or acts on a
    // friend request. Listening here lets us recompute the badge +
    // home-notice without waiting for the 30s poller to catch up.
    const onForceRefresh = () => { void tick(); };
    window.addEventListener("pp_friends_badge_refresh", onForceRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("pp_friends_badge_refresh", onForceRefresh);
    };
  }, [token, pathname]);

  /* ── Acknowledge friend notifications on /friends visit ─────────────── */
  /* Visiting the friends tab is treated as the user explicitly viewing
   * the social queue — even if they don't open every individual DM
   * thread or act on every request, they have *seen* what's there.
   *
   * We:
   *   1. Snapshot the current friends-badge count into the
   *      "acknowledged" baseline ref so the poller above will only
   *      re-surface the home banner when NEW notifications arrive
   *      (i.e. the count rises above this snapshot).
   *   2. Eagerly clear any active friend-related home notice so the
   *      moment the user navigates back to /home the banner is gone,
   *      regardless of the 30s poller cadence.
   *
   * This fixes the user-reported case where the homescreen banner
   * "You have a new friend request or message" persisted even after
   * the user had visited /friends and handled their pending requests
   * (the residual was an unread DM they hadn't manually opened —
   * visiting the tab now counts as acknowledgement). */
  useEffect(() => {
    if (pathname !== "/friends") return;
    (async () => {
      const { getFriendsNavBadgeCount } = await import("@/lib/navBadgeState");
      friendsBadgeAcknowledgedRef.current = getFriendsNavBadgeCount();
    })();
    setHomeNotice((prev) =>
      prev && /\bfriend\b/i.test(prev) ? null : prev,
    );
  }, [pathname]);

  /* ── Dismiss the home-notice banner on click ────────────────────────── */
  /* Wired into HomeScreen via the AppContext. Clicking the banner is the
   * user explicitly saying "I have seen these notifications, stop nagging
   * me until something NEW arrives". We:
   *   1. Snapshot the live count into both the in-memory ack ref AND the
   *      persistent dismissal baseline (localStorage). The poller above
   *      only re-arms the nav-bar dot + banner when n > this floor.
   *   2. Clear the nav-bar friends badge immediately so the dot vanishes
   *      without waiting for the next 30s tick.
   *   3. Hide the home banner immediately for instant feedback. */
  const dismissHomeNotice = useCallback(async () => {
    if (typeof window === "undefined") {
      setHomeNotice(null);
      return;
    }
    try {
      const {
        getFriendsNavBadgeCount,
        dismissFriendsNotificationsAt,
      } = await import("@/lib/navBadgeState");
      const live = getFriendsNavBadgeCount();
      friendsBadgeAcknowledgedRef.current = Math.max(
        friendsBadgeAcknowledgedRef.current,
        live,
      );
      dismissFriendsNotificationsAt(live);
    } catch {
      /* best-effort — banner still hides below */
    }
    setHomeNotice(null);
  }, []);

  /* ── Persist board mode / patterns / difficulty ─────────────────────── */
  useEffect(() => {
    sessionStorage.setItem("pp_multiRoomCode", multiRoomCode);
    if (multiPlayerSlot) sessionStorage.setItem("pp_multiPlayerSlot", multiPlayerSlot);
    else sessionStorage.removeItem("pp_multiPlayerSlot");
    sessionStorage.setItem("pp_isRanked", String(isRanked));
    sessionStorage.setItem("pp_boardMode", boardMode);
    localStorage.setItem("pp_boardMode", boardMode);
    sessionStorage.setItem("pp_selectedPatterns", JSON.stringify(selectedPatterns));
    localStorage.setItem("pp_selectedPatterns", JSON.stringify(selectedPatterns));
    localStorage.setItem("pp_ai_difficulty", aiDifficulty);
  }, [multiRoomCode, multiPlayerSlot, isRanked, boardMode, selectedPatterns, aiDifficulty]);

  /* ── Custom theme event ─────────────────────────────────────────────── */
  useEffect(() => {
    const h = () => {
      THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;
      setCustomRev((r) => r + 1);
    };
    window.addEventListener("pp_custom_theme_changed", h);
    return () => window.removeEventListener("pp_custom_theme_changed", h);
  }, []);

  /* ── Audio init on first interaction ────────────────────────────────── */
  useEffect(() => {
    const start = () => {
      if (audioStartedRef.current) return;
      audioStartedRef.current = true;
      setAudioStarted(true);
      if (isStaticSilentPage) return;
      const scr = pathnameToScreen(window.location.pathname);
      if (scr === "auth" || showPolicyGateRef.current || tutorialOpenRef.current) {
        audio.playAuthBgm(themeRef.current);
      } else {
        const lockedMatchCtx: "game" | "ranked" | null = isMatchPath
          ? (multiRoomCode ? (rankedRef.current ? "ranked" : "game") : aiMatchBgmCtx)
          : null;
        audio.playBgm(
          themeRef.current,
          getBgmCtx(scr, rankedRef.current, aiDiffRef.current, lockedMatchCtx),
        );
      }
    };
    start();
    window.addEventListener("click", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("touchstart", start, { once: true });
    return () => {
      window.removeEventListener("click", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("touchstart", start);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, isStaticSilentPage]);

  /* ── Recover from stale-chunk deploy mismatch ─────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const RELOAD_FLAG = "pp_chunk_reload_once";
    const shouldRecover = (value: unknown): boolean => {
      const msg = String(value ?? "");
      return (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module")
      );
    };
    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      if (shouldRecover(e.message) || shouldRecover((e as any).error?.message)) {
        reloadOnce();
      }
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const reason = (e as any).reason;
      if (shouldRecover(reason?.message ?? reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  /* ── BGM context switching ──────────────────────────────────────────── */
  useEffect(() => {
    if (!audioStarted) return;
    if (isStaticSilentPage) {
      audio.pauseBgm();
      return;
    }
    // Tutorial (first-run gate or Training→Tutorial replay) shares the auth
    // BGM — same "intro / instructional" mood and keeps music continuous
    // across the policy-gate → tutorial → lobby handoff on new accounts.
    if (currentScreen === "auth" || showPolicyGate || tutorialOpen) {
      audio.playAuthBgm(themeId);
    } else {
      const lockedMatchCtx: "game" | "ranked" | null = isMatchPath
        ? (multiRoomCode ? (isRanked ? "ranked" : "game") : aiMatchBgmCtx)
        : null;
      audio.playBgm(
        themeId,
        getBgmCtx(currentScreen, isRanked, aiDifficulty, lockedMatchCtx),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId, currentScreen, isRanked, aiDifficulty, audioStarted, showPolicyGate, isStaticSilentPage, tutorialOpen, isMatchPath, isBotGameRoute, multiRoomCode, aiMatchBgmCtx]);

  /* ── Queue elapsed timer ────────────────────────────────────────────── */
  useEffect(() => {
    if (queuePhase !== "queuing") { setQueueElapsed(0); return; }
    const iv = setInterval(() => setQueueElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, [queuePhase]);

  /* ── Multiplayer nav lock ───────────────────────────────────────────── */
  useEffect(() => {
    if (currentScreen === "multiGame" || (isMatchPath && multiRoomCode))
      setMultiplayerNavUnlocked(false);
  }, [currentScreen, isMatchPath, multiRoomCode]);

  useEffect(() => {
    if (!isMatchPath) setMultiplayerRulesBootstrap(null);
  }, [isMatchPath]);

  /* ── goto-store custom event ────────────────────────────────────────── */
  useEffect(() => {
    const h = () => navigate("store");
    window.addEventListener("pp_goto_store", h);
    return () => window.removeEventListener("pp_goto_store", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Theme                                                                 */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const setThemeId = (id: ThemeId) => {
    if (id === themeId) return;
    setThemeIdRaw(id);
    localStorage.setItem("pp_theme", id);
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Navigation                                                            */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const navigate = useCallback(
    (s: Screen, opts?: SetScreenOptions) => {
      const rawCur = pathnameToScreen(pathname);
      // A /game/g{n}/{id}?bot={name} route is really an AI game for exit-modal purposes.
      const cur = isBotGameRoute ? "aiGame" : rawCur;

      if (cur === "aiGame" && s !== "aiGame" && s !== "game") {
        sfx.click();
        setPendingNavTarget(s);
        setShowAiExitModal(true);
        return;
      }

      // MultiGame cleanup
      const isOnGame = isMatchPath;
      if (isOnGame && multiRoomCode) {
        if (opts?.exitMultiGameToCareer) {
          sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
          sessionStorage.removeItem("pp_multiRoomCode");
          sessionStorage.removeItem("pp_multiPlayerSlot");
          sessionStorage.removeItem("pp_isRanked");
        }
        if (s === "home" || s === "career" || s === "lobby" || s === "auth") {
          setMultiRoomCode("");
          setMultiPlayerSlot(null);
          sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
          sessionStorage.removeItem("pp_multiRoomCode");
          sessionStorage.removeItem("pp_multiPlayerSlot");
          sessionStorage.removeItem("pp_isRanked");
        }
      }

      if (s === "patchNotes") {
        window.open(ROUTES.PATCHNOTES, "_blank");
        return;
      }

      if (s === "policy_gate") {
        setShowPolicyGate(true);
        return;
      }

      const url = screenToUrl(s);
      if (url) {
        try {
          router.push(url);
        } catch {
          // Rare Next.js dev/runtime edge case: client-side RSC fetch for
          // the target route fails (network hiccup, stale dev cache, etc.).
          // Fall back to a full document navigation so the user still moves.
          if (typeof window !== "undefined") {
            window.location.assign(url);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, user, multiRoomCode, sfx, router, isBotGameRoute, isMatchPath],
  );

  const navigateToGame = useCallback(
    (bm: BoardMode, variant?: string) => {
      router.push(buildGameUrl(bm, variant));
    },
    [sfx, router],
  );

  const navigateToChallenge = useCallback(
    (bm: BoardMode, difficulty: Difficulty) => {
      router.push(buildChallengeUrl(bm, difficulty));
    },
    [sfx, router],
  );

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Matchmaking                                                           */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const postOnce = async (url: string, data: any, config: any) =>
    API.post(url, data, { ...config, timeout: 15000 });

  const handleRoomReady = useCallback(
    (
      roomCode: string,
      playerSlot: "P1" | "P2",
      format: string,
      matchup?: MatchupData,
      roomFromServer?: any,
    ) => {
      sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
      if (roomFromServer?.board_mode) setBoardMode(roomFromServer.board_mode as BoardMode);
      if (Array.isArray(roomFromServer?.selected_patterns))
        setSelectedPatterns(roomFromServer.selected_patterns);
      const bootstrap = multiplayerRulesBootstrapFromRoom(roomFromServer);
      setMultiplayerRulesBootstrap(bootstrap);
      setMultiRoomCode(roomCode);
      setMultiPlayerSlot(playerSlot);
      setIsRanked(format === "ranked");
      if (matchup) setMultiMatchup(matchup);

      const bm = (roomFromServer?.board_mode as BoardMode) || boardMode;
      const id = generateGameId();
      // When the fresh room is awaiting a rules-show acknowledgement (the
      // normal case for newly matched games) we jump straight to the
      // `/rulesshow/{id}` URL. Previously we first pushed `/game/{sk}/{id}`
      // and then relied on GameScreen's URL-sync effect to move the URL to
      // `/rulesshow/{id}`, which created an extra route flip immediately
      // after `/play/matchfound`. Some browsers painted one frame of the
      // intermediate /game/ URL on top of the just-unmounted match-found
      // screen, giving the appearance of the VS animation briefly
      // re-appearing before rules-show. Routing directly to
      // `/rulesshow/{id}` removes the double-hop entirely, so the visible
      // transition is exactly: /play/matchfound → /rulesshow/{id}.
      // `friend_invite` source is legacy — match invites were removed from
      // the client, so this branch is effectively unused now. Kept only so
      // a `bootstrap` request still skips straight to the rules-show URL.
      const nextUrl = bootstrap ? buildRulesShowUrl(id) : buildGameUrl(bm);
      router.push(nextUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardMode, router],
  );

  // `pp_friend_invite_accepted` listener removed: match invites are no
  // longer a client feature. Players share custom-room codes via DM and
  // the joiner enters the room via the regular room-code flow instead.

  /**
   * Arm the VS → bot-game sequence when the 1–10 s unranked filler timer
   * fires before a real opponent is found. Mirrors `armMatchFoundSequence`
   * but instead of calling `handleRoomReady` (which would need a Mongo
   * room + WS), it navigates into `/game/...?unranked_bot=1&...` so the
   * existing AI code path takes over.
   */
  const armUnrankedBotMatchSequence = useCallback(
    (code: string | null, bot: PickedBot, mode: "unranked", bMode: BoardMode) => {
      if (matchFoundArmRef.current) return;
      matchFoundArmRef.current = true;
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
      clearMatchFoundPostVsTimer();
      clearUnrankedBotTimer();

      const style = styleForLevel(bot.level);
      // Shape the opponent object for LobbyScreen.MatchPlayerCard. Unranked
      // filler bots don't carry an ELO, so the VS card shows "LEVEL NNN"
      // instead. The numeric level is sampled once from the tier's range
      // (ROOKIE 1–10, SKILLED 10–25, ELITE 25–50, MYTHIC 50–75, CRACKED
      // 75–99, CHRONICLE 100–500, MYTHOS 1000) and pinned onto the match
      // URL so a refresh / route transition doesn't re-roll it.
      //
      // Cosmetics: MYTHOS always wears its bespoke dark devil-cat PFP and a
      // plasma_core banner for consistent branding. Regular filler bots get
      // a freshly-randomised animal emoji (shown instead of an <img>) and a
      // random animated banner from the store pool, so every queue pairs you
      // with a visually-distinct opponent rather than the generic silhouette.
      const botEmoji = bot.isMythos ? null : pickUnrankedBotEmoji();
      const botBanner = bot.isMythos ? "plasma_core" : pickUnrankedBotBanner();
      const botNumericLevel = numericLevelForTier(bot.level);

      // Quietly leave the real queue room we were parked in — the bot match
      // runs entirely client-side via the AI flow. Fire-and-forget.
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      if (code) {
        API.post(
          "/api/room/queue/leave",
          { format: mode, board_mode: bMode, room_code: code },
          { ...authHeader, timeout: 10000 },
        ).catch(() => { /* ignore — cleanup only */ });
      }
      setQueueRoomCode(null);

      // Minimum VS-card display for filler-bot matches. Because the bot
      // side has no real network, the previous 2–3.5 s reveal felt
      // jarringly short compared to multiplayer. We clamp to a 5 s floor
      // so the MATCH FOUND reveal, banner animation and level badge have
      // time to land; a human-side network hiccup would only extend this,
      // never shorten it. Applies equally to MYTHOS — the boss intro
      // deserves the extra breathing room.
      const vsDurationMs = 5000;
      const boardSize = simpleSizeFromBoardMode(bMode);
      const gameId = generateGameId();

      // Mirror the server's unranked 5×5 behaviour: pick 5-of-6 patterns
      // at queue time so the rules-show page has a real list to reveal
      // and `/api/bot/move` gets the pool through the `selected_patterns`
      // field. 6×6 / 7×7 already have all-pattern engines, so we leave
      // their selection untouched.
      //
      // We pin the picked list on the match URL (as `patterns=V,L,T,...`)
      // so the (match) layout can hydrate `selectedPatterns` directly from
      // the URL. That sidesteps a React state race where the setter below
      // hadn't flushed yet by the time GameScreen mounted, which left the
      // SHOW-PATTERNS overlay showing only 4 of the 5 picks.
      const pickedPatterns5x5 =
        boardSize === "5x5" ? pickRandomPatterns5x5(5) : undefined;
      if (pickedPatterns5x5) {
        setSelectedPatterns(pickedPatterns5x5);
      }

      // Align ctx.boardMode so the (match) layout's `inferredBoardMode`
      // fallback resolves correctly when we land on /rulesshow/<id> (which
      // has no size segment).
      setBoardMode(bMode);

      // Route DIRECTLY into /rulesshow/<id>?… to mirror the multiplayer
      // handshake. Previously we landed on /game/g{n}/<id> first and let
      // GameScreen's URL-sync effect flip the address to /rulesshow/<id>,
      // which left one frame where the game view was visible before the
      // rules overlay mounted — some users saw that flicker as "rules
      // appeared AFTER G1". Jumping straight to the rules URL removes the
      // intermediate hop entirely, so the transition is exactly:
      // /play/matchfound → /rulesshow/<id>?unranked_bot=1&… → READY → game.
      const url = buildUnrankedBotRulesShowUrl({
        gameId,
        bot,
        boardSize,
        patterns: pickedPatterns5x5,
        // Pin cosmetics + numeric level onto the URL so the (match)
        // layout can reconstruct the bot's VS identity after
        // `setMatchupOpponent(null)` clears context below. Without
        // this, GameScreen falls back to the generic BOT silhouette
        // and the sidebar shows a default banner instead of the one
        // the user just saw on the VS card.
        botBanner,
        botLevel: botNumericLevel,
        botEmoji: botEmoji ?? undefined,
      });

      // `buildUnrankedBotGameUrl` is still used by legacy call sites; keep
      // the import pinned so tree-shaking doesn't drop it.
      void buildUnrankedBotGameUrl;

      // Closure that lights up the matchup VS card and schedules the
      // hand-off into /rulesshow. Identical for both regular and MYTHOS
      // encounters — the only difference is that MYTHOS waits for the
      // PREPARING-MYTHOS overlay to finish before this fires.
      const runMatchupReveal = () => {
        setMatchupOpponent({
          name: bot.name,
          elo: null,
          avatar: bot.isMythos ? MYTHOS_PFP_URL : null,
          avatarEmoji: botEmoji,
          banner: botBanner,
          level: botNumericLevel,
          placement_matches: 5,
          isBot: true,
          botLevel: bot.level,
          botLevelColor: style.color,
          botIsMythos: bot.isMythos,
        });
        setQueuePhase("matchup");
        sfx.matchFound();
        router.push(ROUTES.PLAY_MATCHFOUND);

        matchFoundPostVsTimerRef.current = setTimeout(() => {
          matchFoundPostVsTimerRef.current = null;
          setInQueue(false);
          setQueuePhase("none");
          setMatchupOpponent(null);
          matchmakingActiveRef.current = false;
          matchFoundArmRef.current = false;
          router.push(url);
        }, vsDurationMs);
      };

      // MYTHOS gets a dedicated "PREPARING MYTHOS..." charging overlay
      // BEFORE the standard match-found VS card. The overlay reuses the
      // level-up component's blood-red ascension beats (radial flare +
      // rotating spinner) plus a violet halo so MYTHOS feels like a
      // boss arrival rather than a normal queue pop. We hold the matchup
      // setter behind a setTimeout so the VS card doesn't peek through
      // the intro: render order is intro overlay (zIndex 120000) > VS
      // card (rendered into the matchfound route below).
      if (bot.isMythos) {
        clearMythosIntroTimer();
        setMythosIntroVisible(true);
        // Slightly longer than the MythosIntroScreen default (3000 ms)
        // to give the violet halo + headline a beat to settle before
        // the VS card animates in. The intro screen also calls
        // `onDoneAction` itself; this timer is the safety net.
        const introHoldMs = 3200;
        mythosIntroTimerRef.current = setTimeout(() => {
          mythosIntroTimerRef.current = null;
          setMythosIntroVisible(false);
          runMatchupReveal();
        }, introHoldMs);
      } else {
        runMatchupReveal();
      }
    },
    [
      clearMatchFoundPostVsTimer,
      clearMythosIntroTimer,
      clearUnrankedBotTimer,
      router,
      sfx,
      token,
      setBoardMode,
      setSelectedPatterns,
    ],
  );

  const armMatchFoundSequence = useCallback(
    (
      code: string,
      slot: "P1" | "P2",
      mode: "ranked" | "unranked",
      opp: {
        name: string;
        elo: number;
        avatar: string | null;
        banner: string;
        level: number;
        placement_matches: number;
      },
      roomPayload: any,
    ) => {
      if (matchFoundArmRef.current) return;
      matchFoundArmRef.current = true;
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
      // Real opponent beat the bot timer — cancel the filler.
      clearUnrankedBotTimer();
      clearMatchFoundPostVsTimer();
      setMatchupOpponent(opp);
      setQueuePhase("matchup");
      sfx.matchFound();
      router.push(ROUTES.PLAY_MATCHFOUND);
      matchFoundPostVsTimerRef.current = setTimeout(() => {
        matchFoundPostVsTimerRef.current = null;
        setInQueue(false);
        setQueuePhase("none");
        matchmakingActiveRef.current = false;
        matchFoundArmRef.current = false;
        handleRoomReady(code, slot, mode, undefined, roomPayload);
      }, 10000);
    },
    [clearMatchFoundPostVsTimer, handleRoomReady, router, sfx],
  );

  const pollQueueStatus = async (
    code: string,
    slot: "P1" | "P2",
    mode: "ranked" | "unranked",
  ) => {
    if (queueCancelledRef.current) return;
    try {
      const poll = await API.get(`/api/room/queue/status/${code}`, { timeout: 10000 });
      if (poll.data.game_status === "playing") {
        // Second in-flight poll must not re-run VS / sfx / router after the first "playing".
        if (matchFoundArmRef.current) return;
        const prefix = slot === "P1" ? "player2" : "player1";
        const opp = {
          name: poll.data[`${prefix}_name`] ?? "OPPONENT",
          elo: poll.data[`${prefix}_elo`] ?? 1000,
          avatar: poll.data[`${prefix}_avatar`] ?? null,
          banner: poll.data[`${prefix}_banner`] ?? poll.data[`${prefix}_banner_style`] ?? "default",
          level: poll.data[`${prefix}_level`] ?? 1,
          // Needed by LobbyScreen to decide whether to hide opponent ELO
          // (placement period = < 5 ranked games played). Defaulting to a
          // post-placement value prevents every opponent from showing as "?".
          placement_matches: poll.data[`${prefix}_placement_matches`] ?? 5,
        };
        armMatchFoundSequence(code, slot, mode, opp, poll.data);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        if (queuePollRef.current) {
          clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
        matchFoundArmRef.current = false;
        clearMatchFoundPostVsTimer();
        setInQueue(false);
        setQueuePhase("none");
        matchmakingActiveRef.current = false;
        setQueueError("Session expired. Please sign in again.");
      }
    }
  };

  const startMatchmaking = async (mode: "ranked" | "unranked") => {
    if (matchmakingActiveRef.current) return;
    matchmakingActiveRef.current = true;
    queueCancelledRef.current = false;
    matchFoundArmRef.current = false;
    clearMatchFoundPostVsTimer();
    setIsRanked(mode === "ranked");
    setInQueue(true);
    setQueuePhase("queuing");
    setQueueElapsed(0);
    setQueueError(null);
    // Reflect the queue in the URL: /unranked/queue or /ranked/queue
    router.push(mode === "ranked" ? ROUTES.RANKED_QUEUE : ROUTES.UNRANKED_QUEUE);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const boardModeForQueue = mode === "ranked" ? ("5x5_6x6_7x7" as const) : boardMode;

    try {
      const res = await postOnce(
        "/api/room/queue/join",
        { format: mode, board_mode: boardModeForQueue },
        authHeader,
      );
      if (queueCancelledRef.current) {
        matchmakingActiveRef.current = false;
        try {
          const leaveCodeEarly = res.data?.room_code as string | undefined;
          await API.post(
            "/api/room/queue/leave",
            {
              format: mode,
              board_mode: boardModeForQueue,
              ...(leaveCodeEarly ? { room_code: leaveCodeEarly } : {}),
            },
            { ...authHeader, timeout: 10000 },
          );
        } catch { /* ignore */ }
        return;
      }

      const code = res.data.room_code;
      const slot = res.data.player_slot as "P1" | "P2";
      setQueueRoomCode(code);
      setQueuePlayerSlot(slot);
      queueRoomCodeRef.current = code;
      queuePlayerSlotRef.current = slot;

      if (res.data.matched) {
        const room = res.data.room;
        const prefix = slot === "P1" ? "player2" : "player1";
        const opp = {
          name: room[`${prefix}_name`] ?? "OPPONENT",
          elo: room[`${prefix}_elo`] ?? 1000,
          avatar: room[`${prefix}_avatar`] ?? null,
          banner: room[`${prefix}_banner`] ?? room[`${prefix}_banner_style`] ?? "default",
          level: room[`${prefix}_level`] ?? 1,
          // See note above: default to 5 so finished-placement opponents
          // actually show their real ELO on the match-found screen.
          placement_matches: room[`${prefix}_placement_matches`] ?? 5,
        };
        armMatchFoundSequence(code, slot, mode, opp, room);
      } else {
        if (queuePollRef.current) clearInterval(queuePollRef.current);
        queuePollRef.current = setInterval(
          () => pollQueueStatus(code, slot, mode),
          2000,
        );

        // Unranked queues race a 10–15 s filler-bot timer. If the real
        // matchmaker pairs the user with a human before the timer fires,
        // `armMatchFoundSequence` clears this and takes over naturally.
        //
        // The user can opt out of bot fillers from the lobby toggle
        // (`isUnrankedBotsAllowed()` -> false). When opted out we never
        // schedule the timer, so the unranked queue waits indefinitely
        // for a real human opponent.
        if (mode === "unranked") {
          clearUnrankedBotTimer();
          const { isUnrankedBotsAllowed } = await import("@/lib/unrankedBots");
          if (isUnrankedBotsAllowed()) {
            const waitMs = pickQueueWaitMs();
            unrankedBotTimerRef.current = setTimeout(() => {
              unrankedBotTimerRef.current = null;
              if (queueCancelledRef.current) return;
              if (matchFoundArmRef.current) return;
              // Re-check the preference at fire time so a user toggling
              // bots off mid-queue still gets a human-only wait.
              if (!isUnrankedBotsAllowed()) return;
              const bot = pickUnrankedBot();
              armUnrankedBotMatchSequence(code, bot, "unranked", boardModeForQueue);
            }, waitMs);
          }
        }
      }
    } catch (err: any) {
      console.error("Matchmaking error:", err);
      if (queueCancelledRef.current) { matchmakingActiveRef.current = false; return; }
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const msg =
        (status === 403 || status === 401) && typeof detail === "string" && detail.trim()
          ? detail
          : "Connection issue — still searching...";
      setQueueError(msg);
      matchmakingActiveRef.current = false;
      matchFoundArmRef.current = false;
      clearMatchFoundPostVsTimer();
    }
  };

  const cancelMatchmaking = async () => {
    queueCancelledRef.current = true;
    matchmakingActiveRef.current = false;
    matchFoundArmRef.current = false;
    clearMatchFoundPostVsTimer();
    clearUnrankedBotTimer();
    clearMythosIntroTimer();
    setMythosIntroVisible(false);
    if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
    const mode = isRanked ? "ranked" : "unranked";
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const code = queueRoomCodeRef.current;
    const boardModeForQueue = mode === "ranked" ? "5x5_6x6_7x7" : boardMode;
    if (code) {
      try {
        await API.post(
          "/api/room/queue/leave",
          {
            format: mode,
            board_mode: boardModeForQueue,
            room_code: code,
          },
          { ...authHeader, timeout: 10000 },
        );
      } catch { /* ignore */ }
    }
    setInQueue(false);
    setQueuePhase("none");
    setQueueRoomCode(null);
    setQueueError(null);
    setMatchupOpponent(null);
    // Return the user to the main lobby URL when queue is abandoned.
    if (typeof window !== "undefined") {
      const p = window.location.pathname;
      if (
        p.startsWith("/unranked/") ||
        p.startsWith("/ranked/") ||
        p.startsWith("/play/matchfound")
      ) {
        router.push(ROUTES.PLAY_LOBBY);
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Helpers                                                               */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const handleForfeitMatch = async () => {
    if (!activeMatchData?.room_code || !token) return;
    try {
      await API.post(
        "/api/room/forfeit",
        { room_code: activeMatchData.room_code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setActiveMatchData(null);
      setHomeNotice("Match forfeited.");
    } catch (e) {
      console.error("Forfeit failed", e);
    }
  };

  const confirmAiExit = () => {
    setShowAiExitModal(false);
    if (pendingNavTarget) {
      const url = screenToUrl(pendingNavTarget);
      if (url) router.push(url);
      setPendingNavTarget(null);
    }
  };

  const cancelAiExit = () => {
    sfx.click();
    setShowAiExitModal(false);
    setPendingNavTarget(null);
  };

  const sealMultiSeriesNavigation = useCallback(() => {
    if (typeof window !== "undefined")
      sessionStorage.setItem(PP_MULTI_SERIES_FINISHED_KEY, "1");
  }, []);

  const resumeMultiSeriesNavigation = useCallback(() => {
    if (typeof window !== "undefined")
      sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Context value                                                         */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const ctx: AppContextType = {
    themeId: routeThemeId,
    setThemeId,
    fadingOut,
    audio,
    sfx,
    user,
    token,
    appReady,
    navigate,
    currentScreen,
    boardMode,
    setBoardMode,
    selectedPatterns,
    setSelectedPatterns,
    aiDifficulty,
    setAiDifficulty,
    queuePhase,
    queueElapsed,
    matchupOpponent,
    queueError,
    inQueue,
    startMatchmaking,
    cancelMatchmaking,
    multiRoomCode,
    multiPlayerSlot,
    multiMatchup,
    multiplayerRulesBootstrap,
    isRanked,
    handleRoomReady,
    multiplayerNavUnlocked,
    setMultiplayerNavUnlocked,
    graphicsQuality,
    homeNotice,
    setHomeNotice,
    dismissHomeNotice,
    showSettings,
    setShowSettings,
    sealMultiSeriesNavigation,
    resumeMultiSeriesNavigation,
    navigateToGame,
    navigateToChallenge,
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Loading state                                                         */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (!appReady) {
    return (
      <AppContext.Provider value={ctx}>
        <div
          style={{ minHeight: "100vh", background: routeThemeId === "space" ? "#02040F" : t.bg }}
          aria-busy="true"
        />
      </AppContext.Provider>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Render                                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const isGameScreen = isMatchPath || pathname.startsWith("/challenge/");
  /** Space parallax canvas: skip entry shells (same idea as /home — no animated bg behind full UI). */
  const noSpaceParallaxBg =
    pathname === ROUTES.HOME ||
    pathname === ROUTES.ROOT ||
    pathname === ROUTES.AUTH ||
    pathname === "/auth";
  /** Match-found + live match URLs use full-viewport shells (Lobby / GameScreen) — no top nav. */
  const hideNavForImmersivePlay =
    pathname === ROUTES.PLAY_MATCHFOUND || isGameScreen;

  const showNavBar =
    pathname !== ROUTES.AUTH &&
    pathname !== "/auth" &&
    pathname !== "/" &&
    !showPolicyGate &&
    !tutorialOpen &&
    !hideNavForImmersivePlay;

  const GlobalMatchupOverlay = () => {
    if (queuePhase !== "matchup" || !matchupOpponent) return null;
    // Each matchmaking / match-found route already renders its own LobbyScreen
    // with the right forcedPhase. Rendering the global overlay on top of those
    // pages causes a duplicate LobbyScreen to mount, which the user perceives
    // as the queue/matchup screen "showing twice" during route transitions.
    // Only use the overlay as a fallback on unrelated routes.
    //
    // We also blacklist every match-flow route (/game, /ready, /rulesshow,
    // /rulechoice, /rulebreaker). Without this, during the brief moment
    // between `router.push("/game/...")` firing and React flushing
    // `setQueuePhase("none")`, a render can land with pathname=/game/... but
    // queuePhase still "matchup" — which makes the match-found screen
    // briefly re-appear on top of the rulesshow page, exactly as the user
    // reported.
    const ownedByRoute =
      pathname === ROUTES.PLAY_MATCHFOUND ||
      pathname === ROUTES.UNRANKED_QUEUE ||
      pathname === ROUTES.RANKED_QUEUE ||
      pathname === ROUTES.CUSTOM_ROOM_CREATE ||
      pathname === ROUTES.PLAY_LOBBY ||
      pathname.startsWith("/game/") ||
      pathname.startsWith("/ready/") ||
      pathname.startsWith("/rulesshow/") ||
      pathname.startsWith("/rulechoice/") ||
      pathname.startsWith("/rulebreaker/");
    if (ownedByRoute) return null;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: t.bg }}>
        <LobbyScreen
          setScreenAction={navigate}
          themeId={routeThemeId}
          onQueueStartAction={startMatchmaking}
          onQueueCancelAction={cancelMatchmaking}
          onHoverAction={sfx.hover}
          onClickAction={sfx.click}
          onRoomReadyAction={handleRoomReady}
          queuePhase={queuePhase}
          queueElapsed={queueElapsed}
          matchupOpponent={matchupOpponent}
          queueError={queueError}
          forcedPhase="matchup"
          boardMode={boardMode}
          onBoardModeAction={setBoardMode}
          isRanked={isRanked}
        />
      </div>
    );
  };

  return (
    <AppContext.Provider value={ctx}>
      <div
        style={{
          minHeight: "100vh",
          background: routeThemeId === "space" ? "transparent" : t.bg,
          color: t.text,
          fontFamily: t.fontBody,
        }}
      >
        {routeThemeId === "space" && !isGameScreen && !noSpaceParallaxBg && <SpaceBg />}

        {/* Theme fade overlay */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "#000",
            opacity: fadingOut ? 1 : 0,
            pointerEvents: fadingOut ? "all" : "none",
            transition: fadingOut ? "opacity 0.28s ease" : "opacity 0.32s ease",
          }}
        />

        {/* Duplicate session modal */}
        {logoutReason === "duplicate_session" && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              background: "rgba(0,0,0,0.92)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            <div
              style={{
                background: t.bgPanel,
                border: `1px solid ${t.danger}55`,
                borderRadius: ip ? 2 : 20,
                padding: ip ? "32px 36px" : "48px 52px",
                maxWidth: 460,
                width: "90vw",
                textAlign: "center",
                boxShadow: `0 0 60px ${t.danger}22, 0 40px 100px rgba(0,0,0,0.8)`,
                animation: "scaleIn 0.28s cubic-bezier(.22,.68,0,1.2) both",
              }}
            >
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: ip ? 11 : 12,
                  fontWeight: 700,
                  color: t.danger,
                  letterSpacing: "0.18em",
                  marginBottom: 16,
                  textTransform: "uppercase",
                }}
              >
                Session Terminated
              </div>
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: ip ? 16 : 22,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 16,
                  lineHeight: 1.4,
                }}
              >
                You were signed in elsewhere
              </div>
              <div
                style={{
                  fontFamily: t.fontBody,
                  fontSize: ip ? 12 : 14,
                  color: t.textMuted,
                  marginBottom: 36,
                  lineHeight: 1.7,
                }}
              >
                Your account was opened on another device or browser tab. Only one active
                session is allowed at a time.
              </div>
              <button
                onClick={() => {
                  setLogoutReason(null);
                  router.push(ROUTES.AUTH);
                }}
                style={{
                  background: t.accent,
                  border: "none",
                  color: "#000",
                  fontFamily: t.fontDisplay,
                  fontSize: ip ? 12 : 15,
                  fontWeight: 800,
                  padding: ip ? "10px 28px" : "13px 44px",
                  borderRadius: ip ? 2 : 10,
                  cursor: "pointer",
                  letterSpacing: "0.08em",
                  boxShadow: `0 0 24px ${t.accentGlow}44`,
                }}
              >
                SIGN IN AGAIN
              </button>
            </div>
          </div>
        )}

        {/* First-run / replay tutorial overlay — sits above everything
         *   except the PolicyAcceptanceGate (which gates the tutorial
         *   gate itself). */}
        {tutorialOpen && user && token && (
          <TutorialScreen
            themeId={routeThemeId}
            userId={getUserId(user)}
            token={token}
            mode={tutorialMode}
            onDoneAction={(result) => {
              setTutorialOpen(false);
              if (tutorialMode === "gate") {
                // Reflect the decision on the in-memory user so other
                // `shouldShowTutorialGate` checks (e.g. remount) stop firing.
                useAuthStore.getState().updateUser({
                  onboarding_tutorial: normalizeTutorialState(result),
                });
                // Kick a profile refresh so any stale cached fields converge
                // with the server-side write that TutorialScreen just made.
                void useAuthStore.getState().refreshProfile();
              }
            }}
          />
        )}

        {/* Policy acceptance gate */}
        {showPolicyGate && (
          <PolicyAcceptanceGate
            themeId={routeThemeId}
            user={user}
            onAcceptedAction={() => {
              const u = useAuthStore.getState().user;
              const uid = getUserId(u);
              if (uid) {
                useAuthStore.getState().updateUser({
                  legal_accepted: true,
                  legal_accepted_version: LEGAL_VERSION,
                });
              }
              router.replace("/home");
              setShowPolicyGate(false);
              void useAuthStore.getState().refreshProfile();
            }}
            onDeclinedAction={() => {
              logout();
              setShowPolicyGate(false);
              router.push(ROUTES.AUTH);
            }}
          />
        )}

        <GlobalMatchupOverlay />

        {/* PREPARING MYTHOS… overlay. Spawned only when the unranked
            filler timer rolls a MYTHOS encounter, BEFORE the matchup VS
            card is shown. Sits at zIndex 120000 (defined inside the
            component) so it covers the lobby AND the just-pushed
            /play/matchfound route. The component manages its own
            auto-complete timer; the parent's safety-net setTimeout
            (`mythosIntroTimerRef`) is the source of truth for switching
            to the matchup state, so even if the component never fires
            its callback we still proceed cleanly. */}
        {mythosIntroVisible && (
          <MythosIntroScreen
            durationMs={3000}
            fontDisplay={t.fontDisplay}
            fontMono={t.fontMono}
            onDoneAction={() => { /* AppShell timer drives the swap */ }}
          />
        )}

        {/* AI exit confirmation modal.
         *
         * Unranked filler-bot sessions (`?unranked_bot=1`) and explicit
         * AI matches (the AI screen → bot picker flow) both route through
         * `isBotGameRoute === true`, so this same modal fires for both.
         * The unranked queue is supposed to feel like ordinary
         * matchmaking — i.e. the player should not be told the
         * opponent is a bot — so we swap the title + body copy to a
         * generic "Leave Match?" wording when the route carries the
         * `unranked_bot` flag. Explicit AI matches keep the existing
         * "Leave AI Match?" copy because the player chose a bot
         * intentionally there. */}
        {showAiExitModal && (() => {
          const isUnrankedBotExit = searchParams?.get("unranked_bot") === "1";
          const exitTitle = isUnrankedBotExit ? "Leave Match?" : "Leave AI Match?";
          const exitBody = isUnrankedBotExit
            ? "Your current match will be lost."
            : "Your current game against the bot will be lost.";
          return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              background: "rgba(0,0,0,0.88)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "fadeIn 0.2s ease both",
            }}
          >
            <div
              style={{
                background: t.bgPanel,
                border: `${ip ? 3 : 1}px solid ${t.border}`,
                borderRadius: ip ? 2 : 20,
                padding: ip ? "32px 36px" : "48px 56px",
                maxWidth: 480,
                width: "90vw",
                textAlign: "center",
                boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                animation: "scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both",
              }}
            >
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: ip ? 14 : 22,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                {exitTitle}
              </div>
              <div
                style={{
                  fontFamily: t.fontBody,
                  fontSize: ip ? 12 : 15,
                  color: t.textMuted,
                  marginBottom: 36,
                  lineHeight: 1.7,
                }}
              >
                {exitBody}
              </div>
              <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                <button
                  onClick={confirmAiExit}
                  onMouseEnter={sfx.hover}
                  style={{
                    background: `${t.danger}18`,
                    border: `2px solid ${t.danger}`,
                    color: t.danger,
                    fontFamily: t.fontDisplay,
                    fontSize: ip ? 12 : 16,
                    fontWeight: 700,
                    padding: ip ? "10px 28px" : "13px 44px",
                    borderRadius: ip ? 2 : 10,
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                  }}
                >
                  YES, LEAVE
                </button>
                <button
                  onClick={cancelAiExit}
                  onMouseEnter={sfx.hover}
                  style={{
                    background: `${t.accent}18`,
                    border: `2px solid ${t.accent}`,
                    color: t.accent,
                    fontFamily: t.fontDisplay,
                    fontSize: ip ? 12 : 16,
                    fontWeight: 700,
                    padding: ip ? "10px 28px" : "13px 44px",
                    borderRadius: ip ? 2 : 10,
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                  }}
                >
                  NO, STAY
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Global CSS */}
        <style>{`
          [data-theme="space"], .space-theme, body {
            --font-display: 'GuildOf', serif;
            --font-body: 'GuildOf', serif;
            --font-mono: 'GuildOf', serif;
          }
          * { user-select: none !important; -webkit-user-select: none !important; }
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=EB+Garamond:wght@400;500;600&family=Courier+Prime&family=Fira+Code:wght@400;500;700&family=VT323&family=Audiowide&family=Jura:wght@400;600;700&family=Share+Tech+Mono&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: ${routeThemeId === "space" ? "#02040F" : t.bg}; }
          ::-webkit-scrollbar { width: 4px; background: ${t.bgPanel}; }
          ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 2px; }
          input { outline: none; }
          input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: ${t.border}; }
          input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 15px; height: 15px; border-radius: 50%; background: ${t.accent}; cursor: pointer; }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
          @keyframes scaleIn { from{opacity:0;transform:scale(0.88) translateY(18px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes spinRing{ to{transform:rotate(360deg)} }
          @keyframes shake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
          .fade-up { animation: fadeUp 0.45s cubic-bezier(.22,.68,0,1.2) both; }
          .shake   { animation: shake 0.4s ease; }
          button   { cursor: pointer; }
          button, a, input, select { transition: color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s; }
        `}</style>

        {/* Account-review banner (Phase 2.6): passive notice for users
            whose anti-cheat score has crossed the shadow-ban threshold.
            We keep it deliberately understated — no score, no appeal CTA
            in-product (email support instead), and we don't tell them
            they're shadow-banned from ranked; the server handles that
            silently via segregated matchmaking. */}
        {user?.under_review && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9990,
              background: "#6b1f1f",
              color: "#ffe6e6",
              fontFamily: "var(--font-body, system-ui)",
              fontSize: 13,
              letterSpacing: "0.02em",
              padding: "6px 12px",
              textAlign: "center",
              borderBottom: "1px solid #902525",
              pointerEvents: "none",
            }}
          >
            Your account is under review. Ranked progress is paused while our
            integrity team investigates. Contact support if you believe this is
            a mistake.
          </div>
        )}

        {/* NavBar */}
        {showNavBar && (
          <NavBar
            screen={currentScreen}
            setScreenAction={navigate}
            themeId={routeThemeId}
            onSettingsAction={() => {
              sfx.click();
              setShowSettings(true);
            }}
            inQueue={inQueue}
            onQueueClickAction={() => router.push(
              queuePhase === "queuing"
                ? (isRanked ? ROUTES.RANKED_QUEUE : ROUTES.UNRANKED_QUEUE)
                : ROUTES.PLAY_LOBBY
            )}
            onHoverAction={sfx.hover}
            queueElapsed={queueElapsed}
            onCancelQueueAction={cancelMatchmaking}
            lockMultiplayerNav={
              isMatchPath && multiRoomCode !== "" && !multiplayerNavUnlocked
            }
          />
        )}

        {/* Route page content — sits above SpaceBg; solid space fallback when children are null (AuthGuard / redirects). */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            ...(routeThemeId === "space" ? { background: t.bg } : {}),
          }}
        >
          {children}
        </div>

        {socialToast && (
          <div
            style={{
              position: "fixed",
              right: 16,
              bottom: 16,
              zIndex: 12050,
              background: "rgba(0,0,0,0.9)",
              border: `1px solid ${t.accent}`,
              borderRadius: 8,
              color: t.text,
              fontFamily: t.fontMono,
              fontSize: 12,
              letterSpacing: "0.04em",
              padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            }}
          >
            <span>{socialToast.text}</span>
            {socialToast.friendId && socialToast.actionLabel && (
              <button
                onClick={() => {
                  const friendId = socialToast.friendId || "";
                  setSocialToast(null);
                  if (!friendId) return;
                  if (isMatchPath) {
                    window.dispatchEvent(new CustomEvent("pp_open_friend_chat", { detail: { friendId } }));
                    return;
                  }
                  try {
                    sessionStorage.setItem("pp_open_dm_friend_id", friendId);
                  } catch {}
                  router.push(ROUTES.FRIENDS);
                }}
                style={{
                  background: `${t.accent}22`,
                  border: `1px solid ${t.accent}`,
                  color: t.accent,
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {socialToast.actionLabel}
              </button>
            )}
          </div>
        )}

        {/* Settings modal */}
        {showSettings && (
          <SettingsModal
            onCloseAction={() => setShowSettings(false)}
            themeId={routeThemeId}
            setThemeIdAction={setThemeId}
            audio={{
              musicVol: audio.musicVol,
              setMusicVol: audio.setMusicVol,
              sfxVol: audio.sfxVol,
              setSfxVol: audio.setSfxVol,
              muted: audio.muted,
              toggleMute: audio.toggleMute,
            }}
            graphicsQuality={graphicsQuality}
            setGraphicsQualityAction={() => {}}
            currentScreen={currentScreen}
            onNavigateAuthAction={() => router.push(ROUTES.AUTH)}
            suppressAccountActionsDuringMatch={suppressSettingsAccountActions}
          />
        )}

        {/* Session replaced modal */}
        {showSessionReplaced && (
          <SessionReplacedModal
            themeId={routeThemeId}
            onClose={() => {
              setShowSessionReplaced(false);
              setLogoutReason(null);
            }}
          />
        )}

        {/* Active match rejoin: ranked / unranked queue only (not custom / SP / bots). */}
        {activeMatchData &&
          (activeMatchData.format === "ranked" || activeMatchData.format === "unranked") && (
          <ActiveMatchRejoinModal
            themeId={routeThemeId}
            isRanked={activeMatchData.format === "ranked"}
            onRejoin={() => {
              const data = activeMatchData;
              setActiveMatchData(null);
              handleRoomReady(
                data.room_code,
                data.player_slot,
                data.format || (isRanked ? "ranked" : "unranked"),
              );
            }}
            onForfeit={handleForfeitMatch}
          />
        )}

        <GlobalLevelUpShowcase themeId={routeThemeId} />
      </div>
    </AppContext.Provider>
  );
}
