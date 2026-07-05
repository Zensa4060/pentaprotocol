/**
 * Animated boot splash — the "power on" moment of the app.
 *
 * The OS-level splash (expo-splash-screen) is a static image by design,
 * so the sequence is a hand-off: the native splash shows the brand mark
 * centered at 200px on #030303, and this overlay mounts with the exact
 * same frame before animating. The user never sees the seam.
 *
 * Timeline (ms from mount):
 *    250  power surge — red bloom ignites behind the logo, the mark
 *         pulses and glitch-shakes like it just received current
 *    300+ three shockwave rings fire outward, staggered
 *    750  "PENTAPROTOCOL" letters slam in one by one under the mark
 *   2000  zoom-through exit — the logo blows up past the camera while
 *         the overlay fades, revealing the app underneath
 *
 * A tap anywhere skips straight to the exit. ``onDone`` fires exactly
 * once, when the exit animation completes — the parent unmounts us.
 *
 * Colors are hard brand values from ``theme/tokens`` (not the equipped
 * theme): the boot moment is the brand, not the loadout.
 */

import { useEffect } from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, {
  type SharedValue,
  cancelAnimation,
  Easing,
  FadeInDown,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/theme/tokens";

const LOGO = require("@/assets/images/icon.png");

/** Matches the native splash ``imageWidth`` so the hand-off is seamless. */
const LOGO_SIZE = 200;
const RING_SIZE = 230;
const BLOOM_SIZE = 420;

const LETTERS = [..."PENTAPROTOCOL"];
/** Index where the red half of the wordmark starts ("PENTA" | "PROTOCOL"). */
const RED_FROM = 5;

const EXIT_MS = 500;

/**
 * This is a one-shot 2.5s brand intro with tap-to-skip, so it opts out
 * of the OS "reduce motion" setting — with the default behavior the
 * whole overlay completes in ~10ms and the boot moment never shows.
 */
const NEVER = ReduceMotion.Never;

export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const pulse = useSharedValue(0); // logo scale kick at the surge
  const shake = useSharedValue(0); // glitch jitter, -1..1
  const bloom = useSharedValue(0); // red glow behind the mark
  const ringA = useSharedValue(0); // shockwave progress, 0..1 each
  const ringB = useSharedValue(0);
  const ringC = useSharedValue(0);
  const exit = useSharedValue(0); // zoom-through + fade out

  const startExit = () => {
    exit.value = withTiming(
      1,
      { duration: EXIT_MS, easing: Easing.in(Easing.cubic), reduceMotion: NEVER },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
  };

  useEffect(() => {
    // The surge: quick inhale, springy release.
    pulse.value = withDelay(
      250,
      withSequence(
        withTiming(1, { duration: 140, reduceMotion: NEVER }),
        withSpring(0, { damping: 12, reduceMotion: NEVER }),
      ),
      NEVER,
    );
    // Glitch jitter — a few hard flicks that die out.
    const flick = (to: number) => withTiming(to, { duration: 40, reduceMotion: NEVER });
    shake.value = withDelay(
      260,
      withSequence(flick(1), flick(-1), flick(0.6), flick(-0.6), flick(0)),
      NEVER,
    );
    bloom.value = withDelay(250, withTiming(1, { duration: 700, reduceMotion: NEVER }), NEVER);
    const fire = () =>
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    ringA.value = withDelay(300, fire(), NEVER);
    ringB.value = withDelay(450, fire(), NEVER);
    ringC.value = withDelay(600, fire(), NEVER);
    // Auto-exit; a tap can preempt this (the assignment replaces the
    // pending delayed animation, so the callback can't double-fire).
    exit.value = withDelay(
      2000,
      withTiming(
        1,
        { duration: EXIT_MS, easing: Easing.in(Easing.cubic), reduceMotion: NEVER },
        (finished) => {
          if (finished) runOnJS(onDone)();
        },
      ),
      NEVER,
    );
    return () => {
      [pulse, shake, bloom, ringA, ringB, ringC, exit].forEach(cancelAnimation);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shake.value * 5 },
      { scale: (1 + 0.1 * pulse.value) * (1 + 6 * exit.value) },
    ],
  }));
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloom.value * (1 - exit.value),
    transform: [{ scale: 0.6 + 0.8 * bloom.value }],
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <Pressable
        style={styles.fill}
        onPress={() => {
          startExit();
        }}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        {/* Soft radial glow — RN views can't gradient, SVG can. */}
        <Animated.View style={[styles.bloom, bloomStyle]}>
          <Svg width={BLOOM_SIZE} height={BLOOM_SIZE}>
            <Defs>
              <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.45} />
                <Stop offset="55%" stopColor={colors.accent} stopOpacity={0.14} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#bloom)" />
          </Svg>
        </Animated.View>
        <Ring progress={ringA} />
        <Ring progress={ringB} />
        <Ring progress={ringC} />
        <Animated.View style={logoStyle}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.View style={styles.word}>
          {LETTERS.map((ch, i) => (
            <Animated.Text
              key={i}
              entering={FadeInDown.delay(750 + i * 45)
                .springify()
                .damping(14)
                .reduceMotion(NEVER)}
              style={[styles.letter, { color: i < RED_FROM ? colors.text : colors.accent }]}
            >
              {ch}
            </Animated.Text>
          ))}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** One expanding shockwave ring — fades out as it grows. */
function Ring({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - progress.value),
    transform: [{ scale: 0.5 + 2.3 * progress.value }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    zIndex: 1000,
    elevation: 1000,
  },
  fill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bloom: {
    position: "absolute",
    width: BLOOM_SIZE,
    height: BLOOM_SIZE,
  },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  word: {
    position: "absolute",
    bottom: "24%",
    flexDirection: "row",
  },
  letter: {
    fontFamily: "CourierPrimeBold",
    fontSize: 24,
    letterSpacing: 4,
  },
});
