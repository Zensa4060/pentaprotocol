"use client";
import React from "react";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";

interface Props {
  themeId: ThemeId;
  onClose: () => void;
}

export default function SessionReplacedModal({ themeId, onClose }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(8px)",
      animation: "fadeIn 0.3s ease both",
    }}>
      <div style={{
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: ip ? 2 : 24,
        padding: "48px 40px",
        maxWidth: 480, width: "95vw",
        textAlign: "center",
        boxShadow: "0 50px 100px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.02)",
        animation: "scaleIn 0.4s cubic-bezier(.22,1,0.36,1) both",
      }}>
        {/* Icon / Visual */}
        <div style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${t.border}`,
          margin: "0 auto 32px",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative"
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <div style={{
            position: "absolute", top: -4, right: -4,
            width: 24, height: 24, borderRadius: "50%",
            background: "#FF4444", color: "#FFF",
            fontSize: 14, fontWeight: 900,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(255,68,68,0.5)"
          }}>!</div>
        </div>

        <h2 style={{
          fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900,
          color: t.text, marginBottom: 12, letterSpacing: "0.05em"
        }}>
          SESSION REPLACED
        </h2>

        <p style={{
          fontFamily: t.fontBody, fontSize: 15, color: t.textMuted,
          lineHeight: 1.6, marginBottom: 40,
        }}>
          Another device has logged into your account. To maintain security and data integrity, this session has been terminated.
        </p>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "16px",
            background: t.accent, border: "none",
            borderRadius: ip ? 2 : 12,
            color: "#000", fontFamily: t.fontDisplay,
            fontSize: 16, fontWeight: 800,
            cursor: "pointer", letterSpacing: "0.1em",
            transition: "all 0.2s ease",
            boxShadow: `0 12px 24px ${t.accent}33`
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
        >
          ACKNOWLEDGE & RE-LOGIN
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
}
