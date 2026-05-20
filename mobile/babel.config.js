/**
 * Babel config for the PentaProtocol mobile app.
 *
 * Two plugins matter:
 *
 *   1. ``@tamagui/babel-plugin`` — Tamagui's optimizing compiler.
 *      Hoists static prop combos, flattens style objects, and
 *      generates "atomic" styles at build time. Without it Tamagui
 *      still works, just ~10x slower at render time. Keeping it
 *      enabled is essentially free during dev (the cost is paid
 *      at bundle time, not in the app).
 *
 *   2. ``react-native-worklets/plugin`` — this is Reanimated 4's
 *      worklets plugin. In Reanimated 3 it was
 *      ``react-native-reanimated/plugin`` and *had* to be last in
 *      the list. The new package mirrors that rule: keep it last,
 *      always.
 *
 * If you ever add another plugin (e.g. ``react-native-paper/babel``
 * for prod tree-shaking), insert it ABOVE the worklets plugin or
 * gestures + animations will silently stop firing.
 */

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "@tamagui/babel-plugin",
        {
          components: ["tamagui"],
          config: "./theme/tamagui.config.ts",
          logTimings: true,
        },
      ],
      // Reanimated 4's worklets plugin. Must remain the LAST entry.
      "react-native-worklets/plugin",
    ],
  };
};
