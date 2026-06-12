/**
 * Animated cosmetic primitives — the building blocks behind every live
 * banner / board-skin effect (web canvas-banner parity, RN Animated).
 *
 * All loops run on the native driver with a handful of Animated.Values
 * per effect, so a screen full of banners stays cheap. Layouts are
 * seeded-random (mulberry32) so re-renders never reshuffle particles.
 */

import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, type DimensionValue } from "react-native";

const pct = (n: number): DimensionValue => `${n}%` as DimensionValue;

/** Deterministic PRNG so particle layouts are stable across renders. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useLoop(durationMs: number, delayMs = 0): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(v, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, durationMs, delayMs]);
  return v;
}

function useBreathe(durationMs: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: durationMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: durationMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, durationMs]);
  return v;
}

/* ── Falling glyph columns (digital rain / hacker terminal) ─────────────── */

const RAIN_CHARS = "アカサタナハマヤラ01アネオ10ンメ01ヌ";

function RainColumn({
  x,
  duration,
  delay,
  color,
  fontSize,
  seed,
}: {
  x: DimensionValue;
  duration: number;
  delay: number;
  color: string;
  fontSize: number;
  seed: number;
}) {
  const t = useLoop(duration, delay);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: ["-100%", "100%"] });
  const chars = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: 10 }, () => RAIN_CHARS[Math.floor(rand() * RAIN_CHARS.length)]);
  }, [seed]);
  return (
    <Animated.View style={{ position: "absolute", left: x, top: 0, bottom: 0, transform: [{ translateY }] }}>
      {chars.map((c, i) => (
        <Text
          key={i}
          style={{
            color,
            fontSize,
            lineHeight: fontSize + 2,
            fontFamily: "monospace",
            opacity: i === chars.length - 1 ? 1 : 0.28 + (i / chars.length) * 0.5,
            textShadowColor: color,
            textShadowRadius: i === chars.length - 1 ? 8 : 0,
          }}
        >
          {c}
        </Text>
      ))}
    </Animated.View>
  );
}

export function FallingGlyphs({
  color,
  columns = 9,
  fontSize = 11,
  seed = 7,
}: {
  color: string;
  columns?: number;
  fontSize?: number;
  seed?: number;
}) {
  const cols = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: columns }, (_, i) => ({
      x: pct((i / columns) * 100 + rand() * 4),
      duration: 2600 + rand() * 3400,
      delay: rand() * 2400,
      seed: seed * 31 + i,
    }));
  }, [columns, seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cols.map((c, i) => (
        <RainColumn key={i} x={c.x} duration={c.duration} delay={c.delay} color={color} fontSize={fontSize} seed={c.seed} />
      ))}
    </View>
  );
}

/* ── Drifting particles (embers / snow / bubbles / stars) ───────────────── */

function Particle({
  startX,
  size,
  color,
  duration,
  delay,
  direction,
  drift,
  glow,
}: {
  startX: DimensionValue;
  size: number;
  color: string;
  duration: number;
  delay: number;
  direction: "up" | "down";
  drift: number;
  glow?: boolean;
}) {
  const t = useLoop(duration, delay);
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: direction === "up" ? ["110%", "-15%"] : ["-15%", "110%"],
  });
  const translateX = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift, 0] });
  const opacity = t.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 1, 0.8, 0] });
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: 0,
        bottom: 0,
        justifyContent: "flex-start",
        transform: [{ translateY }, { translateX }],
        opacity,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...(glow
            ? { shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4 }
            : null),
        }}
      />
    </Animated.View>
  );
}

export function ParticleDrift({
  color,
  count = 10,
  direction = "up",
  sizeRange = [3, 6],
  durationRange = [3200, 7200],
  glow = true,
  seed = 11,
}: {
  color: string;
  count?: number;
  direction?: "up" | "down";
  sizeRange?: [number, number];
  durationRange?: [number, number];
  glow?: boolean;
  seed?: number;
}) {
  const parts = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: pct(rand() * 96),
      size: sizeRange[0] + rand() * (sizeRange[1] - sizeRange[0]),
      duration: durationRange[0] + rand() * (durationRange[1] - durationRange[0]),
      delay: rand() * 3000,
      drift: (rand() - 0.5) * 30,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {parts.map((p, i) => (
        <Particle
          key={i}
          startX={p.x}
          size={p.size}
          color={color}
          duration={p.duration}
          delay={p.delay}
          direction={direction}
          drift={p.drift}
          glow={glow}
        />
      ))}
    </View>
  );
}

/* ── Sweeping streaks (hyperdrive / solar wind / lightsabers) ───────────── */

function Streak({
  y,
  height,
  color,
  duration,
  delay,
  angle,
}: {
  y: DimensionValue;
  height: number;
  color: string;
  duration: number;
  delay: number;
  angle: string;
}) {
  const t = useLoop(duration, delay);
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: ["-120%", "120%"] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 0.95, 0.95, 0] });
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: y,
        left: "-20%",
        width: "60%",
        height,
        borderRadius: height,
        backgroundColor: color,
        transform: [{ translateX }, { rotate: angle }],
        opacity,
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 4,
      }}
    />
  );
}

export function StreakSweep({
  colors: streakColors,
  count = 5,
  heightRange = [2, 3],
  angle = "0deg",
  durationRange = [1400, 3000],
  seed = 5,
}: {
  colors: string[];
  count?: number;
  heightRange?: [number, number];
  angle?: string;
  durationRange?: [number, number];
  seed?: number;
}) {
  const streaks = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      y: pct(6 + rand() * 84),
      height: heightRange[0] + rand() * (heightRange[1] - heightRange[0]),
      color: streakColors[i % streakColors.length],
      duration: durationRange[0] + rand() * (durationRange[1] - durationRange[0]),
      delay: rand() * 2200,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {streaks.map((s, i) => (
        <Streak key={i} y={s.y} height={s.height} color={s.color} duration={s.duration} delay={s.delay} angle={angle} />
      ))}
    </View>
  );
}

/* ── Breathing color bands (aurora / prismatic / nebula) ────────────────── */

export function AuroraBands({
  colors: bandColors,
  seed = 3,
}: {
  colors: string[];
  seed?: number;
}) {
  const t = useBreathe(2800 + seed * 120);
  const t2 = useBreathe(4200 + seed * 90);
  const shift = t.interpolate({ inputRange: [0, 1], outputRange: [-26, 26] });
  const shift2 = t2.interpolate({ inputRange: [0, 1], outputRange: [30, -30] });
  const op = t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const op2 = t2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.25] });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.band,
          { top: "12%", backgroundColor: bandColors[0], opacity: op, transform: [{ translateX: shift }, { rotate: "-8deg" }] },
        ]}
      />
      <Animated.View
        style={[
          styles.band,
          { top: "48%", backgroundColor: bandColors[1] ?? bandColors[0], opacity: op2, transform: [{ translateX: shift2 }, { rotate: "6deg" }] },
        ]}
      />
    </View>
  );
}

/* ── Pulsing radial glow (neon / void / plasma / crystal) ───────────────── */

export function PulseGlow({
  color,
  secondary,
  durationMs = 1600,
}: {
  color: string;
  secondary?: string;
  durationMs?: number;
}) {
  const t = useBreathe(durationMs);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const op = t.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] });
  const op2 = t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.12] });
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
      <Animated.View
        style={{
          width: "70%",
          aspectRatio: 1,
          borderRadius: 999,
          backgroundColor: color,
          opacity: op,
          transform: [{ scale }],
        }}
      />
      {secondary ? (
        <Animated.View
          style={{
            position: "absolute",
            width: "40%",
            aspectRatio: 1,
            borderRadius: 999,
            backgroundColor: secondary,
            opacity: op2,
            transform: [{ scale }],
          }}
        />
      ) : null}
    </View>
  );
}

/* ── Random lightning flash (thunder storm) ─────────────────────────────── */

export function StormFlash({ color = "#DBEAFE" }: { color?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(v, { toValue: 0.85, duration: 60, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.1, duration: 90, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(v, { toValue: 0.5, duration: 70, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: v }]}
    />
  );
}

/* ── Expanding rings (ink drop / tidal pulse) ───────────────────────────── */

export function ExpandingRings({
  color,
  count = 3,
  durationMs = 3400,
}: {
  color: string;
  count?: number;
  durationMs?: number;
}) {
  const rings = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
      {rings.map((i) => (
        <Ring key={i} color={color} duration={durationMs} delay={(durationMs / count) * i} />
      ))}
    </View>
  );
}

function Ring({ color, duration, delay }: { color: string; duration: number; delay: number }) {
  const t = useLoop(duration, delay);
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1.6] });
  const op = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] });
  return (
    <Animated.View
      style={{
        position: "absolute",
        width: "55%",
        aspectRatio: 1,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: color,
        opacity: op,
        transform: [{ scale }],
      }}
    />
  );
}

/* ── Blinking pixel grid (arcade) ───────────────────────────────────────── */

function Blinker({ x, y, size, color, duration, delay }: { x: DimensionValue; y: DimensionValue; size: number; color: string; duration: number; delay: number }) {
  const t = useLoop(duration, delay);
  const op = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 0.95, 0.1] });
  return (
    <Animated.View
      style={{ position: "absolute", left: x, top: y, width: size, height: size, backgroundColor: color, opacity: op, borderRadius: 1 }}
    />
  );
}

export function PixelBlink({
  colors: pix,
  count = 14,
  seed = 9,
}: {
  colors: string[];
  count?: number;
  seed?: number;
}) {
  const cells = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: pct(rand() * 92),
      y: pct(rand() * 86),
      size: 4 + Math.floor(rand() * 5),
      color: pix[i % pix.length],
      duration: 700 + rand() * 1600,
      delay: rand() * 1500,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells.map((c, i) => (
        <Blinker key={i} {...c} />
      ))}
    </View>
  );
}

/* ── Drifting blobs (lava lamp / deep sea mass / dunes) ─────────────────── */

export function DriftBlobs({
  colors: blobColors,
  count = 3,
  seed = 13,
}: {
  colors: string[];
  count?: number;
  seed?: number;
}) {
  const blobs = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => ({
      x: pct(8 + rand() * 70),
      size: 46 + rand() * 60,
      color: blobColors[i % blobColors.length],
      duration: 3800 + rand() * 4200,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {blobs.map((b, i) => (
        <Blob key={i} {...b} />
      ))}
    </View>
  );
}

function Blob({ x, size, color, duration }: { x: DimensionValue; size: number; color: string; duration: number }) {
  const t = useBreathe(duration);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [size * 0.55, -size * 0.4] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 0.95] });
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        bottom: -size * 0.3,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: 0.5,
        transform: [{ translateY }, { scale }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    left: "-12%",
    right: "-12%",
    height: "30%",
    borderRadius: 999,
  },
});
