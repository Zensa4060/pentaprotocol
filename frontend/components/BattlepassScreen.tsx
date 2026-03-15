"use client";
import React from "react";
import { THEMES } from "@/lib/themes";
import type { ThemeId } from "@/lib/themes";

interface Props {
  themeId: ThemeId;
}

export default function BattlepassScreen({ themeId }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: t.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      zIndex: 1,
      overflow: "hidden"
    }}>
      {/* Background Glows */}
      <div style={{
        position: "absolute",
        width: "60vw",
        height: "60vw",
        background: `radial-gradient(circle, ${t.accent}15 0%, transparent 70%)`,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      <div style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        maxWidth: 800
      }}>
        {/* Shield / Emblem SVG */}
        <div style={{
          marginBottom: 40,
          animation: "float 6s ease-in-out infinite",
          filter: `drop-shadow(0 0 30px ${t.accent}44)`
        }}>
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>

        <h1 style={{
          fontFamily: t.fontDisplay,
          fontSize: "clamp(48px, 8vw, 96px)",
          fontWeight: 900,
          color: t.text,
          margin: 0,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          lineHeight: 1
        }}>
          Battle<span style={{ color: t.accent }}>Pass</span>
        </h1>

        <div style={{
          height: 4,
          width: 200,
          background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`,
          margin: "24px 0",
          borderRadius: 2
        }} />

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          alignItems: "center"
        }}>
          <div style={{
            fontFamily: t.fontDisplay,
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 800,
            color: t.accent,
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            animation: "pulse 3s ease-in-out infinite"
          }}>
            Coming Soon
          </div>
          
          <p style={{
            fontFamily: t.fontBody,
            fontSize: "clamp(14px, 1.8vw, 20px)",
            color: t.textSecondary,
            maxWidth: 500,
            margin: 0,
            lineHeight: 1.6,
            letterSpacing: "0.05em"
          }}>
            Season 1: Protocol Genesis. Unlock exclusive skins, ProtoCredits, and limited edition borders.
          </p>
        </div>

        {/* Decorative Grid Progress Bar */}
        <div style={{
          marginTop: 60,
          width: "300px",
          height: "8px",
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: 4,
          overflow: "hidden",
          position: "relative"
        }}>
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: "35%",
            background: `linear-gradient(90deg, ${t.accent}44, ${t.accent})`,
            boxShadow: `0 0 15px ${t.accent}aa`,
            animation: "loading 4s ease-in-out infinite alternate"
          }} />
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes loading {
          0% { left: -10%; }
          100% { left: 75%; }
        }
      `}</style>
    </div>
  );
}
