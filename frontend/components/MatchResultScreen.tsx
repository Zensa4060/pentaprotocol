"use client";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRank, NavRankBadge } from "./NavBar";
import { computeLevelStatsFromTotalXp, totalXpToReachLevel } from "@/lib/xpLevel";

interface MatchResultScreenProps {
  seriesWinner: string;
  format: string;
  p1: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    xp_before: number;
    xp_after: number;
  };
  p2: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    xp_before: number;
    xp_after: number;
  };
  mySlot: "P1" | "P2";
  t: {
    fontDisplay: string;
    fontMono: string;
    accent: string;
    accentGlow: string;
    gold: string;
    danger: string;
    text: string;
    textSecondary: string;
    textMuted: string;
  };
  onQuit: () => void;
}

export default function MatchResultScreen({
  seriesWinner,
  format,
  p1,
  p2,
  mySlot,
  t,
  onQuit,
}: MatchResultScreenProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [counter, setCounter] = useState(0);

  const isRanked = format === "ranked";
  const myData = mySlot === "P1" ? p1 : p2;
  const isWinner = seriesWinner === mySlot;
  const isDraw = seriesWinner === "DRAW";

  const eloDiff = myData.elo_after - myData.elo_before;
  const xpGained = myData.xp_after - myData.xp_before;
  
  const levelBefore = useMemo(() => computeLevelStatsFromTotalXp(myData.xp_before), [myData.xp_before]);
  const levelAfter = useMemo(() => computeLevelStatsFromTotalXp(myData.xp_after), [myData.xp_after]);
  const nextLevelTotalTarget = useMemo(() => totalXpToReachLevel(levelAfter.level + 1), [levelAfter.level]);
  const levelUp = levelAfter.level > levelBefore.level;
  const rankBefore = useMemo(() => getRank(myData.elo_before), [myData.elo_before]);
  const rankAfter = useMemo(() => getRank(myData.elo_after), [myData.elo_after]);
  const isDerank = isRanked && rankAfter.name !== rankBefore.name && myData.elo_after < myData.elo_before;

  const p1c = "#3B82F6";
  const p2c = "#EF4444";
  const winnerColor = seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold;
  const winnerName = seriesWinner === "P1" ? p1.name : seriesWinner === "P2" ? p2.name : "DRAW";
  const winnerEloAfter =
    seriesWinner === "P1" ? p1.elo_after : seriesWinner === "P2" ? p2.elo_after : 0;
  const winnerRank = useMemo(() => getRank(winnerEloAfter), [winnerEloAfter]);

  useEffect(() => {
    // Delay options for 3.5s to let the animation breathe
    const timer = setTimeout(() => setShowOptions(true), 3500);
    
    // Animate ELO counter if ranked
    if (isRanked) {
      const start = 0;
      const end = eloDiff;
      const duration = 2000;
      let startTime: number | null = null;
      
      const animate = (now: number) => {
        if (!startTime) startTime = now;
        const progress = Math.min((now - startTime) / duration, 1);
        setCounter(Math.floor(progress * (end - start) + start));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }

    return () => clearTimeout(timer);
  }, [isRanked, eloDiff]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1.2 } },
  };

  const titleVariants = {
    hidden: { y: 50, opacity: 0, scale: 0.9 },
    visible: { 
      y: 0, 
      opacity: 1, 
      scale: 1,
      transition: { 
        stiffness: 100, 
        damping: 10,
        delay: 0.5 
      } 
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "radial-gradient(circle at center, #0a0a0f 0%, #000000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: t.text,
        overflow: "hidden",
      }}
    >
      {/* Background Ambience */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${winnerColor}15 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      
      {/* Floating Particles Simulation (Visual only) */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [-20, -120],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              bottom: "-5%",
              width: 4,
              height: 4,
              background: winnerColor,
              borderRadius: "50%",
              filter: `blur(2px) drop-shadow(0 0 10px ${winnerColor})`,
            }}
          />
        ))}
      </div>

      {/* Central Iconic Showcase */}
      <motion.div
        variants={titleVariants}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          zIndex: 10,
        }}
      >
        <motion.div
          animate={{
            filter: [`drop-shadow(0 0 40px ${winnerColor}00)`, `drop-shadow(0 0 40px ${winnerColor}88)`, `drop-shadow(0 0 40px ${winnerColor}00)`],
          }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 160,
            minWidth: 160,
          }}
        >
          <NavRankBadge rank={isDraw ? rankAfter : winnerRank} size={120} />
        </motion.div>

        <div style={{ textAlign: "center" }}>
          <motion.h1
            style={{
              fontFamily: t.fontDisplay,
              fontSize: "clamp(48px, 10vw, 120px)",
              fontWeight: 950,
              letterSpacing: "0.08em",
              color: winnerColor,
              textShadow: `0 0 40px ${winnerColor}66`,
              margin: 0,
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            {isRanked ? "PROTOCOL" : "SERIES"}
            <br />
            <span style={{ fontSize: "0.8em" }}>WINNER</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            style={{
              fontFamily: t.fontMono,
              fontSize: "clamp(18px, 3vw, 40px)",
              color: t.textSecondary,
              letterSpacing: "0.2em",
              marginTop: 16,
              fontWeight: 800,
            }}
          >
            {winnerName.toUpperCase()}
          </motion.p>
        </div>

        {/* Dynamic Showcase (ELO/XP) */}
        {!showOptions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
             {isRanked && (
               <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, letterSpacing: "0.3em" }}>ELO ADJUSTMENT</div>
                  <div style={{ 
                    fontFamily: t.fontDisplay, 
                    fontSize: 80, 
                    fontWeight: 950, 
                    color: eloDiff >= 0 ? t.accent : t.danger,
                    textShadow: `0 0 30px ${eloDiff >= 0 ? t.accent : t.danger}44`
                  }}>
                    {eloDiff >= 0 ? "+" : ""}{counter}
                  </div>
               </div>
             )}
             
             <div style={{ width: 400, maxWidth: "80vw" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                   <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>LVL {levelAfter.level}</span>
                   <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>+{xpGained} XP</span>
                </div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 8, textAlign: "center" }}>
                  Total XP: {myData.xp_after.toLocaleString()} / {nextLevelTotalTarget.toLocaleString()}
                </div>
                <div style={{ 
                  height: 6, 
                  background: "rgba(255,255,255,0.05)", 
                  borderRadius: 10, 
                  overflow: "hidden", 
                  border: "1px solid rgba(255,255,255,0.05)" 
                }}>
                   <motion.div
                     initial={{ width: `${levelBefore.progress}%` }}
                     animate={{ width: `${levelAfter.progress}%` }}
                     transition={{ duration: 2, ease: "easeOut", delay: 1.8 }}
                     style={{ 
                       height: "100%", 
                       background: `linear-gradient(90deg, ${t.accent}, ${t.gold})`,
                       boxShadow: `0 0 15px ${t.accent}77`,
                     }}
                   />
                </div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginTop: 8, textAlign: "right" }}>
                  Level Progress: {levelAfter.rem.toLocaleString()} / {levelAfter.nextXp.toLocaleString()}
                </div>
                {levelUp && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 1, 0.7], scale: [0.9, 1.05, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatType: "mirror" }}
                    style={{
                      marginTop: 10,
                      textAlign: "center",
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      letterSpacing: "0.1em",
                      color: t.gold,
                      textShadow: `0 0 18px ${t.gold}`,
                    }}
                  >
                    LEVEL UP!
                  </motion.div>
                )}
             </div>
             {isDerank && (
               <div style={{ textAlign: "center" }}>
                 <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted, letterSpacing: "0.16em", marginBottom: 8 }}>
                   DERANK DETECTED
                 </div>
                 <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                   <NavRankBadge rank={rankBefore} size={48} />
                   <span style={{ color: t.danger, fontFamily: t.fontDisplay, fontSize: 24, fontWeight: 900 }}>→</span>
                   <NavRankBadge rank={rankAfter} size={48} />
                 </div>
               </div>
             )}
          </motion.div>
        )}
      </motion.div>

      {/* Post-Showcase Controls */}
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              position: "absolute",
              bottom: "10%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
               <motion.button
                 whileHover={{ scale: 1.05, background: "rgba(255,255,255,0.1)" }}
                 whileTap={{ scale: 0.95 }}
                 onClick={onQuit}
                 style={{
                   padding: "20px 48px",
                   background: "rgba(255,255,255,0.03)",
                   border: "1px solid rgba(255,255,255,0.1)",
                   borderRadius: 12,
                   color: t.text,
                   fontFamily: t.fontDisplay,
                   fontSize: 18,
                   fontWeight: 900,
                   letterSpacing: "0.2em",
                   cursor: "pointer",
                   transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                 }}
               >
                 QUIT BATTLE
               </motion.button>
            </div>
            
            <div style={{ 
               fontFamily: t.fontMono, 
               fontSize: 11, 
               color: t.textMuted, 
               letterSpacing: "0.1em",
               background: "rgba(255,255,255,0.03)",
               padding: "6px 16px",
               borderRadius: 20,
               border: "1px solid rgba(255,255,255,0.05)"
            }}>
               THE LEGACY HAS BEEN DOCUMENTED
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes shineSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </motion.div>
  );
}
