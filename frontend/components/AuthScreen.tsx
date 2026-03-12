"use client";
import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import type { Screen } from "@/lib/types";
import type { ThemeId } from "@/lib/themes";
import API from "@/lib/api";

function validateUsername(val: string): string | null {
  if (val.length < 3) return "Minimum 3 characters";
  if (val.length > 16) return "Maximum 16 characters";
  if (val.startsWith(" ") || val.endsWith(" ")) return "Cannot start or end with a space";
  if (/\s{2,}/.test(val)) return "Only single spaces allowed";
  if (/[^\w\s]/.test(val)) return "No special characters allowed";
  return null;
}

type AuthTab = "signin" | "signup" | "forgot" | "verify_code" | "2fa_check";

interface Props {
  setScreen: (s: Screen) => void;
  themeId: ThemeId;
}

// ── Particle canvas component ──────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", resize);
    resize();

    // Particles
    const COUNT = 110;
    const CONNECT = 100;
    type Pt = { x: number; y: number; vx: number; vy: number; r: number; bright: boolean };
    const pts: Pt[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.55,
      vy: (Math.random() - 0.5) * 0.55,
      r: 1.2 + Math.random() * 2.2,
      bright: Math.random() < 0.15,
    }));

    // initial bg fill
    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      // Soft trail — partial clear
      ctx.fillStyle = "rgba(3,3,3,0.22)";
      ctx.fillRect(0, 0, W, H);

      // Move
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });

      // Connections
      ctx.globalAlpha = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const alpha = (1 - d / CONNECT) * 0.55;
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = "#CC0000";
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Dots
      pts.forEach(p => {
        ctx.shadowBlur   = p.bright ? 18 : 8;
        ctx.shadowColor  = p.bright ? "#ff4444" : "#CC0000";
        ctx.fillStyle    = p.bright ? "#ff3333" : "#CC0000";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        display: "block",
      }}
    />
  );
}

export default function AuthScreen({ setScreen, themeId }: Props) {
  const t = THEMES[themeId];
  const [tab, setTab]               = useState<AuthTab>("signin");
  const [username, setUsername]     = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [forgotEmail, setForgotEmail]   = useState("");
  const [resetCode, setResetCode]   = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [newConfirm, setNewConfirm]     = useState("");
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [shake, setShake]           = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [tempToken, setTempToken]   = useState("");
  const [totpCode, setTotpCode]     = useState("");
  const [staySignedIn, setStaySignedIn] = useState(false);
  const { setAuth } = useAuthStore();

  const ACCENT  = "#CC0000";
  const ACCENT2 = "#ffffff";
 
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 420); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (tab === "signup") {
      const ue = validateUsername(username); if (ue) e.username = ue;
      if (!email.includes("@") || !email.includes(".")) e.email = "Enter a valid email";
    } else if (tab === "signin") {
      if (!username.trim()) e.username = "Username or email required";
    }
    if (tab === "signin" || tab === "signup") {
      if (password.length < 6) e.password = "Minimum 6 characters";
      if (tab === "signup" && password !== confirm) e.confirm = "Passwords do not match";
    }
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); triggerShake(); return; }
    setErrors({}); setLoading(true);
    try {
      const endpoint = tab === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload  = tab === "signup"
        ? { username, email, password }
        : { username, password, device_token: localStorage.getItem("pp_device_token") };
      const res = await API.post(endpoint, payload);
      if (res.data.requires_2fa) { setTempToken(res.data.temp_token); setTab("2fa_check"); return; }
      if (res.data.device_token) localStorage.setItem("pp_device_token", res.data.device_token);
      setAuth(res.data.user, res.data.access_token, staySignedIn);
      setScreen("home");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ general: typeof detail === "string" ? detail : "Invalid credentials or server error" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitForgot = async () => {
    if (!forgotEmail.includes("@") || !forgotEmail.includes(".")) { setErrors({ forgotEmail: "Enter a valid email" }); triggerShake(); return; }
    setErrors({}); setLoading(true);
    try {
      await API.post("/api/auth/forgot-password", { email: forgotEmail });
      setSuccessMsg("A 6-digit code has been sent to your email.");
      setTab("verify_code");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ forgotEmail: typeof detail === "string" ? detail : "Could not send reset email" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    const e: Record<string, string> = {};
    if (resetCode.trim().length !== 6) e.resetCode = "Enter the 6-digit code";
    if (newPassword.length < 6) e.newPassword = "Minimum 6 characters";
    if (newPassword !== newConfirm) e.newConfirm = "Passwords do not match";
    if (Object.keys(e).length > 0) { setErrors(e); triggerShake(); return; }
    setErrors({}); setLoading(true);
    try {
      await API.post("/api/auth/reset-password", { email: forgotEmail, code: resetCode.trim(), new_password: newPassword });
      setSuccessMsg("Password reset! You can now sign in.");
      setTab("signin");
      setForgotEmail(""); setResetCode(""); setNewPassword(""); setNewConfirm("");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ resetCode: typeof detail === "string" ? detail : "Invalid or expired code" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const submit2FA = async () => {
    if (totpCode.trim().length !== 6) { setErrors({ totpCode: "Enter the 6-digit code" }); triggerShake(); return; }
    setErrors({}); setLoading(true);
    try {
      const res = await API.post("/api/auth/2fa/login", { temp_token: tempToken, code: totpCode.trim() });
      if (res.data.device_token) localStorage.setItem("pp_device_token", res.data.device_token);
      setAuth(res.data.user, res.data.access_token, staySignedIn);
      setScreen("home");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ totpCode: typeof detail === "string" ? detail : "Invalid code" });
      triggerShake();
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (tab === "signin" || tab === "signup") submit();
    else if (tab === "forgot") submitForgot();
    else if (tab === "verify_code") submitReset();
    else if (tab === "2fa_check") submit2FA();
  };

  // ── Shared field components ───────────────────────────────────────
  const FONT = "'Georgia', 'Times New Roman', serif";

  const inputStyle = (error: boolean): React.CSSProperties => ({
    width: "100%", padding: "10px 13px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${error ? ACCENT2 : "rgba(255,255,255,0.1)"}`,
    borderRadius: 8, color: "#fff",
    fontFamily: FONT, fontSize: 15,
    outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: FONT,
    fontSize: 11, color: "#666",
    letterSpacing: "0.18em", marginBottom: 6,
    textTransform: "uppercase",
  };

  const errorStyle: React.CSSProperties = {
    color: ACCENT2, fontSize: 12, marginTop: 4,
    fontFamily: FONT,
  };

  const field = (
    key: string, label: string, value: string,
    onChange: (v: string) => void, error: string,
    placeholder: string, type = "text"
  ) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
        onKeyDown={handleKeyDown}
        style={inputStyle(!!error)}
        onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
        onBlur={e  => { e.target.style.borderColor = error ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
      />
      {error && <div style={errorStyle}>⚠ {error}</div>}
    </div>
  );

  const passwordField = (
    key: string, label: string, value: string,
    onChange: (v: string) => void, error: string,
    placeholder: string, show: boolean, setShow: (v: boolean) => void
  ) => (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"} value={value} placeholder={placeholder}
          onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
          onKeyDown={handleKeyDown}
          style={{ ...inputStyle(!!error), paddingRight: 42 }}
          onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
          onBlur={e  => { e.target.style.borderColor = error ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
        />
        <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
          style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.45, color: "#fff", display: "flex", alignItems: "center" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.45"}
        >
          {show ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          )}
        </button>
      </div>
      {error && <div style={errorStyle}>⚠ {error}</div>}
    </div>
  );

  const Checkbox = ({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) => (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", marginBottom: 6, userSelect: "none" }}>
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: `1.5px solid ${checked ? ACCENT : "rgba(255,255,255,0.2)"}`,
        background: checked ? ACCENT : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontFamily: FONT, fontSize: 13, color: "#555" }}>{label}</span>
    </div>
  );

  const PrimaryBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: "11px",
        background: disabled ? "rgba(204,0,0,0.3)" : ACCENT,
        border: "none", borderRadius: 8,
        color: "#fff", fontFamily: FONT,
        fontSize: 14, fontWeight: 700, letterSpacing: "0.1em",
        cursor: disabled ? "not-allowed" : "pointer",
        textTransform: "uppercase",
        boxShadow: disabled ? "none" : `0 0 20px ${ACCENT}44`,
        transition: "all 0.18s", marginTop: 8,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = ACCENT2; e.currentTarget.style.boxShadow = `0 0 28px ${ACCENT}66`; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = ACCENT; e.currentTarget.style.boxShadow = `0 0 20px ${ACCENT}44`; } }}
    >{label}</button>
  );

  const GhostBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}
      style={{
        width: "100%", padding: "10px",
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8, color: "#555",
        fontFamily: FONT,
        fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
        cursor: "pointer", textTransform: "uppercase",
        transition: "all 0.18s", marginTop: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#555"; }}
    >{label}</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2,
      display: "flex", flexDirection: "row",
      background: "#030303",
    }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        .pp-auth-shake { animation: shake 0.42s ease; }
        @keyframes fadeInLeft { from{opacity:0;transform:translateX(-22px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInRight { from{opacity:0;transform:translateX(22px)} to{opacity:1;transform:translateX(0)} }
        .pp-left  { animation: fadeInLeft  0.6s cubic-bezier(.22,.68,0,1.1) both; }
        .pp-right { animation: fadeInRight 0.55s cubic-bezier(.22,.68,0,1.1) 0.1s both; }
        input::placeholder { color: #333; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CC000044; border-radius: 2px; }
      `}</style>

      {/* ── LEFT PANEL — 70% — particle bg + logo ── */}
      <div className="pp-left" style={{
        flex: "0 0 70%", position: "relative",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Particle canvas */}
        <ParticleCanvas />

        {/* Vignette overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(3,3,3,0.7) 100%)",
          pointerEvents: "none",
        }} />

        {/* Right-edge fade into right panel */}
        <div style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: 120, zIndex: 2,
          background: "linear-gradient(to right, transparent, #0d0d0d)",
          pointerEvents: "none",
        }} />

        {/* Logo content */}
        <div style={{
          position: "relative", zIndex: 3,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 28,
          userSelect: "none",
        }}>
          {/* Logo image — transparent PNG over dark particle bg */}
          <img
            src="/Pentaprotocol_Logo_Transparent.png"
            alt="PentaProtocol Logo"
            style={{
              width: 220, height: 220,
              objectFit: "contain",
              filter: "drop-shadow(0 0 32px rgba(255,100,30,0.55)) drop-shadow(0 0 80px rgba(200,60,0,0.3))",
            }}
          />

          {/* Wordmark */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: 38, fontWeight: 900, letterSpacing: "0.22em",
              color: "#fff",
              textShadow: `0 0 40px rgba(204,0,0,0.5), 0 0 80px rgba(204,0,0,0.2)`,
              lineHeight: 1,
            }}>
              PENTA<span style={{ color: ACCENT }}>PROTOCOL</span>
            </div>
            <div style={{
              fontFamily: "'Times New Roman', serif",
              fontSize: 25, letterSpacing: "0.2em",
              color: "#ffffff", marginTop: 1,
              textTransform: "uppercase",
            }}>
              5×5 GRID PROTOCOL
            </div>
          </div>
          {/* Tagline badges */}
          <div style={{ display: "flex", gap: 5, marginTop: 0, alignItems: "center" }}>
            {["AI", "RANKED", "SOLO"].map((tag, i) => (
              <React.Fragment key={tag}>
                {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>·</span>}
                <div style={{
                  fontFamily: "'Times New Roman', serif",
                  fontSize: 20, letterSpacing: "0.2em",
                  color: "#ffffff",
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}>{tag}</div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Bottom left version tag */}
        <div style={{
          position: "absolute", bottom: 22, left: 28, zIndex: 3,
          fontFamily: "'Courier New', monospace", fontSize: 10,
          color: "#2a2a2a", letterSpacing: "0.15em",
        }}>
          v1.0 · PROTOCOL ACTIVE
        </div>
      </div>

      {/* ── RIGHT PANEL — 30% — auth form ── */}
      <div className="pp-right" style={{
        flex: "0 0 30%",
        background: "#0d0d0d",
        borderLeft: "1px solid rgba(204,0,0,0.12)",
        display: "flex", flexDirection: "column",
        alignItems: "stretch", justifyContent: "center",
        padding: "32px 32px",
        overflowY: "auto",
        position: "relative",
      }}>
        {/* Top label */}
        <div style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 18, color: "#ffffff",
          letterSpacing: "0.22em", textTransform: "uppercase",
          marginBottom: 28, fontWeight: 900,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
          <span>AUTHENTICATION PORTAL</span>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
        </div>

        {/* Tab toggle — signin / signup only */}
        {(tab === "signin" || tab === "signup") && (
          <div style={{
            display: "flex", marginBottom: 24,
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8, overflow: "hidden",
          }}>
            {(["signin", "signup"] as const).map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setErrors({}); setSuccessMsg(""); setShowPassword(false); setShowConfirm(false); }}
                style={{
                  flex: 1, padding: "10px",
                  background: tab === tb ? `rgba(204,0,0,0.15)` : "transparent",
                  border: "none",
                  borderRight: tb === "signin" ? "1px solid rgba(255,255,255,0.07)" : "none",
                  color: tab === tb ? ACCENT : "#444",
                  fontFamily: FONT,
                  fontSize: 13, fontWeight: tab === tb ? 700 : 400,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", transition: "all 0.18s",
                }}>
                {tb === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
        )}

        {/* Section headings for non-main tabs */}
        {(tab === "forgot" || tab === "verify_code") && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>
              {tab === "forgot" ? "RESET PASSWORD" : "VERIFY CODE"}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#FFF", lineHeight: 1.6 }}>
              {tab === "forgot" ? "Enter your email to receive a 6-digit reset code." : `Code sent to ${forgotEmail}. Enter it below.`}
            </div>
          </div>
        )}

        {tab === "2fa_check" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>TWO-FACTOR AUTH</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#444", lineHeight: 1.6 }}>Enter the 6-digit code from your authenticator app.</div>
          </div>
        )}

        {/* Success / Error messages */}
        {successMsg && (
          <div style={{ background: "rgba(0,200,80,0.08)", border: "1px solid rgba(0,200,80,0.3)", borderRadius: 7, padding: "10px 13px", marginBottom: 14, fontFamily: FONT, fontSize: 12, color: "#00c850", lineHeight: 1.5 }}>
            ✓ {successMsg}
          </div>
        )}
        {errors.general && (
          <div style={{ background: "rgba(204,0,0,0.08)", border: "1px solid rgba(204,0,0,0.3)", borderRadius: 7, padding: "10px 13px", marginBottom: 14, fontFamily: FONT, fontSize: 12, color: ACCENT2, lineHeight: 1.5 }}>
            ⚠ {errors.general}
          </div>
        )}

        {/* ── Form content ── */}
        <div className={shake ? "pp-auth-shake" : ""}>

          {tab === "signin" && (<>
            {field("username", "Username / Email", username, setUsername, errors.username || "", "Enter username or email")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Enter password", showPassword, setShowPassword)}
            <Checkbox checked={staySignedIn} onToggle={() => setStaySignedIn(s => !s)} label="Stay signed in for 30 days" />
            <PrimaryBtn label={loading ? "Signing in…" : "Sign In"} onClick={submit} disabled={loading} />
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setTab("forgot"); setErrors({}); setSuccessMsg(""); }}
                style={{ background: "none", border: "none", color: "#555", fontFamily: FONT, fontSize: 14, cursor: "pointer", letterSpacing: "0.05em", textDecoration: "underline", textDecorationColor: "#444", fontStyle: "italic" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = ACCENT}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444"}
              >Forgot password?</button>
            </div>
          </>)}

          {tab === "signup" && (<>
            {field("username", "Username", username, setUsername, errors.username || "", "3–16 chars, no special chars")}
            {field("email", "Email", email, setEmail, errors.email || "", "you@example.com")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Min 6 characters", showPassword, setShowPassword)}
            {passwordField("confirm", "Confirm Password", confirm, setConfirm, errors.confirm || "", "Re-enter password", showConfirm, setShowConfirm)}
            <PrimaryBtn label={loading ? "Creating account…" : "Create Account"} onClick={submit} disabled={loading} />
          </>)}

          {tab === "forgot" && (<>
            {field("forgotEmail", "Email Address", forgotEmail, setForgotEmail, errors.forgotEmail || "", "you@example.com")}
            <PrimaryBtn label={loading ? "Sending…" : "Send Reset Code"} onClick={submitForgot} disabled={loading} />
            <GhostBtn label="← Back to Sign In" onClick={() => { setTab("signin"); setErrors({}); setSuccessMsg(""); }} />
          </>)}

          {tab === "verify_code" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>6-Digit Code</label>
              <input type="text" value={resetCode} maxLength={6}
                onChange={e => { setResetCode(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, resetCode: "" })); }}
                onKeyDown={handleKeyDown} placeholder="482916"
                style={{ ...inputStyle(!!errors.resetCode), textAlign: "center", fontSize: 22, letterSpacing: "0.35em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.resetCode ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.resetCode && <div style={errorStyle}>⚠ {errors.resetCode}</div>}
            </div>
            {field("newPassword", "New Password", newPassword, setNewPassword, errors.newPassword || "", "Min 6 characters", "password")}
            {field("newConfirm", "Confirm New Password", newConfirm, setNewConfirm, errors.newConfirm || "", "Re-enter new password", "password")}
            <PrimaryBtn label={loading ? "Resetting…" : "Reset Password"} onClick={submitReset} disabled={loading} />
            <GhostBtn label="← Resend Code" onClick={() => setTab("forgot")} />
          </>)}

          {tab === "2fa_check" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Authenticator Code</label>
              <input type="text" value={totpCode} maxLength={6} autoFocus
                onChange={e => { setTotpCode(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, totpCode: "" })); }}
                onKeyDown={handleKeyDown} placeholder="000000"
                style={{ ...inputStyle(!!errors.totpCode), textAlign: "center", fontSize: 26, letterSpacing: "0.4em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.totpCode ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.totpCode && <div style={errorStyle}>⚠ {errors.totpCode}</div>}
            </div>
            <PrimaryBtn label={loading ? "Verifying…" : "Verify"} onClick={submit2FA} disabled={loading} />
            <GhostBtn label="← Back to Sign In" onClick={() => { setTab("signin"); setTempToken(""); setTotpCode(""); setErrors({}); }} />
          </>)}

        </div>

        {/* ── Continue as Guest ── */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setScreen("home")}
            style={{
              width: "100%", padding: "10px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8, color: "#3a3a3a",
              fontFamily: FONT,
              fontSize: 13, fontWeight: 600, letterSpacing: "0.08em",
              cursor: "pointer", textTransform: "uppercase",
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(204,0,0,0.4)"; e.currentTarget.style.color = "#CC0000"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#3a3a3a"; }}
          >
            Continue as Guest
          </button>
        </div>

        {/* Bottom decoration */}
        <div style={{
          position: "absolute", bottom: 20, left: 32, right: 32,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
          <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.15em", lineHeight: 1 }}>PENTAPROTOCOL</div>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
        </div>
      </div>
    </div>
  );
}