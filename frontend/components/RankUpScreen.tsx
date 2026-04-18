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

/**
 * Convert a #RRGGBB hex to a raw "r,g,b" triple suitable for rgba() interpolation.
 * Falls back to pure blood-red if the string isn't a valid hex color.
 */
function hexToRgbTriple(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "255,42,42";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
}

// Faint geometric background decorations (stars / splinters) — absolutely positioned.
// Purely aesthetic, matches the promoted-screen reference style.
function GeoSplinters({ color }: { color: string }) {
  const shapes = useMemo(
    () => [
      { left: "6%",  top: "12%", size: 42, angle: 18,  delay: 0.0 },
      { left: "88%", top: "8%",  size: 28, angle: -22, delay: 0.25 },
      { left: "12%", top: "78%", size: 38, angle: 35,  delay: 0.15 },
      { left: "82%", top: "68%", size: 34, angle: -12, delay: 0.3 },
      { left: "48%", top: "6%",  size: 22, angle: 10,  delay: 0.5 },
      { left: "72%", top: "42%", size: 26, angle: 44,  delay: 0.4 },
      { left: "22%", top: "48%", size: 30, angle: -30, delay: 0.2 },
      { left: "92%", top: "86%", size: 20, angle: 20,  delay: 0.55 },
    ],
    [],
  );
  return (
    <>
      {shapes.map((s, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.4, rotate: s.angle - 20 }}
          animate={{ opacity: [0, 0.22, 0.1], scale: [0.4, 1, 0.95], rotate: s.angle }}
          transition={{ delay: s.delay, duration: 1.4, ease: "easeOut", times: [0, 0.55, 1] }}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <svg viewBox="0 0 24 24" width={s.size} height={s.size}>
            <path
              d="M12 2 L13.2 10.8 L22 12 L13.2 13.2 L12 22 L10.8 13.2 L2 12 L10.8 10.8 Z"
              fill={color}
              opacity={0.9}
            />
          </svg>
        </motion.div>
      ))}
    </>
  );
}

export default function RankUpScreen({ beforeElo, afterElo, onDone, t }: Props) {
  const [phase, setPhase] = useState<"charging" | "revealed">("charging");
  const [canDismiss, setCanDismiss] = useState(false);
  const [playWin] = useSound("/sounds/Pixel Win.wav", { volume: 0.5 });

  const beforeRank = useMemo(() => getRank(beforeElo), [beforeElo]);
  const afterRank  = useMemo(() => getRank(afterElo),  [afterElo]);
  const rankColor  = afterRank.color;
  const rankRgb    = useMemo(() => hexToRgbTriple(rankColor), [rankColor]);
  // Blood-red constant (from XpLevelUpScreen) blended with the destination rank color.
  const bloodRgb   = "180,20,22";

  useEffect(() => {
    const revealTimer = setTimeout(() => {
      setPhase("revealed");
      playWin();
    }, 2000);
    return () => clearTimeout(revealTimer);
  }, [playWin]);

  useEffect(() => {
    if (phase !== "revealed") {
      setCanDismiss(false);
      return;
    }
    // Non-skippable for ~3.2s after reveal — the button fades in only after.
    const t = setTimeout(() => setCanDismiss(true), 3200);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        // Base tint: blood-red floor. Layers on top animate the rank-color blend.
        background: `rgb(${bloodRgb})`,
      }}
    >
      {/* Layer 1 — full-viewport pulsing blood red. Never stops. */}
      <motion.div
        animate={{
          background: [
            `radial-gradient(circle at 50% 50%, rgba(${bloodRgb},1) 0%, rgba(${bloodRgb},0.75) 55%, rgba(30,0,0,0.95) 100%)`,
            `radial-gradient(circle at 50% 50%, rgba(${bloodRgb},0.9) 0%, rgba(${bloodRgb},0.65) 50%, rgba(20,0,0,1) 100%)`,
            `radial-gradient(circle at 50% 50%, rgba(${bloodRgb},1) 0%, rgba(${bloodRgb},0.75) 55%, rgba(30,0,0,0.95) 100%)`,
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
      />

      {/* Layer 2 — rank-color wash that slowly breathes over the red. Blends into the base. */}
      <motion.div
        animate={{
          opacity: [0.22, 0.55, 0.22],
          background: [
            `radial-gradient(circle at 30% 40%, rgba(${rankRgb},0.55) 0%, transparent 60%)`,
            `radial-gradient(circle at 70% 60%, rgba(${rankRgb},0.55) 0%, transparent 60%)`,
            `radial-gradient(circle at 30% 40%, rgba(${rankRgb},0.55) 0%, transparent 60%)`,
          ],
        }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Layer 3 — vignette + scan tint to match the reference promoted screen. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Geometric splinters (decorative). */}
      <GeoSplinters color={`rgba(${rankRgb},0.9)`} />

      {/* Charging phase — spinner + "RANK RECALCULATING" */}
      <AnimatePresence>
        {phase === "charging" && (
          <motion.div
            key="charging"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.5, filter: "blur(20px)" }}
            style={{ zIndex: 20, textAlign: "center" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{
                width: 120,
                height: 120,
                border: "4px solid rgba(255,255,255,0.12)",
                borderTop: `4px solid rgba(${rankRgb},1)`,
                borderRadius: "50%",
                margin: "0 auto 24px",
                boxShadow: `0 0 50px rgba(${rankRgb},0.55), 0 0 120px rgba(${bloodRgb},0.55)`,
              }}
            />
            <div
              style={{
                fontFamily: t.fontMono,
                fontSize: 18,
                color: "#fff",
                letterSpacing: "0.4em",
                textShadow: "0 0 14px rgba(255,255,255,0.55)",
              }}
            >
              RANK RECALCULATING...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed phase — promoted-screen style */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            style={{
              zIndex: 30,
              width: "min(780px, 94vw)",
              textAlign: "center",
              position: "relative",
            }}
          >
            {/* Kicker — CONGRATULATIONS */}
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              style={{
                fontFamily: t.fontDisplay,
                fontWeight: 900,
                fontSize: "clamp(18px, 2.4vw, 26px)",
                color: "#fff",
                letterSpacing: "0.42em",
                marginBottom: 6,
                textShadow: "0 0 18px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.55)",
              }}
            >
              CONGRATULATIONS
            </motion.div>

            {/* Subheading — YOU HAVE BEEN PROMOTED! */}
            <motion.div
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              style={{
                fontFamily: t.fontMono,
                fontSize: "clamp(12px, 1.6vw, 14px)",
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "0.3em",
                marginBottom: 44,
                textShadow: "0 2px 8px rgba(0,0,0,0.55)",
              }}
            >
              YOU HAVE BEEN PROMOTED!
            </motion.div>

            {/* Central badge — the new rank, glowing */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, filter: `drop-shadow(0 0 40px rgba(${rankRgb},1))` }}
              animate={{ scale: 1, opacity: 1, filter: `drop-shadow(0 0 28px rgba(${rankRgb},0.9))` }}
              transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 20 }}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 28,
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  padding: 28,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, rgba(${rankRgb},0.25) 0%, transparent 70%)`,
                }}
              >
                <NavRankBadge rank={afterRank} size={160} />
              </motion.div>
            </motion.div>

            {/* Big rank name */}
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              style={{
                fontFamily: t.fontDisplay,
                fontWeight: 950,
                fontSize: "clamp(44px, 7vw, 78px)",
                color: rankColor,
                letterSpacing: "0.12em",
                lineHeight: 1,
                textShadow: `0 0 24px rgba(${rankRgb},0.95), 0 0 60px rgba(${rankRgb},0.6), 0 4px 16px rgba(0,0,0,0.7)`,
                marginBottom: 10,
              }}
            >
              {afterRank.name}
            </motion.div>

            {/* Sub-row — COMPETITIVE RANK + from → elo transition */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              style={{
                fontFamily: t.fontMono,
                fontSize: "clamp(12px, 1.4vw, 14px)",
                color: "rgba(255,255,255,0.78)",
                letterSpacing: "0.4em",
                marginBottom: 24,
                textShadow: "0 2px 8px rgba(0,0,0,0.55)",
              }}
            >
              COMPETITIVE RANK · {beforeRank.name} → {afterRank.name}
            </motion.div>

            {/* Acknowledge button — appears only once the reveal is non-skippable period ends */}
            <motion.button
              initial={false}
              animate={canDismiss ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.4 }}
              type="button"
              onClick={() => { if (canDismiss) onDone(); }}
              disabled={!canDismiss}
              style={{
                marginTop: 16,
                padding: "18px 56px",
                borderRadius: 14,
                border: `1px solid rgba(255,255,255,${canDismiss ? 0.32 : 0.12})`,
                background: canDismiss ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                color: "#fff",
                fontFamily: t.fontDisplay,
                fontWeight: 900,
                letterSpacing: "0.2em",
                fontSize: 18,
                cursor: canDismiss ? "pointer" : "default",
                transition: "all 0.2s",
                boxShadow: canDismiss ? `0 0 28px rgba(${rankRgb},0.45), 0 8px 32px rgba(0,0,0,0.4)` : "none",
                pointerEvents: canDismiss ? "auto" : "none",
              }}
              onMouseEnter={(e) => {
                if (!canDismiss) return;
                e.currentTarget.style.background = "rgba(255,255,255,0.14)";
                e.currentTarget.style.borderColor = `rgba(${rankRgb},0.9)`;
                e.currentTarget.style.boxShadow = `0 0 40px rgba(${rankRgb},0.7)`;
              }}
              onMouseLeave={(e) => {
                if (!canDismiss) return;
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
                e.currentTarget.style.boxShadow = `0 0 28px rgba(${rankRgb},0.45), 0 8px 32px rgba(0,0,0,0.4)`;
              }}
            >
              CONTINUE
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
