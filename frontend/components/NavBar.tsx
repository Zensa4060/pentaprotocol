"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  clearFriendsNavBadge,
  getCareerNavBadgeCount,
  getCollectionNavBadgeCount,
  getFriendsNavBadgeCount,
  getPatchNavBadgeCount,
  getProfileNavBadgeCount,
  getStoreNewCatalogBadgeCount,
} from "@/lib/navBadgeState";
import { screenToUrl, ROUTES } from "@/lib/routes";

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
            // Rank badge is above-the-fold — decode synchronously so it
            // appears immediately and fetch with high priority for LCP.
            decoding="sync"
            fetchPriority="high"
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
  const router = useRouter();

  const prefetchHref = useCallback(
    (href: string) => {
      try {
        router.prefetch(href);
      } catch {
        /* noop */
      }
    },
    [router],
  );

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
    if (screen === "friends") clearFriendsNavBadge();
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

  const friendsNotifyBadge = useMemo(() => {
    void navBadgeTick;
    return getFriendsNavBadgeCount();
  }, [navBadgeTick]);

  const mobileNavBadge = (target: string): number => {
    switch (target) {
      case "patchNotes": return patchNoteBadge;
      case "collection": return collectionNotifyBadge;
      case "store": return storeNewBadge;
      case "career": return careerMpBadge;
      case "battlepass": return missionClaimBadge;
      case "profile": return profileNotifyBadge;
      case "friends": return friendsNotifyBadge;
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

  // ``_isLocked`` kept as an unused parameter so all existing call sites
  // (which still pass a 2nd argument from the pre-guest-removal era)
  // compile without modification. Guest mode was removed — the NavBar is
  // never rendered to an unauthenticated user — so we no longer need to
  // intercept "locked" navigations.
  const navigate = (target: Screen, _isLocked: boolean = false) => {
    setMenuOpen(false);
    if (lockMultiplayerNav && target !== screen) {
      return;
    }
    if (target === "friends") {
      router.push(ROUTES.FRIENDS);
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
    if (target === "syros") return screen === "syros";
    return false;
  };

  // Responsive breakpoints
  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;
  const isDesktop = vw >= 1024;
  // Compression zone: most laptop screens are 1366–1440px wide, so push the
  // threshold up to 1500px so those devices get abbreviated labels.
  const isCompactDesktop = isDesktop && vw < 1500;
  const isUltraWide = vw >= 2560; // 2K, 4K, 8K support

  // Scaled sizes
  const NAV_H         = isMobile ? 52 : isTablet ? 60 : 64;
  const BTN_FONT      = isMobile ? 12 : isTablet ? 13 : "clamp(12px, 1.05vw, 15px)";
  const ICON_SIZE     = Math.floor(NAV_H * 0.5);
  // Currency display: compact, non-intrusive — just large enough to read
  const CURRENCY_SZ   = isMobile ? 22 : isTablet ? 24 : 26;
  const CURRENCY_FONT = isMobile ? 13 : isTablet ? 14 : 15;

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
    const isSyrosNav = target === "syros";
    const syrosViolet = "#C084FC";
    const syrosVioletMid = "#A78BFA";
    const syrosMist = "#E9D5FE";
    const accentCol = isDanger ? t.danger : isSyrosNav ? syrosViolet : isClassic ? "#CC2200" : t.accent;

    // Label Compression: Show icon/initial only for secondary items on compact desktops.
    // "profile" and "friends"/"community" are included so the center group fits at 1366–1440px.
    const hideLabel = isCompactDesktop && ["collection", "store", "patchNotes", "battlepass", "profile", "friends"].includes(target);

    const fg = effectiveDisabled
      ? `${t.textMuted}55`
      : isSyrosNav
        ? (isActive || isHovered ? syrosMist : "rgba(221,214,254,0.88)")
        : (isActive || isHovered) ? accentCol
        : isDanger ? `${t.danger}CC`
        : `${t.textSecondary}EE`;

    const syrosBg = isSyrosNav
      ? (isActive ? "rgba(124,58,237,0.32)" : isHovered ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.14)")
      : undefined;
    const syrosShadow = isSyrosNav
      ? (isActive || isHovered
        ? `0 0 12px ${syrosViolet}, 0 0 28px rgba(167,139,250,0.95), 0 0 52px rgba(124,58,237,0.55)`
        : `0 0 10px rgba(168,85,247,0.55), 0 0 24px rgba(124,58,237,0.4), 0 0 40px rgba(76,29,149,0.25)`)
      : null;

    const bc = badgeCount && badgeCount > 0 ? badgeCount : 0;
    return (
      <button
        key={target}
        disabled={effectiveDisabled}
        type="button"
        title={bc || hideLabel ? `${label}${bc ? ` — ${bc}` : ""}` : undefined}
        onClick={() => { if (onClick) { onClick(); return; } if (targetScreen) navigate(targetScreen, locked); }}
        onMouseEnter={() => {
          onHoverAction?.();
          setHoveredBtn(target);
          if (target === "patchNotes") prefetchHref(ROUTES.PATCHNOTES);
          else if (targetScreen) {
            const href = screenToUrl(targetScreen);
            if (href) prefetchHref(href);
          }
        }}
        onMouseLeave={() => setHoveredBtn(null)}
        style={{
          background:    isSyrosNav
            ? syrosBg
            : (isActive ? `${accentCol}1A` : isHovered ? `${accentCol}0F` : "none"),
          borderTop: "none", borderLeft: "none", borderRight: "none",
          borderBottom:  `2px solid ${(isActive || isHovered) ? (isSyrosNav ? syrosVioletMid : accentCol) : "transparent"}`,
          color:         fg,
          fontFamily:    t.fontBody,
          fontSize:      BTN_FONT,
          fontWeight:    isActive ? 800 : isHovered ? 700 : 600,
          padding:       isMobile ? "0 10px" : isTablet ? "0 12px" : hideLabel ? "0 14px" : "0 16px",
          cursor:        effectiveDisabled ? "not-allowed" : "pointer",
          borderRadius:  0,
          letterSpacing: "0.06em",
          transition:    "color 0.15s, border-color 0.15s, background 0.15s, padding 0.2s, text-shadow 0.2s, box-shadow 0.2s",
          height:        NAV_H,
          display:       "flex", alignItems: "center",
          opacity:       navHardLocked ? 0 : effectiveDisabled ? 0.4 : locked ? 0.6 : 1,
          whiteSpace:    "nowrap" as const,
          textTransform: "uppercase" as const,
          textShadow:    syrosShadow
            ?? ((isActive || isHovered)
              ? `0 0 10px ${accentCol}, 0 0 20px ${accentCol}99, 0 0 40px ${accentCol}55`
              : `0 0 8px ${t.textSecondary}44`),
          boxShadow:     isSyrosNav && (isActive || isHovered)
            ? `inset 0 0 20px rgba(192,132,252,0.12)`
            : isSyrosNav
              ? `inset 0 0 14px rgba(124,58,237,0.08)`
              : undefined,
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

  // Nav links list for both desktop and hamburger menu. Guest mode is
  // gone, so nothing is locked here anymore.
  const navLinks = [
    { target: "friends",    label: "COMMUNITY",  screen: "friends"    as Screen },
    { target: "collection", label: "Collection", screen: "collection" as Screen },
    { target: "store",      label: "Store",      screen: "store"      as Screen },
    { target: "home",       label: "Home",       screen: "home"       as Screen },
    { target: "career",     label: "Career",     screen: "career"     as Screen },
    { target: "syros",     label: "SYROS",     screen: "syros"     as Screen },
    { target: "battlepass", label: "MISSIONS",   screen: "battlepass" as Screen },
    { target: "profile",    label: "Profile",    screen: "profile"    as Screen },
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
            style={{ background: "none", border: `1px solid ${t.danger}88`, color: t.danger, fontFamily: t.fontMono, fontSize: 10, padding: "2px 8px", borderRadius: 4, cursor: "pointer", transition: "background 0.2s, border-color 0.2s, opacity 0.2s, box-shadow 0.2s" }}
            onMouseOver={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#000"; }}
            onMouseOut={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = t.danger; }}
          >CANCEL</button>
        </div>
      )}

      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
        height: NAV_H,
        // Background matches the page theme exactly so it blends seamlessly — no hard
        // horizontal line between the nav and the content below.
        background: themeId === "classic_light"
          ? "rgba(242,242,244,0.97)"
          : themeId === "space"
            ? "rgba(2,4,15,0.92)"
            : themeId === "pixel"
              ? "rgba(16,20,11,0.96)"
              : "rgba(10,10,10,0.96)",
        // Only an ambient downward shadow — no 1px top line at all so the
        // nav blends flush into the page background underneath.
        boxShadow: themeId === "classic_light"
          ? "0 4px 20px rgba(0,0,0,0.08)"
          : "0 6px 32px rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center",
        padding: isMobile ? "0 10px" : "0 16px",
        gap: isMobile ? 6 : 10,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}>

        {/* ── LEFT: Logo + PentaShards ── */}
        <div style={{ display: "flex", alignItems: "center", gap: isTablet ? 8 : 12, flexShrink: 0, minWidth: 0 }}>
          <div
            onClick={() => { if (!lockMultiplayerNav) navigate("home"); }}
            onMouseEnter={() => {
              if (!lockMultiplayerNav) prefetchHref(ROUTES.HOME);
            }}
            title={lockMultiplayerNav ? "PentaProtocol" : "Home"}
            style={{
              // Logo stays fully visible in multiplayer per product direction —
              // the user wants it always present as a branding anchor even
              // while the rest of the nav bar is locked. Only the click
              // target is disabled during an active match.
              cursor: lockMultiplayerNav ? "default" : "pointer",
              opacity: 1,
              pointerEvents: lockMultiplayerNav ? "none" : "auto",
              display: "flex",
              alignItems: "center",
            }}
          >
            <img
              src="/Pentaprotocol_Logo_Transparent.png"
              alt="PentaProtocol Logo"
              decoding="sync"
              fetchPriority="high"
              style={{
                width: isMobile ? 32 : isTablet ? 38 : 44,
                height: isMobile ? 32 : isTablet ? 38 : 44,
                objectFit: "contain",
                filter: "drop-shadow(0 0 10px rgba(255,100,30,0.35))",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            />
          </div>

          {/* Currency pill (PentaShards) — desktop/tablet only. On mobile the
              same balances are rendered inline on the Profile screen to free
              up nav-bar width for the logo, settings, and hamburger. See the
              ProfileScreen mobile currency section. */}
          {mounted && !lockMultiplayerNav && !isMobile && (
            <div
              title="PentaShards: earn rewards from missions and events to redeem free skins in the Store."
              style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: t.fontMono, fontSize: CURRENCY_FONT, fontWeight: 700, letterSpacing: "0.02em" }}
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
            // overflow:visible so no button label ever gets clipped
            overflow: "visible", minWidth: 0,
          }}>
            <div style={{
              display: "flex", alignItems: "center", flexWrap: "nowrap",
              gap: isUltraWide ? "3vw" : "clamp(2px, 0.8vw, 16px)",
              transition: "gap 0.3s ease",
            }}>
              {navBtn("friends", "COMMUNITY", false, false, undefined, "friends", false, friendsNotifyBadge)}
              {navBtn("collection", "Collection", false, false, undefined, "collection", false, collectionNotifyBadge)}
              {navBtn("store",      "Store",      false, false, undefined, "store", false, storeNewBadge)}
              {navBtn("home",       "Home",       false, false, undefined, "home")}
              {navBtn("career",     "Career",     false, false, undefined, "career",     false, careerMpBadge)}
              {navBtn("syros",     "SYROS",     false, false, undefined, "syros",     false, undefined)}
              {navBtn("battlepass", "MISSIONS", false, false, undefined, "battlepass", false, missionClaimBadge)}
              {navBtn("profile", "Profile", false, false, undefined, "profile", false, profileNotifyBadge)}
            </div>
          </div>
        )}

        {isTablet && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 4 }}>
              {navBtn("home",    "Home",    false, false, undefined, "home")}
              {navBtn("store",   "Store",   false, false, undefined, "store", false, storeNewBadge)}
              {navBtn("profile", "Profile", false, false, undefined, "profile", false, profileNotifyBadge)}
              {navBtn("career",  "Career",  false, false, undefined, "career",  false, careerMpBadge)}
              {navBtn("syros",  "SYROS", false, false, undefined, "syros", false, undefined)}
            </div>
          </div>
        )}

        {/* Spacer on mobile/tablet to push right section to end. (Center section handles it via flex on desktop) */}
        {!isDesktop && <div style={{ flex: 1 }} />}

        {/* ── RIGHT: currency + settings + hamburger ── */}
        <div style={{ display: "flex", alignItems: "center", gap: isTablet ? 8 : 12, flexShrink: 0, marginLeft: "auto" }}>

          {/* ProtoCredits — hidden during multiplayer and on mobile */}
          {mounted && !lockMultiplayerNav && !isMobile && (
            <div
              title="ProtoCredits: premium currency to buy skins, themes, and bundles in the Store."
              style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: t.fontMono, fontSize: CURRENCY_FONT, fontWeight: 700 }}
            >
              <div style={{ width: CURRENCY_SZ, height: CURRENCY_SZ, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: (themeId === "classic_light" ? PROTO_LIGHT_SVG : PROTO_DARK_SVG).replace("<svg ", `<svg width="${CURRENCY_SZ}" height="${CURRENCY_SZ}" `) }} />
              <span style={{ color: "#FFD700" }}>{protocredits}</span>
            </div>
          )}

          {/* Settings button */}
          <button
            onClick={onSettingsAction}
            title="Settings"
            onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.transform = "scale(1.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.text; e.currentTarget.style.background = `${t.border}22`; e.currentTarget.style.transform = "scale(1)"; }}
            style={{
              background: `${t.border}22`, border: `1px solid ${t.border}55`, color: t.text,
              width: isMobile ? 32 : isTablet ? 36 : 38,
              height: isMobile ? 32 : isTablet ? 36 : 38,
              borderRadius: 10, cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                transition: "background 0.2s, border-color 0.2s, opacity 0.2s, box-shadow 0.2s",
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
          {navLinks.map(({ target, label, screen: s }) => {
            const mb = mobileNavBadge(target);
            const rowActive = getActive(target);
            const rowSyros = target === "syros";
            const rowAccent = rowSyros ? "#A78BFA" : t.accent;
            const rowGlow = rowSyros
              ? (rowActive ? "0 0 14px rgba(192,132,252,0.85), 0 0 28px rgba(124,58,237,0.45)" : "0 0 10px rgba(168,85,247,0.35)")
              : (rowActive ? `0 0 10px ${t.accent}99` : "none");
            return (
              <button
                type="button"
                key={target}
                disabled={lockMultiplayerNav}
                onClick={() => navigate(s)}
              style={{
                background: rowActive
                  ? (rowSyros ? "rgba(124,58,237,0.22)" : `${t.accent}18`)
                  : rowSyros
                    ? "rgba(124,58,237,0.08)"
                    : "none",
                border: "none",
                borderBottom: `1px solid ${t.border}22`,
                borderLeft: `3px solid ${rowActive ? rowAccent : "transparent"}`,
                color: rowActive ? (rowSyros ? "#E9D5FE" : t.accent) : (rowSyros ? "rgba(221,214,254,0.9)" : `${t.textSecondary}EE`),
                fontFamily: t.fontBody,
                fontSize: isMobile ? 13 : 15,
                fontWeight: rowActive ? 800 : 600,
                padding: isMobile ? "14px 20px" : "16px 24px",
                textAlign: "left" as const,
                cursor: lockMultiplayerNav ? "not-allowed" : "pointer",
                opacity: lockMultiplayerNav ? 0 : 1,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                textShadow: rowGlow,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {navCountPill(mb)}
                {label}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {rowActive && <span style={{ fontSize: 11, color: rowAccent }}>●</span>}
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
                style={{ flex: 1, padding: "11px 0", background: `${t.danger}14`, border: `1px solid ${t.danger}66`, color: t.danger, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
              >Sign Out</button>
              <button
                onClick={() => setShowSignOut(false)}
                onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.background = `${t.accent}14`; e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${t.border}66`; e.currentTarget.style.color = t.textSecondary; }}
                style={{ flex: 1, padding: "11px 0", background: "transparent", border: `1px solid ${t.border}66`, color: t.textSecondary, fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, borderRadius: ip ? 2 : 9, cursor: "pointer", transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
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
