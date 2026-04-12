"use client";
import React from "react";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";

interface Props {
  themeId: ThemeId;
  onRejoin: () => void;
  onForfeit: () => void;
  isRanked?: boolean;
}

export default function ActiveMatchRejoinModal({ themeId, onRejoin, onForfeit, isRanked }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const [showConfirmForfeit, setShowConfirmForfeit] = React.useState(false);

  if (showConfirmForfeit) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.95)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(20px)",
        animation: "fadeIn 0.3s ease both",
      }}>
        <div style={{
          background: t.bgPanel,
          border: `2px solid ${t.danger}`,
          borderRadius: ip ? 2 : 24,
          padding: "48px 40px",
          maxWidth: 480, width: "95vw",
          textAlign: "center",
          boxShadow: `0 0 80px ${t.danger}33`,
          animation: "scaleIn 0.4s cubic-bezier(.22,1,0.36,1) both",
        }}>
          <h2 style={{
            fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900,
            color: t.danger, marginBottom: 16, letterSpacing: "0.08em"
          }}>
            ARE YOU SURE?
          </h2>

          <p style={{
            fontFamily: t.fontBody, fontSize: 16, color: t.text,
            lineHeight: 1.6, marginBottom: 32,
          }}>
            {isRanked 
              ? "Forfeiting this RANKED match will result in an immediate ELO penalty. This action cannot be undone."
              : "Giving up now will record this as a loss in your match history."}
          </p>

          <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
            <button
              onClick={onForfeit}
              style={{
                width: "100%", padding: "18px",
                background: t.danger, border: "none",
                borderRadius: ip ? 2 : 14,
                color: "#fff", fontFamily: t.fontDisplay,
                fontSize: 16, fontWeight: 900,
                cursor: "pointer", letterSpacing: "0.1em",
              }}
            >
              CONFIRM FORFEIT
            </button>
            <button
              onClick={() => setShowConfirmForfeit(false)}
              style={{
                width: "100%", padding: "14px",
                background: "transparent", border: `1px solid ${t.border}`,
                borderRadius: ip ? 2 : 14,
                color: t.text, fontFamily: t.fontDisplay,
                fontSize: 14, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              NEVERMIND
            </button>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(12px)",
      animation: "fadeIn 0.3s ease both",
    }}>
      <div style={{
        background: t.bgPanel,
        border: `2px solid ${t.accent}`,
        borderRadius: ip ? 2 : 24,
        padding: "48px 40px",
        maxWidth: 480, width: "95vw",
        textAlign: "center",
        boxShadow: `0 0 60px ${t.accent}22, 0 40px 100px rgba(0,0,0,0.5)`,
        animation: "scaleIn 0.4s cubic-bezier(.22,1,0.36,1) both",
      }}>
        {/* Pulse Visual */}
        <div style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: `${t.accent}11`,
          border: `1px solid ${t.accent}`,
          margin: "0 auto 32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative"
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <div style={{
            position: "absolute", inset: -8,
            borderRadius: "50%",
            border: `2px solid ${t.accent}44`,
            animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite"
          }} />
        </div>

        <h2 style={{
          fontFamily: t.fontDisplay, fontSize: 26, fontWeight: 900,
          color: t.text, marginBottom: 12, letterSpacing: "0.08em"
        }}>
          MATCH DETECTED
        </h2>

        <p style={{
          fontFamily: t.fontBody, fontSize: 16, color: t.textMuted,
          lineHeight: 1.6, marginBottom: 40,
        }}>
          An active competition was found associated with your account. Resume the battle immediately!
        </p>

        <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
          <button
            onClick={onRejoin}
            style={{
              width: "100%", padding: "18px",
              background: t.accent, border: "none",
              borderRadius: ip ? 2 : 14,
              color: "#000", fontFamily: t.fontDisplay,
              fontSize: 17, fontWeight: 900,
              cursor: "pointer", letterSpacing: "0.15em",
              transition: "all 0.2s ease",
              boxShadow: `0 14px 28px ${t.accent}44`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = `0 18px 36px ${t.accent}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 14px 28px ${t.accent}44`;
            }}
          >
            REJOIN BATTLE
          </button>
          
          <button
            onClick={() => setShowConfirmForfeit(true)}
            style={{
              width: "100%", padding: "14px",
              background: "transparent", border: `1px solid ${t.border}`,
              borderRadius: ip ? 2 : 14,
              color: t.textMuted, fontFamily: t.fontDisplay,
              fontSize: 14, fontWeight: 700,
              cursor: "pointer", opacity: 0.6,
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
          >
            FORFEIT & GO HOME
          </button>
        </div>
      </div>


      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
