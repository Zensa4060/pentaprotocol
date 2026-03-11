"use client";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";

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
}

export default function SettingsModal({ onClose, themeId, setThemeId, audio }: Props) {
  const t = THEMES[themeId];
  const { musicVol, setMusicVol, sfxVol, setSfxVol, voiceVol = 0.7, setVoiceVol, muted, toggleMute } = audio;

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
            <div style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.16em", marginBottom:16 }}>AUDIO</div>

            {/* Mute toggle */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
              <span style={{ fontFamily:t.fontBody, fontSize:15, color:t.textSecondary }}>
                {muted ? "🔇 Muted" : "🔊 Audio On"}
              </span>
              <button
                onClick={toggleMute}
                className="settings-mute-btn"
                style={{
                  background: muted ? `${t.danger}18` : `${t.accent}18`,
                  border: `1px solid ${muted ? t.danger : t.accent}`,
                  color: muted ? t.danger : t.accent,
                  fontFamily:t.fontMono, fontSize:12,
                  padding:"6px 18px", borderRadius:6,
                  letterSpacing:"0.08em", cursor:"pointer",
                  transition:"all 0.18s",
                  "--hover-bg": muted ? t.danger : t.accent,
                } as React.CSSProperties}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>

            {/* Music vol */}
            <SliderRow
              label="🎵 Music Volume"
              value={musicVol}
              onChange={setMusicVol}
              disabled={muted}
              accent={t.accent}
              fontBody={t.fontBody}
              fontMono={t.fontMono}
              textSecondary={t.textSecondary}
              textMuted={t.textMuted}
            />

            {/* SFX vol */}
            <SliderRow
              label="🔔 SFX Volume"
              value={sfxVol}
              onChange={setSfxVol}
              disabled={muted}
              accent={t.accent}
              fontBody={t.fontBody}
              fontMono={t.fontMono}
              textSecondary={t.textSecondary}
              textMuted={t.textMuted}
            />

            {/* Voice vol */}
            <SliderRow
              label="🎙️ Voice Volume"
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
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9 }}>
        <span style={{ fontFamily:fontBody, fontSize:14, color:textSecondary }}>{label}</span>
        <span style={{ fontFamily:fontMono, fontSize:13, color:accent, transition:"color 0.2s" }}>
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
        <span style={{ fontFamily:fontMono, fontSize:10, color:textMuted }}>0%</span>
        <span style={{ fontFamily:fontMono, fontSize:10, color:textMuted }}>100%</span>
      </div>
    </div>
  );
}