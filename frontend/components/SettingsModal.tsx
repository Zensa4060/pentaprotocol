"use client";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import { useState, useEffect } from "react";

interface AudioControls {
  musicVol: number;
  setMusicVol: (v: number) => void;
  sfxVol: number;
  setSfxVol: (v: number) => void;
  voiceVol?: number;
  setVoiceVol?: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
}

interface Props {
  onClose: () => void;
  themeId: ThemeId;
  setThemeId: (t: ThemeId) => void;
  audio: AudioControls;
  onNavigateAuth?: () => void; // Passed from NavBar to trigger navigate to auth if guest
}

export default function SettingsModal({ onClose, themeId, setThemeId, audio, onNavigateAuth }: Props) {
  const t = THEMES[themeId];
  const { musicVol, setMusicVol, sfxVol, setSfxVol, voiceVol = 0.7, setVoiceVol, muted, toggleMute } = audio;
  const { user, logout } = useAuthStore();
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    const handleFS = () => setFocusMode(!!document.fullscreenElement);
    handleFS();
    document.addEventListener("fullscreenchange", handleFS);
    return () => document.removeEventListener("fullscreenchange", handleFS);
  }, []);

  const toggleFocus = async () => {
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); } catch {}
    } else {
      try { await document.exitFullscreen(); } catch {}
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0, zIndex:999,
          background:"rgba(0,0,0,0.82)",
          animation:"settingsFadeIn 0.22s ease both",
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background:t.bgPanel, border:`1px solid ${t.accent}44`,
            borderRadius:16, padding:"32px 36px",
            width:"min(460px,92vw)",
            boxShadow:"0 32px 96px rgba(0,0,0,0.72)",
            animation:"settingsSlideIn 0.36s cubic-bezier(.22,.68,0,1.2) both",
            transition:"background 0.4s",
          }}
        >
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
            <div style={{ fontFamily:t.fontDisplay, fontSize:22, fontWeight:700, color:t.text }}>Settings</div>
            <button
              onClick={onClose}
              className="settings-close-btn"
              style={{
                background:"none", border:`1px solid ${t.border}`,
                color:t.textMuted, fontSize:18, padding:"2px 10px",
                borderRadius:6, cursor:"pointer",
                transition:"border-color 0.18s, color 0.18s, background 0.18s",
                "--accent": t.accent,
              } as React.CSSProperties}
            >✕</button>
          </div>

          {/* Audio section */}
          <div>
            <div style={{ fontFamily:t.fontMono, fontSize:13, fontWeight: 800, color:t.accent, letterSpacing:"0.16em", marginBottom:18 }}>AUDIO SETTINGS</div>

            {/* Mute toggle */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:26, background: `${t.bgCard}`, border: `1px solid ${t.border}`, padding: "16px 20px", borderRadius: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily:t.fontDisplay, fontSize:17, fontWeight: 700, color:t.text }}>
                  Master Audio
                </span>
                <span style={{ fontFamily:t.fontBody, fontSize:12, color:t.textSecondary }}>
                  {muted ? "All sounds are currently muted" : "Audio is currently enabled"}
                </span>
              </div>
              <button
                onClick={toggleMute}
                className="settings-mute-btn"
                style={{
                  background: muted ? `${t.danger}18` : `${t.accent}18`,
                  border: `2px solid ${muted ? t.danger : t.accent}`,
                  color: muted ? t.danger : t.accent,
                  fontFamily:t.fontDisplay, fontSize:14, fontWeight: 800,
                  padding:"12px 28px", borderRadius:8,
                  letterSpacing:"0.06em", cursor:"pointer",
                  transition:"all 0.18s",
                  textTransform: "uppercase",
                  flexShrink: 0,
                  "--hover-bg": muted ? t.danger : t.accent,
                } as React.CSSProperties}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>

            {/* Music vol */}
            <SliderRow
              label="Music Volume"
              value={musicVol}
              onChange={setMusicVol}
              disabled={muted}
              accent={t.accent}
              fontBody={t.fontBody}
              fontMono={t.fontMono}
              textSecondary={t.text}
              textMuted={t.textSecondary}
            />

            {/* SFX vol */}
            <SliderRow
              label="SFX Volume"
              value={sfxVol}
              onChange={setSfxVol}
              disabled={muted}
              accent={t.accent}
              fontBody={t.fontBody}
              fontMono={t.fontMono}
              textSecondary={t.text}
              textMuted={t.textSecondary}
            />

            {/* Voice vol */}
            <SliderRow
              label="Voice Volume"
              value={voiceVol}
              onChange={setVoiceVol ?? (() => {})}
              disabled={muted}
              accent={t.accent}
              fontBody={t.fontBody}
              fontMono={t.fontMono}
              textSecondary={t.textSecondary}
              textMuted={t.textMuted}
            />
          </div>

          <div style={{ height: 1, background: `${t.border}44`, margin: "24px 0" }} />

          {/* System section */}
          <div>
            <div style={{ fontFamily:t.fontMono, fontSize:13, fontWeight: 800, color:t.accent, letterSpacing:"0.16em", marginBottom:18 }}>SYSTEM SETTINGS</div>
            
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <button
                onClick={toggleFocus}
                style={{
                  width: "100%", padding: "16px",
                  background: focusMode ? `${t.accent}22` : `${t.accent}0A`,
                  border: `1.5px solid ${focusMode ? t.accent : `${t.accent}55`}`,
                  borderRadius: 12, color: t.accent,
                  fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${t.accent}22`; e.currentTarget.style.boxShadow = `0 0 16px ${t.accent}33`; e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = focusMode ? `${t.accent}22` : `${t.accent}0A`; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "scale(1)"; }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {focusMode
                    ? <><polyline points="8 3 3 3 3 8"/><polyline points="21 8 21 3 16 3"/><polyline points="3 16 3 21 8 21"/><polyline points="16 21 21 21 21 16"/></>
                    : <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                  }
                </svg>
                {focusMode ? "EXIT FOCUS MODE" : "ENTER FOCUS MODE"}
              </button>

              {user ? (
                <button
                  onClick={() => { logout(); onClose(); }}
                  style={{
                    width: "100%", padding: "16px",
                    background: `${t.danger}10`,
                    border: `1.5px solid ${t.danger}55`,
                    borderRadius: 12, color: t.danger,
                    fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.danger; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = `0 0 16px ${t.danger}44`; e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${t.danger}10`; e.currentTarget.style.color = t.danger; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  SIGN OUT
                </button>
              ) : (
                <button
                  onClick={() => { if (onNavigateAuth) onNavigateAuth(); onClose(); }}
                  style={{
                    width: "100%", padding: "16px",
                    background: `${t.accent}10`,
                    border: `1.5px solid ${t.accent}55`,
                    borderRadius: 12, color: t.accent,
                    fontFamily: t.fontDisplay, fontSize: 15, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 0 16px ${t.accent}44`; e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${t.accent}10`; e.currentTarget.style.color = t.accent; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  SIGN IN
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes settingsFadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes settingsSlideIn  { from{opacity:0;transform:translateY(28px) scale(0.93)} to{opacity:1;transform:translateY(0) scale(1)} }

        .settings-close-btn {
          transition: border-color 0.22s cubic-bezier(.22,.68,0,1.2),
                      color        0.22s cubic-bezier(.22,.68,0,1.2),
                      background   0.22s cubic-bezier(.22,.68,0,1.2) !important;
        }
        .settings-close-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          background: color-mix(in srgb, var(--accent) 12%, transparent) !important;
          transform: scale(1.08);
        }

        .settings-mute-btn {
          transition: background 0.26s cubic-bezier(.22,.68,0,1.2),
                      color     0.26s cubic-bezier(.22,.68,0,1.2),
                      transform 0.22s cubic-bezier(.22,.68,0,1.2) !important;
        }
        .settings-mute-btn:hover {
          background: var(--hover-bg) !important;
          color: #000 !important;
          transform: scale(1.05);
        }
      `}</style>
    </>
  );
}

// ── Extracted slider row ──
function SliderRow({ label, value, onChange, disabled, accent, fontBody, fontMono, textSecondary, textMuted }: {
  label: string; value: number; onChange: (v: number) => void;
  disabled: boolean; accent: string;
  fontBody: string; fontMono: string;
  textSecondary: string; textMuted: string;
}) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9, alignItems: "center" }}>
        <span style={{ fontFamily:fontBody, fontSize:15, fontWeight: 600, color:textSecondary }}>{label}</span>
        <span style={{ fontFamily:fontMono, fontSize:15, fontWeight: 800, color:accent, transition:"color 0.2s" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range" min="0" max="1" step="0.01"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        style={{ width:"100%", opacity:disabled?0.35:1, accentColor:accent, transition:"opacity 0.2s", cursor:disabled?"not-allowed":"pointer" }}
      />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
        <span style={{ fontFamily:fontMono, fontSize:11, fontWeight: 700, color:textMuted }}>0%</span>
        <span style={{ fontFamily:fontMono, fontSize:11, fontWeight: 700, color:textMuted }}>100%</span>
      </div>
    </div>
  );
}