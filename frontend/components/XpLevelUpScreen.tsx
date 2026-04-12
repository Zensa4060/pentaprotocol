"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSound from "use-sound";

type Props = {
  fromLevel: number;
  toLevel: number;
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

export default function XpLevelUpScreen({ fromLevel, toLevel, onDone, t }: Props) {
  const [phase, setPhase] = useState<"charging" | "revealed">("charging");
  const [playWin] = useSound("/sounds/Pixel Win.wav", { volume: 0.5 });

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
      overflow: "hidden"
    }}>
      {/* Background Glow - White to Red (0-2s) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }}
        animate={phase === "charging" 
          ? { 
              opacity: [0.2, 0.8], 
              scale: [0.8, 1.2],
              background: [
                "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                "radial-gradient(circle, rgba(255,0,0,0.4) 0%, transparent 70%)"
              ]
            } 
          : { 
              opacity: 1, 
              scale: 1.5,
              background: "radial-gradient(circle, rgba(255,0,0,0.2) 0%, transparent 75%)"
            }
        }
        transition={{ duration: 2, ease: "linear" }}
        style={{
          position: "absolute",
          inset: "-50%",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />

      {/* Charging Phase Content */}
      <AnimatePresence>
        {phase === "charging" && (
          <motion.div
            key="charging-content"
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
                border: "4px solid rgba(255,255,255,0.1)",
                borderTop: "4px solid #fff",
                borderRadius: "50%",
                margin: "0 auto 24px",
                boxShadow: "0 0 40px rgba(255,255,255,0.2)"
              }}
            />
            <div style={{ 
              fontFamily: t.fontMono, 
              fontSize: 18, 
              color: "#fff", 
              letterSpacing: "0.4em",
              textShadow: "0 0 10px rgba(255,255,255,0.5)"
            }}>
              INITIALIZING EVOLUTION...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed Phase Content */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            key="revealed-content"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            style={{ 
              zIndex: 20, 
              width: "min(760px, 92vw)", 
              borderRadius: 22, 
              border: `1px solid rgba(255,0,0,0.5)`, 
              background: "rgba(10,2,2,0.95)", 
              padding: "48px 32px", 
              textAlign: "center", 
              boxShadow: `0 0 80px rgba(255,0,0,0.3)` 
            }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ 
                fontFamily: t.fontMono, 
                fontSize: 14, 
                color: "rgba(255,255,255,0.6)", 
                letterSpacing: "0.25em",
                marginBottom: 8
              }}
            >
              LEVEL SYNCHRONIZED
            </motion.div>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
              style={{ 
                fontFamily: t.fontDisplay, 
                fontSize: "clamp(48px, 8vw, 82px)", 
                fontWeight: 950, 
                color: "#ff2a2a", 
                letterSpacing: "0.15em", 
                margin: "0 0 32px",
                textShadow: "0 0 30px rgba(255,0,0,0.6)"
              }}
            >
              LEVEL UP
            </motion.div>

            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              gap: 32, 
              fontFamily: t.fontDisplay, 
              fontWeight: 950, 
              color: "#fff" 
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>FROM</div>
                <div style={{ fontSize: 56, color: "rgba(255,255,255,0.3)" }}>{fromLevel}</div>
              </div>
              
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
                style={{ fontSize: 42, color: "rgba(255,0,0,0.8)" }}
              >
                →
              </motion.div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "rgba(255,0,0,0.6)", marginBottom: 4 }}>TO</div>
                <motion.div 
                  initial={{ scale: 1.5, filter: "brightness(2)" }}
                  animate={{ scale: 1, filter: "brightness(1)" }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  style={{ 
                    fontSize: 84, 
                    color: "#fff",
                    textShadow: "0 0 40px rgba(255,0,0,0.8)" 
                  }}
                >
                  {toLevel}
                </motion.div>
              </div>
            </div>

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
                border: `1px solid rgba(255,255,255,0.2)`, 
                background: "rgba(255,255,255,0.05)", 
                color: "#fff", 
                fontFamily: t.fontDisplay, 
                fontWeight: 900, 
                letterSpacing: "0.2em", 
                fontSize: 18,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,0,0,0.5)";
                e.currentTarget.style.boxShadow = "0 0 30px rgba(255,0,0,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ACKNOWLEDGE PROGRESS
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
