"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { loadCustomTheme } from "@/lib/customTheme";
import { useBannerShineEnabled } from "@/lib/bannerShinePreference";
import { BannerRenderer } from "./BannerRenderer";
import { RANKS, getRank, NavRankBadge, rankGlowVisualStrength, buildRankEmblemGlowFilter, rankHaloGradientForRank } from "./NavBar";
import FriendsSidePanel from "./FriendsSidePanel";
import React from "react";
import { SYROS_PFP_URL } from "@/lib/unrankedBots";


const RankBadge = ({ elo, size = 48, isPlacement = false }: { elo: number | string; size?: number; isPlacement?: boolean }) => {
  const rank = getRank(typeof elo === "string" ? 0 : elo);
  return <NavRankBadge rank={rank as any} size={size} isPlacement={isPlacement} />;
};

const CAREER_PATTERN_LABELS: Record<string, string> = {
  Y: "Y-SHAPE", H: "Y-SHAPE", L: "L-SHAPE", W: "W-SHAPE", V: "V-SHAPE", C: "C-SHAPE", 
  zigzag: "ZIGZAG", ZZ: "ZIGZAG-6", P: "P-SHAPE", T: "T-SHAPE",
};

interface MatchRound {
  winner: string;
  board: (string | null)[][];
  moves: { row: number; col: number; player: string; ext?: number }[];
  board_mode: string;
  game_number: number;
}

interface MatchRecord {
  /** MongoDB `match_history` row id (for deep-link / focus from post-match flow). */
  id?: string;
  opponent_id: string;
  opponent_username: string;
  opponent_elo: number;
  result: "win" | "loss" | "draw";
  elo_before: number;
  elo_after: number;
  elo_delta: number;
  mode: "ranked" | "unranked" | "custom";
  played_at: string;
  board_mode?: string;
  board_mode_full?: string;
  match_rounds?: MatchRound[];
  protocolbreaker_played?: boolean;
  limitbreaker_played?: boolean;
  my_slot?: "P1" | "P2";
  surrendered_by?: "P1" | "P2";
  p1_time_used_ms?: number;
  p2_time_used_ms?: number;
  was_placement?: boolean;
  placement_matches?: number;
}

const formatDurationShort = (ms: number) => {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
};

const CareerMatchRow = React.memo(({ 
  match, 
  i, 
  activeTab, 
  t, 
  setSelectedMatch,
  isMobile,
  highlightId,
}: { 
  match: MatchRecord; 
  i: number; 
  activeTab: string; 
  t: any;
  setSelectedMatch: (m: MatchRecord | null) => void;
  isMobile: boolean;
  highlightId?: string | null;
}) => {
  const myRank = getRank(match.elo_after);
  const isWin = match.result === "win";
  const isDraw = match.result === "draw";
  const deltaColor = isWin ? "#34D399" : isDraw ? "#F59E0B" : "#FF4444";

  let resultLabel = isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT";
  let resultColor = isWin ? "#10B981" : isDraw ? "#F5960B" : "#EF4444";

  if (match.surrendered_by) {
    if (match.surrendered_by === match.my_slot) {
      resultLabel = "FORFEITED";
      resultColor = "#EF4444";
    } else {
      resultLabel = "OPPONENT SURRENDERED";
      resultColor = "#10B981";
    }
  }
  // SYROS career row: detected by opponent name (the boss-tier filler
  // bot is the only entity that ever surfaces under the literal "SYROS"
  // moniker — every other unranked filler bot uses a roster name like
  // SARAH / KEVIN / etc.). When true, the row is decorated with the
  // animated blood-red boss treatment defined in the shared <style>
  // block on the CareerScreen root: a pulsing crimson glow, a vertical
  // hot stripe on the left edge, and a slow diagonal sheen.
  const isSyrosOpponent =
    String(match.opponent_username || "").toUpperCase() === "SYROS";
  const syrosRowCls = isSyrosOpponent ? " syros-row" : "";
  const syrosOpponentNameStyle: React.CSSProperties | undefined = isSyrosOpponent
    ? {
        color: "#FCA5A5",
        textShadow: "0 0 14px rgba(220,38,38,0.7), 0 0 4px rgba(220,38,38,0.85)",
      }
    : undefined;
  const hasRounds = Array.isArray(match.match_rounds) && match.match_rounds.length > 0;
  const rowDomId = match.id ? `career-match-${match.id}` : undefined;
  const rowHighlight = Boolean(highlightId && match.id && highlightId === match.id);
  const highlightStyle = rowHighlight
    ? {
        boxShadow: `0 0 0 2px ${t.accent}aa`,
        background: `${t.accent}12`,
      }
    : {};

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const modeLabel = (mode: string) => {
    if (mode === "ranked") return "Ranked";
    if (mode === "custom") return "Custom";
    return "Unranked";
  };

  if (isMobile) {
    return (
      <div
        id={rowDomId}
        className={`career-row${syrosRowCls}`}
        onClick={() => {
          if (hasRounds) setSelectedMatch(match);
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px",
          background: "transparent",
          cursor: hasRounds ? "pointer" : "default",
          borderBottom: `1px solid ${t.border}22`,
          ...highlightStyle,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 10px",
              borderRadius: 6,
              background: `${resultColor}15`,
              border: `1px solid ${resultColor}33`,
              fontFamily: t.fontMono,
              fontSize: 10,
              fontWeight: 900,
              color: resultColor,
              letterSpacing: "0.08em",
              boxShadow: `0 0 15px ${resultColor}22`,
              flexShrink: 0,
            }}
          >
            {resultLabel}
          </div>
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 10,
              color: t.textMuted,
              textAlign: "right",
              letterSpacing: "0.05em",
              fontWeight: 500,
            }}
          >
            {formatDate(match.played_at).toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${myRank.color}33`,
              boxShadow: `0 0 10px ${myRank.color}11`,
              flexShrink: 0,
            }}
          >
            <RankBadge elo={match.elo_after} size={22} isPlacement={match.was_placement} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: t.fontDisplay,
                fontSize: 15,
                fontWeight: 800,
                color: t.text,
                letterSpacing: "0.03em",
                wordBreak: "break-word",
                ...(syrosOpponentNameStyle ?? {}),
              }}
            >
              {match.opponent_username}
            </div>
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 9,
                color: myRank.color,
                letterSpacing: "0.08em",
                fontWeight: 700,
                opacity: 0.9,
              }}
            >
              {myRank.name.toUpperCase()} · {match.elo_after}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 11,
                color: t.textMuted,
                letterSpacing: "0.08em",
                fontWeight: 600,
                opacity: 0.8,
              }}
            >
              {match.board_mode_full === "5x5_6x6_7x7"
                ? "RANKED TRIPLE"
                : modeLabel(match.mode).toUpperCase()}
            </div>
            {match.limitbreaker_played || match.protocolbreaker_played ? (
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 9,
                  color: "#a78bfa",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                LIMITBREAKER
              </div>
            ) : null}
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 9,
                color: t.textMuted,
                letterSpacing: "0.04em",
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              P1 {formatDurationShort(match.p1_time_used_ms || 0)} · P2 {formatDurationShort(match.p2_time_used_ms || 0)}
            </div>
          </div>
          {activeTab === "ranked" && (
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <span
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 15,
                  fontWeight: 900,
                  color: deltaColor,
                  textShadow: `0 0 12px ${deltaColor}77`,
                }}
              >
                {match.was_placement ? "+?" : (match.elo_delta > 0 ? "+" : "")}
                {match.was_placement ? "" : match.elo_delta}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id={rowDomId}
      className={`career-row${syrosRowCls}`}
      onClick={() => {
        if (hasRounds) setSelectedMatch(match);
      }}
      style={{
        display: "grid",
        gridTemplateColumns:
          activeTab === "ranked"
            ? "100px 1fr 140px 100px 100px"
            : "100px 1fr 140px 100px",
        padding: "16px 24px",
        alignItems: "center",
        background: "transparent",
        cursor: hasRounds ? "pointer" : "default",
        borderBottom: `1px solid ${t.border}22`,
        ...highlightStyle,
      }}
    >
      {/* Result badge */}
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 10px",
            borderRadius: 6,
            background: `${resultColor}15`,
            border: `1px solid ${resultColor}33`,
            fontFamily: t.fontMono,
            fontSize: 10,
            fontWeight: 900,
            color: resultColor,
            letterSpacing: "0.08em",
            boxShadow: `0 0 15px ${resultColor}22`,
          }}
        >
          {resultLabel}
        </div>
      </div>

      {/* Opponent */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          border: `1px solid ${myRank.color}33`,
          boxShadow: `0 0 10px ${myRank.color}11`,
        }}
      >
        <RankBadge elo={match.elo_after} size={24} isPlacement={match.was_placement} />
        </div>
        <div>
          <div
            style={{
              fontFamily: t.fontDisplay,
              fontSize: 16,
              fontWeight: 800,
              color: t.text,
              letterSpacing: "0.03em",
              ...(syrosOpponentNameStyle ?? {}),
            }}
          >
            {match.opponent_username}
          </div>
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 9,
                color: myRank.color,
                letterSpacing: "0.1em",
                fontWeight: 700,
                opacity: 0.9,
              }}
            >
              {match.was_placement ? "PLACEMENT" : myRank.name.toUpperCase()} · {match.was_placement ? "?" : match.elo_after}
            </div>
          </div>
        </div>

        {/* Mode */}
      <div>
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 11,
            color: t.textMuted,
            letterSpacing: "0.08em",
            fontWeight: 600,
            opacity: 0.8,
          }}
        >
          {match.board_mode_full === "5x5_6x6_7x7"
            ? "RANKED TRIPLE"
            : modeLabel(match.mode).toUpperCase()}
        </div>
        {match.limitbreaker_played || match.protocolbreaker_played ? (
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 9,
              color: "#a78bfa",
              letterSpacing: "0.06em",
              fontWeight: 700,
              marginTop: 6,
            }}
          >
            LIMITBREAKER
          </div>
        ) : null}
        <div
          style={{
            fontFamily: t.fontMono,
            fontSize: 9,
            color: t.textMuted,
            letterSpacing: "0.04em",
            fontWeight: 600,
            marginTop: 6,
          }}
        >
          P1 {formatDurationShort(match.p1_time_used_ms || 0)} · P2 {formatDurationShort(match.p2_time_used_ms || 0)}
        </div>
      </div>

      {/* ELO DELTA */}
      {activeTab === "ranked" && (
        <div style={{ textAlign: "center" }}>
          <span
            style={{
              fontFamily: t.fontMono,
              fontSize: 16,
              fontWeight: 900,
              color: deltaColor,
              textShadow: `0 0 12px ${deltaColor}77`,
            }}
          >
            {match.was_placement ? "+?" : (match.elo_delta > 0 ? "+" : "")}
            {match.was_placement ? "" : match.elo_delta}
          </span>
        </div>
      )}

      {/* Date */}
      <div
        style={{
          fontFamily: t.fontMono,
          fontSize: 10,
          color: t.textMuted,
          textAlign: "right",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        {formatDate(match.played_at).toUpperCase()}
      </div>
    </div>
  );
});

interface Props {
  themeId: ThemeId;
  onHoverAction?: () => void;
  initialMatchId?: string;
}

export default function CareerScreen({ themeId, onHoverAction, initialMatchId }: Props) {
  const router = useRouter();
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user } = useAuthStore();
  const bannerShineEnabled = useBannerShineEnabled((user as any)?.id ?? (user as any)?._id ?? null);
  const ip = themeId === "pixel";
  /**
   * The match-history shell + tab strip + empty-state hero used to be
   * styled with `rgba(25,25,25,…)` and `rgba(255,255,255,…)` accents
   * baked for the dark theme. On the light palette those produce a
   * washed-out grey-on-grey table. Flip them to subtle dark-on-light
   * surfaces when the active theme is `classic_light`.
   */
  const isLight = themeId === "classic_light";
  const careerShellBg = isLight ? "rgba(255,255,255,0.96)" : "rgba(25,25,25,0.4)";
  const careerShellShadow = isLight ? "0 18px 36px rgba(0,0,0,0.10)" : "0 18px 36px rgba(0,0,0,0.32)";
  const careerHeaderBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const careerTabActiveBg = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const careerEmptyHeroBg = isLight ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.01)";
  const careerEmptyIconBg = isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)";

  const elo = user?.elo ?? 100;
  const placementCount = (user as any)?.placement_matches || 0;
  const isPlacement = placementCount < 5;
  const rank = getRank(elo);
  const scale = (rank as any).scale ?? 1;
  const badgeSize = 120;
  const imgSize = badgeSize * 0.85 * scale;

  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ranked" | "unranked" | "custom">("ranked");
  const [selectedMatch, setSelectedMatch] = useState<MatchRecord | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [focusHighlightId, setFocusHighlightId] = useState<string | null>(null);

  /** Open a match overlay AND reflect it in the URL as /career/{matchId}. */
  const selectMatch = (m: MatchRecord | null) => {
    setSelectedMatch(m);
    if (m?.id) router.push(`/career/${m.id}`);
    else router.push("/career");
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }
    const loadCareer = async () => {
      try {
        if (!cancelled) setLoading(true);
        const res = await API.get("/api/profile/career");
        const rows = (Array.isArray(res.data) ? res.data : []) as MatchRecord[];
        if (cancelled) return;
        setHistory(rows);
        // Priority: URL-based deep link (/career/{matchId}) beats the
        // sessionStorage focus hint from the post-match flow.
        const urlMatchId = initialMatchId || null;
        const sessionFocusId =
          typeof window !== "undefined" ? sessionStorage.getItem("pp_career_focus_match_id") : null;
        const focusId = urlMatchId || sessionFocusId;
        if (focusId) {
          const m = rows.find((x) => x.id === focusId);
          if (m) {
            const tab: "ranked" | "unranked" | "custom" =
              m.mode === "ranked" ? "ranked" : m.mode === "custom" ? "custom" : "unranked";
            setActiveTab(tab);
            setSelectedMatch(m);
            if (sessionFocusId) sessionStorage.removeItem("pp_career_focus_match_id");
            setFocusHighlightId(focusId);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                document.getElementById(`career-match-${focusId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              });
            });
          }
        }
      } catch (err) {
        console.error("Failed to load career data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadCareer();
    const handleCareerRefresh = () => {
      void loadCareer();
    };
    window.addEventListener("pp:career-refresh", handleCareerRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener("pp:career-refresh", handleCareerRefresh);
    };
  }, [user]);

  // Sync selected match with URL-provided initialMatchId (client-side nav).
  useEffect(() => {
    if (!history.length) return;
    if (initialMatchId) {
      if (selectedMatch?.id === initialMatchId) return;
      const m = history.find((x) => x.id === initialMatchId);
      if (m) {
        const tab: "ranked" | "unranked" | "custom" =
          m.mode === "ranked" ? "ranked" : m.mode === "custom" ? "custom" : "unranked";
        setActiveTab(tab);
        setSelectedMatch(m);
      }
    } else if (selectedMatch) {
      setSelectedMatch(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMatchId, history]);

  useEffect(() => {
    if (!focusHighlightId) return;
    const timer = window.setTimeout(() => setFocusHighlightId(null), 4500);
    return () => window.clearTimeout(timer);
  }, [focusHighlightId]);

  const wins = history.filter((m) => m.result === "win").length;
  const losses = history.filter((m) => m.result === "loss").length;
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;

  const nextRank = RANKS[Math.min(RANKS.indexOf(rank) + 1, RANKS.length - 1)];
  const isMaxRank = rank === nextRank;
  const eloToNext = isMaxRank ? 0 : nextRank.min - elo;
  const rankProgress = isMaxRank
    ? 100
    : Math.min(100, Math.round(((elo - rank.min) / (nextRank.min - rank.min)) * 100));

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const modeLabel = (mode: string) => {
    if (mode === "ranked") return "Ranked";
    if (mode === "custom") return "Custom";
    return "Unranked";
  };

  return (
    <div
      style={
        {
          position: "fixed",
          inset: 0,
          zIndex: 2,
          background:
            themeId === "space"
              ? "transparent"
              : t.bg,
          overflowY: "scroll",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          transition: "background 0.4s",
        } as React.CSSProperties
      }
    >
      <FriendsSidePanel themeId={themeId} onHoverAction={onHoverAction} />

      <style>{`
        .career-row {
          transition: background-color 0.12s ease, border-color 0.12s ease;
          cursor: default;
        }
        .career-row:hover {
          background: rgba(255,255,255,0.025) !important;
        }
        /* Career rows whose opponent was SYROS get an animated blood-red
         * boss-tier treatment to call them out at a glance. The row body
         * pulses a subtle crimson wash + box-shadow halo, the left edge
         * carries a hot vertical stripe, and a slow diagonal sheen sweeps
         * across to mark them as "rare encounter" entries. The hover
         * styling above is overridden so the animation continues to read
         * even while the cursor is over the row. */
        .career-row.syros-row {
          position: relative;
          background: rgba(127,29,29,0.08) !important;
          border-bottom: 1px solid rgba(220,38,38,0.45) !important;
          animation: careerSyrosGlow 2.4s ease-in-out infinite;
        }
        .career-row.syros-row:hover {
          background: rgba(127,29,29,0.16) !important;
        }
        .career-row.syros-row::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, rgba(220,38,38,0) 0%, rgba(220,38,38,1) 25%, rgba(239,68,68,1) 50%, rgba(220,38,38,1) 75%, rgba(220,38,38,0) 100%);
          box-shadow: 0 0 12px rgba(220,38,38,0.85), 0 0 20px rgba(220,38,38,0.55);
          animation: careerSyrosStripe 1.6s ease-in-out infinite;
          pointer-events: none;
        }
        .career-row.syros-row::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(220,38,38,0) 30%, rgba(220,38,38,0.18) 50%, rgba(220,38,38,0) 70%);
          background-size: 220% 100%;
          background-repeat: no-repeat;
          animation: careerSyrosSheen 3.2s linear infinite;
          pointer-events: none;
        }
        @keyframes careerSyrosGlow {
          0%,100% { box-shadow: inset 0 0 0 1px rgba(220,38,38,0.18), 0 0 16px rgba(220,38,38,0.10); }
          50%     { box-shadow: inset 0 0 0 1px rgba(220,38,38,0.55), 0 0 28px rgba(220,38,38,0.32); }
        }
        @keyframes careerSyrosStripe {
          0%,100% { opacity: 0.7; transform: scaleY(0.92); }
          50%     { opacity: 1;   transform: scaleY(1);    }
        }
        @keyframes careerSyrosSheen {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0;  }
        }
        .career-scroll::-webkit-scrollbar { width: 5px; }
        .career-scroll::-webkit-scrollbar-track { background: transparent; }
        .career-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .career-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }
        @keyframes overlayIn { from { opacity: 0; transform: scale(1.05); } to { opacity: 1; transform: scale(1); } }
        .round-card { transition: background-color 0.12s ease, border-color 0.12s ease; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; }
        .round-card:hover { background: rgba(255,255,255,0.04); }
        .round-card.active { border-color: ${t.accent}; background: ${t.accent}15; }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: isMobile ? "76px 12px 72px" : "84px 24px 80px" }}>
        {user && (
          <>
            {/* ── TOP: Rank hero section ───────────────────────────────────────── */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100vw",
                marginLeft: "calc(50% - 50vw)",
                marginRight: "calc(50% - 50vw)",
                padding: "60px 0 50px",
                gap: 16,
                borderRadius: ip ? 2 : 24,
                overflow: "hidden",
                border: `1px solid ${t.border}`,
                marginBottom: 32,
                boxShadow: `0 20px 50px rgba(0,0,0,0.3)`,
                boxSizing: "border-box",
              }}
            >
              <div style={{ position: "absolute", inset: 0, opacity: 1.0, zIndex: 0 }}>
                <BannerRenderer bannerId={loadCustomTheme().bannerSkin ?? "default"} />
                {bannerShineEnabled && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: "-150%",
                      width: "200%",
                      height: "100%",
                      background:
                        "linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 50%)",
                      zIndex: 1,
                      animation: "shineSweep 4s infinite linear",
                    }}
                  />
                )}
              </div>

              <style>{`
                @keyframes shineSweep {
                  from { transform: translateX(-50%); }
                  to { transform: translateX(100%); }
                }
              `}</style>

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: badgeSize,
                    height: badgeSize,
                    borderRadius: "50%",
                    background: isPlacement ? "rgba(255,51,255,0.05)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "visible",
                    position: "relative",
                    boxShadow: isPlacement ? `inset 0 0 15px #FF33FF22` : "none",
                    border: isPlacement ? `1px solid #FF33FF44` : `1px solid ${rank.color}33`,
                  }}
                >
                  {((!isPlacement && rankGlowVisualStrength(rank) >= 0.0012) || isPlacement) && (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: "135%",
                        height: "135%",
                        borderRadius: "50%",
                        background: rankHaloGradientForRank(isPlacement ? "#FF33FF" : rank.color, isPlacement ? ({ name: "CHRONICLE" } as any) : rank),
                        pointerEvents: "none",
                        zIndex: 0,
                        animation: "rankHaloPulse 2.6s ease-in-out infinite",
                      }}
                    />
                  )}
                  {isPlacement ? (
                    <div style={{
                      position: "relative", zIndex: 2,
                      fontFamily: "'Press Start 2P', cursive", fontSize: badgeSize * 0.55,
                      color: "#fff", 
                      textShadow: `0 0 10px #FF33FF, 0 0 20px #FF33FFaa`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      filter: buildRankEmblemGlowFilter("#FF33FF", 0.6),
                      marginTop: badgeSize * 0.05
                    }}>?</div>
                  ) : rank.img ? (
                    <img
                      src={rank.img}
                      alt={rank.name}
                      draggable={false}
                      style={{
                        width: imgSize,
                        height: imgSize,
                        objectFit: "contain",
                        userSelect: "none",
                        pointerEvents: "none",
                        position: "relative",
                        zIndex: 1,
                        filter: buildRankEmblemGlowFilter(rank.color, rankGlowVisualStrength(rank)),
                      }}
                    />
                  ) : null}
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      letterSpacing: "0.22em",
                      color: rank.color,
                      opacity: 0.8,
                      marginBottom: 4,
                    }}
                  >
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: ip ? 28 : 42,
                      fontWeight: 800,
                      color: isPlacement ? "#9CA3AF" : rank.color,
                      letterSpacing: "0.08em",
                      textShadow: `0 0 30px ${isPlacement ? "#9CA3AF" : rank.color}66`,
                    }}
                  >
                    {isPlacement ? "PLACEMENT" : rank.name}
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 22,
                      fontWeight: 700,
                      color: t.text,
                      marginTop: 4,
                    }}
                  >
                    {isPlacement ? "?" : elo}{" "}
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        color: isPlacement ? "#D1D5DB" : rank.color,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        textShadow: isPlacement
                          ? "0 0 14px rgba(209,213,219,0.55), 0 0 28px rgba(209,213,219,0.25)"
                          : `0 0 14px ${rank.color}aa, 0 0 28px ${rank.color}55, 0 1px 0 rgba(0,0,0,0.5)`,
                      }}
                    >
                      ELO
                    </span>
                  </div>
                </div>

                {(isPlacement || nextRank !== rank) && (
                  <div style={{ width: "100%", maxWidth: 460 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        fontFamily: t.fontMono,
                        fontSize: 12,
                        color: t.text,
                        letterSpacing: "0.12em",
                        marginBottom: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      <span style={{ color: isPlacement ? t.accent : nextRank.color, textShadow: `0 0 14px ${isPlacement ? t.accent : nextRank.color}44`, textAlign: "center" }}>
                        {isPlacement ? `${5 - placementCount} MATCHES REMAINING` : `${nextRank.name} in ${eloToNext} ELO`}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 10,
                        background: `${t.border}66`,
                        borderRadius: 999,
                        overflow: "hidden",
                        boxShadow: "inset 0 0 10px rgba(0,0,0,0.28)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${isPlacement ? (placementCount / 5) * 100 : rankProgress}%`,
                          background: isPlacement ? `linear-gradient(90deg, #9CA3AF, ${t.accent})` : `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
                          borderRadius: 999,
                          boxShadow: `0 0 14px ${isPlacement ? "#9CA3AF" : rank.color}aa, 0 0 18px ${isPlacement ? t.accent : nextRank.color}55`,
                          transition: "width 1s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 0,
                    background: t.bgCard,
                    border: `1px solid ${t.border}`,
                    borderRadius: ip ? 2 : 12,
                    overflow: "hidden",
                    marginTop: 4,
                    width: "100%",
                    maxWidth: 480,
                  }}
                >
                  {(
                    [
                      {
                        label: "WINS",
                        value: wins,
                        valueColor: "#34D399",
                        labelColor: "#34D399",
                        labelGlow: "0 0 12px rgba(52,211,153,0.65), 0 0 24px rgba(52,211,153,0.35), 0 1px 0 rgba(0,0,0,0.45)",
                      },
                      {
                        label: "WIN RATE",
                        value: `${winRate}%`,
                        valueColor: "#F8FAFC",
                        labelColor: "#FFFFFF",
                        labelGlow: "0 0 10px rgba(255,255,255,0.45), 0 0 22px rgba(255,255,255,0.2), 0 1px 0 rgba(0,0,0,0.5)",
                      },
                      {
                        label: "LOSSES",
                        value: losses,
                        valueColor: "#FF4444",
                        labelColor: "#FF4444",
                        labelGlow: "0 0 12px rgba(255,68,68,0.6), 0 0 24px rgba(255,68,68,0.32), 0 1px 0 rgba(0,0,0,0.45)",
                      },
                    ] as const
                  ).map((s, i) => (
                    <div
                      key={s.label}
                      style={{
                        flex: 1,
                        padding: "14px 8px",
                        textAlign: "center",
                        borderRight: i < 2 ? `1px solid ${t.border}` : "none",
                      }}
                    >
                      <div
                        style={{
                          fontFamily: t.fontMono,
                          fontSize: 18,
                          fontWeight: 800,
                          color: s.valueColor,
                        }}
                      >
                        {s.value}
                      </div>
                      <div
                        style={{
                          fontFamily: t.fontMono,
                          fontSize: 14,
                          fontWeight: 900,
                          color: s.labelColor,
                          letterSpacing: "0.14em",
                          marginTop: 6,
                          textTransform: "uppercase",
                          textShadow: s.labelGlow,
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── MATCH HISTORY ─────────────────────────────────────────────────── */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: `linear-gradient(90deg, transparent, ${t.border})`,
                }}
              />
              <div style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    fontFamily: t.fontDisplay,
                    fontSize: 13,
                    fontWeight: 900,
                    color: t.text,
                    letterSpacing: "0.25em",
                    opacity: 0.9,
                  }}
                >
                  BATTLE ARCHIVE
                </div>
              </div>
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: `linear-gradient(90deg, ${t.border}, transparent)`,
                }}
              />
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 16,
                padding: "4px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                border: `1px solid ${t.border}44`,
              }}
            >
              {(["ranked", "unranked", "custom"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedMatch(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    background: activeTab === tab ? careerTabActiveBg : "transparent",
                    border: "none",
                    borderRadius: 8,
                    color: activeTab === tab ? t.text : t.textMuted,
                    fontFamily: t.fontMono,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div
              style={{
                background: careerShellBg,
                border: `1px solid ${t.border}`,
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: careerShellShadow,
              }}
            >
              {/* Header */}
              {!isMobile && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      activeTab === "ranked" ? "100px 1fr 140px 100px 100px" : "100px 1fr 140px 100px",
                    padding: "16px 24px",
                    background: careerHeaderBg,
                    borderBottom: `1px solid ${t.border}`,
                    fontFamily: t.fontMono,
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    color: t.textMuted,
                    fontWeight: 800,
                  }}
                >
                  <span>RESULT</span>
                  <span>OPPONENT</span>
                  <span>TYPE</span>
                  {activeTab === "ranked" && <span style={{ textAlign: "center" }}>ELO</span>}
                  <span style={{ textAlign: "right" }}>DATE</span>
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div
                  style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    fontFamily: t.fontMono,
                    fontSize: 13,
                    color: t.textMuted,
                    letterSpacing: "0.1em",
                  }}
                >
                  LOADING MATCH HISTORY...
                </div>
              )}

              {/* Empty state */}
              {!loading && history.length === 0 && (
                <div
                  style={{
                    padding: "80px 24px",
                    textAlign: "center",
                    background: careerEmptyHeroBg,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: careerEmptyIconBg,
                      margin: "0 auto 24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={t.textMuted}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.5 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: 18,
                      fontWeight: 800,
                      color: t.text,
                      letterSpacing: "0.1em",
                      marginBottom: 8,
                    }}
                  >
                    NO BATTLES RECORDED
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      color: t.textMuted,
                      opacity: 0.6,
                      letterSpacing: "0.06em",
                      maxWidth: 280,
                      margin: "0 auto",
                      lineHeight: 1.6,
                    }}
                  >
                    Play matches to begin documenting your legendary career archive
                  </div>
                </div>
              )}

              {/* Rows */}
              {!loading &&
                history
                  .filter((m) => {
                    if (activeTab === "ranked") return m.mode === "ranked";
                    // Non-ranked archive is intentionally merged:
                    // both UNRANKED and CUSTOM tabs show unranked + custom rows.
                    return m.mode === "unranked" || m.mode === "custom" || !m.mode;
                  })
                  .map((match, i) => (
                    <CareerMatchRow 
                      key={match.id ?? `${match.played_at}-${i}`}
                      match={match}
                      i={i}
                      activeTab={activeTab}
                      t={t}
                      setSelectedMatch={selectMatch}
                      isMobile={isMobile}
                      highlightId={focusHighlightId}
                    />
                  ))}
            </div>

            {/* Footer note */}
            {!loading && history.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: 16,
                  fontFamily: t.fontMono,
                  fontSize: 10,
                  color: t.textMuted,
                  letterSpacing: "0.1em",
                }}
              >
                SHOWING LAST {history.length} MATCH{history.length !== 1 ? "ES" : ""}
              </div>
            )}
          </>
        )}
      </div>

      {selectedMatch && (
        <MatchOverlay
          match={selectedMatch}
          themeId={themeId}
          isMobile={isMobile}
          onClose={() => selectMatch(null)}
        />
      )}
    </div>
  );
}

// ── MATCH OVERLAY COMPONENT ─────────────────────────────────────────────────
function MatchOverlay({
  match,
  themeId,
  isMobile,
  onClose,
}: {
  match: MatchRecord;
  themeId: ThemeId;
  isMobile: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = THEMES[themeId as keyof typeof THEMES];
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);
  const rounds = Array.isArray(match.match_rounds)
    ? match.match_rounds.map((round) => {
        const safeRound = round ?? ({} as MatchRound);
        return {
          ...safeRound,
          board: Array.isArray((safeRound as any).board) ? (safeRound as any).board : [],
          moves: Array.isArray((safeRound as any).moves) ? (safeRound as any).moves : [],
        } as MatchRound;
      })
    : [];
  const currentRound = rounds[activeRoundIdx];
  const currentBoard = Array.isArray(currentRound?.board)
    ? currentRound.board.map((row) => (Array.isArray(row) ? row : []))
    : [];
  const currentMoves = Array.isArray(currentRound?.moves) ? currentRound.moves : [];
  const boardSize = Math.max(1, currentBoard.length);
  const analyzableMoveCount = currentMoves.filter((m) => {
    const p = String(m?.player || "").toUpperCase();
    return p === "P1" || p === "P2";
  }).length;
  const careerMatchId = (match.id || "").trim();
  const canAnalyzeRound = Boolean(careerMatchId) && analyzableMoveCount >= 2;
  const analyzeGameNumber = currentRound?.game_number ?? activeRoundIdx + 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10,10,10,0.95)",
        display: "flex",
        flexDirection: "column",
        animation: "overlayIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          padding: isMobile ? "16px" : "24px 32px",
          borderBottom: `1px solid ${t.border}44`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          flexWrap: isMobile ? "wrap" as const : "nowrap" as const,
          gap: isMobile ? 12 : 0,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 12 : 20, minWidth: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "none",
              color: t.text,
              width: 40,
              height: 40,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
          <div>
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 10,
                color: t.textMuted,
                letterSpacing: "0.2em",
              }}
            >
              MATCH ARCHIVE
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: isMobile ? 18 : 24, fontWeight: 900, color: t.text, wordBreak: "break-word" }}>
              VS {match.opponent_username.toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{ textAlign: isMobile ? "left" : "right" }}>
          <div
            style={{
              fontFamily: t.fontMono,
              fontSize: 14,
              fontWeight: 800,
              color:
                match.result === "win" ? "#10B981" : match.result === "draw" ? "#F59E0B" : "#EF4444",
            }}
          >
            {match.result.toUpperCase()}
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>
            {new Date(match.played_at).toLocaleDateString()}
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, marginTop: 4 }}>
            P1 {formatDurationShort(match.p1_time_used_ms || 0)} · P2 {formatDurationShort(match.p2_time_used_ms || 0)}
          </div>
        </div>
      </div>

      {careerMatchId ? (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${t.border}44`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            disabled={!canAnalyzeRound}
            title={
              !canAnalyzeRound
                ? "This round has no stored P1/P2 move list (older matches may be summary-only)."
                : "Open pattern analysis for this round"
            }
            onClick={() => {
              if (!canAnalyzeRound) return;
              router.push(
                `/analysis/career/${encodeURIComponent(careerMatchId)}?game=${encodeURIComponent(String(analyzeGameNumber))}`,
              );
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: t.fontMono,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${canAnalyzeRound ? t.accent || "#6366f1" : t.border}66`,
              background: canAnalyzeRound ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.04)",
              color: canAnalyzeRound ? t.text : t.textMuted,
              cursor: canAnalyzeRound ? "pointer" : "not-allowed",
            }}
          >
            <img
              src={SYROS_PFP_URL}
              alt=""
              width={22}
              height={22}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
                border: "1px solid rgba(192,132,252,0.75)",
                opacity: canAnalyzeRound ? 1 : 0.45,
              }}
            />
            SYROS ANALYZER
          </button>
        </div>
      ) : null}

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
        {/* Sidebar: Rounds List */}
        <div
          style={{
            width: isMobile ? "100%" : 280,
            borderRight: isMobile ? "none" : `1px solid ${t.border}44`,
            borderBottom: isMobile ? `1px solid ${t.border}44` : "none",
            padding: isMobile ? 16 : 20,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flexShrink: 0,
          }}
          className="career-scroll"
        >
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
            ROUND SEQUENCE
          </div>
          {rounds.map((r, i) => (
            <div
              key={i}
              className={`round-card ${activeRoundIdx === i ? "active" : ""}`}
              onClick={() => setActiveRoundIdx(i)}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, color: t.text }}>
                  R{i + 1}
                </span>
                <span
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 10,
                    fontWeight: 900,
                    color: r.winner === "DRAW" ? "#F59E0B" : r.winner === match.my_slot ? "#10B981" : "#EF4444",
                  }}
                >
                  {r.winner === "DRAW" ? "TIE" : r.winner === match.my_slot ? "VICTORY" : "DEFEAT"}
                </span>
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, marginTop: 4 }}>
                {r.board_mode || "UNKNOWN"} · {Array.isArray(r.moves) ? r.moves.length : 0} MOVES
              </div>
            </div>
          ))}
        </div>

        {/* Content: Board & Moves */}
        <div
          style={{
            flex: 1,
            padding: isMobile ? 16 : 40,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 20 : 40,
            overflowY: "auto",
          }}
        >
          {currentRound ? (
            <>
              {/* Board visualization */}
              <div
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div style={{ marginBottom: 24, textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: isMobile ? 24 : 32,
                      fontWeight: 900,
                      color: t.text,
                    }}
                  >
                    ROUND {activeRoundIdx + 1}
                  </div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>
                    {(currentRound.board_mode || "UNKNOWN")} FIELD
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
                    gap: 4,
                    width: "100%",
                    maxWidth: isMobile ? 420 : 500,
                    aspectRatio: "1/1",
                    background: "rgba(255,255,255,0.02)",
                    padding: 10,
                    border: `1px solid ${t.border}88`,
                    borderRadius: 12,
                    boxShadow: "0 12px 24px rgba(0,0,0,0.24)",
                  }}
                >
                  {currentBoard.map((row, rIdx) =>
                    row.map((cell, cIdx) => (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        style={{
                          background: cell
                            ? cell === match.my_slot
                              ? "#10B98122"
                              : "#EF444422"
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            cell ? (cell === match.my_slot ? "#10B981" : "#EF4444") : "transparent"
                          }`,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: boardSize > 5 ? 12 : 18,
                          fontWeight: 900,
                          color: cell === match.my_slot ? "#10B981" : "#EF4444",
                        }}
                      >
                        {cell ? (cell === match.my_slot ? "●" : "✕") : ""}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Move log */}
              <div style={{ width: isMobile ? "100%" : 300, display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 16 }}>
                  MOVE LOG
                </div>
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 12,
                    border: `1px solid ${t.border}44`,
                    padding: "10px 0",
                  }}
                  className="career-scroll"
                >
                  {currentMoves.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "8px 20px",
                        display: "flex",
                        justifyContent: "space-between",
                        borderBottom:
                          i < currentMoves.length - 1
                            ? "1px solid rgba(255,255,255,0.03)"
                            : "none",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: t.fontMono,
                          fontSize: 12,
                          color: m.player === match.my_slot ? "#10B981" : "#EF4444",
                        }}
                      >
                        {m.player === match.my_slot ? "YOU" : "OPP"} ➔ {String.fromCharCode(65 + m.col)}
                        {m.row + 1}
                      </span>
                      <span style={{ fontFamily: t.fontMono, fontSize: 10, color: t.textMuted }}>
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.textMuted,
              }}
            >
              SELECT A ROUND TO VIEW DETAILS
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
