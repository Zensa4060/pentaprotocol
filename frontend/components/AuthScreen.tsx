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

type AuthTab = "signin" | "signup" | "forgot" | "verify_code" | "2fa_check" | "verify_signup";

interface Props {
  setScreenAction: (s: Screen) => void;
  themeId: ThemeId;
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let W = 0, H = 0;

    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const onMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousemove", onMouseMove);
    resize();

    const COUNT = 110;
    const CONNECT = 100;
    const ATTRACT_RADIUS = 500;
    const ATTRACT_FORCE  = 65;
    const MAX_SPEED      = 40.0;

    type Pt = { x: number; y: number; vx: number; vy: number; r: number; bright: boolean };
    const pts: Pt[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.79,
      vy: (Math.random() - 0.5) * 0.79,
      r: 1.2 + Math.random() * 2.2,
      bright: Math.random() < 0.15,
    }));

    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, W, H);

    const draw = () => {
      ctx.fillStyle = "rgba(3,3,3,0.22)";
      ctx.fillRect(0, 0, W, H);

      pts.forEach(p => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < ATTRACT_RADIUS && dist > 0) {
          const force = (1 - dist / ATTRACT_RADIUS) * ATTRACT_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        p.vx *= 0.98;
        p.vy *= 0.98;

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }

        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      });

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
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
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

export default function AuthScreen({ setScreenAction, themeId }: Props) {
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
  const [isMobile, setIsMobile]     = useState(false);

  // ── NEW: signup OTP state ─────────────────────────────
  const [signupOtp, setSignupOtp]   = useState("");

  const { setAuth } = useAuthStore();

  const ACCENT  = "#CC0000";
  const ACCENT2 = "#ffffff";

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // ── CHANGED: signup now sends OTP first ───────────────
  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); triggerShake(); return; }
    setErrors({}); setLoading(true);
    try {
      if (tab === "signup") {
        // Step 1: send OTP to email
        await API.post("/api/otp/signup/send", { email });
        setSuccessMsg(`A 6-digit code has been sent to ${email}`);
        setTab("verify_signup");
        return;
      }
      // signin flow unchanged
      const res = await API.post("/api/auth/login", {
        username, password,
        device_token: localStorage.getItem("pp_device_token"),
      });
      if (res.data.requires_2fa) { setTempToken(res.data.temp_token); setTab("2fa_check"); return; }
      if (res.data.device_token) localStorage.setItem("pp_device_token", res.data.device_token);
      setAuth(res.data.user, res.data.access_token, staySignedIn);
      setScreenAction("home");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ general: typeof detail === "string" ? detail : "Invalid credentials or server error" });
      triggerShake();
    } finally { setLoading(false); }
  };

  // ── NEW: verify OTP then register ─────────────────────
  const submitSignupOtp = async () => {
    if (signupOtp.trim().length !== 6) {
      setErrors({ signupOtp: "Enter the 6-digit code" });
      triggerShake();
      return;
    }
    setErrors({}); setLoading(true);
    try {
      // Step 2: verify OTP
      await API.post("/api/otp/signup/verify", { email, otp: signupOtp.trim() });
      // Step 3: register
      const res = await API.post("/api/auth/register", { username, email, password });
      setAuth(res.data.user, res.data.access_token, staySignedIn);
      setScreenAction("home");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setErrors({ signupOtp: typeof detail === "string" ? detail : "Invalid or expired code" });
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
      setScreenAction("home");
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
    else if (tab === "verify_signup") submitSignupOtp();
  };

  const FONT = "'Georgia', 'Times New Roman', serif";

  const inputStyle = (error: boolean): React.CSSProperties => ({
    width: "100%", padding: isMobile ? "12px 13px" : "10px 13px",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${error ? ACCENT2 : "rgba(255,255,255,0.1)"}`,
    borderRadius: 8, color: "#fff",
    fontFamily: FONT, fontSize: isMobile ? 16 : 15,
    outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: FONT,
    fontSize: 11.6, color: "#aaa",
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
    <div style={{ marginBottom: isMobile ? 10 : 14 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
        onKeyDown={handleKeyDown}
        style={inputStyle(!!error)}
        onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
        onBlur={e  => { e.target.style.borderColor = error ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
      />
      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );

  const passwordField = (
    key: string, label: string, value: string,
    onChange: (v: string) => void, error: string,
    placeholder: string, show: boolean, setShow: (v: boolean) => void
  ) => (
    <div style={{ marginBottom: isMobile ? 10 : 14 }}>
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
      {error && <div style={errorStyle}>{error}</div>}
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
      <span style={{ fontFamily: FONT, fontSize: 13.7, color: "#aaa" }}>{label}</span>
    </div>
  );

  const PrimaryBtn = ({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", padding: isMobile ? "14px" : "11px",
        background: disabled ? "#111" : "#1c1c1c",
        border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)"}`,
        borderRadius: 8,
        color: disabled ? "rgba(255,255,255,0.3)" : "#fff", fontFamily: FONT,
        fontSize: isMobile ? 15 : 14, fontWeight: 700, letterSpacing: "0.1em",
        cursor: disabled ? "not-allowed" : "pointer",
        textTransform: "uppercase",
        boxShadow: disabled ? "none" : "0 2px 12px rgba(0,0,0,0.6)",
        transition: "all 0.18s", marginTop: 8,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = "#2a2a2a"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.8)"; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = "#1c1c1c"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.6)"; } }}
    >{label}</button>
  );

  const GhostBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}
      style={{
        width: "100%", padding: isMobile ? "13px" : "10px",
        background: "transparent",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 8, color: "#999",
        fontFamily: FONT,
        fontSize: 13.7, fontWeight: 600, letterSpacing: "0.08em",
        cursor: "pointer", textTransform: "uppercase",
        transition: "all 0.18s", marginTop: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#999"; }}
    >{label}</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2,
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      background: "#030303",
      overflowY: isMobile ? "auto" : "hidden",
    }}>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        .pp-auth-shake { animation: shake 0.42s ease; }
        @keyframes fadeInLeft { from{opacity:0;transform:translateX(-22px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInRight { from{opacity:0;transform:translateX(22px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .pp-left  { animation: fadeInLeft  0.6s cubic-bezier(.22,.68,0,1.1) both; }
        .pp-right { animation: fadeInRight 0.55s cubic-bezier(.22,.68,0,1.1) 0.1s both; }
        .pp-right-mobile { animation: fadeInUp 0.5s cubic-bezier(.22,.68,0,1.1) 0.15s both; }
        input::placeholder { color: #666; }
        input:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CC000044; border-radius: 2px; }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div
        className="pp-left"
        style={{
          flex: isMobile ? "0 0 auto" : "0 0 70%",
          height: isMobile ? 130 : "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ParticleCanvas />

        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(3,3,3,0.7) 100%)",
          pointerEvents: "none",
        }} />

        {isMobile && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 80, zIndex: 2,
            background: "linear-gradient(to bottom, transparent, #0d0d0d)",
            pointerEvents: "none",
          }} />
        )}

        {!isMobile && (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 120, zIndex: 2,
            background: "linear-gradient(to right, transparent, #0d0d0d)",
            pointerEvents: "none",
          }} />
        )}

        <div style={{
          position: "relative", zIndex: 3,
          display: "flex",
          flexDirection: isMobile ? "row" : "column",
          alignItems: "center",
          gap: isMobile ? 16 : 28,
          userSelect: "none",
          padding: isMobile ? "0 24px" : 0,
        }}>
          <img
            src="/Pentaprotocol_Logo_Transparent.png"
            alt="PentaProtocol Logo"
            style={{
              width: isMobile ? 50 : 220,
              height: isMobile ? 50 : 220,
              objectFit: "contain",
              filter: "drop-shadow(0 0 32px rgba(255,100,30,0.55)) drop-shadow(0 0 80px rgba(200,60,0,0.3))",
            }}
          />

          <div style={{ textAlign: isMobile ? "left" : "center" }}>
            <div style={{
              fontFamily: "'Courier New', monospace",
              fontSize: isMobile ? 18 : 42,
              fontWeight: 900,
              letterSpacing: isMobile ? "0.1em" : "0.22em",
              lineHeight: 1,
            }}>
              <span style={{
                background: "linear-gradient(to bottom, #ffffff 0%, #999999 50%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))",
                display: "inline",
              }}>PENTA</span><span style={{
                background: "linear-gradient(to bottom, #FF2200 0%, #8B0000 45%, #FF1100 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 12px rgba(255,30,0,0.7))",
                display: "inline",
              }}>PROTOCOL</span>
            </div>

            {!isMobile && (
              <div style={{ display: "flex", gap: 5, marginTop: 12, alignItems: "center", justifyContent: "center" }}>
                {["AI", "RANKED", "SOLO"].map((tag, i) => (
                  <React.Fragment key={tag}>
                    {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>·</span>}
                    <div style={{
                      fontFamily: "'Times New Roman', serif",
                      fontSize: 20, letterSpacing: "0.2em",
                      color: "#ffffff", textTransform: "uppercase", fontWeight: 700,
                    }}>{tag}</div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {!isMobile && (
          <div style={{
            position: "absolute", bottom: 22, left: 28, zIndex: 3,
            fontFamily: "'Courier New', monospace", fontSize: 10,
            color: "#2a2a2a", letterSpacing: "0.15em",
          }}>
            v1.0 · PROTOCOL ACTIVE
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ── */}
      <div
        className={isMobile ? "pp-right-mobile" : "pp-right"}
        style={{
          flex: isMobile ? "1 1 auto" : "0 0 30%",
          background: "#0d0d0d",
          borderLeft: isMobile ? "none" : "1px solid rgba(204,0,0,0.12)",
          borderTop: isMobile ? "1px solid rgba(204,0,0,0.12)" : "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: isMobile ? "flex-start" : "center",
          padding: isMobile ? "15px 15px 24px" : "32px 32px",
          overflowY: "auto",
          position: "relative",
        }}
      >
        <div style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: isMobile ? 12 : 18,
          color: "#ffffff",
          letterSpacing: isMobile ? "0.12em" : "0.22em",
          textTransform: "uppercase",
          marginBottom: isMobile ? 12 : 24,
          fontWeight: 900,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
          <span>AUTHENTICATION PORTAL</span>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.3)" }} />
        </div>

        {(tab === "signin" || tab === "signup") && (
          <div style={{
            display: "flex", marginBottom: isMobile ? 12 : 24,
            border: "1px solid rgba(255,255,255,0.28)",
            borderRadius: 8, overflow: "hidden",
            background: "#1c1c1c",
          }}>
            {(["signin", "signup"] as const).map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setErrors({}); setSuccessMsg(""); setShowPassword(false); setShowConfirm(false); }}
                style={{
                  flex: 1, padding: isMobile ? "13px" : "10px",
                  background: tab === tb ? "#2e2e2e" : "transparent",
                  border: "none",
                  borderRight: tb === "signin" ? "1px solid rgba(255,255,255,0.15)" : "none",
                  color: tab === tb ? "#ffffff" : "#888",
                  fontFamily: FONT,
                  fontSize: isMobile ? 14 : 13,
                  fontWeight: tab === tb ? 700 : 400,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", transition: "all 0.18s",
                }}>
                {tb === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>
        )}

        {/* Section headings */}
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

        {/* ── NEW: verify signup heading ── */}
        {tab === "verify_signup" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>
              VERIFY EMAIL
            </div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#fff", lineHeight: 1.6 }}>
              A 6-digit code has been sent to <span style={{ color: ACCENT }}>{email}</span>. Enter it below to complete signup.
            </div>
          </div>
        )}

        {tab === "2fa_check" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "0.08em", marginBottom: 6 }}>TWO-FACTOR AUTH</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>Enter the 6-digit code from your authenticator app.</div>
          </div>
        )}

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

        <div className={shake ? "pp-auth-shake" : ""}>

          {tab === "signin" && (<>
            {field("username", "Username / Email", username, setUsername, errors.username || "", "Enter username or email")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Enter password", showPassword, setShowPassword)}
            <Checkbox checked={staySignedIn} onToggle={() => setStaySignedIn(s => !s)} label="Stay signed in for 30 days" />
            <PrimaryBtn label={loading ? "Signing in…" : "Sign In"} onClick={submit} disabled={loading} />
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button onClick={() => { setTab("forgot"); setErrors({}); setSuccessMsg(""); }}
                style={{ background: "none", border: "none", color: "#999", fontFamily: FONT, fontSize: 14.7, cursor: "pointer", letterSpacing: "0.05em", textDecoration: "underline", textDecorationColor: "#777", fontStyle: "italic" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = ACCENT}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#999"}
              >Forgot password?</button>
            </div>
          </>)}

          {tab === "signup" && (<>
            {field("username", "Username", username, setUsername, errors.username || "", "3–16 chars, no special chars")}
            {field("email", "Email", email, setEmail, errors.email || "", "you@example.com")}
            {passwordField("password", "Password", password, setPassword, errors.password || "", "Min 6 characters", showPassword, setShowPassword)}
            {passwordField("confirm", "Confirm Password", confirm, setConfirm, errors.confirm || "", "Re-enter password", showConfirm, setShowConfirm)}
            <PrimaryBtn label={loading ? "Sending OTP…" : "Continue"} onClick={submit} disabled={loading} />
          </>)}

          {/* ── NEW: signup OTP verification screen ── */}
          {tab === "verify_signup" && (<>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>6-Digit Code</label>
              <input type="text" value={signupOtp} maxLength={6} autoFocus
                onChange={e => { setSignupOtp(e.target.value.replace(/\D/g, "")); setErrors(er => ({ ...er, signupOtp: "" })); }}
                onKeyDown={handleKeyDown} placeholder="482916"
                style={{ ...inputStyle(!!errors.signupOtp), textAlign: "center", fontSize: 22, letterSpacing: "0.35em", fontFamily: "'Courier New', monospace" }}
                onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 2px ${ACCENT}22`; }}
                onBlur={e  => { e.target.style.borderColor = errors.signupOtp ? ACCENT2 : "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
              {errors.signupOtp && <div style={errorStyle}>{errors.signupOtp}</div>}
            </div>
            <PrimaryBtn label={loading ? "Verifying…" : "Verify & Create Account"} onClick={submitSignupOtp} disabled={loading} />
            <GhostBtn label="← Resend Code" onClick={async () => {
              setLoading(true);
              try {
                await API.post("/api/otp/signup/send", { email });
                setSuccessMsg("New code sent!");
              } catch {}
              finally { setLoading(false); }
            }} />
            <GhostBtn label="← Back to Sign Up" onClick={() => { setTab("signup"); setSignupOtp(""); setErrors({}); setSuccessMsg(""); }} />
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
              {errors.resetCode && <div style={errorStyle}>{errors.resetCode}</div>}
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
              {errors.totpCode && <div style={errorStyle}>{errors.totpCode}</div>}
            </div>
            <PrimaryBtn label={loading ? "Verifying…" : "Verify"} onClick={submit2FA} disabled={loading} />
            <GhostBtn label="← Back to Sign In" onClick={() => { setTab("signin"); setTempToken(""); setTotpCode(""); setErrors({}); }} />
          </>)}

        </div>

        <div style={{ marginTop: isMobile ? 16 : 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setScreenAction("home")}
            style={{
              width: "100%", padding: isMobile ? "13px" : "10px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, color: "#999",
              fontFamily: FONT,
              fontSize: 13.7, fontWeight: 600, letterSpacing: "0.08em",
              cursor: "pointer", textTransform: "uppercase",
              transition: "all 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.background = "#1e1e1e"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#999"; e.currentTarget.style.background = "transparent"; }}
          >
            Continue as Guest
          </button>
        </div>

        <div style={{
          marginTop: 28,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
          <div style={{ fontFamily: FONT, fontSize: isMobile ? 14 : 20, fontWeight: 700, color: "#FFFFFF", letterSpacing: "0.15em", lineHeight: 1 }}>PENTAPROTOCOL</div>
          <div style={{ flex: 1, height: 1, background: "rgba(204,0,0,0.15)" }} />
        </div>
      </div>
    </div>
  );
}