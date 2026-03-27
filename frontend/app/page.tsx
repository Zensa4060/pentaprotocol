"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useAudio } from "@/hooks/useAudio";
import API from "@/lib/api";
import { THEMES } from "@/lib/themes";
import { censorText, containsProfanity } from "@/lib/profanity";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import type { Screen, MatchupData, BoardMode } from "@/lib/types";
import { loadCustomTheme, resolveCustomTheme } from "@/lib/customTheme";
import HomeScreen       from "@/components/HomeScreen";
import AuthScreen       from "@/components/AuthScreen";
import LobbyScreen      from "@/components/LobbyScreen";
import GameScreen       from "@/components/GameScreen";
import ProfileScreen    from "@/components/ProfileScreen";
import RulesScreen      from "@/components/RulesScreen";
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
import { POLICY_GATE_SESSION_KEY, getUserId, hasAcceptedLegal } from "@/lib/legalAcceptance";

THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;

// Screens blocked for guests (not signed in)
const GUEST_BLOCKED: Screen[] = ["lobby", "profile", "career", "battlepass"];

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
  const [graphicsQuality, setGraphicsQuality] = useState<"low" | "balanced" | "ultra">("balanced");
  const [multiRoomCode,   setMultiRoomCode]   = useState<string>("");
  const [multiPlayerSlot, setMultiPlayerSlot] = useState<"P1" | "P2" | null>(null);
  const [multiMatchup, setMultiMatchup]       = useState<MatchupData | null>(null);
  const [customRev, setCustomRev]       = useState(0);

  // Matchmaking states
  const [queuePhase, setQueuePhase] = useState<"none" | "queuing" | "matchup">("none");
  const [queueElapsed, setQueueElapsed] = useState(0);
  const [queueRoomCode, setQueueRoomCode] = useState<string | null>(null);
  const [queuePlayerSlot, setQueuePlayerSlot] = useState<"P1" | "P2">("P1");
  const [matchupOpponent, setMatchupOpponent] = useState<any>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const audioStartedRef    = useRef(false);
  const pendingTheme       = useRef<ThemeId | null>(null);
  const queuePollRef       = useRef<NodeJS.Timeout | null>(null);
  const queueCancelledRef  = useRef(false);
  // ── NEW: prevents double-fire of startMatchmaking ──
  const matchmakingActiveRef = useRef(false);
  // Keep latest queue state accessible inside poll closure
  const queueRoomCodeRef   = useRef<string | null>(null);
  const queuePlayerSlotRef = useRef<"P1" | "P2">("P1");

  const [pendingScreen, setPendingScreen]     = useState<Screen | null>(null);
  const [showAiExitModal, setShowAiExitModal] = useState(false);
  const [showGuestBlock, setShowGuestBlock]   = useState(false);
  /** Resume legal gate after refresh if signup completed but policies not accepted. */

  const { user, token, logout } = useAuthStore();
  const audio = useAudio();
  const { sfx } = audio;

  const t = THEMES[themeId];

  const themeRef  = useRef(themeId);
  const screenRef = useRef(screen);
  const rankedRef = useRef(isRanked);
  const aiDiffRef = useRef(aiDifficulty);
  themeRef.current  = themeId;
  screenRef.current = screen;
  rankedRef.current = isRanked;
  aiDiffRef.current = aiDifficulty;

  // Keep refs in sync with state so closures always see latest values
  useEffect(() => { queueRoomCodeRef.current   = queueRoomCode;   }, [queueRoomCode]);
  useEffect(() => { queuePlayerSlotRef.current = queuePlayerSlot; }, [queuePlayerSlot]);

  const getBgmCtx = (s: Screen, ranked: boolean, aiDiff: Difficulty): "lobby" | "game" | "ranked" => {
    if (s === "aiGame") return aiDiff === "hard" || aiDiff === "danger" || aiDiff === "machine_god" ? "ranked" : "game";
    if (s === "game") return "game";
    if (s === "multiGame") return ranked ? "ranked" : "game";
    return "lobby";
  };

  // Before first paint: restore theme, screen, 7×7 board mode / patterns (no AuthScreen flash if logged in)
  useLayoutEffect(() => {
    const savedTheme = localStorage.getItem("pp_theme") as ThemeId;
    if (savedTheme && THEMES[savedTheme]) setThemeIdRaw(savedTheme);

    const tok = useAuthStore.getState().token;
    const savedScreen = sessionStorage.getItem("pp_screen") as Screen | null;
    const savedRoom = sessionStorage.getItem("pp_multiRoomCode");
    const savedSlot = sessionStorage.getItem("pp_multiPlayerSlot") as "P1" | "P2" | null;
    const savedRanked = sessionStorage.getItem("pp_isRanked") === "true";
    const savedBoard = sessionStorage.getItem("pp_boardMode") as BoardMode | null;
    const savedPats = sessionStorage.getItem("pp_selectedPatterns");
    const savedGraphics = localStorage.getItem("pp_graphics_quality");

    if (savedBoard === "5x5" || savedBoard === "7x7" || savedBoard === "6x6") setBoardMode(savedBoard);
    if (savedGraphics === "low" || savedGraphics === "balanced" || savedGraphics === "ultra") {
      setGraphicsQuality(savedGraphics);
    }
    if (savedPats) {
      try {
        const arr = JSON.parse(savedPats);
        if (Array.isArray(arr)) {
          // Map legacy 'H' pattern to 'Y' pattern to prevent bot API 500 errors
          const mapped = arr.map(p => p === "H" ? "Y" : p);
          // If they happened to have both H and Y (impossible logically, but safely de-duplicate)
          setSelectedPatterns(Array.from(new Set(mapped)));
        }
      } catch { /* ignore */ }
    }

    if (savedScreen) {
      if (tok || !GUEST_BLOCKED.includes(savedScreen)) {
        setScreen(savedScreen);
        if (savedRoom) setMultiRoomCode(savedRoom);
        if (savedSlot) setMultiPlayerSlot(savedSlot);
        setIsRanked(savedRanked);
      } else {
        setScreen("auth");
      }
    } else {
      setScreen(tok ? "home" : "auth");
    }

    window.history.pushState(
      { screen: savedScreen || (tok ? "home" : "auth") },
      "",
      window.location.pathname,
    );
    setAppReady(true);
  }, []);

  useEffect(() => {
    if (!appReady || !user || !token) return;
    const uid = getUserId(user);
    if (!uid) return;
    const pending = sessionStorage.getItem(POLICY_GATE_SESSION_KEY);
    if (pending === uid && !hasAcceptedLegal(uid)) setScreen("policy_gate");
  }, [appReady, user, token]);

  useEffect(() => {
    sessionStorage.setItem("pp_screen", screen);
    sessionStorage.setItem("pp_multiRoomCode", multiRoomCode);
    if (multiPlayerSlot) sessionStorage.setItem("pp_multiPlayerSlot", multiPlayerSlot);
    else sessionStorage.removeItem("pp_multiPlayerSlot");
    sessionStorage.setItem("pp_isRanked", String(isRanked));
    sessionStorage.setItem("pp_boardMode", boardMode);
    sessionStorage.setItem("pp_selectedPatterns", JSON.stringify(selectedPatterns));
  }, [screen, multiRoomCode, multiPlayerSlot, isRanked, boardMode, selectedPatterns]);

  useEffect(() => {
    localStorage.setItem("pp_graphics_quality", graphicsQuality);
  }, [graphicsQuality]);

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
          handleRoomReady(code, slot, mode);
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
    try {
      const res = await postOnce("/api/room/queue/join", { format: mode, board_mode: boardMode }, authHeader);
      if (queueCancelledRef.current) {
        matchmakingActiveRef.current = false;
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
          handleRoomReady(code, slot, mode);
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
      // Show a soft error but keep the queue UI alive — don't exit the queue
      // The user can cancel manually; we don't auto-retry to avoid ghost calls
      setQueueError("Connection issue — still searching...");
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
    if (code) {
      try {
        await API.post("/api/room/queue/leave", { format: mode }, { ...authHeader, timeout: 10000 });
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

  const handleSetScreen = (s: Screen) => {
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

  const handleRoomReady = (roomCode: string, playerSlot: "P1" | "P2", format: string, matchup?: MatchupData) => {
    setMultiRoomCode(roomCode);
    setMultiPlayerSlot(playerSlot);
    setIsRanked(format === "ranked");
    if (matchup) setMultiMatchup(matchup);
    setScreenHistory(prev => [...prev, screen]);
    setScreen("multiGame");
  };

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
     {themeId === "space" && screen !== "home" && <SpaceBg />}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "#000",
        opacity: fadingOut ? 1 : 0,
        pointerEvents: fadingOut ? "all" : "none",
        transition: fadingOut ? "opacity 0.28s ease" : "opacity 0.32s ease",
      }} />

      {showGuestBlock && <GuestBlockModal />}
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
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&family=Exo+2:ital,wght@0,300;0,400;0,600;0,800;1,300&display=swap');
      [data-theme="space"], .space-theme, body {
  --font-display: 'Orbitron', sans-serif;
  --font-body: 'Rajdhani', sans-serif;
  --font-mono: 'Exo 2', sans-serif;
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
          isRankedGame={isRanked}
          onHoverAction={sfx.hover}
          queueElapsed={queueElapsed}
          onCancelQueueAction={cancelMatchmaking}
        />
      )}

      {screen === "home"       && <HomeScreen    setScreenAction={handleSetScreen} themeId={themeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />}
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
      {screen === "ai"         && <AIScreen         setScreenAction={handleSetScreen} themeId={themeId} onSelectDifficultyAction={(d) => { sfx.click(); setAiDifficulty(d); handleSetScreen("aiGame"); }} onHoverAction={sfx.hover} onBoardModeAction={(mode, patterns) => { setBoardMode(mode); setSelectedPatterns(patterns || []); }} />}
      {screen === "singleplayer" && <SingleplayerScreen setScreenAction={handleSetScreen} themeId={themeId} onHoverAction={sfx.hover} onBoardModeAction={(mode: BoardMode, patterns?: string[]) => { setBoardMode(mode); setSelectedPatterns(patterns || []); handleSetScreen("game"); }} />}
      {screen === "store"      && <StoreScreen      setScreenAction={handleSetScreen} themeId={themeId} />}
      {screen === "collection" && <CollectionScreen themeId={themeId} setThemeIdAction={setThemeId} onHoverAction={sfx.hover} onClickAction={sfx.click} />}
      {screen === "career"     && <CareerScreen     themeId={themeId} onHoverAction={sfx.hover} />}
      {screen === "battlepass" && <MissionsScreen themeId={themeId} />}
      {screen === "game" && (
        <GameScreen key={`game_${boardMode}`} themeId={themeId} isSingleplayer={true} gameMode="singleplayer" setScreenAction={handleSetScreen}
          p1Name={user?.username}
          graphicsQuality={graphicsQuality}
          boardMode={boardMode} selectedPatterns={selectedPatterns}
          playHoverAction={sfx.hover} playPlaceAction={sfx.place} playVictoryAction={sfx.victory} playDefeatAction={sfx.defeat}
          playRulebreakerAction={sfx.rulebreaker} playTransitionAction={sfx.transition} playClickAction={sfx.click} />
      )}
      {screen === "aiGame" && (
        <GameScreen key={`aiGame_${boardMode}`} themeId={themeId} gameMode="ai" difficulty={aiDifficulty} setScreenAction={handleSetScreen}
          p1Name={user?.username}
          graphicsQuality={graphicsQuality}
          boardMode={boardMode} selectedPatterns={selectedPatterns}
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
          onMultiplayerBoardSync={(mode, pats) => { setBoardMode(mode); setSelectedPatterns(pats); }}
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
          setGraphicsQualityAction={setGraphicsQuality}
          onNavigateAuthAction={() => setScreen("auth")}
        />
      )}
    </div>
  );
}