"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG, PROTO_LIGHT_SVG, PROTO_DARK_SVG } from "@/lib/currencyIcons";

const RANKS = [
  { name: "NOVICE", min: 0, max: 500, color: "#9CA3AF", img: "/novice.svg", scale: 1.3 },
  { name: "ADVANCED", min: 500, max: 1000, color: "#60A5FA", img: "/advanced.svg", scale: 1.3 },
  { name: "PROFESSIONAL", min: 1000, max: 1500, color: "#34D399", img: "/professional.svg", scale: 1.3 },
  { name: "EMERALD", min: 1500, max: 2000, color: "#10B981", img: "/emerald.svg", scale: 1.495 },
  { name: "MASTER", min: 2000, max: 2500, color: "#FF3333", img: "/master.png" },
  { name: "LEGEND", min: 2500, max: 9999, color: "#F59E0B", img: "/legend.png" },
];

const getRank = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[0];

const NavRankBadge = ({ rank, size = 30 }: { rank: typeof RANKS[0]; size?: number }) => {
  const imgScale = (rank as any).scale ?? 1;
  const imgSize = size * 0.85 * imgScale;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#000000", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      boxShadow: `0 0 10px ${rank.color}55`,
    }}>
      <img src={rank.img} alt={rank.name} style={{ width: imgSize, height: imgSize, objectFit: "contain" }} />
    </div>
  );
};

interface Props {
  screen: Screen;
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  setThemeId?: (t: ThemeId) => void;
  onSettings: () => void;
  inQueue: boolean;
  onQueueClick: () => void;
  isRankedGame?: boolean;
  onHover?: () => void;
}

type LeaveWarning = "unranked" | "ranked" | null;

export default function NavBar({ screen, setScreen, themeId, setThemeId, onSettings, inQueue, onQueueClick, isRankedGame = false, onHover }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, logout } = useAuthStore();
  const isGuest = !user;
  const rank = getRank(user?.elo ?? 0);

  const [showQuit, setShowQuit] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [leaveWarning, setLeaveWarning] = useState<LeaveWarning>(null);
  const [pendingScreen, setPendingScreen] = useState<Screen | null>(null);
  const [mounted, setMounted] = useState(false);
  const ip = themeId === "pixel";
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";

  const toggleFocus = async () => {
    if (!focusMode) {
      try { await document.documentElement.requestFullscreen(); setFocusMode(true); } catch { }
    } else {
      try { await document.exitFullscreen(); setFocusMode(false); } catch { }
    }
  };

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    document.onfullscreenchange = () => { if (!document.fullscreenElement) setFocusMode(false); };
    return () => { document.onfullscreenchange = null; };
  }, []);

  const inGame = screen === "game" || screen === "multiGame";
  const isRanked = screen === "multiGame" && isRankedGame;

  const navigate = (target: Screen) => {
    if (inGame && target !== screen) {
      setPendingScreen(target);
      setLeaveWarning(isRanked ? "ranked" : "unranked");
    } else {
      setScreen(target);
    }
  };

  const confirmLeave = () => {
    if (pendingScreen) setScreen(pendingScreen);
    setLeaveWarning(null);
    setPendingScreen(null);
  };
  const cancelLeave = () => {
    setLeaveWarning(null);
    setPendingScreen(null);
  };

  const getActive = (target: string): boolean => {
    if (target === "queue") return inQueue && screen === "lobby";
    if (target === "multiplayer") return (screen === "lobby" && !inQueue) || screen === "multiGame";
    if (target === "ranked-tab") return screen === "multiGame" && isRankedGame;
    if (target === "unranked-tab") return screen === "multiGame" && !isRankedGame;
    if (target === "singleplayer") return screen === "game";
    if (target === "ai") return screen === "ai";
    if (target === "home") return screen === "home";
    if (target === "rules") return screen === "rules";
    if (target === "profile") return screen === "profile";
    if (target === "store") return screen === "store";
    if (target === "collection") return screen === "collection";
    if (target === "career") return screen === "career";
    if (target === "battlepass") return screen === "battlepass";
    return false;
  };

  const navBtn = (
    target: string,
    label: string,
    isDanger = false,
    disabled = false,
    onClick?: () => void,
    targetScreen?: Screen,
    locked = false,
  ) => {
    const isActive = getActive(target);
    const isHovered = hoveredBtn === target && !disabled;
    const accentCol = isDanger ? t.danger : isClassic ? "#CC2200" : t.accent;

    const fg = disabled
      ? `${t.textMuted}55`
      : (isActive || isHovered) ? accentCol
        : isDanger ? `${t.danger}CC`
          : t.textSecondary;

    return (
      <button
        key={target}
        disabled={disabled}
        onClick={() => {
          if (onClick) { onClick(); return; }
          if (targetScreen) navigate(targetScreen);
        }}
        onMouseEnter={() => { onHover?.(); setHoveredBtn(target); }}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          background: isActive ? `${accentCol}1A` : isHovered ? `${accentCol}0F` : "none",
          borderTop: "none", borderLeft: "none", borderRight: "none",
          borderBottom: `2px solid ${(isActive || isHovered) ? accentCol : "transparent"}`,
          color: fg,
          fontFamily: t.fontBody,
          fontSize: 14,
          fontWeight: isActive ? 800 : isHovered ? 700 : 500,
          padding: "0 16px",
          cursor: disabled ? "not-allowed" : "pointer",
          borderRadius: 0,
          letterSpacing: "0.06em",
          transition: "color 0.15s, border-color 0.15s, background 0.15s",
          height: 68,
          display: "flex", alignItems: "center",
          opacity: disabled ? 0.4 : locked ? 0.6 : 1,
          whiteSpace: "nowrap" as const,
          textTransform: "uppercase" as const,
          textShadow: (isActive || isHovered) ? `0 0 14px ${accentCol}77` : "none",
        }}
      >
        <span style={{ display:"flex", alignItems:"center", gap:5 }}>
          {label.toUpperCase()}
          {locked && <span style={{ fontSize:10, opacity:0.8 }}>🔒</span>}
        </span>
      </button>
    );
  };

  const overlayBtn = (label: string, col: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className="pp-overlay-btn"
      style={{
        background: `${col}18`, border: `2px solid ${col}`, color: col,
        fontFamily: t.fontDisplay, fontSize: ip ? 12 : 17, fontWeight: 700,
        padding: ip ? "10px 28px" : "14px 52px", borderRadius: ip ? 2 : 8,
        cursor: "pointer", letterSpacing: "0.08em",
        transition: "background 0.26s, color 0.26s, transform 0.22s, box-shadow 0.26s",
        boxShadow: `0 0 0 0 ${col}00`,
      } as React.CSSProperties}
      onMouseEnter={e => { onHover?.(); const el = e.currentTarget; el.style.background = col; el.style.color = "#000"; el.style.transform = "scale(1.04)"; el.style.boxShadow = `0 4px 24px ${col}55`; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.background = `${col}18`; el.style.color = col; el.style.transform = "scale(1)"; el.style.boxShadow = "none"; }}
      onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = "scale(1.04)"; }}
    >{label}</button>
  );

  const pentacoins = (user as any)?.pentacoins ?? (user as any)?.shards ?? 0;
  const protocredits = (user as any)?.protocredits ?? 0;

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: 68,
        background: themeId === "classic_light" ? "#FFFFFF" : "rgba(10,10,10,0.88)",
        borderBottom: `1px solid ${t.border}33`,
        display: "flex", alignItems: "center", padding: "0 16px",
        willChange: "auto",
      }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div onClick={() => navigate("home")} style={{
            fontFamily: t.fontDisplay, fontSize: 17, fontWeight: 800,
            color: t.accent, cursor: "pointer",
            textShadow: `0 0 18px ${t.accentGlow}55`,
            letterSpacing: "0.06em", lineHeight: 1,
            transition: "color 0.3s",
            whiteSpace: "nowrap",
          }}>
            PENTAPROTOCOL
          </div>

          <div style={{ width: 1, height: 22, background: `${t.border}55`, flexShrink: 0 }} />

          {mounted && user ? (
            <button
              onClick={() => setShowSignOut(true)}
              onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.borderColor = t.danger; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = `0 0 18px ${t.danger}55`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}14`; e.currentTarget.style.borderColor = `${t.danger}55`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = `0 0 10px ${t.danger}18`; }}
              style={{
                background: `${t.danger}14`,
                border: `1px solid ${t.danger}55`,
                color: t.danger,
                fontFamily: t.fontBody, fontSize: 11, fontWeight: 600,
                padding: "5px 11px", borderRadius: 7, cursor: "pointer",
                transition: "all 0.18s", whiteSpace: "nowrap",
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
              }}
            >Sign Out</button>
          ) : mounted ? (
            <button
              onClick={() => setScreen("auth")}
              onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 0 18px ${t.accentGlow}66`; e.currentTarget.style.borderColor = t.accent; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}22`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = `0 0 10px ${t.accent}22`; e.currentTarget.style.borderColor = `${t.accent}88`; }}
              style={{
                background: `${t.accent}22`,
                border: `1px solid ${t.accent}88`,
                color: t.accent,
                fontFamily: t.fontBody, fontSize: 11, fontWeight: 600,
                padding: "5px 11px", borderRadius: 7, cursor: "pointer",
                transition: "all 0.18s", whiteSpace: "nowrap",
                letterSpacing: "0.06em", textTransform: "uppercase" as const,
              }}
            >Sign In</button>
          ) : null}

          <div style={{ width: 1, height: 22, background: `${t.border}55`, flexShrink: 0 }} />

          <button
            onClick={toggleFocus}
            title={focusMode ? "Exit Focus Mode" : "Focus Mode"}
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 0 18px ${t.accentGlow}66`; }}
            onMouseLeave={e => { e.currentTarget.style.background = focusMode ? `${t.accent}22` : `${t.accent}14`; e.currentTarget.style.borderColor = `${t.accent}55`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = focusMode ? `0 0 10px ${t.accent}44` : `0 0 8px ${t.accent}18`; }}
            style={{
              background: focusMode ? `${t.accent}22` : `${t.accent}14`,
              border: `1px solid ${focusMode ? t.accent : `${t.accent}55`}`,
              color: t.accent,
              fontFamily: t.fontBody, fontSize: 11, fontWeight: 700,
              padding: "5px 11px", borderRadius: 7, cursor: "pointer",
              transition: "all 0.18s",
              display: "flex", alignItems: "center", gap: 5,
              whiteSpace: "nowrap", letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              boxShadow: focusMode ? `0 0 10px ${t.accent}44` : `0 0 8px ${t.accent}18`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {focusMode
                ? <><polyline points="8 3 3 3 3 8" /><polyline points="21 8 21 3 16 3" /><polyline points="3 16 3 21 8 21" /><polyline points="16 21 21 21 21 16" /></>
                : <><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>
              }
            </svg>
            {focusMode ? "Exit" : "Focus"}
          </button>
        </div>

        <div style={{
          position: "absolute", left: "52.2%", top: 0,
          transform: "translateX(-50%)",
          height: 68, display: "flex", alignItems: "center",
          pointerEvents: "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", pointerEvents: "all" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {navBtn("rules", "Game Rules", false, false, undefined, "rules")}
              {navBtn("collection", "Collection", false, false, undefined, "collection")}
              {navBtn("store", "Store", false, false, undefined, "store")}
            </div>

            <div style={{ width: 1, height: 28, background: `${t.border}55`, margin: "0 2px", flexShrink: 0 }} />

            {navBtn("home", "Home", false, false, undefined, "home")}

            <div style={{ width: 1, height: 28, background: `${t.border}55`, margin: "0 2px", flexShrink: 0 }} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
              {navBtn("career", "Career", false, false, undefined, "career", isGuest)}
              {navBtn("battlepass", "Battlepass", false, false, undefined, "battlepass", isGuest)}
              {navBtn("profile", "Profile", false, false, undefined, "profile", isGuest)}
            </div>

          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto", marginRight: 8 }}>

          {mounted && user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 6 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "4px 16px 4px 5px",
                background: `${rank.color}15`,
                border: `1px solid ${rank.color}55`,
                borderRadius: 28,
                whiteSpace: "nowrap",
                boxShadow: `0 0 20px ${rank.color}33`,
              }}>
                <NavRankBadge rank={rank} size={40} />
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 22, fontWeight: 900, color: rank.color, letterSpacing: "0.02em", textShadow: `0 0 14px ${rank.color}99` }}>{user.elo}</span>
                  <span style={{ fontFamily: t.fontMono, fontSize: 9, fontWeight: 700, color: rank.color, opacity: 0.8, letterSpacing: "0.18em" }}>{rank.name}</span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: t.fontMono, fontSize: 16, fontWeight: 700 }}>
                <div style={{ width: 34, height: 34, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? SHARDS_LIGHT_SVG : SHARDS_DARK_SVG).replace("<svg ", '<svg width="34" height="34" ') }} />
                <span style={{ color: "#4FC3F7" }}>{pentacoins}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: t.fontMono, fontSize: 16, fontWeight: 700 }}>
                <div style={{ width: 34, height: 34, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? PROTO_LIGHT_SVG : PROTO_DARK_SVG).replace("<svg ", '<svg width="34" height="34" ') }} />
                <span style={{ color: "#FFD700" }}>{protocredits}</span>
              </div>
            </div>
          )}

          <button
            onClick={onSettings}
            title="Settings"
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.boxShadow = `0 0 16px ${t.accentGlow}44`; e.currentTarget.style.transform = "rotate(30deg)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.text; e.currentTarget.style.background = `${t.border}22`; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "rotate(0deg)"; }}
            style={{
              background: `${t.border}22`, border: `1px solid ${t.border}66`,
              color: t.text,
              padding: "9px 13px", borderRadius: 9, cursor: "pointer",
              transition: "all 0.3s ease",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

        </div>
      </nav>

      {leaveWarning === "unranked" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayFadeIn 0.22s ease both" }}>
          <div style={{ background: t.bgPanel, border: `${ip ? 3 : 1}px solid ${t.border}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 520, width: "90vw", textAlign: "center", boxShadow: "0 40px 100px rgba(0,0,0,0.7)", animation: "overlayModalIn 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
            <div style={{ fontSize: 44, marginBottom: 20 }}>{"⚠️"}</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.text, lineHeight: 1.5, marginBottom: 12 }}>Do you want to leave the current game session?</div>
            <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>Current game progress will be lost.</div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              {overlayBtn("YES", t.danger, confirmLeave)}
              {overlayBtn("NO", t.accent, cancelLeave)}
            </div>
          </div>
        </div>
      )}

      {leaveWarning === "ranked" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayFadeIn 0.22s ease both" }}>
          <div style={{ background: t.bgPanel, border: `${ip ? 3 : 2}px solid ${t.danger}`, borderRadius: ip ? 2 : 20, padding: ip ? "32px 36px" : "48px 56px", maxWidth: 560, width: "90vw", textAlign: "center", boxShadow: `0 40px 100px rgba(0,0,0,0.8),0 0 60px ${t.danger}22`, animation: "overlayModalIn 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
            <div style={{ fontSize: 44, marginBottom: 20 }}>{"🚨"}</div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 14 : 23, fontWeight: 700, color: t.danger, lineHeight: 1.5, marginBottom: 12 }}>Are you sure you want to leave the current game?</div>
            <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 15, color: t.textMuted, marginBottom: 36, lineHeight: 1.7 }}>This will be considered a <span style={{ color: t.danger, fontWeight: 700 }}>forfeit</span> and will result in <span style={{ color: t.danger, fontWeight: 700 }}>deduction of ELO</span>!</div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              {overlayBtn("YES, FORFEIT", t.danger, confirmLeave)}
              {overlayBtn("NO, STAY", t.accent, cancelLeave)}
            </div>
          </div>
        </div>
      )}

      {showQuit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36, animation: "overlayFadeIn 0.22s ease both" }}>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(22px,4vw,48px)", fontWeight: 700, color: t.text, textAlign: "center", lineHeight: 1.4, animation: "overlayModalIn 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
            DO YOU WANT TO QUIT<br />THE PROTOCOL?
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {overlayBtn("YES", t.danger, () => { window.location.href = "about:blank"; })}
            {overlayBtn("NO", t.accent, () => setShowQuit(false))}
          </div>
        </div>
      )}

      {showSignOut && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayFadeIn 0.2s ease both" }}>
          <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 18, padding: ip ? "28px 32px" : "44px 52px", maxWidth: 420, width: "90vw", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "overlayModalIn 0.26s cubic-bezier(.22,.68,0,1.2) both" }}>
            <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${t.danger}14`, border: `1px solid ${t.danger}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 15 : 20, fontWeight: 700, color: t.text, marginBottom: 8, lineHeight: 1.4 }}>Sign out of PentaProtocol?</div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textMuted, marginBottom: 32, lineHeight: 1.6 }}>You'll need to sign back in to play ranked matches and access your profile.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { logout(); setShowSignOut(false); }}
                onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = `0 4px 20px ${t.danger}55`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}14`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; }}
                style={{ flex: 1, padding: "11px 0", background: `${t.danger}14`, border: `1px solid ${t.danger}66`, color: t.danger, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "all 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const, boxShadow: "none" }}>Sign Out</button>
              <button onClick={() => setShowSignOut(false)}
                onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = `${t.accent}14`; e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.textSecondary; }}
                style={{ flex: 1, padding: "11px 0", background: "transparent", border: `1px solid ${t.border}66`, color: t.textSecondary, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "all 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Stay</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes overlayFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes overlayModalIn { from{opacity:0;transform:scale(0.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp         { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .pp-overlay-btn { transition: background 0.26s, color 0.26s, transform 0.22s, box-shadow 0.26s !important; }
        .pp-overlay-btn:hover  { transform: scale(1.06) !important; }
        .pp-overlay-btn:active { transform: scale(0.97) !important; }
      `}</style>
    </>
  );
}