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
            minHeight: "100vh",
            background: t.bg,
            paddingTop: 84, // Below navbar
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
        }}>
            <div style={{
                background: t.bgPanel,
                border: `${ip ? 3 : 1}px solid ${t.border}`,
                borderRadius: ip ? 2 : 24,
                padding: "60px 80px",
                textAlign: "center",
                boxShadow: `0 20px 80px rgba(0,0,0,0.5)`,
                maxWidth: 600,
                width: "90%",
            }}>
                {/* Animated icon / gem */}
                <div style={{
                    fontSize: 64,
                    marginBottom: 24,
                    animation: "float 4s ease-in-out infinite"
                }}>
                    
                </div>

                <h1 style={{
                    fontFamily: t.fontDisplay,
                    fontSize: ip ? 28 : 42,
                    fontWeight: 800,
                    color: t.accent,
                    marginBottom: 16,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    textShadow: `0 0 20px ${t.accent}44`,
                }}>
                    Battlepass
                </h1>

                <p style={{
                    fontFamily: t.fontBody,
                    fontSize: ip ? 14 : 18,
                    color: t.textMuted,
                    lineHeight: 1.6,
                    maxWidth: 400,
                    margin: "0 auto",
                }}>
                    A new way to earn exclusive cosmetics, ProtoCredits, and rare skins just by playing the game.
                </p>

                <div style={{
                    marginTop: 40,
                    padding: "16px 32px",
                    background: `${t.accent}15`,
                    border: `1px solid ${t.accent}44`,
                    borderRadius: 12,
                    display: "inline-block",
                }}>
                    <span style={{
                        fontFamily: t.fontMono,
                        fontSize: 16,
                        fontWeight: 700,
                        color: t.accent,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                    }}>
                        Coming Soon!
                    </span>
                </div>
            </div>

            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
        </div>
    );
}
