"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Piece } from "./GamePieces";

interface MatchCompleteOverlayProps {
  seriesWinner: string;
  format: string;
  p1: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
  };
  p2: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
  };
  mySlot: "P1" | "P2";
  t: {
    fontDisplay: string;
    fontMono: string;
    fontBody: string;
    accent: string;
    accentGlow: string;
    gold: string;
    danger: string;
    text: string;
    textSecondary: string;
    textMuted: string;
  };
  onClose: () => void;
}

export function MatchCompleteOverlay({
  seriesWinner,
  format,
  p1,
  p2,
  mySlot,
  t,
  onClose,
}: MatchCompleteOverlayProps) {
  const [showStats, setShowStats] = useState(false);
  const isWinner = seriesWinner === mySlot;
  const isDraw = seriesWinner === "DRAW";
  const p1c = "#3B82F6";
  const p2c = "#EF4444";
  const winnerColor = seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold;
  const winnerName = seriesWinner === "P1" ? p1.name : seriesWinner === "P2" ? p2.name : "DRAW";

  useEffect(() => {
    const timer = setTimeout(() => setShowStats(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  const myData = mySlot === "P1" ? p1 : p2;
  const oppData = mySlot === "P1" ? p2 : p1;
  const eloDiff = myData.elo_after - myData.elo_before;
  const rrDiff = myData.rr_after - myData.rr_before;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50000,
        background: "rgba(3, 7, 18, 0.98)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Background Particles/Glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${winnerColor}22 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <AnimatePresence>
        {!showStats ? (
          <motion.div
            key="celebration"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0, filter: "blur(20px)" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}
          >
            <motion.div
              animate={{
                rotateY: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ filter: `drop-shadow(0 0 30px ${winnerColor}88)` }}
            >
              <Piece
                symbol={seriesWinner === "P1" ? "◆" : seriesWinner === "P2" ? "◈" : "⚖"}
                color={winnerColor}
                size="120px"
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              style={{ textAlign: "center" }}
            >
              <h1
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: "clamp(36px, 8vw, 100px)",
                  fontWeight: 950,
                  color: winnerColor,
                  textShadow: `0 0 80px ${winnerColor}AA`,
                  margin: 0,
                  letterSpacing: "0.05em",
                  textAlign: "center",
                  lineHeight: 1.1,
                }}
              >
                {format === "ranked" ? "PROTOCOL WINNER" : "SERIES WINNER"}
                <br />
                <span style={{ fontSize: "0.6em", opacity: 0.9 }}>{winnerName.toUpperCase()}</span>
              </h1>
              {format === "ranked" && (
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: "clamp(24px, 4vw, 48px)",
                    fontWeight: 900,
                    color: eloDiff >= 0 ? t.accent : t.danger,
                    marginTop: 20,
                    textShadow: `0 0 20px ${eloDiff >= 0 ? t.accent : t.danger}66`,
                  }}
                >
                  {eloDiff >= 0 ? `+${eloDiff}` : eloDiff} ELO
                </div>
              )}
              <p
                style={{
                  fontFamily: t.fontMono,
                  fontSize: "clamp(12px, 1.5vw, 18px)",
                  color: t.textSecondary,
                  letterSpacing: "0.4em",
                  marginTop: 20,
                  textTransform: "uppercase",
                }}
              >
                {isDraw ? "POINTS LEVEL" : "BATTLE CONCLUDED"}
              </p>

            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="stats"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{
              width: "100%",
              maxWidth: 600,
              display: "flex",
              flexDirection: "column",
              gap: 32,
              padding: 40,
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: 32,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 12,
                  color: t.textMuted,
                  letterSpacing: "0.2em",
                  marginBottom: 8,
                }}
              >
                MATCH SUMMARY
              </div>
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 32,
                  fontWeight: 800,
                  color: winnerColor,
                }}
              >
                {format.toUpperCase()} LEGACY
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* ELO Changes */}
              <div
                style={{
                  padding: 24,
                  background: "rgba(0, 0, 0, 0.4)",
                  borderRadius: 20,
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 12 }}>ELO RATING</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: t.fontDisplay, fontSize: 36, fontWeight: 900, color: t.text }}>
                    {myData.elo_after}
                  </span>
                  <span
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 18,
                      fontWeight: 700,
                      color: eloDiff >= 0 ? t.accent : t.danger,
                    }}
                  >
                    {eloDiff >= 0 ? `+${eloDiff}` : eloDiff}
                  </span>
                </div>
              </div>

              {/* RR Gains */}
              <div
                style={{
                  padding: 24,
                  background: "rgba(0, 0, 0, 0.4)",
                  borderRadius: 20,
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                }}
              >
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 12 }}>RANK RATING</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ fontFamily: t.fontDisplay, fontSize: 36, fontWeight: 900, color: t.gold }}>
                    {myData.rr_after}
                  </span>
                  <span
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 18,
                      fontWeight: 700,
                      color: rrDiff >= 0 ? t.gold : t.danger,
                    }}
                  >
                    {rrDiff >= 0 ? `+${rrDiff}` : rrDiff}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                marginTop: 16,
                padding: "20px",
                background: `linear-gradient(135deg, ${winnerColor}22, rgba(255, 255, 255, 0.05))`,
                border: `1px solid ${winnerColor}44`,
                borderRadius: 16,
                color: t.text,
                fontFamily: t.fontDisplay,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.2em",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = winnerColor;
                e.currentTarget.style.color = "#000";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${winnerColor}22, rgba(255, 255, 255, 0.05))`;
                e.currentTarget.style.color = t.text;
              }}
            >
              CONTINUE
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </motion.div>
  );
}
