"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useAudio } from "@/hooks/useAudio";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";
import type { Difficulty } from "@/lib/botEngine";
import type { Screen } from "@/lib/types";
import { loadCustomTheme, resolveCustomTheme } from "@/lib/customTheme";
import HomeScreen       from "@/components/HomeScreen";
import AuthScreen       from "@/components/AuthScreen";
import LobbyScreen      from "@/components/LobbyScreen";
import GameScreen       from "@/components/GameScreen";
import ProfileScreen    from "@/components/ProfileScreen";
import RulesScreen      from "@/components/RulesScreen";
import AIScreen         from "@/components/AIScreen";
import StoreScreen      from "@/components/Storescreen";
import CollectionScreen from "@/components/CollectionScreen";
import CareerScreen     from "@/components/CareerScreen";
import NavBar           from "@/components/NavBar";
import SettingsModal    from "@/components/SettingsModal";

THEMES["custom" as ThemeId] = resolveCustomTheme(loadCustomTheme(), THEMES) as any;

// Screens blocked for guests (not signed in)
const GUEST_BLOCKED: Screen[] = ["lobby", "profile", "career", "battlepass"];

export default function Page() {
  const [themeId, setThemeIdRaw]        = useState<ThemeId>("classic_dark");
  const [screen, setScreen]             = useState<Screen>("auth");
  const [screenHistory, setScreenHistory] = useState<Screen[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [inQueue, setInQueue]           = useState(false);
  const [isRanked, setIsRanked]         = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [fadingOut, setFadingOut]       = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium");
  const [multiRoomCode,   setMultiRoomCode]   = useState<string>("");
  const [multiPlayerSlot, setMultiPlayerSlot] = useState<"P1" | "P2" | null>(null);
  const [customRev, setCustomRev]       = useState(0);
  const audioStartedRef                 = useRef(false);
  const pendingTheme                    = useRef<ThemeId | null>(null);

  const [pendingScreen, setPendingScreen]     = useState<Screen | null>(null);
  const [showAiExitModal, setShowAiExitModal] = useState(false);

  const [showGuestBlock, setShowGuestBlock] = useState(false);

  const { user, token } = useAuthStore();
  const audio = useAudio();
  const { sfx } = audio;

  const t = THEMES[themeId];

  const themeRef  = useRef(themeId);
  const screenRef = useRef(screen);
  const rankedRef = useRef(isRanked);
  themeRef.current  = themeId;
  screenRef.current = screen;
  rankedRef.current = isRanked;

  const getBgmCtx = (s: Screen, ranked: boolean): "lobby" | "game" | "ranked" => {
    if (s === "game" || s === "aiGame") return "game";
    if (s === "multiGame") return ranked ? "ranked" : "game";
    return "lobby";
  };

  // On mount: restore theme; if token exists skip auth screen
  useEffect(() => {
    const saved = localStorage.getItem("pp_theme") as ThemeId;
    if (saved && THEMES[saved]) setThemeIdRaw(saved);
    if (token) setScreen("home");
    // Push initial history state so back button has something to pop
    window.history.pushState({ screen: token ? "home" : "auth" }, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      audio.playBgm(themeRef.current, getBgmCtx(screenRef.current, rankedRef.current));
    };
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
    audio.playBgm(themeId, getBgmCtx(screen, isRanked));
  }, [themeId, screen, isRanked, audioStarted]);

  useEffect(() => {
    if (screen !== "lobby") setInQueue(false);
  }, [screen]);

  useEffect(() => {
    const onGotoStore = () => handleSetScreen("store");
    window.addEventListener("pp_goto_store", onGotoStore);
    return () => window.removeEventListener("pp_goto_store", onGotoStore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push browser history state on every screen change
  useEffect(() => {
    window.history.pushState({ screen }, "", window.location.pathname);
  }, [screen]);

  // Intercept browser back button
  useEffect(() => {
    const onPopState = (_e: PopStateEvent) => {
      // Always push state back to prevent leaving the site
      window.history.pushState({ screen: screenRef.current }, "", window.location.pathname);

      // Navigate to previous screen in our history stack
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
    // Guest block: not signed in, trying to access restricted screen
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
    // Push current screen to history before navigating
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

  const handleRoomReady = (roomCode: string, playerSlot: "P1" | "P2", format: string) => {
    setMultiRoomCode(roomCode);
    setMultiPlayerSlot(playerSlot);
    setIsRanked(format === "ranked");
    setScreenHistory(prev => [...prev, screen]);
    setScreen("multiGame");
  };

  // Guest block modal overlay
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
        <div style={{ fontSize: 44, marginBottom: 18 }}>🔒</div>
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

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      color: t.text,
      fontFamily: t.fontBody,
      transition: "background 0.6s ease, color 0.6s ease",
    }}>

      <div style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "#000",
        opacity: fadingOut ? 1 : 0,
        pointerEvents: fadingOut ? "all" : "none",
        transition: fadingOut ? "opacity 0.28s ease" : "opacity 0.32s ease",
      }} />

      {showGuestBlock && <GuestBlockModal />}

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
            <div style={{ fontSize: 40, marginBottom: 18 }}>⚠️</div>
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
        * { user-select: none !important; -webkit-user-select: none !important; }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=EB+Garamond:wght@400;500;600&family=Courier+Prime&family=Fira+Code:wght@400;500;700&family=VT323&family=Audiowide&family=Jura:wght@400;600;700&family=Share+Tech+Mono&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${t.bg}; transition: background 0.6s ease; }
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

      {screen !== "auth" && (
        <NavBar
          screen={screen}
          setScreen={handleSetScreen}
          themeId={themeId}
          onSettings={() => { sfx.click(); setShowSettings(true); }}
          inQueue={inQueue}
          onQueueClick={() => setScreen("lobby")}
          isRankedGame={isRanked}
          onHover={sfx.hover}
        />
      )}

      {screen === "home"       && <HomeScreen    setScreen={handleSetScreen} themeId={themeId} onHover={sfx.hover} onClick={sfx.click} />}
      {screen === "auth"       && <AuthScreen    setScreen={setScreen}       themeId={themeId} />}
      {screen === "lobby"      && (
        <LobbyScreen
          setScreen={handleSetScreen}
          themeId={themeId}
          onQueueStart={(mode) => { setIsRanked(mode === "ranked"); setInQueue(true); sfx.matchFound(); }}
          onQueueCancel={() => setInQueue(false)}
          onHover={sfx.hover}
          onClick={sfx.click}
          onRoomReady={handleRoomReady}
        />
      )}
      {screen === "profile"    && <ProfileScreen    themeId={themeId} onHover={sfx.hover} onClick={sfx.click} />}
      {screen === "rules"      && <RulesScreen      themeId={themeId} onHover={sfx.hover} onClick={sfx.click} />}
      {screen === "ai"         && <AIScreen         setScreen={handleSetScreen} themeId={themeId} onSelectDifficulty={(d) => { sfx.click(); setAiDifficulty(d); handleSetScreen("aiGame"); }} onHover={sfx.hover} />}
      {screen === "store"      && <StoreScreen      setScreen={handleSetScreen} themeId={themeId} />}
      {screen === "collection" && <CollectionScreen themeId={themeId} setThemeId={setThemeId} onHover={sfx.hover} onClick={sfx.click} />}
      {screen === "career"     && <CareerScreen     themeId={themeId} onHover={sfx.hover} />}
{screen === "game" && (
  <GameScreen key="game" themeId={themeId} isSingleplayer={true} gameMode="singleplayer" setScreen={handleSetScreen}
    p1Name={user?.username}
    playHover={sfx.hover} playPlace={sfx.place} playVictory={sfx.victory} playDefeat={sfx.defeat}
    playRulebreaker={sfx.rulebreaker} playTransition={sfx.transition} playClick={sfx.click} />
)}
{screen === "aiGame" && (
  <GameScreen key="aiGame" themeId={themeId} gameMode="ai" difficulty={aiDifficulty} setScreen={handleSetScreen}
    p1Name={user?.username}
    playHover={sfx.hover} playPlace={sfx.place} playVictory={sfx.victory} playDefeat={sfx.defeat}
    playRulebreaker={sfx.rulebreaker} playTransition={sfx.transition} playClick={sfx.click} />
)}
{screen === "multiGame" && (
  <GameScreen key="multiGame" themeId={themeId} gameMode={isRanked ? "ranked" : "unranked"} setScreen={handleSetScreen}
    roomCode={multiRoomCode} playerSlot={multiPlayerSlot ?? undefined}
    p1Name={user?.username}
    playHover={sfx.hover} playPlace={sfx.place} playVictory={sfx.victory} playDefeat={sfx.defeat}
    playRulebreaker={sfx.rulebreaker} playTransition={sfx.transition} playClick={sfx.click} />
)}
      {showSettings && (
        <SettingsModal
          onClose={() => { sfx.click(); setShowSettings(false); }}
          themeId={themeId}
          setThemeId={setThemeId}
          audio={audio}
        />
      )}
    </div>
  );
}