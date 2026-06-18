/**
 * Syros boss intro overlay — mobile parity with web ``SyrosIntroScreen``.
 *
 * Full-screen dark overlay with a violet halo, spinning ring, and
 * "PREPARING SYROS..." headline. Auto-completes after ``durationMs``
 * (default 3000 ms) and calls ``onDone``.  Visually mirrors the web's
 * blood-red-to-violet ascension glow so the mobile Syros encounter
 * feels identical to the unranked queue reveal.
 *
 * Uses ``react-native-reanimated`` for the spinner rotation and
 * ``Animated`` (RN core) for the fade-in/pulse since the effects are
 * lightweight enough not to need worklet-level perf.
 */

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SYROS_PURPLE = "#9333EA";
const SYROS_LIGHT = "#C084FC";
const SYROS_LIGHTEST = "#F5F3FF";

interface SyrosIntroOverlayProps {
  visible: boolean;
  /** Called once the intro timer finishes. */
  onDone: () => void;
  /** Hold time in ms — default 3000. */
  durationMs?: number;
}

export function SyrosIntroOverlay({
  visible,
  onDone,
  durationMs = 3000,
}: SyrosIntroOverlayProps) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // ── Auto-complete timer ─────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => onDoneRef.current?.(), Math.max(800, durationMs));
    return () => clearTimeout(id);
  }, [visible, durationMs]);

  // ── Animated values (core RN Animated) ──────────────────────────
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.85)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fadeIn.setValue(0);
      glowScale.setValue(0.85);
      glowOpacity.setValue(0);
      spinValue.setValue(0);
      return;
    }
    // Content fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
    // Glow pulse
    Animated.parallel([
      Animated.timing(glowOpacity, {
        toValue: 0.7,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(glowScale, {
        toValue: 1.25,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
    // Spinner
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [visible, durationMs, fadeIn, glowOpacity, glowScale, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* ── Violet halo ────────────────────────────────────────── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />

        {/* ── Red / warm core glow ───────────────────────────────── */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.coreGlow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />

        {/* ── Content ────────────────────────────────────────────── */}
        <Animated.View style={[styles.content, { opacity: fadeIn }]}>
          {/* Spinning ring */}
          <Animated.View
            style={[styles.spinner, { transform: [{ rotate: spin }] }]}
          />

          {/* Eyebrow */}
          <Text style={styles.eyebrow}>UNRATED · BOSS PROTOCOL</Text>

          {/* Syros PFP */}
          <Image
            source={require("@/assets/images/syros-pfp.png")}
            style={styles.pfp}
          />

          {/* Main headline */}
          <Text style={styles.headline}>PREPARING SYROS...</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>THE GAME BENEATH THE GAME</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#020306",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  halo: {
    position: "absolute",
    width: "140%",
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: "rgba(147,51,234,0.18)",
    shadowColor: SYROS_PURPLE,
    shadowOpacity: 0.55,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  coreGlow: {
    position: "absolute",
    width: "100%",
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: "rgba(190,30,40,0.22)",
    shadowColor: "#FF0000",
    shadowOpacity: 0.35,
    shadowRadius: 60,
    shadowOffset: { width: 0, height: 0 },
  },
  content: {
    alignItems: "center",
    zIndex: 10,
  },
  spinner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
    borderColor: "rgba(192,132,252,0.18)",
    borderTopColor: SYROS_LIGHTEST,
    marginBottom: 28,
    // Violet glow on the ring
    shadowColor: SYROS_LIGHT,
    shadowOpacity: 0.55,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  pfp: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: SYROS_PURPLE,
    marginBottom: 18,
    // Glow around pfp
    shadowColor: SYROS_PURPLE,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 4,
    marginBottom: 10,
    fontWeight: "600",
  },
  headline: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 6,
    textShadowColor: "rgba(192,132,252,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 36,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 12,
    color: "rgba(216,180,254,0.78)",
    letterSpacing: 3,
    fontWeight: "600",
  },
});
