"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { ThemeId, THEMES } from "@/lib/themes";
import { checkWin, Coord } from "@/lib/winChecker";
import { checkWin7 } from "@/lib/winChecker7";
import type { BoardMode } from "@/lib/types";
import API from "@/lib/api";
import { censorText, containsProfanity } from "@/lib/profanity";
import type { Screen } from "@/lib/types";
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
import { LeftPanel, RightPanel, WinOverlay, RematchOverlay, SurrenderModal, DisconnectModal, ExitModal } from "./MatchSidebar";
import { useAuthStore } from "@/lib/store";
import { BannerRenderer } from "./BannerRenderer";
import { RANKS, RankIcon } from "./ProfileScreen";
import { getUserKey, pushMissionEvent } from "@/lib/missionsClient";

function getWsBaseUrl(): string {
  const envBase = process.env.NEXT_PUBLIC_API_URL;
  if (envBase) return envBase.replace("https://", "wss://").replace("http://", "ws://");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
    return `${proto}${window.location.host}`;
  }
  return "ws://localhost:8000";
}

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
    fontFamily: themeId === "pixel" ? "'Press Start 2P', cursive" : themeId === "space" ? "'Polaris', sans-serif" : "'Press Start 2P', cursive",
    fontSize: "clamp(60px,12vw,160px)",
    fontWeight: 950,
    color: t.accent,
    textShadow: `0 0 80px ${t.accent}AA`,
    zIndex: 10,
    letterSpacing: "-0.05em"
  };

  const UserCard = ({ data, color, isP1 }: { data: any, color: string, isP1: boolean }) => {
    const rank = getRankData(data.elo);
    const sideBySideSize = 280;

    return (
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {/* Banner with extra visibility and shine */}
        <div style={{ position: "absolute", inset: 0, opacity: 1 }}>
          <BannerRenderer bannerId={data.banner} hideLabels />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", zIndex: 1 }} />
          {/* Intense Shiny Overlay */}
          <div style={{ 
            position: "absolute", inset: 0, 
            background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.4) 45%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 55%, transparent 65%)", 
            backgroundSize: "200% 100%", 
            animation: "bannerShine 1.8s infinite cubic-bezier(0.4, 0, 0.2, 1)", 
            zIndex: 2, pointerEvents: "none",
            filter: "blur(4px)"
          }} />
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
             boxShadow: `0 30px 80px rgba(0,0,0,0.9), 0 0 60px ${color}88`,
             flexShrink: 0
           }}>👤</div>
           
           {/* Center: Large ELO and User Info */}
           <div style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", gap: 15 }}>
             <div style={{ 
               fontFamily: t.fontDisplay, fontSize: 62, fontWeight: 950, color: color, 
               textShadow: `0 0 50px ${color}, 0 0 20px rgba(255,255,255,0.4)`, 
               letterSpacing: "0.1em",
               transform: "scale(1.1)"
             }}>
               {data.name.toUpperCase()}
             </div>
             
             <div style={{ 
               display: "inline-flex", alignSelf: "center", flexDirection: "column", alignItems: "center", 
               padding: "24px 60px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(30px)", 
               borderRadius: 24, border: `2px solid ${color}44`, 
               boxShadow: `0 20px 60px rgba(0,0,0,0.8), inset 0 0 20px ${color}22`
             }}>
               <div style={{ fontFamily: t.fontMono, fontSize: 16, color: t.textMuted, letterSpacing: "0.3em", marginBottom: 6, opacity: 0.7 }}>ELO RATING</div>
               <div style={{ 
                 fontFamily: t.fontDisplay, fontSize: 96, fontWeight: 950, color: t.accent, 
                 textShadow: `0 0 30px ${t.accent}AA, 0 0 60px ${t.accent}44`,
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
             justifyContent: "center", animation: "rankFloat 3.5s ease-in-out infinite",
             flexShrink: 0
           }}>
             <RankIcon rank={rank} size={sideBySideSize} />
           </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes bannerShine { from { background-position: -100% 0; } to { background-position: 100% 0; } }
        @keyframes rankFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
      
      <div style={{ textAlign: "center", paddingTop: 40, fontFamily: t.fontMono, fontSize: 14, fontWeight: 700, color: t.textMuted, letterSpacing: "0.3em", zIndex: 15, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
        {isRankedGame ? "RANKED MATCHUP" : "UNRANKED EXHIBITION"} · BEST OF 3
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
  setScreenAction?: (s: Screen) => void;
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
}

export default function GameScreen({ themeId, setThemeIdAction, isSingleplayer, gameMode = "singleplayer", difficulty = "medium", setScreenAction, roomCode, playerSlot, playHoverAction, playPlaceAction, playVictoryAction, playDefeatAction, playRulebreakerAction, playTransitionAction, playClickAction, p1Name, matchupData, boardMode = "5x5", selectedPatterns = [] }: Props) {
  const GRID_SIZE = boardMode === "7x7" ? 7 : 5;
  const CENTER = boardMode === "7x7" ? 3 : 2;
  const is7x7 = boardMode === "7x7";
  const { user } = useAuthStore();
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
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

  const emptyBoard = (): (string | null)[][] => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

  const [board, setBoard] = useState<(string | null)[][]>(emptyBoard());
  const [current, setCurrent] = useState("P1");
  const [winner, setWinner] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<Coord[]>([]);
  const [connectionScores, setConnectionScores] = useState<{ p1: number; p2: number } | undefined>(undefined);
  const [showWinOverlay, setShowWinOverlay] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [extraTurns, setExtraTurns] = useState(0);
  const [c3Blocked, setC3Blocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [log, setLog] = useState<{ text: string; player: string }[]>([]);

  const [p1Time, setP1Time] = useState(180000);
  const [p2Time, setP2Time] = useState(180000);

  const [gameNumber, setGameNumber] = useState(1);
  const [matchHistory, setMatchHistory] = useState<string[]>([]);
  const [matchOver, setMatchOver] = useState(false);
  const [seriesWinner, setSeriesWinner] = useState<string | null>(null);
  const didRecordMissionRef = useRef(false);
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ from: "P1" | "P2"; text: string; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWarning, setChatWarning] = useState(false);
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
  const [rbBannedPattern, setRbBannedPattern] = useState<string | null>(null);
  const [summaryTimer, setSummaryTimer] = useState(5);
  const [choiceTimer, setChoiceTimer] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [botPickedSide, setBotPickedSide] = useState<"left" | "right" | null>(null);

  // Mobile log drawer
  const [showMobileLog, setShowMobileLog] = useState(false);

  const activePatterns = useMemo(
    () => rbBannedPattern ? selectedPatterns.filter(p => p !== rbBannedPattern) : selectedPatterns,
    [selectedPatterns, rbBannedPattern],
  );

  // ── Timer values stored in refs so rAF can read/write without setState loops ──
  const p1TimeRef = useRef(180000);
  const p2TimeRef = useRef(180000);
  const matchupCountdownRef = useRef(10.0);

  const fmtTime = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const fmtSecAction = (s: number) => `${Math.ceil(Math.max(0, s))}`;

  const R = useRef({
    phase: "playing" as Phase, current: "P1", winner: null as string | null,
    p1Ready: false, p2Ready: false, readyTimeout: 60, readyTimer: 0,
    coinResult: null as "PENTA" | "PROTO" | null, matchOver: false, gameNumber: 1,
    matchHistory: [] as string[], firstPlayerChosen: null as string | null,
    tossWinner: null as "P1" | "P2" | null, rbC3Blocked: false, rbBannedPattern: null as string | null, summaryTimer: 5, choiceTimer: 0,
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
  R.current.rbBannedPattern = rbBannedPattern;
  R.current.summaryTimer = summaryTimer;
  R.current.choiceTimer = choiceTimer;

  const boardRef = useRef(board);
  const extraTurnsRef = useRef(extraTurns);
  const movesPlayedRef = useRef(movesPlayed);
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
                const wl = (msg.win_line ?? []) as [number, number][];
                setWinLine(wl);
                if (msg.connectionScores) setConnectionScores(msg.connectionScores);
                setWinner(msg.winner);
                if (msg.winner === "P1") playVictoryAction?.(); else playDefeatAction?.();
                requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
                const newHist = [...matchHistoryRef.current, msg.winner as string];
                matchHistoryRef.current = newHist;
                setMatchHistory([...newHist]);
                const sw = checkSeriesWinner(newHist);
                if (newHist.length >= 3 || sw !== null) {
                  setMatchOver(true);
                  setSeriesWinner(sw ?? newHist[newHist.length - 1]);
                  setPhase("match_over");
                  wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
                } else if (newHist.length === 2) {
                  setGameNumber(3);
                  // Go to ready phase before rulebreaker — don't start toss immediately
                  setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
                } else {
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
          }
            } else if (msg.type === "opponent_disconnected") {
          setPhase("match_over");
          setShowDisconnectModal(true);
            } else if (msg.type === "ready_update") {
          if (msg.player === "P1") setP1Ready(msg.ready);
          else setP2Ready(msg.ready);
            } else if (msg.type === "chat_message") {
          setChatMessages(m => [...m.slice(-49), { from: msg.from, text: msg.text, ts: msg.ts }]);
            } else if (msg.type === "game_reset") {
          setBoard(emptyBoard());
          setCurrent(msg.first_player);
          setMovesPlayed(0);
          setExtraTurns(0);
          setWinner(null);
          setWinLine([]);
          setShowWinOverlay(false);
          setOverlayVisible(false);
          setC3Blocked(msg.c3_blocked ?? false);
          setLog([]);
          setP1Time(180000);
          setP2Time(180000);
          p1TimeRef.current = 180000;
          p2TimeRef.current = 180000;
          lastP1Sec.current = -1;
          lastP2Sec.current = -1;
          setP1Ready(false);
          setP2Ready(false);
          setShowRematch(false);
          setRematchRequested(null);
          setPhase("playing");
          const incomingGame = msg.game_number ?? 1;
          if (incomingGame === 1) {
            if (msg.last_series) {
              setLastSeries(msg.last_series);
            } else {
              // Fallback: snapshot current local state before wipe
              setLastSeries({ winner: seriesWinner, history: [...matchHistory] });
            }
            matchHistoryRef.current = [];
            setMatchHistory([]);
            setGameNumber(1);
            setMatchOver(false);
            setSeriesWinner(null);
            setChatMessages([]);
          } else {
            if (msg.game_number) setGameNumber(msg.game_number);
          }
        } else if (msg.type === "match_over") {
          setShowRematch(true);
        } else if (msg.type === "rematch_request") {
          setRematchRequested(msg.from);
        } else if (msg.type === "match_disbanded") {
          if (setScreenAction) setScreenAction("home");
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
            const _rbPhases = ["rb_splash", "rb_coin", "rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "toss_summary"];
            if (_rbPhases.includes(_curPhase)) {
              // already in rulebreaker
            } else setTimeout(() => {
              setWinner(null); setWinLine([]); setShowWinOverlay(false); setOverlayVisible(false);
              setPhase("rb_splash"); setRbSplashTimer(5);
              setCoinFlipTimer(rbCoinFlipSeconds); setCoinRevealTimer(0); setCoinResult(null);
              coinAngleRef.current = 0; coinFrameRef.current = 0; setCoinAngle(0);
              coinStartTimeRef.current = 0; // will be set when rb_coin phase starts
              setTossWinner(null); setFirstPlayerChosen(null); setRbC3Blocked(false); setRbBannedPattern(null);
              setWinnerPickedRule(null); setWinnerPickedFirst(null); setWinnerPickedC3(null);
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
            if (payload.phase) setPhase(payload.phase);
            if (payload.firstPlayerChosen !== undefined) setFirstPlayerChosen(payload.firstPlayerChosen);
            if (payload.rbC3Blocked !== undefined) setRbC3Blocked(payload.rbC3Blocked);
            if (payload.summaryTimer !== undefined) setSummaryTimer(payload.summaryTimer);
            if (payload.winnerPickedRule !== undefined) setWinnerPickedRule(payload.winnerPickedRule);
            if (payload.winnerPickedFirst !== undefined) setWinnerPickedFirst(payload.winnerPickedFirst);
            if (payload.winnerPickedC3 !== undefined) setWinnerPickedC3(payload.winnerPickedC3);
            if (payload.rbBannedPattern !== undefined) setRbBannedPattern(payload.rbBannedPattern);
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
    // Cosmetic delay before calling API (server search unchanged). DANGER 7×7: extra minimum
    // “think” time for the bot’s first two moves so it doesn’t feel instant vs HARD.
    const delays: Record<string, number> = {
      easy: 400,
      medium: 850,
      hard: 0,
      danger: 0,
    };
    const delay = delays[difficulty] ?? 850;

    setBotThinking(true);

    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        const b = boardRef.current;
        let p2Stones = 0;
        for (const row of b) for (const cell of row) if (cell === "P2") p2Stones++;
        const is77 = boardMode === "7x7" || b?.length === 7;
        const needMinDangerThink =
          difficulty === "danger" && is77 && p2Stones < 2;
        const dangerMinThinkMs = 1000;

        const t0 = Date.now();
        const res = await API.post("/api/bot/move", {
          board: b, difficulty, current_player: "P2",
          board_mode: boardMode || (b?.length === 7 ? "7x7" : "5x5"),
          selected_patterns: activePatterns,
          c3_blocked: c3Blocked,
          moves_played: movesPlayedRef.current,
        });
        if (cancelled) return;
        if (needMinDangerThink) {
          const elapsed = Date.now() - t0;
          if (elapsed < dangerMinThinkMs) {
            await new Promise<void>(r => setTimeout(r, dangerMinThinkMs - elapsed));
          }
        }
        if (cancelled) return;
        const { row, col } = res.data ?? res;
        if (typeof row === "number" && typeof col === "number") await placeBot(row, col);
      } catch (err) {
        console.error("Bot move failed:", err);
      } finally {
        if (!cancelled) setBotThinking(false);
      }
    }, delay);

    return () => { cancelled = true; clearTimeout(timer); setBotThinking(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botTurnKey, phase, winner, gameMode, boardMode, activePatterns, difficulty]);

  const initBoard = async (firstPlayer: string, c3block = false) => {
    setBoard(emptyBoard());
    setCurrent(firstPlayer);
    setWinner(null);
    setConnectionScores(undefined);
    setWinLine([]);
    setShowWinOverlay(false);
    setOverlayVisible(false);
    setMovesPlayed(0);
    setExtraTurns(0);
    setC3Blocked(c3block);
    setLog([]);
    p1TimeRef.current = 180000;
    p2TimeRef.current = 180000;
    lastP1Sec.current = -1;
    lastP2Sec.current = -1;
    setP1Time(180000);
    setP2Time(180000);
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
    setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0);
    setRbSplashTimer(5); setCoinFlipTimer(rbCoinFlipSeconds); setCoinRevealTimer(0); setCoinResult(null);
    setCoinAngle(0); setTossWinner(null); setFirstPlayerChosen(null); setRbC3Blocked(false); setRbBannedPattern(null);
    setSummaryTimer(5); setOverlayVisible(false); setChoiceTimer(0);
    setShowRematch(false); setRematchRequested(null);
    setWinnerPickedRule(null); setWinnerPickedFirst(null); setWinnerPickedC3(null);
    setPhase("playing");
    initBoard("P1");
  };

  const checkSeriesWinner = (hist: string[]): string | null => {
    if (hist.length < 2) return null;
    const [g1, g2] = hist;
    // 2-0 sweep: always decisive
    if (g1 === g2 && (g1 === "P1" || g1 === "P2")) return g1;
    // WIN + DRAW or DRAW + WIN
    if ((g1 !== "DRAW" && g2 === "DRAW") || (g2 !== "DRAW" && g1 === "DRAW")) {
      // Non-ranked: force rulebreaker
      if (!isRankedGame) {
        if (hist.length >= 3) {
          const g3 = hist[2];
          const originalWinner = g1 !== "DRAW" ? g1 : g2;
          return g3 === originalWinner ? originalWinner : "DRAW";
        }
        return null; // force rulebreaker
      }
      // Ranked fallback
      return g1 !== "DRAW" ? g1 : g2;
    }
    // Both draws
    if (g1 === "DRAW" && g2 === "DRAW") {
      return hist.length >= 3 ? hist[2] : null;
    }
    // Different winners — rulebreaker
    if (hist.length >= 3) return hist[hist.length - 1];
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
    const tossChoicePhases: Phase[] = ["rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser"];
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
      if (pausedRef.current && !freePhases.includes(s.phase)) return;

      if (s.phase === "playing" && !s.winner) {
        if (s.current === "P1") {
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
              const newHist = [...matchHistoryRef.current, w];
              matchHistoryRef.current = newHist;
              R.current.matchHistory = newHist;
              setMatchHistory([...newHist]);
              const sw = checkSeriesWinner(newHist);
              if (newHist.length >= 3 || sw !== null) {
                setMatchOver(true);
                setSeriesWinner(sw ?? newHist[newHist.length - 1]);
                setPhase("match_over");
                wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
              } else if (newHist.length === 2) {
                setGameNumber(3);
                if (mySlot === "P1") wsRef.current?.send(JSON.stringify({ type: "toss_action", action: "start_rb", payload: {} }));
              } else {
                setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
              }
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
              const newHist = [...matchHistoryRef.current, w];
              matchHistoryRef.current = newHist;
              R.current.matchHistory = newHist;
              setMatchHistory([...newHist]);
              const sw = checkSeriesWinner(newHist);
              if (newHist.length >= 3 || sw !== null) {
                setMatchOver(true);
                setSeriesWinner(sw ?? newHist[newHist.length - 1]);
                setPhase("match_over");
                wsRef.current?.send(JSON.stringify({ type: "match_over_notify" }));
              } else if (newHist.length === 2) {
                setGameNumber(3);
                // Go to ready phase before rulebreaker — don't start toss immediately
                setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
              } else {
                setP1Ready(false); setP2Ready(false); setReadyTimeout(60); setReadyTimer(0); setPhase("waiting_ready");
              }
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
      if (tossChoicePhases.includes(s.phase) && s.choiceTimer > 0) {
        choiceTimerRef.current -= dt / 1000;
        if (choiceTimerRef.current <= 0) { choiceTimerRef.current = 0; setChoiceTimer(0); autoPickLeft(s.phase); }
        else { const sec = Math.ceil(choiceTimerRef.current); if (sec !== lastChoiceSec.current) { lastChoiceSec.current = sec; setChoiceTimer(choiceTimerRef.current); } }
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
                   initBoard(fp, s.rbC3Blocked);
                }
            }
          }
          if (nv <= 0) {
            const fp = s.firstPlayerChosen ?? s.tossWinner ?? "P1";
            const _isMP2 = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
            if (_isMP2) {
              if (s.tossWinner === mySlot) wsRef.current?.send(JSON.stringify({ type: "rb_start_game", first_player: fp, c3_blocked: s.rbC3Blocked }));
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
    if (p === "rule_choice") {
      if (is7x7) { setWinnerPickedRule("first"); setPhase("who_first_winner"); }
      else { setPhase("who_first_winner"); }
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tw);
      if (is7x7) { setPhase("ban_pattern_loser"); }
      else { setPhase("c3_choice_loser"); }
    }
    else if (p === "c3_choice") { setRbC3Blocked(true); setPhase("who_first_loser"); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(true); setSummaryTimer(5); setPhase("toss_summary"); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tl); setSummaryTimer(5); setPhase("toss_summary"); }
    else if (p === "ban_pattern_winner") {
      const first = selectedPatterns[0] ?? null;
      setRbBannedPattern(first); setSummaryTimer(5); setPhase("who_first_loser");
    }
    else if (p === "ban_pattern_loser") {
      const first = selectedPatterns[0] ?? null;
      setRbBannedPattern(first); setSummaryTimer(5); setPhase("toss_summary");
    }
  };
  const doAdvanceAfterReady = () => {
    const gn = R.current.gameNumber;
    if (R.current.matchOver) return;
    setWinner(null); setShowWinOverlay(false); setOverlayVisible(false);
    if (gn >= 2) {
      // Rulebreaker transition
      if (isMultiplayerGame) {
        // In multiplayer, P1 initiates the toss via WS
        if (mySlot === "P1") {
          const r = Math.random() < 0.5 ? "PENTA" : "PROTO";
          const payload = { result: r, toss_winner: r === "PENTA" ? "P1" : "P2" };
          wsRef.current?.send(JSON.stringify({ type: "toss_action", action: "start_rb", payload }));
        }
        // Phase will transition when toss_action broadcasts back
      } else {
        setGameNumber(3); setPhase("rb_splash"); playRulebreakerAction?.();
        setRbSplashTimer(5); setCoinFlipTimer(rbCoinFlipSeconds); setCoinRevealTimer(0);
        setCoinResult(null); setCoinAngle(0); setTossWinner(null);
        setFirstPlayerChosen(null); setRbC3Blocked(false); setRbBannedPattern(null); setSummaryTimer(5);
      }
    } else {
      setGameNumber(2); setPhase("playing"); initBoard("P2");
    }
  };

  useEffect(() => {
    if (!winner) return;
    const _isMP = (gameMode === "ranked" || gameMode === "unranked") && !!roomCode;
    if (_isMP) return;
    if (phase !== "playing") return;
    if (winner === "P1") playVictoryAction?.(); else if (winner === "P2") playDefeatAction?.();
    requestAnimationFrame(() => { setShowWinOverlay(true); requestAnimationFrame(() => setOverlayVisible(true)); });
    const newHist = [...R.current.matchHistory, winner];
    // keep ref in sync immediately so checkSeriesWinner sees the updated history
    R.current.matchHistory = newHist;
    matchHistoryRef.current = newHist;
    setMatchHistory(newHist);
    const sw = checkSeriesWinner(newHist);
    if (newHist.length >= 3 || sw !== null) {
      setMatchOver(true);
      setSeriesWinner(sw ?? newHist[newHist.length - 1]);
      setPhase("match_over");
    } else {
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
    nb[r][c] = playerWhoMoved;
    const newMoves = currentMoves + 1;
    let newExtra = currentExtra, nextPlayer: string = "P1";
    if (newMoves === 1 && r === CENTER && c === CENTER) { nextPlayer = "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = "P1"; else nextPlayer = "P2"; }
    else { nextPlayer = "P1"; }
    const result = boardMode === "7x7" ? checkWin7(nb, r, c, playerWhoMoved, newMoves, activePatterns) : checkWin(nb, r, c, playerWhoMoved, newMoves);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch { } }
  };

  const place = async (r: number, c: number) => {
    if (phase !== "playing" || board[r][c] || winner || loading) return;
    if (gameMode === "ai" && current === "P2") return;
    if (c3Blocked && movesPlayed === 0 && r === CENTER && c === CENTER) return;
    if (isMultiplayerGame) {
      if (current !== mySlot) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      playPlaceAction?.();
      wsRef.current.send(JSON.stringify({ type: "move", row: r, col: c }));
      return;
    }
    playPlaceAction?.();
    setLoading(true);
    const playerWhoMoved = current;
    const nb = board.map(row => [...row]);
    nb[r][c] = playerWhoMoved;
    const newMoves = movesPlayed + 1;
    let newExtra = extraTurns, nextPlayer = current;
    if (newMoves === 1 && r === CENTER && c === CENTER) { nextPlayer = current === "P1" ? "P2" : "P1"; newExtra = 2; }
    else if (newExtra > 0) { newExtra--; if (newExtra === 0) nextPlayer = current === "P1" ? "P2" : "P1"; }
    else { nextPlayer = current === "P1" ? "P2" : "P1"; }
    if (c3Blocked && newMoves === 1) setC3Blocked(false);
    const result = boardMode === "7x7" ? checkWin7(nb, r, c, playerWhoMoved, newMoves, activePatterns) : checkWin(nb, r, c, playerWhoMoved, newMoves);
    setBoard(nb); setMovesPlayed(newMoves); addLog(r, c, playerWhoMoved);
    if (result) { setExtraTurns(0); setWinLine(result.line); setWinner(result.winner); }
    else { setExtraTurns(newExtra); setCurrent(nextPlayer); }
    setLoading(false);
    if (gameId) { try { await API.post("/api/game/move", { game_id: gameId, row: r, col: c }); } catch { } }
  };
  // Stable ref so boardJSX memo never holds a stale place closure
  const placeRef = useRef(place);
  useEffect(() => { placeRef.current = place; });

  // For glacier board: convert "P1"/"P2" → "X"/"O" so GlacierGrid component renders correctly
  const glacierBoard = React.useMemo(
    () => isGlacierBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isGlacierBoard, board]
  );
  const bloodMoonBoard = React.useMemo(
    () => isBloodMoonBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isBloodMoonBoard, board]
  );
  const egyptBoard = React.useMemo(
    () => isEgyptBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isEgyptBoard, board]
  );
  const synthwaveBoard = React.useMemo(
    () => isSynthwaveBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isSynthwaveBoard, board]
  );
  const matrixBoard = React.useMemo(
    () => isMatrixBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isMatrixBoard, board]
  );
  const arcaneBoard = React.useMemo(
    () => isArcaneBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isArcaneBoard, board]
  );
  const bioBoard = React.useMemo(
    () => isBioBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isBioBoard, board]
  );
  const forgeBoard = React.useMemo(
    () => isForgeBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isForgeBoard, board]
  );
  const voidBoard = React.useMemo(
    () => isVoidBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isVoidBoard, board]
  );
  const tokyoBoard = React.useMemo(
    () => isTokyoBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isTokyoBoard, board]
  );
  const spaceBoard = React.useMemo(
    () => isSpaceBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isSpaceBoard, board]
  );
  const pixelBoard = React.useMemo(
    () => isPixelBoard ? board.map(row => row.map(cell => cell === "P1" ? "X" : cell === "P2" ? "O" : null)) : null,
    [isPixelBoard, board]
  );
  const glacierClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const bloodMoonClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const egyptClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const synthwaveClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const matrixClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const arcaneClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const bioClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const forgeClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const voidClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const tokyoClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const spaceClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );
  const pixelClick = React.useCallback(
    (r: number, c: number) => { if (!winner && phase === "playing") placeRef.current(r, c); },
    [winner, phase]
  );

  const addLog = (r: number, c: number, player: string) => {
    const piece = player === "P1" ? t.pieces.p1 : t.pieces.p2;
    setLog(l => [...l, { text: `${l.length + 1}. ${piece}→${String.fromCharCode(65 + c)}${r + 1} (${player})`, player }]);
  };

  const dismissOverlay = useCallback(() => { setOverlayVisible(false); setTimeout(() => setShowWinOverlay(false), 320); }, []);

  const broadcastTossPhase = useCallback((ph: string, extra: Record<string, unknown> = {}) => {
    if (isMultiplayerGame && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "toss_action", action: "phase_choice", payload: { phase: ph, ...extra } }));
    }
  }, [isMultiplayerGame]);

  const onLeftAction = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      setWinnerPickedRule("first"); setPhase("who_first_winner"); broadcastTossPhase("who_first_winner", { winnerPickedRule: "first" });
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tw); setWinnerPickedFirst(tw ?? null);
      if (is7x7) { setPhase("ban_pattern_loser"); broadcastTossPhase("ban_pattern_loser", { firstPlayerChosen: tw, winnerPickedFirst: tw }); }
      else { setPhase("c3_choice_loser"); broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tw, winnerPickedFirst: tw }); }
    }
    else if (p === "c3_choice") { setRbC3Blocked(true); setWinnerPickedC3(true); setPhase("who_first_loser"); broadcastTossPhase("who_first_loser", { rbC3Blocked: true, winnerPickedC3: true }); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(true); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { rbC3Blocked: true, summaryTimer: 5 }); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tl); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { firstPlayerChosen: tl, summaryTimer: 5 }); }
  }, [broadcastTossPhase, is7x7]);

  const onRightAction = useCallback(() => {
    const p = R.current.phase; const tw = R.current.tossWinner; const tl = tw === "P1" ? "P2" : "P1";
    if (p === "rule_choice") {
      if (is7x7) { setWinnerPickedRule("ban"); setPhase("ban_pattern_winner"); broadcastTossPhase("ban_pattern_winner", { winnerPickedRule: "ban" }); }
      else { setWinnerPickedRule("c3"); setPhase("c3_choice"); broadcastTossPhase("c3_choice", { winnerPickedRule: "c3" }); }
    }
    else if (p === "who_first_winner") {
      setFirstPlayerChosen(tl); setWinnerPickedFirst(tl ?? null);
      if (is7x7) { setPhase("ban_pattern_loser"); broadcastTossPhase("ban_pattern_loser", { firstPlayerChosen: tl, winnerPickedFirst: tl }); }
      else { setPhase("c3_choice_loser"); broadcastTossPhase("c3_choice_loser", { firstPlayerChosen: tl, winnerPickedFirst: tl }); }
    }
    else if (p === "c3_choice") { setRbC3Blocked(false); setWinnerPickedC3(false); setPhase("who_first_loser"); broadcastTossPhase("who_first_loser", { rbC3Blocked: false, winnerPickedC3: false }); }
    else if (p === "c3_choice_loser") { setRbC3Blocked(false); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { rbC3Blocked: false, summaryTimer: 5 }); }
    else if (p === "who_first_loser") { setFirstPlayerChosen(tw); setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { firstPlayerChosen: tw, summaryTimer: 5 }); }
  }, [broadcastTossPhase, is7x7]);

  const onBanPattern = useCallback((patternName: string) => {
    const p = R.current.phase;
    setRbBannedPattern(patternName);
    if (p === "ban_pattern_winner") {
      setPhase("who_first_loser"); broadcastTossPhase("who_first_loser", { rbBannedPattern: patternName });
    } else if (p === "ban_pattern_loser") {
      setSummaryTimer(5); setPhase("toss_summary"); broadcastTossPhase("toss_summary", { rbBannedPattern: patternName, summaryTimer: 5 });
    }
  }, [broadcastTossPhase]);

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
        const rndIdx = Math.floor(Math.random() * selectedPatterns.length);
        const patToBan = selectedPatterns[rndIdx] ?? selectedPatterns[0];
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
  }, [phase, tossWinner, gameMode, onLeftAction, onRightAction, onBanPattern, selectedPatterns]);

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
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${GRID_SIZE},${bigCs})`, gridTemplateRows: `repeat(${GRID_SIZE},${bigCs})`, gap: `${boardGap}px`, background: isRedBoard ? "rgba(10,2,1,0.99)" : (isIceBoard || isGlacierBoard) ? "linear-gradient(135deg,rgba(3,8,20,0.98),rgba(1,4,14,0.99))" : t.boardLine, padding: `${boardPad}px`, borderRadius: ip ? 2 : 10, border: `${ip ? 3 : 2}px solid ${isRedBoard ? "rgba(140,20,0,0.35)" : isGlacierBoard ? "rgba(125,211,252,0.42)" : (isIceBoard ? "rgba(80,160,220,0.28)" : t.border)}`, boxShadow: isRedBoard ? "0 0 50px rgba(180,20,0,0.1), inset 0 0 40px rgba(0,0,0,0.7)" : isGlacierBoard ? "0 0 58px rgba(90,190,255,0.12), inset 0 0 46px rgba(0,0,0,0.74)" : (isIceBoard ? "0 0 50px rgba(80,160,255,0.08), inset 0 0 40px rgba(0,0,0,0.7)" : "none"), overflow: "hidden" }}>
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
        const blk = c3Blocked && movesPlayed === 0 && r === CENTER && c === CENTER;
        const isHov = hover === key && !cell && !winner && !blk && phase === "playing";
        const isWin = winLine.some(([wr, wc]) => wr === r && wc === c);
        const ec = cell === "P1" ? p1c : p2c;
        const canPlay = !cell && !winner && !blk && phase === "playing";
        if (isRedBoard) return (<RedCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={useGlacierSigils} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} />);
        if (isIceBoard || isGlacierBoard) return (<IceCell key={key} cellSize={bigCs} player={cell} isWinCell={isWin} isHov={isHov} canPlay={canPlay} blk={blk} useFlameSkull={useFlameSkull} useSnowflakeShard={useSnowflakeShard} useGlacierSigils={useGlacierSigils} pieceSymbols={pieceSymbols} p1c={p1c} p2c={p2c} fontDisplay={t.fontDisplay} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} />);
        return (
          <div key={key} onClick={() => placeRef.current(r, c)} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} className={isWin ? "win-cell-pulse" : ""}
            style={{ "--win-col": ec, width: bigCs, height: bigCs, background: blk ? `${t.danger}18` : isWin ? `${ec}28` : isHov ? `${cc}22` : t.boardBg, border: `2px solid ${blk ? t.danger : isWin ? ec : isHov ? cc : t.boardLine}`, borderRadius: ip ? 0 : 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: canPlay ? (isHov ? "grabbing" : "grab") : "default", fontSize: "clamp(24px,5.5vmin,58px)", fontFamily: t.fontDisplay, fontWeight: 700, color: ec, textShadow: isWin ? `0 0 20px ${ec}` : cell ? `0 0 14px ${ec}77` : "none", transition: "background 0.1s, border-color 0.1s", opacity: blk ? 0.4 : 1, boxShadow: isWin ? `0 0 8px ${ec}44` : isHov ? `inset 0 0 12px ${cc}22` : "none", willChange: isWin ? "auto" : canPlay ? "background, border-color" : "auto", position: "relative" } as React.CSSProperties}>
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
  ), [board, hover, winLine, winner, phase, c3Blocked, movesPlayed, bigCs,
    p1c, p2c, cc, isRedBoard, isIceBoard, isGlacierBoard, useFlameSkull, useSnowflakeShard, useGlacierSigils]);



  if (showSplash) return (
    <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg, gap: 32, userSelect: "none" }}>
      <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(24px,5vw,72px)", fontWeight: 900, color: t.accent, textShadow: `0 0 60px ${t.accentGlow}55`, letterSpacing: "0.06em", textAlign: "center" }}>SINGLEPLAYER</div>
      <div style={{ fontFamily: t.fontBody, fontSize: "clamp(13px,1.6vw,18px)", color: t.textSecondary, letterSpacing: "0.04em" }}>Local · Pass & Play · Best of 3</div>
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


  const rbPhases: Phase[] = ["rb_splash", "rb_coin", "rule_choice", "who_first_winner", "c3_choice", "c3_choice_loser", "who_first_loser", "ban_pattern_winner", "ban_pattern_loser", "toss_summary", "rb_initializing"];
  const rbOverlay = rbPhases.includes(phase) && (
      <RulebreakerFlow
        phase={phase} t={t} ip={ip} p1c={p1c} p2c={p2c}
        p1Elo={isMultiplayerGame ? p1Elo : undefined}
        p2Elo={isMultiplayerGame ? p2Elo : undefined}
        coinResult={coinResult} coinAngle={coinAngle} coinDivRef={coinDivRef} tossWinner={tossWinner}
        summaryTimer={summaryTimer} firstPlayerChosen={firstPlayerChosen} rbC3Blocked={rbC3Blocked}
        choiceTimer={choiceTimer} isMultiplayerGame={isMultiplayerGame} mySlot={mySlot}
        winnerPickedRule={winnerPickedRule} winnerPickedFirst={winnerPickedFirst} winnerPickedC3={winnerPickedC3}
        botPickedSide={botPickedSide}
        gameMode={gameMode}
        p1Label={p1Label} p2Label={p2Label}
        wraithKingToss={wraithKingTossActive}
        rbCoinPendingResult={rbCoinPendingResult}
        onLeftAction={onLeftAction} onRightAction={onRightAction} fmtSecAction={fmtSecAction}
        is7x7={is7x7} selectedPatterns={selectedPatterns} rbBannedPattern={rbBannedPattern} onBanPattern={onBanPattern}
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

  const onChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendChat(isMultiplayerGame ? mySlot : "P1");
  };

  // ── MOBILE LAYOUT ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 0, zIndex: 2, background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>

        <WinOverlay
          showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
          winner={winner} winnerColor={winnerColor} winnerPiece={winnerPiece}
          seriesDiffers={seriesDiffers} seriesColor={seriesColor} seriesPiece={seriesPiece}
          seriesWinner={seriesWinner} phase={phase} gameNumber={gameNumber}
          connectionScores={connectionScores}
          t={{ fontDisplay: t.fontDisplay, fontMono: t.fontMono, fontBody: t.fontBody }}
          winnerDisplayNameAction={winnerDisplayName}
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
          {isGlacierBoard && glacierBoard ? (
            <GlacierGrid board={glacierBoard} onCellClickAction={glacierClick} winCells={winLine} />
          ) : isBloodMoonBoard && bloodMoonBoard ? (
            <BloodMoonGrid board={bloodMoonBoard} onCellClickAction={bloodMoonClick} winCells={winLine} />
          ) : (
            <>
              <div style={{ display: "flex", gap: `${boardGap}px`, paddingLeft: 28, marginBottom: 4 }}>
                {"ABCDEFG".slice(0, GRID_SIZE).split("").map(l => (
                  <div key={l} style={{ width: bigCs, textAlign: "center", fontFamily: t.fontMono, fontSize: GRID_SIZE === 7 ? 13 : 16, fontWeight: 800, color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent, letterSpacing: "0.1em" }}>{l}</div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <div style={{ display: "grid", gridTemplateRows: `repeat(${GRID_SIZE},${bigCs})`, gap: `${boardGap}px` }}>
                  {Array.from({ length: GRID_SIZE }, (_, i) => i + 1).map(n => (
                    <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: GRID_SIZE === 7 ? 13 : 16, fontWeight: 800, color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent, width: 24 }}>{n}</div>
                  ))}
                </div>
                {boardJSX}
              </div>
            </>
          )}
        </div>

        {/* Mobile top-right menu buttons */}
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", gap: 8 }}>
          {isMultiplayerGame && (
            <button
              onClick={() => { setMobileTab("chat"); setShowMobileLog(true); setChatWarning(false); }}
              style={{ padding: "6px 14px", background: "rgba(0,0,0,0.75)", border: `1px solid ${chatWarning ? t.danger : t.accent}88`, borderRadius: 8, color: chatWarning ? t.danger : t.accent, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 4 }}
            >
              CHAT
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
              {["G1", "G2", "G3"].map((g, i) => {
                const res = matchHistory[i];
                const col = res === "P1" ? p1c : res === "P2" ? p2c : res === "DRAW" ? t.gold : "#333";
                const isActive = i === (gameNumber - 1);
                return (
                  <div key={g} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span style={{ fontFamily: t.fontMono, fontSize: 9, color: isActive ? t.accent : "#444", fontWeight: isActive ? 700 : 400 }}>{g}{isActive ? " ◀" : ""}</span>
                    <div style={{ width: 16, height: 3, borderRadius: 2, background: res ? col : "#222", border: `1px solid ${res ? col : "#333"}` }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Turn indicator */}
        <div style={{ position: "absolute", bottom: 52, left: 0, right: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, pointerEvents: "none" }}>
          {phase === "playing" && movesPlayed === 0 && (
            <div style={{ fontFamily: t.fontMono, fontSize: 10, letterSpacing: "0.06em", background: c3Blocked ? `${t.danger}18` : `${t.gold}18`, border: `1px solid ${c3Blocked ? t.danger : t.gold}44`, borderRadius: 6, padding: "3px 12px", color: c3Blocked ? t.danger : t.gold }}>
              {c3Blocked ? "✕ Center blocked" : "★ Center → opponent gets 2 extra turns"}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 18px", background: `${winner ? winnerColor : cc}18`, border: `1px solid ${winner ? winnerColor : cc}88`, borderRadius: 20, backdropFilter: "blur(8px)" }}>
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
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 48, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "rgba(0,0,0,0.85)", borderTop: `1px solid ${t.border}`, backdropFilter: "blur(8px)", gap: 8 }}>
          <button onClick={() => { if (showMobileLog && mobileTab === "log") setShowMobileLog(false); else { setMobileTab("log"); setShowMobileLog(true); } }} style={{ flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: t.textSecondary, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", letterSpacing: "0.06em" }}>
            📜 LOG
          </button>
          {isMultiplayerGame && (
            <button onClick={() => { if (showMobileLog && mobileTab === "chat") setShowMobileLog(false); else { setMobileTab("chat"); setShowMobileLog(true); } }} style={{ flex: 1, padding: "8px 0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: t.textSecondary, fontFamily: t.fontMono, fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", position: "relative" }}>
              💬 CHAT
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

        <SurrenderModal show={showSurrender} t={sidebarT} ip={ip} isRankedGame={isRankedGame} onConfirmAction={() => { setShowSurrender(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }} playHoverAction={playHoverAction} />
        <ExitModal show={showExitConfirm} t={sidebarT} ip={ip} onConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }} playHoverAction={playHoverAction} />
        <RematchOverlay show={showRematch} isMultiplayerGame={isMultiplayerGame} t={sidebarT} ip={ip} p1c={p1c} p2c={p2c} seriesWinner={seriesWinner} mySlot={mySlot} rematchRequested={rematchRequested} winnerDisplayNameAction={winnerDisplayName} lastSeries={lastSeries} onRematchAction={() => { wsRef.current?.send(JSON.stringify({ type: "rematch" })); setRematchRequested(mySlot); }} onQuitMatchAction={() => { wsRef.current?.send(JSON.stringify({ type: "quit_match" })); if (setScreenAction) setScreenAction("home"); }} />

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
    <div style={{ position: "fixed", top: 64, left: 0, right: 0, bottom: 0, zIndex: 2, display: "flex", flexDirection: "row", background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>

      <WinOverlay
        showWinOverlay={showWinOverlay} overlayVisible={overlayVisible}
        winner={winner} winnerColor={winnerColor} winnerPiece={winnerPiece}
        seriesDiffers={seriesDiffers} seriesColor={seriesColor} seriesPiece={seriesPiece}
        seriesWinner={seriesWinner} phase={phase} gameNumber={gameNumber}
        connectionScores={connectionScores}
        t={{ fontDisplay: t.fontDisplay, fontMono: t.fontMono, fontBody: t.fontBody }}
        winnerDisplayNameAction={winnerDisplayName}
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
        isMultiplayer={isMultiplayer} mySlot={mySlot}
        boardMode={boardMode} selectedPatterns={activePatterns} rbBannedPattern={rbBannedPattern}
        p1Time={p1Time} p2Time={p2Time} readyTimeout={readyTimeout}
        p1Ready={p1Ready} p2Ready={p2Ready}
        connectionScores={connectionScores}
        chatMessages={chatMessages} chatInput={chatInput} chatOpen={chatOpen} chatWarning={chatWarning}
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
        onReadyToggle={onReadyToggle}
        onSendChat={sendChat}
        onChatInputChange={setChatInput}
        onChatKeyDown={onChatKeyDown}
        onChatOpenToggle={() => setChatOpen(v => !v)}
        onSoftReset={softReset}
        onDismissOverlayAction={dismissOverlay}
        onRematchAction={() => { wsRef.current?.send(JSON.stringify({ type: "rematch" })); setRematchRequested(mySlot); }}
        onQuitMatchAction={() => { wsRef.current?.send(JSON.stringify({ type: "quit_match" })); if (setScreenAction) setScreenAction("home"); }}
        onSurrenderConfirmAction={() => { setShowSurrender(false); if (setScreenAction) setScreenAction("home"); }}
        onSurrenderCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }}
        onExitConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }}
        onExitCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }}
        onShowSurrenderAction={() => { playClickAction?.(); pausedRef.current = true; setShowSurrender(true); }}
        onShowExitConfirmAction={() => { playClickAction?.(); pausedRef.current = true; setShowExitConfirm(true); }}
        onShowRematchOverlayAction={() => setShowRematch(true)}
        fmtTimeAction={fmtTime}
        playHoverAction={playHoverAction}
        playClickAction={playClickAction}
      />

      {/* BOARD */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 0", minWidth: 0 }}>
        <div style={{ height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, width: "100%", position: "relative", paddingLeft: "2%" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.08em", background: c3Blocked ? `${t.danger}10` : `${t.gold}10`, border: `1px solid ${c3Blocked ? t.danger : t.gold}33`, borderRadius: 6, padding: "3px 14px", color: c3Blocked ? t.danger : t.gold, flexShrink: 0, visibility: phase === "playing" && movesPlayed === 0 ? "visible" : "hidden", opacity: phase === "playing" && movesPlayed === 0 ? 1 : 0, transition: "opacity 0.4s ease", pointerEvents: "none" }}>
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
          <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.08em", borderRadius: 6, padding: "3px 14px", flexShrink: 0, visibility: "hidden", pointerEvents: "none" }}>
            {c3Blocked ? "✕ Center (C3) is blocked this game" : "★ Playing center gives opponent 2 extra turns"}
          </div>
        </div>
        {/* Column labels + board — special boards render their own labels */}
        {isGlacierBoard && glacierBoard ? (
          <GlacierGrid board={glacierBoard} onCellClickAction={glacierClick} winCells={winLine} />
        ) : isBloodMoonBoard && bloodMoonBoard ? (
          <BloodMoonGrid board={bloodMoonBoard} onCellClickAction={bloodMoonClick} winCells={winLine} />
        ) : isEgyptBoard && egyptBoard ? (
          <EgyptGrid board={egyptBoard} onCellClickAction={egyptClick} winCells={winLine} />
        ) : isSynthwaveBoard && synthwaveBoard ? (
          <SynthwaveGrid board={synthwaveBoard} onCellClickAction={synthwaveClick} winCells={winLine} />
        ) : isMatrixBoard && matrixBoard ? (
          <MatrixGrid board={matrixBoard} onCellClickAction={matrixClick} winCells={winLine} />
        ) : isArcaneBoard && arcaneBoard ? (
          <ArcaneGrid board={arcaneBoard} onCellClickAction={arcaneClick} winCells={winLine} />
        ) : isBioBoard && bioBoard ? (
          <BioGrid board={bioBoard} onCellClickAction={bioClick} winCells={winLine} />
        ) : isForgeBoard && forgeBoard ? (
          <ForgeGrid board={forgeBoard} onCellClickAction={forgeClick} winCells={winLine} />
        ) : isVoidBoard && voidBoard ? (
          <VoidGrid board={voidBoard} onCellClickAction={voidClick} winCells={winLine} />
        ) : isTokyoBoard && tokyoBoard ? (
          <TokyoGrid board={tokyoBoard} onCellClickAction={tokyoClick} winCells={winLine} />
        ) : isSpaceBoard && spaceBoard ? (
          <SpaceGrid board={spaceBoard} onCellClickAction={spaceClick} winCells={winLine} />
        ) : isPixelBoard && pixelBoard ? (
          <PixelGrid board={pixelBoard} onCellClickAction={pixelClick} winCells={winLine} />
        ) : (
          <>
            <div style={{ display: "flex", gap: `${boardGap}px`, marginLeft: 34 }}>
              {"ABCDEFG".slice(0, GRID_SIZE).split("").map(l => <div key={l} style={{ width: bigCs, textAlign: "center", fontFamily: t.fontMono, fontSize: GRID_SIZE === 7 ? 16 : 21, fontWeight: 800, color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent, letterSpacing: "0.1em", textShadow: `0 0 10px ${isRedBoard ? "rgba(200,40,0,0.4)" : isIceBoard ? "rgba(100,180,255,0.3)" : t.accentGlow + "66"}` }}>{l}</div>)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <div style={{ display: "grid", gridTemplateRows: `repeat(${GRID_SIZE},${bigCs})`, gap: `${boardGap}px` }}>
                {Array.from({ length: GRID_SIZE }, (_, i) => i + 1).map(n => <div key={n} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: t.fontMono, fontSize: GRID_SIZE === 7 ? 16 : 21, fontWeight: 800, color: isRedBoard ? "rgba(200,60,40,0.7)" : isIceBoard ? "rgba(140,210,255,0.55)" : t.accent, letterSpacing: "0.1em", textShadow: `0 0 10px ${isRedBoard ? "rgba(200,40,0,0.4)" : isIceBoard ? "rgba(100,180,255,0.3)" : t.accentGlow + "66"}`, width: 34, flexShrink: 0 }}>{n}</div>)}
              </div>
              {boardJSX}
            </div>
          </>
        )}
      </div>

      <RightPanel
        t={sidebarT} ip={ip} p1c={p1c} p2c={p2c} panelW={panelW}
        phase={phase} log={log} isRankedGame={isRankedGame}
        setScreenAction={setScreenAction}
        onShowExitConfirmAction={() => { playClickAction?.(); pausedRef.current = true; setShowExitConfirm(true); }}
        playHoverAction={playHoverAction}
      />

      <RematchOverlay show={showRematch} isMultiplayerGame={isMultiplayerGame} t={sidebarT} ip={ip} p1c={p1c} p2c={p2c} seriesWinner={seriesWinner} mySlot={mySlot} rematchRequested={rematchRequested} winnerDisplayNameAction={winnerDisplayName} lastSeries={lastSeries} onRematchAction={() => { wsRef.current?.send(JSON.stringify({ type: "rematch" })); setRematchRequested(mySlot); }} onQuitMatchAction={() => { wsRef.current?.send(JSON.stringify({ type: "quit_match" })); if (setScreenAction) setScreenAction("home"); }} />
      <SurrenderModal show={showSurrender} t={sidebarT} ip={ip} isRankedGame={isRankedGame} onConfirmAction={() => { setShowSurrender(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowSurrender(false); }} playHoverAction={playHoverAction} />
      <ExitModal show={showExitConfirm} t={sidebarT} ip={ip} onConfirmAction={() => { setShowExitConfirm(false); if (setScreenAction) setScreenAction("home"); }} onCancelAction={() => { playClickAction?.(); pausedRef.current = false; setShowExitConfirm(false); }} playHoverAction={playHoverAction} />

      <style>{`
        @keyframes heatDrift0{from{transform:translate(0,0) scale(1)}to{transform:translate(12px,18px) scale(1.1)}}
        @keyframes heatDrift1{from{transform:translate(0,0) scale(1)}to{transform:translate(-15px,8px) scale(0.95)}}
        @keyframes heatDrift2{from{transform:translate(0,0) scale(1)}to{transform:translate(8px,-12px) scale(1.08)}}
        @keyframes redWinCellPulse{0%,100%{box-shadow:0 0 10px rgba(255,80,0,0.3)}50%{box-shadow:0 0 28px rgba(255,80,0,0.7),inset 0 0 16px rgba(255,40,0,0.2)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
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
        @keyframes winCellPulse{0%,100%{background:color-mix(in srgb, var(--win-col) 28%, transparent);box-shadow:0 0 8px color-mix(in srgb, var(--win-col) 44%, transparent)}50%{background:color-mix(in srgb, var(--win-col) 60%, transparent);box-shadow:0 0 22px color-mix(in srgb, var(--win-col) 80%, transparent)}}
        .win-cell-pulse{animation:winCellPulse 0.75s ease-in-out infinite}
        .overlay-modal{animation:scaleIn 0.38s cubic-bezier(.22,.68,0,1.2) both}
        .overlay-backdrop{animation:fadeIn 0.3s ease both}
        .phase-screen{animation:fadeUp 0.42s cubic-bezier(.22,.68,0,1.2) both}
        .action-btn{transition:background 0.25s cubic-bezier(.22,.68,0,1.2),color 0.25s cubic-bezier(.22,.68,0,1.2),transform 0.2s cubic-bezier(.22,.68,0,1.2),box-shadow 0.25s cubic-bezier(.22,.68,0,1.2) !important}
        .action-btn:hover{transform:scale(1.05) !important}
        .action-btn:active{transform:scale(0.97) !important}
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