"use client";
import { useState } from "react";
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

export default function AuthScreen({ setScreen, themeId }: Props) {
  const t = THEMES[themeId];
  const [tab, setTab]               = useState<AuthTab>("signin");
  const [username, setUsername]     = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirm, setConfirm]       = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(false);
  const [shake, setShake]           = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [tempToken, setTempToken]   = useState("");
  const [totpCode, setTotpCode]     = useState("");
  const [staySignedIn, setStaySignedIn] = useState(false);
  const { setAuth } = useAuthStore();
  const ip = themeId === "pixel";

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
      if (res.data.requires_2fa) {
        setTempToken(res.data.temp_token);
        setTab("2fa_check");
        return;
      }
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
    if (!forgotEmail.includes("@") || !forgotEmail.includes(".")) {
      setErrors({ forgotEmail: "Enter a valid email" }); triggerShake(); return;
    }
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

  // Standard text/email field
  const field = (
    key: string, label: string, value: string,
    onChange: (v: string) => void, error: string,
    placeholder: string, type = "text"
  ) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ width:"100%", padding:"11px 13px", background:t.inputBg, border:`${ip?2:1}px solid ${error?t.danger:t.border}`, borderRadius:ip?2:7, color:t.text, fontFamily:t.fontBody, fontSize:15, transition:"border-color 0.2s", boxSizing:"border-box" as const }}
        onFocus={e => e.target.style.borderColor = error ? t.danger : t.borderAccent}
        onBlur={e  => e.target.style.borderColor = error ? t.danger : t.border}
      />
      {error && <div style={{ color:t.danger, fontSize:12, marginTop:4, fontFamily:t.fontBody }}>⚠ {error}</div>}
    </div>
  );

  // Password field with show/hide toggle + optional show-password checkbox
  const passwordField = (
    key: string, label: string, value: string,
    onChange: (v: string) => void, error: string,
    placeholder: string,
    show: boolean, setShow: (v: boolean) => void
  ) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type={show ? "text" : "password"} value={value}
          onChange={e => { onChange(e.target.value); setErrors(er => ({ ...er, [key]: "" })); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ width:"100%", padding:"11px 42px 11px 13px", background:t.inputBg, border:`${ip?2:1}px solid ${error?t.danger:t.border}`, borderRadius:ip?2:7, color:t.text, fontFamily:t.fontBody, fontSize:15, transition:"border-color 0.2s", boxSizing:"border-box" as const }}
          onFocus={e => e.target.style.borderColor = error ? t.danger : t.borderAccent}
          onBlur={e  => e.target.style.borderColor = error ? t.danger : t.border}
        />
        {/* Eye toggle */}
        <button
          type="button"
          onClick={() => setShow(!show)}
          style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:2, opacity:0.55, transition:"opacity 0.15s", lineHeight:1, display:"flex", alignItems:"center" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity="1"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity="0.55"}
          tabIndex={-1}
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMuted }}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: t.textMuted }}>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
      </div>
      {/* Show password checkbox */}
      <div
        onClick={() => setShow(!show)}
        style={{ display:"flex", alignItems:"center", gap:7, marginTop:6, cursor:"pointer", userSelect:"none" as const, width:"fit-content" }}
      >
        <div style={{ width:14, height:14, borderRadius:3, flexShrink:0, border:`${ip?2:1.5}px solid ${show?t.accent:t.border}`, background:show?t.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
          {show && <span style={{ color:"#000", fontSize:9, fontWeight:900, lineHeight:1 }}>✓</span>}
        </div>
        <span style={{ fontFamily:t.fontBody, fontSize:12, color:t.textMuted }}>{show ? "Hide password" : "Show password"}</span>
      </div>
      {error && <div style={{ color:t.danger, fontSize:12, marginTop:4, fontFamily:t.fontBody }}>⚠ {error}</div>}
    </div>
  );

  const btnStyle = (primary = true) => ({
    width:"100%", padding:ip?13:14,
    background: primary ? (loading?t.bgCard:ip?t.accent:`linear-gradient(135deg,${t.accent},${t.accentGlow})`) : "transparent",
    border: primary ? (ip?`3px solid ${t.accentGlow}`:"none") : `1px solid ${t.border}`,
    color: primary ? (ip?t.bg:"#0A0A0A") : t.textMuted,
    fontFamily:t.fontDisplay, fontSize:ip?12:15, fontWeight:700,
    borderRadius:ip?2:9, cursor:loading?"not-allowed":"pointer",
    opacity:loading?0.7:1, transition:"all 0.2s",
    boxShadow: primary?`0 0 24px ${t.accentGlow}33`:"none",
    marginTop:6,
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:2, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:t.bg, padding:24, transition:"background 0.4s" }}>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontFamily:t.fontDisplay, fontSize:ip?16:36, fontWeight:700, color:t.accent, textShadow:`0 0 30px ${t.accentGlow}44`, letterSpacing:ip?"0.1em":"0.04em" }}>
          {ip?"★ PENTAPROTOCOL ★":"PENTAPROTOCOL"}
        </div>
        <div style={{ fontFamily:t.fontBody, fontSize:14, color:t.textMuted, marginTop:6 }}>5×5 · Ranked Strategy</div>
      </div>

      <div className={shake?"shake":""} style={{ background:t.bgPanel, border:`${ip?3:1}px solid ${t.border}`, borderRadius:ip?2:18, padding:"34px 38px", width:"min(440px,92vw)", boxShadow:`0 32px 80px ${t.overlay}`, transition:"background 0.4s, border-color 0.4s" }}>

        {/* ── TABS ── */}
        {(tab==="signin"||tab==="signup") && (
          <div style={{ display:"flex", marginBottom:26, border:`${ip?2:1}px solid ${t.border}`, borderRadius:ip?2:8, overflow:"hidden" }}>
            {(["signin","signup"] as const).map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setErrors({}); setSuccessMsg(""); setShowPassword(false); setShowConfirm(false); }}
                style={{ flex:1, padding:ip?10:11, background:tab===tb?`${t.accent}20`:"transparent", border:"none", borderRight:tb==="signin"?`${ip?2:1}px solid ${t.border}`:"none", color:tab===tb?t.accent:t.textMuted, fontFamily:t.fontDisplay, fontSize:ip?11:15, fontWeight:tab===tb?700:400, cursor:"pointer", transition:"all 0.18s" }}>
                {tb==="signin"?"Sign In":"Sign Up"}
              </button>
            ))}
          </div>
        )}

        {/* ── Forgot / Reset header ── */}
        {(tab==="forgot"||tab==="verify_code") && (
          <div style={{ marginBottom:22 }}>
            <div style={{ fontFamily:t.fontDisplay, fontSize:ip?13:20, fontWeight:700, color:t.accent, marginBottom:6 }}>
              {tab==="forgot"?"RESET PASSWORD":"ENTER CODE"}
            </div>
            <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>
              {tab==="forgot" ? "Enter your email — we'll send a 6-digit reset code." : `Code sent to ${forgotEmail}. Enter it below to set a new password.`}
            </div>
          </div>
        )}

        {/* ── Success banner ── */}
        {successMsg && (
          <div style={{ background:`${t.success}18`, border:`1px solid ${t.success}`, borderRadius:6, padding:"10px 14px", marginBottom:16, color:t.success, fontFamily:t.fontBody, fontSize:13 }}>
            ✓ {successMsg}
          </div>
        )}

        {/* ── Error banner ── */}
        {errors.general && (
          <div style={{ background:`${t.danger}18`, border:`1px solid ${t.danger}`, borderRadius:6, padding:"10px 14px", marginBottom:16, color:t.danger, fontFamily:t.fontBody, fontSize:14 }}>
            ⚠ {errors.general}
          </div>
        )}

        {/* ── SIGN IN ── */}
        {tab==="signin" && (<>
          {field("username","USERNAME / EMAIL",username,setUsername,errors.username||"","Enter username or email")}
          {passwordField("password","PASSWORD",password,setPassword,errors.password||"","Enter password",showPassword,setShowPassword)}
          <div onClick={() => setStaySignedIn(s=>!s)} style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", userSelect:"none" as const, marginBottom:4 }}>
            <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, border:`2px solid ${staySignedIn?t.accent:t.border}`, background:staySignedIn?t.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" }}>
              {staySignedIn && <span style={{ color:"#000", fontSize:12, fontWeight:900, lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>Stay signed in for 30 days</span>
          </div>
          <button onClick={submit} disabled={loading} style={btnStyle()}>
            {loading?"Please wait…":"Sign In"}
          </button>
          <div style={{ textAlign:"center", marginTop:14 }}>
            <button onClick={() => { setTab("forgot"); setErrors({}); setSuccessMsg(""); }}
              style={{ background:"none", border:"none", color:t.accent, fontFamily:t.fontBody, fontSize:13, cursor:"pointer", textDecoration:"underline", opacity:0.8 }}>
              Forgot password?
            </button>
          </div>
        </>)}

        {/* ── SIGN UP ── */}
        {tab==="signup" && (<>
          {field("username","USERNAME",username,setUsername,errors.username||"","3–16 chars, no emojis")}
          {field("email","EMAIL",email,setEmail,errors.email||"","you@example.com")}
          {passwordField("password","PASSWORD",password,setPassword,errors.password||"","Min 6 characters",showPassword,setShowPassword)}
          {passwordField("confirm","CONFIRM PASSWORD",confirm,setConfirm,errors.confirm||"","Re-enter password",showConfirm,setShowConfirm)}
          <button onClick={submit} disabled={loading} style={btnStyle()}>
            {loading?"Please wait…":"Create Account"}
          </button>
        </>)}

        {/* ── FORGOT PASSWORD ── */}
        {tab==="forgot" && (<>
          {field("forgotEmail","EMAIL ADDRESS",forgotEmail,setForgotEmail,errors.forgotEmail||"","you@example.com")}
          <button onClick={submitForgot} disabled={loading} style={btnStyle()}>
            {loading?"Sending…":"Send Reset Code"}
          </button>
          <button onClick={() => { setTab("signin"); setErrors({}); setSuccessMsg(""); }} style={btnStyle(false)}>
            ← Back to Sign In
          </button>
        </>)}

        {/* ── VERIFY CODE + NEW PASSWORD ── */}
        {tab==="verify_code" && (<>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>6-DIGIT CODE</label>
            <input type="text" value={resetCode} maxLength={6}
              onChange={e => { setResetCode(e.target.value.replace(/\D/g,"")); setErrors(er => ({...er,resetCode:""})); }}
              onKeyDown={handleKeyDown} placeholder="e.g. 482916"
              style={{ width:"100%", padding:"13px", background:t.inputBg, border:`${ip?2:1}px solid ${errors.resetCode?t.danger:t.border}`, borderRadius:ip?2:7, color:t.text, fontFamily:t.fontMono, fontSize:22, letterSpacing:"0.3em", textAlign:"center", boxSizing:"border-box" as const, transition:"border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = errors.resetCode?t.danger:t.borderAccent}
              onBlur={e  => e.target.style.borderColor = errors.resetCode?t.danger:t.border}
            />
            {errors.resetCode && <div style={{ color:t.danger, fontSize:12, marginTop:4, fontFamily:t.fontBody }}>⚠ {errors.resetCode}</div>}
          </div>
          {field("newPassword","NEW PASSWORD",newPassword,setNewPassword,errors.newPassword||"","Min 6 characters","password")}
          {field("newConfirm","CONFIRM NEW PASSWORD",newConfirm,setNewConfirm,errors.newConfirm||"","Re-enter new password","password")}
          <button onClick={submitReset} disabled={loading} style={btnStyle()}>
            {loading?"Resetting…":"Reset Password"}
          </button>
          <button onClick={() => setTab("forgot")} style={btnStyle(false)}>
            ← Resend Code
          </button>
        </>)}

        {/* ── 2FA LOGIN CHECK ── */}
        {tab==="2fa_check" && (<>
          <div style={{ marginBottom:22 }}>
            <div style={{ fontFamily:t.fontDisplay, fontSize:ip?13:20, fontWeight:700, color:t.accent, marginBottom:6 }}>TWO-FACTOR AUTH</div>
            <div style={{ fontFamily:t.fontBody, fontSize:13, color:t.textMuted }}>Enter the 6-digit code from your authenticator app.</div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.12em", marginBottom:6 }}>AUTHENTICATOR CODE</label>
            <input type="text" value={totpCode} maxLength={6} autoFocus
              onChange={e => { setTotpCode(e.target.value.replace(/\D/g,"")); setErrors(er => ({...er,totpCode:""})); }}
              onKeyDown={handleKeyDown} placeholder="000000"
              style={{ width:"100%", padding:"13px", background:t.inputBg, border:`${ip?2:1}px solid ${errors.totpCode?t.danger:t.border}`, borderRadius:ip?2:7, color:t.text, fontFamily:t.fontMono, fontSize:28, letterSpacing:"0.4em", textAlign:"center", boxSizing:"border-box" as const, transition:"border-color 0.2s" }}
              onFocus={e => e.target.style.borderColor = errors.totpCode?t.danger:t.borderAccent}
              onBlur={e  => e.target.style.borderColor = errors.totpCode?t.danger:t.border}
            />
            {errors.totpCode && <div style={{ color:t.danger, fontSize:12, marginTop:4, fontFamily:t.fontBody }}>⚠ {errors.totpCode}</div>}
          </div>
          <button onClick={submit2FA} disabled={loading} style={btnStyle()}>
            {loading?"Verifying…":"Verify"}
          </button>
          <button onClick={() => { setTab("signin"); setTempToken(""); setTotpCode(""); setErrors({}); }} style={btnStyle(false)}>
            ← Back to Sign In
          </button>
        </>)}

        {/* ── Back to home ── */}
        <div style={{ textAlign:"center", marginTop:16 }}>
          <button onClick={() => setScreen("home")} style={{ background:"none", border:"none", color:t.textMuted, fontFamily:t.fontBody, fontSize:13, cursor:"pointer" }}>
            ← Back to Home (play as guest)
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
        .shake { animation: shake 0.4s ease; }
        input { outline: none; }
      `}</style>
    </div>
  );
}