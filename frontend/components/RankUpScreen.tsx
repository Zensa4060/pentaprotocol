"use client";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSound from "use-sound";
import { getRank, NavRankBadge } from "./NavBar";

type Props = {
  beforeElo: number;
  afterElo: number;
  onDone: () => void;
  t: {
    fontDisplay: string;
    fontMono: string;
    accent: string;
    gold: string;
    text: string;
    textMuted: string;
  };
};

// Background slash / streak lines — pure CSS rendered as absolutely-positioned divs
function SlashStreaks({ color }: { color: string }) {
  const streaks = useMemo(() => [
    { angle: -38, left: "12%",  top: "18%",  width: 220, delay: 0,    dur: 1.1 },
    { angle:  42, left: "68%",  top: "8%",   width: 180, delay: 0.15, dur: 1.3 },
    { angle: -55, left: "78%",  top: "55%",  width: 260, delay: 0.05, dur: 1.0 },
    { angle:  28, left: "5%",   top: "62%",  width: 200, delay: 0.25, dur: 1.4 },
    { angle: -20, left: "40%",  top: "82%",  width: 300, delay: 0.1,  dur: 1.2 },
    { angle:  60, left: "22%",  top: "4%",   width: 150, delay: 0.3,  dur: 0.9 },
    { angle: -45, left: "55%",  top: "72%",  width: 190, delay: 0.2,  dur: 1.1 },
    { angle:  15, left: "82%",  top: "38%",  width: 240, delay: 0.35, dur: 1.3 },
  ], []);

  return (
    <>
      {streaks.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: [0, 0.55, 0.2], scaleX: [0, 1, 1] }}
          transition={{ delay: s.delay, duration: s.dur, ease: "easeOut", times: [0, 0.4, 1] }}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.width,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${color}CC, transparent)`,
            transform: `rotate(${s.angle}deg)`,
            transformOrigin: "left center",
            pointerEvents: "none",
            zIndex: 2,
            borderRadius: 2,
          }}
        />
      ))}
    </>
  );
}

export default function RankUpScreen({ beforeElo, afterElo, onDone, t }: Props) {
  const [phase, setPhase] = useState<"charging" | "revealed">("charging");
  const [playWin] = useSound("/sounds/Pixel Win.wav", { volume: 0.5 });

  const beforeRank = useMemo(() => getRank(beforeElo), [beforeElo]);
  const afterRank  = useMemo(() => getRank(afterElo),  [afterElo]);
  const rankColor  = afterRank.color;

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase("revealed");
      playWin();
    }, 2000);
    return () => clearTimeout(timer);
  }, [playWin]);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 120000,
      background: "#020306",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      {/* Background radial glow — white → rank color */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={phase === "charging"
          ? {
              opacity: [0.2, 0.9],
              scale: [0.8, 1.2],
              background: [
                "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
                `radial-gradient(circle, ${rankColor}55 0%, transparent 70%)`,
              ],
            }
          : {
              opacity: 1,
              scale: 1.5,
              background: `radial-gradient(circle, ${rankColor}28 0%, transparent 72%)`,
            }
        }
        transition={{ duration: 2, ease: "linear" }}
        style={{ position: "absolute", inset: "-50%", zIndex: 1, pointerEvents: "none" }}
      />

      {/* Charging phase */}
      <AnimatePresence>
        {phase === "charging" && (
          <motion.div
            key="charging"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }}
            style={{ zIndex: 10, textAlign: "center" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{
                width: 120,
                height: 120,
                border: "4px solid rgba(255,255,255,0.08)",
                borderTop: `4px solid ${rankColor}`,
                borderRadius: "50%",
                margin: "0 auto 24px",
                boxShadow: `0 0 40px ${rankColor}44`,
              }}
            />
            <div style={{
              fontFamily: t.fontMono,
              fontSize: 18,
              color: "#fff",
              letterSpacing: "0.4em",
              textShadow: "0 0 10px rgba(255,255,255,0.5)",
            }}>
              RANK RECALCULATING...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed phase */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            style={{
              zIndex: 20,
              width: "min(760px, 92vw)",
              borderRadius: 22,
              border: `1px solid ${rankColor}88`,
              background: "rgba(8,8,16,0.96)",
              padding: "48px 32px",
              textAlign: "center",
              boxShadow: `0 0 80px ${rankColor}44`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Slash streaks behind content */}
            <SlashStreaks color={rankColor} />

            {/* Kicker */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                fontFamily: t.fontMono,
                fontSize: 14,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.25em",
                marginBottom: 8,
                position: "relative",
                zIndex: 5,
              }}
            >
              RANK ADVANCEMENT
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(44px, 7vw, 76px)",
                fontWeight: 950,
                color: rankColor,
                letterSpacing: "0.12em",
                margin: "0 0 36px",
                textShadow: `0 0 30px ${rankColor}88`,
                position: "relative",
                zIndex: 5,
              }}
            >
              RANK UP
            </motion.div>

            {/* Badge row */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 28,
              position: "relative",
              zIndex: 5,
            }}>
              {/* Old rank */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 18 }}
                style={{ textAlign: "center" }}
              >
                <div style={{
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.2em",
                  marginBottom: 12,
                }}>
                  FROM
                </div>
                <div style={{ opacity: 0.5 }}>
                  <NavRankBadge rank={beforeRank} size={88} />
                </div>
                <div style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.12em",
                  marginTop: 12,
                }}>
                  {beforeRank.name}
                </div>
              </motion.div>

              {/* Animated arrow */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
              >
                <motion.div
                  animate={{ x: [0, 8, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    fontFamily: t.fontDisplay,
                    fontSize: 44,
                    color: rankColor,
                    textShadow: `0 0 20px ${rankColor}`,
                    lineHeight: 1,
                  }}
                >
                  →
                </motion.div>
              </motion.div>

              {/* New rank */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 18 }}
                style={{ textAlign: "center" }}
              >
                <div style={{
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  color: `${rankColor}CC`,
                  letterSpacing: "0.2em",
                  marginBottom: 12,
                }}>
                  TO
                </div>
                <motion.div
                  initial={{ scale: 1.4, filter: `brightness(2) drop-shadow(0 0 20px ${rankColor})` }}
                  animate={{ scale: 1, filter: "brightness(1) drop-shadow(0 0 0px transparent)" }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <NavRankBadge rank={afterRank} size={116} />
                  </motion.div>
                </motion.div>
                <div style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 15,
                  fontWeight: 800,
                  color: rankColor,
                  letterSpacing: "0.12em",
                  marginTop: 12,
                  textShadow: `0 0 12px ${rankColor}88`,
                }}>
                  {afterRank.name}
                </div>
              </motion.div>
            </div>

            {/* Continue button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              type="button"
              onClick={onDone}
              style={{
                marginTop: 48,
                padding: "20px 60px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                fontFamily: t.fontDisplay,
                fontWeight: 900,
                letterSpacing: "0.2em",
                fontSize: 18,
                cursor: "pointer",
                transition: "all 0.2s",
                position: "relative",
                zIndex: 5,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = `${rankColor}88`;
                e.currentTarget.style.boxShadow = `0 0 30px ${rankColor}44`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ACKNOWLEDGE RANK
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
