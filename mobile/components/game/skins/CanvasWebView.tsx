/**
 * Transparent, non-interactive WebView host for the verbatim web `<canvas>`
 * skin/banner animations ([webCanvas.ts]). Sits behind the interactive RN
 * layer (board cells / banner overlay), so touches pass straight through.
 */

import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

export function CanvasWebView({ html, style }: { html: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <WebView
        source={{ html }}
        style={styles.web}
        // Transparent so the board frame / banner gradient shows at the edges.
        opaque={false}
        androidLayerType="hardware"
        // Lock it down — pure visual layer, no scrolling/zoom/interaction.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        originWhitelist={["*"]}
        setBuiltInZoomControls={false}
        nestedScrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: "transparent" },
});
