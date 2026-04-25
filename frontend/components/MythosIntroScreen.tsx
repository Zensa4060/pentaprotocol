"use client";

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * Pre-match-found intro screen that fires only when the unranked filler
 * timer rolls a MYTHOS encounter. Visually mirrors the charging phase of
 * `XpLevelUpScreen` (radial blood-red glow, rotating spinner, dense
 * letter-spacing on the headline) so MYTHOS feels like a level-up-grade
 * "ascension" moment rather than a normal queue pop. Adds a violet outer
 * halo on top of the red core to brand it as the boss-tier opponent.
 *
 * The screen is purely cosmetic: it owns its own auto-complete timer and
 * calls `onDoneAction` once the dwell time has elapsed. The caller (AppShell)
 * is responsible for swapping in the `LobbyScreen` matchup overlay
 * immediately afterwards so the transition lands on the bespoke
 * "MYTHOS · THE GAME BENEATH THE GAME" VS card without a visible gap.
 *
 * Implementation notes:
 *   - We deliberately do NOT mount our own audio — the parent already
 *     plays `sfx.matchFound()` on the queue→matchup transition; layering
 *     a second cue would muddy the moment.
 *   - The dwell time (default 3000 ms) is a touch shorter than the VS-card
 *     hold (5000 ms in `armUnrankedBotMatchSequence`), so the user sees
 *     INTRO → MATCHFOUND → /rulesshow without the total flow ballooning
 *     past ~8 s of pre-game animation.
 */
export default function MythosIntroScreen({
  onDoneAction,
  durationMs = 3000,
  fontDisplay = "var(--font-display)",
  fontMono = "var(--font-mono)",
}: {
  onDoneAction: () => void;
  durationMs?: number;
  /** Optional theme overrides — falls back to the global CSS vars so the
   *  component renders correctly even if mounted before the theme provider
   *  has hydrated. */
  fontDisplay?: string;
  fontMono?: string;
}) {
  // Stash `onDoneAction` in a ref so the auto-complete timer below
  // doesn't restart when the parent re-renders with a fresh closure.
  const onDoneRef = useRef(onDoneAction);
  useEffect(() => {
    onDoneRef.current = onDoneAction;
  }, [onDoneAction]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      onDoneRef.current?.();
    }, Math.max(800, durationMs));
    return () => window.clearTimeout(id);
  }, [durationMs]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120000,
        background: "#020306",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Outer violet halo — keeps a faint MYTHOS-purple wash on the
          edges of the screen so the framing reads as "MYTHOS arrival"
          even before the headline text resolves. Sits below the red
          core glow so the centre still feels blood-red on landing. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 0.6, scale: 1.05 }}
        transition={{ duration: 1.6, ease: "linear" }}
        style={{
          position: "absolute",
          inset: "-20%",
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(147,51,234,0.28) 0%, rgba(147,51,234,0.10) 35%, transparent 65%)",
        }}
      />

      {/* Core red→white→red flare — adapted directly from
          XpLevelUpScreen's charging phase so MYTHOS borrows the same
          "blood-red ascension" beats the user already associates with
          a level-up. Animated background-position keeps the gradient
          breathing for the full intro. */}
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.85,
          background:
            "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
        }}
        animate={{
          opacity: [0.25, 0.85, 0.7],
          scale: [0.85, 1.15, 1.25],
          background: [
            "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(255,0,0,0.45) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(190,30,40,0.55) 0%, transparent 75%)",
          ],
        }}
        transition={{ duration: durationMs / 1000, ease: "linear" }}
        style={{
          position: "absolute",
          inset: "-50%",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45 }}
        style={{ position: "relative", zIndex: 10, textAlign: "center" }}
      >
        {/* Spinner — same dimensions as the level-up charging spinner so
            the silhouette matches. Border is a faded violet on the ring
            and a bright white-violet "head" so MYTHOS reads as the
            boss-tier signature without losing the level-up cue. */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          style={{
            width: 132,
            height: 132,
            border: "4px solid rgba(192,132,252,0.18)",
            borderTop: "4px solid #F5F3FF",
            borderRadius: "50%",
            margin: "0 auto 28px",
            boxShadow:
              "0 0 32px rgba(192,132,252,0.55), 0 0 64px rgba(147,51,234,0.35)",
          }}
        />
        <div
          style={{
            fontFamily: fontMono,
            fontSize: 13,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.32em",
            marginBottom: 10,
          }}
        >
          UNRATED · BOSS PROTOCOL
        </div>
        <div
          style={{
            fontFamily: fontDisplay,
            fontSize: "clamp(22px, 4.5vw, 36px)",
            fontWeight: 950,
            color: "#fff",
            letterSpacing: "0.36em",
            textShadow:
              "0 0 16px rgba(255,255,255,0.45), 0 0 36px rgba(192,132,252,0.55)",
          }}
        >
          PREPARING MYTHOS...
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: fontMono,
            fontSize: 12,
            color: "rgba(216,180,254,0.78)",
            letterSpacing: "0.18em",
          }}
        >
          THE GAME BENEATH THE GAME
        </div>
      </motion.div>
    </div>
  );
}
