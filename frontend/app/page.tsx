"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useAudio } from "@/hooks/useAudio";
import API from "@/lib/api";
import { THEMES } from "@/lib/themes";
import { censorText, containsProfanity } from "@/lib/profanity";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import type { Screen, MatchupData, BoardMode, SetScreenOptions } from "@/lib/types";
import { loadCustomTheme, resolveCustomTheme } from "@/lib/customTheme";
import HomeScreen       from "@/components/HomeScreen";
import AuthScreen       from "@/components/AuthScreen";
import LobbyScreen      from "@/components/LobbyScreen";
import GameScreen       from "@/components/GameScreen";
import ProfileScreen    from "@/components/ProfileScreen";
import RulesScreen      from "@/components/RulesScreen";
import PatchNotesScreen from "@/components/PatchNotesScreen";
import AIScreen         from "@/components/AIScreen";
import SingleplayerScreen from "@/components/SingleplayerScreen";
import StoreScreen      from "@/components/Storescreen";
import CollectionScreen from "@/components/CollectionScreen";
import CareerScreen     from "@/components/CareerScreen";
import MissionsScreen from "@/components/MissionsScreen";
import NavBar           from "@/components/NavBar";
import SettingsModal    from "@/components/SettingsModal";
import SpaceBg      from "@/components/SpaceBg";
import PolicyAcceptanceGate from "@/components/PolicyAcceptanceGate";
import SessionReplacedModal from "@/components/SessionReplacedModal";
import ActiveMatchRejoinModal from "@/components/ActiveMatchRejoinModal";
import { POLICY_GATE_SESSION_KEY, getUserId, hasAcceptedLegal } from "@/lib/legalAcceptance";
import { multiplayerRulesBootstrapFromRoom, type MultiplayerRulesBootstrap } from "@/lib/effectiveBoardMode";


THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;

// Screens blocked for guests (not signed in)
const GUEST_BLOCKED: Screen[] = ["lobby", "profile", "career", "battlepass"];

/** Set when a multiplayer series ends; blocks restoring `multiGame` on refresh and sends browser Back to home. */
const PP_MULTI_SERIES_FINISHED_KEY = "pp_multi_series_finished";
const PP_HOME_NOTICE_KEY = "pp_home_notice";
const DISCONNECT_HOME_NOTICE = "last match ended due to connection issues or going afk";

export default function Page() {
  const [themeId, setThemeIdRaw]        = useState<ThemeId>("classic_dark");
  const [screen, setScreen]             = useState<Screen>("home");
  /** False until session + auth are read — avoids flashing AuthScreen before Home/game restore */
  const [appReady, setAppReady]         = useState(false);
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [inQueue, setInQueue]           = useState(false);
  const [isRanked, setIsRanked]         = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [fadingOut, setFadingOut]       = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [boardMode, setBoardMode] = useState<BoardMode>("5x5");
  const [selectedPatterns, setSelectedPatterns] = useState<string[]>([]);
  const graphicsQuality: "quality" = "quality";
  const [multiRoomCode,   setMultiRoomCode]   = useState<string>("");
  const [multiPlayerSlot, setMultiPlayerSlot] = useState<"P1" | "P2" | null>(null);
  const [multiMatchup, setMultiMatchup]       = useState<MatchupData | null>(null);
  const [multiplayerRulesBootstrap, setMultiplayerRulesBootstrap] = useState<MultiplayerRulesBootstrap | null>(null);
  const [customRev, setCustomRev]       = useState(0);
  const [activeMatchData, setActiveMatchData] = useState<any>(null);
  const [showSessionReplaced, setShowSessionReplaced] = useState(false);
  const [homeNotice, setHomeNotice] = useState<string | null>(null);

  const { user, token, logout, logoutReason, setLogoutReason } = useAuthStore();
  const audio = useAudio();
  const { sfx } = audio;

  const handleForfeitMatch = async () => {
    if (!activeMatchData?.room_code || !token) return;
    try {
      await API.post("/api/room/forfeit", { room_code: activeMatchData.room_code }, { headers: { Authorization: `Bearer ${token}` } });
      setActiveMatchData(null);
      setHomeNotice("Match forfeited.");
    } catch (e) {
      console.error("Forfeit failed", e);
    }
  };

  const t = THEMES[themeId];

  // Matchmaking states
  const [queuePhase, setQueuePhase] = useState<"none" | "queuing" | "matchup">("none");
  const [queueElapsed, setQueueElapsed] = useState(0);
  const [queueRoomCode, setQueueRoomCode] = useState<string | null>(null);
  const [queuePlayerSlot, setQueuePlayerSlot] = useState<"P1" | "P2">("P1");
  const [matchupOpponent, setMatchupOpponent] = useState<any>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  /** Multiplayer only: false until series end UI (GameWin / MatchResult); then true so navbar works. */
  const [multiplayerNavUnlocked, setMultiplayerNavUnlocked] = useState(false);

  const audioStartedRef    = useRef(false);
  const pendingTheme       = useRef<ThemeId | null>(null);
  const queuePollRef       = useRef<NodeJS.Timeout | null>(null);
  const queueCancelledRef  = useRef(false);
  // ── NEW: prevents double-fire of startMatchmaking ──
  const matchmakingActiveRef = useRef(false);
  // Keep latest queue state accessible inside poll closure
  const queueRoomCodeRef   = useRef<string | null>(null);
  const queuePlayerSlotRef = useRef<"P1" | "P2">("P1");
  const profileRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pendingScreen, setPendingScreen]     = useState<Screen | null>(null);
  const [showAiExitModal, setShowAiExitModal] = useState(false);
  const [showGuestBlock, setShowGuestBlock]   = useState(false);

  const themeRef  = useRef(themeId);
  const screenRef = useRef(screen);
  const rankedRef = useRef(isRanked);
  const aiDiffRef = useRef(aiDifficulty);
  themeRef.current  = themeId;
  screenRef.current = screen;
  rankedRef.current = isRanked;
  aiDiffRef.current = aiDifficulty;

  const handleRoomReady = (
    roomCode: string,
    playerSlot: "P1" | "P2",
    format: string,
    matchup?: MatchupData,
    roomFromServer?: {
      board_mode?: string;
      selected_patterns?: string[];
      awaiting_5x5_rules_ready?: boolean;
      awaiting_6x6_rules_ready?: boolean;
      awaiting_7x7_rules_ready?: boolean;
    },
  ) => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
    }
    if (roomFromServer?.board_mode) setBoardMode(roomFromServer.board_mode as BoardMode);
    if (Array.isArray(roomFromServer?.selected_patterns)) setSelectedPatterns(roomFromServer.selected_patterns);
    setMultiplayerRulesBootstrap(multiplayerRulesBootstrapFromRoom(roomFromServer));
    setMultiRoomCode(roomCode);
    setMultiPlayerSlot(playerSlot);
    setIsRanked(format === "ranked");
    if (matchup) setMultiMatchup(matchup);
    setScreenHistory(prev => [...prev, screen]);
    setScreen("multiGame");
  };

  useEffect(() => {
    if (screen === "multiGame") setMultiplayerNavUnlocked(false);
  }, [screen, multiRoomCode]);

  // ── React to session-kick from server ───────────────────────────────────
  // When refreshProfile detects 401 "Session replaced", it calls logout("duplicate_session").
  // We react here to navigate to auth and show the explanatory modal.
  useEffect(() => {
    if (logoutReason === "duplicate_session") {
      // Clear multiplayer state cleanly before redirecting
      setMultiRoomCode("");
      setMultiPlayerSlot(null);
      setInQueue(false);
      setQueuePhase("none");
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
      setShowSessionReplaced(true);
      if (screen !== "auth") setScreen("auth");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoutReason]);


  const getBgmCtx = (s: Screen, ranked: boolean, aiDiff: Difficulty): "lobby" | "game" | "ranked" => {
    if (s === "aiGame") return aiDiff === "hard" || aiDiff === "danger" || aiDiff === "machine_god" ? "ranked" : "game";
    if (s === "game") return "game";
    if (s === "multiGame") return ranked ? "ranked" : "game";
    return "lobby";
  };

  // Before first paint: restore theme, screen, 7×7 board mode / patterns (no AuthScreen flash if logged in)
  // ── Startup restore ref — filled by useLayoutEffect, consumed by verify effect ──
  const pendingScreenRestoreRef = useRef<{
    screen: Screen;
    multiRoomCode: string;
    multiPlayerSlot: "P1" | "P2" | null;
    isRanked: boolean;
  } | null>(null);

  // Before first paint: restore non-auth settings. If a token exists, we do NOT
  // call setAppReady yet — the profile-verify effect below will do that after
  // confirming the token/user is still valid in the DB.
  useLayoutEffect(() => {
    const savedTheme = localStorage.getItem("pp_theme") as ThemeId;
    if (savedTheme && THEMES[savedTheme]) setThemeIdRaw(savedTheme);

    const tok = useAuthStore.getState().token;
    const savedScreen = sessionStorage.getItem("pp_screen") as Screen | null;
    const savedRoom = sessionStorage.getItem("pp_multiRoomCode");
    const savedSlot = sessionStorage.getItem("pp_multiPlayerSlot") as "P1" | "P2" | null;
    const savedRanked = sessionStorage.getItem("pp_isRanked") === "true";
    const savedBoard = localStorage.getItem("pp_boardMode") as BoardMode | null || sessionStorage.getItem("pp_boardMode") as BoardMode | null;
    const savedPats = localStorage.getItem("pp_selectedPatterns") || sessionStorage.getItem("pp_selectedPatterns");
    const savedDifficulty = localStorage.getItem("pp_ai_difficulty") as Difficulty | null;

    if (savedBoard && (savedBoard === "5x5" || savedBoard === "7x7" || savedBoard === "6x6" || savedBoard === "5x5_7x7" || savedBoard === "5x5_6x6" || savedBoard === "6x6_7x7" || savedBoard === "5x5_6x6_7x7")) {
        setBoardMode(savedBoard);
    }
    if (savedDifficulty) {
      let d: Difficulty = savedDifficulty;
      if (savedScreen === "aiGame" && savedBoard === "7x7" && d === "medium") {
        d = "easy";
      }
      setAiDifficulty(d);
    }
    if (savedPats) {
      try {
        const arr = JSON.parse(savedPats);
        if (Array.isArray(arr)) {
          const mapped = arr.map(p => p === "H" ? "Y" : p);
          setSelectedPatterns(Array.from(new Set(mapped)));
        }
      } catch { /* ignore */ }
    }

    if (!tok) {
      // No token → go straight to AuthScreen immediately (no API call needed)
      setScreen("auth");
      window.history.pushState({ screen: "auth" }, "", window.location.pathname);
      setAppReady(true);
      return;
    }

    // Token exists → compute the desired screen but DO NOT apply it yet.
    // appReady stays false (blank loading div) until the API verifies the user.
    let targetScreen: Screen = "home";
    let targetRoom = "";
    let targetSlot: "P1" | "P2" | null = null;
    let targetRanked = false;
    let sealedResumeToHome = false;

    if (savedScreen) {
      sealedResumeToHome =
        savedScreen === "multiGame" &&
        sessionStorage.getItem(PP_MULTI_SERIES_FINISHED_KEY) === "1";
      if (sealedResumeToHome) {
        sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
        targetScreen = "home";
      } else if (savedScreen === "multiGame") {
        sessionStorage.setItem(PP_HOME_NOTICE_KEY, DISCONNECT_HOME_NOTICE);
        targetScreen = "home";
      } else {
        targetScreen = savedScreen;
        targetRoom = savedRoom || "";
        targetSlot = savedSlot;
        targetRanked = savedRanked;
      }
    }

    const historyScreen = sealedResumeToHome
      ? "home"
      : (savedScreen as Screen) || "home";
    window.history.pushState({ screen: historyScreen }, "", window.location.pathname);

    // Store restore intent — profile-verify effect reads it
    pendingScreenRestoreRef.current = {
      screen: targetScreen,
      multiRoomCode: targetRoom,
      multiPlayerSlot: targetSlot,
      isRanked: targetRanked,
    };
    // setAppReady(true) intentionally NOT called here when token exists
  }, []);

  // ── Profile verification gate ─────────────────────────────────────────────
  // Runs once on mount. If a token was found, fetches profile to confirm the
  // user still exists in the DB before revealing any screen.
  // This prevents HomeScreen flash for deleted / stale accounts.
  useEffect(() => {
    const restore = pendingScreenRestoreRef.current;
    if (!restore) return; // No token: useLayoutEffect already called setAppReady(true)

    const tok = useAuthStore.getState().token;
    if (!tok) {
      setScreen("auth");
      setAppReady(true);
      return;
    }

    API.get("/api/profile/me", {
      headers: { Authorization: `Bearer ${tok}` },
      timeout: 10000,
    })
      .then((res) => {
        // User confirmed valid — apply the stored screen restore
        useAuthStore.getState().updateUser(res.data);
        
        // After profile is valid, check if there's an ongoing match on the server
        // This is for "seamless resume" across devices.
        if (restore.screen === "home" || restore.screen === "auth") {
          API.get("/api/room/active/check", {
            headers: { Authorization: `Bearer ${tok}` }
          })
          .then(activeRes => {
            if (activeRes.data.room_code) {
              setActiveMatchData(activeRes.data);
            }
          }).catch(e => console.warn("Active match check failed", e));
        }

        setScreen(restore.screen);
        if (restore.multiRoomCode) setMultiRoomCode(restore.multiRoomCode);
        if (restore.multiPlayerSlot) setMultiPlayerSlot(restore.multiPlayerSlot);
        setIsRanked(restore.isRanked);
        setAppReady(true);
      })
      .catch((err: any) => {
        const status = err?.response?.status;
        if (status === 404 || status === 401) {
          // User deleted from DB or token invalid — clear everything
          useAuthStore.getState().logout();
        }
        // Network/5xx errors: still show auth to be safe (token can't be verified)
        setScreen("auth");
        setAppReady(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // must only run once on mount


  useEffect(() => {
    if (!appReady || !user || !token) return;
    const uid = getUserId(user);
    if (!uid) return;
    const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
    if (pending === uid && !hasAcceptedLegal(uid, user)) setScreen("policy_gate");
  }, [appReady, user, token]);

  useEffect(() => {
    if (!appReady || !token) return;
    useAuthStore.getState().refreshProfile();

    // ── Global Notify WebSocket ──
    // This allows the server to instantly kick this session if another device logs in.
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") || window.location.host;
      ws = new WebSocket(`${proto}//${host}/api/room/ws/global/notify?token=${token}`);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "duplicate_session") {
            useAuthStore.getState().logout("duplicate_session");
          }
        } catch {}
      };

      ws.onclose = () => {
        if (useAuthStore.getState().token) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [appReady, token]);


  // ── Guard: if token is cleared after startup (user deleted, expired, etc.) ──
  // This fires whenever token changes to null *after* the app has initialised,
  // so we don't accidentally redirect on the very first render where token
  // starts as null for guests.
  useEffect(() => {
    if (!appReady) return;
    if (!token && screen !== "auth" && screen !== "policy_gate") {
      // Clean up any in-progress multiplayer state
      setMultiRoomCode("");
      setMultiPlayerSlot(null);
      setInQueue(false);
      setQueuePhase("none");
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        queuePollRef.current = null;
      }
      setScreen("auth");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, token]);

  useEffect(() => {
    if (screen !== "home" || typeof window === "undefined") {
      if (screen !== "home") setHomeNotice(null);
      return;
    }
    const msg = sessionStorage.getItem(PP_HOME_NOTICE_KEY);
    if (!msg) return;
    setHomeNotice(msg);
    sessionStorage.removeItem(PP_HOME_NOTICE_KEY);
  }, [screen]);

  useEffect(() => {
    if (!token) return;
    const scheduleProfileRefresh = () => {
      if (profileRefreshDebounceRef.current) clearTimeout(profileRefreshDebounceRef.current);
      profileRefreshDebounceRef.current = setTimeout(() => {
        profileRefreshDebounceRef.current = null;
        useAuthStore.getState().refreshProfile();
      }, 1000);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") scheduleProfileRefresh();
    };
    const onFocus = () => scheduleProfileRefresh();
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

  useEffect(() => {
    if (screen === "aiGame" && boardMode === "7x7" && aiDifficulty === "medium") {
      setAiDifficulty("easy");
    }
    const aiDiffPersist =
      screen === "aiGame" && boardMode === "7x7" && aiDifficulty === "medium" ? "easy" : aiDifficulty;

    sessionStorage.setItem("pp_screen", screen);
    sessionStorage.setItem("pp_multiRoomCode", multiRoomCode);
    if (multiPlayerSlot) sessionStorage.setItem("pp_multiPlayerSlot", multiPlayerSlot);
    else sessionStorage.removeItem("pp_multiPlayerSlot");
    sessionStorage.setItem("pp_isRanked", String(isRanked));
    sessionStorage.setItem("pp_boardMode", boardMode);
    localStorage.setItem("pp_boardMode", boardMode);
    sessionStorage.setItem("pp_selectedPatterns", JSON.stringify(selectedPatterns));
    localStorage.setItem("pp_selectedPatterns", JSON.stringify(selectedPatterns));
    localStorage.setItem("pp_ai_difficulty", aiDiffPersist);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- aiDifficulty read from latest render when any listed dep changes; omitting it avoids a 7th dep (HMR/runtime mismatch with varying array length)
  }, [screen, multiRoomCode, multiPlayerSlot, isRanked, boardMode, selectedPatterns]);

  useEffect(() => {
    const onCustomThemeChange = () => {
      THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;
      setCustomRev(r => r + 1);
    };
    window.addEventListener("pp_custom_theme_changed", onCustomThemeChange);
    return () => window.removeEventListener("pp_custom_theme_changed", onCustomThemeChange);
  }, []);

  useEffect(() => {
    const start = () => {
      if (audioStartedRef.current) return;
      audioStartedRef.current = true;
      setAudioStarted(true);
      audio.playBgm(themeRef.current, getBgmCtx(screenRef.current, rankedRef.current, aiDiffRef.current));
    };
    start();
    window.addEventListener("click",      start, { once: true });
    window.addEventListener("keydown",    start, { once: true });
    window.addEventListener("touchstart", start, { once: true });
    return () => {
      window.removeEventListener("click",      start);
      window.removeEventListener("keydown",    start);
      window.removeEventListener("touchstart", start);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!audioStarted) return;
    audio.playBgm(themeId, getBgmCtx(screen, isRanked, aiDifficulty));
  }, [themeId, screen, isRanked, aiDifficulty, audioStarted]);

  // Matchmaking elapsed timer — runs indefinitely while queuing, no timeout
  useEffect(() => {
    if (queuePhase !== "queuing") {
      setQueueElapsed(0);
      return;
    }
    const iv = setInterval(() => setQueueElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [queuePhase]);

  // ── Single no-retry API call ──────────────────────────────────────────────
  const postOnce = async (url: string, data: any, config: any) => {
    return await API.post(url, data, { ...config, timeout: 15000 });
  };

  // ── Poll queue status until matched ──────────────────────────────────────
  const pollQueueStatus = async (code: string, slot: "P1" | "P2", mode: "ranked" | "unranked") => {
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
          name:   poll.data[`${prefix}_name`]   ?? "OPPONENT",
          elo:    poll.data[`${prefix}_elo`]    ?? 1000,
          avatar: poll.data[`${prefix}_avatar`] ?? null,
          banner: poll.data[`${prefix}_banner`] ?? poll.data[`${prefix}_banner_style`] ?? "default",
          level:  poll.data[`${prefix}_level`]  ?? 1,
        };
        setMatchupOpponent(opp);
        setQueuePhase("matchup");
        sfx.matchFound();

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
      // All other errors: silently ignore and keep polling
    }
  };

  // ── Start matchmaking — no retries, no timeout, searches indefinitely ────
  const startMatchmaking = async (mode: "ranked" | "unranked") => {
    // Prevent double-fire (double-click, React strict mode, etc.)
    if (matchmakingActiveRef.current) return;
    matchmakingActiveRef.current = true;

    queueCancelledRef.current = false;
    setIsRanked(mode === "ranked");
    setInQueue(true);
    setQueuePhase("queuing");
    setQueueElapsed(0);
    setQueueError(null);

    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const boardModeForQueue = mode === "ranked" ? ("5x5_6x6_7x7" as const) : boardMode;
    try {
      const res = await postOnce("/api/room/queue/join", { format: mode, board_mode: boardModeForQueue }, authHeader);
      if (queueCancelledRef.current) {
        matchmakingActiveRef.current = false;
        try {
          await API.post("/api/room/queue/leave", { format: mode, board_mode: boardModeForQueue }, { ...authHeader, timeout: 10000 });
        } catch {
          /* ignore */
        }
        return;
      }

      const code = res.data.room_code;
      const slot = res.data.player_slot as "P1" | "P2";
      setQueueRoomCode(code);
      setQueuePlayerSlot(slot);
      queueRoomCodeRef.current   = code;
      queuePlayerSlotRef.current = slot;

      if (res.data.matched) {
        // Immediate match — show matchup screen
        const room   = res.data.room;
        const prefix = slot === "P1" ? "player2" : "player1";
        const opp = {
          name:   room[`${prefix}_name`]   ?? "OPPONENT",
          elo:    room[`${prefix}_elo`]    ?? 1000,
          avatar: room[`${prefix}_avatar`] ?? null,
          banner: room[`${prefix}_banner`] ?? room[`${prefix}_banner_style`] ?? "default",
          level:  room[`${prefix}_level`]  ?? 1,
        };
        setMatchupOpponent(opp);
        setQueuePhase("matchup");
        sfx.matchFound();
        setTimeout(() => {
          setInQueue(false);
          setQueuePhase("none");
          matchmakingActiveRef.current = false;
          handleRoomReady(code, slot, mode, undefined, room);
        }, 10000);
      } else {
        // No immediate match — poll indefinitely until matched or cancelled
        if (queuePollRef.current) clearInterval(queuePollRef.current);
        queuePollRef.current = setInterval(() => pollQueueStatus(code, slot, mode), 2000);
      }
    } catch (err: any) {
      console.error("Matchmaking error:", err);
      if (queueCancelledRef.current) {
        matchmakingActiveRef.current = false;
        return;
      }
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

  // ── Cancel matchmaking ────────────────────────────────────────────────────
  const cancelMatchmaking = async () => {
    queueCancelledRef.current  = true;
    matchmakingActiveRef.current = false;

    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
      queuePollRef.current = null;
    }

    const mode       = isRanked ? "ranked" : "unranked";
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    const code       = queueRoomCodeRef.current;
    const boardModeForQueue = mode === "ranked" ? "5x5_6x6_7x7" : boardMode;
    if (code) {
      try {
        await API.post("/api/room/queue/leave", { format: mode, board_mode: boardModeForQueue }, { ...authHeader, timeout: 10000 });
      } catch { /* ignore — server will TTL-expire the entry anyway */ }
    }

    setInQueue(false);
    setQueuePhase("none");
    setQueueRoomCode(null);
    setQueueError(null);
    setMatchupOpponent(null);
  };

  useEffect(() => {
    const onGotoStore = () => handleSetScreen("store");
    window.addEventListener("pp_goto_store", onGotoStore);
    return () => window.removeEventListener("pp_goto_store", onGotoStore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.history.pushState({ screen }, "", window.location.pathname);
  }, [screen]);

  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      if (screenRef.current === "auth") {
        window.close();
        window.history.pushState({ screen: "auth" }, "", window.location.pathname);
        return;
      }
      if (
        screenRef.current === "multiGame" &&
        typeof window !== "undefined" &&
        sessionStorage.getItem(PP_MULTI_SERIES_FINISHED_KEY) === "1"
      ) {
        window.history.pushState({ screen: "home" }, "", window.location.pathname);
        sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
        sessionStorage.removeItem("pp_multiRoomCode");
        sessionStorage.removeItem("pp_multiPlayerSlot");
        sessionStorage.removeItem("pp_isRanked");
        setMultiRoomCode("");
        setMultiPlayerSlot(null);
        setScreenHistory(["home"]);
        setScreen("home");
        return;
      }
      window.history.pushState({ screen: screenRef.current }, "", window.location.pathname);
      setScreenHistory(prev => {
        if (prev.length === 0) return prev;
        const previousScreen = prev[prev.length - 1];
        const next = prev.slice(0, -1);
        setScreen(previousScreen);
        return next;
      });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setThemeId = (id: ThemeId) => {
    if (id === themeId) return;
    pendingTheme.current = id;
    setFadingOut(true);
    setTimeout(() => {
      setThemeIdRaw(id);
      localStorage.setItem("pp_theme", id);
      setFadingOut(false);
      pendingTheme.current = null;
    }, 320);
  };

  const handleSetScreen = (s: Screen, opts?: SetScreenOptions) => {
    if (!user && GUEST_BLOCKED.includes(s)) {
      setShowGuestBlock(true);
      return;
    }
    if (screen === "aiGame" && s !== "aiGame") {
      sfx.click();
      setPendingScreen(s);
      setShowAiExitModal(true);
      return;
    }
    sfx.transition();
    if (opts?.exitMultiGameToCareer && screen === "multiGame" && s === "career") {
      setScreenHistory(prev => [...prev.filter(x => x !== "multiGame"), s]);
      setScreen(s);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
        sessionStorage.removeItem("pp_screen");
        sessionStorage.removeItem("pp_multiRoomCode");
        sessionStorage.removeItem("pp_multiPlayerSlot");
        sessionStorage.removeItem("pp_isRanked");
      }
      return;
    }
    if (screen === "multiGame" && s !== "multiGame") {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
      }
      if (s === "home" || s === "career" || s === "lobby" || s === "auth") {
        setMultiRoomCode("");
        setMultiPlayerSlot(null);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pp_multiRoomCode");
          sessionStorage.removeItem("pp_multiPlayerSlot");
          sessionStorage.removeItem("pp_isRanked");
        }
      }
    }
    setScreenHistory(prev => [...prev, screen]);
    setScreen(s);
  };

  const confirmAiExit = () => {
    sfx.transition();
    setShowAiExitModal(false);
    if (pendingScreen) {
      setScreenHistory(prev => [...prev, screen]);
      setScreen(pendingScreen);
      setPendingScreen(null);
    }
  };

  const cancelAiExit = () => {
    sfx.click();
    setShowAiExitModal(false);
    setPendingScreen(null);
  };

  const ip = themeId === "pixel";

  const sealMultiSeriesNavigation = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PP_MULTI_SERIES_FINISHED_KEY, "1");
    }
    setScreenHistory(["home"]);
  }, []);

  const resumeMultiSeriesNavigation = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(PP_MULTI_SERIES_FINISHED_KEY);
    }
  }, []);

  // Keep refs in sync with state so closures always see latest values
  useEffect(() => { queueRoomCodeRef.current   = queueRoomCode;   }, [queueRoomCode]);
  useEffect(() => { queuePlayerSlotRef.current = queuePlayerSlot; }, [queuePlayerSlot]);

  useEffect(() => {
    if (screen !== "multiGame") setMultiplayerRulesBootstrap(null);
  }, [screen]);

  const GuestBlockModal = () => (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease both",
    }}>
      <div style={{
        background: t.bgPanel,
        border: `${ip ? 3 : 1}px solid ${t.border}`,
        borderRadius: ip ? 2 : 20,
        padding: ip ? "32px 36px" : "48px 52px",
        maxWidth: 460, width: "90vw",
        textAlign: "center",
        boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
        animation: "scaleIn 0.28s cubic-bezier(.22,.68,0,1.2) both",
      }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 22, fontWeight: 700, color: t.text, marginBottom: 10, lineHeight: 1.4 }}>
          Sign in to access this
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, marginBottom: 32, lineHeight: 1.7 }}>
          Create a free account to play multiplayer, track your career, access your profile, and more.
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => { setShowGuestBlock(false); setScreen("auth"); }}
            style={{ background: t.accent, border: "none", color: "#000", fontFamily: t.fontDisplay, fontSize: ip ? 12 : 15, fontWeight: 800, padding: ip ? "10px 28px" : "13px 36px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em", boxShadow: `0 0 24px ${t.accentGlow}44` }}
          >SIGN IN / SIGN UP</button>
          <button
            onClick={() => setShowGuestBlock(false)}
            style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 14, fontWeight: 700, padding: ip ? "10px 24px" : "13px 28px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.06em" }}
          >CANCEL</button>
        </div>
      </div>
    </div>
  );

  const GlobalMatchupOverlay = () => {
    if (queuePhase !== "matchup" || !matchupOpponent) return null;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: t.bg }}>
        <LobbyScreen
          setScreenAction={handleSetScreen}
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

  if (!appReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: themeId === "space" ? "#02040F" : t.bg,
        }}
        aria-busy="true"
      />
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: themeId === "space" ? "transparent" : t.bg,
      color: t.text,
      fontFamily: t.fontBody,
      transition: "background 0.6s ease, color 0.6s ease",
    }}>
     {themeId === "space" && screen !== "home" && screen !== "game" && screen !== "aiGame" && screen !== "multiGame" && <SpaceBg />}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "#000",
        opacity: fadingOut ? 1 : 0,
        pointerEvents: fadingOut ? "all" : "none",
        transition: fadingOut ? "opacity 0.28s ease" : "opacity 0.32s ease",
      }} />

      {showGuestBlock && <GuestBlockModal />}

      {/* ── Duplicate Session (kicked) Modal ─────────────────────────── */}
      {logoutReason === "duplicate_session" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999999,
          background: "rgba(0,0,0,0.92)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.2s ease both",
        }}>
          <div style={{
            background: t.bgPanel,
            border: `1px solid ${t.danger}55`,
            borderRadius: ip ? 2 : 20,
            padding: ip ? "32px 36px" : "48px 52px",
            maxWidth: 460, width: "90vw",
            textAlign: "center",
            boxShadow: `0 0 60px ${t.danger}22, 0 40px 100px rgba(0,0,0,0.8)`,
            animation: "scaleIn 0.28s cubic-bezier(.22,.68,0,1.2) both",
          }}>
            <div style={{
              fontFamily: t.fontDisplay, fontSize: ip ? 11 : 12,
              fontWeight: 700, color: t.danger, letterSpacing: "0.18em",
              marginBottom: 16, textTransform: "uppercase",
            }}>Session Terminated</div>
            <div style={{
              fontFamily: t.fontDisplay, fontSize: ip ? 16 : 22,
              fontWeight: 700, color: t.text, marginBottom: 16, lineHeight: 1.4,
            }}>You were signed in elsewhere</div>
            <div style={{
              fontFamily: t.fontBody, fontSize: ip ? 12 : 14,
              color: t.textMuted, marginBottom: 36, lineHeight: 1.7,
            }}>
              Your account was opened on another device or browser tab.{" "}
              Only one active session is allowed at a time.
            </div>
            <button
              onClick={() => {
                setLogoutReason(null);
                setScreen("auth");
              }}
              style={{
                background: t.accent, border: "none", color: "#000",
                fontFamily: t.fontDisplay, fontSize: ip ? 12 : 15, fontWeight: 800,
                padding: ip ? "10px 28px" : "13px 44px", borderRadius: ip ? 2 : 10,
                cursor: "pointer", letterSpacing: "0.08em",
                boxShadow: `0 0 24px ${t.accentGlow}44`,
              }}
            >SIGN IN AGAIN</button>
          </div>
        </div>
      )}
      {screen === "policy_gate" && (
        <PolicyAcceptanceGate
          themeId={themeId}
          user={user}
          onAcceptedAction={() => setScreen("home")}
          onDeclinedAction={() => {
            logout();
            setScreen("auth");
          }}
        />
      )}
      <GlobalMatchupOverlay />

      {showAiExitModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "fadeIn 0.2s ease both",
        }}>
          <div style={{
            background: t.bgPanel,
            border: `${ip ? 3 : 1}px solid ${t.border}`,
            borderRadius: ip ? 2 : 20,
            padding: ip ? "32px 36px" : "48px 56px",
            maxWidth: 480, width: "90vw",
            textAlign: "center",
            boxShadow: "0 40px 100px rgba(0,0,0,0.8)",
            animation: "scaleIn 0.32s cubic-bezier(.22,.68,0,1.2) both",
          }}>
            <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 22, fontWeight: 700, color: t.text, marginBottom: 12, lineHeight: 1.5 }}>
              Leave AI Match?
            </div>
            <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>
              Your current game against the bot will be lost.
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <button onClick={confirmAiExit} onMouseEnter={sfx.hover}
                style={{ background: `${t.danger}18`, border: `2px solid ${t.danger}`, color: t.danger, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 16, fontWeight: 700, padding: ip ? "10px 28px" : "13px 44px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }}
                onMouseDown={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}18`; e.currentTarget.style.color = t.danger; }}
              >YES, LEAVE</button>
              <button onClick={cancelAiExit} onMouseEnter={sfx.hover}
                style={{ background: `${t.accent}18`, border: `2px solid ${t.accent}`, color: t.accent, fontFamily: t.fontDisplay, fontSize: ip ? 12 : 16, fontWeight: 700, padding: ip ? "10px 28px" : "13px 44px", borderRadius: ip ? 2 : 10, cursor: "pointer", letterSpacing: "0.08em" }}
                onMouseDown={e => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
              >NO, STAY</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
      [data-theme="space"], .space-theme, body {
  --font-display: 'GuildOf', serif;
  --font-body: 'GuildOf', serif;
  --font-mono: 'GuildOf', serif;
}
        * { user-select: none !important; -webkit-user-select: none !important; }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=EB+Garamond:wght@400;500;600&family=Courier+Prime&family=Fira+Code:wght@400;500;700&family=VT323&family=Audiowide&family=Jura:wght@400;600;700&family=Share+Tech+Mono&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${themeId === "space" ? "#02040F" : t.bg}; transition: background 0.6s ease; }
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
        button, a, input, select { transition: color 0.3s, background 0.3s, border-color 0.3s, box-shadow 0.3s; }
      `}</style>

      {screen !== "auth" && screen !== "policy_gate" && (
        <NavBar
          screen={screen}
          setScreenAction={handleSetScreen}
          themeId={themeId}
          onSettingsAction={() => { sfx.click(); setShowSettings(true); }}
          inQueue={inQueue}
          onQueueClickAction={() => setScreen("lobby")}
          onHoverAction={sfx.hover}
          queueElapsed={queueElapsed}
          onCancelQueueAction={cancelMatchmaking}
          lockMultiplayerNav={screen === "multiGame" && !multiplayerNavUnlocked}
        />
      )}

      {screen === "home"       && <HomeScreen    setScreenAction={handleSetScreen} themeId={themeId} onHoverAction={sfx.hover} onClickAction={sfx.click} homeNotice={homeNotice} />}
      {screen === "auth"       && <AuthScreen    setScreenAction={setScreen}       themeId={themeId} />}
      {screen === "lobby"      && (
        <LobbyScreen
          setScreenAction={handleSetScreen}
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
          boardMode={boardMode}
          onBoardModeAction={setBoardMode}
        />
      )}
      {screen === "profile"    && <ProfileScreen    setScreenAction={handleSetScreen} themeId={themeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />}
      {screen === "rules"      && <RulesScreen      themeId={themeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />}
      {screen === "patchNotes" && <PatchNotesScreen themeId={themeId} />}
      {screen === "ai"         && <AIScreen         setScreenAction={handleSetScreen} themeId={themeId} onSelectDifficultyAction={(d) => { sfx.click(); setAiDifficulty(d); handleSetScreen("aiGame"); }} onHoverAction={sfx.hover} onBoardModeAction={(mode, patterns) => { setBoardMode(mode); setSelectedPatterns(patterns || []); }} />}
      {screen === "singleplayer" && <SingleplayerScreen setScreenAction={handleSetScreen} themeId={themeId} onHoverAction={sfx.hover} onBoardModeAction={(mode: BoardMode, patterns?: string[]) => { setBoardMode(mode); setSelectedPatterns(patterns || []); handleSetScreen("game"); }} />}
      {screen === "store"      && <StoreScreen      setScreenAction={handleSetScreen} themeId={themeId} audio={{ pauseBgm: audio.pauseBgm, resumeBgm: audio.resumeBgm }} />}
      {screen === "collection" && <CollectionScreen themeId={themeId} setThemeIdAction={setThemeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />}
      {screen === "career"     && <CareerScreen     themeId={themeId} onHoverAction={sfx.hover} />}
      {screen === "battlepass" && <MissionsScreen themeId={themeId} />}
      {screen === "game" && (
        <GameScreen key={`game_${boardMode}`} themeId={themeId} isSingleplayer={true} gameMode="singleplayer" setScreenAction={handleSetScreen}
          p1Name={user?.username}
          graphicsQuality={graphicsQuality}
          boardMode={boardMode} selectedPatterns={selectedPatterns}
          setHomeNoticeAction={setHomeNotice}
          playHoverAction={sfx.hover} playPlaceAction={sfx.place} playVictoryAction={sfx.victory} playDefeatAction={sfx.defeat}
          playRulebreakerAction={sfx.rulebreaker} playTransitionAction={sfx.transition} playClickAction={sfx.click} />
      )}
      {screen === "aiGame" && (
        <GameScreen key={`aiGame_${boardMode}`} themeId={themeId} gameMode="ai" difficulty={aiDifficulty} setScreenAction={handleSetScreen}
          p1Name={user?.username}
          graphicsQuality={graphicsQuality}
          boardMode={boardMode} selectedPatterns={selectedPatterns}
          setHomeNoticeAction={setHomeNotice}
          playHoverAction={sfx.hover} playPlaceAction={sfx.place} playVictoryAction={sfx.victory} playDefeatAction={sfx.defeat}
          playRulebreakerAction={sfx.rulebreaker} playTransitionAction={sfx.transition} playClickAction={sfx.click} />
      )}
      {screen === "multiGame" && (
        <GameScreen key={`multiGame_${multiRoomCode}`} themeId={themeId} gameMode={isRanked ? "ranked" : "unranked"} setScreenAction={handleSetScreen}
          roomCode={multiRoomCode} playerSlot={multiPlayerSlot ?? undefined}
          matchupData={multiMatchup ?? undefined}
          p1Name={user?.username}
          graphicsQuality={graphicsQuality}
          boardMode={boardMode} selectedPatterns={selectedPatterns}
          multiplayerRulesBootstrap={multiplayerRulesBootstrap}
          setHomeNoticeAction={setHomeNotice}
          onMultiplayerBoardSync={(mode, pats) => { setBoardMode(mode); setSelectedPatterns(pats); }}
          onMultiplayerSeriesSealedAction={sealMultiSeriesNavigation}
          onMultiplayerSeriesResumedAction={resumeMultiSeriesNavigation}
          onMultiplayerNavLockChange={setMultiplayerNavUnlocked}
          playHoverAction={sfx.hover} playPlaceAction={sfx.place} playVictoryAction={sfx.victory} playDefeatAction={sfx.defeat}
          playRulebreakerAction={sfx.rulebreaker} playTransitionAction={sfx.transition} playClickAction={sfx.click} />
      )}
      {showSettings && (
        <SettingsModal
          onCloseAction={() => setShowSettings(false)}
          themeId={themeId}
          setThemeIdAction={setThemeId}
          audio={{
            musicVol: audio.musicVol, setMusicVol: audio.setMusicVol,
            sfxVol: audio.sfxVol, setSfxVol: audio.setSfxVol,
            muted: audio.muted, toggleMute: audio.toggleMute
          }}
          graphicsQuality={graphicsQuality}
          setGraphicsQualityAction={() => {}}
          currentScreen={screen}
          onNavigateAuthAction={() => setScreen("auth")}
        />
      )}
      {showSessionReplaced && (
        <SessionReplacedModal themeId={themeId} onClose={() => { setShowSessionReplaced(false); setLogoutReason(null); }} />
      )}
      {activeMatchData && (
        <ActiveMatchRejoinModal 
          themeId={themeId} 
          isRanked={activeMatchData.format === "ranked"}
          onRejoin={() => {
            const data = activeMatchData;
            setActiveMatchData(null);
            handleRoomReady(data.room_code, data.player_slot, data.format || (isRanked ? "ranked" : "unranked"));
          }} 
          onForfeit={handleForfeitMatch}
        />
      )}

    </div>
  );
}