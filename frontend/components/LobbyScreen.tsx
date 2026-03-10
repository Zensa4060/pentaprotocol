"use client";
import { useState, useEffect } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onQueueStart: (mode: "ranked" | "unranked") => void;
  onQueueCancel: () => void;
  onHover?: () => void;
  onClick?: () => void;
}

type MultiSub = "ranked" | "unranked" | null;
type Phase = "select" | "queuing" | "matchup";

export default function LobbyScreen({ setScreen, themeId, onQueueStart, onQueueCancel, onHover, onClick }: Props) {
  const t  = THEMES[themeId as keyof typeof THEMES];
  const ip = themeId === "pixel";
  const { user } = useAuthStore();

  const [multiSub,  setMultiSub]  = useState<MultiSub>(null);
  const [phase,     setPhase]     = useState<Phase>("select");
  const [elapsed,   setElapsed]   = useState(0);
  const [countdown, setCountdown] = useState(3.5);
  const [hovered,   setHovered]   = useState<MultiSub>(null);

  useEffect(() => {
    if (phase !== "queuing") return;
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    const t1 = setTimeout(() => { clearInterval(iv); setPhase("matchup"); setCountdown(3.5); }, 1500);
    return () => { clearInterval(iv); clearTimeout(t1); };
  }, [phase]);

  useEffect(() => {
    if (phase !== "matchup") return;
    const iv = setInterval(() => setCountdown(c => Math.max(0, +(c - 0.1).toFixed(2))), 100);
    const t1 = setTimeout(() => { clearInterval(iv); onQueueCancel(); setScreen("multiGame"); }, 3500);
    return () => { clearInterval(iv); clearTimeout(t1); };
  }, [phase]);

  const startSearch = () => {
    if (!multiSub) return;
    onQueueStart(multiSub);
    setElapsed(0);
    setPhase("queuing");
  };
  const cancelSearch = () => { setPhase("select"); onQueueCancel(); };
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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

  // ── QUEUING ──
  if (phase === "queuing") return (
    <div style={{ position:"fixed", inset:0, zIndex:2, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, gap:22 }}>
      <div style={{ width:80, height:80, border:`3px solid ${t.border}`, borderTop:`3px solid ${t.accent}`, borderRadius:"50%", animation:"spinRing 0.9s linear infinite" }} />
      <div style={{ fontFamily:t.fontDisplay, fontSize:22, color:t.text }}>Finding Opponent</div>
      <div style={{ fontFamily:t.fontMono, fontSize:26, color:t.accent, letterSpacing:"0.2em" }}>{fmt(elapsed)}</div>
      <div style={{ background:t.bgCard, border:`1px solid ${t.border}`, borderRadius:10, padding:"12px 22px", fontFamily:t.fontBody, fontSize:14, color:t.textSecondary, textAlign:"center", lineHeight:1.8 }}>
        <div>{multiSub === "ranked" ? "Ranked" : "Unranked"} · Best of 3</div>
        <div style={{ color:t.textMuted }}>ELO Range: {(user?.elo || 100) - 120} – {(user?.elo || 100) + 120}</div>
      </div>
      <button onClick={cancelSearch}
        style={{ background:"none", border:`1px solid ${t.danger}`, color:t.danger, fontFamily:t.fontBody, fontSize:14, padding:"10px 26px", borderRadius:6, cursor:"pointer", transition:"background 0.22s ease" }}
        onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = `${t.danger}18`; }}
        onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
      >Cancel</button>
      <style>{`@keyframes spinRing { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── MATCHUP ──
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

  // ── SELECT ──

  const cardStyle = (mode: "ranked" | "unranked", col: string): React.CSSProperties => {
    const active = multiSub === mode;
    const isHov  = hovered === mode && !active;
    return {
      background: active
        ? `linear-gradient(145deg, ${col}1C, ${t.bgCard})`
        : isHov
        ? `linear-gradient(145deg, ${col}10, ${t.bgCard})`
        : t.bgCard,
      border: `2px solid ${active ? col : isHov ? col : t.border}`,
      borderRadius: ip ? 2 : 14,
      padding: ip ? "28px 20px" : "40px 32px",
      cursor: "pointer",
      textAlign: "left",
      position: "relative",
      outline: "none",
      transform: active
        ? "translateY(-3px) scale(1.01)"
        : isHov
        ? "translateY(-6px) scale(1.02)"
        : "translateY(0) scale(1)",
      boxShadow: active
        ? `0 10px 36px ${col}2E, 0 0 0 1px ${col}1A`
        : isHov
        ? `0 14px 44px ${col}24, 0 0 0 1px ${col}16`
        : "none",
      transition: [
        "background   0.28s cubic-bezier(.22,.68,0,1.2)",
        "border-color 0.28s cubic-bezier(.22,.68,0,1.2)",
        "transform    0.28s cubic-bezier(.22,.68,0,1.2)",
        "box-shadow   0.28s cubic-bezier(.22,.68,0,1.2)",
      ].join(", "),
    };
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2, overflowY:"auto", background:t.bg, padding:"84px 24px 48px", display:"flex", flexDirection:"column", alignItems:"center", transition:"background 0.4s" }}>
      <h1 style={{ fontFamily:t.fontDisplay, fontSize:36, fontWeight:700, color:t.text, marginBottom:8, textAlign:"center" }}>Multiplayer</h1>
      <p style={{ fontFamily:t.fontBody, color:t.textMuted, marginBottom:40, fontSize:15, textAlign:"center" }}>All matches are Best of 3 · Rulebreaker enabled</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:ip?14:22, width:"100%", maxWidth:760 }}>

        {/* RANKED */}
        <button
          onClick={() => setMultiSub(multiSub === "ranked" ? null : "ranked")}
          onMouseEnter={() => { onHover?.(); setHovered("ranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle("ranked", t.gold)}
        >
          <div style={{ position:"absolute", top:11, right:11, background:`${t.gold}18`, border:`1px solid ${t.gold}`, color:t.gold, fontSize:10, padding:"2px 7px", borderRadius:10, fontFamily:t.fontMono }}>
            LVL 10+
          </div>
          
          <div style={{
            fontFamily:t.fontDisplay, fontSize:ip?15:24, fontWeight:700, marginBottom:8,
            color: multiSub === "ranked" || hovered === "ranked" ? t.gold : t.text,
            transition:"color 0.28s cubic-bezier(.22,.68,0,1.2)",
          }}>Ranked</div>
          <div style={{ fontFamily:t.fontBody, fontSize:ip?12:15, color:t.textMuted }}>ELO · Rank · Season rewards</div>
        </button>

        {/* UNRANKED */}
        <button
          onClick={() => setMultiSub(multiSub === "unranked" ? null : "unranked")}
          onMouseEnter={() => { onHover?.(); setHovered("unranked"); }}
          onMouseLeave={() => setHovered(null)}
          style={cardStyle("unranked", t.p1)}
        >
          
          <div style={{
            fontFamily:t.fontDisplay, fontSize:ip?15:24, fontWeight:700, marginBottom:8,
            color: multiSub === "unranked" || hovered === "unranked" ? t.p1 : t.text,
            transition:"color 0.28s cubic-bezier(.22,.68,0,1.2)",
          }}>Unranked</div>
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
            style={{
              background:`linear-gradient(135deg,${t.accent},${t.accentGlow})`,
              border:"none", color:"#0A0A0A",
              fontFamily:t.fontDisplay, fontSize:18, fontWeight:700,
              padding:"18px 64px", borderRadius:ip?2:10, cursor:"pointer",
              boxShadow:`0 0 28px ${t.accentGlow}44`,
              transition:"transform 0.25s cubic-bezier(.22,.68,0,1.2), box-shadow 0.25s cubic-bezier(.22,.68,0,1.2)",
            }}
            onMouseEnter={e => { onHover?.(); e.currentTarget.style.transform="translateY(-3px) scale(1.04)"; e.currentTarget.style.boxShadow=`0 8px 40px ${t.accentGlow}66`; }}
            onMouseLeave={e => { e.currentTarget.style.transform="translateY(0) scale(1)";       e.currentTarget.style.boxShadow=`0 0 28px ${t.accentGlow}44`; }}
            onMouseDown={e  => { e.currentTarget.style.transform="translateY(0) scale(0.97)"; }}
            onMouseUp={e    => { e.currentTarget.style.transform="translateY(-3px) scale(1.04)"; }}
          >FIND MATCH</button>
        </div>
      )}

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinRing { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}