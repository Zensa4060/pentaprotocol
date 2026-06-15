/**
 * ``<TabSwipe />`` — horizontal swipe-to-switch between the four primary
 * tabs (Home · Friends · Missions · Profile).
 *
 * Purely a navigation convenience: it wraps a screen's content in a
 * horizontal ``Pan`` gesture and, on a committed left/right swipe,
 * ``router.navigate`` to the neighbouring tab. The bottom tab bar still
 * works exactly as before — this just adds the "scroll sideways to move
 * between tabs" affordance on top of it, with the navigator's own
 * ``animation: "shift"`` providing the smooth slide.
 *
 * It is deliberately tuned to coexist with the vertical ScrollViews each
 * tab already uses:
 *   - ``activeOffsetX`` means the pan only takes over once the drag is
 *     clearly horizontal, so taps and vertical scrolls pass straight
 *     through.
 *   - ``failOffsetY`` bails the pan the moment a drag reads as vertical,
 *     handing the gesture back to the ScrollView.
 *
 * No app/game logic lives here — it only changes which tab is focused.
 */

import { router } from "expo-router";
import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/** Left-to-right order of the swipeable tabs (matches the tab bar). */
const TAB_ROUTES = [
  "/(tabs)",
  "/(tabs)/friends",
  "/(tabs)/missions",
  "/(tabs)/profile",
] as const;

/** Distance (px) or fling velocity needed to commit a tab change. */
const DISTANCE = 60;
const VELOCITY = 500;
const LAST_INDEX = TAB_ROUTES.length - 1;

function goToTab(i: number) {
  if (i < 0 || i >= TAB_ROUTES.length) return;
  router.navigate(TAB_ROUTES[i] as never);
}

export function TabSwipe({
  index,
  children,
}: {
  /** This screen's position in {@link TAB_ROUTES} (0–3). */
  index: number;
  children: ReactNode;
}) {
  const pan = Gesture.Pan()
    // Only claim the gesture once it's unmistakably horizontal, so the
    // inner vertical ScrollView and button taps keep working.
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      const left = e.translationX <= -DISTANCE || e.velocityX <= -VELOCITY;
      const right = e.translationX >= DISTANCE || e.velocityX >= VELOCITY;
      if (left && index < LAST_INDEX) {
        runOnJS(goToTab)(index + 1);
      } else if (right && index > 0) {
        runOnJS(goToTab)(index - 1);
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.fill} collapsable={false}>
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
