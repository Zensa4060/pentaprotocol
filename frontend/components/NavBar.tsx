"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { SHARDS_LIGHT_SVG, SHARDS_DARK_SVG, PROTO_LIGHT_SVG, PROTO_DARK_SVG } from "@/lib/currencyIcons";
import { getUserKey, loadMissionState } from "@/lib/missionsClient";
import { countClaimableMissions } from "@/lib/countClaimableMissions";
import { getStoreCatalogSignature } from "@/components/Storescreen";
import {
  PP_NAV_BADGES_EVENT,
  clearCareerNavBadge,
  clearProfileNavBadge,
  getCareerNavBadgeCount,
  getCollectionNavBadgeCount,
  getPatchNavBadgeCount,
  getProfileNavBadgeCount,
  getStoreNewCatalogBadgeCount,
} from "@/lib/navBadgeState";

export const RANKS = [
  { name: "UNRANKED",     min: -1,   max: -1,      color: "#FF33FF", img: undefined,               scale: 1     },
  { name: "ROOKIE",    min: 0,    max: 500,     color: "#9CA3AF", img: "/novice.png?v=2",       scale: 1.3   },
  { name: "SKILLED",   min: 500,  max: 1000,    color: "#60A5FA", img: "/advanced.png?v=2",     scale: 1.3   },
  { name: "ELITE",     min: 1000, max: 1500,    color: "#A78BFA", img: "/professional.png?v=11", scale: 0.741 },
  { name: "MYTHIC",    min: 1500, max: 2000,    color: "#10B981", img: "/emerald.png?v=2",      scale: 1.495 },
  { name: "CRACKED",   min: 2000, max: 2500,    color: "#FF3333", img: "/master.png?v=5"                     },
  { name: "CHRONICLE", min: 2500, max: 1000000, color: "#F59E0B", img: "/legend.png?v=3"                     },
];

export const getRank = (elo: number, isPlacement: boolean = false) => {
  if (isPlacement) return RANKS.find(r => r.name === "UNRANKED") || RANKS[0];
  return RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[0];
};

/**
 * Glow strength vs Legend (100%). Legend = prior peak × 0.75 (extra −25%).
 * Wolf 1%, Advanced 20%, … Legend 100%.
 */
export function rankGlowTierFraction(rank: { name: string }): number {
  const T: Record<string, number> = {
    ROOKIE: 0.01,
    SKILLED: 0.2,
    ELITE: 0.4,
    MYTHIC: 0.6,
    CRACKED: 0.8,
    CHRONICLE: 1,
    UNRANKED: 0.6,
  };
  return T[rank.name] ?? 0.01;
}

/** Legend reference tier multiplier (before global / top-rank tweaks) */
const LEGEND_GLOW_REF = 0.75;
const GLOW_GLOBAL = 0.95;
const MASTER_LEGEND_GLOW_HALF = 0.5;
/** Extra +20% glow applied only to the top two ranks (Master & Legend).
 *  Multiplies both the drop-shadow filter strength and the halo gradient
 *  intensity so the effect shows up consistently wherever the rank emblem
 *  is rendered. */
const TOP_RANK_GLOW_BOOST = 1.2;

/** Final glow strength for filters / halos (all ranks −5%; Master & Legend −50% more, then +20% extra). */
export function rankGlowVisualStrength(rank: { name: string }): number {
  const tier = rankGlowTierFraction(rank);
  let m = LEGEND_GLOW_REF * GLOW_GLOBAL;
  if (rank.name === "CRACKED" || rank.name === "CHRONICLE") {
    m *= MASTER_LEGEND_GLOW_HALF * TOP_RANK_GLOW_BOOST;
  }
  return tier * m;
}

function hx(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

export function buildRankEmblemGlowFilter(color: string, strength: number): string {
  const t = strength;
  if (t < 0.0012) return "none";
  const c = color.length >= 7 ? color.slice(0, 7) : color;
  const b0 = Math.max(1, Math.round(3 * t));
  const b1 = Math.max(1, Math.round(9 * t));
  const b2 = Math.max(1, Math.round(20 * t));
  const b3 = Math.max(1, Math.round(32 * t));
  const a0 = Math.min(255, Math.round(255 * t));
  const a1 = Math.min(255, Math.round(0x99 * t));
  const a2 = Math.min(255, Math.round(0x4d * t));
  const a3 = Math.min(255, Math.round(0x26 * t));
  return `drop-shadow(0 0 ${b0}px ${c}${hx(Math.max(1, a0))}) drop-shadow(0 0 ${b1}px ${c}${hx(a1)}) drop-shadow(0 0 ${b2}px ${c}${hx(a2)}) drop-shadow(0 0 ${b3}px ${c}${hx(a3)})`;
}

export function rankHaloGradientForRank(color: string, rank: { name: string }): string {
  const tier = rankGlowTierFraction(rank);
  const isTopRank = rank.name === "CRACKED" || rank.name === "CHRONICLE";
  const scale =
    tier *
    GLOW_GLOBAL *
    (isTopRank ? MASTER_LEGEND_GLOW_HALF * TOP_RANK_GLOW_BOOST : 1);
  if (scale < 0.002) return "transparent";
  const c = color.length >= 7 ? color.slice(0, 7) : color;
  return `radial-gradient(circle, ${c}${hx(0x40 * scale)} 0%, ${c}${hx(0x19 * scale)} 38%, transparent 68%)`;
}

export const NavRankBadge = ({ rank, size = 30, isPlacement = false }: { rank: typeof RANKS[0]; size?: number; isPlacement?: boolean }) => {
  const imgScale = (rank as any).scale ?? 1;
  const imgSize = size * 0.85 * imgScale;
  const placementCol = "#FF33FF"; // Vibrant Magenta for placement
  const strength = isPlacement ? 0.6 : rankGlowVisualStrength(rank);
  const filt = isPlacement ? buildRankEmblemGlowFilter(placementCol, strength) : buildRankEmblemGlowFilter(rank.color, strength);
  const hasHalo = strength >= 0.0012;
  const emblemImg = rank.img;
  
  return (
    <div className="rank-badge-container" style={{
      width: size, height: size, borderRadius: "50%",
      background: isPlacement ? "rgba(255,51,255,0.05)" : "transparent", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "visible",
      boxShadow: isPlacement ? `inset 0 0 15px ${placementCol}22` : "none",
      border: isPlacement ? `1px solid ${placementCol}44` : "none",
      position: "relative",
      transition: "transform 0.3s ease, filter 0.3s ease",
      "--rank-col": isPlacement ? placementCol : rank.color
    } as any}>
      {hasHalo && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "135%",
            height: "135%",
            borderRadius: "50%",
            background: rankHaloGradientForRank(isPlacement ? placementCol : rank.color, isPlacement ? { name: "CHRONICLE" } as any : rank),
            pointerEvents: "none",
            zIndex: 0,
            animation: "rankHaloPulse 2.6s ease-in-out infinite",
          }}
        />
      )}
      
      {isPlacement ? (
        <div style={{
          position: "relative", zIndex: 2,
          fontFamily: "'Press Start 2P', cursive", fontSize: size * 0.55,
          color: "#fff", 
          textShadow: `0 0 10px ${placementCol}, 0 0 20px ${placementCol}aa`,
          display: "flex", alignItems: "center", justifyContent: "center",
          filter: filt,
          marginTop: size * 0.05
        }}>?</div>
      ) : (
        emblemImg && (
          <img
            src={emblemImg}
            alt={rank.name}
            draggable={false}
            className="rank-emblem-img"
            style={{
              width: imgSize,
              height: imgSize,
              objectFit: "contain",
              userSelect: "none",
              pointerEvents: "none",
              position: "relative",
              zIndex: 1,
              filter: filt,
              backgroundColor: "transparent",
              opacity: 1,
            }}
          />
        )
      )}
    </div>
  );
};

interface Props {
  screen: Screen;
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  setThemeId?: (t: ThemeId) => void;
  onSettingsAction: () => void;
  inQueue: boolean;
  onQueueClickAction: () => void;
  onHoverAction?: () => void;
  queueElapsed?: number;
  onCancelQueueAction?: () => void;
  /** When true, logo and all nav targets are inert during live multiplayer (Settings stays usable). */
  lockMultiplayerNav?: boolean;
}

export default function NavBar({ 
  screen, setScreenAction, themeId, onSettingsAction, inQueue, onHoverAction,
  queueElapsed = 0, onCancelQueueAction, lockMultiplayerNav = false,
}: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user, logout } = useAuthStore();
  const isGuest = !user;

  const [showSignOut, setShowSignOut]   = useState(false);
  const [focusMode, setFocusMode]       = useState(false);
  const [hoveredBtn, setHoveredBtn]     = useState<string | null>(null);
  const [mounted, setMounted]           = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [vw, setVw]                     = useState(1440);
  const [missionShardBonus, setMissionShardBonus] = useState(0);
  const [navBadgeTick, setNavBadgeTick] = useState(0);
  const [badgeNow, setBadgeNow]         = useState(() => Date.now());

  const storeCatalogSig = useMemo(() => getStoreCatalogSignature(), []);

  const ip        = themeId === "pixel";
  const isClassic = themeId === "classic_light" || themeId === "classic_dark";

  // Track viewport width
  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const id = window.setInterval(() => setBadgeNow(Date.now()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const on = () => setNavBadgeTick((x) => x + 1);
    window.addEventListener(PP_NAV_BADGES_EVENT, on);
    window.addEventListener("pp_mission_event", on);
    window.addEventListener("pp_mission_state_change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(PP_NAV_BADGES_EVENT, on);
      window.removeEventListener("pp_mission_event", on);
      window.removeEventListener("pp_mission_state_change", on);
      window.removeEventListener("storage", on);
    };
  }, []);

  useEffect(() => {
    if (screen === "career") clearCareerNavBadge();
    if (screen === "profile") clearProfileNavBadge();
  }, [screen]);

  const missionClaimBadge = useMemo(() => {
    void navBadgeTick;
    void badgeNow;
    if (!user) return 0;
    try {
      return countClaimableMissions(getUserKey(user), user as Record<string, unknown>, badgeNow);
    } catch {
      return 0;
    }
  }, [user, navBadgeTick, badgeNow]);

  const patchNoteBadge = useMemo(() => {
    void navBadgeTick;
    return getPatchNavBadgeCount();
  }, [navBadgeTick]);

  const storeNewBadge = useMemo(() => {
    void navBadgeTick;
    return getStoreNewCatalogBadgeCount(storeCatalogSig);
  }, [storeCatalogSig, navBadgeTick]);

  const careerMpBadge = useMemo(() => {
    void navBadgeTick;
    return getCareerNavBadgeCount();
  }, [navBadgeTick]);

  const profileNotifyBadge = useMemo(() => {
    void navBadgeTick;
    return getProfileNavBadgeCount();
  }, [navBadgeTick]);

  const collectionNotifyBadge = useMemo(() => {
    void navBadgeTick;
    return getCollectionNavBadgeCount();
  }, [navBadgeTick]);

  const mobileNavBadge = (target: string): number => {
    switch (target) {
      case "patchNotes": return patchNoteBadge;
      case "collection": return collectionNotifyBadge;
      case "store": return storeNewBadge;
      case "career": return careerMpBadge;
      case "battlepass": return missionClaimBadge;
      case "profile": return profileNotifyBadge;
      default: return 0;
    }
  };

  const navCountPill = (n: number) =>
    n > 0 ? (
      <span
        aria-hidden
        style={{
          minWidth: 18,
          height: 18,
          padding: "0 5px",
          borderRadius: 999,
          background: "#dc2626",
          color: "#fff",
          fontSize: 10,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
          boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
          flexShrink: 0,
        }}
      >
        {n > 99 ? "99+" : n}
      </span>
    ) : null;

  useEffect(() => {
    if (typeof window === "undefined" || !user) {
      setMissionShardBonus(0);
      return;
    }
    const userKey = getUserKey(user);
    let last = -1;
    const refresh = () => {
      const v = loadMissionState(userKey).shardBalance || 0;
      if (v !== last) {
        last = v;
        setMissionShardBonus(v);
      }
    };
    refresh();
    window.addEventListener("pp_mission_state_change", refresh);
    window.addEventListener("storage", refresh);
    const pollId = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("pp_mission_state_change", refresh);
      window.removeEventListener("storage", refresh);
      window.clearInterval(pollId);
    };
  }, [user]);
  useEffect(() => {
    document.onfullscreenchange = () => { if (!document.fullscreenElement) setFocusMode(false); };
    return () => { document.onfullscreenchange = null; };
  }, []);

  // Close hamburger on screen change
  useEffect(() => { setMenuOpen(false); }, [screen]);

  const toggleFocus = async () => {
    if (!focusMode) {
      try { await document.documentElement.requestFullscreen(); setFocusMode(true); } catch {}
    } else {
      try { await document.exitFullscreen(); setFocusMode(false); } catch {}
    }
  };

  const navigate = (target: Screen, isLocked: boolean = false) => {
    setMenuOpen(false);
    if (lockMultiplayerNav && target !== screen) {
      return;
    }
    if (isLocked && isGuest) {
      setScreenAction("auth");
      return;
    }
    setScreenAction(target);
  };

  const getActive = (target: string): boolean => {
    if (target === "home")       return screen === "home";
    if (target === "patchNotes") return screen === "patchNotes";
    if (target === "profile")    return screen === "profile";
    if (target === "store")      return screen === "store";
    if (target === "collection") return screen === "collection";
    if (target === "career")     return screen === "career";
    if (target === "battlepass") return screen === "battlepass";
    return false;
  };

  // Responsive breakpoints
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const isDesktop = vw >= 1024;
  const isCompactDesktop = isDesktop && vw < 1320; // Compression zone
  const isUltraWide = vw >= 2560; // 2K, 4K, 8K support


  // Scaled sizes
  const NAV_H       = isMobile ? 52 : isTablet ? 60 : 68;
  const BTN_FONT    = isMobile ? 13 : isTablet ? 14 : "clamp(14px, 1.25vw, 17.5px)";
  // Setting ICON size directly relative to Nav Base Height (nearly as big as navbar)
  const ICON_SIZE   = Math.floor(NAV_H * 0.85); 
  const CURRENCY_SZ = isMobile ? 40 : isTablet ? 48 : 60; // 100% larger
  const CURRENCY_FONT = isMobile ? 18 : isTablet ? 24 : 28; // Increased font size

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const navBtn = (
    target: string,
    label: string,
    isDanger = false,
    disabled = false,
    onClick?: () => void,
    targetScreen?: Screen,
    locked = false,
    badgeCount?: number,
  ) => {
    const isActive  = getActive(target);
    const navHardLocked = lockMultiplayerNav;
    const effectiveDisabled = disabled || navHardLocked;
    const isHovered = hoveredBtn === target && !effectiveDisabled;
    const accentCol = isDanger ? t.danger : isClassic ? "#CC2200" : t.accent;

    // Label Compression: Hide text labels for secondary items on small desktops
    const hideLabel = isCompactDesktop && ["collection", "store", "patchNotes", "battlepass"].includes(target);

    const fg = effectiveDisabled
      ? `${t.textMuted}55`
      : (isActive || isHovered) ? accentCol
      : isDanger ? `${t.danger}CC`
      : `${t.textSecondary}EE`;

    const bc = badgeCount && badgeCount > 0 ? badgeCount : 0;
    return (
      <button
        key={target}
        disabled={effectiveDisabled}
        type="button"
        title={bc || hideLabel ? `${label}${bc ? ` — ${bc}` : ""}` : undefined}
        onClick={() => { if (onClick) { onClick(); return; } if (targetScreen) navigate(targetScreen, locked); }}
        onMouseEnter={() => { onHoverAction?.(); setHoveredBtn(target); }}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          background:    isActive ? `${accentCol}1A` : isHovered ? `${accentCol}0F` : "none",
          borderTop: "none", borderLeft: "none", borderRight: "none",
          borderBottom:  `2px solid ${(isActive || isHovered) ? accentCol : "transparent"}`,
          color:         fg,
          fontFamily:    t.fontBody,
          fontSize:      BTN_FONT,
          fontWeight:    isActive ? 800 : isHovered ? 700 : 600,
          padding:       isMobile ? "0 10px" : isTablet ? "0 12px" : hideLabel ? "0 14px" : "0 16px",
          cursor:        effectiveDisabled ? "not-allowed" : "pointer",
          borderRadius:  0,
          letterSpacing: "0.06em",
          transition:    "color 0.15s, border-color 0.15s, background 0.15s, padding 0.2s",
          height:        NAV_H,
          display:       "flex", alignItems: "center",
          opacity:       navHardLocked ? 0 : effectiveDisabled ? 0.4 : locked ? 0.6 : 1,
          whiteSpace:    "nowrap" as const,
          textTransform: "uppercase" as const,
          textShadow:    (isActive || isHovered)
            ? `0 0 10px ${accentCol}, 0 0 20px ${accentCol}99, 0 0 40px ${accentCol}55`
            : `0 0 8px ${t.textSecondary}44`,
          flexShrink: hideLabel ? 1 : 0,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {navCountPill(bc)}
          {!hideLabel && label.toUpperCase()}
          {hideLabel && label.charAt(0).toUpperCase()}
          {locked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </span>
      </button>
    );
  };

  const pentashardsBase = (user as any)?.pentashards ?? (user as any)?.shards ?? 0;
  const pentashards = pentashardsBase + missionShardBonus;
  const protocredits = (user as any)?.protocredits ?? 0;

  const RULES_INFO_SZ = isMobile ? 36 : isTablet ? 44 : 52;
  const rulesInfoButton = (
    <button
      type="button"
      disabled={lockMultiplayerNav}
      onClick={() => navigate("rules")}
      title="Game rules — how to play"
      aria-label="Game rules"
      onMouseEnter={(e) => {
        onHoverAction?.();
        e.currentTarget.style.borderColor = t.accent;
        e.currentTarget.style.color = t.accent;
        e.currentTarget.style.background = `${t.accent}18`;
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = `${t.border}66`;
        el.style.color = t.text;
        el.style.background = `${t.border}22`;
        el.style.transform = "scale(1)";
      }}
      style={{
        background: `${t.border}22`,
        border: `1px solid ${t.border}66`,
        color: t.text,
        width: RULES_INFO_SZ,
        height: RULES_INFO_SZ,
        borderRadius: "50%",
        cursor: lockMultiplayerNav ? "not-allowed" : "pointer",
        opacity: lockMultiplayerNav ? 0 : 1,
        transition: "all 0.3s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{ fontFamily: t.fontDisplay, fontSize: RULES_INFO_SZ * 0.42, fontWeight: 800, fontStyle: "italic", lineHeight: 1 }}>i</span>
    </button>
  );

  // Nav links list for both desktop and hamburger menu
  const navLinks = [
    { target: "patchNotes", label: "PATCH NOTES", screen: "patchNotes" as Screen },
    { target: "collection", label: "Collection",  screen: "collection" as Screen },
    { target: "store",      label: "Store",       screen: "store"      as Screen },
    { target: "home",       label: "Home",        screen: "home"       as Screen },
    { target: "career",     label: "Career",      screen: "career"     as Screen, locked: isGuest },
    { target: "battlepass", label: "MISSIONS",  screen: "battlepass" as Screen, locked: isGuest },
    { target: "profile",    label: "Profile",     screen: "profile"    as Screen, locked: isGuest },
  ];

  return (
    <>
      <style>{`
        @keyframes slideDown { from{transform:translateY(-100%)} to{transform:translateY(0)} }
        
        .rank-badge-container {
          position: relative;
          overflow: visible;
        }
        .rank-badge-container:hover {
          transform: scale(1.08);
        }
      `}</style>

      {inQueue && screen !== "lobby" && (
        <div style={{
          position: "fixed", top: NAV_H, left: 0, right: 0, zIndex: 190,
          background: `linear-gradient(90deg, ${t.accent}15, ${t.bgPanel}F2, ${t.accent}15)`,
          borderBottom: `1px solid ${t.accent}44`,
          height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          gap: 16, backdropFilter: "blur(8px)", animation: "slideDown 0.3s ease both"
        }}>
          <div style={{ display: "flex", alignItems:"center", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, boxShadow: `0 0 10px ${t.accentGlow}`, animation: "pulse 1.5s infinite" }} />
            <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: "0.1em" }}>
              SEARCHING FOR MATCH... <span style={{ color: t.text }}>[{fmt(queueElapsed)}]</span>
            </div>
          </div>
          <button 
            onClick={onCancelQueueAction}
            onMouseEnter={onHoverAction}
            style={{ background: "none", border: `1px solid ${t.danger}88`, color: t.danger, fontFamily: t.fontMono, fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer", transition: "all 0.2s" }}
            onMouseOver={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
            onMouseOut={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = t.danger; }}
          >CANCEL</button>
        </div>
      )}

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: NAV_H,
        background: themeId === "classic_light" ? "#FFFFFF" : themeId === "space" ? "rgba(4,8,24,0.85)" : "rgba(10,10,10,0.92)",
        borderBottom: `1px solid ${t.border}33`,
        display: "flex", alignItems: "center",
        padding: isMobile ? "0 10px" : "0 16px",
        gap: isMobile ? 6 : 10,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>

        {/* ── LEFT: Logo + PentaShards ── */}
        <div style={{ display: "flex", alignItems: "center", gap: isTablet ? 12 : 20, flexShrink: 0, minWidth: 0 }}>
          <div
            onClick={() => { if (!lockMultiplayerNav) navigate("home"); }}
            title="Home"
            style={{
              cursor: lockMultiplayerNav ? "not-allowed" : "pointer",
              opacity: lockMultiplayerNav ? 0 : 1,
              pointerEvents: lockMultiplayerNav ? "none" : "auto",
              display: "flex",
              alignItems: "center",
            }}
          >
            <img
              src="/Pentaprotocol_Logo_Transparent.png"
              alt="PentaProtocol Logo"
              style={{
                width: isMobile ? 36 : isTablet ? 44 : 52,
                height: isMobile ? 36 : isTablet ? 44 : 52,
                objectFit: "contain",
                filter: "drop-shadow(0 0 12px rgba(255,100,30,0.4))",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            />
          </div>

          {mounted && (
            <div
              title="PentaShards: earn rewards from missions and events to redeem free skins in the Store."
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: t.fontMono, fontSize: CURRENCY_FONT, fontWeight: 700 }}
            >
              <div style={{ width: CURRENCY_SZ, height: CURRENCY_SZ, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? SHARDS_LIGHT_SVG : SHARDS_DARK_SVG).replace("<svg ", `<svg width="${CURRENCY_SZ}" height="${CURRENCY_SZ}" `) }} />
              <span style={{ color: "#4FC3F7" }}>{pentashards}</span>
            </div>
          )}
        </div>

        {/* ── CENTER: nav links (desktop & tablet) ── */}
        {isDesktop && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", minWidth: 0,
          }}>
            <div style={{ 
              display: "flex", alignItems: "center", flexWrap: "nowrap", 
              gap: isUltraWide ? "3vw" : "clamp(6px, 1.2vw, 24px)",
              transition: "gap 0.3s ease"
            }}>
              {navBtn("patchNotes", "PATCH NOTES", false, false, undefined, "patchNotes", false, patchNoteBadge)}
              {navBtn("collection", "Collection", false, false, undefined, "collection", false, collectionNotifyBadge)}
              {navBtn("store",      "Store",      false, false, undefined, "store", false, storeNewBadge)}
              {navBtn("home",       "Home",       false, false, undefined, "home")}
              {navBtn("career",     "Career",     false, false, undefined, "career",     isGuest, careerMpBadge)}
              {navBtn("battlepass", "MISSIONS", false, false, undefined, "battlepass", isGuest, missionClaimBadge)}
                {navBtn("profile", "Profile", false, false, undefined, "profile", isGuest, profileNotifyBadge)}
                <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{rulesInfoButton}</div>
            </div>
          </div>
        )}

        {isTablet && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 6 }}>
              {navBtn("home",    "Home",    false, false, undefined, "home")}
              {navBtn("store",   "Store",   false, false, undefined, "store", false, storeNewBadge)}
              {navBtn("profile", "Profile", false, false, undefined, "profile", isGuest, profileNotifyBadge)}
              {navBtn("career",  "Career",  false, false, undefined, "career",  isGuest, careerMpBadge)}
              <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{rulesInfoButton}</div>
            </div>
          </div>
        )}

        {/* Spacer on mobile/tablet to push right section to end. (Center section handles it via flex on desktop) */}
        {!isDesktop && <div style={{ flex: 1 }} />}

        {/* ── RIGHT: currency + settings + hamburger ── */}
        <div style={{ display: "flex", alignItems: "center", gap: isTablet ? 12 : 20, flexShrink: 0, marginLeft: "auto" }}>

          {/* Currencies — show everywhere since sizing is increased */}
          {mounted && (
            <div
              title="ProtoCredits: premium currency to buy skins, themes, and bundles in the Store."
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: t.fontMono, fontSize: CURRENCY_FONT, fontWeight: 700 }}
            >
              <div style={{ width: CURRENCY_SZ, height: CURRENCY_SZ, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? PROTO_LIGHT_SVG : PROTO_DARK_SVG).replace("<svg ", `<svg width="${CURRENCY_SZ}" height="${CURRENCY_SZ}" `) }} />
              <span style={{ color: "#FFD700" }}>{protocredits}</span>
            </div>
          )}

          {isMobile && (
            <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>{rulesInfoButton}</div>
          )}

          {/* Settings button */}
          <button
            onClick={onSettingsAction}
            title="Settings"
            onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.text; e.currentTarget.style.background = `${t.border}22`; e.currentTarget.style.transform = "scale(1)"; }}
            style={{
              background: `${t.border}22`, border: `1px solid ${t.border}66`, color: t.text,
              width: isMobile ? 36 : isTablet ? 44 : 52, 
              height: isMobile ? 36 : isTablet ? 44 : 52, 
              borderRadius: "25%", cursor: "pointer",
              transition: "all 0.3s ease",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}
          >
            <svg width={(isMobile ? 36 : isTablet ? 44 : 52) * 0.6} height={(isMobile ? 36 : isTablet ? 44 : 52) * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {/* Hamburger — mobile & tablet */}
          {!isDesktop && (
            <button
              type="button"
              disabled={lockMultiplayerNav}
              onClick={() => { if (!lockMultiplayerNav) setMenuOpen(v => !v); }}
              style={{
                background: menuOpen ? `${t.accent}22` : `${t.border}22`,
                border: `1px solid ${menuOpen ? t.accent : `${t.border}66`}`,
                color: menuOpen ? t.accent : t.text,
                padding: isMobile ? "7px 9px" : "9px 13px",
                borderRadius: 9, cursor: lockMultiplayerNav ? "not-allowed" : "pointer",
                opacity: lockMultiplayerNav ? 0 : 1,
                transition: "all 0.2s",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
              }}
            >
              <span style={{ display: "block", width: ICON_SIZE, height: 2, background: "currentColor", borderRadius: 2, transition: "transform 0.2s", transform: menuOpen ? "rotate(45deg) translate(4px, 4px)" : "none" }} />
              <span style={{ display: "block", width: ICON_SIZE, height: 2, background: "currentColor", borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s" }} />
              <span style={{ display: "block", width: ICON_SIZE, height: 2, background: "currentColor", borderRadius: 2, transition: "transform 0.2s", transform: menuOpen ? "rotate(-45deg) translate(4px, -4px)" : "none" }} />
            </button>
          )}
        </div>
      </nav>

      {/* ── Dropdown menu for mobile/tablet ── */}
      {!isDesktop && menuOpen && (
        <div style={{
          position: "fixed", top: NAV_H, left: 0, right: 0, zIndex: 199,
          background: themeId === "classic_light" ? "#FFFFFF" : "rgba(10,10,10,0.97)",
          borderBottom: `1px solid ${t.border}44`,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          display: "flex", flexDirection: "column",
          animation: "menuSlideDown 0.2s ease both",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {navLinks.map(({ target, label, screen: s, locked }) => {
            const mb = mobileNavBadge(target);
            return (
              <button
                type="button"
                key={target}
                disabled={lockMultiplayerNav}
                onClick={() => navigate(s, locked)}
              style={{
                background: getActive(target) ? `${t.accent}18` : "none",
                border: "none",
                borderBottom: `1px solid ${t.border}22`,
                borderLeft: `3px solid ${getActive(target) ? t.accent : "transparent"}`,
                color: getActive(target) ? t.accent : locked ? `${t.textSecondary}88` : `${t.textSecondary}EE`,
                fontFamily: t.fontBody,
                fontSize: isMobile ? 13 : 15,
                fontWeight: getActive(target) ? 800 : 600,
                padding: isMobile ? "14px 20px" : "16px 24px",
                textAlign: "left" as const,
                cursor: lockMultiplayerNav ? "not-allowed" : "pointer",
                opacity: lockMultiplayerNav ? 0 : 1,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                textShadow: getActive(target) ? `0 0 10px ${t.accent}99` : "none",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "all 0.15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {navCountPill(mb)}
                {label}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {locked && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {getActive(target) && <span style={{ fontSize: 11, color: t.accent }}>●</span>}
              </span>
            </button>
          );
          })}

        </div>
      )}

      {/* ── Sign out modal ── */}
      {showSignOut && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", animation: "overlayFadeIn 0.2s ease both" }}>
          <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: ip ? 2 : 18, padding: isMobile ? "28px 24px" : ip ? "28px 32px" : "44px 52px", maxWidth: 420, width: "90vw", textAlign: "center", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "overlayModalIn 0.26s cubic-bezier(.22,.68,0,1.2) both" }}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${t.danger}14`, border: `1px solid ${t.danger}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: isMobile ? 16 : ip ? 15 : 20, fontWeight: 700, color: t.text, marginBottom: 8, lineHeight: 1.4 }}>Sign out of PentaProtocol?</div>
            <div style={{ fontFamily: t.fontBody, fontSize: isMobile ? 12 : 13, color: t.textMuted, marginBottom: 28, lineHeight: 1.6 }}>You'll need to sign back in to play ranked matches.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { logout(); setShowSignOut(false); }}
                onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}14`; e.currentTarget.style.color = t.danger; }}
                style={{ flex: 1, padding: "11px 0", background: `${t.danger}14`, border: `1px solid ${t.danger}66`, color: t.danger, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "all 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
              >Sign Out</button>
              <button
                onClick={() => setShowSignOut(false)}
                onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.background = `${t.accent}14`; e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.textSecondary; }}
                style={{ flex: 1, padding: "11px 0", background: "transparent", border: `1px solid ${t.border}66`, color: t.textSecondary, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "all 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
              >Stay</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes overlayFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes overlayModalIn { from{opacity:0;transform:scale(0.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes fadeUp         { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes menuSlideDown  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  );
}
