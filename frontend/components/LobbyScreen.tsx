"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MatchupData, Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import { computeLevelProgress } from "@/lib/xpLevel";
import API from "@/lib/api";
import { NavRankBadge, getRank } from "./NavBar";
import {
  getLobbyQuote,
  LOBBY_QUOTE_STORAGE_KEY,
  LOBBY_QUOTE_REFRESH_EVENT,
  type LobbyQuoteRefreshDetail,
} from "@/lib/lobbyTauntQuote";
import { loadCustomTheme } from "@/lib/customTheme";
import { getMatchFoundPalette, resolveMatchFoundSkin } from "@/lib/matchFoundVisual";
import { useBannerShineEnabled } from "@/lib/bannerShinePreference";
import { BannerRenderer } from "./BannerRenderer";
import MatchFoundSketchVS from "./MatchFoundSketchVS";
import { SurrenderModal } from "./MatchSidebar";

function parseRankedBanEndMs(user: { ranked_ban_until?: string | null } | null | undefined): number | null {
  const raw = user?.ranked_ban_until;
  if (!raw) return null;
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : null;
}

/** Shorter bans MM:SS; longer bans Xh Ym Zs. */
function formatRankedBanCountdown(totalSec: number): string {
  if (totalSec <= 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
  onQueueStartAction: (mode: "ranked" | "unranked") => void;
  onQueueCancelAction: () => void;
  onHoverAction?: () => void;
  onClickAction?: () => void;
  onRoomReadyAction?: (
    roomCode: string,
    playerSlot: "P1" | "P2",
    format: string,
    matchup?: MatchupData,
    roomFromServer?: { board_mode?: string; board_mode_full?: string; selected_patterns?: string[] },
  ) => void;
  queuePhase?: "none" | "queuing" | "matchup";
  queueElapsed?: number;
  matchupOpponent?: any;
  forcedPhase?: "none" | "queuing" | "matchup" | "select";
  queueError?: string | null;
  boardMode?: string;
  onBoardModeAction?: (mode: any) => void;
  lastMatchResult?: "win" | "loss" | null;
  /** When set, preselects the custom-room sub-view on mount. */
  initialRoomSection?: "none" | "create" | "join" | "waiting";
  /** Whether the current queue/match is ranked — drives matchup screen styling. */
  isRanked?: boolean;
}

type MultiSub = "unranked" | "ranked" | null;
type Phase = "select" | "queuing" | "matchup";

export default function LobbyScreen({
  setScreenAction, themeId, onQueueStartAction, onQueueCancelAction, onHoverAction, onClickAction, onRoomReadyAction,
  queuePhase: propQueuePhase = "none",
  queueElapsed: propQueueElapsed = 0,
  matchupOpponent: propMatchupOpponent = null,
  forcedPhase = "none",
  queueError = null,
  boardMode = "5x5",
  onBoardModeAction,
  lastMatchResult = null,
  initialRoomSection,
  isRanked = false,
}: Props) {
  const t  = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, refreshProfile } = useAuthStore();
  const bannerShineEnabled = useBannerShineEnabled((user as any)?.id ?? (user as any)?._id ?? null);
  const rank = getRank(user?.elo ?? 0);
  const isPlacement = (user as any)?.placement_matches < 5;
  const placementCol = "#FF33FF";
  const localLevel = computeLevelProgress(Number(user?.level || 1), Number(user?.xp || 0)).level;
  const rankedLevelLocked = localLevel < 5;
  const BLOOD_RED = "#FF0000";

  const [multiSub,   setMultiSub]   = useState<MultiSub>(null);
  const [localPhase, setLocalPhase] = useState<Phase>("select");
  const [showUnrankedOptions, setShowUnrankedOptions] = useState(false);
  const [showRankedOptions, setShowRankedOptions] = useState(false);
  // When the route explicitly forces a phase (including "select"), honor it
  // unconditionally. This prevents short-lived re-renders on the old page
  // while router navigation is in-flight from flashing the queue/matchup UI
  // just before unmount, which was visible as a duplicate animation jump.
  const phase: Phase =
    forcedPhase === "select"   ? "select"
    : forcedPhase === "queuing" ? "queuing"
    : forcedPhase === "matchup" ? "matchup"
    : (propQueuePhase !== "none" ? propQueuePhase : localPhase);

  const elapsed = propQueuePhase === "queuing" ? propQueueElapsed : 0;
  const [isMobile, setIsMobile] = useState(false);
  const [matchFoundBackModal, setMatchFoundBackModal] = useState(false);

  // ── Taunt quote — pool selected by last ranked match result ───────────────
  // If lastMatchResult is set (returning from ranked), always pick fresh from the right pool.
  // Otherwise persist the current quote across navigation; only rotates after a match.
  const [lobbyTitle, setLobbyTitle] = useState<string>(() => {
    if (typeof window === "undefined") return getLobbyQuote(lastMatchResult);
    const saved = window.localStorage.getItem(LOBBY_QUOTE_STORAGE_KEY);
    if (saved && !lastMatchResult) return saved;
    const initial = getLobbyQuote(lastMatchResult);
    window.localStorage.setItem(LOBBY_QUOTE_STORAGE_KEY, initial);
    return initial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastMatchResult) {
      // Returning from a ranked game — always rotate into the correct pool
      const next = getLobbyQuote(lastMatchResult);
      window.localStorage.setItem(LOBBY_QUOTE_STORAGE_KEY, next);
      setLobbyTitle(next);
      return;
    }
    const saved = window.localStorage.getItem(LOBBY_QUOTE_STORAGE_KEY);
    if (saved) {
      setLobbyTitle(saved);
      return;
    }
    const initial = getLobbyQuote(null);
    window.localStorage.setItem(LOBBY_QUOTE_STORAGE_KEY, initial);
    setLobbyTitle(initial);
  }, [lastMatchResult]);

  // Post-match: GameScreen calls persistLobbyTauntQuote (writes storage + this event with detail)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refreshQuote = (ev: Event) => {
      const d = (ev as CustomEvent<LobbyQuoteRefreshDetail>).detail;
      if (d?.text) {
        setLobbyTitle(d.text);
        return;
      }
      const saved = window.localStorage.getItem(LOBBY_QUOTE_STORAGE_KEY);
      if (saved) setLobbyTitle(saved);
      else {
        const nextQuote = getLobbyQuote(null);
        window.localStorage.setItem(LOBBY_QUOTE_STORAGE_KEY, nextQuote);
        setLobbyTitle(nextQuote);
      }
    };
    window.addEventListener(LOBBY_QUOTE_REFRESH_EVENT, refreshQuote);
    return () => window.removeEventListener(LOBBY_QUOTE_REFRESH_EVENT, refreshQuote);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (phase !== "matchup" || !pathname?.startsWith("/play/matchfound")) {
      setMatchFoundBackModal(false);
      return;
    }
    const mark = { pp_matchfound_back_guard: 1 };
    window.history.pushState(mark, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(mark, "", window.location.href);
      setMatchFoundBackModal(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [phase, pathname]);

  const [countdown, setCountdown] = useState(3.5);
  const [hovered,   setHovered]   = useState<string | null>(null);

  const banEndMs = useMemo(() => parseRankedBanEndMs(user), [user?.ranked_ban_until]);
  const rankedBanActive = Boolean(
    user &&
      (user.ranked_allowed === false ||
        (banEndMs !== null && banEndMs > Date.now())),
  );
  const [rankedBanRemainingSec, setRankedBanRemainingSec] = useState(0);

  useEffect(() => {
    if (!rankedBanActive || banEndMs === null) {
      setRankedBanRemainingSec(0);
      return;
    }
    const tick = () => Math.max(0, Math.ceil((banEndMs - Date.now()) / 1000));
    setRankedBanRemainingSec(tick());
    const id = setInterval(() => {
      const sec = tick();
      setRankedBanRemainingSec(sec);
      if (sec <= 0) {
        clearInterval(id);
        void refreshProfile();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [rankedBanActive, banEndMs, refreshProfile]);

  const rankedBanUnknownEndRef = useRef(false);
  useEffect(() => {
    if (user?.ranked_allowed !== false || user?.ranked_ban_until) {
      rankedBanUnknownEndRef.current = false;
      return;
    }
    if (rankedBanUnknownEndRef.current) return;
    rankedBanUnknownEndRef.current = true;
    void refreshProfile();
  }, [user?.ranked_allowed, user?.ranked_ban_until, refreshProfile]);

  // ── Room state ────────────────────────────────────────────────────────────
  const [roomSection, setRoomSection] = useState<"none" | "create" | "join" | "waiting">(initialRoomSection ?? "none");

  useEffect(() => {
    if (initialRoomSection && initialRoomSection !== roomSection) setRoomSection(initialRoomSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomSection]);
  const [roomFormat,  setRoomFormat]  = useState<"unranked" | "ranked">("unranked");
  const [roomCode,    setRoomCode]    = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError,   setRoomError]   = useState<string | null>(null);

  // ── Guard: prevent duplicate submit on create/join ────────────────────────
  const isSubmitting = useRef(false);

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // ── Single no-retry POST — retrying matchmaking/room calls causes ghost dupes
  const postOnce = async (url: string, data: any, config: any) => {
    return await API.post(url, data, { ...config, timeout: 15000 });
  };

  const startSearch = async () => {
    if (!multiSub || !token) return;
    if (multiSub === "ranked" && rankedBanActive) return;
    onQueueStartAction(multiSub);
  };

  const cancelSearch = async () => {
    onQueueCancelAction();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Room handlers ─────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!token)              { setRoomError("Sign in to play multiplayer"); return; }
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setRoomLoading(true);
    setRoomError(null);
    try {
      onBoardModeAction?.("5x5_6x6_7x7");
      const res = await postOnce("/api/room/create", { format: roomFormat, board_mode: "5x5_6x6_7x7" }, authHeader);
      setRoomCode(res.data.room_code);
      setRoomSection("waiting");
      pollForPlayer(res.data.room_code, (res.data.player_slot as "P1" | "P2") ?? "P1");
    } catch (e: any) {
      setRoomError(e.response?.data?.detail || "Failed to create room");
    } finally {
      setRoomLoading(false);
      isSubmitting.current = false;
    }
  };

  const pollForPlayer = (code: string, mySlot: "P1" | "P2" = "P1") => {
    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/api/room/${code}`, { ...authHeader, timeout: 10000 });
        if (res.data.game_status === "playing") {
          clearInterval(interval);
          onRoomReadyAction?.(code, mySlot, res.data.format, undefined, res.data);
        }
      } catch { /* keep polling */ }
    }, 2000);
    setTimeout(() => clearInterval(interval), 300000);
  };

  const handleJoinRoom = async () => {
    if (!token)               { setRoomError("Sign in to play multiplayer"); return; }
    if (!joinCode.trim())     { setRoomError("Enter a room code"); return; }
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setRoomLoading(true);
    setRoomError(null);
    try {
      const res = await postOnce("/api/room/join", { room_code: joinCode.trim().toUpperCase() }, authHeader);
      onRoomReadyAction?.(
        res.data.room_code,
        (res.data.player_slot as "P1" | "P2") ?? "P2",
        res.data.format,
        undefined,
        res.data,
      );
    } catch (e: any) {
      setRoomError(e.response?.data?.detail || "Could not join room");
    } finally {
      setRoomLoading(false);
      isSubmitting.current = false;
    }
  };

  const cancelRoom = () => {
    isSubmitting.current = false;
    setRoomSection("none");
    setRoomCode("");
    setJoinCode("");
    setRoomError(null);
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/custom/")) {
      router.push("/play/lobby");
    }
  };

  // ── QUEUING ───────────────────────────────────────────────────────────────
  if (phase === "queuing") return (
    <div style={{ position:"fixed", inset:0, zIndex:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 50%, ${t.accent}08 0%, transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", inset:0, opacity:0.1, backgroundImage:`linear-gradient(${t.border} 1px, transparent 1px), linear-gradient(90deg, ${t.border} 1px, transparent 1px)`, backgroundSize:"60px 60px", animation:"gridScan 30s linear infinite" }} />

      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:32, animation:"fadeUp 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ position:"relative", width:140, height:140 }}>
          <div style={{ position:"absolute", inset:0, border:`2px solid ${t.accent}22`, borderRadius:"50%" }} />
          <div style={{ position:"absolute", inset:0, border:`2px solid transparent`, borderTop:`2px solid ${t.accent}`, borderRadius:"50%", animation:"spinRing 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite" }} />
          <div style={{ position:"absolute", inset:15, border:`2px solid transparent`, borderBottom:`2px solid ${t.p1}`, borderRadius:"50%", animation:"spinRing 0.8s reverse linear infinite" }} />
          <div style={{ position:"absolute", inset:30, border:`1px solid ${t.accent}11`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:10, height:10, background:t.accent, borderRadius:"50%", boxShadow:`0 0 20px ${t.accentGlow}`, animation:"scannerPulse 1.5s ease-in-out infinite" }} />
          </div>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:"100%", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, transformOrigin:"0 0", animation:"spinRing 2s linear infinite" }} />
        </div>

        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:t.fontDisplay, fontSize:32, fontWeight:900, color:t.text, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>
            Establishing Protocol
          </div>
          <div style={{ fontFamily:t.fontMono, fontSize:16, color:t.textMuted, letterSpacing:"0.25em", opacity:0.8 }}>SEARCHING FOR OPPONENT...</div>
        </div>

        <div style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(20px)", border:`1px solid ${t.border}`, borderRadius:20, padding:"24px 40px", boxShadow:"0 20px 50px rgba(0,0,0,0.5)", width:320 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <span style={{ fontFamily:t.fontMono, fontSize:13, color:t.textMuted }}>ELAPSED</span>
            <span style={{ fontFamily:t.fontDisplay, fontSize:24, color:t.accent, fontWeight:700 }}>{fmt(elapsed)}</span>
          </div>
          <div style={{ height:1, background:`linear-gradient(90deg, transparent, ${t.border}, transparent)`, marginBottom:12 }} />
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <span style={{ fontFamily:t.fontBody, fontSize:14, color:t.textSecondary }}>Competitive Standard · First to 3</span>
          </div>
          {queueError && (
            <div style={{ marginTop:12, fontFamily:t.fontMono, fontSize:11, color:t.danger, opacity:0.8, textAlign:"center" }}>
              {queueError}
            </div>
          )}
        </div>

        <button onClick={cancelSearch}
          style={{ background:"transparent", border:`1px solid ${t.danger}44`, color:t.danger, fontFamily:t.fontDisplay, fontSize:12, fontWeight:800, padding:"12px 32px", borderRadius:10, cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.1em" }}
          onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.background=`${t.danger}18`; e.currentTarget.style.borderColor=t.danger; }}
          onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=`${t.danger}44`; }}
        >TERMINATE SEARCH</button>
      </div>

      <style>{`
        @keyframes gridScan    { from{background-position:0 0} to{background-position:0 600px} }
        @keyframes scannerPulse{ 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(3.5);opacity:1} }
        @keyframes urgentPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spinRing    { to{transform:rotate(360deg)} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );

  /** Single side of the match-found screen.
   *  - Ranked: ELO header above the avatar + rank badge below the username.
   *  - Unranked: LEVEL header above the avatar, no rank badge.
   *  - Glow color is driven by `glowColor` (white for unranked, blood red for ranked). */
  const MatchPlayerCard = React.memo(({
    name, elo, avatar, level, glowColor, ranked, placementMatches, side,
    cardInk, cardInkSoft, avatarInnerBg,
  }: {
    name: string;
    elo: number | null;
    avatar: string | undefined;
    level: number;
    glowColor: string;
    ranked: boolean;
    placementMatches: number;
    side: "left" | "right";
    cardInk: string;
    cardInkSoft: string;
    avatarInnerBg: string;
  }) => {
    const anim = side === "left" ? "slideInLeft" : "slideInRight";
    const avatarSize = isMobile ? 140 : 230;
    const isPlacementPlayer = ranked && placementMatches < 5;
    const displayElo = isPlacementPlayer ? "?" : (elo ?? "---");
    const rankForBadge = getRank(elo ?? 0);

    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isMobile ? 10 : 18,
          padding: isMobile ? "0 8px" : "0 20px",
          textAlign: "center" as const,
          animation: `${anim} 680ms cubic-bezier(.2,.9,.2,1) both`,
          willChange: "transform, opacity",
        }}
      >
        {/* Top label: ELO (ranked) or LEVEL (unranked) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div style={{ fontFamily: t.fontMono, fontSize: isMobile ? 10 : 13, color: cardInkSoft, letterSpacing: "0.3em", fontWeight: 700, opacity: 0.85 }}>
            {ranked ? "ELO RATING" : "LEVEL"}
          </div>
          <div
            style={{
              fontFamily: t.fontDisplay,
              fontSize: isMobile ? 34 : 56,
              fontWeight: 950,
              color: glowColor,
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}
          >
            {ranked ? displayElo : level}
          </div>
        </div>

        {/* Avatar with themed glow ring */}
        <div
          style={{
            position: "relative",
            width: avatarSize,
            height: avatarSize,
            borderRadius: "50%",
            padding: 4,
            background: `radial-gradient(circle, ${glowColor}33 0%, transparent 70%)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: `4px solid ${glowColor}`,
              overflow: "hidden",
              background: avatarInnerBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isMobile ? 60 : 110,
              color: glowColor,
              boxShadow: `0 8px 24px rgba(0,0,0,0.25), 0 0 18px ${glowColor}55, inset 0 0 18px rgba(0,0,0,0.55)`,
            }}
          >
            {avatar ? (
              <img
                key={avatar}
                src={avatar}
                alt=""
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ opacity: 0.9 }}>👤</span>
            )}
          </div>
        </div>

        {/* Username below avatar */}
        <div
          style={{
            fontFamily: t.fontDisplay,
            fontSize: isMobile ? 18 : 30,
            fontWeight: 900,
            color: cardInk,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            wordBreak: "break-word" as const,
            maxWidth: "100%",
            lineHeight: 1.15,
          }}
        >
          {name}
        </div>

        {/* Rank logo below username — ranked only. Sized +35% versus the
            previous layout at the user's request. */}
        {ranked && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: isMobile ? 4 : 10 }}>
            <NavRankBadge rank={rankForBadge} size={isMobile ? 73 : 113} isPlacement={isPlacementPlayer} />
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: isMobile ? 14 : 16,
                fontWeight: 800,
                color: isPlacementPlayer ? "#8E2BB8" : rankForBadge.color,
                letterSpacing: "0.18em",
              }}
            >
              {isPlacementPlayer ? "PLACEMENT" : rankForBadge.name}
            </div>
          </div>
        )}
      </div>
    );
  });
  MatchPlayerCard.displayName = "MatchPlayerCard";

  // ── MATCHUP ───────────────────────────────────────────────────────────────
  if (phase === "matchup") {
    const mfSkin = resolveMatchFoundSkin(themeId);
    const pal = getMatchFoundPalette(mfSkin);
    const glow = isRanked ? pal.rankedAccent : pal.unrankedAccent;
    const headerCopy = isRanked ? "RANKED · FIRST TO 5 POINTS" : "UNRANKED · FIRST TO 5 POINTS";
    const vsSize = isMobile ? 220 : 380;
    const vsH = vsSize * (480 / 820);
    const bannerW = isMobile ? Math.min(168, Math.floor(vsSize * 0.5)) : 178;
    const ct = loadCustomTheme();
    const myMatchBanner = String((user as any)?.banner || ct.bannerSkin || "default");
    const oppMatchBanner = String(propMatchupOpponent?.banner || "default");
    const barTrack = mfSkin === "classic_light" ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.12)";

    const MatchBannerShowcase = ({
      bannerId,
      side,
    }: {
      bannerId: string;
      side: "left" | "right";
    }) => (
      <div
        style={{
          width: bannerW,
          height: vsH,
          position: "relative",
          borderRadius: ip ? 2 : 12,
          overflow: "hidden",
          border: `1px solid ${glow}55`,
          flexShrink: 0,
          boxShadow: `0 10px 32px rgba(0,0,0,0.35)`,
          background: pal.avatarInnerBg,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 1, zIndex: 0 }}>
          <BannerRenderer bannerId={bannerId} hideLabels />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                side === "left"
                  ? "linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)"
                  : "linear-gradient(to left, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)",
              zIndex: 1,
              pointerEvents: "none",
            }}
          />
          {bannerShineEnabled && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "-150%",
                width: "200%",
                height: "100%",
                background:
                  "linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.22) 40%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 50%)",
                zIndex: 2,
                animation: "matchFoundShine 4s infinite linear",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
    );

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(ellipse at 50% 40%, ${pal.pageBg} 0%, ${pal.pageBgOuter} 88%)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.14,
            backgroundImage:
              `linear-gradient(${pal.gridLine} 1px, transparent 1px), ` +
              `linear-gradient(90deg, ${pal.gridLine} 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: isMobile ? 18 : 28,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: t.fontMono,
            fontSize: isMobile ? 11 : 13,
            color: glow,
            letterSpacing: "0.3em",
            fontWeight: 800,
            zIndex: 3,
          }}
        >
          {headerCopy}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 1480,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? 14 : 20,
            padding: isMobile ? "60px 16px 80px" : "40px 28px",
            boxSizing: "border-box",
          }}
        >
          <MatchPlayerCard
            name={user?.username ?? "YOU"}
            elo={user?.elo ?? null}
            avatar={user?.avatar ?? undefined}
            level={localLevel}
            glowColor={glow}
            ranked={isRanked}
            placementMatches={Number((user as any)?.placement_matches ?? 0)}
            side="left"
            cardInk={pal.cardInk}
            cardInkSoft={pal.cardInkSoft}
            avatarInnerBg={pal.avatarInnerBg}
          />

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "row" : "row",
              alignItems: "center",
              justifyContent: "center",
              gap: isMobile ? 8 : 14,
              flexWrap: "wrap",
            }}
          >
            <MatchBannerShowcase bannerId={myMatchBanner} side="left" />
            <MatchFoundSketchVS
              size={vsSize}
              ink={pal.vsInk}
              sealBg={pal.sealBg}
              sealStroke={pal.sealStroke}
              sealText={pal.sealText}
              dropShadow={pal.vsDropShadow}
            />
            <MatchBannerShowcase bannerId={oppMatchBanner} side="right" />
          </div>

          <MatchPlayerCard
            name={propMatchupOpponent?.name ?? "OPPONENT"}
            elo={propMatchupOpponent?.elo ?? null}
            avatar={propMatchupOpponent?.avatar ?? undefined}
            level={Number(propMatchupOpponent?.level ?? 1)}
            glowColor={glow}
            ranked={isRanked}
            placementMatches={Number(propMatchupOpponent?.placement_matches ?? 0)}
            side="right"
            cardInk={pal.cardInk}
            cardInkSoft={pal.cardInkSoft}
            avatarInnerBg={pal.avatarInnerBg}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: isMobile ? 20 : 32,
            left: 0,
            right: 0,
            padding: "0 20px",
            zIndex: 3,
          }}
        >
          <div
            style={{
              height: 4,
              background: barTrack,
              borderRadius: 2,
              overflow: "hidden",
              maxWidth: 360,
              margin: "0 auto",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                background: `linear-gradient(90deg, ${glow}, ${glow}aa)`,
                borderRadius: 2,
                animation: "matchBarShrink 10s linear both",
              }}
            />
          </div>
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 12,
              color: glow,
              textAlign: "center",
              marginTop: 10,
              letterSpacing: "0.25em",
              fontWeight: 800,
              opacity: 0.9,
            }}
          >
            MATCH STARTING...
          </div>
        </div>

        <style>{`
          @keyframes fadeUp         { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes slideInLeft    { from{opacity:0;transform:translate3d(-80px,0,0) scale(.94)} to{opacity:1;transform:translate3d(0,0,0) scale(1)} }
          @keyframes slideInRight   { from{opacity:0;transform:translate3d(80px,0,0)  scale(.94)} to{opacity:1;transform:translate3d(0,0,0) scale(1)} }
          @keyframes matchBarShrink { from{width:100%} to{width:0%} }
          @keyframes matchFoundShine { from { transform: translateX(-50%); } to { transform: translateX(100%); } }
        `}</style>

        <SurrenderModal
          show={matchFoundBackModal}
          t={{ ...t, pieces: t.pieces }}
          ip={ip}
          isRankedGame={isRanked}
          variant="abort"
          onConfirmAction={() => {
            setMatchFoundBackModal(false);
            onQueueCancelAction();
          }}
          onCancelAction={() => {
            setMatchFoundBackModal(false);
            onClickAction?.();
          }}
          playHoverAction={onHoverAction}
        />
      </div>
    );
  }

  // ── WAITING FOR P2 (private room) ─────────────────────────────────────────
  if (roomSection === "waiting") return (
    <div style={{ position:"fixed", inset:0, zIndex:10, background:t.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at 50% 50%, ${t.accent}08 0%, transparent 70%)`, pointerEvents:"none" }} />
      <div style={{ position:"absolute", inset:0, opacity:0.1, backgroundImage:`linear-gradient(${t.border} 1px, transparent 1px), linear-gradient(90deg, ${t.border} 1px, transparent 1px)`, backgroundSize:"60px 60px", animation:"gridScan 30s linear infinite" }} />

      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:32, animation:"fadeUp 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
        <div style={{ position:"relative", width:140, height:140 }}>
          <div style={{ position:"absolute", inset:0, border:`2px solid ${t.accent}22`, borderRadius:"50%" }} />
          <div style={{ position:"absolute", inset:0, border:`2px solid transparent`, borderTop:`2px solid ${t.accent}`, borderRadius:"50%", animation:"spinRing 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite" }} />
          <div style={{ position:"absolute", inset:15, border:`2px solid transparent`, borderBottom:`2px solid #3b82f6`, borderRadius:"50%", animation:"spinRing 0.8s reverse linear infinite" }} />
          <div style={{ position:"absolute", inset:30, border:`1px solid ${t.accent}11`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:10, height:10, background:t.accent, borderRadius:"50%", boxShadow:`0 0 20px ${t.accentGlow}`, animation:"scannerPulse 1.5s ease-in-out infinite" }} />
          </div>
          <div style={{ position:"absolute", top:"50%", left:"50%", width:"100%", height:2, background:`linear-gradient(90deg, transparent, ${t.accent}, transparent)`, transformOrigin:"0 0", animation:"spinRing 2s linear infinite" }} />
        </div>

        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:t.fontDisplay, fontSize:32, fontWeight:900, color:t.text, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Protocol Private</div>
          <div style={{ fontFamily:t.fontMono, fontSize:16, color:t.textMuted, letterSpacing:"0.25em", opacity:0.8 }}>WAITING FOR OPPONENT...</div>
        </div>

        <div style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(20px)", border:`2px solid ${t.accent}44`, borderRadius:20, padding:"32px 48px", boxShadow:"0 20px 50px rgba(0,0,0,0.5)", textAlign:"center" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.2em", marginBottom:12 }}>ROOM CODE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(48px,10vw,88px)", fontWeight:950, color:t.accent, letterSpacing:"0.15em", textShadow:`0 0 40px ${t.accentGlow}88` }}>{roomCode}</div>
          <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted, marginTop:10 }}>Share this code with your friend</div>
          <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.accent, marginTop:6, fontWeight:700 }}>{roomFormat.toUpperCase()} · WAITING</div>
        </div>

        <button onClick={cancelRoom}
          style={{ background:"transparent", border:`2px solid ${t.border}`, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, padding:"12px 36px", borderRadius:ip?2:10, cursor:"pointer", transition:"all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
        >CANCEL</button>
      </div>

      <style>{`
        @keyframes gridScan    { from{background-position:0 0} to{background-position:0 600px} }
        @keyframes scannerPulse{ 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(3.5);opacity:1} }
        @keyframes spinRing    { to{transform:rotate(360deg)} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );

  // ── Card style helpers ────────────────────────────────────────────────────
  const cardStyle = (key: string, col: string, locked?: boolean): React.CSSProperties => {
    const active = multiSub === key;
    const isHov  = hovered === key && !active && !locked;
    return {
      background: active ? `linear-gradient(145deg, ${col}1C, ${t.bgCard})` : isHov ? `linear-gradient(145deg, ${col}10, ${t.bgCard})` : t.bgCard,
      border: `2px solid ${active ? col : isHov ? col : t.border}`,
      borderRadius: ip ? 2 : 14,
      padding: isMobile ? "28px 20px" : ip ? "35px 25px" : "45px 35px",
      cursor: locked ? "not-allowed" : "pointer",
      textAlign: "left" as const,
      position: "relative" as const,
      outline: "none",
      transform: active ? "translateY(-3px) scale(1.01)" : isHov ? "translateY(-6px) scale(1.02)" : "none",
      boxShadow: active ? `0 10px 36px ${col}2E` : isHov ? `0 14px 44px ${col}24` : "none",
      transition: ["background 0.28s cubic-bezier(.22,.68,0,1.2)","border-color 0.28s","transform 0.28s cubic-bezier(.22,.68,0,1.2)","box-shadow 0.28s"].join(", "),
      opacity: locked ? 0.52 : 1,
      display: "flex",
      flexDirection: "column" as const,
    };
  };

  const customActive = hovered === "custom" || roomSection !== "none";

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"12px 14px", boxSizing:"border-box" as const,
    background:t.bgCard, border:`2px solid ${t.border}`,
    borderRadius:ip?2:8, color:t.accent,
    fontFamily:t.fontDisplay, fontSize:24, fontWeight:900,
    letterSpacing:"0.25em", textAlign:"center" as const, outline:"none",
    transition:"border-color 0.2s",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2, overflowY:"auto", background:t.bg, padding:isMobile?"70px 16px 40px":"90px 24px 40px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:isMobile?"flex-start":"space-evenly", transition:"background 0.4s" }}>

      <h1 style={{
        fontFamily: t.fontDisplay,
        fontSize: isMobile ? "clamp(18px, 5vw, 28px)" : "clamp(22px, 2.5vw, 38px)",
        fontWeight: 700,
        textAlign: "center",
        letterSpacing: "0.08em",
        margin: isMobile ? "20px 0 30px" : 0,
        maxWidth: 800,
        lineHeight: 1.3,
        textTransform: "uppercase",
        color: "#ffffff",
        textShadow: "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(255,255,255,0.3)",
      }}>{lobbyTitle}</h1>

      {rankedBanActive && (
        <div
          style={{
            width: "100%",
            maxWidth: 1200,
            marginBottom: isMobile ? 16 : 20,
            background: `${t.danger}12`,
            border: `1px solid ${t.danger}`,
            borderRadius: ip ? 2 : 12,
            padding: isMobile ? "14px 16px" : "18px 22px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 13 : 16, fontWeight: 800, color: t.danger, letterSpacing: "0.06em", marginBottom: 8 }}>
            RANKED QUEUE LOCKED
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textSecondary, lineHeight: 1.55, marginBottom: 10 }}>
            You have been temporarily blocked from ranked matchmaking for going AFK or idle in too many matches. Finish your games or play unranked until the timer ends.
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: ip ? 13 : 15, color: t.text, letterSpacing: "0.08em" }}>
            {banEndMs !== null && rankedBanRemainingSec > 0 ? (
              <>Unban in <span style={{ color: t.accent, fontWeight: 800 }}>{formatRankedBanCountdown(rankedBanRemainingSec)}</span></>
            ) : (
              <span style={{ color: t.textMuted }}>Syncing ban status…</span>
            )}
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:isMobile?12:ip?14:20, width:"100%", maxWidth:1200, marginBottom:isMobile?32:0 }}>

        {/* ── UNRANKED ── */}
        <button
          onClick={() => {
            onBoardModeAction?.("5x5_6x6_7x7");
            setMultiSub("unranked");
          }}
          onMouseEnter={() => { onHoverAction?.(); setHovered("unranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardStyle("unranked", t.p1), alignItems:"center", textAlign:"center" as const }}
        >
          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>QUEUE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color:multiSub==="unranked"||hovered==="unranked"?t.p1:t.text, transition:"color 0.28s", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Unranked</div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>Casual · XP</div>
          <div style={{ marginTop:"auto", width:"100%", display:"flex", flexDirection:"column", gap:6 }}>
            {[{k:"FORMAT",v:"5×5 → 6×6 → 7×7"},{k:"SERIES",v:"First to 3 points"},{k:"XP",v:"Rewarded"}].map(s => (
              <div key={s.k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.1em" }}>{s.k}</div>
                <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.text }}>{s.v}</div>
              </div>
            ))}
          </div>
          {multiSub === "unranked" && (
            <div style={{ position:"absolute", top:11, right:11, background:t.p1, color:"#000", fontSize:9, padding:"2px 6px", borderRadius:4, fontFamily:t.fontMono, fontWeight:900 }}>{boardMode.toUpperCase()}</div>
          )}
        </button>

        {/* ── RANKED ── */}
        <button
          onClick={() => {
            if (rankedLevelLocked) return;
            if (multiSub === "ranked") setMultiSub(null);
            else {
              onBoardModeAction?.("5x5_6x6_7x7");
              setMultiSub("ranked");
            }
          }}
          onMouseEnter={() => { if (!rankedLevelLocked) { onHoverAction?.(); setHovered("ranked"); } }}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardStyle("ranked", (hovered === "ranked" || multiSub === "ranked") ? BLOOD_RED : t.gold, rankedBanActive || rankedLevelLocked), alignItems:"center", textAlign:"center" as const, filter: (rankedBanActive || rankedLevelLocked) ? "grayscale(100%) brightness(0.5)" : "none", opacity: (rankedBanActive || rankedLevelLocked) ? 0.35 : 1 }}
        >
          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>QUEUE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color:multiSub==="ranked"||hovered==="ranked"?BLOOD_RED:t.text, transition:"color 0.28s", textTransform:"uppercase" as const, letterSpacing:"0.08em", textShadow: hovered === "ranked" ? `0 0 20px ${BLOOD_RED}88` : "none" }}>Ranked</div>
          {(rankedBanActive || rankedLevelLocked) && (
            <div style={{ position:"absolute", top:11, left:11, background: rankedLevelLocked ? "#444" : `${t.danger}EE`, color:"#fff", fontSize:9, padding:"2px 6px", borderRadius:4, fontFamily:t.fontMono, fontWeight:900 }}>
              {rankedLevelLocked ? "LEVEL 5 REQ" : "LOCKED"}
            </div>
          )}
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:16 }}>ELO · RR · Rank · Season rewards</div>
          <div style={{ marginTop:"auto", width:"100%", display:"flex", flexDirection:"column", gap:6 }}>
            {[{k:"FORMAT",v:"5×5 → 6×6 → 7×7"},{k:"SERIES",v:"First to 3 points"},{k:"ELO",v:"Competitive Standard"}].map(s => (
              <div key={s.k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.1em" }}>{s.k}</div>
                <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.text }}>{s.v}</div>
              </div>
            ))}
          </div>
          {multiSub === "ranked" && (
            <div style={{ position:"absolute", top:11, right:11, background:BLOOD_RED, color:"#fff", fontSize:9, padding:"2px 6px", borderRadius:4, fontFamily:t.fontMono, fontWeight:900, boxShadow: `0 0 10px ${BLOOD_RED}aa` }}>5×6×7</div>
          )}
        </button>

        {/* ── CUSTOM (private rooms) ── */}
        <div
          onMouseEnter={() => setHovered("custom")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: roomSection !== "none" ? `linear-gradient(145deg, ${t.accent}14, ${t.bgCard})` : customActive ? `linear-gradient(145deg, ${t.accent}0C, ${t.bgCard})` : t.bgCard,
            border: `2px solid ${roomSection !== "none" ? t.accent : customActive ? t.accent : t.border}`,
            borderRadius: ip ? 2 : 14,
            padding: ip ? "35px 25px" : "45px 35px",
            textAlign: "center" as const,
            position: "relative" as const,
            display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 0,
            transition: "background 0.28s, border-color 0.28s",
            boxShadow: roomSection !== "none" ? `0 10px 36px ${t.accent}1E` : customActive ? `0 6px 28px ${t.accent}14` : "none",
          }}
        >
          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>PRIVATE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color:roomSection!=="none"||customActive?t.accent:t.text, transition:"color 0.28s", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>Custom</div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:20 }}>Play with a friend · Room codes</div>

          {roomError && roomSection !== "none" && (
            <div style={{ background:`${t.danger}14`, border:`1px solid ${t.danger}`, borderRadius:8, padding:"8px 12px", color:t.danger, fontFamily:t.fontBody, fontSize:12, marginBottom:12, width:"100%", boxSizing:"border-box" as const }}>
              {roomError}
            </div>
          )}

          {roomSection === "create" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleCreateRoom} disabled={roomLoading}
                  style={{ flex:1, padding:"16px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:ip?2:7, color:"#000", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:roomLoading?"wait":"pointer", letterSpacing:"0.06em", transition:"all 0.2s" }}>
                  {roomLoading ? "CREATING..." : "CREATE"}
                </button>
                <button onClick={cancelRoom}
                  style={{ padding:"16px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:7, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:13, cursor:"pointer" }}>✕</button>
              </div>
            </div>
          )}

          {roomSection === "join" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.15em", marginBottom:2 }}>ROOM CODE</div>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
                onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
                maxLength={6} placeholder="XXXXXX"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e  => e.target.style.borderColor = t.border}
              />
              <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, textAlign:"center" }}>6-character code from your friend</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleJoinRoom} disabled={roomLoading || joinCode.length !== 6}
                  style={{ flex:1, padding:"16px", background:joinCode.length===6?t.accent:t.bgCard, border:`2px solid ${joinCode.length===6?t.accent:t.border}`, borderRadius:ip?2:7, color:joinCode.length===6?"#000":t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:joinCode.length===6&&!roomLoading?"pointer":"not-allowed", letterSpacing:"0.06em", transition:"all 0.2s" }}>
                  {roomLoading ? "JOINING..." : "JOIN"}
                </button>
                <button onClick={cancelRoom}
                  style={{ padding:"16px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:7, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:13, cursor:"pointer" }}>✕</button>
              </div>
            </div>
          )}

          {roomSection === "none" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:"auto", width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <button
                onClick={() => { setRoomSection("create"); setRoomError(null); router.push("/custom/room/create"); }}
                onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
                style={{ width:"100%", padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.22s" }}
              >+ CREATE ROOM</button>
              <button
                onClick={() => { setRoomSection("join"); setRoomError(null); }}
                onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
                style={{ width:"100%", padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.22s" }}
              >→ JOIN ROOM</button>
            </div>
          )}
        </div>
      </div>

      {/* FIND MATCH button */}
      {multiSub && (
        <div style={{ display:"flex", justifyContent:"center", animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) 0.06s both" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
            <button
              onClick={startSearch}
              disabled={multiSub === "ranked" && (rankedBanActive || rankedLevelLocked)}
              style={{
                background: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? t.bgCard : `linear-gradient(135deg,${t.accent},${t.accentGlow})`,
                border: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? `2px solid ${t.border}` : "none",
                color: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? t.textMuted : "#0A0A0A",
                fontFamily: t.fontDisplay,
                fontSize: 18,
                fontWeight: 700,
                padding: "18px 64px",
                borderRadius: ip ? 2 : 10,
                cursor: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? "not-allowed" : "pointer",
                opacity: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? 0.72 : 1,
                boxShadow: multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? "none" : `0 0 28px ${t.accentGlow}44`,
                transition: "transform 0.25s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s cubic-bezier(.22,.68,0,1.2), opacity 0.2s",
              }}
              onMouseEnter={e => {
                if (multiSub === "ranked" && (rankedBanActive || rankedLevelLocked)) return;
                onHoverAction?.();
                e.currentTarget.style.transform = "translateY(-3px) scale(1.04)";
                e.currentTarget.style.boxShadow = `0 8px 40px ${t.accentGlow}66`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = multiSub === "ranked" && (rankedBanActive || rankedLevelLocked) ? "none" : `0 0 28px ${t.accentGlow}44`;
              }}
              onMouseDown={e => {
                if (multiSub === "ranked" && (rankedBanActive || rankedLevelLocked)) return;
                e.currentTarget.style.transform = "translateY(0) scale(0.97)";
              }}
              onMouseUp={e => {
                if (multiSub === "ranked" && (rankedBanActive || rankedLevelLocked)) return;
                e.currentTarget.style.transform = "translateY(-3px) scale(1.04)";
              }}
            >FIND MATCH ({boardMode === "5x5_7x7" ? "5×7" : boardMode === "5x5_6x6" ? "5×6" : boardMode === "6x6_7x7" ? "6×7" : boardMode === "5x5_6x6_7x7" ? "5×6×7" : boardMode.toUpperCase()})</button>
            {multiSub === "ranked" && rankedBanActive && banEndMs !== null && rankedBanRemainingSec > 0 && (
              <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.06em", textAlign: "center" }}>
                Ranked unlocks in {formatRankedBanCountdown(rankedBanRemainingSec)}
              </div>
            )}
            {queueError && (
              <div style={{ background:`${t.danger}14`, border:`1px solid ${t.danger}`, borderRadius:8, padding:"8px 12px", color:t.danger, fontFamily:t.fontBody, fontSize:12 }}>
                {queueError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unranked Options Overlay */}
      {showUnrankedOptions && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.98)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            fontFamily: t.fontDisplay, fontSize: 36, fontWeight: 900, color: t.accent,
            marginBottom: 32, letterSpacing: "0.1em", textAlign: "center", textShadow: `0 0 40px ${t.accentGlow}44`
          }}>
            SELECT PROTOCOL
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            gap: 16, width: "100%", maxWidth: 800,
          }}>
            {[
              { id: "5x5", label: "5 × 5", sub: "Standard Rulebreak grid" },
              { id: "6x6", label: "6 × 6", sub: "Timebomb protocol" },
              { id: "7x7", label: "7 × 7", sub: "Mindlock advanced grid" },
              { id: "5x5_7x7", label: "5×5 + 7×7", sub: "Classic Rulebreaker flow", current: true },
              { id: "5x5_6x6", label: "5×5 + 6×6", sub: "Hybrid progression" },
              { id: "6x6_7x7", label: "6×6 + 7×7", sub: "Elite progression" },
            ].map((opt) => (
              <button key={opt.id}
                onClick={() => { onBoardModeAction?.(opt.id); setMultiSub("unranked"); setShowUnrankedOptions(false); }}
                className="protocol-card"
                style={{ background: t.bgCard, border: `2px solid rgba(255,255,255,0.15)`, borderRadius: ip ? 2 : 16, padding: "24px 28px", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease-out", position: "relative", overflow: "hidden", ["--hover-color" as any]: "#ffffff" } as any}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 800, color: "#fff" }}>{opt.label}</div>
                  {opt.current && <div style={{ background: `rgba(255,255,255,0.1)`, color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontFamily: t.fontMono, border: `1px solid rgba(255,255,255,0.2)` }}>RECOMMENDED</div>}
                </div>
                <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, opacity: 0.8 }}>{opt.sub}</div>
                <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, width: "100%", background: `linear-gradient(90deg, transparent, #fff, transparent)`, opacity: 0.3 }} />
              </button>
            ))}
          </div>
          <button onClick={() => setShowUnrankedOptions(false)}
            style={{ marginTop: 48, background: "transparent", border: "none", color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 14, cursor: "pointer", letterSpacing: "0.2em", fontWeight: 700 }}>
            CANCEL SELECTION
          </button>
        </div>
      )}

      {/* Ranked Options Overlay */}
      {showRankedOptions && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.98)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{
            fontFamily: t.fontDisplay, fontSize: 36, fontWeight: 900, color: t.gold,
            marginBottom: 32, letterSpacing: "0.1em", textAlign: "center", textShadow: `0 0 40px ${t.gold}44`
          }}>
            RANKED PROTOCOL
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, width: "100%", maxWidth: 400 }}>
            <button
              onClick={() => { onBoardModeAction?.("5x5_6x6_7x7"); setMultiSub("ranked"); setShowRankedOptions(false); }}
              className="protocol-card"
              style={{ background: t.bgCard, border: `2px solid ${t.gold}44`, borderRadius: ip ? 2 : 16, padding: "32px 28px", textAlign: "left", cursor: "pointer", transition: "all 0.2s ease-out", position: "relative", overflow: "hidden", ["--hover-color" as any]: t.gold } as any}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 800, color: t.gold }}>MAIN PROTOCOL</div>
              </div>
              <div style={{ fontFamily: t.fontBody, fontSize: 16, color: t.textMuted, opacity: 0.8 }}>
                Three legs (Bo3 each). ELO and RR update once at full match end.
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, width: "100%", background: `linear-gradient(90deg, transparent, ${t.gold}, transparent)`, opacity: 0.4 }} />
            </button>
          </div>
          <button onClick={() => setShowRankedOptions(false)}
            style={{ marginTop: 48, background: "transparent", border: "none", color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 14, cursor: "pointer", letterSpacing: "0.2em", fontWeight: 700 }}>
            CANCEL SELECTION
          </button>
        </div>
      )}

      {/* Rank Showcase */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
        {user && (
          <div style={{ position:"relative", transition: "all 0.4s cubic-bezier(.22,.68,0,1.2)", transform: hovered === "ranked" ? "scale(1.1)" : "scale(1)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {hovered === "ranked" && (
              <div style={{ position: "absolute", inset: -40, background: `radial-gradient(circle, ${BLOOD_RED}22 0%, transparent 70%)`, borderRadius: "50%", animation: "rankHoverPulse 1.5s ease-in-out infinite" }} />
            )}
            <div style={{ filter: hovered === "ranked" ? `drop-shadow(0 0 30px ${BLOOD_RED}aa) drop-shadow(0 0 60px ${BLOOD_RED}44)` : "none", transition: "filter 0.4s" }}>
              <NavRankBadge rank={rank} size={isMobile?100:150} isPlacement={isPlacement} />
            </div>
            <div style={{ 
              fontFamily:t.fontDisplay, fontSize:isMobile?16:24, fontWeight:800, 
              color:hovered === "ranked" ? BLOOD_RED : (isPlacement ? placementCol : rank.color), 
              letterSpacing:"0.1em", 
              textShadow:hovered === "ranked" ? `0 0 25px ${BLOOD_RED}, 0 0 50px ${BLOOD_RED}88` : `0 0 15px ${isPlacement ? placementCol : rank.color}55`, 
              transition: "all 0.4s" 
            }}>
              {isPlacement ? "PLACEMENT" : rank.name}
            </div>
            <div style={{ fontFamily:t.fontMono, fontSize:isMobile?12:16, fontWeight:700, color:t.textMuted, transition: "all 0.4s" }}>
              <span style={{ color:hovered === "ranked" ? BLOOD_RED : (isPlacement ? placementCol : t.accent) }}>{isPlacement ? "?" : (user?.elo ?? 0)}</span> ELO
            </div>
          </div>
        )}
      </div>

      <button onClick={() => setScreenAction("home")}
        style={{ background:`${t.accent}18`, border:`2px solid ${t.accent}`, color:t.accent, fontFamily:t.fontDisplay, fontSize:16, fontWeight:700, padding:"14px 44px", borderRadius:ip?2:10, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.2s", marginBottom:isMobile?30:0, marginTop:isMobile?20:0 }}
        onMouseEnter={e => { onHoverAction?.(); e.currentTarget.style.background=t.accent; e.currentTarget.style.color="#000"; }}
        onMouseLeave={e => { e.currentTarget.style.background=`${t.accent}18`; e.currentTarget.style.color=t.accent; }}
      >GO BACK</button>

      <style>{`
        @keyframes fadeUp      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinRing    { to{transform:rotate(360deg)} }
        @keyframes dotPulse    { 0%,100%{transform:scale(0.8);opacity:0.4} 50%{transform:scale(1.2);opacity:1} }
        @keyframes bannerShine { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes rankFloat   { 0%,100%{transform:translateY(0) rotate(5deg)} 50%{transform:translateY(-30px) rotate(-5deg)} }
        @keyframes matchBarShrink { from{width:100%} to{width:0%} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-100px) scale(0.9)} to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(100px) scale(0.9)}  to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes rankHoverPulse { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.4); opacity: 0.6; } }
        .protocol-card { will-change: transform; }
        .protocol-card:not(.coming-soon):hover {
          border-color: var(--hover-color) !important;
          transform: translateY(-4px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        }
      `}</style>
    </div>
  );
}