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

type MultiSub = "ranked" | "unranked" | null;
type Phase = "select" | "queuing" | "matchup";

export default function LobbyScreen({ setScreen, themeId, onQueueStart, onQueueCancel, onHover, onClick, onRoomReady }: Props) {
  const t  = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const { user, token } = useAuthStore();

  const [multiSub,  setMultiSub]  = useState<MultiSub>(null);
  const [phase,     setPhase]     = useState<Phase>("select");
  const [elapsed,   setElapsed]   = useState(0);
  const [countdown, setCountdown] = useState(3.5);
  const [hovered,   setHovered]   = useState<MultiSub>(null);

  // Queue state
  const [queueRoomCode,   setQueueRoomCode]   = useState<string | null>(null);
  const [queuePlayerSlot, setQueuePlayerSlot] = useState<"P1" | "P2">("P1");
  const queuePollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Room state ────────────────────────────────────────────────────────────
  const [roomSection, setRoomSection] = useState<"none" | "create" | "join" | "waiting">("none");
  const [roomFormat,  setRoomFormat]  = useState<"unranked" | "ranked">("unranked");
  const [roomCode,    setRoomCode]    = useState("");
  const [joinCode,    setJoinCode]    = useState("");
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError,   setRoomError]   = useState<string | null>(null);
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const level = (user as any)?.level ?? 1;

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

  // Cancel flag ref — set to true to stop all queue retries immediately
  const queueCancelledRef = useRef(false);

  // Cleanup on unmount
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
    if (multiSub === "ranked" && level < 5) return;

    // Reset cancel flag for this new queue session
    queueCancelledRef.current = false;
    onQueueStart(multiSub);
    setElapsed(0);
    setPhase("queuing");

    const attemptQueueJoin = async () => {
      // Bail out immediately if cancelled
      if (queueCancelledRef.current) return;

      try {
        const res = await API.post("/api/room/queue/join", { format: multiSub }, authHeader);

        // Check again after the async call returns
        if (queueCancelledRef.current) return;

        if (res.data.matched) {
          onRoomReady?.(res.data.room_code, res.data.player_slot, multiSub);
          return;
        }

        const code = res.data.room_code;
        const slot = res.data.player_slot as "P1" | "P2";
        setQueueRoomCode(code);
        setQueuePlayerSlot(slot);

        queuePollRef.current = setInterval(async () => {
          if (queueCancelledRef.current) {
            clearInterval(queuePollRef.current!);
            return;
          }
          try {
            const poll = await API.get(`/api/room/queue/status/${code}`);
            if (poll.data.game_status === "playing") {
              clearInterval(queuePollRef.current!);
              setPhase("matchup");
              setCountdown(3.5);
              setTimeout(() => {
                onQueueCancel();
                onRoomReady?.(code, slot, multiSub);
              }, 3500);
            }
          } catch { /* ignore poll errors — keep polling */ }
        }, 2000);

      } catch {
        // Backend unreachable — retry after 3s only if not cancelled
        if (queueCancelledRef.current) return;
        queuePollRef.current = setTimeout(attemptQueueJoin, 3000);
      }
    };

    attemptQueueJoin();
  };

  const cancelSearch = async () => {
    // Set cancel flag FIRST — stops any in-flight closure from scheduling more retries
    queueCancelledRef.current = true;

    if (queuePollRef.current) {
      clearInterval(queuePollRef.current);
      clearTimeout(queuePollRef.current);
      queuePollRef.current = null;
    }

    if (queueRoomCode && token) {
      try {
        await API.post("/api/room/queue/leave", { format: multiSub ?? "unranked" }, authHeader);
      } catch { /* ignore */ }
    }

    setQueueRoomCode(null);
    setPhase("select");
    onQueueCancel();
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Room handlers (private rooms) ─────────────────────────────────────────
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
      } catch { /* keep polling on error */ }
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
        <div>{multiSub === "ranked" ? "Ranked" : "Unranked"} · Best of 3</div>
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

  // ── MATCHUP ───────────────────────────────────────────────────────────────
  if (phase === "matchup") return (
    <div style={{ position:"fixed", inset:0, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, overflow:"hidden", animation:"fadeUp 0.5s cubic-bezier(.22,.68,0,1.2) both" }}>
      <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.18em", marginBottom:48 }}>
        {multiSub === "ranked" ? "RANKED" : "UNRANKED"} · BEST OF 3
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"clamp(32px,6vw,96px)", width:"100%" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, animation:"slideInLeft 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
          <Avatar color={t.p1} />
          <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:t.p1, letterSpacing:"0.12em" }}>{user?.username ?? "YOU"}</div>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.textMuted }}>{user?.elo ?? "---"} ELO</div>
        </div>
        <div style={vsStyle}>VS</div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, animation:"slideInRight 0.6s cubic-bezier(.22,.68,0,1.2) both" }}>
          <Avatar color={t.p2} />
          <div style={{ fontFamily:t.fontDisplay, fontSize:18, fontWeight:700, color:t.p2, letterSpacing:"0.12em" }}>OPPONENT</div>
          <div style={{ fontFamily:t.fontMono, fontSize:13, color:t.textMuted }}>{(user?.elo ?? 100) + Math.floor(Math.random() * 40) - 20} ELO</div>
        </div>
      </div>
      <div style={{ marginTop:64, width:"min(340px,80vw)" }}>
        <div style={{ height:4, background:t.border, borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${(countdown / 3.5) * 100}%`, background:`linear-gradient(90deg,${t.accent},${t.accentGlow})`, borderRadius:2, transition:"width 0.1s linear", boxShadow:`0 0 10px ${t.accentGlow}88` }} />
        </div>
        <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, textAlign:"center", marginTop:10, letterSpacing:"0.1em" }}>MATCH STARTING...</div>
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

  // ── SELECT ────────────────────────────────────────────────────────────────
  const cardStyle = (mode: "ranked" | "unranked", col: string): React.CSSProperties => {
    const active = multiSub === mode;
    const isHov  = hovered === mode && !active;
    return {
      background: active ? `linear-gradient(145deg, ${col}1C, ${t.bgCard})` : isHov ? `linear-gradient(145deg, ${col}10, ${t.bgCard})` : t.bgCard,
      border: `2px solid ${active ? col : isHov ? col : t.border}`,
      borderRadius: ip ? 2 : 14,
      padding: ip ? "28px 20px" : "40px 32px",
      cursor: "pointer", textAlign: "left", position: "relative", outline: "none",
      transform: active ? "translateY(-3px) scale(1.01)" : isHov ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
      boxShadow: active ? `0 10px 36px ${col}2E, 0 0 0 1px ${col}1A` : isHov ? `0 14px 44px ${col}24, 0 0 0 1px ${col}16` : "none",
      transition: ["background 0.28s cubic-bezier(.22,.68,0,1.2)","border-color 0.28s cubic-bezier(.22,.68,0,1.2)","transform 0.28s cubic-bezier(.22,.68,0,1.2)","box-shadow 0.28s cubic-bezier(.22,.68,0,1.2)"].join(", "),
    };
  };

  const inputStyle: React.CSSProperties = {
    width:"100%", padding:"14px 16px", boxSizing:"border-box",
    background: t.bgCard, border:`2px solid ${t.border}`,
    borderRadius: ip ? 2 : 10, color: t.accent,
    fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900,
    letterSpacing: "0.25em", textAlign: "center", outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2, overflowY:"auto", background:t.bg, padding:"84px 24px 48px", display:"flex", flexDirection:"column", alignItems:"center", transition:"background 0.4s" }}>
      <h1 style={{ fontFamily:t.fontDisplay, fontSize:36, fontWeight:700, color:t.text, marginBottom:8, textAlign:"center" }}>Multiplayer</h1>
      <p style={{ fontFamily:t.fontBody, color:t.textMuted, marginBottom:40, fontSize:15, textAlign:"center" }}>All matches are Best of 3 · Rulebreaker enabled</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:ip?14:22, width:"100%", maxWidth:760 }}>

        {/* RANKED — level 5 required */}
        <button
          onClick={() => { if (level >= 5) setMultiSub(multiSub === "ranked" ? null : "ranked"); }}
          onMouseEnter={() => { onHover?.(); setHovered("ranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={{ ...cardStyle("ranked", t.gold), opacity: level < 5 ? 0.5 : 1, cursor: level < 5 ? "not-allowed" : "pointer" }}
        >
          <div style={{ position:"absolute", top:11, right:11, background:`${t.gold}18`, border:`1px solid ${t.gold}`, color:t.gold, fontSize:10, padding:"2px 7px", borderRadius:10, fontFamily:t.fontMono }}>
            LVL 5+
          </div>
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?15:24, fontWeight:700, marginBottom:8, color: multiSub === "ranked" || hovered === "ranked" ? t.gold : t.text, transition:"color 0.28s cubic-bezier(.22,.68,0,1.2)" }}>Ranked</div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:15, color:t.textMuted }}>
            {level < 5 ? `Requires level 5 · You are level ${level}` : "ELO · Rank · Season rewards"}
          </div>
        </button>

        {/* UNRANKED */}
        <button
          onClick={() => setMultiSub(multiSub === "unranked" ? null : "unranked")}
          onMouseEnter={() => { onHover?.(); setHovered("unranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle("unranked", t.p1)}
        >
          <div style={{ fontFamily:t.fontDisplay, fontSize:ip?15:24, fontWeight:700, marginBottom:8, color: multiSub === "unranked" || hovered === "unranked" ? t.p1 : t.text, transition:"color 0.28s cubic-bezier(.22,.68,0,1.2)" }}>Unranked</div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:15, color:t.textMuted }}>Casual · Coins + XP</div>
        </button>

      </div>

      {multiSub && (
        <div style={{ marginTop:18, width:"100%", maxWidth:760, background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:ip?2:10, padding:"14px 22px", display:"flex", gap:28, flexWrap:"wrap", animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) both" }}>
          {[{k:"FORMAT",v:"Best of 3"},{k:"RULEBREAKER",v:"Game 3 ON"},{k:"TIMER",v:"3 min"},{k:"REGION",v:"Auto"}].map(s => (
            <div key={s.k}>
              <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:3 }}>{s.k}</div>
              <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.text }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {multiSub && (
        <div style={{ display:"flex", justifyContent:"center", marginTop:24, animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) 0.06s both" }}>
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

      {/* ── Divider ── */}
      <div style={{ display:"flex", alignItems:"center", gap:16, width:"100%", maxWidth:760, margin:"32px 0 0" }}>
        <div style={{ flex:1, height:1, background:t.border }} />
        <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.15em" }}>OR PLAY WITH A FRIEND</div>
        <div style={{ flex:1, height:1, background:t.border }} />
      </div>

      {/* ── Play with Friend buttons ── */}
      {roomSection === "none" && (
        <div style={{ display:"flex", gap:14, marginTop:18, width:"100%", maxWidth:760, animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) both" }}>
          <button
            onClick={() => { setRoomSection("create"); setRoomError(null); }}
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
            style={{ flex:1, padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:10, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.2s" }}>
            + CREATE ROOM
          </button>
          <button
            onClick={() => { setRoomSection("join"); setRoomError(null); }}
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.borderColor=t.accent; e.currentTarget.style.color=t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=t.border; e.currentTarget.style.color=t.textMuted; }}
            style={{ flex:1, padding:"16px", background:"transparent", border:`2px solid ${t.border}`, borderRadius:ip?2:10, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:15, fontWeight:700, cursor:"pointer", letterSpacing:"0.08em", transition:"all 0.2s" }}>
            → JOIN ROOM
          </button>
        </div>
      )}

      {/* ── CREATE ROOM panel ── */}
      {roomSection === "create" && (
        <div style={{ width:"100%", maxWidth:760, marginTop:18, background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:ip?2:12, padding:"22px 24px", display:"flex", flexDirection:"column", gap:16, animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) both" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.15em" }}>CREATE PRIVATE ROOM</div>

          {roomError && (
            <div style={{ background:`${t.danger}14`, border:`1px solid ${t.danger}`, borderRadius:8, padding:"9px 13px", color:t.danger, fontFamily:t.fontBody, fontSize:13 }}>⚠ {roomError}</div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            {(["unranked","ranked"] as const).map(f => {
              const sel = roomFormat === f;
              return (
                <button key={f} onClick={() => setRoomFormat(f)}
                  style={{ flex:1, padding:"12px", border:`2px solid ${sel ? t.accent : t.border}`, borderRadius:ip?2:8, background: sel ? `${t.accent}14` : "transparent", color: sel ? t.accent : t.text, fontFamily:t.fontDisplay, fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.2s", letterSpacing:"0.06em" }}>
                  <div>{f.toUpperCase()}</div>
                  <div style={{ fontFamily:t.fontBody, fontSize:11, color:t.textMuted, fontWeight:400, marginTop:3 }}>
                    {f === "ranked" ? "ELO changes" : "Casual · no ELO"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleCreateRoom} disabled={roomLoading}
              style={{ flex:1, padding:"14px", background:t.accent, border:`2px solid ${t.accent}`, borderRadius:ip?2:8, color:"#000", fontFamily:t.fontDisplay, fontSize:15, fontWeight:800, cursor:roomLoading?"wait":"pointer", letterSpacing:"0.08em", transition:"all 0.2s", boxShadow:`0 0 18px ${t.accentGlow}33` }}>
              {roomLoading ? "CREATING..." : "CREATE ROOM"}
            </button>
            <button onClick={cancelRoom}
              style={{ padding:"14px 20px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ── JOIN ROOM panel ── */}
      {roomSection === "join" && (
        <div style={{ width:"100%", maxWidth:760, marginTop:18, background:t.bgPanel, border:`1px solid ${t.border}`, borderRadius:ip?2:12, padding:"22px 24px", display:"flex", flexDirection:"column", gap:16, animation:"fadeUp 0.32s cubic-bezier(.22,.68,0,1.2) both" }}>
          <div style={{ fontFamily:t.fontMono, fontSize:12, color:t.textMuted, letterSpacing:"0.15em" }}>JOIN PRIVATE ROOM</div>

          {roomError && (
            <div style={{ background:`${t.danger}14`, border:`1px solid ${t.danger}`, borderRadius:8, padding:"9px 13px", color:t.danger, fontFamily:t.fontBody, fontSize:13 }}>⚠ {roomError}</div>
          )}

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
          <div style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted, textAlign:"center", marginTop:-8 }}>
            Enter the 6-character code from your friend
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleJoinRoom} disabled={roomLoading || joinCode.length !== 6}
              style={{ flex:1, padding:"14px", background: joinCode.length===6 ? t.accent : t.bgCard, border:`2px solid ${joinCode.length===6 ? t.accent : t.border}`, borderRadius:ip?2:8, color: joinCode.length===6 ? "#000" : t.textMuted, fontFamily:t.fontDisplay, fontSize:15, fontWeight:800, cursor: joinCode.length===6&&!roomLoading?"pointer":"not-allowed", letterSpacing:"0.08em", transition:"all 0.2s", boxShadow: joinCode.length===6 ? `0 0 18px ${t.accentGlow}33` : "none" }}>
              {roomLoading ? "JOINING..." : "JOIN ROOM"}
            </button>
            <button onClick={cancelRoom}
              style={{ padding:"14px 20px", background:"transparent", border:`1px solid ${t.border}`, borderRadius:ip?2:8, color:t.textMuted, fontFamily:t.fontDisplay, fontSize:14, cursor:"pointer" }}>
              CANCEL
            </button>
          </div>
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