/**
 * Live board-skin preview — renders the **verbatim web grid canvas** (bg +
 * glowing grid lines, via the WebView in [webCanvas.ts]) plus a few real
 * [SkinPieceArt] stones, exactly as the in-game board shows them. Used by the
 * Store and Collection so a player previews the actual animated skin (not a
 * flat swatch) before buying / equipping.
 *
 * Pure presentation — no game state, no logic.
 */

import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { CanvasWebView, buildSkinBgHtml, skinHasWebBg } from "@/components/game/skins";
import { SkinPieceArt, skinHasPieceArt } from "@/components/game/SkinPieces";
import { boardSkinFor } from "@/lib/cosmetics/boardSkin";
import { colors, radii } from "@/theme/tokens";

/** A representative scatter of stones so both players' pieces are visible. */
const SAMPLE: { r: number; c: number; owner: "X" | "O" }[] = [
  { r: 0, c: 1, owner: "X" },
  { r: 1, c: 2, owner: "X" },
  { r: 3, c: 3, owner: "X" },
  { r: 1, c: 0, owner: "O" },
  { r: 2, c: 3, owner: "O" },
  { r: 4, c: 1, owner: "O" },
];

export function GridLivePreview({
  boardStyle,
  size,
  pieces = true,
  live = true,
  style,
}: {
  boardStyle: string;
  size: number;
  /** Overlay sample stones (off for the smallest thumbnails). */
  pieces?: boolean;
  /**
   * Run the animated WebView canvas. Set ``false`` for list thumbnails — a
   * cheap static board (flat bg + grid lines) renders instead, so a long list
   * never spins up dozens of WebViews. Keep ``true`` for the one-at-a-time
   * modal / hero preview where the full animation is wanted.
   */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const skin = boardSkinFor(boardStyle);
  const webBg = skin ? skinHasWebBg(skin.id) : false;
  const pad = Math.max(2, Math.round(size * 0.04));
  const cell = (size - pad * 2) / 5;

  const html = useMemo(() => {
    if (!live || !skin || !webBg || size <= 0) return null;
    const lines = Array.from({ length: 6 }, (_, i) => pad + i * cell);
    return buildSkinBgHtml(skin.id, { width: size, height: size, lines });
  }, [live, skin, webBg, size, pad, cell]);

  const lineColor = skin?.boardLine ?? colors.border;
  const showPieces = pieces && skin != null && skinHasPieceArt(skin.id);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radii.md,
          overflow: "hidden",
          backgroundColor: skin?.boardBg ?? colors.bgRaised,
          borderWidth: 1,
          borderColor: skin?.boardLine ?? colors.border,
        },
        style,
      ]}
    >
      {html ? <CanvasWebView html={html} /> : null}
      {!live ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={`v${i}`}
              style={{ position: "absolute", left: pad + i * cell, top: pad, bottom: pad, width: 1, backgroundColor: lineColor }}
            />
          ))}
          {[1, 2, 3, 4].map((i) => (
            <View
              key={`h${i}`}
              style={{ position: "absolute", top: pad + i * cell, left: pad, right: pad, height: 1, backgroundColor: lineColor }}
            />
          ))}
        </View>
      ) : null}
      {showPieces && skin ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {SAMPLE.map((p, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: pad + p.c * cell,
                top: pad + p.r * cell,
                width: cell,
                height: cell,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SkinPieceArt skinId={skin.id} owner={p.owner} size={cell} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
