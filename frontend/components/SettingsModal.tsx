"use client";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import { useBannerShineEnabled, saveBannerShineEnabled } from "@/lib/bannerShinePreference";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface AudioControls {
  musicVol: number;
  setMusicVol: (v: number) => void;
  sfxVol: number;
  setSfxVol: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
}

interface Props {
  onCloseAction: () => void;
  themeId: ThemeId;
  setThemeIdAction: (t: ThemeId) => void;
  audio: AudioControls;
  onNavigateAuthAction?: () => void; 
  graphicsQuality: "performance" | "quality";
  setGraphicsQualityAction: (v: "performance" | "quality") => void;
  currentScreen?: string;
  /** Hide Google/2FA security block and sign-out while in an active human multiplayer session. */
  suppressAccountActionsDuringMatch?: boolean;
}

type SettingsSection = "audio" | "account" | "system";

export default function SettingsModal({
  onCloseAction,
  themeId,
  setThemeIdAction: _setThemeIdAction,
  audio,
  onNavigateAuthAction,
  graphicsQuality: _graphicsQuality,
  setGraphicsQualityAction: _setGraphicsQualityAction,
  currentScreen: _currentScreen,
  suppressAccountActionsDuringMatch,
}: Props) {
  const t = THEMES[themeId];
  const { musicVol, setMusicVol, sfxVol, setSfxVol, muted, toggleMute } = audio;
  const { user, logout } = useAuthStore();
  const bannerShineEnabled = useBannerShineEnabled((user as any)?.id ?? (user as any)?._id ?? null);
  const router = useRouter();
  const pathname = usePathname();
  // Captured once on mount so the history-placeholder cleanup (see the
  // `useEffect` below) can tell when the user has navigated away from
  // the page the modal was opened on. If they have, we must NOT call
  // `history.back()` — it would rewind past the newly-pushed route
  // (e.g. /auth after clicking SIGN IN) and dump them back on /home.
  const openPathnameRef = useRef(pathname);
  const [focusMode, setFocusMode] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("audio");
  const [narrowLayout, setNarrowLayout] = useState(false);
  const showAccountNav = Boolean(user && !suppressAccountActionsDuringMatch);

  useEffect(() => {
    const handleFS = () => setFocusMode(!!document.fullscreenElement);
    handleFS();
    document.addEventListener("fullscreenchange", handleFS);
    return () => document.removeEventListener("fullscreenchange", handleFS);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showSignOutConfirm) setShowSignOutConfirm(false);
      else onCloseAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCloseAction, showSignOutConfirm]);

  /* Hook the settings shell into the browser history so the user can
   *   press the hardware / browser back button to dismiss the modal and
   *   return to the screen they opened it from, instead of navigating
   *   away from the current route entirely.
   *
   *   On mount we push a placeholder history entry tagged `pp_settings`.
   *   A popstate listener treats any back-navigation away from that
   *   entry as a "close" action. When the user closes the modal by some
   *   other means (✕, Esc, nav action that then calls onCloseAction),
   *   we call history.back() ourselves on unmount to drop our
   *   placeholder entry.
   *
   *   The pushState is deferred one animation frame so React 18
   *   StrictMode's synchronous mount→cleanup→mount cycle doesn't leave
   *   a dangling history entry whose async popstate event would then be
   *   caught by the second mount's listener and immediately close the
   *   modal (the "split-second flash" symptom). */
  const closeRef = useRef(onCloseAction);
  const skipHistoryCleanupRef = useRef(false);
  closeRef.current = onCloseAction;
  useEffect(() => {
    if (typeof window === "undefined") return;
    let pushed = false;
    let popped = false;
    let cancelled = false;

    const onPop = () => {
      popped = true;
      closeRef.current();
    };

    const frameId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        window.history.pushState({ pp_settings: true }, "");
        pushed = true;
      } catch {
        /* history API unavailable — fall back to plain close-only. */
      }
      window.addEventListener("popstate", onPop);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("popstate", onPop);
      if (pushed && !popped && !skipHistoryCleanupRef.current) {
        // If the app has navigated to a different route in the meantime
        // (e.g. SIGN IN button pushed /auth), history.back() would pop
        // that fresh entry and bounce the user back to the page they
        // opened settings on. Only rewind our placeholder when we're
        // still sitting on the same pathname we mounted with.
        const samePath =
          typeof window !== "undefined" &&
          window.location.pathname === openPathnameRef.current;
        if (samePath) {
          try {
            window.history.back();
          } catch {
            /* noop */
          }
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = () => setNarrowLayout(window.innerWidth < 760);
    q();
    window.addEventListener("resize", q);
    return () => window.removeEventListener("resize", q);
  }, []);

  useEffect(() => {
    if (activeSection === "account" && !showAccountNav) setActiveSection("audio");
  }, [activeSection, showAccountNav]);

  const toggleFocus = async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* noop */
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        /* noop */
      }
    }
  };

  const ip = themeId === "pixel";
  const navBtn = (id: SettingsSection, label: string) => {
    const on = activeSection === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setActiveSection(id)}
        style={{
          fontFamily: t.fontDisplay,
          fontSize: narrowLayout ? 20 : 23,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textAlign: narrowLayout ? "center" : "left",
          textTransform: "uppercase",
          padding: narrowLayout ? "10px 16px" : "14px 18px",
          borderRadius: ip ? 2 : 10,
          border: `1px solid ${on ? t.accent : t.border}`,
          background: on ? `${t.accent}22` : "transparent",
          color: t.text,
          cursor: "pointer",
          transition: "border-color 0.18s, background 0.18s, color 0.18s",
          flex: narrowLayout ? "1 1 auto" : undefined,
          minWidth: narrowLayout ? 0 : undefined,
          whiteSpace: narrowLayout ? "nowrap" : undefined,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      {/* Full-screen settings shell: sidebar + scrollable panel */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10020,
          display: "flex",
          flexDirection: "column",
          background: t.bg,
          border: ip ? `3px solid ${t.border}` : `1px solid ${t.accent}33`,
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.35)",
          animation: "settingsFadeIn 0.22s ease both",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: narrowLayout ? "14px 16px" : "18px 28px",
            borderBottom: `1px solid ${t.border}`,
            background: t.bgPanel,
          }}
        >
          <div style={{ fontFamily: t.fontDisplay, fontSize: narrowLayout ? 18 : 24, fontWeight: 800, color: t.text }}>
            Settings
          </div>
          <button
            type="button"
            onClick={onCloseAction}
            className="settings-close-btn"
            style={{
              background: "none",
              border: `1px solid ${t.border}`,
              color: t.textMuted,
              fontSize: 20,
              padding: "4px 14px",
              borderRadius: ip ? 2 : 8,
              cursor: "pointer",
              transition: "border-color 0.18s, color 0.18s, background 0.18s",
              "--accent": t.accent,
            } as React.CSSProperties}
          >
            ✕
          </button>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: narrowLayout ? "column" : "row",
          }}
        >
          <nav
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: narrowLayout ? "row" : "column",
              gap: narrowLayout ? 8 : 10,
              padding: narrowLayout ? "12px 16px" : "20px 18px",
              width: narrowLayout ? "100%" : 248,
              borderRight: narrowLayout ? "none" : `1px solid ${t.border}`,
              borderBottom: narrowLayout ? `1px solid ${t.border}` : "none",
              background: narrowLayout ? t.bgPanel : `${t.bgPanel}cc`,
              overflowX: narrowLayout ? "auto" : "visible",
            }}
          >
            {navBtn("audio", "Audio")}
            {showAccountNav ? navBtn("account", "Account") : null}
            {navBtn("system", "System")}
          </nav>

          <main
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              padding: narrowLayout ? "20px 18px 28px" : "28px 40px 40px",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {activeSection === "audio" && (
              <div style={{ maxWidth: 720 }}>
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 12,
                    fontWeight: 800,
                    color: t.accent,
                    letterSpacing: "0.16em",
                    marginBottom: 20,
                  }}
                >
                  AUDIO SETTINGS
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 28,
                    background: t.bgCard,
                    border: `1px solid ${t.border}`,
                    padding: "18px 22px",
                    borderRadius: ip ? 2 : 12,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, flex: "1 1 220px" }}>
                    <span style={{ fontFamily: t.fontDisplay, fontSize: 17, fontWeight: 700, color: t.text }}>
                      Master Audio
                    </span>
                    <span style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary }}>
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
                      fontFamily: t.fontDisplay,
                      fontSize: 14,
                      fontWeight: 800,
                      padding: "12px 28px",
                      borderRadius: ip ? 2 : 8,
                      letterSpacing: "0.06em",
                      cursor: "pointer",
                      transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
                      textTransform: "uppercase",
                      flexShrink: 0,
                      "--hover-bg": muted ? t.danger : t.accent,
                    } as React.CSSProperties}
                  >
                    {muted ? "Unmute" : "Mute"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: narrowLayout ? "1fr" : "1fr 1fr", gap: narrowLayout ? 8 : 28 }}>
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
                </div>
              </div>
            )}

            {activeSection === "account" && showAccountNav && (
              <div style={{ maxWidth: 640 }}>
                <AccountSecuritySection
                  t={t}
                  googleLinked={Boolean((user as any)?.google_linked || (user as any)?.google_id)}
                  totpEnabled={Boolean((user as any)?.totp_enabled)}
                  onAction={() => {
                    router.push("/profile#security");
                    onCloseAction();
                  }}
                />
              </div>
            )}

            {activeSection === "system" && (
              <div style={{ maxWidth: 900 }}>
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 12,
                    fontWeight: 800,
                    color: t.accent,
                    letterSpacing: "0.16em",
                    marginBottom: 20,
                  }}
                >
                  SYSTEM SETTINGS
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: narrowLayout ? "1fr" : "1fr 1fr",
                    gap: 20,
                    marginBottom: 24,
                    alignItems: "stretch",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      background: t.bgCard,
                      border: `1px solid ${t.border}`,
                      padding: "16px 20px",
                      borderRadius: ip ? 2 : 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <div style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text }}>
                        Banner shine
                      </div>
                      <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                        Gloss sweep on profile, career, match-found, and match sidebar banners.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => saveBannerShineEnabled(!bannerShineEnabled)}
                      style={{
                        padding: "10px 22px",
                        borderRadius: ip ? 2 : 8,
                        border: `2px solid ${bannerShineEnabled ? t.accent : t.border}`,
                        background: bannerShineEnabled ? `${t.accent}22` : "transparent",
                        color: bannerShineEnabled ? t.accent : t.textMuted,
                        fontFamily: t.fontDisplay,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        letterSpacing: "0.06em",
                        flexShrink: 0,
                      }}
                    >
                      {bannerShineEnabled ? "ON" : "OFF"}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={toggleFocus}
                    style={{
                      padding: "18px 20px",
                      background: focusMode ? `${t.accent}22` : `${t.accent}0A`,
                      border: `1.5px solid ${focusMode ? t.accent : `${t.accent}55`}`,
                      borderRadius: ip ? 2 : 12,
                      color: t.accent,
                      fontFamily: t.fontDisplay,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      transition: "background 0.2s, border-color 0.2s, opacity 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `${t.accent}22`;
                      e.currentTarget.style.boxShadow = `0 0 16px ${t.accent}33`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = focusMode ? `${t.accent}22` : `${t.accent}0A`;
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {focusMode ? (
                        <>
                          <polyline points="8 3 3 3 3 8" />
                          <polyline points="21 8 21 3 16 3" />
                          <polyline points="3 16 3 21 8 21" />
                          <polyline points="16 21 21 21 21 16" />
                        </>
                      ) : (
                        <>
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </>
                      )}
                    </svg>
                    {focusMode ? "EXIT FOCUS MODE" : "ENTER FOCUS MODE"}
                  </button>
                </div>

                {/* Guest mode was removed — a user opening this modal is
                    always authenticated, so only the SIGN OUT action is
                    offered here. We still suppress the button mid-match
                    so players can't accidentally log themselves out of a
                    live game from the settings overlay. */}
                {user && !suppressAccountActionsDuringMatch && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    <button
                      type="button"
                      onClick={() => setShowSignOutConfirm(true)}
                      style={{
                        minWidth: 200,
                        flex: narrowLayout ? "1 1 100%" : "0 1 auto",
                        padding: "16px 28px",
                        background: `${t.danger}10`,
                        border: `1.5px solid ${t.danger}55`,
                        borderRadius: ip ? 2 : 12,
                        color: t.danger,
                        fontFamily: t.fontDisplay,
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "background 0.2s, border-color 0.2s, opacity 0.2s, box-shadow 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = t.danger;
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `${t.danger}10`;
                        e.currentTarget.style.color = t.danger;
                      }}
                    >
                      SIGN OUT
                    </button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Sign out confirm modal */}
      {showSignOutConfirm && (
        <div
          onClick={() => setShowSignOutConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10030,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            animation: "settingsFadeIn 0.18s ease both",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 94vw)",
              background: t.bgPanel,
              border: `1px solid ${t.border}`,
              borderRadius: 16,
              padding: "28px 28px",
              boxShadow: "0 32px 96px rgba(0,0,0,0.72)",
              animation: "settingsSlideIn 0.28s cubic-bezier(.22,.68,0,1.2) both",
            }}
          >
            <div style={{ fontFamily: t.fontDisplay, fontSize: 20, fontWeight: 800, color: t.text, marginBottom: 8 }}>
              Sign out?
            </div>
            <div style={{ fontFamily: t.fontBody, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, marginBottom: 18 }}>
              You will be returned to the login screen.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  logout();
                  setShowSignOutConfirm(false);
                  skipHistoryCleanupRef.current = true;
                  onNavigateAuthAction?.();
                  onCloseAction();
                }}
                style={{
                  flex: 1,
                  minWidth: 220,
                  padding: "14px 16px",
                  background: `${t.accent}18`,
                  border: `2px solid ${t.accent}`,
                  borderRadius: 12,
                  color: t.accent,
                  fontFamily: t.fontDisplay,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = "#000"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
              >
                SIGN OUT
              </button>
            </div>

            <button
              onClick={() => setShowSignOutConfirm(false)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: "10px 12px",
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                color: t.textMuted,
                fontFamily: t.fontMono,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

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

// ── Account security section ──
function AccountSecuritySection({ t, googleLinked, totpEnabled, onAction }: {
  t: (typeof THEMES)[ThemeId];
  googleLinked: boolean;
  totpEnabled: boolean;
  onAction: () => void;
}) {
  // Intent priority per product spec:
  //   1. No Google linked  → show "Connect Google" (regardless of 2FA state)
  //   2. Google linked, no 2FA → show "Enable 2FA"
  //   3. Both done → show a completion tick
  const mode: "connect_google" | "enable_2fa" | "complete" =
    !googleLinked ? "connect_google"
    : !totpEnabled ? "enable_2fa"
    : "complete";

  const copy = {
    connect_google: {
      title: "Connect Google",
      subtitle: "Link your Google account for faster, safer sign-in.",
      cta: "CONNECT GOOGLE",
      color: t.accent,
    },
    enable_2fa: {
      title: "Enable Two-Factor Auth",
      subtitle: "Google is linked — add 2FA to finish securing your login.",
      cta: "ENABLE 2FA",
      color: t.accent,
    },
    complete: {
      title: "Login Security Complete",
      subtitle: "Google is linked and 2FA is enabled — you're fully protected.",
      cta: "",
      color: "#4CAF50",
    },
  }[mode];

  return (
    <div>
      <div style={{ fontFamily: t.fontMono, fontSize: 13, fontWeight: 800, color: t.accent, letterSpacing: "0.16em", marginBottom: 18 }}>
        ACCOUNT SECURITY
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, background: t.bgCard, border: `1px solid ${t.border}`, padding: "16px 20px", borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 700, color: t.text }}>{copy.title}</span>
          {mode === "complete" && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22, borderRadius: "50%",
              background: "#4CAF50", color: "#fff",
              fontSize: 13, fontWeight: 900, lineHeight: 1,
            }} aria-label="Complete">✓</span>
          )}
        </div>
        <div style={{ fontFamily: t.fontBody, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>
          {copy.subtitle}
        </div>

        {/* Status chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
          <StatusChip t={t} ok={googleLinked} label="Google" />
          <StatusChip t={t} ok={totpEnabled} label="2FA" />
        </div>

        {mode !== "complete" && (
          <button
            onClick={onAction}
            style={{
              marginTop: 6,
              width: "100%", padding: "12px 16px",
              background: `${copy.color}18`,
              border: `1.5px solid ${copy.color}`,
              borderRadius: 10, color: copy.color,
              fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 800,
              letterSpacing: "0.08em", cursor: "pointer",
              transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = copy.color; e.currentTarget.style.color = "#000"; e.currentTarget.style.boxShadow = `0 0 14px ${copy.color}55`; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${copy.color}18`; e.currentTarget.style.color = copy.color; e.currentTarget.style.boxShadow = "none"; }}
          >
            {copy.cta}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusChip({ t, ok, label }: { t: (typeof THEMES)[ThemeId]; ok: boolean; label: string }) {
  const color = ok ? "#4CAF50" : t.textMuted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px",
      background: ok ? "#4CAF5014" : `${t.border}22`,
      border: `1px solid ${ok ? "#4CAF50" : t.border}`,
      borderRadius: 999,
      fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      color,
    }}>
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>{ok ? "✓" : "•"}</span>
      {label}
    </span>
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