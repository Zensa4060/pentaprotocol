"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  const { user, token, refreshProfile } = useAuthStore();
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

  /** Sumi-e "VS" — direct port of the canvas animation provided by the user.
   *  A single 820×480 canvas renders:
   *    • V as two tapered brush strokes (left + right arm)
   *    • S as three continuous brush strokes (top, middle, bottom)
   *    • A handful of small ink drips with teardrop tips
   *    • A 対決印 ("VS seal") square that pops in with a back-ease
   *  Everything is painted in pure ink (#080604) with round joins/caps so the
   *  letters look hand-painted against the cream match-found backdrop. The
   *  canvas's internal logical size stays at 820×480; display size is driven
   *  by the `size` prop and preserves aspect ratio. */
  const SketchVS = React.memo(({ size }: { size: number }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = 820;
      const H = 480;
      const BLACK = "#080604";
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);
      const easeInOut = (t: number) =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const easeOutBack = (t: number) => {
        const c = 1.70158;
        const c3 = c + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      };

      const cubic = (
        p0: [number, number],
        p1: [number, number],
        p2: [number, number],
        p3: [number, number],
        n: number,
      ): [number, number][] => {
        const out: [number, number][] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const mt = 1 - t;
          out.push([
            mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
            mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
          ]);
        }
        return out;
      };

      const drawStroke = (
        pts: [number, number][],
        widths: number[],
        progress: number,
      ) => {
        if (pts.length < 2 || progress <= 0) return;
        const n = Math.max(2, Math.floor(pts.length * progress));
        const p = pts.slice(0, n);
        const w = widths.slice(0, n);

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = BLACK;
        ctx.fillStyle = BLACK;
        ctx.globalAlpha = 0.97;
        for (let i = 1; i < p.length; i++) {
          const ww = (w[i - 1] + w[i]) * 0.5;
          ctx.lineWidth = ww;
          ctx.beginPath();
          ctx.moveTo(p[i - 1][0], p[i - 1][1]);
          ctx.lineTo(p[i][0], p[i][1]);
          ctx.stroke();
        }
      };

      const drips = [
        { x: 142, y: 310, delay: 1100, dur: 900, len: 28, w: 3.5 },
        { x: 236, y: 298, delay: 1300, dur: 800, len: 18, w: 2.5 },
        { x: 190, y: 348, delay: 1500, dur: 700, len: 22, w: 3.0 },
        { x: 582, y: 285, delay: 1200, dur: 850, len: 20, w: 2.8 },
        { x: 528, y: 272, delay: 1600, dur: 750, len: 15, w: 2.2 },
      ];

      const drawDrips = (elapsed: number) => {
        ctx.save();
        ctx.fillStyle = BLACK;
        ctx.strokeStyle = BLACK;
        ctx.lineCap = "round";
        drips.forEach((d) => {
          if (elapsed < d.delay) return;
          const t = Math.min(1, (elapsed - d.delay) / d.dur);
          const len = d.len * easeOut3(t);
          ctx.globalAlpha = 0.72;
          ctx.lineWidth = d.w;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x, d.y + len);
          ctx.stroke();
          const bulb = d.w * 0.9;
          ctx.globalAlpha = 0.78;
          ctx.beginPath();
          ctx.arc(d.x, d.y + len, bulb, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      };

      // ── V geometry (two tapered arms meeting at the bottom) ───────────────
      const vLP = cubic([108, 62], [132, 168], [172, 278], [190, 348], 46);
      const vLW = vLP.map((_, i) => {
        const t = i / 46;
        return 74 * (1 - t * 0.63) + 18;
      });
      const vRP = cubic([328, 62], [302, 168], [232, 278], [190, 348], 46);
      const vRW = vRP.map((_, i) => {
        const t = i / 46;
        return 74 * (1 - t * 0.63) + 18;
      });

      // ── S geometry (three brush strokes in one continuous motion) ─────────
      const OX = 182;
      const OY = 25;
      const sTP = cubic([462, 102], [470, 54], [336, 44], [316, 98], 40).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sTW = sTP.map((_, i) => {
        const t = i / 40;
        return 62 * (1 - Math.abs(t - 0.5) * 0.92) + 16;
      });
      const sMP = cubic([316, 98], [306, 148], [416, 163], [455, 210], 28).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sMW = sMP.map((_, i) => {
        const t = i / 28;
        return 24 + t * 32;
      });
      const sBP = cubic([455, 210], [472, 258], [332, 302], [302, 260], 40).map(
        ([x, y]) => [x + OX, y + OY] as [number, number],
      );
      const sBW = sBP.map((_, i) => {
        const t = i / 40;
        return 62 * (1 - Math.abs(t - 0.5) * 0.92) + 16;
      });

      // ── Seal: 対決印 panel that pops in at the end ─────────────────────────
      const drawSeal = (alpha: number, scale: number) => {
        const sx = 664;
        const sy = 298;
        const sw = 78;
        const sh = 78;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx + sw / 2, sy + sh / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(sx + sw / 2), -(sy + sh / 2));
        ctx.fillStyle = BLACK;
        // roundRect isn't available in older browsers; fall back to a regular
        // rect so the seal still renders cleanly on any engine.
        ctx.beginPath();
        const rr = (ctx as any).roundRect?.bind(ctx);
        if (rr) rr(sx, sy, sw, sh, 3);
        else ctx.rect(sx, sy, sw, sh);
        ctx.fill();
        ctx.strokeStyle = "rgba(242,237,228,0.38)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (rr) rr(sx + 5, sy + 5, sw - 10, sh - 10, 2);
        else ctx.rect(sx + 5, sy + 5, sw - 10, sh - 10);
        ctx.stroke();
        ctx.fillStyle = "#f2ede4";
        ctx.font = '900 13px Georgia,serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        (
          [
            ["対", sy + 17],
            ["決", sy + 39],
            ["印", sy + 61],
          ] as const
        ).forEach(([ch, y]) => ctx.fillText(ch as string, sx + sw / 2, y as number));
        ctx.restore();
      };

      // ── Animation loop ───────────────────────────────────────────────────
      let startTime = 0;
      let raf = 0;
      const TOTAL = 2700;
      const prog = (delay: number, dur: number, elapsed: number) =>
        elapsed < delay ? 0 : easeInOut(Math.min(1, (elapsed - delay) / dur));

      const frame = (ts: number) => {
        if (!startTime) startTime = ts;
        const el = ts - startTime;

        ctx.clearRect(0, 0, W, H);

        ctx.save();
        // V and the top of S start immediately (t=0), middle S at 720ms,
        // bottom S at 920ms — mirrors the original snippet exactly.
        drawStroke(vLP, vLW, prog(0, 940, el));
        drawStroke(vRP, vRW, prog(0, 940, el));
        drawStroke(sTP, sTW, prog(0, 940, el));
        drawStroke(sMP, sMW, prog(720, 400, el));
        drawStroke(sBP, sBW, prog(920, 940, el));
        ctx.restore();

        drawDrips(el);

        const st = Math.max(0, Math.min(1, (el - 2200) / 420));
        if (st > 0) drawSeal(st, easeOutBack(st));

        if (el < TOTAL + 400) raf = requestAnimationFrame(frame);
      };

      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }, []);

    // Preserve the original 820:480 aspect ratio while scaling to the
    // requested display width. The height derives from the aspect so the
    // layout never stretches the art.
    const displayWidth = size;
    const displayHeight = size * (480 / 820);

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          width: displayWidth,
          height: displayHeight,
          display: "block",
          filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.18))",
        }}
      />
    );
  });
  SketchVS.displayName = "SketchVS";

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
  }: {
    name: string;
    elo: number | null;
    avatar: string | undefined;
    level: number;
    glowColor: string;
    ranked: boolean;
    placementMatches: number;
    side: "left" | "right";
  }) => {
    const anim = side === "left" ? "slideInLeft" : "slideInRight";
    const avatarSize = isMobile ? 140 : 230;
    const isPlacementPlayer = ranked && placementMatches < 5;
    const displayElo = isPlacementPlayer ? "?" : (elo ?? "---");
    const rankForBadge = getRank(elo ?? 0);
    // All page text sits on top of a cream background, so default to deep
    // ink. The ranked accent (blood red) still comes through `glowColor`.
    const INK = "#0A0A0A";
    const INK_SOFT = "#3A2E22";

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
          <div style={{ fontFamily: t.fontMono, fontSize: isMobile ? 10 : 13, color: INK_SOFT, letterSpacing: "0.3em", fontWeight: 700, opacity: 0.85 }}>
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
              background: "#1A1410",
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
            color: INK,
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
    // Cream "canvas" background so the black paint-brush VS pops.
    // Ranked keeps a blood-red accent; unranked uses deep charcoal (white
    // was illegible on cream).
    const CREAM = "#EFE5CF";
    const CREAM_DEEP = "#E4D6B7";
    const INK = "#0A0A0A";
    const BLOOD = "#B31919";
    const glow = isRanked ? BLOOD : INK;
    const headerCopy = isRanked ? "RANKED · FIRST TO 5 POINTS" : "UNRANKED · FIRST TO 5 POINTS";
    const vsSize = isMobile ? 220 : 380;

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
          background: `radial-gradient(ellipse at 50% 40%, ${CREAM} 0%, ${CREAM_DEEP} 85%)`,
          overflow: "hidden",
        }}
      >
        {/* Faint paper-texture grid so the cream backdrop does not read flat */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage:
              `linear-gradient(rgba(60,40,20,0.18) 1px, transparent 1px), ` +
              `linear-gradient(90deg, rgba(60,40,20,0.18) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Header copy */}
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

        {/* Main horizontal row: YOU | VS | OPPONENT */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 1400,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            justifyContent: "center",
            gap: isMobile ? 6 : 24,
            padding: isMobile ? "60px 16px 80px" : "40px 40px",
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
          />

          <div
            style={{
              flex: isMobile ? "0 0 auto" : "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: isMobile ? "6px 0" : "0 12px",
            }}
          >
            <SketchVS size={vsSize} />
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
          />
        </div>

        {/* Countdown bar + "MATCH STARTING" */}
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
              background: `rgba(0,0,0,0.12)`,
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
        `}</style>
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