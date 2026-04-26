"use client";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRank, NavRankBadge } from "./NavBar";
import { computeLevelProgress } from "@/lib/xpLevel";

interface MatchResultScreenProps {
  seriesWinner: string;
  format: string;
  p1: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    level_before: number;
    level_after: number;
    xp_before: number;
    xp_after: number;
    was_placement?: boolean;
  };
  p2: {
    name: string;
    elo_before: number;
    elo_after: number;
    rr_before: number;
    rr_after: number;
    level_before: number;
    level_after: number;
    xp_before: number;
    xp_after: number;
    was_placement?: boolean;
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
  onFindNewMatch?: () => void;
  onAnalyzeGame?: () => void;
  /**
   * Unranked / bot matches swap the ranked-tier emblem at the top of the
   * result banner for the viewer's own profile picture. The caller can
   * pass either a URL (served image) or an emoji / unicode glyph; if both
   * are null the section simply collapses so layout stays symmetric.
   */
  playerAvatarUrl?: string | null;
  playerAvatarEmoji?: string | null;
  /**
   * MYTHOS encounter wiring (boss-tier filler bot). When `isMythos` is
   * true the screen swaps the focal emblem for the MYTHOS PFP, prints
   * a win/loss flavor line, and — on the player's first-ever MYTHOS
   * defeat — surfaces the boss-tier reward banner (+100k XP + free
   * board skin). The bonus / first-defeat fields originate in the
   * `/api/profile/claim-unranked-bot-series` response.
   */
  isMythos?: boolean;
  mythosPfpUrl?: string | null;
  mythosFirstDefeat?: boolean;
  mythosXpBonus?: number;
}

export default function MatchResultScreen({
  seriesWinner,
  format,
  p1,
  p2,
  mySlot,
  t,
  onQuit,
  onFindNewMatch,
  onAnalyzeGame,
  playerAvatarUrl,
  playerAvatarEmoji,
  isMythos = false,
  mythosPfpUrl = null,
  mythosFirstDefeat = false,
  mythosXpBonus = 0,
}: MatchResultScreenProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [counter, setCounter] = useState(0);

  const isRanked = format === "ranked";
  const myData = mySlot === "P1" ? p1 : p2;
  const isWinner = seriesWinner === mySlot;
  const isDraw = seriesWinner === "DRAW";

  const eloDiff = myData.elo_after - myData.elo_before;
  const xpGained = myData.xp_after - myData.xp_before;
  
  const levelBefore = useMemo(() => computeLevelProgress(myData.level_before, myData.xp_before), [myData.level_before, myData.xp_before]);
  const levelAfter = useMemo(() => computeLevelProgress(myData.level_after, myData.xp_after), [myData.level_after, myData.xp_after]);
  const levelUp = levelAfter.level > levelBefore.level;
  const rankBefore = useMemo(() => getRank(myData.elo_before, myData.was_placement), [myData.elo_before, myData.was_placement]);
  const rankAfter = useMemo(() => getRank(myData.elo_after, myData.was_placement), [myData.elo_after, myData.was_placement]);
  const isDerank = !myData.was_placement && isRanked && rankAfter.name !== rankBefore.name && myData.elo_after < myData.elo_before;

  const p1c = "#3B82F6";
  const p2c = "#EF4444";
  // MYTHOS encounters override the standard P1/P2 winner palette with a
  // boss-tier reading:
  //   • Player BEAT MYTHOS  → violet "victory" wash (the player just
  //     toppled a boss, treat it as a celebratory moment).
  //   • MYTHOS BEAT player  → blood-red wash (MYTHOS taunt-tier loss).
  //   • DRAW                → keep the gold neutral tint.
  // The flavor quote below mirrors the same colour so the title + line
  // read as a single beat instead of two clashing palettes.
  const mythosVictoryViolet = "#C084FC";
  const mythosBossCrimson  = "#DC2626";
  const mythosWonMatch = !!(isMythos && !isDraw && seriesWinner !== mySlot);
  const playerBeatMythos = !!(isMythos && !isDraw && seriesWinner === mySlot);
  const winnerColor = isMythos
    ? (isDraw ? t.gold : (mythosWonMatch ? mythosBossCrimson : mythosVictoryViolet))
    : (seriesWinner === "P1" ? p1c : seriesWinner === "P2" ? p2c : t.gold);
  const winnerName = seriesWinner === "P1" ? p1.name : seriesWinner === "P2" ? p2.name : "DRAW";
  // Verbatim quotes — keep the user-supplied wording (including the
  // intentional "you better me" phrasing) so the in-game tone is exact.
  const mythosQuote = mythosWonMatch
    ? "until next time mortal..."
    : playerBeatMythos
      ? "you better me, you have grown."
      : null;
  const winnerEloAfter =
    seriesWinner === "P1" ? p1.elo_after : seriesWinner === "P2" ? p2.elo_after : 0;
  const winnerRank = useMemo(() => {
    const winnerData = seriesWinner === "P1" ? p1 : p2;
    return getRank(winnerEloAfter, winnerData?.was_placement);
  }, [winnerEloAfter, seriesWinner, p1, p2]);

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
          {isRanked ? (
            <NavRankBadge 
              rank={isDraw ? rankAfter : winnerRank} 
              size={120} 
              isPlacement={isDraw ? myData.was_placement : (seriesWinner === "P1" ? p1.was_placement : p2.was_placement)} 
            />
          ) : isMythos && mythosPfpUrl ? (
            /* MYTHOS focal emblem — boss-tier purple aura mirrors the
             * MatchPlayerCard / MatchSidebar treatment so the recap feels
             * continuous with the in-game presence. The pulsing halo is
             * defined inline (no global CSS file) so the screen renders
             * standalone outside its parent layout. */
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <style>{`@keyframes mythosResultHalo{0%,100%{box-shadow:0 0 28px rgba(192,132,252,0.55),0 0 56px rgba(76,29,149,0.45),inset 0 0 14px rgba(76,29,149,0.45)}50%{box-shadow:0 0 44px rgba(192,132,252,0.85),0 0 92px rgba(76,29,149,0.65),inset 0 0 18px rgba(76,29,149,0.6)}}`}</style>
              <div
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  pointerEvents: "none",
                  background: "radial-gradient(circle at 50% 50%, rgba(192,132,252,0.35), rgba(76,29,149,0.15) 60%, transparent 80%)",
                  filter: "blur(6px)",
                }}
              />
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "#0B0514",
                  border: "2px solid rgba(192,132,252,0.95)",
                  overflow: "hidden",
                  position: "relative",
                  animation: "mythosResultHalo 2.4s ease-in-out infinite",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mythosPfpUrl}
                  alt="MYTHOS"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>
          ) : (playerAvatarUrl || playerAvatarEmoji) ? (
            /* Unranked / bot series swap the tier emblem for the viewer's
             * own PFP so the banner still has a strong focal centrepiece.
             * The ring + drop-shadow mirror the NavRankBadge's presence
             * (120px wrapper, winner-tinted glow) so the transition feels
             * symmetric to a ranked-match result. */
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#0B0514",
                border: `2px solid ${winnerColor}AA`,
                boxShadow: `0 0 32px ${winnerColor}66, inset 0 0 12px ${winnerColor}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {playerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playerAvatarUrl}
                  alt="You"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 68,
                    lineHeight: 1,
                    filter: `drop-shadow(0 0 8px ${winnerColor}66)`,
                  }}
                >
                  {playerAvatarEmoji}
                </div>
              )}
            </div>
          ) : null}
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
            {format === "unranked" ? "UNRANKED" : isRanked ? "PROTOCOL" : "SERIES"}
            <br />
            <span style={{ fontSize: "0.8em" }}>{format === "unranked" ? "MATCH" : "WINNER"}</span>
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
          {isMythos && mythosQuote && (
            /* MYTHOS taunt / concession line — italic with the boss-tier
             * accent. Verbatim from the user spec; the wording itself is
             * the brand identity here so we don't normalise it. */
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.8 }}
              style={{
                fontFamily: t.fontDisplay,
                fontSize: "clamp(16px, 2.6vw, 28px)",
                fontStyle: "italic",
                fontWeight: 700,
                color: winnerColor,
                textShadow: `0 0 18px ${winnerColor}88`,
                letterSpacing: "0.04em",
                marginTop: 14,
                opacity: 0.96,
                maxWidth: "min(680px, 92vw)",
                marginInline: "auto",
                lineHeight: 1.4,
              }}
            >
              &ldquo;{mythosQuote}&rdquo;
            </motion.p>
          )}
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
             {isRanked ? (
               <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.textMuted, letterSpacing: "0.3em" }}>ELO ADJUSTMENT</div>
                  <div style={{ 
                    fontFamily: t.fontDisplay, 
                    fontSize: 80, 
                    fontWeight: 950, 
                    color: (myData.was_placement || eloDiff >= 0) ? t.accent : t.danger,
                    textShadow: `0 0 30px ${(myData.was_placement || eloDiff >= 0) ? t.accent : t.danger}44`
                  }}>
                    {myData.was_placement ? "+?" : (eloDiff >= 0 ? "+" : "")}{myData.was_placement ? "" : counter}
                  </div>
                  {myData.was_placement && (
                    <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textSecondary, letterSpacing: "0.08em", marginTop: -10 }}>
                      PLACEMENT MATCHES IN PROGRESS
                    </div>
                  )}
               </div>
             ) : (
               <div style={{ textAlign: "center" }}>
                 <div style={{ fontFamily: t.fontMono, fontSize: 14, color: t.accent, letterSpacing: "0.3em", fontWeight: 800 }}>UNRANKED MATCH</div>
               </div>
             )}
             
             <div style={{ width: 400, maxWidth: "80vw" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                   <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>LVL {levelAfter.level}</span>
                   <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textMuted }}>XP GAINED: {xpGained}</span>
                </div>
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 8, textAlign: "center" }}>
                  Rank Progress: {levelAfter.rem.toLocaleString()} / {levelAfter.nextXp.toLocaleString()}
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
                <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginTop: 8, textAlign: "right", opacity: 0 }}>
                  -
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
              maxWidth: "min(720px, 92vw)",
              padding: "0 16px",
            }}
          >
            {isMythos && mythosFirstDefeat && (
              /* First-time MYTHOS defeat reward callout — boss-tier
               * crimson + gold treatment so the +100k XP and free
               * board-skin grant feel ceremonial. The banner sits
               * above the QUIT / FIND NEW MATCH buttons so the player
               * actually reads it before navigating away. */
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.55, ease: "easeOut" }}
                style={{
                  width: "100%",
                  border: "2px solid #DC2626",
                  borderRadius: 16,
                  padding: "18px 22px",
                  background: "linear-gradient(135deg, rgba(127,29,29,0.55), rgba(76,29,149,0.42))",
                  boxShadow: "0 0 38px rgba(220,38,38,0.45), inset 0 0 22px rgba(192,132,252,0.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  textAlign: "left",
                }}
              >
                {mythosPfpUrl && (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid rgba(192,132,252,0.95)",
                      background: "#0B0514",
                      boxShadow: "0 0 18px rgba(192,132,252,0.55)",
                      flexShrink: 0,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mythosPfpUrl}
                      alt="MYTHOS"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      color: "#FCA5A5",
                      letterSpacing: "0.28em",
                      fontWeight: 800,
                      marginBottom: 4,
                    }}
                  >
                    BOSS-TIER REWARD · FIRST DEFEAT
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: "clamp(20px, 2.4vw, 26px)",
                      fontWeight: 900,
                      color: "#FFFFFF",
                      letterSpacing: "0.04em",
                      lineHeight: 1.15,
                      textShadow: "0 0 14px rgba(220,38,38,0.55)",
                    }}
                  >
                    MYTHOS FELLED
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: t.fontMono,
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        color: "#FCD34D",
                        background: "rgba(252,211,77,0.12)",
                        border: "1px solid rgba(252,211,77,0.55)",
                        borderRadius: 8,
                        padding: "5px 10px",
                      }}
                    >
                      +{(mythosXpBonus || 100000).toLocaleString()} XP
                    </span>
                    <span
                      style={{
                        fontFamily: t.fontMono,
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        color: "#C084FC",
                        background: "rgba(192,132,252,0.12)",
                        border: "1px solid rgba(192,132,252,0.55)",
                        borderRadius: 8,
                        padding: "5px 10px",
                      }}
                    >
                      FREE BOARD SKIN
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: t.fontMono,
                      fontSize: 12.5,
                      color: "rgba(255,255,255,0.78)",
                      lineHeight: 1.45,
                      letterSpacing: "0.02em",
                    }}
                  >
                    Claim your free board skin from the Store — board bundles section.
                  </div>
                </div>
              </motion.div>
            )}
            <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
              {onAnalyzeGame && (
                <motion.button
                  whileHover={{ scale: 1.05, background: `${t.accent}22` }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onAnalyzeGame}
                  style={{
                    padding: "20px 48px",
                    background: `${t.accent}18`,
                    border: `1px solid ${t.accent}`,
                    borderRadius: 12,
                    color: t.accent,
                    fontFamily: t.fontDisplay,
                    fontSize: 24,
                    fontWeight: 900,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    boxShadow: `0 0 20px ${t.accent}44`,
                  }}
                >
                  Analyze Game
                </motion.button>
              )}
               {onFindNewMatch && (
                 <motion.button
                   whileHover={{ scale: 1.05, background: `${t.accent}22` }}
                   whileTap={{ scale: 0.95 }}
                   onClick={onFindNewMatch}
                   style={{
                     padding: "20px 48px",
                     background: `${t.accent}18`,
                     border: `1px solid ${t.accent}`,
                     borderRadius: 12,
                     color: t.accent,
                     fontFamily: t.fontDisplay,
                     fontSize: 18,
                     fontWeight: 900,
                     letterSpacing: "0.2em",
                     cursor: "pointer",
                     transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                     boxShadow: `0 8px 32px ${t.accent}33`,
                   }}
                 >
                   FIND NEW MATCH
                 </motion.button>
               )}
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
                 QUIT TO HOME
               </motion.button>
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
