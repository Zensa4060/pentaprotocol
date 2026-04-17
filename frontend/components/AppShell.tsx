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
import API, { getWsBaseUrl } from "@/lib/api";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import type { MatchupData, BoardMode, Screen, SetScreenOptions } from "@/lib/types";
import { loadCustomTheme, resolveCustomTheme } from "@/lib/customTheme";
import {
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
  boardModeToSizeKey,
  GUEST_BLOCKED_SCREENS,
  ROUTES,
} from "@/lib/routes";

import NavBar from "@/components/NavBar";
import SettingsModal from "@/components/SettingsModal";
import SpaceBg from "@/components/SpaceBg";
import PolicyAcceptanceGate from "@/components/PolicyAcceptanceGate";
import SessionReplacedModal from "@/components/SessionReplacedModal";
import ActiveMatchRejoinModal from "@/components/ActiveMatchRejoinModal";
import GlobalLevelUpShowcase from "@/components/GlobalLevelUpShowcase";
import LobbyScreen from "@/components/LobbyScreen";

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
  const isBotGameRoute = !!(pathname?.startsWith("/game/") && searchParams?.get("bot"));

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

  /* ── Board / game state ─────────────────────────────────────────────────── */
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const graphicsQuality: "quality" = "quality";

  /* ── Multiplayer ────────────────────────────────────────────────────────── */
  const [multiRoomCode, setMultiRoomCode] = useState<string>("");
  const [multiPlayerSlot, setMultiPlayerSlot] = useState<"P1" | "P2" | null>(null);
  const [multiMatchup, setMultiMatchup] = useState<MatchupData | null>(null);
  const [multiplayerRulesBootstrap, setMultiplayerRulesBootstrap] =
    useState<MultiplayerRulesBootstrap | null>(null);
  const [multiplayerNavUnlocked, setMultiplayerNavUnlocked] = useState(false);

  /* ── Modals / overlays ──────────────────────────────────────────────────── */
  const [showSettings, setShowSettings] = useState(false);
  const [showGuestBlock, setShowGuestBlock] = useState(false);
  const [showAiExitModal, setShowAiExitModal] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<Screen | null>(null);
  const [showSessionReplaced, setShowSessionReplaced] = useState(false);
  const [activeMatchData, setActiveMatchData] = useState<any>(null);
  const [homeNotice, setHomeNotice] = useState<string | null>(null);

  /* ── Refs ────────────────────────────────────────────────────────────────── */
  const themeRef = useRef(themeId);
  const rankedRef = useRef(isRanked);
  const aiDiffRef = useRef(aiDifficulty);
  const profileRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  themeRef.current = themeId;
  rankedRef.current = isRanked;
  aiDiffRef.current = aiDifficulty;

  useEffect(() => { queueRoomCodeRef.current = queueRoomCode; }, [queueRoomCode]);
  useEffect(() => { queuePlayerSlotRef.current = queuePlayerSlot; }, [queuePlayerSlot]);

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const currentScreen: Screen = isBotGameRoute ? "aiGame" : pathnameToScreen(pathname);
  const t = THEMES[themeId];
  const ip = themeId === "pixel";

  const getBgmCtx = (
    scr: Screen,
    ranked: boolean,
    aiDiff: Difficulty,
  ): "lobby" | "game" | "ranked" => {
    if (scr === "aiGame")
      return aiDiff === "hard" || aiDiff === "danger" || aiDiff === "machine_god"
        ? "ranked"
        : "game";
    if (scr === "game") return "game";
    if (scr === "multiGame") return ranked ? "ranked" : "game";
    return "lobby";
  };

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Startup restore (pre-paint)                                           */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const pendingScreenRestoreRef = useRef<{
    screen: Screen;
    multiRoomCode: string;
    multiPlayerSlot: "P1" | "P2" | null;
    isRanked: boolean;
  } | null>(null);

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
      if (pathname !== "/auth" && pathname !== "/") {
        router.replace("/auth");
      }
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
    if (!restore) return;

    const tok = useAuthStore.getState().token;
    if (!tok) {
      if (pathname !== "/auth" && pathname !== "/") router.replace("/auth");
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

        if (pathname === "/" || pathname === "/auth") {
          router.replace("/home");
        }
        setAppReady(true);
      })
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 404 || status === 401) useAuthStore.getState().logout();
        router.replace("/auth");
        setAppReady(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Policy gate ────────────────────────────────────────────────────── */
  const [showPolicyGate, setShowPolicyGate] = useState(false);
  useEffect(() => {
    if (!appReady || !user || !token) return;
    const uid = getUserId(user);
    if (!uid) return;
    const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
    if (pending === uid && !hasAcceptedLegal(uid, user)) setShowPolicyGate(true);
  }, [appReady, user, token]);

  /* ── Global notify WebSocket ────────────────────────────────────────── */
  useEffect(() => {
    if (!appReady || !token) return;
    useAuthStore.getState().refreshProfile();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const wsBase = getWsBaseUrl();
      ws = new WebSocket(`${wsBase}/api/room/ws/global/notify?token=${token}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "duplicate_session") useAuthStore.getState().logout("duplicate_session");
        } catch {}
      };
      ws.onclose = () => {
        if (useAuthStore.getState().token) reconnectTimeout = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      if (ws) { ws.onclose = null; ws.close(); }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [appReady, token]);

  /* ── Token-cleared guard ────────────────────────────────────────────── */
  useEffect(() => {
    if (!appReady) return;
    if (!token && pathname !== "/auth" && pathname !== "/") {
      setMultiRoomCode("");
      setMultiPlayerSlot(null);
      setInQueue(false);
      setQueuePhase("none");
      if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
      router.replace("/auth");
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
      router.replace("/auth");
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
      audio.playBgm(
        themeRef.current,
        getBgmCtx(pathnameToScreen(window.location.pathname), rankedRef.current, aiDiffRef.current),
      );
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
  }, []);

  /* ── BGM context switching ──────────────────────────────────────────── */
  useEffect(() => {
    if (!audioStarted) return;
    audio.playBgm(themeId, getBgmCtx(currentScreen, isRanked, aiDifficulty));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId, currentScreen, isRanked, aiDifficulty, audioStarted]);

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
      if (!user && GUEST_BLOCKED_SCREENS.includes(s)) {
        setShowGuestBlock(true);
        return;
      }

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
        router.push(url);
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
      setMultiplayerRulesBootstrap(multiplayerRulesBootstrapFromRoom(roomFromServer));
      setMultiRoomCode(roomCode);
      setMultiPlayerSlot(playerSlot);
      setIsRanked(format === "ranked");
      if (matchup) setMultiMatchup(matchup);

      const bm = (roomFromServer?.board_mode as BoardMode) || boardMode;
      const id = generateGameId();
      const sk = boardModeToSizeKey(bm);
      router.push(`/game/${sk}/${id}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardMode, router],
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
        if (queuePollRef.current) {
          clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
        const prefix = slot === "P1" ? "player2" : "player1";
        const opp = {
          name: poll.data[`${prefix}_name`] ?? "OPPONENT",
          elo: poll.data[`${prefix}_elo`] ?? 1000,
          avatar: poll.data[`${prefix}_avatar`] ?? null,
          banner: poll.data[`${prefix}_banner`] ?? poll.data[`${prefix}_banner_style`] ?? "default",
          level: poll.data[`${prefix}_level`] ?? 1,
        };
        setMatchupOpponent(opp);
        setQueuePhase("matchup");
        sfx.matchFound();
        router.push(ROUTES.PLAY_MATCHFOUND);
        setTimeout(() => {
          setInQueue(false);
          setQueuePhase("none");
          matchmakingActiveRef.current = false;
          handleRoomReady(code, slot, mode, undefined, poll.data);
        }, 10000);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        if (queuePollRef.current) {
          clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
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
          await API.post("/api/room/queue/leave", { format: mode, board_mode: boardModeForQueue }, { ...authHeader, timeout: 10000 });
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
        };
        setMatchupOpponent(opp);
        setQueuePhase("matchup");
        sfx.matchFound();
        router.push(ROUTES.PLAY_MATCHFOUND);
        setTimeout(() => {
          setInQueue(false);
          setQueuePhase("none");
          matchmakingActiveRef.current = false;
          handleRoomReady(code, slot, mode, undefined, room);
        }, 10000);
      } else {
        if (queuePollRef.current) clearInterval(queuePollRef.current);
        queuePollRef.current = setInterval(
          () => pollQueueStatus(code, slot, mode),
          2000,
        );
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
    }
  };

  const cancelMatchmaking = async () => {
    queueCancelledRef.current = true;
    matchmakingActiveRef.current = false;
    if (queuePollRef.current) { clearInterval(queuePollRef.current); queuePollRef.current = null; }
    const mode = isRanked ? "ranked" : "unranked";
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const code = queueRoomCodeRef.current;
    const boardModeForQueue = mode === "ranked" ? "5x5_6x6_7x7" : boardMode;
    if (code) {
      try {
        await API.post("/api/room/queue/leave", { format: mode, board_mode: boardModeForQueue }, { ...authHeader, timeout: 10000 });
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
      if (p.startsWith("/unranked/") || p.startsWith("/ranked/")) {
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
    themeId,
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
          style={{ minHeight: "100vh", background: themeId === "space" ? "#02040F" : t.bg }}
          aria-busy="true"
        />
      </AppContext.Provider>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  Render                                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const showNavBar =
    pathname !== "/auth" &&
    pathname !== "/" &&
    !showPolicyGate;

  const isGameScreen = isMatchPath || pathname.startsWith("/challenge/");

  const GlobalMatchupOverlay = () => {
    if (queuePhase !== "matchup" || !matchupOpponent) return null;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: t.bg }}>
        <LobbyScreen
          setScreenAction={navigate}
          themeId={themeId}
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
        />
      </div>
    );
  };

  return (
    <AppContext.Provider value={ctx}>
      <div
        style={{
          minHeight: "100vh",
          background: themeId === "space" ? "transparent" : t.bg,
          color: t.text,
          fontFamily: t.fontBody,
        }}
      >
        {themeId === "space" && !isGameScreen && pathname !== "/home" && <SpaceBg />}

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

        {/* Guest block modal */}
        {showGuestBlock && (
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
                padding: ip ? "32px 36px" : "48px 52px",
                maxWidth: 460,
                width: "90vw",
                textAlign: "center",
                boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
                animation: "scaleIn 0.28s cubic-bezier(.22,.68,0,1.2) both",
              }}
            >
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: ip ? 14 : 22,
                  fontWeight: 700,
                  color: t.text,
                  marginBottom: 10,
                  lineHeight: 1.4,
                }}
              >
                Sign in to access this
              </div>
              <div
                style={{
                  fontFamily: t.fontBody,
                  fontSize: ip ? 12 : 14,
                  color: t.textMuted,
                  marginBottom: 32,
                  lineHeight: 1.7,
                }}
              >
                Create a free account to play multiplayer, track your career, access your
                profile, and more.
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setShowGuestBlock(false);
                    router.push("/auth");
                  }}
                  style={{
                    background: t.accent,
                    border: "none",
                    color: "#000",
                    fontFamily: t.fontDisplay,
                    fontSize: ip ? 12 : 15,
                    fontWeight: 800,
                    padding: ip ? "10px 28px" : "13px 36px",
                    borderRadius: ip ? 2 : 10,
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    boxShadow: `0 0 24px ${t.accentGlow}44`,
                  }}
                >
                  SIGN IN / SIGN UP
                </button>
                <button
                  onClick={() => setShowGuestBlock(false)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${t.border}`,
                    color: t.textMuted,
                    fontFamily: t.fontDisplay,
                    fontSize: ip ? 12 : 14,
                    fontWeight: 700,
                    padding: ip ? "10px 24px" : "13px 28px",
                    borderRadius: ip ? 2 : 10,
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}

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
                  router.push("/auth");
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

        {/* Policy acceptance gate */}
        {showPolicyGate && (
          <PolicyAcceptanceGate
            themeId={themeId}
            user={user}
            onAcceptedAction={() => {
              setShowPolicyGate(false);
              router.push("/home");
            }}
            onDeclinedAction={() => {
              logout();
              setShowPolicyGate(false);
              router.push("/auth");
            }}
          />
        )}

        <GlobalMatchupOverlay />

        {/* AI exit confirmation modal */}
        {showAiExitModal && (
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
                Leave AI Match?
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
                Your current game against the bot will be lost.
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
        )}

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
          body { background: ${themeId === "space" ? "#02040F" : t.bg}; }
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

        {/* NavBar */}
        {showNavBar && (
          <NavBar
            screen={currentScreen}
            setScreenAction={navigate}
            themeId={themeId}
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

        {/* Route page content */}
        {children}

        {/* Settings modal */}
        {showSettings && (
          <SettingsModal
            onCloseAction={() => setShowSettings(false)}
            themeId={themeId}
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
            onNavigateAuthAction={() => router.push("/auth")}
          />
        )}

        {/* Session replaced modal */}
        {showSessionReplaced && (
          <SessionReplacedModal
            themeId={themeId}
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
            themeId={themeId}
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

        <GlobalLevelUpShowcase themeId={themeId} />
      </div>
    </AppContext.Provider>
  );
}
