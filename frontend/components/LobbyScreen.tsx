"use client";
import { useState, useEffect, useRef } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onQueueStart: (mode: "ranked" | "unranked") => void;
  onQueueCancel: () => void;
  onHover?: () => void;
  onClick?: () => void;
  onRoomReady?: (roomCode: string, playerSlot: "P1" | "P2", format: string) => void;
}

type MultiSub = "unranked" | null;
type Phase = "select" | "queuing" | "matchup";

export default function LobbyScreen({ setScreen, themeId, onQueueStart, onQueueCancel, onHover, onClick, onRoomReady }: Props) {
  const t  = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const { user, token } = useAuthStore();

  const [multiSub,  setMultiSub]  = useState<MultiSub>(null);
  const [phase,     setPhase]     = useState<Phase>("select");
  const [elapsed,   setElapsed]   = useState(0);
  const [countdown, setCountdown] = useState(3.5);
  const [hovered,   setHovered]   = useState<string | null>(null);

  // Queue state
  const [queueRoomCode,   setQueueRoomCode]   = useState<string | null>(null);
  const [queuePlayerSlot, setQueuePlayerSlot] = useState<"P1" | "P2">("P1");
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);

  // Opponent info for matchup screen
  const [matchupOpponentName, setMatchupOpponentName] = useState<string>("OPPONENT");
  const [matchupOpponentElo, setMatchupOpponentElo]   = useState<number | null>(null);

  // ── Room state ────────────────────────────────────────────────────────────
  const [roomSection, setRoomSection] = useState<"none" | "create" | "join" | "waiting">("none");
  const [roomFormat,  setRoomFormat]  = useState<"unranked" | "ranked">("unranked");
  const [roomCode,    setRoomCode]    = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError,   setRoomError]   = useState<string | null>(null);
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  // Elapsed timer while queuing
  useEffect(() => {
    if (phase !== "queuing") return;
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Countdown timer after matchup found
  useEffect(() => {
    if (phase !== "matchup") return;
    const iv = setInterval(() => setCountdown(c => Math.max(0, +(c - 0.1).toFixed(2))), 100);
    const t1 = setTimeout(() => {
      clearInterval(iv);
      onQueueCancel();
      setScreen("multiGame");
    }, 3500);
    return () => { clearInterval(iv); clearTimeout(t1); };
  }, [phase]);

  const queueCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      queueCancelledRef.current = true;
      if (queuePollRef.current) {
        clearInterval(queuePollRef.current);
        clearTimeout(queuePollRef.current);
      }
    };
  }, []);

  const startSearch = async () => {
    if (!multiSub || !token) return;

    queueCancelledRef.current = false;
    onQueueStart(multiSub);
    setElapsed(0);
    setPhase("queuing");

    const attemptQueueJoin = async () => {
      if (queueCancelledRef.current) return;
      try {
        const res = await API.post("/api/room/queue/join", { format: multiSub }, authHeader);
        if (queueCancelledRef.current) return;
        if (res.data.matched) {
          // Extract opponent info from the matched response
          const room = res.data.room;
          const myS = res.data.player_slot as "P1" | "P2";
          const matchedCode = res.data.room_code;
          if (room) {
            storeOppProfile(room, myS);
          }
          // Show matchup screen for both players (don't skip to game immediately)
          setQueueRoomCode(matchedCode);
          setQueuePlayerSlot(myS);
          setPhase("matchup");
          setCountdown(3.5);
          setTimeout(() => { onQueueCancel(); onRoomReady?.(matchedCode, myS, multiSub); }, 3500);
          return;
        }
        const code = res.data.room_code;
        const slot = res.data.player_slot as "P1" | "P2";
        setQueueRoomCode(code);
        setQueuePlayerSlot(slot);
        queuePollRef.current = setInterval(async () => {
          if (queueCancelledRef.current) { clearInterval(queuePollRef.current!); return; }
          try {
            const poll = await API.get(`/api/room/queue/status/${code}`);
            if (poll.data.game_status === "playing") {
              clearInterval(queuePollRef.current!);
              // Grab opponent info from room data
              storeOppProfile(poll.data, slot);
              setPhase("matchup");
              setCountdown(3.5);
              setTimeout(() => { onQueueCancel(); onRoomReady?.(code, slot, multiSub); }, 3500);
            }
          } catch { /* keep polling */ }
        }, 2000);
      } catch {
        if (queueCancelledRef.current) return;
        queuePollRef.current = setTimeout(attemptQueueJoin, 3000);
      }
    };

    attemptQueueJoin();
  };

  const cancelSearch = async () => {
    queueCancelledRef.current = true;
    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
      clearTimeout(queuePollRef.current);
      queuePollRef.current = null;
    }
    if (queueRoomCode && token) {
      try { await API.post("/api/room/queue/leave", { format: multiSub ?? "unranked" }, authHeader); } catch { /* ignore */ }
    }
    setQueueRoomCode(null);
    setPhase("select");
    onQueueCancel();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Room handlers ─────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!token) { setRoomError("Sign in to play multiplayer"); return; }
    setRoomLoading(true); setRoomError(null);
    try {
      const res = await API.post("/api/room/create", { format: roomFormat }, authHeader);
      setRoomCode(res.data.room_code);
      setRoomSection("waiting");
      pollForPlayer(res.data.room_code, (res.data.player_slot as "P1" | "P2") ?? "P1");
    } catch (e: any) {
      setRoomError(e.response?.data?.detail || "Failed to create room");
    } finally { setRoomLoading(false); }
  };

  const pollForPlayer = (code: string, mySlot: "P1" | "P2" = "P1") => {
    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/api/room/${code}`, authHeader);
        if (res.data.game_status === "playing") {
          clearInterval(interval);
          onRoomReady?.(code, mySlot, res.data.format);
        }
      } catch { /* keep polling */ }
    }, 2000);
    setTimeout(() => clearInterval(interval), 300000);
  };

  const handleJoinRoom = async () => {
    if (!token) { setRoomError("Sign in to play multiplayer"); return; }
    if (!joinCode.trim()) { setRoomError("Enter a room code"); return; }
    setRoomLoading(true); setRoomError(null);
    try {
      const res = await API.post("/api/room/join", { room_code: joinCode.trim().toUpperCase() }, authHeader);
      onRoomReady?.(res.data.room_code, (res.data.player_slot as "P1" | "P2") ?? "P2", res.data.format);
    } catch (e: any) {
      setRoomError(e.response?.data?.detail || "Could not join room");
    } finally { setRoomLoading(false); }
  };

  const cancelRoom = () => {
    setRoomSection("none");
    setRoomCode("");
    setJoinCode("");
    setRoomError(null);
  };

  const Avatar = ({ color }: { color: string }) => (
    <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
      <circle cx="55" cy="55" r="50" stroke={color} strokeWidth="4" fill="none"
        style={{ filter: `drop-shadow(0 0 12px ${color}88)` }} />
      <circle cx="55" cy="38" r="14" stroke={color} strokeWidth="3.5" fill="none" />
      <path d="M20 92 Q20 68 55 68 Q90 68 90 92" stroke={color} strokeWidth="3.5"
        fill="none" strokeLinecap="round" />
    </svg>
  );

  const vsStyle: React.CSSProperties = {
    fontFamily: themeId === "classic_light" || themeId === "classic_dark"
      ? "'Cormorant Garamond', serif"
      : themeId === "space" ? "'Polaris', sans-serif" : "'Press Start 2P', cursive",
    fontSize: themeId === "pixel" ? "clamp(32px,6vw,64px)" : "clamp(52px,9vw,110px)",
    fontWeight: 900,
    color: t.accent,
    textShadow: `0 0 40px ${t.accentGlow}88, 0 0 80px ${t.accentGlow}44`,
    letterSpacing: themeId === "space" ? "0.15em" : "0.05em",
    lineHeight: 1,
    fontStyle: themeId === "classic_light" || themeId === "classic_dark" ? "italic" : "normal",
    userSelect: "none" as const,
  };

  // ── QUEUING ───────────────────────────────────────────────────────────────
  if (phase === "queuing") return (
    <div style={{ position:"fixed", inset:0, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, gap:22 }}>
      <div style={{ width:80, height:80, border:`3px solid ${t.border}`, borderTop:`3px solid ${t.accent}`, borderRadius:"50%", animation:"spinRing 0.9s linear infinite" }} />
      <div style={{ fontFamily:t.fontDisplay, fontSize:22, color:t.text }}>Finding Opponent</div>
      <div style={{ fontFamily:t.fontMono, fontSize:26, color:t.accent, letterSpacing:"0.2em" }}>{fmt(elapsed)}</div>
      <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:10, padding:"12px 22px", fontFamily:t.fontBody, fontSize:14, color:t.textSecondary, textAlign:"center", lineHeight:1.8 }}>
        <div>Unranked · Best of 3</div>
        <div style={{ color:t.textMuted }}>Searching for a real opponent...</div>
      </div>
      <button onClick={cancelSearch}
        style={{ background:"none", border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:14, padding:"10px 26px", borderRadius:6, cursor:"pointer", transition:"background 0.22s ease" }}
        onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = `${t.danger}18`; }}
        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
      >Cancel</button>
      <style>{`@keyframes spinRing { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Opponent profile data for matchup screen
  const [matchupOppAvatar, setMatchupOppAvatar] = useState<string | null>(null);
  const [matchupOppBanner, setMatchupOppBanner] = useState<string>("default");
  const [matchupOppBorder, setMatchupOppBorder] = useState<string>("none");
  const [matchupOppLevel, setMatchupOppLevel]   = useState<number>(1);

  const RANKS = [
    { name: "NOVICE",       min: 0,    max: 500,  color: "#9CA3AF" },
    { name: "ADVANCED",     min: 500,  max: 1000, color: "#60A5FA" },
    { name: "PROFESSIONAL", min: 1000, max: 1500, color: "#34D399" },
    { name: "EMERALD",      min: 1500, max: 2000, color: "#10B981" },
    { name: "MASTER",       min: 2000, max: 2500, color: "#FF3333" },
    { name: "LEGEND",       min: 2500, max: 9999, color: "#F59E0B" },
  ];
  const getRank = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[5];

  // Helper to store opponent profile from room data
  const storeOppProfile = (room: any, myS: "P1" | "P2") => {
    const prefix = myS === "P1" ? "player2" : "player1";
    setMatchupOpponentName(room[`${prefix}_name`] ?? "OPPONENT");
    setMatchupOpponentElo(room[`${prefix}_elo`] ?? null);
    setMatchupOppAvatar(room[`${prefix}_avatar`] ?? null);
    setMatchupOppBanner(room[`${prefix}_banner`] ?? "default");
    setMatchupOppBorder(room[`${prefix}_border`] ?? "none");
    setMatchupOppLevel(room[`${prefix}_level`] ?? 1);
  };

  const BANNERS: Record<string, string> = {
    default: "linear-gradient(135deg,#1a1a2e,#16213e)",
  };
  const getBanner = (id: string) => BANNERS[id] || BANNERS["default"];

  const PlayerCard = ({ name, elo, avatar, banner, level, color, direction }: {
    name: string; elo: number | null; avatar: string | null; banner: string;
    level: number; color: string; direction: "top" | "bottom";
  }) => {
    const rank = getRank(elo ?? 100);
    const anim = direction === "top" ? "slideInLeft" : "slideInRight";
    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 10, position: "relative", overflow: "hidden",
        animation: `${anim} 0.6s cubic-bezier(.22,.68,0,1.2) both`,
      }}>
        {/* Banner background */}
        <div style={{ position: "absolute", inset: 0, background: getBanner(banner), opacity: 0.35 }} />
        {/* Content */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {/* Avatar */}
          <div style={{
            width: 90, height: 90, borderRadius: "50%",
            background: `linear-gradient(135deg, ${color}, ${t.accent})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 24px ${color}55, 0 0 48px ${color}22`,
            border: `3px solid ${color}`,
            fontSize: 38, overflow: "hidden",
          }}>
            {avatar
              ? <img src={avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : "👤"}
          </div>
          {/* Username */}
          <div style={{ fontFamily: t.fontDisplay, fontSize: 22, fontWeight: 800, color, letterSpacing: "0.08em", textShadow: `0 0 20px ${color}55` }}>
            {name}
          </div>
          {/* Rank + Level */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ padding: "3px 12px", background: `${rank.color}18`, border: `1px solid ${rank.color}55`, borderRadius: 10, fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: rank.color, letterSpacing: "0.08em" }}>
              {rank.name}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>
              LVL <span style={{ color: t.accent, fontWeight: 700 }}>{level}</span>
            </div>
          </div>
          {/* ELO */}
          <div style={{ fontFamily: t.fontMono, fontSize: 15, color: t.textMuted, fontWeight: 600 }}>
            <span style={{ color: t.accent, fontSize: 20, fontWeight: 900 }}>{elo ?? "---"}</span> ELO
          </div>
        </div>
      </div>
    );
  };

  // ── MATCHUP ───────────────────────────────────────────────────────────────
  if (phase === "matchup") return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" }}>
      {/* Mode badge */}
      <div style={{ textAlign: "center", paddingTop: 20, fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.18em", zIndex: 2 }}>
        UNRANKED · BEST OF 3
      </div>

      {/* Player 1 (you) */}
      <PlayerCard
        name={user?.username ?? "YOU"}
        elo={user?.elo ?? null}
        avatar={user?.avatar ?? null}
        banner={user?.banner ?? "default"}
        level={user?.level ?? 1}
        color={t.p1}
        direction="top"
      />

      {/* VS divider */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "8px 0", flexShrink: 0 }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${t.border}, transparent)` }} />
        <div style={vsStyle}>VS</div>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${t.border}, transparent)` }} />
      </div>

      {/* Player 2 (opponent) */}
      <PlayerCard
        name={matchupOpponentName}
        elo={matchupOpponentElo}
        avatar={matchupOppAvatar}
        banner={matchupOppBanner}
        level={matchupOppLevel}
        color={t.p2}
        direction="bottom"
      />

      {/* Progress bar */}
      <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
        <div style={{ height: 4, background: t.border, borderRadius: 2, overflow: "hidden", maxWidth: 340, margin: "0 auto" }}>
          <div style={{ height: "100%", width: `${(countdown / 3.5) * 100}%`, background: `linear-gradient(90deg,${t.accent},${t.accentGlow})`, borderRadius: 2, transition: "width 0.1s linear", boxShadow: `0 0 10px ${t.accentGlow}88` }} />
        </div>
        <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, textAlign: "center", marginTop: 8, letterSpacing: "0.1em" }}>MATCH STARTING...</div>
      </div>

      <style>{`
        @keyframes fadeUp       { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-60px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(60px)}  to{opacity:1;transform:translateX(0)} }
      `}</style>
    </div>
  );

  // ── WAITING FOR P2 (private room) ─────────────────────────────────────────
  if (roomSection === "waiting") return (
    <div style={{ position:"fixed", inset:0, zIndex:2, background:t.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:28 }}>
      <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(22px,4vw,42px)", fontWeight:900, color:t.accent, textAlign:"center" }}>
        WAITING FOR OPPONENT
      </div>
      <div style={{ background:t.bgCard, border:`2px solid ${t.accent}`, borderRadius:ip?2:16, padding:"28px 48px", textAlign:"center" }}>
        <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.2em", marginBottom:10 }}>ROOM CODE</div>
        <div style={{ fontFamily:t.fontDisplay, fontSize:"clamp(40px,8vw,80px)", fontWeight:900, color:t.accent, letterSpacing:"0.15em", textShadow:`0 0 40px ${t.accentGlow}55` }}>
          {roomCode}
        </div>
        <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted, marginTop:10 }}>Share this code with your friend</div>
        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.accent, marginTop:6 }}>{roomFormat.toUpperCase()} · Waiting...</div>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:t.accent, animation:`dotPulse 1.2s ease-in-out ${i*0.3}s infinite`, opacity:0.7 }} />
        ))}
      </div>
      <button onClick={cancelRoom} style={{ background:"transparent", border:`2px solid ${t.border}`, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, padding:"12px 36px", borderRadius:ip?2:10, cursor:"pointer" }}>
        CANCEL
      </button>
      <style>{`@keyframes dotPulse { 0%,100%{transform:scale(0.8);opacity:0.4} 50%{transform:scale(1.2);opacity:1} }`}</style>
    </div>
  );

  // ── Card style helpers ────────────────────────────────────────────────────
  const cardStyle = (key: string, col: string, locked?: boolean): React.CSSProperties => {
    const active = multiSub === key;
    const isHov  = hovered === key && !active && !locked;
    return {
      background: active
        ? `linear-gradient(145deg, ${col}1C, ${t.bgCard})`
        : isHov ? `linear-gradient(145deg, ${col}10, ${t.bgCard})` : t.bgCard,
      border: `2px solid ${active ? col : isHov ? col : t.border}`,
      borderRadius: ip ? 2 : 14,
      padding: ip ? "35px 25px" : "45px 35px",
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
    background: t.bgCard, border:`2px solid ${t.border}`,
    borderRadius: ip ? 2 : 8, color: t.accent,
    fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900,
    letterSpacing: "0.25em", textAlign: "center" as const, outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2, overflowY:"auto", background:t.bg, padding:"84px 24px 48px", display:"flex", flexDirection:"column", alignItems:"center", transition:"background 0.4s" }}>

      <h1 style={{ fontFamily:t.fontDisplay, fontSize:71, fontWeight:700, color:t.text, marginBottom:40, textAlign:"center", textTransform:"uppercase", letterSpacing:"0.05em" }}>Multiplayer</h1>

      {/* ── 3-column grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:ip?14:20, width:"100%", maxWidth:1200, marginTop:"20vh" }}>

        {/* ── UNRANKED ── */}
        <button
          onClick={() => setMultiSub(multiSub === "unranked" ? null : "unranked")}
          onMouseEnter={() => { onHover?.(); setHovered("unranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardStyle("unranked", t.p1), alignItems:"center", textAlign:"center" as const }}
        >
          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>QUEUE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color: multiSub === "unranked" || hovered === "unranked" ? t.p1 : t.text, transition:"color 0.28s", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>
            Unranked
          </div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>Casual · Coins + XP</div>

          <div style={{ marginTop:"auto", width:"100%", display:"flex", flexDirection:"column", gap:6 }}>
            {[{k:"FORMAT",v:"Best of 3"},{k:"TIMER",v:"3 min"},{k:"RULEBREAKER",v:"Game 3"}].map(s => (
              <div key={s.k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.1em" }}>{s.k}</div>
                <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.text }}>{s.v}</div>
              </div>
            ))}
          </div>

          {multiSub === "unranked" && (
            <div style={{ position:"absolute", top:11, right:11, width:8, height:8, borderRadius:"50%", background:t.p1, boxShadow:`0 0 8px ${t.p1}` }} />
          )}
        </button>

        {/* ── RANKED (locked) ── */}
        <div
          style={{ ...cardStyle("ranked", t.gold, true), pointerEvents:"none", alignItems:"center", textAlign:"center" as const }}
        >
          {/* Lock badge */}
          <div style={{ position:"absolute", top:11, right:11, background:`${t.gold}18`, border:`1px solid ${t.gold}55`, color:t.gold, fontSize:10, padding:"2px 8px", borderRadius:10, fontFamily:t.fontMono, display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ fontSize:11 }}>🔒</span> SOON
          </div>

          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>QUEUE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color:t.gold, textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>
            Ranked
          </div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:16 }}>ELO · Rank · Season rewards</div>

          <div style={{ marginTop:"auto", width:"100%", display:"flex", flexDirection:"column", gap:6 }}>
            {[{k:"PLACEMENT",v:"10 matches"}].map(s => (
              <div key={s.k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.1em" }}>{s.k}</div>
                <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.text }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CUSTOM (private rooms) ── */}
        <div
          onMouseEnter={() => setHovered("custom")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: roomSection !== "none"
              ? `linear-gradient(145deg, ${t.accent}14, ${t.bgCard})`
              : customActive ? `linear-gradient(145deg, ${t.accent}0C, ${t.bgCard})` : t.bgCard,
            border: `2px solid ${roomSection !== "none" ? t.accent : customActive ? t.accent : t.border}`,
            borderRadius: ip ? 2 : 14,
            padding: ip ? "35px 25px" : "45px 35px",
            textAlign: "center" as const,
            position: "relative" as const,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 0,
            transition: "background 0.28s, border-color 0.28s",
            boxShadow: roomSection !== "none" ? `0 10px 36px ${t.accent}1E` : customActive ? `0 6px 28px ${t.accent}14` : "none",
          }}
        >
          <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.18em", marginBottom:12 }}>PRIVATE</div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?20:32, fontWeight:700, marginBottom:8, color: roomSection !== "none" || customActive ? t.accent : t.text, transition:"color 0.28s", textTransform:"uppercase" as const, letterSpacing:"0.08em" }}>
            Custom
          </div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:14, color:t.textMuted, marginBottom:20 }}>Play with a friend · Room codes</div>

          {/* Error message */}
          {roomError && roomSection !== "none" && (
            <div style={{ background:`${t.danger}14`, border:`1px solid ${t.danger}`, borderRadius:8, padding:"8px 12px", color:t.danger, fontFamily:t.fontBody, fontSize:12, marginBottom:12, width:"100%", boxSizing:"border-box" as const }}>
              ⚠ {roomError}
            </div>
          )}

          {/* ── CREATE sub-panel ── */}
          {roomSection === "create" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleCreateRoom} disabled={roomLoading}
                  style={{ flex:1, padding:"16px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:ip?2:7, color:"#000", fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor:roomLoading?"wait":"pointer", letterSpacing:"0.06em", transition:"all 0.2s" }}>
                  {roomLoading ? "CREATING..." : "CREATE"}
                </button>
                <button onClick={cancelRoom}
                  style={{ padding:"16px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:7, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:13, cursor:"pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ── JOIN sub-panel ── */}
          {roomSection === "join" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <div style={{ fontFamily:t.fontMono, fontSize:10, color:t.textMuted, letterSpacing:"0.15em", marginBottom:2 }}>ROOM CODE</div>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""))}
                onKeyDown={e => e.key === "Enter" && handleJoinRoom()}
                maxLength={6}
                placeholder="XXXXXX"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
              <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, textAlign:"center" }}>
                6-character code from your friend
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={handleJoinRoom} disabled={roomLoading || joinCode.length !== 6}
                  style={{ flex:1, padding:"16px", background: joinCode.length===6 ? t.accent : t.bgCard, border:`2px solid ${joinCode.length===6 ? t.accent : t.border}`, borderRadius:ip?2:7, color: joinCode.length===6 ? "#000" : t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:800, cursor: joinCode.length===6&&!roomLoading?"pointer":"not-allowed", letterSpacing:"0.06em", transition:"all 0.2s" }}>
                  {roomLoading ? "JOINING..." : "JOIN"}
                </button>
                <button onClick={cancelRoom}
                  style={{ padding:"16px 18px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:7, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:13, cursor:"pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ── Default buttons (no sub-panel open) ── */}
          {roomSection === "none" && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:"auto", width:"100%", animation:"fadeUp 0.28s cubic-bezier(.22,.68,0,1.2) both" }}>
              <button
                onClick={() => { setRoomSection("create"); setRoomError(null); }}
                onMouseEnter={e => { onHover?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
                style={{ width:"100%", padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.22s" }}
              >
                + CREATE ROOM
              </button>
              <button
                onClick={() => { setRoomSection("join"); setRoomError(null); }}
                onMouseEnter={e => { onHover?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
                style={{ width:"100%", padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.22s" }}
              >
                → JOIN ROOM
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── FIND MATCH button (shows when Unranked selected) ── */}
      {multiSub && (
        <div style={{ display:"flex", justifyContent:"center", marginTop:28, animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) 0.06s both" }}>
          <button
            onClick={startSearch}
            style={{ background:`linear-gradient(135deg,${t.accent},${t.accentGlow})`, border:"none", color:"#0A0A0A", fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, padding:"18px 64px", borderRadius:ip?2:10, cursor:"pointer", boxShadow:`0 0 28px ${t.accentGlow}44`, transition:"transform 0.25s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s cubic-bezier(.22,.68,0,1.2)" }}
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.transform="translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow=`0 8px 40px ${t.accentGlow}66`; }}
            onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)"; e.currentTarget.style.boxShadow=`0 0 28px ${t.accentGlow}44`; }}
            onMouseDown={e  => { e.currentTarget.style.transform="translateY(0) scale(0.97)"; }}
            onMouseUp={e    => { e.currentTarget.style.transform="translateY(-3px) scale(1.04)"; }}
          >FIND MATCH</button>
        </div>
      )}

      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinRing { to { transform: rotate(360deg); } }
        @keyframes dotPulse { 0%,100%{transform:scale(0.8);opacity:0.4} 50%{transform:scale(1.2);opacity:1} }
      `}</style>
    </div>
  );
}