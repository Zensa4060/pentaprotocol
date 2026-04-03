"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { ThemeId, THEMES } from "@/lib/themes";
import { checkWin, Coord } from "@/lib/winChecker";
import { checkWin7 } from "@/lib/winChecker7";
import { checkWin6 } from "@/lib/winChecker6";
import type { BoardMode, Screen, SetScreenOptions } from "@/lib/types";
import API from "@/lib/api";
import { censorText, containsProfanity } from "@/lib/profanity";
import type { Difficulty } from "@/lib/botEngine";
import { loadCustomTheme } from "@/lib/customTheme";

import { Piece, Embers, HeatOverlay, Flame, Skull, FrostCrystals, IceOverlay, GlacierAurora, GlacierSnow, GlacierGridLines, SnowflakePiece, IceShardPiece, GlacierSigilPiece, GlacierPrismPiece, RedCell, IceCell } from "./GamePieces";
import GlacierGrid from "./GlacierGrid";
import BloodMoonGrid from "./BloodMoonGrid";
import EgyptGrid from "./EgyptGrid";
import SynthwaveGrid from "./SynthwaveGrid";
import MatrixGrid from "./MatrixGrid";
import ArcaneGrid from "./ArcaneGrid";
import BioGrid from "./BioGrid";
import ForgeGrid from "./ForgeGrid";
import VoidGrid from "./VoidGrid";
import TokyoGrid from "./TokyoGrid";
import SpaceGrid from "./SpaceGrid";
import PixelGrid from "./PixelGrid";
import type { Phase } from "./GamePieces";
import { RulebreakerFlow, PHASE_TIMERS } from "./RulebreakerFlow";
import { LeftPanel, RightPanel, WinOverlay, SurrenderModal, DisconnectModal, ExitModal } from "./MatchSidebar";
import RuleshowScreen, { type RuleshowSheet } from "./RuleshowScreen";
import { useAuthStore } from "@/lib/store";
import { BannerRenderer } from "./BannerRenderer";
import { RANKS, RankIcon } from "./ProfileScreen";

const GlacierGridCompat = GlacierGrid as React.ComponentType<any>;
const ArcaneGridCompat = ArcaneGrid as React.ComponentType<any>;
const ForgeGridCompat = ForgeGrid as React.ComponentType<any>;
const VoidGridCompat = VoidGrid as React.ComponentType<any>;
const TokyoGridCompat = TokyoGrid as React.ComponentType<any>;
import { getUserKey, pushMissionEvent } from "@/lib/missionsClient";
import MatchResultScreen from "./MatchResultScreen";
import GameWinScreen from "./GameWinScreen";
import { persistLobbyTauntQuote, type LobbyQuoteResult } from "@/lib/lobbyTauntQuote";
import { seriesPointsFromHistory } from "@/lib/seriesPoints";

const EPS = 1e-9;

function lobbyQuoteFromSeriesWinner(seriesWinner: string | null | undefined, mySlot: "P1" | "P2"): LobbyQuoteResult {
  if (!seriesWinner || seriesWinner === "DRAW") return null;
  return seriesWinner === mySlot ? "win" : "loss";
}

function getWsBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase.replace("https://", "wss://").replace("http://", "ws://");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
    return `${proto}${window.location.host}`;
  }
  return "ws://localhost:8000";
}

type PlayGridSize = 5 | 6 | 7;

/** First leg of compound modes (e.g. 5x5_6x6_7x7) — matches backend _starting_board_mode idea. */
function startingLegFromBoardMode(mode: BoardMode): "5x5" | "6x6" | "7x7" {
  if (mode === "5x5" || mode === "6x6" || mode === "7x7") return mode;
  const seg = mode.split("_").filter((p): p is "5x5" | "6x6" | "7x7" => p === "5x5" || p === "6x6" || p === "7x7");
  return seg[0] ?? "5x5";
}

function fallbackGridSizeFromMode(mode: BoardMode): PlayGridSize {
  const leg = startingLegFromBoardMode(mode);
  if (leg === "7x7") return 7;
  if (leg === "6x6") return 6;
  return 5;
}

function inferGridSizeFromBoard(board: (string | null)[][]): PlayGridSize | null {
  const n = board?.length;
  if (n !== 5 && n !== 6 && n !== 7) return null;
  const row0 = board[0];
  if (!Array.isArray(row0) || row0.length !== n) return null;
  return n as PlayGridSize;
}

function matchMsForGridSize(s: PlayGridSize): number {
  return s === 7 ? 300_000 : s === 6 ? 240_000 : 180_000;
}

type MatchSeriesCompletePayload = {
  series_winner: string;
  format: string; // "ranked" | "unranked" | "custom"
  /** Mongo match_history row id for the current player's career entry */
  careerEntryId?: string | null;
  p1: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    xp_before: number;
    xp_after: number;
  };
  p2: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    xp_before: number;
    xp_after: number;
  };
};

// MatchResultOverlay removed in favor of MatchCompleteOverlay.tsx

interface MatchupOverlayProps {
  matchupData: any;
  showMatchupOverlay: boolean;
  playerSlot: "P1" | "P2" | undefined;
  p1Name: string | undefined;
  user: any;
  themeId: ThemeId;
  t: any;
  isRankedGame: boolean;
  matchupCountdown: number;
  loadCustomTheme: () => any;
}

const MatchupOverlay = ({ matchupData, showMatchupOverlay, playerSlot, p1Name, user, themeId, t, isRankedGame, matchupCountdown, loadCustomTheme }: MatchupOverlayProps) => {
  if (!matchupData || !showMatchupOverlay) return null;
  const opp = matchupData.opponent;
  const _ct = loadCustomTheme();
  const myBanner = _ct.bannerSkin ?? "default";
  const myS = playerSlot || "P1";
  const p1D = myS === "P1" ? { name: p1Name || "YOU", banner: myBanner, elo: user?.elo || 0, level: user?.level || 1 } : { name: opp.name, banner: opp.banner, elo: opp.elo || 0, level: opp.level || 1 };
  const p2D = myS === "P2" ? { name: p1Name || "YOU", banner: myBanner, elo: user?.elo || 0, level: user?.level || 1 } : { name: opp.name, banner: opp.banner, elo: opp.elo || 0, level: opp.level || 1 };

  const getRankData = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[RANKS.length - 1];

  const vsStyle: React.CSSProperties = {
    fontFamily: "'Press Start 2P', cursive",
    fontSize: "clamp(60px,12vw,160px)",
    fontWeight: 950,
    color: t.accent,
    textShadow: `0 0 28px ${t.accent}66`,
    zIndex: 10,
    letterSpacing: "-0.05em"
  };

  const UserCard = ({ data, color, isP1 }: { data: any, color: string, isP1: boolean }) => {
    const rank = getRankData(data.elo);
    const sideBySideSize = 280;

    return (
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Banner with static overlay for stable performance */}
        <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
          <BannerRenderer bannerId={data.banner} hideLabels />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.22)", zIndex: 1 }} />
        </div>
        
        <div style={{ 
          position: "relative", zIndex: 5, width: "100%", maxWidth: 1400, 
          display: "flex", alignItems: "center", justifyContent: "space-between", 
          padding: "0 80px", animation: "cardSlideIn 0.8s cubic-bezier(.22,.68,0,1.2) both" 
        }}>
           {/* Left side: Profile Picture (25% bigger -> 280px) */}
           <div style={{ 
             width: sideBySideSize, height: sideBySideSize, borderRadius: "50%", 
             background: `linear-gradient(135deg, ${color}, ${t.accent})`, 
             border: `10px solid ${color}`, display: "flex", alignItems: "center", 
             justifyContent: "center", fontSize: 140, color: "#000", 
             boxShadow: `0 16px 36px rgba(0,0,0,0.72), 0 0 22px ${color}55`,
             flexShrink: 0
           }}>👤</div>
           
           {/* Center: Large ELO and User Info */}
           <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", gap: 15 }}>
             <div style={{ 
               fontFamily: t.fontDisplay, fontSize: 62, fontWeight: 950, color: color, 
               textShadow: `0 0 20px ${color}88`, 
               letterSpacing: "0.1em",
               transform: "scale(1.1)"
             }}>
               {data.name.toUpperCase()}
             </div>
             
             <div style={{ 
               display: "inline-flex", alignSelf: "center", flexDirection: "column", alignItems: "center", 
               padding: "24px 60px", background: "rgba(0,0,0,0.82)",
               borderRadius: 24, border: `2px solid ${color}44`, 
               boxShadow: `0 10px 22px rgba(0,0,0,0.58), inset 0 0 10px ${color}1A`
             }}>
               <div style={{ fontFamily: t.fontMono, fontSize: 16, color: t.textMuted, letterSpacing: "0.3em", marginBottom: 6, opacity: 0.7 }}>ELO RATING</div>
               <div style={{ 
                 fontFamily: t.fontDisplay, fontSize: 96, fontWeight: 950, color: t.accent, 
                 textShadow: `0 0 18px ${t.accent}88`,
                 letterSpacing: "0.05em"
               }}>
                 {data.elo}
               </div>
             </div>
             
             <div style={{ 
               fontFamily: t.fontMono, fontSize: 22, color: t.textSecondary, 
               letterSpacing: "0.2em", opacity: 0.9, marginTop: 10,
               fontWeight: 800
             }}>
               LEVEL {data.level}
             </div>
           </div>

           {/* Right side: Rank Logo (Same size as PFP) */}
           <div style={{ 
             width: sideBySideSize, height: sideBySideSize, display: "flex", alignItems: "center", 
             justifyContent: "center",
             flexShrink: 0
           }}>
             <RankIcon rank={rank} size={sideBySideSize} />
           </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: t.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ textAlign: "center", paddingTop: 40, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: t.textMuted, letterSpacing: "0.3em", zIndex: 15, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
        {isRankedGame ? "RANKED · 5×5 → 6×6 → 7×7 · BO3 PER LEG" : "UNRANKED EXHIBITION · FIRST TO 2 POINTS"}
      </div>

      <UserCard data={p1D} color={t.p1} isP1={true} />

      {/* VS Divider */}
      <div style={{ height: 4, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, position: "relative", zIndex: 12, boxShadow: `0 0 30px ${t.accent}66` }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", ...vsStyle }}>VS</div>
      </div>

      <UserCard data={p2D} color={t.p2} isP1={false} />

      {/* Footer */}
      <div style={{ padding: "20px 0 40px 0", textAlign: "center", zIndex: 15, background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}>
         <div style={{ height: 6, width: 300, background: "rgba(255,255,255,0.05)", borderRadius: 3, margin: "10px auto 16px auto", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
           <div style={{ height: "100%", width: `${(matchupCountdown / 10.0) * 100}%`, background: `linear-gradient(90deg, ${t.accent}, ${t.accentGlow})`, boxShadow: `0 0 20px ${t.accent}`, transition: "width 0.1s linear" }} />
         </div>
         <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.text, fontWeight: 700, letterSpacing: "0.15em" }}>MATCH COMMENCING IN {Math.ceil(matchupCountdown)}s</div>
      </div>
    </div>
  );
};

type GameMode = "singleplayer" | "ai" | "ranked" | "unranked";
interface Props {
  themeId: ThemeId;
  setThemeIdAction?: (t: ThemeId) => void;
  isSingleplayer?: boolean;
  gameMode?: GameMode;
  difficulty?: Difficulty;
  setScreenAction?: (s: Screen, opts?: SetScreenOptions) => void;
  playHoverAction?: () => void;
  playPlaceAction?: () => void;
  playVictoryAction?: () => void;
  playDefeatAction?: () => void;
  playRulebreakerAction?: () => void;
  playTransitionAction?: () => void;
  playClickAction?: () => void;
  roomCode?: string;
  playerSlot?: "P1" | "P2";
  p1Name?: string;
  matchupData?: import("@/lib/types").MatchupData;
  boardMode?: BoardMode;
  selectedPatterns?: string[];
  /** Sync lobby `boardMode` / patterns when server upgrades mid-match (e.g. 5×5 → 7×7). */
  onMultiplayerBoardSync?: (mode: BoardMode, patterns: string[]) => void;
  graphicsQuality?: "performance" | "quality";
}

export default function GameScreen({ themeId, setThemeIdAction, isSingleplayer, gameMode = "singleplayer", difficulty = "medium", setScreenAction, roomCode, playerSlot, playHoverAction, playPlaceAction, playVictoryAction, playDefeatAction, playRulebreakerAction, playTransitionAction, playClickAction, p1Name, matchupData, boardMode = "5x5", selectedPatterns = [], onMultiplayerBoardSync, graphicsQuality = "quality" }: Props) {
  const [liveBoardMode, setLiveBoardMode] = useState<BoardMode>(boardMode);
  const [liveSelectedPatterns, setLiveSelectedPatterns] = useState<string[]>(selectedPatterns ?? []);
  useEffect(() => { setLiveBoardMode(boardMode); }, [boardMode]);
  useEffect(() => { setLiveSelectedPatterns(selectedPatterns ?? []); }, [selectedPatterns]);

  const liveBoardModeRef = useRef(boardMode);
  liveBoardModeRef.current = liveBoardMode;

  const [p1SeriesPts, setP1SeriesPts] = useState(0);
  const [p2SeriesPts, setP2SeriesPts] = useState(0);
  const seriesPtsRef = useRef({ p1: 0, p2: 0 });
  seriesPtsRef.current = { p1: p1SeriesPts, p2: p2SeriesPts };
  const awaitingRulebreakerRef = useRef(false);
  const [segmentStartIndex, setSegmentStartIndex] = useState(0);
  const segmentStartIndexRef = useRef(0);
  segmentStartIndexRef.current = segmentStartIndex;
  const [historyDisplayStartIndex, setHistoryDisplayStartIndex] = useState(0);
  const historyDisplayStartIndexRef = useRef(0);
  historyDisplayStartIndexRef.current = historyDisplayStartIndex;
  const [show7x7LevelUp, setShow7x7LevelUp] = useState(false);
  const [show6x6LevelUp, setShow6x6LevelUp] = useState(false);
  const [rulesShowSheet, setRulesShowSheet] = useState<RuleshowSheet | null>(null);
  const [p1LevelUpReady, setP1LevelUpReady] = useState(false);
  const [p2LevelUpReady, setP2LevelUpReady] = useState(false);
  const levelUpSplashActiveRef = useRef(false);
  const awaiting7x7RulesRef = useRef(false);
  const awaiting6x6RulesRef = useRef(false);
  const levelUpSplashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rulesShowSheetRef = useRef<RuleshowSheet | null>(null);
  const show7x7LevelUpRef = useRef(false);
  const show6x6LevelUpRef = useRef(false);
  useEffect(() => {
    rulesShowSheetRef.current = rulesShowSheet;
  }, [rulesShowSheet]);
  useEffect(() => {
    show7x7LevelUpRef.current = show7x7LevelUp;
  }, [show7x7LevelUp]);
  useEffect(() => {
    show6x6LevelUpRef.current = show6x6LevelUp;
  }, [show6x6LevelUp]);
  const [rulesMatchGate, setRulesMatchGate] = useState(false);
  const rulesMatchGateRef = useRef(false);
  useEffect(() => {
    rulesMatchGateRef.current = rulesMatchGate;
  }, [rulesMatchGate]);
  const [matchSeriesComplete, setMatchSeriesComplete] = useState<MatchSeriesCompletePayload | null>(null);
  /** Briefly ignore game_reset clearing the series-complete overlay (race with match_series_complete). */
  const matchSeriesUiLockUntilRef = useRef(0);
  const isViewingPostMatchRef = useRef(false);
  const [showGameWinScreen, setShowGameWinScreen] = useState(false);
  const [showRankedMatchResult, setShowRankedMatchResult] = useState(false);
  const [pbOverlay, setPbOverlay] = useState<{
    tossWinner: "P1" | "P2";
    p1Agg: number;
    p2Agg: number;
    phase: "coin" | "choice" | "choose_first_player" | "ban_first" | "ban_second";
    choice: "choose_first_player" | "ban_first" | null;
    firstPlayer: "P1" | "P2" | null;
    bans: string[];
    nextSlot: "P1" | "P2";
    coinDueMs?: number | null;
  } | null>(null);
  useEffect(() => () => {
    if (levelUpSplashTimerRef.current) clearTimeout(levelUpSplashTimerRef.current);
  }, []);

  const { user } = useAuthStore();
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const gameplayGraphicsQuality = graphicsQuality;
  const userKey = useMemo(() => getUserKey(user), [user]);

  const [_ct, set_ct] = useState(() => loadCustomTheme());
  useEffect(() => {
    const sync = () => set_ct(loadCustomTheme());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pp_custom_theme_changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pp_custom_theme_changed", sync);
    };
  }, []);
  const boardSkin = _ct.boardSkin ?? "default";
  const pieceSkin = _ct.pieceSkin ?? "default";
  const tossSkin = _ct.tossSkin ?? "default";
  const purchasedItems = ((user as { purchased_items?: string[] } | null)?.purchased_items ?? []) as string[];
  const wraithKingTossActive = tossSkin === "wraith_king" && purchasedItems.includes("coin_bundle_wraith_king");
  const rbCoinFlipSeconds = wraithKingTossActive ? 5.15 : 4;

  // Bundle boards should always use their matching pieces (no mixing).
  const effectivePieceSkin = (
    boardSkin === "red_grid"        ? "flame_skull" :
    boardSkin === "ice_grid"        ? "snowflake_shard" :
    boardSkin === "glacier_grid"    ? "glacier_shard" :
    boardSkin === "bloodmoon_grid"  ? "bloodmoon_sigils" :
    boardSkin === "egypt_grid"      ? "egypt_sigils" :
    boardSkin === "synthwave_grid"  ? "synthwave_sigils" :
    boardSkin === "matrix_grid"     ? "matrix_sigils" :
    boardSkin === "arcane_grid"     ? "arcane_sigils" :
    boardSkin === "bio_grid"        ? "bio_sigils" :
    boardSkin === "forge_grid"      ? "forge_sigils" :
    boardSkin === "void_grid"       ? "void_sigils" :
    boardSkin === "tokyo_grid"      ? "tokyo_sigils" :
    boardSkin === "space_grid"      ? "space_sigils" :
    boardSkin === "pixel_grid"      ? "pixel_sigils" :
    pieceSkin
  ) as typeof pieceSkin;

  const isRedBoard = boardSkin === "red_grid";
  const useFlameSkull = effectivePieceSkin === "flame_skull";
  const isIceBoard = boardSkin === "ice_grid";
  const isGlacierBoard = boardSkin === "glacier_grid";
  const isBloodMoonBoard = boardSkin === "bloodmoon_grid";
  const isEgyptBoard = boardSkin === "egypt_grid";
  const isSynthwaveBoard = boardSkin === "synthwave_grid";
  const isMatrixBoard = boardSkin === "matrix_grid";
  const isArcaneBoard = boardSkin === "arcane_grid";
  const isBioBoard = boardSkin === "bio_grid";
  const isForgeBoard = boardSkin === "forge_grid";
  const isVoidBoard = boardSkin === "void_grid";
  const isTokyoBoard = boardSkin === "tokyo_grid";
  const isSpaceBoard = boardSkin === "space_grid";
  const isPixelBoard = boardSkin === "pixel_grid";
  const useSnowflakeShard = effectivePieceSkin === "snowflake_shard";
  const useGlacierSigils = effectivePieceSkin === "glacier_shard";
  const useBloodMoonSigils = effectivePieceSkin === "bloodmoon_sigils";
  const useEgyptSigils = effectivePieceSkin === "egypt_sigils";
  const useSynthwaveSigils = effectivePieceSkin === "synthwave_sigils";
  const useMatrixSigils = effectivePieceSkin === "matrix_sigils";
  const useArcaneSigils = effectivePieceSkin === "arcane_sigils";
  const useBioSigils = effectivePieceSkin === "bio_sigils";
  const useForgeSigils = effectivePieceSkin === "forge_sigils";
  const useVoidSigils = effectivePieceSkin === "void_sigils";
  const useTokyoSigils = effectivePieceSkin === "tokyo_sigils";
  const useSpaceSigils = effectivePieceSkin === "space_sigils";
  const usePixelSigils = effectivePieceSkin === "pixel_sigils";

  const PIECE_SKIN_SYMBOLS: Record<string, { p1: string; p2: string; p1c: string; p2c: string }> = {
    default: { p1: t.pieces.p1, p2: t.pieces.p2, p1c: t.p1, p2c: t.p2 },
    roman: { p1: "I", p2: "V", p1c: "#D4AF37", p2c: "#C0C0C0" },
    rune: { p1: "R", p2: "T", p1c: "#34D399", p2c: "#A78BFA" },
    symbol: { p1: "+", p2: "*", p1c: "#10B981", p2c: "#60A5FA" },
    legend: { p1: "^", p2: "@", p1c: "#F59E0B", p2c: "#FF3333" },
    flame_skull: { p1: "🔥", p2: "💀", p1c: "#FF4400", p2c: "#AAAAAA" },
    snowflake_shard: { p1: "❄", p2: "◆", p1c: "#C8EEFF", p2c: "#64C8FF" },
    glacier_shard: { p1: "✶", p2: "◈", p1c: "#A5F3FC", p2c: "#93C5FD" },
    bloodmoon_sigils: { p1: "⛧", p2: "◉", p1c: "#DC2626", p2c: "#7C3AED" },
    egypt_sigils: { p1: "☥", p2: "𓂀", p1c: "#FBBF24", p2c: "#C084FC" },
    synthwave_sigils: { p1: "☀", p2: "✦", p1c: "#FF4D6D", p2c: "#00E5FF" },
    matrix_sigils: { p1: "[]", p2: "01", p1c: "#00FF41", p2c: "#4ADE80" },
    arcane_sigils: { p1: "◌", p2: "✶", p1c: "#C084FC", p2c: "#FBBF24" },
    bio_sigils: { p1: "⟡", p2: "◉", p1c: "#00FFD0", p2c: "#B464FF" },
    forge_sigils: { p1: "⛏", p2: "✺", p1c: "#FF6600", p2c: "#FFCC00" },
    void_sigils: { p1: "✷", p2: "◎", p1c: "#B464FF", p2c: "#40C0FF" },
    tokyo_sigils: { p1: "⟟", p2: "⟐", p1c: "#FF0066", p2c: "#00CCFF" },
    space_sigils: { p1: "🚀", p2: "🛰", p1c: "#00DDFF", p2c: "#FF8C00" },
    pixel_sigils: { p1: "◉", p2: "♥", p1c: "#FFDD00", p2c: "#FF4455" },
  };
  const skinData = PIECE_SKIN_SYMBOLS[effectivePieceSkin] ?? PIECE_SKIN_SYMBOLS.default;
  const pieceSymbols = { p1: skinData.p1, p2: skinData.p2 };
  const p1c = effectivePieceSkin !== "default" ? skinData.p1c : t.p1;
  const p2c = effectivePieceSkin !== "default" ? skinData.p2c : isRedBoard ? "#FF2222" : t.p2;

  // ── Responsive ───────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [showSplash, setShowSplash] = useState(!!isSingleplayer);

  const isMultiplayer = gameMode === "ranked" || gameMode === "unranked";
  const isRankedGame = gameMode === "ranked";

  const [showSurrender, setShowSurrender] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const pausedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mobileTab, setMobileTab] = useState<"log" | "chat">("log");
  const isMultiplayerGame = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
  const mySlot = playerSlot ?? "P1";

  // Multiplayer rank icons (Rulebreaker UI) should reflect actual players' ELO.
  // Backend room_state includes player1_elo/player2_elo; we cache them here.
  const [p1Elo, setP1Elo] = useState<number | undefined>(undefined);
  const [p2Elo, setP2Elo] = useState<number | undefined>(undefined);
  const asNum = (v: any): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return undefined;
  };
  useEffect(() => {
    if (!isMultiplayerGame) { setP1Elo(undefined); setP2Elo(undefined); return; }
    const myElo = asNum(user?.elo);
    const oppElo = asNum(matchupData?.opponent?.elo);
    if (mySlot === "P1") {
      if (typeof myElo === "number") setP1Elo(myElo);
      if (typeof oppElo === "number") setP2Elo(oppElo);
    } else {
      if (typeof oppElo === "number") setP1Elo(oppElo);
      if (typeof myElo === "number") setP2Elo(myElo);
    }
  }, [isMultiplayerGame, mySlot, user?.elo, matchupData?.opponent?.elo]);
  const coinStartTimeRef = useRef<number>(0);
  const [opponentName, setOpponentName] = useState<string | null>(null);
  const [p1Banner, setP1Banner] = useState<string>(mySlot === "P1" ? (_ct.bannerSkin ?? "default") : "default");
  const [p2Banner, setP2Banner] = useState<string>(mySlot === "P2" ? (_ct.bannerSkin ?? "default") : "default");

  const myDisplayName = p1Name ?? (mySlot === "P1" ? "P1" : "P2");
  const oppDisplayName = opponentName ?? (mySlot === "P1" ? "P2" : "P1");

  // Sync banners from matchupData on start
  useEffect(() => {
    if (isMultiplayerGame && matchupData) {
      const opp = matchupData.opponent;
      const oppBanner = opp.banner || (opp as any).banner_style || "default";
      if (playerSlot === "P1") setP2Banner(oppBanner);
      else if (playerSlot === "P2") setP1Banner(oppBanner);
    }
  }, [matchupData, isMultiplayerGame, playerSlot]);

  const p1DisplayName = isMultiplayerGame
    ? (mySlot === "P1" ? myDisplayName : oppDisplayName)
    : (p1Name ?? "P1");
  const p2DisplayName = isMultiplayerGame
    ? (mySlot === "P2" ? myDisplayName : oppDisplayName)
    : gameMode === "ai" ? "BOT" : "P2";

  const p1Label = `${p1DisplayName}`;

  const p2Label = gameMode === "ai"
    ? `BOT`
    : `${p2DisplayName}`;

  const winnerDisplayName = (w: string | null): string => {
    if (w === "P1") return p1DisplayName;
    if (w === "P2") return p2DisplayName;
    if (w === "DRAW") return "DRAW";
    return w ?? "";
  };

  const [board, setBoard] = useState<(string | null)[][]>(() => {
    const s = fallbackGridSizeFromMode(boardMode);
    return Array(s).fill(null).map(() => Array(s).fill(null));
  });

  const GRID_SIZE = useMemo((): PlayGridSize => {
    const inferred = inferGridSizeFromBoard(board);
    if (inferred !== null) return inferred;
    return fallbackGridSizeFromMode(liveBoardMode);
  }, [board, liveBoardMode]);

  const is7x7 = GRID_SIZE === 7;
  const is6x6 = GRID_SIZE === 6;
  const CENTER = is7x7 ? 3 : 2;
  const matchTimeMs = matchMsForGridSize(GRID_SIZE);
  const matchTimeMsRef = useRef(matchTimeMs);
  matchTimeMsRef.current = matchTimeMs;

  const emptyBoard = useCallback(
    (): (string | null)[][] => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null)),
    [GRID_SIZE],
  );
  const [current, setCurrent] = useState("P1");
  const [winner, setWinner] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<Coord[]>([]);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [extraTurns, setExtraTurns] = useState(0);
  const [c3Blocked, setC3Blocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [log, setLog] = useState<{ text: string; player: string }[]>([]);

  const [p1Time, setP1Time] = useState(() => matchMsForGridSize(fallbackGridSizeFromMode(boardMode)));
  const [p2Time, setP2Time] = useState(() => matchMsForGridSize(fallbackGridSizeFromMode(boardMode)));

  const [gameNumber, setGameNumber] = useState(1);
  const [matchHistory, setMatchHistory] = useState<string[]>([]);
  const [matchOver, setMatchOver] = useState(false);
  const [seriesWinner, setSeriesWinner] = useState<string | null>(null);
  const didRecordMissionRef = useRef(false);
  const didRefreshProfileAfterSeriesRef = useRef(false);
  const didPersistLobbyQuoteForSeriesRef = useRef(false);
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: "P1" | "P2"; text: string; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWarning, setChatWarning] = useState(false);
  const [unreadOpponentChat, setUnreadOpponentChat] = useState(0);
  const [chatToastVisible, setChatToastVisible] = useState(false);
  const chatToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatVisibleRef = useRef(false);
  const [readyTimeout, setReadyTimeout] = useState(60);
  const [readyTimer, setReadyTimer] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [showMatchupOverlay, setShowMatchupOverlay] = useState(!!matchupData);
  const [matchupCountdown, setMatchupCountdown] = useState(10.0);
  const [matchStartAtMs, setMatchStartAtMs] = useState<number | null>(null);
  const [p1RttMs, setP1RttMs] = useState<number | null>(null);
  const [p2RttMs, setP2RttMs] = useState<number | null>(null);
  const sentMatchReadyRef = useRef(false);
  const wsPingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingOutstandingRef = useRef<number | null>(null);

  const [showRematch, setShowRematch] = useState(false);
  const [rematchRequested, setRematchRequested] = useState<string | null>(null);
  const [lastSeries, setLastSeries] = useState<{ winner: string | null; history: string[] } | null>(null);

  const [winnerPickedRule, setWinnerPickedRule] = useState<string | null>(null);
  const [winnerPickedFirst, setWinnerPickedFirst] = useState<string | null>(null);
  const [winnerPickedC3, setWinnerPickedC3] = useState<boolean | null>(null);

  const [rbSplashTimer, setRbSplashTimer] = useState(5);
  const [coinFlipTimer, setCoinFlipTimer] = useState(4.0);
  const [coinRevealTimer, setCoinRevealTimer] = useState(0.0);
  const [coinResult, setCoinResult] = useState<"PENTA" | "PROTO" | null>(null);
  const rbCoinTossInitRef = useRef(false);
  const rbCoinPendingRef = useRef<"PENTA" | "PROTO" | null>(null);
  const [rbCoinPendingResult, setRbCoinPendingResult] = useState<"PENTA" | "PROTO" | null>(null);
  const [coinAngle, setCoinAngle] = useState(0);
  const coinAngleRef = useRef(0);
  const coinFrameRef = useRef(0);
  const coinDivRef = useRef<HTMLDivElement>(null);
  const [tossWinner, setTossWinner] = useState<"P1" | "P2" | null>(null);
  const [firstPlayerChosen, setFirstPlayerChosen] = useState<string | null>(null);
  const [rbC3Blocked, setRbC3Blocked] = useState(false);
  const [rbBannedPatterns, setRbBannedPatterns] = useState<string[]>([]);
  /** Toss winner on extra-turn path: hide which pattern was banned in sidebar / summary for this slot */
  const [rbHideBannedPatternFromSlot, setRbHideBannedPatternFromSlot] = useState<"P1" | "P2" | null>(null);
  /** Full pattern list before ban (7×7 extra-turn path) for decoy sidebar display */
  const [rbPatternsPreBan, setRbPatternsPreBan] = useState<string[] | null>(null);
  const [suppressCenterOpening, setSuppressCenterOpening] = useState(false);
  const [rbExtraTurnTokenHolder, setRbExtraTurnTokenHolder] = useState<"P1" | "P2" | null>(null);
  const [rbExtraTurnTokenUsed, setRbExtraTurnTokenUsed] = useState(false);
  /** Round 3 (6×6): chosen special cell owner; stone always counts as this symbol. */
  const [rb6SpecialCell, setRb6SpecialCell] = useState<{ r: number; c: number; owner: "P1" | "P2" } | null>(null);
  /** Round 3 (6×6): whose timer is reduced to 2:00. */
  const [rb6TimerOwner, setRb6TimerOwner] = useState<"P1" | "P2" | null>(null);
  /** Round 3 (6×6): who must pick the special grid cell. */
  const [rb6CellChooser, setRb6CellChooser] = useState<"P1" | "P2" | null>(null);
  const [summaryTimer, setSummaryTimer] = useState(5);
  const [choiceTimer, setChoiceTimer] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [botPickedSide, setBotPickedSide] = useState<"left" | "right" | null>(null);

  const [isBoardPaused, setIsBoardPaused] = useState(false);
  const winClickLockRef = useRef(false);

  // Mobile log drawer
  const [showMobileLog, setShowMobileLog] = useState(false);

  /** Multiplayer: authoritative per-player structural lists from server (7×7 asymmetric ban). */
  const [serverStructuralPatternsP1, setServerStructuralPatternsP1] = useState<string[] | null>(null);
  const [serverStructuralPatternsP2, setServerStructuralPatternsP2] = useState<string[] | null>(null);

  useEffect(() => {
    chatVisibleRef.current = isMobile ? (showMobileLog && mobileTab === "chat") : chatOpen;
  }, [isMobile, showMobileLog, mobileTab, chatOpen]);

  useEffect(() => {
    if (!isMultiplayerGame) return;
    if (!isMobile) return;
    if (showMobileLog && mobileTab === "chat") {
      setUnreadOpponentChat(0);
      setChatToastVisible(false);
      if (chatToastTimerRef.current) {
        clearTimeout(chatToastTimerRef.current);
        chatToastTimerRef.current = null;
      }
    }
  }, [isMultiplayerGame, isMobile, showMobileLog, mobileTab]);

  useEffect(() => {
    if (!isMultiplayerGame) return;
    if (isMobile) return;
    if (chatOpen) {
      setUnreadOpponentChat(0);
      setChatToastVisible(false);
      if (chatToastTimerRef.current) {
        clearTimeout(chatToastTimerRef.current);
        chatToastTimerRef.current = null;
      }
    }
  }, [isMultiplayerGame, isMobile, chatOpen]);

  useEffect(() => () => {
    if (chatToastTimerRef.current) clearTimeout(chatToastTimerRef.current);
  }, []);

  /** Who chose the ban in rulebreaker: toss winner (ban path) or toss loser (extra-turn path). */
  const rulebreakerBanActorSlot = useMemo((): "P1" | "P2" | null => {
    if (rbBannedPatterns.length === 0 || GRID_SIZE !== 7) return null;
    if (winnerPickedRule === "ban" && tossWinner) return tossWinner;
    if (winnerPickedRule === "extra_turn" && tossWinner) return tossWinner === "P1" ? "P2" : "P1";
    return null;
  }, [rbBannedPatterns, GRID_SIZE, winnerPickedRule, tossWinner]);

  /** Sidebar / legacy UI: pool with banned pattern removed (unchanged display semantics). */
  const activePatterns = useMemo(
    () => rbBannedPatterns.length > 0 ? liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p)) : liveSelectedPatterns,
    [liveSelectedPatterns, rbBannedPatterns],
  );

  /** Structural win checks: banned pattern applies only to the opponent of the player who banned. */
  const structuralPatternsP1 = useMemo(() => {
    if (GRID_SIZE !== 7) return liveSelectedPatterns;
    if (serverStructuralPatternsP1 && serverStructuralPatternsP1.length > 0) return serverStructuralPatternsP1;
    if (rbBannedPatterns.length === 0 || !rulebreakerBanActorSlot) {
      return rbBannedPatterns.length > 0 ? liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p)) : liveSelectedPatterns;
    }
    return rulebreakerBanActorSlot === "P1"
      ? liveSelectedPatterns
      : liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p));
  }, [GRID_SIZE, liveSelectedPatterns, serverStructuralPatternsP1, rbBannedPatterns, rulebreakerBanActorSlot]);

  const structuralPatternsP2 = useMemo(() => {
    if (GRID_SIZE !== 7) return liveSelectedPatterns;
    if (serverStructuralPatternsP2 && serverStructuralPatternsP2.length > 0) return serverStructuralPatternsP2;
    if (rbBannedPatterns.length === 0 || !rulebreakerBanActorSlot) {
      return rbBannedPatterns.length > 0 ? liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p)) : liveSelectedPatterns;
    }
    return rulebreakerBanActorSlot === "P2"
      ? liveSelectedPatterns
      : liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p));
  }, [GRID_SIZE, liveSelectedPatterns, serverStructuralPatternsP2, rbBannedPatterns, rulebreakerBanActorSlot]);

  const sidebarPatternList = useMemo(() => {
    if (
      GRID_SIZE === 7 &&
      rbHideBannedPatternFromSlot === mySlot &&
      rbPatternsPreBan &&
      rbPatternsPreBan.length > 0
    ) {
      return rbPatternsPreBan;
    }
    return activePatterns;
  }, [GRID_SIZE, rbHideBannedPatternFromSlot, mySlot, rbPatternsPreBan, activePatterns]);
  const sidebarRbBannedPatterns = useMemo(() => {
    if (GRID_SIZE === 7 && rbHideBannedPatternFromSlot === mySlot) return [];
    return rbBannedPatterns;
  }, [GRID_SIZE, rbHideBannedPatternFromSlot, mySlot, rbBannedPatterns]);
  const patternsSidebarSecret = useMemo(
    () =>
      GRID_SIZE === 7 &&
      rbHideBannedPatternFromSlot != null &&
      ((isMultiplayerGame && rbHideBannedPatternFromSlot === mySlot) ||
        (gameMode === "ai" && rbHideBannedPatternFromSlot === "P1")),
    [GRID_SIZE, rbHideBannedPatternFromSlot, isMultiplayerGame, mySlot, gameMode],
  );
  const displayMatchHistory = useMemo(
    () => matchHistory.slice(Math.max(0, historyDisplayStartIndex)),
    [matchHistory, historyDisplayStartIndex],
  );

  // ── Timer values stored in refs so rAF can read/write without setState loops ──
  const p1TimeRef = useRef(matchMsForGridSize(fallbackGridSizeFromMode(boardMode)));
  const p2TimeRef = useRef(matchMsForGridSize(fallbackGridSizeFromMode(boardMode)));
  const matchupCountdownRef = useRef(10.0);

  const fmtTime = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const fmtSecAction = (s: number) => `${Math.ceil(Math.max(0, s))}`;

  const R = useRef({
    phase: "playing" as Phase, current: "P1", winner: null as string | null,
    p1Ready: false, p2Ready: false, readyTimeout: 60, readyTimer: 0,
    coinResult: null as "PENTA" | "PROTO" | null, matchOver: false, gameNumber: 1,
    matchHistory: [] as string[], firstPlayerChosen: null as string | null,
    tossWinner: null as "P1" | "P2" | null, rbC3Blocked: false, rbBannedPatterns: [] as string[], summaryTimer: 5, choiceTimer: 0,
    winnerPickedRule: null as string | null,
    rbHideBannedPatternFromSlot: null as "P1" | "P2" | null,
    rbPatternsPreBan: null as string[] | null,
    rb6TimerOwner: null as "P1" | "P2" | null,
    rb6CellChooser: null as "P1" | "P2" | null,
    rb6SpecialCell: null as { r: number; c: number; owner: "P1" | "P2" } | null,
  });
  R.current.phase = phase;
  R.current.current = current;
  R.current.winner = winner;
  R.current.p1Ready = p1Ready;
  R.current.p2Ready = p2Ready;
  R.current.readyTimeout = readyTimeout;
  R.current.readyTimer = readyTimer;
  R.current.coinResult = coinResult;
  R.current.matchOver = matchOver;
  R.current.gameNumber = gameNumber;
  R.current.matchHistory = matchHistory;
  R.current.firstPlayerChosen = firstPlayerChosen;
  R.current.tossWinner = tossWinner;
  R.current.rbC3Blocked = rbC3Blocked;
  R.current.rbBannedPatterns = rbBannedPatterns;
  R.current.rbHideBannedPatternFromSlot = rbHideBannedPatternFromSlot;
  R.current.rbPatternsPreBan = rbPatternsPreBan;
  R.current.rb6TimerOwner = rb6TimerOwner;
  R.current.rb6CellChooser = rb6CellChooser;
  R.current.rb6SpecialCell = rb6SpecialCell;
  R.current.summaryTimer = summaryTimer;
  R.current.choiceTimer = choiceTimer;
  R.current.winnerPickedRule = winnerPickedRule;

  const boardRef = useRef(board);
  const extraTurnsRef = useRef(extraTurns);
  const movesPlayedRef = useRef(movesPlayed);
  const botApiRetryAfterRef = useRef(0);
  const botApiWarnedRef = useRef(false);
  const structuralPatternsP1Ref = useRef(structuralPatternsP1);
  const structuralPatternsP2Ref = useRef(structuralPatternsP2);
  useEffect(() => { structuralPatternsP1Ref.current = structuralPatternsP1; }, [structuralPatternsP1]);
  useEffect(() => { structuralPatternsP2Ref.current = structuralPatternsP2; }, [structuralPatternsP2]);
  const liveSelectedPatternsRef = useRef(liveSelectedPatterns);
  useEffect(() => { liveSelectedPatternsRef.current = liveSelectedPatterns; }, [liveSelectedPatterns]);
  const matchHistoryRef = useRef<string[]>([]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { extraTurnsRef.current = extraTurns; }, [extraTurns]);
  useEffect(() => { movesPlayedRef.current = movesPlayed; }, [movesPlayed]);

  useEffect(() => {
    if (phase === "rb_splash") {
      rbCoinTossInitRef.current = false;
      rbCoinPendingRef.current = null;
      setRbCoinPendingResult(null);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "rb_coin" || coinResult) return;
    if (isMultiplayerGame && mySlot !== "P1") return;
    if (rbCoinTossInitRef.current) return;
    rbCoinTossInitRef.current = true;
    const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
    rbCoinPendingRef.current = r;
    setRbCoinPendingResult(r);
  }, [phase, coinResult, isMultiplayerGame, mySlot]);

  useEffect(() => { initBoard("P1"); }, []);

  useEffect(() => {
    if (board.length !== GRID_SIZE || (board[0] && board[0].length !== GRID_SIZE)) {
      setBoard(emptyBoard());
    }
  }, [GRID_SIZE]);

  // ── WebSocket for multiplayer ─────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayerGame || !playerSlot) return;
    const base = getWsBaseUrl();

    let destroyed = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (destroyed) return;
      const ws = new WebSocket(`${base}/api/room/ws/${roomCode}/${playerSlot}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const myBanner = mySlot === "P1" ? p1Banner : p2Banner;
        ws.send(JSON.stringify({ type: "player_info", username: p1Name ?? playerSlot ?? "P1", slot: playerSlot, bannerId: myBanner }));

        // Start frequent ping for RTT + connectivity bars
        if (wsPingRef.current) clearInterval(wsPingRef.current);
        wsPingRef.current = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const ts = Date.now();
          pingOutstandingRef.current = ts;
          ws.send(JSON.stringify({ type: "ping", ts }));
        }, 2000);
      };

        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          unstable_batchedUpdates(() => {
            if (msg.type === "player_info") {
              if (msg.slot !== playerSlot) {
                setOpponentName(msg.username ?? null);
              }
              // Reply with our own info to ensure both sides are synced
              ws.send(JSON.stringify({ type: "player_info", username: p1Name ?? playerSlot ?? "P1", slot: playerSlot }));
              return;
            }
            if (msg.type === "move_made") {
              setBoard(msg.board);
              setCurrent(msg.current_player);
              setMovesPlayed(msg.moves_played);
              setExtraTurns(msg.extra_turns ?? 0);
              if (msg.row !== undefined && msg.col !== undefined) {
                const mover = msg.board[msg.row][msg.col] as string | null;
                if (mover) {
                  const _piece = mover === "P1" ? t.pieces.p1 : t.pieces.p2;
                  setLog(l => [...l, { text: `${l.length + 1}. ${_piece}→${String.fromCharCode(65 + msg.col)}${msg.row + 1} (${mover})`, player: mover }]);
                }
              }
                if (msg.winner) {
                const skipDrawOverlay = Boolean(
                  (msg as { auto_7x7_upgrade_follows?: boolean }).auto_7x7_upgrade_follows,
                );
                const wl = (msg.win_line ?? []) as [number, number][];
                setWinLine(wl);
                setWinner(msg.winner);
                if (msg.winner === "P1") playVictoryAction?.(); else if (msg.winner === "P2") playDefeatAction?.();
                const newHist = Array.isArray(msg.match_history)
                  ? (msg.match_history as string[])
                  : [...matchHistoryRef.current, msg.winner as string];
                matchHistoryRef.current = newHist;
                setMatchHistory([...newHist]);
                if (typeof msg.segment_start_index === "number") {
                  segmentStartIndexRef.current = msg.segment_start_index;
                  setSegmentStartIndex(msg.segment_start_index);
                }
                if (typeof msg.history_display_start_index === "number") {
                  historyDisplayStartIndexRef.current = msg.history_display_start_index;
                  setHistoryDisplayStartIndex(msg.history_display_start_index);
                }
                const fbPts = seriesPointsFromHistory(newHist);
                const p1p = typeof msg.p1_series_points === "number"
                  ? msg.p1_series_points
                  : fbPts.p1;
                const p2p = typeof msg.p2_series_points === "number"
                  ? msg.p2_series_points
                  : fbPts.p2;
                setP1SeriesPts(p1p);
                setP2SeriesPts(p2p);
                if (typeof msg.awaiting_rulebreaker === "boolean") {
                  awaitingRulebreakerRef.current = msg.awaiting_rulebreaker;
                }
                let sw: string | null =
                  msg.series_winner === "P1" || msg.series_winner === "P2" || msg.series_winner === "DRAW"
                    ? (msg.series_winner as string)
                    : null;
                if (sw == null) sw = checkSeriesWinner(newHist);
                if (sw === "P1" || sw === "P2" || sw === "DRAW") {
                  setIsBoardPaused(true);
                  winClickLockRef.current = true;
                  setShowWinOverlay(false);
                  setOverlayVisible(false);
                  setMatchOver(true);
                  setSeriesWinner(sw);
                  setPhase("match_over");
                  wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
                } else if (!skipDrawOverlay) {
                  setIsBoardPaused(true);
                  winClickLockRef.current = true;
                  setTimeout(() => {
                    unstable_batchedUpdates(() => {
                      setShowWinOverlay(true);
                      requestAnimationFrame(() => setOverlayVisible(true));
                    });
                  }, 300);
                  setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
                }
              }
            } else if (msg.type === "room_state") {
          const r = msg.room;
          setBoard(r.board ?? emptyBoard());
          setCurrent(r.current_player ?? "P1");
          setMovesPlayed(r.moves_played ?? 0);
          {
            const e1 = asNum(r.player1_elo);
            const e2 = asNum(r.player2_elo);
            if (typeof e1 === "number") setP1Elo(e1);
            if (typeof e2 === "number") setP2Elo(e2);
          }
          if (r.player1_banner) setP1Banner(String(r.player1_banner));
          if (r.player2_banner) setP2Banner(String(r.player2_banner));
          // Extract opponent name from room data
          if (playerSlot === "P1" && r.player2_name) setOpponentName(r.player2_name);
          if (playerSlot === "P2" && r.player1_name) setOpponentName(r.player1_name);
          if (r.board_mode) setLiveBoardMode(r.board_mode as BoardMode);
          if (Array.isArray(r.selected_patterns)) setLiveSelectedPatterns(r.selected_patterns);
          {
            const rs = r as { selected_patterns_p1?: string[] | null; selected_patterns_p2?: string[] | null };
            if (rs.selected_patterns_p1 !== undefined) {
              setServerStructuralPatternsP1(Array.isArray(rs.selected_patterns_p1) ? rs.selected_patterns_p1 : null);
            }
            if (rs.selected_patterns_p2 !== undefined) {
              setServerStructuralPatternsP2(Array.isArray(rs.selected_patterns_p2) ? rs.selected_patterns_p2 : null);
            }
          }
          if (typeof r.suppress_center_opening === "boolean") setSuppressCenterOpening(r.suppress_center_opening);
          if (r.rb6_timer_owner === "P1" || r.rb6_timer_owner === "P2") {
            setRb6TimerOwner(r.rb6_timer_owner);
            if (r.board_mode === "6x6" && (r.moves_played ?? 0) === 0) {
              if (r.rb6_timer_owner === "P1") {
                p1TimeRef.current = 120_000;
                setP1Time(120_000);
              } else {
                p2TimeRef.current = 120_000;
                setP2Time(120_000);
              }
            }
          } else if (r.rb6_timer_owner === null) {
            setRb6TimerOwner(null);
          }
          if (r.rb6_special_cell && typeof r.rb6_special_cell === "object") {
            const sc = r.rb6_special_cell as { r?: unknown; c?: unknown; owner?: unknown };
            if (typeof sc.r === "number" && typeof sc.c === "number" && (sc.owner === "P1" || sc.owner === "P2")) {
              setRb6SpecialCell({ r: sc.r, c: sc.c, owner: sc.owner });
            }
          } else if (r.rb6_special_cell === null) {
            setRb6SpecialCell(null);
          }
          if (r.rb_extra_turn_token_holder === "P1" || r.rb_extra_turn_token_holder === "P2") {
            setRbExtraTurnTokenHolder(r.rb_extra_turn_token_holder);
          } else if (r.rb_extra_turn_token_holder === null) {
            setRbExtraTurnTokenHolder(null);
          }
          if (typeof r.rb_extra_turn_token_used === "boolean") setRbExtraTurnTokenUsed(r.rb_extra_turn_token_used);
          if (r.rb_hide_banned_from_slot === "P1" || r.rb_hide_banned_from_slot === "P2") {
            setRbHideBannedPatternFromSlot(r.rb_hide_banned_from_slot);
          } else {
            setRbHideBannedPatternFromSlot(null);
          }
          if (Array.isArray(r.rb_patterns_pre_ban)) setRbPatternsPreBan(r.rb_patterns_pre_ban as string[]);
          else setRbPatternsPreBan(null);
          if (Array.isArray(r.rb_banned_patterns)) setRbBannedPatterns(r.rb_banned_patterns);
          else if (typeof r.rb_banned_pattern === "string") setRbBannedPatterns([r.rb_banned_pattern]);
          else if (r.rb_banned_pattern === null) setRbBannedPatterns([]);
          if (typeof r.p1_series_points === "number") setP1SeriesPts(r.p1_series_points);
          if (typeof r.p2_series_points === "number") setP2SeriesPts(r.p2_series_points);
          if (typeof r.awaiting_rulebreaker === "boolean") awaitingRulebreakerRef.current = r.awaiting_rulebreaker;
          if (Array.isArray(r.match_history)) {
            matchHistoryRef.current = r.match_history as string[];
            setMatchHistory(r.match_history as string[]);
          }
          if (typeof r.game_number === "number") setGameNumber(r.game_number);
          if (typeof r.segment_start_index === "number") {
            segmentStartIndexRef.current = r.segment_start_index;
            setSegmentStartIndex(r.segment_start_index);
          }
          if (typeof r.history_display_start_index === "number") {
            historyDisplayStartIndexRef.current = r.history_display_start_index;
            setHistoryDisplayStartIndex(r.history_display_start_index);
          }
          awaiting7x7RulesRef.current = r.awaiting_7x7_rules_ready === true;
          const slot = playerSlot ?? "P1";
          if (r.board_mode === "5x5" && r.awaiting_5x5_rules_ready === true) {
            setRulesMatchGate(true);
            setRulesShowSheet("5x5");
            setShow7x7LevelUp(false);
            setPhase("playing");
            setWinner(null);
            setWinLine([]);
            setShowWinOverlay(false);
            setOverlayVisible(false);
            setMatchOver(false);
            setSeriesWinner(null);
          } else if (r.board_mode === "6x6" && (r as { awaiting_6x6_rules_ready?: boolean }).awaiting_6x6_rules_ready === true) {
            setRulesMatchGate(true);
            setShow7x7LevelUp(false);
            setShow6x6LevelUp(false);
            setRulesShowSheet("6x6");
            setPhase("playing");
            setWinner(null);
            setWinLine([]);
            setShowWinOverlay(false);
            setOverlayVisible(false);
            setMatchOver(false);
            setSeriesWinner(null);
          } else if (r.board_mode === "7x7" && r.awaiting_7x7_rules_ready === true) {
            if (!levelUpSplashActiveRef.current) {
              setRulesMatchGate(true);
              setRulesShowSheet("7x7");
              setPhase("playing");
              setWinner(null);
              setWinLine([]);
              setShowWinOverlay(false);
              setOverlayVisible(false);
              setMatchOver(false);
              setSeriesWinner(null);
            }
          } else if (!levelUpSplashActiveRef.current) {
            setRulesShowSheet(null);
            setRulesMatchGate(false);
          }
          {
            const rp = r as {
              protocolbreaker_pending?: boolean;
              limitbreaker_pending?: boolean;
              pb_toss_winner?: string;
              pb_bans?: string[];
              pb_p1_aggregate?: number;
              pb_p2_aggregate?: number;
              lb_phase?: string | null;
              lb_choice?: string | null;
              lb_first_player?: string | null;
              lb_next_slot?: string | null;
              lb_coin_due_ms?: number | null;
              phase?: string | null;
              rb_toss_winner?: string | null;
              rb_coin_result?: "PENTA" | "PROTO" | null;
              rb_phase_payload?: Record<string, unknown> | null;
              rb_auto_start_due_ms?: number | null;
            };
            if ((rp.limitbreaker_pending || rp.protocolbreaker_pending) && (rp.pb_toss_winner === "P1" || rp.pb_toss_winner === "P2")) {
              const bans = Array.isArray(rp.pb_bans) ? rp.pb_bans : [];
              const tw = rp.pb_toss_winner as "P1" | "P2";
              const phase = rp.lb_phase === "choice" || rp.lb_phase === "choose_first_player" || rp.lb_phase === "ban_first" || rp.lb_phase === "ban_second" ? rp.lb_phase : "coin";
              const nextSlot: "P1" | "P2" =
                rp.lb_next_slot === "P2" ? "P2" : "P1";
              setPbOverlay({
                tossWinner: tw,
                p1Agg: typeof rp.pb_p1_aggregate === "number" ? rp.pb_p1_aggregate : 0,
                p2Agg: typeof rp.pb_p2_aggregate === "number" ? rp.pb_p2_aggregate : 0,
                phase,
                choice: rp.lb_choice === "ban_first" || rp.lb_choice === "choose_first_player" ? rp.lb_choice : null,
                firstPlayer: rp.lb_first_player === "P1" || rp.lb_first_player === "P2" ? rp.lb_first_player : null,
                bans,
                nextSlot,
                coinDueMs: typeof rp.lb_coin_due_ms === "number" ? rp.lb_coin_due_ms : null,
              });
            } else if (!rp.limitbreaker_pending && !rp.protocolbreaker_pending) {
              setPbOverlay(null);
            }
            const rbPayload = (rp.rb_phase_payload && typeof rp.rb_phase_payload === "object") ? rp.rb_phase_payload : {};
            if (
              typeof rp.phase === "string" &&
              ["rb_splash", "rb_coin", "rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "grid_block_warning", "grid_block_selection", "grid_block_waiting", "toss_summary"].includes(rp.phase)
            ) {
              const restoredPhase = rp.phase as Phase;
              setPhase(restoredPhase);
              if (rp.rb_toss_winner === "P1" || rp.rb_toss_winner === "P2") setTossWinner(rp.rb_toss_winner);
              if (rp.rb_coin_result === "PENTA" || rp.rb_coin_result === "PROTO") setCoinResult(rp.rb_coin_result);
              if (rbPayload.firstPlayerChosen !== undefined) setFirstPlayerChosen(String(rbPayload.firstPlayerChosen));
              if (rbPayload.rbC3Blocked !== undefined) setRbC3Blocked(Boolean(rbPayload.rbC3Blocked));
              if (rbPayload.winnerPickedRule !== undefined) setWinnerPickedRule(String(rbPayload.winnerPickedRule));
              if (rbPayload.winnerPickedFirst !== undefined) setWinnerPickedFirst(String(rbPayload.winnerPickedFirst));
              if (rbPayload.winnerPickedC3 !== undefined) setWinnerPickedC3(Boolean(rbPayload.winnerPickedC3));
              if (Array.isArray(rbPayload.rb_banned_patterns)) setRbBannedPatterns(rbPayload.rb_banned_patterns as string[]);
              if (rbPayload.rb6TimerOwner === "P1" || rbPayload.rb6TimerOwner === "P2" || rbPayload.rb6TimerOwner === null) setRb6TimerOwner(rbPayload.rb6TimerOwner as "P1" | "P2" | null);
              if (rbPayload.rb6CellChooser === "P1" || rbPayload.rb6CellChooser === "P2" || rbPayload.rb6CellChooser === null) setRb6CellChooser(rbPayload.rb6CellChooser as "P1" | "P2" | null);
              if (rbPayload.rb6_special_cell && typeof rbPayload.rb6_special_cell === "object") {
                const sc = rbPayload.rb6_special_cell as { r?: unknown; c?: unknown; owner?: unknown };
                if (typeof sc.r === "number" && typeof sc.c === "number" && (sc.owner === "P1" || sc.owner === "P2")) {
                  setRb6SpecialCell({ r: sc.r, c: sc.c, owner: sc.owner });
                }
              }
              if (rbPayload.rbHideBannedPatternFromSlot === "P1" || rbPayload.rbHideBannedPatternFromSlot === "P2") setRbHideBannedPatternFromSlot(rbPayload.rbHideBannedPatternFromSlot);
              if (Array.isArray(rbPayload.rbPatternsPreBan)) setRbPatternsPreBan(rbPayload.rbPatternsPreBan as string[]);
              if (restoredPhase === "toss_summary") {
                const dueMs = typeof rp.rb_auto_start_due_ms === "number" ? rp.rb_auto_start_due_ms : null;
                setSummaryTimer(dueMs ? Math.max(0, (dueMs - Date.now()) / 1000) : 3.5);
              }
            }
          }
          ws.send(JSON.stringify({ type: "player_info", username: p1Name ?? playerSlot ?? "P1", slot: playerSlot }));
            } else if (msg.type === "player_joined") {
          const r = msg.room;
          if (r) {
            const e1 = asNum(r.player1_elo);
            const e2 = asNum(r.player2_elo);
            if (typeof e1 === "number") setP1Elo(e1);
            if (typeof e2 === "number") setP2Elo(e2);
            if (r.player1_banner) setP1Banner(String(r.player1_banner));
            if (r.player2_banner) setP2Banner(String(r.player2_banner));
            if (r.board_mode) setLiveBoardMode(r.board_mode as BoardMode);
            if (r.board_mode === "5x5" && r.awaiting_5x5_rules_ready === true) {
              setRulesMatchGate(true);
              setRulesShowSheet("5x5");
            }
            if (r.board_mode === "6x6" && (r as { awaiting_6x6_rules_ready?: boolean }).awaiting_6x6_rules_ready === true) {
              setRulesMatchGate(true);
              setRulesShowSheet("6x6");
            }
            if (r.board_mode === "7x7" && r.awaiting_7x7_rules_ready === true) {
              setRulesMatchGate(true);
              setRulesShowSheet("7x7");
            }
          }
            } else if (msg.type === "opponent_disconnected") {
          setPhase("match_over");
          setShowDisconnectModal(true);
            } else if (msg.type === "ready_update") {
          if (msg.player === "P1") setP1Ready(msg.ready);
          else setP2Ready(msg.ready);
            } else if (msg.type === "levelup_ready_update") {
          if (msg.player === "P1") setP1LevelUpReady(Boolean(msg.ready));
          else if (msg.player === "P2") setP2LevelUpReady(Boolean(msg.ready));
            } else if (msg.type === "levelup_sync") {
          setP1LevelUpReady(Boolean(msg.p1_ready));
          setP2LevelUpReady(Boolean(msg.p2_ready));
            } else if (msg.type === "levelup_start") {
          awaiting7x7RulesRef.current = false;
          awaiting6x6RulesRef.current = false;
          setRulesShowSheet(null);
          setShow7x7LevelUp(false);
          setShow6x6LevelUp(false);
          setRulesMatchGate(false);
            } else if (msg.type === "rb_extra_turn_update") {
          const et = asNum(msg.extra_turns);
          if (typeof et === "number") setExtraTurns(et);
          if (msg.rb_extra_turn_token_used === true) setRbExtraTurnTokenUsed(true);
            } else if (msg.type === "match_series_complete" || msg.type === "ranked_match_complete") {
          // #region agent log
          fetch('http://127.0.0.1:7852/ingest/44a3777c-2714-4f08-b3ff-de0caf166408',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6fad40'},body:JSON.stringify({sessionId:'6fad40',runId:'run1',hypothesisId:'H2',location:'frontend/components/GameScreen.tsx:1070',message:'received match series complete',data:{phaseBefore:R.current.phase,showRematchBefore:showRematch,hasMatchSeriesComplete:Boolean(matchSeriesComplete)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          const rm = msg as unknown as Partial<MatchSeriesCompletePayload> & { series_winner?: string; format?: string };
          const z = (n: unknown, d: number) => (typeof n === "number" && !Number.isNaN(n) ? n : d);
          void useAuthStore.getState().refreshProfile();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("pp:career-refresh"));
            if (!didPersistLobbyQuoteForSeriesRef.current) {
              didPersistLobbyQuoteForSeriesRef.current = true;
              persistLobbyTauntQuote(lobbyQuoteFromSeriesWinner(String(rm.series_winner ?? "DRAW"), mySlot));
            }
          }
          setShowRematch(false);
          setRematchRequested(null);
          matchSeriesUiLockUntilRef.current = Date.now() + 800;
          isViewingPostMatchRef.current = true;
          setShowGameWinScreen(true);
          setShowRankedMatchResult(false);
          setShowWinOverlay(false);
          setOverlayVisible(false);
          const rmExt = rm as Partial<MatchSeriesCompletePayload> & { p1_career_entry_id?: string; p2_career_entry_id?: string };
          const cid =
            mySlot === "P1"
              ? (typeof rmExt.p1_career_entry_id === "string" ? rmExt.p1_career_entry_id : null)
              : (typeof rmExt.p2_career_entry_id === "string" ? rmExt.p2_career_entry_id : null);
          setMatchSeriesComplete({
            series_winner: String(rm.series_winner ?? "DRAW"),
            format: String(rm.format ?? "ranked"),
            careerEntryId: cid,
            p1: {
              name: String(rm.p1?.name ?? "P1"),
              elo_before: z(rm.p1?.elo_before, 0),
              elo_after: z(rm.p1?.elo_after, 0),
              rr_before: z(rm.p1?.rr_before, 0),
              rr_after: z(rm.p1?.rr_after, 0),
              xp_before: z(rm.p1?.xp_before, 0),
              xp_after: z(rm.p1?.xp_after, 0),
            },
            p2: {
              name: String(rm.p2?.name ?? "P2"),
              elo_before: z(rm.p2?.elo_before, 0),
              elo_after: z(rm.p2?.elo_after, 0),
              rr_before: z(rm.p2?.rr_before, 0),
              rr_after: z(rm.p2?.rr_after, 0),
              xp_before: z(rm.p2?.xp_before, 0),
              xp_after: z(rm.p2?.xp_after, 0),
            },
          });
            } else if (msg.type === "limitbreaker_start") {
          const m = msg as {
            toss_winner?: string;
            p1_aggregate?: number;
            p2_aggregate?: number;
            phase?: string;
            next_slot?: string;
            coin_due_ms?: number;
          };
          const tw = m.toss_winner === "P2" ? "P2" : "P1";
          setPbOverlay({
            tossWinner: tw,
            p1Agg: typeof m.p1_aggregate === "number" ? m.p1_aggregate : 0,
            p2Agg: typeof m.p2_aggregate === "number" ? m.p2_aggregate : 0,
            phase: m.phase === "choice" || m.phase === "choose_first_player" || m.phase === "ban_first" || m.phase === "ban_second" ? m.phase : "coin",
            choice: null,
            firstPlayer: null,
            bans: [],
            nextSlot: m.next_slot === "P2" ? "P2" : tw,
            coinDueMs: typeof m.coin_due_ms === "number" ? m.coin_due_ms : null,
          });
            } else if (msg.type === "limitbreaker_update") {
          const m = msg as { bans?: string[]; next_slot?: string; phase?: string; choice?: string | null; first_player?: string | null; toss_winner?: string; p1_aggregate?: number; p2_aggregate?: number; coin_due_ms?: number | null };
          const bans = Array.isArray(m.bans) ? m.bans : [];
          const ns = m.next_slot === "P2" ? "P2" : "P1";
          setPbOverlay(prev =>
            prev
              ? {
                  ...prev,
                  tossWinner: m.toss_winner === "P2" ? "P2" : prev.tossWinner,
                  p1Agg: typeof m.p1_aggregate === "number" ? m.p1_aggregate : prev.p1Agg,
                  p2Agg: typeof m.p2_aggregate === "number" ? m.p2_aggregate : prev.p2Agg,
                  phase: m.phase === "choice" || m.phase === "choose_first_player" || m.phase === "ban_first" || m.phase === "ban_second" ? m.phase : prev.phase,
                  choice: m.choice === "ban_first" || m.choice === "choose_first_player" ? m.choice : null,
                  firstPlayer: m.first_player === "P1" || m.first_player === "P2" ? m.first_player : null,
                  bans,
                  nextSlot: ns,
                  coinDueMs: typeof m.coin_due_ms === "number" ? m.coin_due_ms : null,
                }
              : null
          );
            } else if (msg.type === "chat_message") {
          setChatMessages(m => [...m.slice(-49), { from: msg.from, text: msg.text, ts: msg.ts }]);
          if (msg.from !== mySlot && !chatVisibleRef.current) {
            setUnreadOpponentChat(c => c + 1);
            setChatToastVisible(true);
            if (chatToastTimerRef.current) clearTimeout(chatToastTimerRef.current);
            chatToastTimerRef.current = setTimeout(() => setChatToastVisible(false), 4000);
          }
            } else if (msg.type === "game_reset") {
          const gr0 = msg as { protocolbreaker_final?: boolean; limitbreaker_final?: boolean };
          if (gr0.protocolbreaker_final || gr0.limitbreaker_final) {
            setPbOverlay(null);
          }
          const gr = msg as { from_5x5_draw_upgrade?: boolean; from_5x5_level_up?: boolean; from_6x6_level_up?: boolean };
          const from55Up = Boolean(gr.from_5x5_draw_upgrade || gr.from_5x5_level_up);
          const from66Up = Boolean(gr.from_6x6_level_up);
          const nextBm = (msg.board_mode as BoardMode | undefined) ?? liveBoardMode;
          const fromLegUpgrade = from55Up || from66Up;
          const is56LevelUp = from55Up && nextBm === "6x6";

          if (is56LevelUp) {
            awaiting6x6RulesRef.current = true;
            awaiting7x7RulesRef.current = false;
            setRulesMatchGate(true);
            setShow6x6LevelUp(true);
            setShow7x7LevelUp(false);
            setRulesShowSheet(null);
            setP1LevelUpReady(false);
            setP2LevelUpReady(false);
            if (levelUpSplashTimerRef.current) clearTimeout(levelUpSplashTimerRef.current);
            levelUpSplashActiveRef.current = true;
            playTransitionAction?.();
            levelUpSplashTimerRef.current = setTimeout(() => {
              levelUpSplashTimerRef.current = null;
              levelUpSplashActiveRef.current = false;
              setShow6x6LevelUp(false);
              if (awaiting6x6RulesRef.current) {
                setRulesShowSheet("6x6");
              }
            }, 2800);
          } else if ((from55Up && nextBm === "7x7") || (from66Up && nextBm === "7x7")) {
            awaiting7x7RulesRef.current = true;
            awaiting6x6RulesRef.current = false;
            setShow6x6LevelUp(false);
            setRulesMatchGate(true);
            if (levelUpSplashTimerRef.current) clearTimeout(levelUpSplashTimerRef.current);
            levelUpSplashActiveRef.current = true;
            setShow7x7LevelUp(true);
            setRulesShowSheet(null);
            setP1LevelUpReady(false);
            setP2LevelUpReady(false);
            playTransitionAction?.();
            levelUpSplashTimerRef.current = setTimeout(() => {
              levelUpSplashTimerRef.current = null;
              levelUpSplashActiveRef.current = false;
              setShow7x7LevelUp(false);
              if (awaiting7x7RulesRef.current) {
                setRulesShowSheet("7x7");
              }
            }, 2800);
          } else {
            awaiting6x6RulesRef.current = false;
            setShow6x6LevelUp(false);
          }
          const gs = nextBm === "7x7" ? 7 : nextBm === "6x6" ? 6 : 5;
          const emptyB = Array(gs).fill(null).map(() => Array(gs).fill(null)) as (string | null)[][];
          if (msg.board_mode) {
            const bm = msg.board_mode as BoardMode;
            setLiveBoardMode(bm);
            onMultiplayerBoardSync?.(bm, Array.isArray(msg.selected_patterns) ? msg.selected_patterns : liveSelectedPatterns);
          }
          if (Array.isArray(msg.selected_patterns)) setLiveSelectedPatterns(msg.selected_patterns);
          if (nextBm === "7x7") {
            const m7 = msg as { selected_patterns_p1?: unknown; selected_patterns_p2?: unknown; preserve_rb_hide?: boolean };
            if (Array.isArray(m7.selected_patterns_p1) && Array.isArray(m7.selected_patterns_p2)) {
              setServerStructuralPatternsP1(m7.selected_patterns_p1 as string[]);
              setServerStructuralPatternsP2(m7.selected_patterns_p2 as string[]);
            } else if (!m7.preserve_rb_hide) {
              setServerStructuralPatternsP1(null);
              setServerStructuralPatternsP2(null);
            }
          } else {
            setServerStructuralPatternsP1(null);
            setServerStructuralPatternsP2(null);
          }
          setBoard(emptyB);
          setCurrent(msg.first_player);
          setMovesPlayed(0);
          setExtraTurns(0);
          setWinner(null);
          setWinLine([]);
          setShowWinOverlay(false);
          setOverlayVisible(false);
          setC3Blocked(msg.c3_blocked ?? false);
          setSuppressCenterOpening(Boolean(msg.suppress_center_opening));
          {
            const h = msg.rb_extra_turn_token_holder;
            setRbExtraTurnTokenHolder(h === "P1" || h === "P2" ? h : null);
          }
          setRbExtraTurnTokenUsed(Boolean(msg.rb_extra_turn_token_used));
          const grm = msg as {
            preserve_rb_hide?: boolean;
            rb_hide_banned_from_slot?: unknown;
            rb_patterns_pre_ban?: unknown;
            rb_banned_patterns?: unknown;
            rb_banned_pattern?: unknown;
            rb6_timer_owner?: unknown;
            rb6_special_cell?: unknown;
          };
          {
            if (grm.preserve_rb_hide === true) {
              const hs = grm.rb_hide_banned_from_slot;
              setRbHideBannedPatternFromSlot(hs === "P1" || hs === "P2" ? hs : null);
              if (Array.isArray(grm.rb_patterns_pre_ban)) {
                setRbPatternsPreBan(grm.rb_patterns_pre_ban as string[]);
              }
              if (Array.isArray(grm.rb_banned_patterns)) {
                setRbBannedPatterns(grm.rb_banned_patterns);
              } else if (typeof grm.rb_banned_pattern === "string") {
                setRbBannedPatterns([grm.rb_banned_pattern]);
              }
            } else {
              setRbHideBannedPatternFromSlot(null);
              setRbPatternsPreBan(null);
              setRbBannedPatterns([]);
            }
          }
          setLog([]);
          const mtm = nextBm === "7x7" ? 300_000 : nextBm === "6x6" ? 240_000 : 180_000;
          setP1Time(mtm);
          setP2Time(mtm);
          p1TimeRef.current = mtm;
          p2TimeRef.current = mtm;
          if (nextBm === "6x6" && (grm.rb6_timer_owner === "P1" || grm.rb6_timer_owner === "P2")) {
            setRb6TimerOwner(grm.rb6_timer_owner);
            if (grm.rb6_timer_owner === "P1") {
              setP1Time(120_000);
              p1TimeRef.current = 120_000;
            } else {
              setP2Time(120_000);
              p2TimeRef.current = 120_000;
            }
          } else {
            setRb6TimerOwner(null);
          }
          if (grm.rb6_special_cell && typeof grm.rb6_special_cell === "object") {
            const sc = grm.rb6_special_cell as { r?: unknown; c?: unknown; owner?: unknown };
            if (typeof sc.r === "number" && typeof sc.c === "number" && (sc.owner === "P1" || sc.owner === "P2")) {
              setRb6SpecialCell({ r: sc.r, c: sc.c, owner: sc.owner });
            } else {
              setRb6SpecialCell(null);
            }
          } else {
            setRb6SpecialCell(null);
          }
          lastP1Sec.current = -1;
          lastP2Sec.current = -1;
          setP1Ready(false);
          setP2Ready(false);
          setShowRematch(false);
          setRematchRequested(null);
          if (Date.now() >= matchSeriesUiLockUntilRef.current) {
            isViewingPostMatchRef.current = false;
            setShowGameWinScreen(false);
            setShowRankedMatchResult(false);
            setMatchSeriesComplete(null);
          }
          setPhase("playing");
          const incomingGame = msg.game_number ?? 1;
          if (incomingGame === 1) {
            if (fromLegUpgrade) {
              if (typeof msg.segment_start_index === "number") {
                setSegmentStartIndex(msg.segment_start_index);
                segmentStartIndexRef.current = msg.segment_start_index;
              }
              if (typeof msg.history_display_start_index === "number") {
                setHistoryDisplayStartIndex(msg.history_display_start_index);
                historyDisplayStartIndexRef.current = msg.history_display_start_index;
              }
              if (typeof msg.p1_series_points === "number") setP1SeriesPts(msg.p1_series_points);
              if (typeof msg.p2_series_points === "number") setP2SeriesPts(msg.p2_series_points);
              setGameNumber(1);
              if (!is56LevelUp) {
                setP1LevelUpReady(false);
                setP2LevelUpReady(false);
              }
              setMatchOver(false);
              setSeriesWinner(null);
              awaitingRulebreakerRef.current = false;
              // Full match_history is kept; series points are match-wide (segment_start_index is for display scoping only)
            } else {
              if (msg.last_series) {
                setLastSeries(msg.last_series);
              } else {
                setLastSeries({ winner: seriesWinner, history: [...matchHistory] });
              }
              matchHistoryRef.current = [];
              setMatchHistory([]);
              setGameNumber(1);
              setMatchOver(false);
              setSeriesWinner(null);
              setChatMessages([]);
              setUnreadOpponentChat(0);
              setChatToastVisible(false);
              setP1SeriesPts(0);
              setP2SeriesPts(0);
              awaitingRulebreakerRef.current = false;
              setSegmentStartIndex(0);
              segmentStartIndexRef.current = 0;
              setHistoryDisplayStartIndex(0);
              historyDisplayStartIndexRef.current = 0;
              if ((msg as { awaiting_5x5_rules_ready?: boolean }).awaiting_5x5_rules_ready) {
                setRulesMatchGate(true);
                setP1LevelUpReady(false);
                setP2LevelUpReady(false);
                setRulesShowSheet("5x5");
              } else {
                setRulesShowSheet(null);
                setRulesMatchGate(false);
              }
            }
          } else {
            if (msg.game_number) setGameNumber(msg.game_number);
            if (typeof msg.segment_start_index === "number") {
              setSegmentStartIndex(msg.segment_start_index);
              segmentStartIndexRef.current = msg.segment_start_index;
            }
            if (typeof msg.history_display_start_index === "number") {
              setHistoryDisplayStartIndex(msg.history_display_start_index);
              historyDisplayStartIndexRef.current = msg.history_display_start_index;
            }
            if (typeof msg.p1_series_points === "number") setP1SeriesPts(msg.p1_series_points);
            if (typeof msg.p2_series_points === "number") setP2SeriesPts(msg.p2_series_points);
          }
        } else if (msg.type === "series_resolved") {
          const h = (msg.match_history as any[] | undefined) ?? matchHistoryRef.current;
          matchHistoryRef.current = h;
          setMatchHistory([...h]);
          if (typeof msg.p1_series_points === "number") setP1SeriesPts(msg.p1_series_points);
          if (typeof msg.p2_series_points === "number") setP2SeriesPts(msg.p2_series_points);
          if (typeof msg.segment_start_index === "number") {
            setSegmentStartIndex(msg.segment_start_index);
            segmentStartIndexRef.current = msg.segment_start_index;
          }
          if (typeof msg.history_display_start_index === "number") {
            setHistoryDisplayStartIndex(msg.history_display_start_index);
            historyDisplayStartIndexRef.current = msg.history_display_start_index;
          }
          awaitingRulebreakerRef.current = false;
          setSeriesWinner(msg.series_winner as string);
          setMatchOver(true);
          setPhase("match_over");
          setShowWinOverlay(false);
          setOverlayVisible(false);
          wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
        } else if (msg.type === "match_over") {
          // #region agent log
          fetch('http://127.0.0.1:7852/ingest/44a3777c-2714-4f08-b3ff-de0caf166408',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6fad40'},body:JSON.stringify({sessionId:'6fad40',runId:'run1',hypothesisId:'H1',location:'frontend/components/GameScreen.tsx:1364',message:'received match_over',data:{phaseBefore:R.current.phase,showRematchBefore:showRematch,hasMatchSeriesComplete:Boolean(matchSeriesComplete)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (!isMultiplayerGame && !showGameWinScreen && !matchSeriesComplete) setShowRematch(true);
        } else if (msg.type === "rematch_request") {
          setRematchRequested(msg.from);
        } else if (msg.type === "match_disbanded") {
          void useAuthStore.getState().refreshProfile();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("pp:career-refresh"));
          }
          if (!isViewingPostMatchRef.current) {
            if (setScreenAction) setScreenAction("home");
          }
        } else if (msg.type === "match_start") {
          const sa = asNum(msg.start_at_ms);
          if (typeof sa === "number") setMatchStartAtMs(sa);
        } else if (msg.type === "net_update") {
          const a = asNum(msg.p1_rtt_ms);
          const b = asNum(msg.p2_rtt_ms);
          if (typeof a === "number") setP1RttMs(a); else if (msg.p1_rtt_ms === null) setP1RttMs(null);
          if (typeof b === "number") setP2RttMs(b); else if (msg.p2_rtt_ms === null) setP2RttMs(null);
        } else if (msg.type === "toss_action") {
          const { action, payload } = msg;
          if (action === "start_rb") {
            const _curPhase = R.current.phase;
            const _rbPhases = ["rb_splash", "rb_coin", "rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "grid_block_warning", "grid_block_selection", "grid_block_waiting", "toss_summary"];
            if (_rbPhases.includes(_curPhase)) {
              // already in rulebreaker
            } else setTimeout(() => {
              setWinner(null); setWinLine([]); setShowWinOverlay(false); setOverlayVisible(false);
              setPhase("rb_splash"); setRbSplashTimer(5);
              setCoinFlipTimer(rbCoinFlipSeconds); setCoinRevealTimer(0); setCoinResult(null);
              coinAngleRef.current = 0; coinFrameRef.current = 0; setCoinAngle(0);
              coinStartTimeRef.current = 0; // will be set when rb_coin phase starts
              setTossWinner(null); setFirstPlayerChosen(null); setRbC3Blocked(false); setRbBannedPatterns([]);
              setWinnerPickedRule(null); setWinnerPickedFirst(null); setWinnerPickedC3(null);
              setRbHideBannedPatternFromSlot(null); setRbPatternsPreBan(null);
              playRulebreakerAction?.();
            }, 200);
          } else if (action === "coin_result") {
            setCoinResult(payload.result);
            setTossWinner(payload.toss_winner);
            // Only start reveal timer if we are already in rb_coin or further.
            // If we are still in rb_splash, the tick function will start it when we enter rb_coin.
            if (R.current.phase === "rb_coin") {
              setCoinRevealTimer(3.5);
            }
            coinAngleRef.current = 0;
            setCoinAngle(0);
          } else if (action === "phase_choice") {
            if (payload.phase) {
              let ph = payload.phase as Phase;
              if (
                ph === "grid_block_selection" &&
                isMultiplayerGame &&
                (payload.rb6CellChooser === "P1" || payload.rb6CellChooser === "P2") &&
                mySlot &&
                payload.rb6CellChooser !== mySlot
              ) {
                ph = "grid_block_waiting";
              }
              setPhase(ph);
            }
            if (payload.firstPlayerChosen !== undefined) setFirstPlayerChosen(payload.firstPlayerChosen);
            if (payload.rbC3Blocked !== undefined) setRbC3Blocked(payload.rbC3Blocked);
            if (payload.summaryTimer !== undefined) setSummaryTimer(payload.summaryTimer);
            if (payload.winnerPickedRule !== undefined) setWinnerPickedRule(payload.winnerPickedRule);
            if (payload.winnerPickedFirst !== undefined) setWinnerPickedFirst(payload.winnerPickedFirst);
            if (payload.winnerPickedC3 !== undefined) setWinnerPickedC3(payload.winnerPickedC3);
            if (Array.isArray(payload.rb_banned_patterns)) setRbBannedPatterns(payload.rb_banned_patterns);
            else if (payload.rb_banned_pattern !== undefined) setRbBannedPatterns([payload.rb_banned_pattern]);
            if (payload.rb6TimerOwner === "P1" || payload.rb6TimerOwner === "P2" || payload.rb6TimerOwner === null) {
              setRb6TimerOwner(payload.rb6TimerOwner);
              if (payload.rb6TimerOwner === "P1") {
                p1TimeRef.current = 120_000;
                setP1Time(120_000);
              } else if (payload.rb6TimerOwner === "P2") {
                p2TimeRef.current = 120_000;
                setP2Time(120_000);
              }
            }
            if (payload.rb6CellChooser === "P1" || payload.rb6CellChooser === "P2" || payload.rb6CellChooser === null) setRb6CellChooser(payload.rb6CellChooser);
            if (payload.rb6_special_cell && typeof payload.rb6_special_cell === "object") {
              const sc = payload.rb6_special_cell as { r?: unknown; c?: unknown; owner?: unknown };
              const rr = sc.r;
              const cc = sc.c;
              const ow = sc.owner;
              if (typeof rr === "number" && typeof cc === "number" && (ow === "P1" || ow === "P2")) {
                setRb6SpecialCell({ r: rr, c: cc, owner: ow });
              }
            }
            if (payload.rbHideBannedPatternFromSlot !== undefined) {
              const s = payload.rbHideBannedPatternFromSlot;
              setRbHideBannedPatternFromSlot(s === "P1" || s === "P2" ? s : null);
            }
            if (Array.isArray(payload.rbPatternsPreBan)) setRbPatternsPreBan(payload.rbPatternsPreBan as string[]);
          }
        } else if (msg.type === "pong") {
          const sentTs = asNum(msg.ts ?? pingOutstandingRef.current);
          if (typeof sentTs === "number") {
            const rtt = Math.max(0, Date.now() - sentTs);
            // Update local slot RTT; server broadcast updates both
            if (mySlot === "P1") setP1RttMs(rtt); else setP2RttMs(rtt);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "net_report", rtt_ms: rtt }));
            }
          }
        }
          });
      };

      ws.onclose = () => {
        if (destroyed) return;
        if (wsPingRef.current) { clearInterval(wsPingRef.current); wsPingRef.current = null; }
        reconnectTimeout = setTimeout(connect, 2000);
      };

      const ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
      pingRef.current = ping;
    };

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (wsPingRef.current) { clearInterval(wsPingRef.current); wsPingRef.current = null; }
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [isMultiplayerGame, roomCode, playerSlot]);

  // Multiplayer match-found synchronization: tell server when we're ready to start.
  useEffect(() => {
    if (!isMultiplayerGame) return;
    if (!showMatchupOverlay) return;
    if (sentMatchReadyRef.current) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "match_found_ready" }));
    sentMatchReadyRef.current = true;
  }, [isMultiplayerGame, showMatchupOverlay]);

  // ── Bot move trigger ──────────────────────────────────────────────────────
  const botTurnKey = `${current}-${extraTurns}-${movesPlayed}`;

  useEffect(() => {
    if (gameMode !== "ai") return;
    if (phase !== "playing") return;
    if (current !== "P2") return;
    if (winner) return;

    let cancelled = false;
    const boardNow = boardRef.current;
    const is77Now = boardNow?.length === 7;
    const is66Now = boardNow?.length === 6;
    const instantBotBoards = is66Now || is77Now;
    const isFastPath = !is77Now || is66Now;
    // Cosmetic delay before calling API (server search unchanged). DANGER 7×7: extra minimum
    // “think” time for the bot’s first two moves so it doesn’t feel instant vs HARD.
    const delays: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      danger: 0,
      normal: 0,
      machine_god: 0,
    };
    const delay = delays[difficulty] ?? 0;

    setBotThinking(true);

    const runBotMove = async () => {
      if (cancelled) return;
      try {
        const b = boardRef.current;
        let p2Stones = 0;
        for (const row of b) for (const cell of row) if (cell === "P2") p2Stones++;
        const is77 = b?.length === 7;
        const res = await API.post("/api/bot/move", {
          board: b, difficulty, current_player: "P2",
          board_mode: liveBoardMode || (b?.length === 7 ? "7x7" : "5x5"),
          selected_patterns: structuralPatternsP2,
          c3_blocked: c3Blocked,
          moves_played: movesPlayedRef.current,
        });
        if (cancelled) return;
        botApiRetryAfterRef.current = 0;
        botApiWarnedRef.current = false;
        if (cancelled) return;
        const { row, col } = res.data ?? res;
        if (typeof row === "number" && typeof col === "number") {
          await placeBot(row, col);
        } else {
          // Recover from transient empty/null bot responses without deadlocking the AI turn.
          botApiRetryAfterRef.current = Date.now() + (instantBotBoards ? 0 : (isFastPath ? 350 : 700));
          if (!botApiWarnedRef.current) {
            setLog(l => [...l.slice(-19), { text: "BOT returned no move. Retrying...", player: "BOT" }]);
            botApiWarnedRef.current = true;
          }
        }
      } catch (err) {
        botApiRetryAfterRef.current = Date.now() + (instantBotBoards ? 0 : (isFastPath ? 350 : 2500));
        if (!botApiWarnedRef.current) {
          setLog(l => [...l.slice(-19), { text: "BOT service unavailable. Retrying shortly...", player: "BOT" }]);
          botApiWarnedRef.current = true;
        }
        console.error("Bot move failed:", err);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    };

    const retryRemaining = botApiRetryAfterRef.current - Date.now();
    if (retryRemaining > 0) {
      setBotThinking(true);
      const retryTimer = setTimeout(runBotMove, Math.max(80, retryRemaining));
      return () => { cancelled = true; clearTimeout(retryTimer); setBotThinking(false); };
    }

    const shouldRunNow = instantBotBoards || isFastPath;
    const timer = shouldRunNow ? null : setTimeout(runBotMove, delay);
    if (shouldRunNow) {
      runBotMove();
    }

    return () => { cancelled = true; if (timer) clearTimeout(timer); setBotThinking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botTurnKey, phase, winner, gameMode, liveBoardMode, GRID_SIZE, structuralPatternsP2, difficulty]);

  const initBoard = async (firstPlayer: string, c3block = false, suppressCenter = false) => {
    setSuppressCenterOpening(suppressCenter);
    setRbExtraTurnTokenHolder(null);
    setRbExtraTurnTokenUsed(false);
    if (R.current.gameNumber < 3) {
      setRb6SpecialCell(null);
      setRb6TimerOwner(null);
      setRb6CellChooser(null);
    }
    setBoard(emptyBoard());
    setCurrent(firstPlayer);
    setWinner(null);
    setWinLine([]);
    setShowWinOverlay(false);
    setOverlayVisible(false);
    setMovesPlayed(0);
    setExtraTurns(0);
    setC3Blocked(c3block);
    setLog([]);
    p1TimeRef.current = matchTimeMs;
    p2TimeRef.current = matchTimeMs;
    lastP1Sec.current = -1;
    lastP2Sec.current = -1;
    setP1Time(matchTimeMs);
    setP2Time(matchTimeMs);
    if (GRID_SIZE === 6 && R.current.gameNumber === 3 && R.current.rb6TimerOwner) {
      if (R.current.rb6TimerOwner === "P1") {
        p1TimeRef.current = 120_000;
        setP1Time(120_000);
      } else {
        p2TimeRef.current = 120_000;
        setP2Time(120_000);
      }
    }
    setLoading(false);
    setHover(null);
    setBotThinking(false);
    try {
      const res = await API.post("/api/game/create", { mode: "solo", format: "bo3" });
      setGameId(res.data.game_id);
    } catch { setGameId(null); }
  };

  const sendChat = (from: "P1" | "P2") => {
    const text = chatInput.trim();
    if (!text) return;
    if (containsProfanity(text)) { setChatWarning(true); setTimeout(() => setChatWarning(false), 3000); }
    const censored = censorText(text);
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "chat", text: censored, ts: Date.now() }));
    } else {
      setChatMessages(m => [...m.slice(-49), { from, text: censored, ts: Date.now() }]);
    }
    setChatInput("");
  };

  const softReset = () => {
    matchHistoryRef.current = []; setGameNumber(1); setMatchHistory([]); setMatchOver(false); setSeriesWinner(null);
    setP1SeriesPts(0); setP2SeriesPts(0); awaitingRulebreakerRef.current = false;
    setSegmentStartIndex(0); segmentStartIndexRef.current = 0;
    setHistoryDisplayStartIndex(0); historyDisplayStartIndexRef.current = 0;
    setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0);
    setRbSplashTimer(5); setCoinFlipTimer(rbCoinFlipSeconds); setCoinRevealTimer(0); setCoinResult(null);
    setCoinAngle(0); setTossWinner(null); setFirstPlayerChosen(null); setRbC3Blocked(false); setRbBannedPatterns([]);
    setSummaryTimer(5); setOverlayVisible(false); setChoiceTimer(0);
    setShowRematch(false); setRematchRequested(null);
    isViewingPostMatchRef.current = false;
    setShowGameWinScreen(false); setShowRankedMatchResult(false); setMatchSeriesComplete(null);
    setWinnerPickedRule(null); setWinnerPickedFirst(null); setWinnerPickedC3(null);
    setRbHideBannedPatternFromSlot(null); setRbPatternsPreBan(null);
    setServerStructuralPatternsP1(null); setServerStructuralPatternsP2(null);
    setRb6SpecialCell(null);
    setRb6TimerOwner(null); setRb6CellChooser(null);
    setPhase("playing");
    initBoard("P1");
  };

  const checkSeriesWinner = (hist: any[]): string | null => {
    const { p1: p1_pts, p2: p2_pts } = seriesPointsFromHistory(hist);

    if (p1_pts + EPS >= 5) return "P1";
    if (p2_pts + EPS >= 5) return "P2";

    if (hist.length >= 9) {
      if (p1_pts > p2_pts + EPS) return "P1";
      if (p2_pts > p1_pts + EPS) return "P2";
      return null;
    }

    return null;
  };

  useEffect(() => {
    const dur = PHASE_TIMERS[phase];
    if (dur !== undefined) { choiceTimerRef.current = dur; lastChoiceSec.current = dur; setChoiceTimer(dur); }
  }, [phase]);

  const lastTick = useRef(Date.now());
  const rafHandle = useRef(0);
  const choiceTimerRef = useRef(0);
  const lastChoiceSec = useRef(-1);
  const lastP1Sec = useRef(-1);
  const lastP2Sec = useRef(-1);
  const lastMatchupSec = useRef(-1);

  useEffect(() => {
    const tossChoicePhases: Phase[] = ["rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "grid_block_warning", "grid_block_selection", "grid_block_waiting"];
    const tick = () => {
      rafHandle.current = requestAnimationFrame(tick);
      const now = Date.now();
      const dt = now - lastTick.current;
      lastTick.current = now;
      const s = R.current;
      if (showMatchupOverlay) {
        // In multiplayer, wait for server-issued start_at_ms so both clients begin simultaneously.
        if (isMultiplayerGame) {
          if (matchStartAtMs && Date.now() >= matchStartAtMs) {
            setShowMatchupOverlay(false);
          } else {
            const remaining = matchStartAtMs ? Math.max(0, (matchStartAtMs - Date.now()) / 1000) : 60;
            const sec = Math.ceil(remaining);
            if (sec !== lastMatchupSec.current) {
              lastMatchupSec.current = sec;
              setMatchupCountdown(remaining);
            }
          }
        } else {
          matchupCountdownRef.current = Math.max(0, matchupCountdownRef.current - dt / 1000);
          if (matchupCountdownRef.current <= 0) {
            setShowMatchupOverlay(false);
          } else {
            const sec = Math.ceil(matchupCountdownRef.current);
            if (sec !== lastMatchupSec.current) {
              lastMatchupSec.current = sec;
              setMatchupCountdown(matchupCountdownRef.current);
            }
          }
        }
      }
      const freePhases = ["waiting_ready", "rb_splash", "rb_coin"];
      if (s.winner && !freePhases.includes(s.phase)) return;
      // Rulebreaker choice timers (incl. 6x6 grid cell picker) must tick even when pausedRef is true
      // (e.g. exit modal), so they run before the pause guard below.
      if (tossChoicePhases.includes(s.phase) && s.choiceTimer > 0) {
        choiceTimerRef.current -= dt / 1000;
        if (choiceTimerRef.current <= 0) { choiceTimerRef.current = 0; setChoiceTimer(0); autoPickLeft(s.phase); }
        else { const sec = Math.ceil(choiceTimerRef.current); if (sec !== lastChoiceSec.current) { lastChoiceSec.current = sec; setChoiceTimer(choiceTimerRef.current); } }
      }
      if (pausedRef.current && !freePhases.includes(s.phase)) return;

      if (s.phase === "playing" && !s.winner) {
        const blockMpClock =
          isMultiplayerGame &&
          (rulesShowSheetRef.current !== null || show7x7LevelUpRef.current || show6x6LevelUpRef.current || rulesMatchGateRef.current);
        if (blockMpClock) {
          /* multiplayer rules gate or level-up splash — clocks stay frozen */
        } else if (s.current === "P1") {
          p1TimeRef.current = Math.max(0, p1TimeRef.current - dt);
          const p1Sec = Math.ceil(p1TimeRef.current / 1000);
          if (p1Sec !== lastP1Sec.current) {
            lastP1Sec.current = p1Sec;
            setP1Time(p1TimeRef.current);
          }
          if (p1TimeRef.current <= 0 && !s.winner) {
            const w = "P2";
            setWinner(w);
            if (isMultiplayerGame) {
              wsRef.current?.send(JSON.stringify({ type: "timeout", winner: w }));
              playDefeatAction?.();
              requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
              // Authoritative series state arrives on the next `move_made` from the server.
            }
          }
        } else {
          p2TimeRef.current = Math.max(0, p2TimeRef.current - dt);
          const p2Sec = Math.ceil(p2TimeRef.current / 1000);
          if (p2Sec !== lastP2Sec.current) {
            lastP2Sec.current = p2Sec;
            setP2Time(p2TimeRef.current);
          }
          if (p2TimeRef.current <= 0 && !s.winner) {
            const w = "P1";
            setWinner(w);
            if (isMultiplayerGame) {
              wsRef.current?.send(JSON.stringify({ type: "timeout", winner: w }));
              playVictoryAction?.();
              requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
              // Authoritative series state arrives on the next `move_made` from the server.
            }
          }
        }
      }

      if (s.phase === "waiting_ready") {
        if (!s.p1Ready || !s.p2Ready) {
          setReadyTimeout(v => {
            const nv = v - dt / 1000;
            if (nv <= 0) {
              // Multiplayer: send ready via WS so server stays in sync
              if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "ready", ready: true }));
              }
              setP1Ready(true); setP2Ready(true); setReadyTimer(1);
              return 0;
            }
            return nv;
          });
        } else if (s.readyTimer > 0) {
          setReadyTimer(v => { const nv = v - dt / 1000; if (nv <= 0) { doAdvanceAfterReady(); return 0; } return nv; });
        }
      }
      if (s.phase === "rb_splash") setRbSplashTimer(v => { const nv = v - dt / 1000; if (nv <= 0) { coinStartTimeRef.current = Date.now(); setPhase("rb_coin"); return 5; } return nv; });
      if (s.phase === "rb_coin") {
        if (!s.coinResult) {
          // Coin spin is handled in RulebreakerFlow with a GPU-friendly CSS 3D animation.
          if (!isMultiplayerGame || mySlot === "P1") {
            setCoinFlipTimer(v => {
              const nv = v - dt / 1000;
              if (nv <= 0) {
                const r = rbCoinPendingRef.current ?? (Math.random() < 0.5 ? "PENTA" : "PROTO");
                rbCoinPendingRef.current = null;
                setRbCoinPendingResult(null);
                setCoinResult(r);
                setTossWinner(r === "PENTA" ? "P1" : "P2");
                setCoinRevealTimer(3.5);
                coinAngleRef.current = 0;
                setCoinAngle(0);
                if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "toss_action", action: "coin_result", payload: { result: r, toss_winner: r === "PENTA" ? "P1" : "P2" } }));
                }
                return 0;
              }
              return nv;
            });
          }
        } else {
          if (coinFlipTimer === 0 && coinRevealTimer === 0) {
            setCoinRevealTimer(3.5);
          }
          setCoinRevealTimer(v => { const nv = v - dt / 1000; if (nv <= 0) { setPhase("rule_choice"); return 0; } return nv; });
        }
      }
      if (s.phase === "toss_summary") {
        setSummaryTimer(v => {
          const nv = v - dt / 1000;
          if (nv > 0 && nv <= 0.5) {
            // Initiate board load 0.5s before overlay fades out
            if (R.current.summaryTimer > 0.5) {
                const fp = s.firstPlayerChosen ?? s.tossWinner ?? "P1";
                const _isMP2 = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
                if (!_isMP2) {
                  const wr = R.current.winnerPickedRule;
                  const tw = R.current.tossWinner;
                  const supC = wr === "extra_turn";
                  initBoard(fp, s.rbC3Blocked, supC);
                  unstable_batchedUpdates(() => {
                    if (wr === "extra_turn" && (tw === "P1" || tw === "P2")) {
                      setRbExtraTurnTokenHolder(tw);
                      setRbExtraTurnTokenUsed(false);
                    }
                  });
                }
            }
          }
          if (nv <= 0) {
            const fp = s.firstPlayerChosen ?? s.tossWinner ?? "P1";
            const _isMP2 = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
            if (_isMP2) {
              const { p1, p2 } = seriesPtsRef.current;
              const seriesAlreadyDecided = (p1 >= 5 && p1 > p2) || (p2 >= 5 && p2 > p1);
              if (s.tossWinner === mySlot) {
                if (seriesAlreadyDecided) {
                  wsRef.current?.send(JSON.stringify({ type: "rb_start_game", resolve_series_only: true }));
                } else {
                  const wr = R.current.winnerPickedRule;
                  const tw = R.current.tossWinner;
                  wsRef.current?.send(JSON.stringify({
                    type: "rb_start_game",
                    first_player: fp,
                    c3_blocked: s.rbC3Blocked,
                    selected_patterns: liveSelectedPatternsRef.current,
                    selected_patterns_p1: structuralPatternsP1Ref.current,
                    selected_patterns_p2: structuralPatternsP2Ref.current,
                    suppress_center_opening: wr === "extra_turn",
                    rb_extra_turn_token_holder: wr === "extra_turn" && (tw === "P1" || tw === "P2") ? tw : null,
                    rb_hide_banned_from_slot: R.current.rbHideBannedPatternFromSlot,
                    rb_patterns_pre_ban: R.current.rbPatternsPreBan,
                    rb_banned_patterns: R.current.rbBannedPatterns,
                    rb6_special_cell: R.current.rb6SpecialCell,
                    rb6TimerOwner: R.current.rb6TimerOwner,
                  }));
                }
              }
              setPhase("rb_initializing");
            } else {
              setGameNumber(3); setPhase("rb_initializing");
              // Auto-advance after 2.5s in singleplayer/AI
              setTimeout(() => {
                setPhase("playing");
              }, 2500);
            }
            return 0;
          } return nv;
        });
      }
    };
    rafHandle.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafHandle.current);
  }, []);

  const autoPickLeft = (p: Phase) => {
    const tw = R.current.tossWinner;
    const tl = tw === "P1" ? "P2" : "P1";
    const patList = liveSelectedPatternsRef.current;
    if (p === "rule_choice") {
      if (is7x7 && tw) {
        setWinnerPickedRule("extra_turn");
        setRbPatternsPreBan([...patList]);
        setRbHideBannedPatternFromSlot(tw);
        setPhase("ban_pattern_loser");
      } else if (is6x6 && tw) {
        setWinnerPickedRule("timer_half");
        setRb6TimerOwner(tw);
        setRb6CellChooser(tw);
        setPhase("grid_block_warning");
      } else if (!is7x7 && !is6x6) { setPhase("who_first_winner"); }
    }
    else if (p === "grid_block_warning") {
      setPhase("grid_block_selection");
    }
    else if (p === "grid_block_selection") {
      if (R.current.rb6CellChooser) {
        const fallbackCell = { r: 2, c: 2, owner: R.current.rb6CellChooser };
        setRb6SpecialCell(fallbackCell);
        if (R.current.winnerPickedRule === "timer_half") {
          if (R.current.rb6CellChooser === "P1") {
            p1TimeRef.current = 120_000;
            setP1Time(120_000);
          } else {
            p2TimeRef.current = 120_000;
            setP2Time(120_000);
          }
          setPhase("who_first_loser");
          if (isMultiplayerGame) {
            broadcastTossPhase("who_first_loser", {
              rb6_special_cell: fallbackCell,
              winnerPickedRule: R.current.winnerPickedRule,
              rb6TimerOwner: R.current.rb6CellChooser,
            });
          }
        } else {
          setSummaryTimer(5);
          setPhase("toss_summary");
          if (isMultiplayerGame) {
            broadcastTossPhase("toss_summary", {
              rb6_special_cell: fallbackCell,
              rb6TimerOwner: R.current.rb6TimerOwner,
              summaryTimer: 5,
            });
          }
        }
      }
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tw);
      if (is6x6 && tw) {
        const forcedOther = tw === "P1" ? "P2" : "P1";
        setRb6TimerOwner(forcedOther);
        setRb6CellChooser(forcedOther);
        setWinnerPickedRule("choose_first");
        setPhase("grid_block_selection");
      } else {
        setPhase("c3_choice_loser");
      }
    }
    else if (p === "c3_choice") { setRbC3Blocked(true); setPhase("who_first_loser"); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(true); setSummaryTimer(5); setPhase("toss_summary"); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tl); setSummaryTimer(5); setPhase("toss_summary"); }
    else if (p === "ban_pattern_winner") {
      const first = patList[0] ?? null;
      if (first) onBanPattern(first);
    }
    else if (p === "ban_pattern_loser") {
      const first = patList[0] ?? null;
      if (first) onBanPattern(first);
    }
  };
  const doAdvanceAfterReady = () => {
    const gn = R.current.gameNumber;
    if (R.current.matchOver) return;
    setWinner(null);
    setShowWinOverlay(false);
    setOverlayVisible(false);

    if (isMultiplayerGame) {
      if (awaitingRulebreakerRef.current && gn >= 2) {
        if (mySlot === "P1") {
          const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
          const payload = {
            result: r,
            toss_winner: r === "PENTA" ? "P1" : "P2",
          };
          wsRef.current?.send(
            JSON.stringify({ type: "toss_action", action: "start_rb", payload })
          );
        }
      }
      return;
    }

    // AI / Singleplayer match flow logic
    const nextGameNum = gn + 1;
    const isEndOfLeg = gn === 3 || gn === 6;

    if (isEndOfLeg) {
      // Escalate board size
      const currentBm = liveBoardMode;
      const nextBm: BoardMode = currentBm === "5x5" ? "6x6" : "7x7";
      setLiveBoardMode(nextBm);
      setGameNumber(nextGameNum);

      if (nextBm === "6x6") {
        setShow6x6LevelUp(true);
        playTransitionAction?.();
        setTimeout(() => {
          setShow6x6LevelUp(false);
          setPhase("playing");
          initBoard("P1");
        }, 2800);
      } else {
        setShow7x7LevelUp(true);
        playTransitionAction?.();
        setTimeout(() => {
          setShow7x7LevelUp(false);
          setPhase("playing");
          initBoard("P1");
        }, 2800);
      }
    } else if (gn === 2 || gn === 5 || gn === 8) {
      // Transition to Rulebreaker (Game 3, 6, 9)
      setRb6SpecialCell(null);
      setRb6TimerOwner(null);
      setRb6CellChooser(null);
      setGameNumber(nextGameNum);
      setPhase("rb_splash");
      playRulebreakerAction?.();
      setRbSplashTimer(5);
      setCoinFlipTimer(rbCoinFlipSeconds);
      setCoinRevealTimer(0);
      setCoinResult(null);
      setCoinAngle(0);
      setTossWinner(null);
      setFirstPlayerChosen(null);
      setRbC3Blocked(false);
      setRbBannedPatterns([]);
      setSummaryTimer(5);
      setRbHideBannedPatternFromSlot(null);
      setRbPatternsPreBan(null);
    } else {
      // Next normal game (e.g., G1 -> G2, G4 -> G5, G7 -> G8)
      setGameNumber(nextGameNum);
      setPhase("playing");
      // Alternate starting player for normal games in the same leg
      initBoard(gn % 2 === 1 ? "P2" : "P1");
    }
  };

  useEffect(() => {
    if (!winner) return;
    const _isMP = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
    if (_isMP) return;
    if (phase !== "playing") return;
    if (winner === "P1") playVictoryAction?.(); else if (winner === "P2") playDefeatAction?.();
    const newHist = [...R.current.matchHistory, winner];
    // keep ref in sync immediately so checkSeriesWinner sees the updated history
    R.current.matchHistory = newHist;
    matchHistoryRef.current = newHist;
    setMatchHistory(newHist);
    const sw = checkSeriesWinner(newHist);
    const seriesWinnerNow = sw ?? newHist[newHist.length - 1];
    const isSeriesComplete = newHist.length >= 3 || sw !== null;
    if (isSeriesComplete) {
      setMatchOver(true);
      setSeriesWinner(seriesWinnerNow);
      setPhase("match_over");
      setTimeout(() => {
        unstable_batchedUpdates(() => {
          setShowWinOverlay(true);
          requestAnimationFrame(() => setOverlayVisible(true));
        });
      }, 300);
    } else {
      setTimeout(() => {
        unstable_batchedUpdates(() => {
          setShowWinOverlay(true);
          requestAnimationFrame(() => setOverlayVisible(true));
        });
      }, 300);
      setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
    }
  }, [winner]);

  // Record a local mission event when a match series ends.
  // This keeps Daily/Weekly/Permanent missions progress working without backend changes.
  useEffect(() => {
    if (!matchOver) {
      didRecordMissionRef.current = false;
      return;
    }
    if (didRecordMissionRef.current) return;
    if (!seriesWinner) return;
    if (!userKey || userKey === "guest") return;
    if (phase !== "match_over") return;
    if (seriesWinner !== "P1" && seriesWinner !== "P2") return;
    // Singleplayer mode should never affect mission progress.
    if (gameMode === "singleplayer") return;

    const rulebreakerUsed = matchHistoryRef.current.length >= 3;
    const result = seriesWinner === mySlot ? "win" : "loss";
    const matchKind: "ranked" | "unranked" | "bot" =
      gameMode === "ai" ? "bot" : isRankedGame ? "ranked" : "unranked";

    const myElo = (() => {
      if (!isMultiplayerGame) return undefined;
      if (mySlot === "P1") return p1Elo;
      return p2Elo;
    })();

    const opponentElo = (() => {
      if (!isMultiplayerGame) return undefined;
      if (mySlot === "P1") return p2Elo;
      return p1Elo;
    })();

    const botDifficulty = matchKind === "bot" ? (difficulty as any) : undefined;

    pushMissionEvent(userKey, {
      at: Date.now(),
      matchKind,
      result,
      rulebreakerUsed,
      botDifficulty,
      myElo,
      opponentElo,
    });
    didRecordMissionRef.current = true;
  }, [matchOver, seriesWinner, phase, mySlot, gameMode, isRankedGame, isMultiplayerGame, p1Elo, p2Elo, difficulty, userKey]);

  useEffect(() => {
    if (!matchOver) {
      didRefreshProfileAfterSeriesRef.current = false;
      didPersistLobbyQuoteForSeriesRef.current = false;
      return;
    }
    if (phase !== "match_over") return;
    if (!isMultiplayerGame) return;
    if (!didPersistLobbyQuoteForSeriesRef.current) {
      didPersistLobbyQuoteForSeriesRef.current = true;
      if (typeof window !== "undefined") {
        persistLobbyTauntQuote(lobbyQuoteFromSeriesWinner(seriesWinner, mySlot));
      }
    }
    if (!userKey || userKey === "guest") return;
    if (didRefreshProfileAfterSeriesRef.current) return;
    didRefreshProfileAfterSeriesRef.current = true;
    void useAuthStore.getState().refreshProfile();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("pp:career-refresh"));
    }
  }, [matchOver, phase, isMultiplayerGame, userKey, seriesWinner, mySlot]);

  useEffect(() => {
    if (phase === "waiting_ready" && p1Ready && p2Ready && R.current.readyTimer <= 0) setReadyTimer(1);
  }, [p1Ready, p2Ready]);

  const placeBot = async (r: number, c: number) => {
    const currentBoard = boardRef.current;
    const currentMoves = movesPlayedRef.current;
    const currentExtra = extraTurnsRef.current;
    if (phase !== "playing" || currentBoard[r][c] || winner) return;
    playPlaceAction?.();
    const playerWhoMoved = "P2";
    const nb = currentBoard.map(row => [...row]);
    const rbTrap = GRID_SIZE === 6 && rb6SpecialCell && rb6SpecialCell.r === r && rb6SpecialCell.c === c;
    const stoneOwner = rbTrap ? rb6SpecialCell!.owner : playerWhoMoved;
    nb[r][c] = stoneOwner;
    const newMoves = currentMoves + 1;
    let newExtra = currentExtra, nextPlayer: string = "P1";
    const skipC7 = GRID_SIZE === 7 && suppressCenterOpening;
    const centerOpenBonus = GRID_SIZE !== 6 && !skipC7 && newMoves === 1 && r === CENTER && c === CENTER;
    if (centerOpenBonus) { nextPlayer = "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = "P1"; else nextPlayer = "P2"; }
    else { nextPlayer = "P1"; }
    const patBot = stoneOwner === "P1" ? structuralPatternsP1Ref.current : structuralPatternsP2Ref.current;
    const result = GRID_SIZE === 7
      ? checkWin7(nb, r, c, stoneOwner, newMoves, patBot)
      : GRID_SIZE === 6
        ? checkWin6(nb, r, c, stoneOwner, newMoves)
        : checkWin(nb, r, c, stoneOwner, newMoves);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch { } }
  };

  const place = async (r: number, c: number) => {
    if (phase !== "playing" || board[r][c] || winner || loading) return;
    if (gameMode === "ai" && current === "P2") return;
    if (c3Blocked && movesPlayed === 0 && r === CENTER && c === CENTER && GRID_SIZE !== 6) return;
    if (isMultiplayerGame) {
      console.log("[MP] sending move to server", { r, c, slot: mySlot, current });
      if (current !== mySlot) {
        console.warn("[MP] not my turn", { current, mySlot });
        return;
      }
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        console.error("[MP] WS not open", wsRef.current?.readyState);
        return;
      }
      playPlaceAction?.();
      wsRef.current.send(JSON.stringify({ type: "move", row: r, col: c }));
      return;
    }
    playPlaceAction?.();
    setLoading(true);
    const playerWhoMoved = current;
    const nb = board.map(row => [...row]);
    const rbTrap = GRID_SIZE === 6 && rb6SpecialCell && rb6SpecialCell.r === r && rb6SpecialCell.c === c;
    const stoneOwner = rbTrap ? rb6SpecialCell!.owner : playerWhoMoved;
    nb[r][c] = stoneOwner;
    const newMoves = movesPlayed + 1;
    let newExtra = extraTurns, nextPlayer = current;
    const skipC7 = GRID_SIZE === 7 && suppressCenterOpening;
    const centerOpenBonus = GRID_SIZE !== 6 && !skipC7 && newMoves === 1 && r === CENTER && c === CENTER;
    if (centerOpenBonus) { nextPlayer = current === "P1" ? "P2" : "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = current === "P1" ? "P2" : "P1"; }
    else { nextPlayer = current === "P1" ? "P2" : "P1"; }
    if (c3Blocked && newMoves === 1) setC3Blocked(false);
    const activePatterns = stoneOwner === "P1" ? structuralPatternsP1 : structuralPatternsP2;
    const result = GRID_SIZE === 7
      ? checkWin7(nb, r, c, stoneOwner, newMoves, activePatterns)
      : GRID_SIZE === 6
        ? checkWin6(nb, r, c, stoneOwner, newMoves, activePatterns)
        : checkWin(nb, r, c, stoneOwner, newMoves, activePatterns);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    setLoading(false);
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch { } }
  };
  // Stable ref so boardJSX memo never holds a stale place closure
  const placeRef = useRef(place);
  useEffect(() => { placeRef.current = place; });

  const liveSkinBoard = React.useMemo(() => {
    // Only map the board if we are using a themed grid that requires X/O format
    const needsMapping = isGlacierBoard || isBloodMoonBoard || isEgyptBoard || isSynthwaveBoard || 
                         isMatrixBoard || isArcaneBoard || isBioBoard || isForgeBoard || 
                         isVoidBoard || isTokyoBoard || isSpaceBoard || isPixelBoard;
    if (!needsMapping) return null;
    return board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null));
  }, [board, isGlacierBoard, isBloodMoonBoard, isEgyptBoard, isSynthwaveBoard, isMatrixBoard, isArcaneBoard, isBioBoard, isForgeBoard, isVoidBoard, isTokyoBoard, isSpaceBoard, isPixelBoard]);

  const bundledGridKey = React.useMemo(
    () => `${boardSkin}-${liveBoardMode}-${board.length}`,
    [boardSkin, liveBoardMode, board.length],
  );

  const handleCellClick = React.useCallback(
    (r: number, c: number) => { 
      console.log("handleCellClick", { r, c, winner, phase, rulesShowSheet, show7x7LevelUp, show6x6LevelUp, rulesMatchGate, lock: winClickLockRef.current });
      if (winClickLockRef.current) return;
      if (!winner && phase === "playing" && rulesShowSheet === null && !show7x7LevelUp && !show6x6LevelUp && !rulesMatchGate) {
        placeRef.current(r, c); 
      }
    },
    [winner, phase, rulesShowSheet, show7x7LevelUp, show6x6LevelUp, rulesMatchGate]
  );

  const addLog = (r: number, c: number, player: string) => {
    const piece = player === "P1" ? t.pieces.p1 : t.pieces.p2;
    setLog(l => [...l, { text: `${l.length + 1}. ${piece}→${String.fromCharCode(65 + c)}${r + 1} (${player})`, player }]);
  };

  const dismissOverlay = useCallback(() => {
  setShowWinOverlay(false);
  setOverlayVisible(false);
  setIsBoardPaused(false);
  winClickLockRef.current = false;
}, []);
  const goToCareerAfterSeries = useCallback(() => {
    const id = matchSeriesComplete?.careerEntryId;
    if (id && typeof window !== "undefined") {
      sessionStorage.setItem("pp_career_focus_match_id", id);
    }
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot }));
    }
    isViewingPostMatchRef.current = false;
    setShowGameWinScreen(false);
    setShowRankedMatchResult(false);
    setMatchSeriesComplete(null);
    setScreenAction?.("career", { exitMultiGameToCareer: true });
  }, [matchSeriesComplete?.careerEntryId, isMultiplayerGame, mySlot, setScreenAction]);

  const useRbExtraTurnToken = useCallback(() => {
    if (phase !== "playing" || winner) return;
    if (!rbExtraTurnTokenHolder || rbExtraTurnTokenUsed) return;
    if (extraTurns !== 0) return;
    const imHolder = isMultiplayerGame ? mySlot === rbExtraTurnTokenHolder : current === rbExtraTurnTokenHolder;
    if (!imHolder) return;
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "rb_use_extra_turn" }));
      return;
    }
    setExtraTurns(x => x + 2);
    setRbExtraTurnTokenUsed(true);
  }, [phase, winner, rbExtraTurnTokenHolder, rbExtraTurnTokenUsed, extraTurns, isMultiplayerGame, mySlot, current]);

  const broadcastTossPhase = useCallback((ph: string, extra: Record<string, unknown> = {}) => {
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "toss_action", action: "phase_choice", payload: { phase: ph, ...extra } }));
    }
  }, [isMultiplayerGame]);

  const onGridBlockChoice = useCallback((r: number, c: number) => {
    const chooser = R.current.rb6CellChooser;
    if (!chooser) return;
    // #region agent log
    fetch('http://127.0.0.1:7852/ingest/44a3777c-2714-4f08-b3ff-de0caf166408',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6fad40'},body:JSON.stringify({sessionId:'6fad40',runId:'run1',hypothesisId:'H3',location:'frontend/components/GameScreen.tsx:2245',message:'selected 6x6 special cell',data:{chooser,r,c,winnerPickedRule:R.current.winnerPickedRule,p1Time,p2Time},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setRb6SpecialCell({ r, c, owner: chooser });
    if (R.current.winnerPickedRule === "timer_half") {
      setRb6TimerOwner(chooser);
      if (chooser === "P1") {
        p1TimeRef.current = 120_000;
        setP1Time(120_000);
      } else {
        p2TimeRef.current = 120_000;
        setP2Time(120_000);
      }
      setPhase("who_first_loser");
      if (isMultiplayerGame) {
        broadcastTossPhase("who_first_loser", {
          rb6_special_cell: { r, c, owner: chooser },
          winnerPickedRule: R.current.winnerPickedRule,
          rb6TimerOwner: chooser,
        });
      }
      return;
    }
    setSummaryTimer(5);
    setPhase("toss_summary");
    if (isMultiplayerGame) {
      broadcastTossPhase("toss_summary", {
        rb6_special_cell: { r, c, owner: chooser },
        summaryTimer: 5,
      });
    }
  }, [isMultiplayerGame, broadcastTossPhase]);

  const onLeftAction = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      if (is7x7 && tw) {
        const pre = [...liveSelectedPatterns];
        setWinnerPickedRule("extra_turn");
        setRbPatternsPreBan(pre);
        setRbHideBannedPatternFromSlot(tw);
        setPhase("ban_pattern_loser");
        broadcastTossPhase("ban_pattern_loser", {
          winnerPickedRule: "extra_turn",
          rbHideBannedPatternFromSlot: tw,
          rbPatternsPreBan: pre,
        });
      } else if (is6x6 && tw) {
        setWinnerPickedRule("timer_half");
        setRb6TimerOwner(tw);
        setRb6CellChooser(tw);
        setPhase("grid_block_warning");
        broadcastTossPhase("grid_block_warning", {
          winnerPickedRule: "timer_half",
          rb6TimerOwner: tw,
          rb6CellChooser: tw,
        });
      } else if (!is7x7 && !is6x6) {
        setWinnerPickedRule("first"); setPhase("who_first_winner"); broadcastTossPhase("who_first_winner", { winnerPickedRule: "first" });
      }
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tw); setWinnerPickedFirst(tw ?? null);
      if (is7x7) { setPhase("ban_pattern_loser"); broadcastTossPhase("ban_pattern_loser", { firstPlayerChosen: tw, winnerPickedFirst: tw }); }
      else if (is6x6 && tw) {
        const forcedOther = tw === "P1" ? "P2" : "P1";
        setRb6TimerOwner(forcedOther);
        setRb6CellChooser(forcedOther);
        setPhase("grid_block_selection");
        broadcastTossPhase("grid_block_selection", {
          firstPlayerChosen: tw,
          winnerPickedFirst: tw,
          rb6TimerOwner: forcedOther,
          rb6CellChooser: forcedOther,
          winnerPickedRule: "choose_first",
        });
      } else { setPhase("c3_choice_loser"); broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tw, winnerPickedFirst: tw }); }
    }
    else if (p === "grid_block_warning") {
      setPhase("grid_block_selection");
      broadcastTossPhase("grid_block_selection", {
        rb6TimerOwner: R.current.rb6TimerOwner,
        rb6CellChooser: R.current.rb6CellChooser,
        winnerPickedRule: R.current.winnerPickedRule,
      });
    }
    else if (p === "c3_choice") { setRbC3Blocked(true); setWinnerPickedC3(true); setPhase("who_first_loser"); broadcastTossPhase("who_first_loser", { rbC3Blocked: true, winnerPickedC3: true }); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(true); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { rbC3Blocked: true, summaryTimer: 5 }); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tl); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { firstPlayerChosen: tl, summaryTimer: 5, rb6_special_cell: R.current.rb6SpecialCell, rb6TimerOwner: R.current.rb6TimerOwner }); }
  }, [broadcastTossPhase, is7x7, is6x6, liveSelectedPatterns]);

  const onRightAction = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      if (is7x7 && tw) {
        const pre = [...liveSelectedPatterns];
        setWinnerPickedRule("ban");
        setRbPatternsPreBan(pre);
        setRbHideBannedPatternFromSlot(tl);
        setPhase("ban_pattern_winner");
        broadcastTossPhase("ban_pattern_winner", {
          winnerPickedRule: "ban",
          rbHideBannedPatternFromSlot: tl,
          rbPatternsPreBan: pre,
        });
      } else if (is6x6 && tw) {
        setWinnerPickedRule("choose_first");
        setPhase("who_first_winner");
        broadcastTossPhase("who_first_winner", { winnerPickedRule: "choose_first" });
      } else if (!is7x7 && !is6x6) { setWinnerPickedRule("c3"); setPhase("c3_choice"); broadcastTossPhase("c3_choice", { winnerPickedRule: "c3" }); }
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tl); setWinnerPickedFirst(tl ?? null);
      if (is7x7) { setPhase("ban_pattern_loser"); broadcastTossPhase("ban_pattern_loser", { firstPlayerChosen: tl, winnerPickedFirst: tl }); }
      else if (is6x6 && tw) {
        const forcedOther = tw === "P1" ? "P2" : "P1";
        setRb6TimerOwner(forcedOther);
        setRb6CellChooser(forcedOther);
        setPhase("grid_block_selection");
        broadcastTossPhase("grid_block_selection", {
          firstPlayerChosen: tl,
          winnerPickedFirst: tl,
          rb6TimerOwner: forcedOther,
          rb6CellChooser: forcedOther,
          winnerPickedRule: "choose_first",
        });
      } else { setPhase("c3_choice_loser"); broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tl, winnerPickedFirst: tl }); }
    }
    else if (p === "c3_choice") { setRbC3Blocked(false); setWinnerPickedC3(false); setPhase("who_first_loser"); broadcastTossPhase("who_first_loser", { rbC3Blocked: false, winnerPickedC3: false }); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(false); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { rbC3Blocked: false, summaryTimer: 5 }); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tw); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { firstPlayerChosen: tw, summaryTimer: 5, rb6_special_cell: R.current.rb6SpecialCell, rb6TimerOwner: R.current.rb6TimerOwner }); }
  }, [broadcastTossPhase, is7x7, is6x6, liveSelectedPatterns]);

  const onBanPattern = useCallback((patternName: string) => {
    const p = R.current.phase;
    const currentBans = R.current.rbBannedPatterns || [];
    if (currentBans.includes(patternName)) return;
    
    const newBans = [...currentBans, patternName];
    setRbBannedPatterns(newBans);
    R.current.rbBannedPatterns = newBans; 

    const limit = is7x7 ? 2 : 1;
    if (newBans.length >= limit) {
      setPhase("who_first_loser"); 
      broadcastTossPhase("who_first_loser", { rb_banned_patterns: newBans });
    } else {
      broadcastTossPhase(p, { rb_banned_patterns: newBans });
    }
  }, [broadcastTossPhase, is7x7]);

  // ── Bot auto-picks during Rulebreaker choice phases ───────────────────────
  useEffect(() => {
    if (gameMode !== "ai") return;

    const winnerPhases: Phase[] = ["rule_choice", "who_first_winner", "c3_choice", "ban_pattern_winner"];
    const loserPhases: Phase[] = ["c3_choice_loser", "who_first_loser", "ban_pattern_loser"];

    const isBotWinner = tossWinner === "P2";
    const isBotLoser = tossWinner === "P1";

    const isBotTurn =
      (winnerPhases.includes(phase) && isBotWinner) ||
      (loserPhases.includes(phase) && isBotLoser);

    if (!isBotTurn) return;

    const delay = 800 + Math.random() * 1200;
    const timer = setTimeout(() => {
      if (phase === "ban_pattern_winner" || phase === "ban_pattern_loser") {
        const available = liveSelectedPatterns.filter(p => !rbBannedPatterns.includes(p));
        if (available.length === 0) return;
        const rndIdx = Math.floor(Math.random() * available.length);
        const patToBan = available[rndIdx];
        setBotPickedSide("left");
        setTimeout(() => {
          setBotPickedSide(null);
          onBanPattern(patToBan);
        }, 900);
      } else {
        const pick = Math.random() < 0.5 ? "left" : "right";
        setBotPickedSide(pick);
        setTimeout(() => {
          setBotPickedSide(null);
          if (pick === "left") onLeftAction(); else onRightAction();
        }, 900);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [phase, tossWinner, gameMode, onLeftAction, onRightAction, onBanPattern, liveSelectedPatterns, rbBannedPatterns]);

  const cc = current === "P1" ? p1c : p2c;
  const cp = current === "P1" ? t.pieces.p1 : t.pieces.p2;
  const winnerColor = winner === "P1" ? p1c : winner === "P2" ? p2c : t.gold;
  const winnerPiece = winner === "P1" ? t.pieces.p1 : winner === "P2" ? t.pieces.p2 : "⚖";
  const seriesDiffers = phase === "match_over" && seriesWinner !== null && seriesWinner !== winner;
  const seriesColor = seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold;
  const seriesPiece = seriesWinner === "P1" ? t.pieces.p1 : seriesWinner === "P2" ? t.pieces.p2 : "⚖";

  // ── Board sizing — must be before early returns so hooks below are unconditional ──
  const boardGap = ip ? 3 : 4;
  const boardPad = ip ? 3 : 4;
  const panelW = 240;
  const sidebarT = { ...t, pieces: t.pieces };

  const mobileCellSize = `calc((min(100vw, calc(100vh - 160px)) - ${(GRID_SIZE - 1) * boardGap + 2 * boardPad + 32}px) / ${GRID_SIZE})`;
  const panelTotal = panelW * 2;
  const desktopCellSize = `calc((min(calc(100vw - ${panelTotal}px - 34px), calc(100vh - 164px)) - ${(GRID_SIZE - 1) * boardGap + 2 * boardPad + 6}px) / ${GRID_SIZE})`;
  const bigCs = isMobile ? mobileCellSize : desktopCellSize;

  // Memoize the board grid JSX — skips full recompute on timer ticks (p1Time/p2Time changes)
  // Only recomputes when actual board data changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const boardJSX = React.useMemo(() => (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${GRID_SIZE},${bigCs})`, gridTemplateRows: `repeat(${GRID_SIZE},${bigCs})`, gap: `${boardGap}px`, background: isRedBoard ? "rgba(10,2,1,0.99)" : (isIceBoard || isGlacierBoard) ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : `color-mix(in srgb, ${t.boardLine} 88%, rgba(255,255,255,0.14))`, padding: `${boardPad}px`, borderRadius: ip ? 2 : 10, border: `${ip ? 3 : 2}px solid ${isRedBoard ? "rgba(140,20,0,0.35)" : isGlacierBoard ? "rgba(125,211,252,0.42)" : (isIceBoard ? "rgba(80,160,220,0.28)" : t.border)}`, boxShadow: isRedBoard ? "0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)" : isGlacierBoard ? "0 0 58px rgba(90,190,255,0.12), inset 0 0 46px rgba(0,0,0,0.74)" : (isIceBoard ? "0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)" : "none"), overflow: "hidden" }}>
      {isRedBoard && <Embers count={16} />}
      {isRedBoard && <HeatOverlay />}
      {isIceBoard && <FrostCrystals />}
      {isIceBoard && <IceOverlay />}
      {isGlacierBoard && <GlacierAurora />}
      {isGlacierBoard && <GlacierSnow count={22} />}
      {isGlacierBoard && <FrostCrystals />}
      {isGlacierBoard && <GlacierGridLines />}
      {board.map((row, r) => row.map((cell, c) => {
        const key = `${r}-${c}`;
        const blk = c3Blocked && movesPlayed === 0 && r === CENTER && c === CENTER && GRID_SIZE !== 6;
        const isHov = hover === key && !cell && !winner && !blk && phase === "playing" && rulesShowSheet === null && !show7x7LevelUp && !show6x6LevelUp && !rulesMatchGate;
        const isWin = winLine.some(([wr, wc]) => wr === r && wc === c);
        const ec = cell === "P1" ? p1c : p2c;
        const canPlay = !cell && !winner && !blk && phase === "playing" && rulesShowSheet === null && !show7x7LevelUp && !show6x6LevelUp && !rulesMatchGate;
        if (isRedBoard) return (<RedCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={useGlacierSigils} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} />);
        if (isIceBoard || isGlacierBoard) return (<IceCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={useGlacierSigils} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} />);
        return (
          <div key={key} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} className={isWin ? "win-cell-pulse" : ""}
            style={{ "--win-col": ec, width: bigCs, height: bigCs, background: blk ? `${t.danger}18` : isWin ? `${ec}28` : isHov ? `${cc}22` : t.boardBg, border: `2px solid ${blk ? t.danger : isWin ? ec : isHov ? cc : `color-mix(in srgb, ${t.boardLine} 76%, rgba(255,255,255,0.28))`}`, borderRadius: ip ? 0 : 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPlay ? (isHov ? "grabbing" : "grab") : "default", fontSize: "clamp(24px,5.5vmin,58px)", fontFamily: t.fontDisplay, fontWeight: 700, color: ec, textShadow: isWin ? `0 0 20px ${ec}` : cell ? `0 0 14px ${ec}77` : "none", transition: "background 0.1s, border-color 0.1s", opacity: blk ? 0.4 : 1, boxShadow: isWin ? `0 0 8px ${ec}44` : isHov ? `inset 0 0 12px ${cc}22` : "inset 0 0 0 1px rgba(255,255,255,0.07)", willChange: isWin ? "auto" : canPlay ? "background, border-color" : "auto", position: "relative" } as React.CSSProperties}>
            {cell && useFlameSkull && cell === "P1" && <Flame cssSize="55%" />}
            {cell && useFlameSkull && cell === "P2" && <Skull cssSize="55%" />}
            {cell && useSnowflakeShard && cell === "P1" && <SnowflakePiece cssSize="55%" />}
            {cell && useSnowflakeShard && cell === "P2" && <IceShardPiece cssSize="55%" />}
            {cell && useGlacierSigils && cell === "P1" && <GlacierSigilPiece cssSize="55%" />}
            {cell && useGlacierSigils && cell === "P2" && <GlacierPrismPiece cssSize="55%" />}
            {cell && !useFlameSkull && !useSnowflakeShard && !useGlacierSigils && <Piece symbol={cell === "P1" ? pieceSymbols.p1 : pieceSymbols.p2} color={cell === "P1" ? p1c : p2c} size="36%" />}
            {!cell && blk && <span style={{ fontSize: "clamp(14px,2.5vmin,28px)", color: t.danger }}>✕</span>}
          </div>
        );
      }))}
    </div>
    // recompute when board, hover, win state, or skin changes — NOT on timer ticks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [board, hover, winLine, winner, phase, c3Blocked, movesPlayed, bigCs, GRID_SIZE,
    p1c, p2c, cc, current, rb6SpecialCell, isRedBoard, isIceBoard, isGlacierBoard, useFlameSkull, useSnowflakeShard, useGlacierSigils,
    rulesShowSheet, show7x7LevelUp, show6x6LevelUp, rulesMatchGate]);

  function renderMainBoard(variant: "mobile" | "desktop"): React.ReactNode {
    const k = bundledGridKey;
    const colHdrStyle =
      variant === "mobile"
        ? ({ display: "flex", gap: `${boardGap}px`, paddingLeft: 28, marginBottom: 4 } as const)
        : ({ display: "flex", gap: `${boardGap}px`, marginLeft: 34 } as const);
    const colFontSize = GRID_SIZE === 7 ? (variant === "mobile" ? 13 : 16) : variant === "mobile" ? 16 : 21;
    const rowColGap = variant === "mobile" ? 4 : 6;
    const rowLabelWidth = variant === "mobile" ? 24 : 34;
    const labelTextShadow =
      variant === "desktop"
        ? ({ textShadow: `0 0 10px ${isRedBoard ? "rgba(200,40,0,0.4)" : isIceBoard ? "rgba(100,180,255,0.3)" : t.accentGlow + "66"}` } as const)
        : ({} as const);
    const rowLabelExtra = variant === "desktop" ? ({ width: 34, flexShrink: 0 } as const) : ({ width: rowLabelWidth } as const);
    if (isGlacierBoard) return <GlacierGridCompat key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isBloodMoonBoard) return <BloodMoonGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} graphicsQuality={gameplayGraphicsQuality} isPaused={isBoardPaused} />;
    if (isEgyptBoard) return <EgyptGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} graphicsQuality={gameplayGraphicsQuality} isPaused={isBoardPaused} />;
    if (isSynthwaveBoard) return <SynthwaveGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} graphicsQuality={gameplayGraphicsQuality} isPaused={isBoardPaused} />;
    if (isMatrixBoard) return <MatrixGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} graphicsQuality={gameplayGraphicsQuality} isPaused={isBoardPaused} />;
    if (isArcaneBoard) return <ArcaneGridCompat key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isBioBoard) return <BioGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} graphicsQuality={gameplayGraphicsQuality} isPaused={isBoardPaused} />;
    if (isForgeBoard) return <ForgeGridCompat key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isVoidBoard) return <VoidGridCompat key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isTokyoBoard) return <TokyoGridCompat key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isSpaceBoard) return <SpaceGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    if (isPixelBoard) return <PixelGrid key={k} board={liveSkinBoard!} onCellClickAction={handleCellClick} winCells={winLine} isPaused={isBoardPaused} graphicsQuality={gameplayGraphicsQuality} />;
    return (
      <>
        <div style={colHdrStyle}>
          {"ABCDEFG".slice(0, GRID_SIZE).split("").map(l => (
            <div
              key={l}
              style={{
                width: bigCs,
                textAlign: "center",
                fontFamily: t.fontMono,
                fontSize: colFontSize,
                fontWeight: 800,
                color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent,
                letterSpacing: "0.1em",
                ...labelTextShadow,
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: rowColGap, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gridTemplateRows: `repeat(${GRID_SIZE},${bigCs})`, gap: `${boardGap}px` }}>
            {Array.from({ length: GRID_SIZE }, (_, i) => i + 1).map(n => (
              <div
                key={n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: t.fontMono,
                  fontSize: colFontSize,
                  fontWeight: 800,
                  color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent,
                  letterSpacing: "0.1em",
                  ...labelTextShadow,
                  ...rowLabelExtra,
                }}
              >
                {n}
              </div>
            ))}
          </div>
          {boardJSX}
        </div>
      </>
    );
  }

  const splashScreen = (
    <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: t.bg, gap: 32, userSelect: "none" }}>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(24px,5vw,72px)", fontWeight: 900, color: t.accent, textShadow: `0 0 60px ${t.accentGlow}55`, letterSpacing: "0.06em", textAlign: "center" }}>SINGLEPLAYER</div>
      <div style={{ fontFamily: t.fontBody, fontSize: "clamp(13px,1.6vw,18px)", color: t.textSecondary, letterSpacing: "0.04em" }}>Local · Pass & Play · First to 5</div>
      <button onClick={() => setShowSplash(false)}
        style={{
          marginTop: 8,
          padding: "36px 128px",
          background: `linear-gradient(135deg,${t.accent},${t.accentGlow})`,
          border: "none",
          borderRadius: ip ? 2 : 16,
          color: "#0A0A0A",
          fontFamily: t.fontDisplay,
          fontSize: "clamp(28px,4vw,44px)",
          fontWeight: 900,
          cursor: "pointer",
          letterSpacing: "0.15em",
          boxShadow: `0 0 64px ${t.accentGlow}55`,
          transition: "transform 0.15s ease, box-shadow 0.2s ease"
        }}
        onMouseEnter={e => { playHoverAction?.(); (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 96px ${t.accentGlow}88`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 64px ${t.accentGlow}55`; }}
        onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.98)"; }}
        onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; }}
      >PLAY</button>
      <button onClick={() => setScreenAction?.("home")}
        style={{
          padding: "18px 64px",
          background: "transparent",
          border: `2px solid ${t.border}`,
          borderRadius: ip ? 2 : 12,
          color: t.text,
          fontFamily: t.fontDisplay,
          fontSize: "clamp(14px,2vw,22px)",
          fontWeight: 900,
          cursor: "pointer",
          letterSpacing: "0.15em",
          transition: "all 0.2s cubic-bezier(.22,.68,0,1.2)",
          boxShadow: `0 0 20px ${t.border}22`
        }}
        onMouseEnter={e => { playHoverAction?.(); e.currentTarget.style.borderColor = t.accent; e.currentTarget.style.color = t.accent; e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = `0 0 40px ${t.accent}44`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.text; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 0 20px ${t.border}22`; }}
        onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
        onMouseUp={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
      >GO BACK</button>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>P1 goes first · Click any cell to begin</div>
    </div>
  );


  const rbPhases: Phase[] = ["rb_splash", "rb_coin", "rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "grid_block_warning", "grid_block_selection", "grid_block_waiting", "toss_summary", "rb_initializing"];
  const rbOverlay = rbPhases.includes(phase) && (
      <RulebreakerFlow
        phase={phase} t={t} ip={ip} p1c={p1c} p2c={p2c}
        p1Elo={isMultiplayerGame ? p1Elo : undefined}
        p2Elo={isMultiplayerGame ? p2Elo : undefined}
        coinResult={coinResult} coinAngle={coinAngle} coinDivRef={coinDivRef} tossWinner={tossWinner}
        summaryTimer={summaryTimer} firstPlayerChosen={firstPlayerChosen} rbC3Blocked={rbC3Blocked}
        choiceTimer={choiceTimer} isMultiplayerGame={isMultiplayerGame} mySlot={mySlot}
        winnerPickedRule={winnerPickedRule} winnerPickedFirst={winnerPickedFirst} winnerPickedC3={winnerPickedC3}
        rb6TimerOwner={rb6TimerOwner} rb6CellChooser={rb6CellChooser}
        botPickedSide={botPickedSide}
        gameMode={gameMode}
        p1Label={p1Label} p2Label={p2Label}
        wraithKingToss={wraithKingTossActive}
        rbCoinPendingResult={rbCoinPendingResult}
        onLeftAction={onLeftAction} onRightAction={onRightAction} fmtSecAction={fmtSecAction}
        is7x7={is7x7} is6x6={is6x6} selectedPatterns={liveSelectedPatterns} rbBannedPatterns={rbBannedPatterns} onBanPattern={onBanPattern}
        onGridBlockChoice={onGridBlockChoice}
        graphicsQuality={gameplayGraphicsQuality}
      />
  );

  const onReadyToggle = (player: "P1" | "P2") => {
    if (isMultiplayerGame && mySlot !== player) return;
    const newVal = player === "P1" ? !p1Ready : !p2Ready;
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ready", ready: newVal }));
    }
    player === "P1" ? setP1Ready(newVal) : setP2Ready(newVal);
    if ((gameMode === "ai" || gameMode === "singleplayer") && player === "P1") setP2Ready(newVal);
  };
  const onLevelUpReadyToggle = (selected?: string[]) => {
    if (!isMultiplayerGame || !mySlot) return;
    const isP1 = mySlot === "P1";
    const nextVal = isP1 ? !p1LevelUpReady : !p2LevelUpReady;
    if (isP1) setP1LevelUpReady(nextVal);
    else setP2LevelUpReady(nextVal);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: "levelup_ready", 
        ready: nextVal,
        selected_patterns: selected 
      }));
    }
  };

  const onChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendChat(isMultiplayerGame ? mySlot : "P1");
  };

  useEffect(() => {
    if (!isMultiplayerGame) return;
    // #region agent log
    fetch('http://127.0.0.1:7852/ingest/44a3777c-2714-4f08-b3ff-de0caf166408',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6fad40'},body:JSON.stringify({sessionId:'6fad40',runId:'run1',hypothesisId:'H1',location:'frontend/components/GameScreen.tsx:2616',message:'multiplayer overlay state snapshot',data:{phase,showRematch,hasMatchSeriesComplete:Boolean(matchSeriesComplete),matchOver,showWinOverlay},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [isMultiplayerGame, phase, showRematch, matchSeriesComplete, matchOver, showWinOverlay]);

  useEffect(() => {
    if (!isMultiplayerGame || GRID_SIZE !== 6) return;
    // #region agent log
    fetch('http://127.0.0.1:7852/ingest/44a3777c-2714-4f08-b3ff-de0caf166408',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6fad40'},body:JSON.stringify({sessionId:'6fad40',runId:'run1',hypothesisId:'H4',location:'frontend/components/GameScreen.tsx:2622',message:'6x6 timing snapshot',data:{p1Time,p2Time,rb6SpecialCell,rb6CellChooser,winnerPickedRule,phase,current},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [isMultiplayerGame, GRID_SIZE, p1Time, p2Time, rb6SpecialCell, rb6CellChooser, winnerPickedRule, phase, current]);

  const limitbreakerOverlay = pbOverlay && isMultiplayerGame && (() => {
    const isMyTurn = pbOverlay.nextSlot === mySlot;
    const phaseTitle =
      pbOverlay.phase === "coin" ? "COIN TOSS" :
      pbOverlay.phase === "choice" ? "CHOOSE THE TRACK" :
      pbOverlay.phase === "choose_first_player" ? "CHOOSE WHO PLAYS FIRST" :
      pbOverlay.phase === "ban_first" ? "FIRST BOARD BAN" :
      "SECOND BOARD BAN";
    const statusText =
      pbOverlay.phase === "coin"
        ? `${pbOverlay.tossWinner} won the toss.`
        : pbOverlay.phase === "choice"
          ? (isMyTurn ? "Choose what you want to control first." : "Waiting for the toss winner to choose the track.")
          : pbOverlay.phase === "choose_first_player"
            ? (isMyTurn ? "Choose who takes the first move in game 10." : "Waiting for the first-player choice.")
            : (isMyTurn ? "Choose one board to ban." : "Waiting for the next board ban.");
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 11500,
          background: "rgba(0,0,0,0.9)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 900, color: t.gold, marginBottom: 8, letterSpacing: "0.1em" }}>LIMITBREAKER</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, marginBottom: 12, textAlign: "center", maxWidth: 520, lineHeight: 1.5 }}>
          The match is tied at {pbOverlay.p1Agg}-{pbOverlay.p2Agg}. Game 10 will be played on the only board size left after two bans.
        </div>
        <div style={{ fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800, color: t.accent, marginBottom: 8, letterSpacing: "0.08em", textAlign: "center" }}>{phaseTitle}</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, marginBottom: 18, textAlign: "center", maxWidth: 520 }}>
          {statusText}
          {pbOverlay.firstPlayer ? ` First player: ${pbOverlay.firstPlayer}.` : ""}
          {pbOverlay.choice === "choose_first_player" ? " Toss winner chose to decide the starter first." : pbOverlay.choice === "ban_first" ? " Toss winner chose to ban a board first." : ""}
        </div>
        {pbOverlay.phase === "coin" && (
          <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.accent }}>
            {typeof pbOverlay.coinDueMs === "number" ? `Revealing choice in ${Math.max(0, Math.ceil((pbOverlay.coinDueMs - Date.now()) / 1000))}s` : "Preparing next step..."}
          </div>
        )}
        {pbOverlay.phase === "choice" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { id: "choose_first_player", label: "CHOOSE WHO PLAYS FIRST" },
              { id: "ban_first", label: "BAN A BOARD FIRST" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!isMyTurn}
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "limitbreaker_action", choice: opt.id }));
                  }
                }}
                style={{
                  padding: "14px 22px",
                  fontFamily: t.fontMono,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  borderRadius: 8,
                  border: `2px solid ${isMyTurn ? t.accent : "#444"}`,
                  background: isMyTurn ? `${t.accent}22` : "rgba(40,40,40,0.5)",
                  color: isMyTurn ? t.accent : "#888",
                  cursor: isMyTurn ? "pointer" : "not-allowed",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        {pbOverlay.phase === "choose_first_player" && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {(["P1", "P2"] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                disabled={!isMyTurn}
                onClick={() => {
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: "limitbreaker_action", first_player: slot }));
                  }
                }}
                style={{
                  padding: "14px 22px",
                  fontFamily: t.fontMono,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  borderRadius: 8,
                  border: `2px solid ${isMyTurn ? t.accent : "#444"}`,
                  background: pbOverlay.firstPlayer === slot ? `${t.accent}33` : isMyTurn ? `${t.accent}22` : "rgba(40,40,40,0.5)",
                  color: isMyTurn ? t.accent : "#888",
                  cursor: isMyTurn ? "pointer" : "not-allowed",
                }}
              >
                {slot} PLAYS FIRST
              </button>
            ))}
          </div>
        )}
        {(pbOverlay.phase === "ban_first" || pbOverlay.phase === "ban_second") && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {(["5x5", "6x6", "7x7"] as const).map((bm) => {
              const inBanList = pbOverlay.bans.includes(bm);
              const canClick = isMyTurn && !inBanList && pbOverlay.bans.length < 2;
              return (
                <button
                  key={bm}
                  type="button"
                  disabled={!canClick}
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: "limitbreaker_action", board_mode: bm }));
                    }
                  }}
                  style={{
                    padding: "14px 22px",
                    fontFamily: t.fontMono,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    borderRadius: 8,
                    border: `2px solid ${canClick ? t.accent : "#444"}`,
                    background: inBanList ? "rgba(80,80,80,0.4)" : canClick ? `${t.accent}33` : "rgba(40,40,40,0.5)",
                    color: canClick ? t.accent : inBanList ? "#aaa" : "#888",
                    cursor: canClick ? "pointer" : "not-allowed",
                  }}
                >
                  {bm === "5x5" ? "5x5" : bm === "6x6" ? "6x6" : "7x7"}{inBanList ? " X" : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  })();

  const levelUp7x7Overlay = show7x7LevelUp && (
    <div style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.35em", marginBottom: 18 }}>TIED SERIES · RULEBREAKER</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,7vw,56px)", fontWeight: 950, color: t.accent, textAlign: "center", textShadow: `0 0 50px ${t.accent}AA`, animation: "levelUpPulse 1.1s ease-in-out infinite" }}>LEVEL UP</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(42px,12vw,100px)", fontWeight: 950, color: "#FF6B35", marginTop: 10, textShadow: "0 0 70px rgba(255,107,53,0.65)" }}>7 × 7</div>
      <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, marginTop: 24, maxWidth: 420, textAlign: "center", lineHeight: 1.55, padding: "0 20px" }}>Game 3 on 5×5 ended in a draw at 1-1. No extra toss — opening the 7×7 leg at game 1 (0-0), first move to whoever had the second move on 5×5 game 1. Pattern-ban Rulebreaker on 7×7 only when the usual pair rule says so.</div>
    </div>
  );
  const levelUp6x6Overlay = show6x6LevelUp && (
    <div style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.35em", marginBottom: 18 }}>5×5 LEG COMPLETE</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,7vw,56px)", fontWeight: 950, color: t.accent, textAlign: "center", textShadow: `0 0 50px ${t.accent}AA`, animation: "levelUpPulse 1.1s ease-in-out infinite" }}>LEVEL UP</div>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(42px,12vw,100px)", fontWeight: 950, color: "#A78BFA", marginTop: 10, textShadow: "0 0 70px rgba(167,139,250,0.55)" }}>6 × 6</div>
      <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, marginTop: 24, maxWidth: 420, textAlign: "center", lineHeight: 1.55, padding: "0 20px" }}>Opening the Timebomb leg — confirm rules with your opponent, then play on the 6×6 grid.</div>
    </div>
  );
  const blockMultiRulesOrLevelUp =
    isMultiplayerGame &&
    !showMatchupOverlay &&
    (rulesShowSheet !== null || show7x7LevelUp || show6x6LevelUp || rulesMatchGate);

  if (blockMultiRulesOrLevelUp) {
    const shellBg = t.bg;
    return (
      <div
        style={{
          position: "fixed",
          top: isMobile ? 52 : 64,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          background: shellBg,
          overflow: "hidden",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {levelUp7x7Overlay}
        {levelUp6x6Overlay}
        {rulesShowSheet !== null && (
          <RuleshowScreen
            sheet={rulesShowSheet}
            t={{
              accent: t.accent,
              border: t.border,
              fontDisplay: t.fontDisplay,
              fontMono: t.fontMono,
              fontBody: t.fontBody,
              text: t.text,
              textSecondary: t.textSecondary,
              textMuted: t.textMuted,
            }}
            ip={ip}
            p1c={p1c}
            p2c={p2c}
            p1Ready={p1LevelUpReady}
            p2Ready={p2LevelUpReady}
            mySlot={mySlot ?? "P1"}
            onToggleReadyAction={onLevelUpReadyToggle}
          />
        )}
        <DisconnectModal
          show={showDisconnectModal}
          t={sidebarT}
          ip={ip}
          onGoHomeAction={() => {
            if (setScreenAction) setScreenAction("home");
          }}
        />
        <style>{`
        @keyframes levelUpPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:0.9}}
      `}</style>
      </div>
    );
  }

  if (showSplash) return splashScreen;

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 0, zIndex: 2, background: t.bg, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>

        <WinOverlay
          showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
          winner={winner} winnerColor={winnerColor} winnerPiece={winnerPiece}
          seriesDiffers={seriesDiffers} seriesColor={seriesColor} seriesPiece={seriesPiece}
          seriesWinner={seriesWinner} phase={phase} gameNumber={gameNumber}
          t={{ fontDisplay: t.fontDisplay, fontMono: t.fontMono, fontBody: t.fontBody }}
          winnerDisplayNameAction={winnerDisplayName}
          graphicsQuality={gameplayGraphicsQuality}
          onDismissAction={dismissOverlay}
        />

        <MatchupOverlay 
          matchupData={matchupData} 
          showMatchupOverlay={showMatchupOverlay} 
          playerSlot={playerSlot} 
          p1Name={p1Name} 
          user={user} 
          themeId={themeId} 
          t={t} 
          isRankedGame={isRankedGame} 
          matchupCountdown={matchupCountdown} 
          loadCustomTheme={loadCustomTheme}
        />
        {rbOverlay}

        <DisconnectModal
          show={showDisconnectModal}
          t={sidebarT} ip={ip}
          onGoHomeAction={() => { if (setScreenAction) setScreenAction("home"); }}
        />

        {isMultiplayerGame && chatToastVisible && unreadOpponentChat > 0 && (
          <div
            style={{
              position: "fixed",
              top: 56,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 50,
              maxWidth: "min(92vw, 320px)",
              padding: "10px 18px",
              background: "rgba(0,0,0,0.92)",
              border: `1px solid ${t.accent}88`,
              borderRadius: ip ? 2 : 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              fontFamily: t.fontMono,
              fontSize: 12,
              fontWeight: 700,
              color: t.accent,
              letterSpacing: "0.04em",
              pointerEvents: "none",
              textAlign: "center",
            }}
          >
            {unreadOpponentChat} new message{unreadOpponentChat > 1 ? "s" : ""}
          </div>
        )}

        {/* Board fills entire screen */}
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px" }}>
          {gameMode === "singleplayer" && (
            <button
              onClick={softReset}
              style={{
                marginBottom: 12,
                padding: "6px 16px",
                background: "rgba(255, 0, 0, 0.08)",
                border: `1px solid ${t.danger}66`,
                borderRadius: 8,
                color: t.danger,
                fontFamily: t.fontMono,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
                backdropFilter: "blur(4px)"
              }}
            >
              ↺ RESET MATCH
            </button>
          )}
          {renderMainBoard("mobile")}
        </div>

        {/* Mobile top-right menu buttons */}
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 8 }}>
          {isMultiplayerGame && (
            <button
              onClick={() => { setMobileTab("chat"); setShowMobileLog(true); setChatWarning(false); }}
              style={{ padding: "6px 14px", background: "rgba(0,0,0,0.75)", border: `1px solid ${chatWarning ? t.danger : t.accent}88`, borderRadius: 8, color: chatWarning ? t.danger : t.accent, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 4, position: "relative" }}
            >
              CHAT
              {unreadOpponentChat > 0 && (!showMobileLog || mobileTab !== "chat") && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: t.accent, color: "#000", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {unreadOpponentChat > 9 ? "9+" : unreadOpponentChat}
                </span>
              )}
              {chatWarning && <span style={{ width: 6, height: 6, background: t.danger, borderRadius: "50%", display: "inline-block" }} />}
            </button>
          )}
          <button
            onClick={() => { setMobileTab("log"); setShowMobileLog(true); }}
            style={{ padding: "6px 14px", background: "rgba(0,0,0,0.75)", border: `1px solid rgba(255,255,255,0.2)`, borderRadius: 8, color: t.textSecondary, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, backdropFilter: "blur(6px)" }}
          >
            LOGS
          </button>
        </div>

        {/* Floating timer chips */}
        <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.75)", border: `1px solid ${current === "P1" && !winner ? p1c : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "5px 10px", backdropFilter: "blur(6px)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: p1c, opacity: current === "P1" && !winner ? 1 : 0.35 }} />
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: current === "P1" && !winner ? p1c : "#666", fontWeight: 700 }}>{p1Label}</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 13, color: current === "P1" && !winner ? p1c : "#444", fontWeight: 900, marginLeft: 4 }}>{fmtTime(p1Time)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.75)", border: `1px solid ${current === "P2" && !winner ? p2c : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "5px 10px", backdropFilter: "blur(6px)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: p2c, opacity: current === "P2" && !winner ? 1 : 0.35 }} />
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: current === "P2" && !winner ? p2c : "#666", fontWeight: 700 }}>{p2Label}</span>
            <span style={{ fontFamily: t.fontMono, fontSize: 13, color: current === "P2" && !winner ? p2c : "#444", fontWeight: 900, marginLeft: 4 }}>{fmtTime(p2Time)}</span>
          </div>
        </div>

        {/* Match history chips */}
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          <div style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 10px", backdropFilter: "blur(6px)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {matchHistory.length > 0 ? matchHistory.map((res, i) => {
                const gNum = i + 1;
                const g = `G${gNum}`;
                const col = res === "P1" ? p1c : res === "P2" ? p2c : res === "DRAW" ? t.gold : "#333";
                const isActive = gNum === historyDisplayStartIndex + gameNumber;
                return (
                  <div key={gNum} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontFamily: t.fontMono, fontSize: 9, color: isActive ? t.accent : "#444", fontWeight: isActive ? 700 : 400 }}>{g}{isActive ? " ◀" : ""}</span>
                    <div style={{ width: 16, height: 3, borderRadius: 2, background: res ? col : "#222", border: `1px solid ${res ? col : "#333"}` }} />
                  </div>
                );
              }) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontFamily: t.fontMono, fontSize: 9, color: t.accent, fontWeight: 700 }}>G1 ◀</span>
                  <div style={{ width: 16, height: 3, borderRadius: 2, background: "#222", border: `1px solid #333` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Turn indicator */}
        <div style={{ position: "absolute", bottom: 52, left: 0, right: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, pointerEvents: "none" }}>
          {phase === "playing" && movesPlayed === 0 && !(GRID_SIZE === 7 && suppressCenterOpening) && GRID_SIZE !== 6 && (
            <div style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: "0.06em", background: c3Blocked ? `${t.danger}18` : `${t.gold}18`, border: `1px solid ${c3Blocked ? t.danger : t.gold}44`, borderRadius: 6, padding: "3px 12px", color: c3Blocked ? t.danger : t.gold }}>
              {c3Blocked ? "✕ Center blocked" : "★ Center → opponent gets 2 extra turns"}
            </div>
          )}
          {GRID_SIZE === 7 && phase === "playing" && !winner && rbExtraTurnTokenHolder && !rbExtraTurnTokenUsed && extraTurns === 0 && (isMultiplayerGame ? mySlot === rbExtraTurnTokenHolder : current === rbExtraTurnTokenHolder) && (
            <div style={{ pointerEvents: "auto" }}>
              <button type="button" onClick={() => { playClickAction?.(); useRbExtraTurnToken(); }} title="Use once: your next move does not end your turn." style={{ fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", padding: "8px 14px", borderRadius: 10, border: `1px solid ${t.accent}88`, background: `${t.accent}22`, color: t.accent }}>
                EXTRA TURN TOKEN
              </button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 18px", background: `${winner ? winnerColor : cc}26`, border: `1px solid ${winner ? winnerColor : cc}88`, borderRadius: 20 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: winner ? winnerColor : cc }} />
            <span style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 700, color: winner ? winnerColor : cc }}>
              {winner
                ? (winner === "DRAW" ? "⚖ DRAW" : `${winnerPiece} ${winnerDisplayName(winner)} WINS`)
                : extraTurns > 0
                  ? `${cp} — ${current === "P1" ? p1Label : p2Label} EXTRA ×${extraTurns}`
                  : `${cp} — ${current === "P1" ? p1Label : p2Label}'s Turn`
              }
            </span>
          </div>
        </div>

        {/* Bottom action bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(5,5,5,0.96)", borderTop: `1px solid ${t.border}`, gap: 8 }}>
          <button onClick={() => { if (showMobileLog && mobileTab === "log") setShowMobileLog(false); else { setMobileTab("log"); setShowMobileLog(true); } }} style={{ flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: t.textSecondary, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", letterSpacing: "0.06em" }}>
            📜 LOG
          </button>
          {isMultiplayerGame && (
            <button onClick={() => { if (showMobileLog && mobileTab === "chat") setShowMobileLog(false); else { setMobileTab("chat"); setShowMobileLog(true); } }} style={{ flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: t.textSecondary, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", position: "relative" }}>
              💬 CHAT
              {unreadOpponentChat > 0 && (!showMobileLog || mobileTab !== "chat") && (
                <span style={{ position: "absolute", top: 2, right: 6, minWidth: 18, height: 18, borderRadius: 9, background: t.accent, color: "#000", fontSize: 10, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                  {unreadOpponentChat > 9 ? "9+" : unreadOpponentChat}
                </span>
              )}
              {chatWarning && (!showMobileLog || mobileTab !== "chat") && <span style={{ position: "absolute", top: 4, right: 8, width: 6, height: 6, background: "#ff3333", borderRadius: "50%" }} />}
            </button>
          )}
          {phase === "waiting_ready" && (
            <button onClick={() => onReadyToggle(mySlot === "P1" || !isMultiplayerGame ? "P1" : "P2")} style={{ flex: 2, padding: "8px 0", background: `${t.accent}22`, border: `1px solid ${t.accent}`, borderRadius: 6, color: t.accent, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
              {(mySlot === "P1" ? p1Ready : p2Ready) ? "READY" : "TAP TO READY"}
            </button>
          )}
          <button onClick={() => { playClickAction?.(); pausedRef.current = true; setShowExitConfirm(true); }} style={{ flex: 1, padding: "8px 0", background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.2)", borderRadius: 6, color: "#cc3333", fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", letterSpacing: "0.06em" }}>
            EXIT
          </button>
        </div>

        {/* Mobile log / chat drawer */}
        {showMobileLog && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, background: "rgba(10,10,10,0.98)", borderTop: `1px solid ${t.border}`, boxShadow: "0 -20px 40px rgba(0,0,0,0.5)", backdropFilter: "blur(20px)", height: "50vh", display: "flex", flexDirection: "column", transform: "translateY(0)", transition: "transform 0.3s ease" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: `1px solid ${t.border}44` }}>
              <button
                onClick={() => setMobileTab("log")}
                style={{ flex: 1, padding: "12px 0", background: mobileTab === "log" ? `${t.accent}22` : "transparent", border: "none", borderBottom: `2px solid ${mobileTab === "log" ? t.accent : "transparent"}`, color: mobileTab === "log" ? t.accent : t.textSecondary, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >LOGS</button>
              {isMultiplayerGame && (
                <button
                  onClick={() => setMobileTab("chat")}
                  style={{ flex: 1, padding: "12px 0", background: mobileTab === "chat" ? `${t.accent}22` : "transparent", border: "none", borderBottom: `2px solid ${mobileTab === "chat" ? t.accent : "transparent"}`, color: mobileTab === "chat" ? t.accent : t.textSecondary, fontFamily: t.fontMono, fontSize: 12, fontWeight: 700, cursor: "pointer", position: "relative" }}
                >
                  CHAT
                  {chatWarning && <span style={{ position: "absolute", top: 8, right: 24, width: 8, height: 8, background: "#ff3333", borderRadius: "50%" }} />}
                </button>
              )}
              <button onClick={() => setShowMobileLog(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: "0 16px", fontSize: 16 }}>✕</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {mobileTab === "log" ? (
                <>
                  {log.length === 0
                    ? <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", marginTop: 20 }}>No moves yet</div>
                    : log.slice().reverse().map((entry, i) => (
                      <div key={i} style={{ fontFamily: t.fontMono, fontSize: 11, color: entry.player === "P1" ? p1c : p2c, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>{entry.text}</div>
                    ))
                  }
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
                    {chatMessages.length === 0 ? (
                      <div style={{ fontFamily: t.fontMono, fontSize: 11, color: "#444", fontStyle: "italic", textAlign: "center", marginTop: 20 }}>No messages</div>
                    ) : (
                      chatMessages.map((msg, i) => {
                        const isMe = msg.from === mySlot;
                        const c = msg.from === "P1" ? p1c : p2c;
                        return (
                          <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", background: `${c}15`, border: `1px solid ${c}40`, padding: "6px 10px", borderRadius: 8, maxWidth: "85%" }}>
                            <div style={{ fontFamily: t.fontMono, fontSize: 9, color: c, marginBottom: 2 }}>{msg.from === "P1" ? p1Label : p2Label}</div>
                            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: "#eee", wordBreak: "break-word" }}>{msg.text}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, paddingTop: 8, borderTop: `1px solid ${t.border}44` }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={onChatKeyDown}
                      placeholder="Message..."
                      style={{ flex: 1, background: "rgba(0,0,0,0.5)", border: `1px solid ${t.border}66`, borderRadius: 6, padding: "8px 12px", color: "#fff", fontFamily: t.fontBody, fontSize: 13, outline: "none" }}
                    />
                    <button onClick={() => sendChat(mySlot)} style={{ background: t.accent, border: "none", borderRadius: 6, padding: "0 16px", color: "#000", fontFamily: t.fontMono, fontSize: 12, fontWeight: 700 }}>SEND</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <MatchupOverlay 
          matchupData={matchupData} 
          showMatchupOverlay={showMatchupOverlay} 
          playerSlot={playerSlot} 
          p1Name={p1Name} 
          user={user} 
          themeId={themeId} 
          t={t} 
          isRankedGame={isRankedGame} 
          matchupCountdown={matchupCountdown} 
          loadCustomTheme={loadCustomTheme}
        />
        {rbOverlay}

        <SurrenderModal show={showSurrender} t={sidebarT} ip={ip} isRankedGame={isRankedGame} onConfirmAction={() => { setShowSurrender(false); if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot })); } if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }} playHoverAction={playHoverAction} />
        <ExitModal show={showExitConfirm} t={sidebarT} ip={ip} onConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }} playHoverAction={playHoverAction} />
        {limitbreakerOverlay}
        {showGameWinScreen && matchSeriesComplete && isMultiplayerGame && (
          <GameWinScreen
            seriesWinner={matchSeriesComplete.series_winner}
            format={matchSeriesComplete.format}
            p1={matchSeriesComplete.p1}
            p2={matchSeriesComplete.p2}
            mySlot={mySlot}
            t={{
              fontDisplay: t.fontDisplay,
              fontMono: t.fontMono,
              accent: t.accent,
              accentGlow: t.accentGlow,
              gold: t.gold,
              danger: t.danger,
              text: t.text,
              textSecondary: t.textSecondary,
              textMuted: t.textMuted,
            }}
            onContinue={matchSeriesComplete.format === "ranked"
              ? () => {
                  setShowGameWinScreen(false);
                  setShowRankedMatchResult(true);
                }
              : undefined}
            onRematch={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "rematch" }));
              }
              setRematchRequested(mySlot);
            }}
            onQuit={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot }));
              }
              setScreenAction?.("home");
            }}
            onGoToCareer={goToCareerAfterSeries}
          />
        )}
        {showRankedMatchResult && matchSeriesComplete && matchSeriesComplete.format === "ranked" && (
          <MatchResultScreen
            seriesWinner={matchSeriesComplete.series_winner}
            format={matchSeriesComplete.format}
            p1={matchSeriesComplete.p1}
            p2={matchSeriesComplete.p2}
            mySlot={mySlot}
            t={{
              fontDisplay: t.fontDisplay,
              fontMono: t.fontMono,
              accent: t.accent,
              accentGlow: t.accentGlow,
              gold: t.gold,
              danger: t.danger,
              text: t.text,
              textSecondary: t.textSecondary,
              textMuted: t.textMuted,
            }}
            onRematch={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "rematch" }));
              }
              setRematchRequested(mySlot);
            }}
            onQuit={() => {
              if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot }));
              }
              setScreenAction?.("home");
            }}
          />
        )}

        <style>{`
          @keyframes heatDrift0{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,18px) scale(1.1)}}
          @keyframes heatDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-15px,8px) scale(0.95)}}
          @keyframes heatDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(8px,-12px) scale(1.08)}}
          @keyframes winCellPulse{0%,100%{background:color-mix(in srgb, var(--win-col) 28%, transparent);box-shadow:0 0 8px color-mix(in srgb, var(--win-col) 44%, transparent)}50%{background:color-mix(in srgb, var(--win-col) 60%, transparent);box-shadow:0 0 22px color-mix(in srgb, var(--win-col) 80%, transparent)}}
          .win-cell-pulse{animation:winCellPulse 0.75s ease-in-out infinite}
          @keyframes fadeIn{from{opacity:0}to{opacity:1}}
          @keyframes scaleIn{from{opacity:0;transform:scale(0.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
          .overlay-modal{animation:scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both}
          .overlay-backdrop{animation:fadeIn 0.3s ease both}
          @keyframes iceD0{from{transform:translate(0,0)}to{transform:translate(8px,12px)}}
          @keyframes iceD1{from{transform:translate(0,0)}to{transform:translate(-10px,6px)}}
          @keyframes iceD2{from{transform:translate(0,0)}to{transform:translate(6px,-9px)}}
          @keyframes iceWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(100,200,255,0.3)}50%{box-shadow:0 0 28px rgba(100,200,255,0.7),inset 0 0 16px rgba(60,160,255,0.2)}}
          @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7),inset 0 0 16px rgba(255,40,0,0.2)}}
          @keyframes glAurora1{from{transform:translate(-2%,0) scale(1)}to{transform:translate(4%,8%) scale(1.08)}}
          @keyframes glAurora2{from{transform:translate(0,0) scale(1)}to{transform:translate(-5%,6%) scale(1.06)}}
          @keyframes glAurora3{from{transform:translate(0,0) scale(1)}to{transform:translate(3%,-7%) scale(1.05)}}
          @keyframes glSnowFall{0%{transform:translateY(-8px) translateX(0px);opacity:0}8%{opacity:.88}85%{opacity:.45}100%{transform:translateY(800px) translateX(var(--gl-dx,12px));opacity:0}}
        `}</style>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────
  return (
    <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 2, display: "flex", flexDirection: "row", background: t.bg, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>

      <WinOverlay
        showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
        winner={winner} winnerColor={winnerColor} winnerPiece={winnerPiece}
        seriesDiffers={seriesDiffers} seriesColor={seriesColor} seriesPiece={seriesPiece}
        seriesWinner={seriesWinner} phase={phase} gameNumber={gameNumber}
        t={{ fontDisplay: t.fontDisplay, fontMono: t.fontMono, fontBody: t.fontBody }}
        winnerDisplayNameAction={winnerDisplayName}
        graphicsQuality={gameplayGraphicsQuality}
        onDismissAction={dismissOverlay}
      />

      <MatchupOverlay 
        matchupData={matchupData} 
        showMatchupOverlay={showMatchupOverlay} 
        playerSlot={playerSlot} 
        p1Name={p1Name} 
        user={user} 
        themeId={themeId} 
        t={t} 
        isRankedGame={isRankedGame} 
        matchupCountdown={matchupCountdown} 
        loadCustomTheme={loadCustomTheme}
      />
      {rbOverlay}

      <DisconnectModal
        show={showDisconnectModal}
        t={sidebarT} ip={ip}
        onGoHomeAction={() => { if (setScreenAction) setScreenAction("home"); }}
      />

      <LeftPanel
        t={sidebarT} ip={ip} p1c={p1c} p2c={p2c} pieceSkin={pieceSkin} p1RttMs={p1RttMs} p2RttMs={p2RttMs} panelW={panelW}
        phase={phase} winner={winner} current={current} gameNumber={gameNumber}
        matchHistory={matchHistory} seriesWinner={seriesWinner} matchOver={matchOver}
        gameMode={gameMode} isRankedGame={isRankedGame} isMultiplayerGame={isMultiplayerGame}
        isMultiplayer={isMultiplayerGame} mySlot={mySlot}
        boardMode={liveBoardMode} selectedPatterns={sidebarPatternList} rbBannedPatterns={sidebarRbBannedPatterns} patternsAsSecret={patternsSidebarSecret}
        p1SeriesPts={isMultiplayerGame ? p1SeriesPts : undefined} p2SeriesPts={isMultiplayerGame ? p2SeriesPts : undefined}
        p1Time={p1Time} p2Time={p2Time} readyTimeout={readyTimeout}
        p1Ready={p1Ready} p2Ready={p2Ready}
        chatMessages={chatMessages} chatInput={chatInput} chatOpen={chatOpen} chatWarning={chatWarning}
        unreadOpponentChat={unreadOpponentChat}
        log={log} botThinking={botThinking}
        showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
        winnerColor={winnerColor} winnerPiece={winnerPiece} seriesDiffers={seriesDiffers}
        seriesColor={seriesColor} seriesPiece={seriesPiece}
        showRematch={showRematch} rematchRequested={rematchRequested}
        showSurrender={showSurrender} showExitConfirm={showExitConfirm}
        setScreenAction={setScreenAction}
        p1Label={p1Label} p2Label={p2Label}
        p1Banner={p1Banner} p2Banner={p2Banner}
        winnerDisplayNameAction={winnerDisplayName}
        historyDisplayStartIndex={historyDisplayStartIndex}
        onReadyToggle={onReadyToggle}
        onSendChat={sendChat}
        onChatInputChange={setChatInput}
        onChatKeyDown={onChatKeyDown}
        onChatOpenToggle={() => {
          setChatOpen(v => {
            const next = !v;
            if (next) {
              setUnreadOpponentChat(0);
              setChatToastVisible(false);
              if (chatToastTimerRef.current) {
                clearTimeout(chatToastTimerRef.current);
                chatToastTimerRef.current = null;
              }
            }
            return next;
          });
        }}
        onSoftReset={softReset}
        onDismissOverlayAction={dismissOverlay}
        onRematchAction={() => { wsRef.current?.send(JSON.stringify({ type: "rematch" })); setRematchRequested(mySlot); }}
        onQuitMatchAction={() => { wsRef.current?.send(JSON.stringify({ type: "quit_match", slot: mySlot })); if (setScreenAction) setScreenAction("home"); }}
        onSurrenderConfirmAction={() => { setShowSurrender(false); if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot })); } if (setScreenAction) setScreenAction("home"); }}
        onSurrenderCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }}
        onExitConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }}
        onExitCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }}
        onShowSurrenderAction={() => { playClickAction?.(); pausedRef.current = true; setShowSurrender(true); }}
        onShowExitConfirmAction={() => { playClickAction?.(); pausedRef.current = true; setShowExitConfirm(true); }}
        onShowRematchOverlayAction={() => setShowRematch(true)}
        fmtTimeAction={fmtTime}
        segmentStartIndex={segmentStartIndex}
        playHoverAction={playHoverAction}
        playClickAction={playClickAction}
      />

      {isMultiplayerGame && chatToastVisible && unreadOpponentChat > 0 && (
        <div
          style={{
            position: "fixed",
            left: panelW + 16,
            bottom: 28,
            zIndex: 50,
            maxWidth: 280,
            padding: "10px 18px",
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${t.accent}88`,
            borderRadius: ip ? 2 : 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            fontFamily: t.fontMono,
            fontSize: 13,
            fontWeight: 700,
            color: t.accent,
            letterSpacing: "0.04em",
            pointerEvents: "none",
          }}
        >
          {unreadOpponentChat} new message{unreadOpponentChat > 1 ? "s" : ""}
        </div>
      )}

      {/* BOARD */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 0", minWidth: 0 }}>
        <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, width: "100%", position: "relative", paddingLeft: "2%" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.08em", background: c3Blocked ? `${t.danger}10` : `${t.gold}10`, border: `1px solid ${c3Blocked ? t.danger : t.gold}33`, borderRadius: 6, padding: "3px 14px", color: c3Blocked ? t.danger : t.gold, flexShrink: 0, visibility: phase === "playing" && movesPlayed === 0 && !(GRID_SIZE === 7 && suppressCenterOpening) && GRID_SIZE !== 6 ? "visible" : "hidden", opacity: phase === "playing" && movesPlayed === 0 && !(GRID_SIZE === 7 && suppressCenterOpening) && GRID_SIZE !== 6 ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }}>
            {c3Blocked ? "✕ Center (C3) is blocked this game" : "★ Playing center gives opponent 2 extra turns"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", background: `${winner ? winnerColor : cc}14`, border: `${ip ? 3 : 1}px solid ${winner ? winnerColor : cc}`, borderRadius: ip ? 2 : 24, transition: "background 0.25s, border-color 0.25s", flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: ip ? 0 : "50%", background: winner ? winnerColor : cc, transition: "background 0.25s" }} />
            <span style={{ fontFamily: t.fontDisplay, fontSize: ip ? 11 : 15, fontWeight: 700, color: winner ? winnerColor : cc, transition: "color 0.25s" }}>
              {winner
                ? (winner === "DRAW" ? "⚖ DRAW" : `${winnerPiece} ${winnerDisplayName(winner)} WINS`)
                : extraTurns > 0
                  ? `${cp} — ${current === "P1" ? p1Label : p2Label} EXTRA TURN ×${extraTurns}`
                  : `${cp} — ${current === "P1" ? p1Label : p2Label}'s Turn`
              }
            </span>
          </div>
          {GRID_SIZE === 7 && phase === "playing" && !winner && rbExtraTurnTokenHolder && !rbExtraTurnTokenUsed && extraTurns === 0 && (isMultiplayerGame ? mySlot === rbExtraTurnTokenHolder : current === rbExtraTurnTokenHolder) && (
            <button type="button" onClick={() => { playClickAction?.(); useRbExtraTurnToken(); }} title="Use once: your next move does not end your turn (then turns alternate normally). Center opening rule is off this game." style={{ flexShrink: 0, fontFamily: t.fontMono, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.accent}88`, background: `${t.accent}22`, color: t.accent, cursor: "pointer" }}>
              USE EXTRA TURN TOKEN
            </button>
          )}
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.08em", borderRadius: 6, padding: "3px 14px", flexShrink: 0, visibility: "hidden", pointerEvents: "none" }}>
            {c3Blocked ? "✕ Center (C3) is blocked this game" : "★ Playing center gives opponent 2 extra turns"}
          </div>
        </div>
        {/* Column labels + board — special boards render their own labels */}
        {renderMainBoard("desktop")}
      </div>

      <RightPanel
        t={sidebarT} ip={ip} p1c={p1c} p2c={p2c} panelW={panelW}
        phase={phase} log={log} isRankedGame={isRankedGame}
        setScreenAction={setScreenAction}
        onShowExitConfirmAction={() => { playClickAction?.(); pausedRef.current = true; setShowExitConfirm(true); }}
        playHoverAction={playHoverAction}
      />

        <SurrenderModal show={showSurrender} t={sidebarT} ip={ip} isRankedGame={isRankedGame} onConfirmAction={() => { setShowSurrender(false); if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) { wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot })); } if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }} playHoverAction={playHoverAction} />
      <ExitModal show={showExitConfirm} t={sidebarT} ip={ip} onConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }} playHoverAction={playHoverAction} />
      {limitbreakerOverlay}
      {showGameWinScreen && matchSeriesComplete && isMultiplayerGame && (
        <GameWinScreen
          seriesWinner={matchSeriesComplete.series_winner}
          format={matchSeriesComplete.format}
          p1={matchSeriesComplete.p1}
          p2={matchSeriesComplete.p2}
          mySlot={mySlot}
          t={{
            fontDisplay: t.fontDisplay,
            fontMono: t.fontMono,
            accent: t.accent,
            accentGlow: t.accentGlow,
            gold: t.gold,
            danger: t.danger,
            text: t.text,
            textSecondary: t.textSecondary,
            textMuted: t.textMuted,
          }}
          onContinue={matchSeriesComplete.format === "ranked"
            ? () => {
                setShowGameWinScreen(false);
                setShowRankedMatchResult(true);
              }
            : undefined}
          onRematch={() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "rematch" }));
            }
            setRematchRequested(mySlot);
          }}
          onQuit={() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot }));
            }
            setScreenAction?.("home");
          }}
          onGoToCareer={goToCareerAfterSeries}
        />
      )}
      {showRankedMatchResult && matchSeriesComplete && matchSeriesComplete.format === "ranked" && (
        <MatchResultScreen
          seriesWinner={matchSeriesComplete.series_winner}
          format={matchSeriesComplete.format}
          p1={matchSeriesComplete.p1}
          p2={matchSeriesComplete.p2}
          mySlot={mySlot}
          t={{
            fontDisplay: t.fontDisplay,
            fontMono: t.fontMono,
            accent: t.accent,
            accentGlow: t.accentGlow,
            gold: t.gold,
            danger: t.danger,
            text: t.text,
            textSecondary: t.textSecondary,
            textMuted: t.textMuted,
          }}
          onRematch={() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "rematch" }));
            }
            setRematchRequested(mySlot);
          }}
          onQuit={() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "quit_match", slot: mySlot }));
            }
            setScreenAction?.("home");
          }}
        />
      )}

      <style>{`
        @keyframes heatDrift0{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,18px) scale(1.1)}}
        @keyframes heatDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-15px,8px) scale(0.95)}}
        @keyframes heatDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(8px,-12px) scale(1.08)}}
        @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7),inset 0 0 16px rgba(255,40,0,0.2)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes levelUpPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:0.9}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.88) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes rbLetterIn{from{opacity:0;transform:translateY(40px) scaleY(1.4)}to{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes rbSubIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rbLineIn{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
        @keyframes rbRingPulse{from{opacity:0;transform:scale(0.3)}to{opacity:1;transform:scale(1)}}
        @keyframes winPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.82;transform:scale(1.03)}}
        @keyframes urgentPulse{0%,100%{opacity:1}50%{opacity:0.45}}
        @keyframes coinReveal{from{opacity:0;transform:scale(0.5) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
        @keyframes cardSlideIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes spinRing{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes botPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
        @keyframes winCellPulse{0%,100%{background:color-mix(in srgb, var(--win-col) 25%, transparent);box-shadow:0 0 8px color-mix(in srgb, var(--win-col) 40%, transparent)}50%{background:color-mix(in srgb, var(--win-col) 60%, transparent);box-shadow:0 0 16px color-mix(in srgb, var(--win-col) 70%, transparent)}}
        @keyframes victoryGlow{0%,100%{opacity:0.6}50%{opacity:0.9}}
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes glitch{0%{transform:translate(0)}20%{transform:translate(-2px,2px)}40%{transform:translate(-2px,-2px)}60%{transform:translate(2px,2px)}80%{transform:translate(2px,-2px)}100%{transform:translate(0)}}
        @keyframes thump{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.03);filter:brightness(1.15)}}
        .win-cell-pulse{animation:winCellPulse 0.65s ease-in-out infinite}
        .overlay-modal{animation:scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both}
        .overlay-backdrop{animation:fadeIn 0.3s ease both}
        .phase-screen{animation:fadeUp 0.42s cubic-bezier(.22,.68,0,1.2) both}
        .action-btn{transition:background 0.25s cubic-bezier(.22,.68,0,1.2),color 0.25s cubic-bezier(.22,.68,0,1.2),transform 0.2s cubic-bezier(.22,.68,0,1.2),box-shadow 0.25s cubic-bezier(.22,.68,0,1.2) !important}
        .action-btn:hover{transform:scale(1.05) !important}
        .action-btn:active{transform:scale(0.97) !important}
        .glitch-overlay{animation:glitch 0.25s infinite alternate}
        .thump-anim{animation:thump 0.5s ease-in-out infinite}
        @keyframes iceD0{from{transform:translate(0,0)}to{transform:translate(8px,12px)}}
        @keyframes iceD1{from{transform:translate(0,0)}to{transform:translate(-10px,6px)}}
        @keyframes iceD2{from{transform:translate(0,0)}to{transform:translate(6px,-9px)}}
        @keyframes iceWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(100,200,255,0.3)}50%{box-shadow:0 0 28px rgba(100,200,255,0.7),inset 0 0 16px rgba(60,160,255,0.2)}}
        @keyframes glAurora1{from{transform:translate(-2%,0) scale(1)}to{transform:translate(4%,8%) scale(1.08)}}
        @keyframes glAurora2{from{transform:translate(0,0) scale(1)}to{transform:translate(-5%,6%) scale(1.06)}}
        @keyframes glAurora3{from{transform:translate(0,0) scale(1)}to{transform:translate(3%,-7%) scale(1.05)}}
        @keyframes glSnowFall{0%{transform:translateY(-8px) translateX(0px);opacity:0}8%{opacity:.88}85%{opacity:.45}100%{transform:translateY(800px) translateX(var(--gl-dx,12px));opacity:0}}
      `}</style>
    </div>
  );
}