"use client";
import { useState, useEffect } from "react";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { NavRankBadge, getRank } from "./NavBar";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
  onHover?: () => void;
  onRoomReady?: (roomCode: string, playerSlot: "P1" | "P2", format: string) => void;
}

type Tab = "create" | "join";
type Format = "unranked" | "ranked";

export default function MultiplayerScreen({ setScreen, themeId, onHover, onRoomReady }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const { token, user } = useAuthStore();

  const [tab, setTab] = useState<Tab>("create");
  const [format, setFormat] = useState<Format>("unranked");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [vw, setVw] = useState(1440);

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const isMobile = vw < 640;
  const isTablet = vw >= 640 && vw < 1024;

  const authHeader = { headers: { Authorization: `Bearer ${token}` } };
  const level = (user as any)?.level ?? 1;

  const handleCreate = async () => {
    if (!token) { setError("Sign in to play multiplayer"); return; }
    if (format === "ranked" && level < 5) {
      setError("You must be level 5 to play ranked matches");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await API.post("/api/room/create", { format }, authHeader);
      setRoomCode(res.data.room_code);
      setWaiting(true);
      // Start polling for P2 to join
      pollForPlayer(res.data.room_code);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to create room");
    } finally { setLoading(false); }
  };

  const pollForPlayer = (code: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/api/room/${code}`);
        if (res.data.game_status === "playing") {
          clearInterval(interval);
          onRoomReady?.(code, "P1", res.data.format);
        }
      } catch { clearInterval(interval); }
    }, 2000);
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  };

  const handleJoin = async () => {
    if (!token) { setError("Sign in to play multiplayer"); return; }
    if (!joinCode.trim()) { setError("Enter a room code"); return; }
    setLoading(true); setError(null);
    try {
      const res = await API.post("/api/room/join", { room_code: joinCode.trim().toUpperCase() }, authHeader);
      onRoomReady?.(res.data.room_code, "P2", res.data.format);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not join room");
    } finally { setLoading(false); }
  };

  const cancelRoom = () => {
    setRoomCode(null);
    setWaiting(false);
    setError(null);
  };

  // ── Waiting lobby (after creating a room) ──────────────────────────────────
  if (waiting && roomCode) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 2, background: t.bg,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "84px 24px 48px", gap: 28,
      }}>
        <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px,5vw,56px)", fontWeight: 900, color: t.accent, textAlign: "center" }}>
          WAITING FOR OPPONENT
        </div>

        <div style={{ background: t.bgCard, border: `2px solid ${t.accent}`, borderRadius: ip ? 2 : 16, padding: "32px 48px", textAlign: "center" }}>
          <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textMuted, letterSpacing: "0.2em", marginBottom: 12 }}>
            ROOM CODE
          </div>
          <div style={{
            fontFamily: t.fontDisplay, fontSize: "clamp(36px,8vw,80px)", fontWeight: 900,
            color: t.accent, letterSpacing: "0.15em",
            textShadow: `0 0 40px ${t.accentGlow}55`,
          }}>
            {roomCode}
          </div>
          <div style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, marginTop: 12 }}>
            Share this code with your friend
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.accent, marginTop: 8 }}>
            {format.toUpperCase()} · Waiting...
          </div>
        </div>

        {/* Animated dots */}
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: "50%", background: t.accent,
              animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite`,
              opacity: 0.7,
            }} />
          ))}
        </div>

        <style>{`@keyframes pulse { 0%,100%{transform:scale(0.8);opacity:0.4} 50%{transform:scale(1.2);opacity:1} }`}</style>

        <button onClick={cancelRoom} style={{
          background: "transparent", border: `2px solid ${t.border}`,
          color: t.textMuted, fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700,
          padding: "12px 36px", borderRadius: ip ? 2 : 10, cursor: "pointer",
        }}>
          CANCEL
        </button>
      </div>
    );
  }

  // ── Main screen ────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, background: t.bg, transition: "background 0.4s",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: isMobile ? "flex-start" : "space-evenly",
      padding: isMobile ? "80px 16px 40px" : "90px 24px 40px", overflowY: "auto",
    }}>
      <div style={{
        fontFamily: t.fontDisplay, fontSize: isMobile ? 32 : "clamp(36px,5vw,60px)", fontWeight: 900,
        color: t.accent, textAlign: "center", textShadow: `0 0 40px ${t.accentGlow}44`,
        marginBottom: isMobile ? 24 : 0,
      }}>
        MULTIPLAYER
      </div>

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Tab switcher */}
        <div style={{ display: "flex", marginBottom: 20, background: t.bgCard, borderRadius: ip ? 2 : 12, padding: 4, border: `1px solid ${t.border}` }}>
          {(["create", "join"] as Tab[]).map(tb => (
            <button key={tb} onClick={() => { setTab(tb); setError(null); }}
              style={{
                flex: 1, padding: "12px", border: "none", cursor: "pointer",
                borderRadius: ip ? 0 : 9,
                background: tab === tb ? t.accent : "transparent",
                color: tab === tb ? "#000" : t.textMuted,
                fontFamily: t.fontDisplay, fontSize: 14, fontWeight: 700,
                letterSpacing: "0.08em", transition: "all 0.2s",
              }}>
              {tb === "create" ? "CREATE ROOM" : "JOIN ROOM"}
            </button>
          ))}
        </div>

        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`,
          borderRadius: ip ? 2 : 16, padding: isMobile ? "24px 20px" : "28px 28px 32px",
          display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20,
        }}>

          {/* Error */}
          {error && (
            <div style={{ background: `${t.danger}14`, border: `1px solid ${t.danger}`, borderRadius: 8, padding: "10px 14px", color: t.danger, fontFamily: t.fontBody, fontSize: 13 }}>
              ⚠ {error}
            </div>
          )}

          {tab === "create" && (
            <>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 12 }}>
                  GAME FORMAT
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(["unranked", "ranked"] as Format[]).map(f => {
                    const locked = f === "ranked" && level < 5;
                    const selected = format === f;
                    const dColor = f === "ranked" ? "#B91C1C" : "#22C55E"; // Blood Red for Ranked, Emerald for Unranked
                    
                    return (
                      <button key={f}
                        onClick={() => { if (!locked) { setFormat(f); setError(null); } }}
                        style={{
                          flex: 1, padding: ip ? "24px 20px" : isMobile ? "32px 24px" : "40px 28px",
                          border: `2px solid ${selected ? dColor : locked ? t.border + "44" : t.border}`,
                          borderRadius: ip ? 2 : 16,
                          background: selected ? `linear-gradient(145deg, ${dColor}18, ${t.bgCard})` : t.bgCard,
                          color: locked ? t.textMuted : t.text,
                          textAlign: "left",
                          cursor: locked ? "not-allowed" : "pointer",
                          opacity: locked ? 0.6 : 1,
                          transition: "all 0.3s cubic-bezier(.22,.68,0,1.2)",
                          transform: selected ? "translateY(-4px) scale(1.02)" : "translateY(0) scale(1)",
                          boxShadow: selected ? `0 16px 48px ${dColor}22` : "none",
                        }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: locked ? t.textMuted : dColor, boxShadow: locked ? "none" : `0 0 12px ${dColor}66` }} />
                          <div style={{ fontFamily: t.fontDisplay, fontSize: ip ? 16 : isMobile ? 18 : 22, fontWeight: 700, color: locked ? t.textMuted : selected ? dColor : t.text, letterSpacing: "0.06em" }}>
                            {f.toUpperCase()}
                          </div>
                        </div>
                        <div style={{ fontFamily: t.fontBody, fontSize: ip ? 12 : 14, color: t.textMuted, lineHeight: 1.5 }}>
                          {f === "ranked" ? (locked ? "Requires level 5 to unlock" : "Compete for ELO with strong players") : "Casual match with no ELO impact"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: `${t.accent}08`, border: `1px solid ${t.accent}22`, borderRadius: 8 }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>
                  YOUR LEVEL:
                </div>
                <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800, color: t.accent }}>
                  {level}
                </div>
                {level < 5 && (
                  <div style={{ fontFamily: t.fontBody, fontSize: 11, color: t.textMuted, marginLeft: 4 }}>
                    · Reach level 5 to unlock ranked
                  </div>
                )}
                {level >= 5 && (
                  <div style={{ fontFamily: t.fontBody, fontSize: 11, color: "#4CAF50", marginLeft: 4 }}>
                    · Ranked unlocked ✓
                  </div>
                )}
              </div>

              <button onClick={handleCreate} disabled={loading}
                onMouseEnter={e => { onHover?.(); }}
                style={{
                  width: "100%", padding: "16px",
                  background: t.accent, border: `2px solid ${t.accent}`,
                  borderRadius: ip ? 2 : 10, color: "#000",
                  fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800,
                  cursor: loading ? "wait" : "pointer", letterSpacing: "0.08em",
                  transition: "all 0.2s", boxShadow: `0 0 20px ${t.accentGlow}33`,
                }}>
                {loading ? "CREATING..." : "CREATE ROOM"}
              </button>
            </>
          )}

          {tab === "join" && (
            <>
              <div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.15em", marginBottom: 8 }}>
                  ROOM CODE
                </div>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  maxLength={6}
                  placeholder="XXXXXX"
                  style={{
                    width: "100%", padding: isMobile ? "12px" : "16px", boxSizing: "border-box",
                    background: t.inputBg ?? t.bgCard, border: `2px solid ${t.border}`,
                    borderRadius: ip ? 2 : 10, color: t.accent,
                    fontFamily: t.fontDisplay, fontSize: isMobile ? 24 : 32, fontWeight: 900,
                    letterSpacing: "0.3em", textAlign: "center",
                    outline: "none", transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = t.accent}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
                <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textMuted, marginTop: 6, textAlign: "center" }}>
                  Enter the 6-character code from your friend
                </div>
              </div>

              <button onClick={handleJoin} disabled={loading || joinCode.length !== 6}
                onMouseEnter={e => { onHover?.(); }}
                style={{
                  width: "100%", padding: "16px",
                  background: joinCode.length === 6 ? t.accent : t.bgCard,
                  border: `2px solid ${joinCode.length === 6 ? t.accent : t.border}`,
                  borderRadius: ip ? 2 : 10, color: joinCode.length === 6 ? "#000" : t.textMuted,
                  fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800,
                  cursor: joinCode.length === 6 && !loading ? "pointer" : "not-allowed",
                  letterSpacing: "0.08em", transition: "all 0.2s",
                  boxShadow: joinCode.length === 6 ? `0 0 20px ${t.accentGlow}33` : "none",
                }}>
                {loading ? "JOINING..." : "JOIN ROOM"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: isMobile ? 12 : 0 }}>
        {user && <NavRankBadge rank={getRank(user.elo ?? 0) as any} size={isMobile ? 36 : 42} />}
      </div>

      {/* Go Back is already present but let's re-wrap it to maintain flow */}
      <button onClick={() => setScreen("home")} style={{
        background: `${t.accent}18`, border: `2px solid ${t.accent}`,
        color: t.accent, fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700,
        padding: isMobile ? "12px 32px" : "14px 44px", borderRadius: ip ? 2 : 10,
        cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.2s",
        marginBottom: isMobile ? 20 : 0,
      }}
        onMouseEnter={e => { onHover?.(); e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }}
        onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}>
        GO BACK
      </button>
    </div>
  );
}