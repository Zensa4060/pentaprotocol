"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getRank, NavRankBadge } from "./NavBar";
import { computeLevelProgress } from "@/lib/xpLevel";

interface PlayerProgress {
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
}

interface GameWinScreenProps {
  seriesWinner: string;
  format: string;
  p1: PlayerProgress;
  p2: PlayerProgress;
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
    /** Optional light-theme flag — when true the screen's hardcoded
     *  near-black backdrop, dark card surface and white-tinted stat
     *  blocks flip to light-on-light equivalents so the multiplayer-
     *  match-complete celebration is readable in `classic_2`. */
    isLight?: boolean;
  };
  onQuit: () => void;
  onContinue?: () => void;
  /** Navigate to career with this match highlighted (multiplayer series end). */
  onGoToCareer?: () => void;
  onAnalyzeGame?: () => void;
}

export default function GameWinScreen({
  seriesWinner,
  format,
  p1,
  p2,
  mySlot,
  t,
  onQuit,
  onContinue,
  onGoToCareer,
  onAnalyzeGame,
}: GameWinScreenProps) {
  const [showActions, setShowActions] = useState(false);
  const [eloCounter, setEloCounter] = useState(0);
  const [xpCounter, setXpCounter] = useState(0);

  const isRanked = format === "ranked";
  const myData = mySlot === "P1" ? p1 : p2;
  const isWinner = seriesWinner === mySlot;
  const isDraw = seriesWinner === "DRAW";
  const eloDiff = myData.elo_after - myData.elo_before;
  const xpDiff = myData.xp_after - myData.xp_before;
  const before = useMemo(() => computeLevelProgress(myData.level_before, myData.xp_before), [myData.level_before, myData.xp_before]);
  const after = useMemo(() => computeLevelProgress(myData.level_after, myData.xp_after), [myData.level_after, myData.xp_after]);
  const accentColor = isDraw ? t.gold : isWinner ? t.accent : t.danger;
  const viewerRank = useMemo(() => {
    const after = myData.elo_after;
    const before = myData.elo_before;
    const elo = Number.isFinite(after) ? after : Number.isFinite(before) ? before : 0;
    return getRank(elo);
  }, [myData.elo_after, myData.elo_before]);
  const statusTitle = isDraw ? "MATCH DRAW" : isWinner ? "SERIES VICTORY" : "SERIES DEFEAT";
  const statusSubtitle = isDraw
    ? "The protocol ends in a deadlock."
    : isWinner
      ? "The protocol bends to your will."
      : "The protocol slips from your grasp.";

  useEffect(() => {
    const actionTimer = setTimeout(() => setShowActions(true), 2800);
    const duration = 1800;
    let startTime: number | null = null;
    const animate = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / duration, 1);
      setXpCounter(Math.round(progress * xpDiff));
      setEloCounter(Math.round(progress * eloDiff));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    return () => clearTimeout(actionTimer);
  }, [eloDiff, xpDiff]);

  // ── Light-theme surface tokens. The original screen baked the dark
  // backdrop, near-black card and white-on-dark stat tints directly into
  // styles. In light theme those land on top of the white shell as a
  // huge dark slab; flip the backdrop to a tinted-white wash, the card
  // to a white panel, and stat tints to subtle dark-on-light.
  const isLight = t.isLight === true;
  const backdrop = isLight
    ? (isWinner
        ? "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(232,236,244,1) 100%)"
        : "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(244,232,232,1) 100%)")
    : (isWinner
        ? "radial-gradient(circle at center, rgba(16,24,40,0.96) 0%, #02050a 100%)"
        : "radial-gradient(circle at center, rgba(28,10,14,0.96) 0%, #050203 100%)");
  const cardBg = isLight ? "rgba(255,255,255,0.92)" : "rgba(8,10,18,0.82)";
  const cardShadow = isLight
    ? `0 30px 80px rgba(0,0,0,0.18), 0 0 80px ${accentColor}22`
    : `0 30px 100px rgba(0,0,0,0.55), 0 0 80px ${accentColor}22`;
  const statBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.03)";
  const statBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)";
  const progressTrackBg = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const progressTrackBorder = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const quitBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";
  const quitBorder = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: backdrop,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: t.text,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at center, ${accentColor}22 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {[...Array(isWinner ? 24 : 14)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [-10, -120 - Math.random() * 80],
              x: [0, (Math.random() - 0.5) * 40],
              opacity: [0, 0.9, 0],
              scale: [0.4, 1, 0.7],
            }}
            transition={{
              duration: 2.4 + Math.random() * 2,
              delay: Math.random() * 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              bottom: "-10%",
              width: isWinner ? 6 : 4,
              height: isWinner ? 6 : 4,
              borderRadius: "50%",
              background: accentColor,
              filter: `blur(1px) drop-shadow(0 0 12px ${accentColor})`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ y: 26, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative",
          width: "min(920px, 100%)",
          borderRadius: 28,
          border: `1px solid ${accentColor}55`,
          background: cardBg,
          backdropFilter: "blur(18px)",
          boxShadow: cardShadow,
          padding: "40px 32px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10 }}>
          <motion.div
            animate={{
              scale: isWinner ? [1, 1.08, 1] : [1, 0.98, 1],
              filter: [`drop-shadow(0 0 18px ${accentColor}55)`, `drop-shadow(0 0 36px ${accentColor}AA)`, `drop-shadow(0 0 18px ${accentColor}55)`],
            }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {isRanked && (
              <NavRankBadge rank={viewerRank} size={104} isPlacement={myData.was_placement} />
            )}
          </motion.div>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: "0.3em", color: t.textMuted }}>
            MULTIPLAYER MATCH COMPLETE
          </div>
          <div style={{ fontFamily: t.fontDisplay, fontSize: "clamp(28px, 5vw, 58px)", fontWeight: 900, letterSpacing: "0.08em", color: accentColor }}>
            {statusTitle}
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: "clamp(12px, 2vw, 16px)", letterSpacing: "0.12em", color: t.textSecondary }}>
            {statusSubtitle}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <div style={{ padding: 18, borderRadius: 18, background: statBg, border: `1px solid ${statBorder}` }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.18em", color: t.textMuted, marginBottom: 10 }}>
              PLAYER STATUS
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 28, fontWeight: 900, color: accentColor, marginBottom: 4 }}>
              {myData.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textSecondary, letterSpacing: "0.08em" }}>
              {isDraw ? "DRAWN SERIES" : isWinner ? "WINNER" : "RUNNER-UP"}
            </div>
          </div>

          {isRanked && (
            <div style={{ padding: 18, borderRadius: 18, background: statBg, border: `1px solid ${statBorder}` }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.18em", color: t.textMuted, marginBottom: 10 }}>
                ELO CHANGE
              </div>
              <div style={{ fontFamily: t.fontDisplay, fontSize: 38, fontWeight: 900, color: (myData.was_placement || eloDiff >= 0) ? t.accent : t.danger }}>
                {myData.was_placement ? "+?" : (eloCounter >= 0 ? "+" : "")}
                {myData.was_placement ? "" : eloCounter}
              </div>
              <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary, letterSpacing: "0.05em" }}>
                {myData.was_placement ? "PLACEMENT IN PROGRESS" : `${myData.elo_before} -> ${myData.elo_after}`}
              </div>
            </div>
          )}

          <div style={{ padding: 18, borderRadius: 18, background: statBg, border: `1px solid ${statBorder}` }}>
            <div style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.18em", color: t.textMuted, marginBottom: 10 }}>
              XP GAIN
            </div>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 38, fontWeight: 900, color: t.gold }}>
              +{xpCounter}
            </div>
            <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>
              {myData.xp_before}{" -> "}{myData.xp_after}
            </div>
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 18, background: statBg, border: `1px solid ${statBorder}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 16 }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.18em", color: t.textMuted }}>
              LEVEL PROGRESS
            </span>
            <span style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary }}>
              LVL {before.level}{" -> "}LVL {after.level}
            </span>
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>
            Rank Progress: {after.rem.toLocaleString()} / {after.nextXp.toLocaleString()}
          </div>
          <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: progressTrackBg, border: `1px solid ${progressTrackBorder}` }}>
            <motion.div
              initial={{ width: `${before.progress}%` }}
              animate={{ width: `${after.progress}%` }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.35 }}
              style={{
                height: "100%",
                background: `linear-gradient(90deg, ${t.accent}, ${t.gold})`,
                boxShadow: `0 0 16px ${t.accent}66`,
              }}
            />
          </div>
          <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginTop: 8, textAlign: "right", letterSpacing: "0.2em", opacity: 0 }}>
            -
          </div>
        </div>

        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
                {onAnalyzeGame && (
                  <button
                    type="button"
                    onClick={onAnalyzeGame}
                    style={{
                      padding: "16px 28px",
                      borderRadius: 14,
                      border: `1px solid ${t.accent}99`,
                      background: `${t.accent}1c`,
                      color: t.accent,
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: "0.16em",
                      cursor: "pointer",
                    }}
                  >
                    ANALYZE GAME
                  </button>
                )}
                {onGoToCareer && (
                  <button
                    type="button"
                    onClick={onGoToCareer}
                    style={{
                      padding: "16px 28px",
                      borderRadius: 14,
                      border: `1px solid ${t.accent}99`,
                      background: `${t.accent}1c`,
                      color: t.accent,
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: "0.16em",
                      cursor: "pointer",
                    }}
                  >
                    GO TO CAREER
                  </button>
                )}
                {onContinue && (
                  <button
                    onClick={onContinue}
                    style={{
                      padding: "16px 28px",
                      borderRadius: 14,
                      border: `1px solid ${t.gold}99`,
                      background: `${t.gold}1c`,
                      color: t.gold,
                      fontFamily: t.fontDisplay,
                      fontSize: 16,
                      fontWeight: 900,
                      letterSpacing: "0.16em",
                      cursor: "pointer",
                    }}
                  >
                    CONTINUE
                  </button>
                )}
                <button
                  onClick={onQuit}
                  style={{
                    padding: "16px 28px",
                    borderRadius: 14,
                    border: `1px solid ${quitBorder}`,
                    background: quitBg,
                    color: t.text,
                    fontFamily: t.fontDisplay,
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    cursor: "pointer",
                  }}
                >
                  QUIT GAME
                </button>
              </div>
              {/* Tagline intentionally removed — space reserved below the button row. */}
              <div style={{ height: 22 }} aria-hidden />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
