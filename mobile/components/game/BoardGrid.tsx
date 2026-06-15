/**
 * Square board renderer for 5×5, 6×6, or 7×7.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  AuroraBands,
  DriftBlobs,
  FallingGlyphs,
  ParticleDrift,
  PixelBlink,
  PulseGlow,
  StreakSweep,
} from "@/components/cosmetics/AnimatedFx";
import { boardSkinFor, type BoardSkin } from "@/lib/cosmetics/boardSkin";
import { SkinPieceArt, skinHasPieceArt, skinPieceGlow } from "@/components/game/SkinPieces";
import { CanvasWebView, buildSkinBgHtml, skinHasWebBg } from "@/components/game/skins";
import type { GridSize } from "@/lib/game/boardConfig";
import { useAuthStore } from "@/lib/store";
import { colors, radii } from "@/theme/tokens";
import { usePalette } from "@/theme/ThemeProvider";
import type { ThemePalette } from "@/theme/themes";

import type { Board, Coord } from "@/lib/game/winCheck";

const CELL_GAP = 4;
const BOARD_PAD = 8;
/** Gutter reserved for the A–E / 1–5 coordinate labels. */
const LABEL_GUTTER = 18;

export interface BoardGridProps {
  gridSize: GridSize;
  board: Board;
  lastMove?: Coord | null;
  winningLine?: Coord[] | null;
  onCellPress?: (row: number, col: number) => void;
  disabled?: boolean;
  /** Lock total square side (px) — stops relayout when HUD above changes. */
  sideLength?: number;
  style?: StyleProp<ViewStyle>;
}

export function BoardGrid({
  gridSize,
  board,
  lastMove,
  winningLine,
  onCellPress,
  disabled = false,
  sideLength,
  style,
}: BoardGridProps) {
  const palette = usePalette();
  // Equipped board skin (Collection → Grids). Overrides the theme's board
  // surface colors; pieces keep the theme glyphs/colors.
  const boardStyle = useAuthStore((s) => s.user?.board_style);
  const skin = boardSkinFor(boardStyle);
  // Verbatim web-canvas background (via WebView) for this skin. When present
  // the cells render transparent so the canvas (bg + glowing grid lines) shows.
  const webBg = skin ? skinHasWebBg(skin.id) : false;
  const locked = sideLength != null && sideLength > 0;
  const [measured, setMeasured] = useState(0);
  const size = locked ? sideLength! : measured;

  useEffect(() => {
    if (locked) setMeasured(sideLength!);
  }, [locked, sideLength]);

  const handleLayout = (e: LayoutChangeEvent) => {
    if (locked) return;
    const next = Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height);
    if (next !== measured && next > 0) setMeasured(next);
  };

  // The square is split into a label gutter (top + left) and the board.
  const boardSize = size > 0 ? size - LABEL_GUTTER : 0;
  const cellSize =
    boardSize > 0
      ? Math.floor((boardSize - BOARD_PAD * 2 - CELL_GAP * (gridSize - 1)) / gridSize)
      : 0;

  // Build the skin's web-canvas background HTML once per geometry change (NOT
  // per move) so the WebView never reloads mid-game. Grid lines are placed at
  // the RN cell boundaries so they line up with the interactive cells on top.
  const bgHtml = useMemo(() => {
    if (!webBg || !skin || boardSize <= 0) return null;
    const lines = Array.from({ length: gridSize + 1 }, (_, i) =>
      Math.max(1, Math.min(boardSize - 1, BOARD_PAD + i * (cellSize + CELL_GAP) - CELL_GAP / 2)),
    );
    return buildSkinBgHtml(skin.id, { width: boardSize, height: boardSize, lines });
  }, [webBg, skin, boardSize, cellSize, gridSize]);

  const winningSet = new Set<string>();
  if (winningLine) {
    for (const [r, c] of winningLine) winningSet.add(`${r},${c}`);
  }
  const lastKey = lastMove ? `${lastMove[0]},${lastMove[1]}` : null;

  const colLabels = Array.from({ length: gridSize }, (_, i) => String.fromCharCode(65 + i));

  return (
    <View
      style={[
        styles.boardWrap,
        locked && size > 0 ? { width: size, height: size, flex: undefined } : null,
        style,
      ]}
      onLayout={locked ? undefined : handleLayout}
    >
      {size > 0 ? (
        <View style={{ width: size, height: size }}>
          {/* ── Column labels (A–E) ── */}
          <View style={{ flexDirection: "row", height: LABEL_GUTTER, marginLeft: LABEL_GUTTER + BOARD_PAD }}>
            {colLabels.map((ch, c) => (
              <Text
                key={`col-${c}`}
                style={[
                  styles.coordLabel,
                  { width: cellSize, marginRight: CELL_GAP, color: palette.textDim },
                ]}
              >
                {ch}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row" }}>
            {/* ── Row labels (1–5) ── */}
            <View style={{ width: LABEL_GUTTER, marginTop: BOARD_PAD }}>
              {board.map((_, r) => (
                <View
                  key={`rowlbl-${r}`}
                  style={{ height: cellSize, marginBottom: CELL_GAP, justifyContent: "center" }}
                >
                  <Text style={[styles.coordLabel, { color: palette.textDim }]}>{r + 1}</Text>
                </View>
              ))}
            </View>

            {/* ── Board ── */}
            <View
              style={[
                styles.board,
                {
                  width: boardSize,
                  height: boardSize,
                  backgroundColor: skin?.boardBg ?? palette.boardBg,
                  borderColor: skin?.boardLine ?? palette.boardLine,
                },
              ]}
            >
              {bgHtml ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, { borderRadius: radii.md, overflow: "hidden" }]}
                >
                  <CanvasWebView html={bgHtml} />
                </View>
              ) : skin ? (
                <SkinAtmosphere skin={skin} />
              ) : null}
              {board.map((row, r) => (
                <View key={`row-${r}`} style={styles.row}>
                  {row.map((cell, c) => {
                    const isLast = lastKey === `${r},${c}`;
                    const isWinning = winningSet.has(`${r},${c}`);
                    return (
                      <Cell
                        key={`${r}-${c}`}
                        size={cellSize}
                        owner={cell}
                        isLast={isLast}
                        isWinning={isWinning}
                        palette={palette}
                        skin={skin}
                        onCanvas={!!bgHtml}
                        disabled={disabled || cell !== null}
                        onPress={() => onCellPress?.(r, c)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** @deprecated Use ``BoardGrid`` with ``gridSize={7}``. */
export function Board7(
  props: Omit<BoardGridProps, "gridSize"> & { board: Board },
) {
  return <BoardGrid gridSize={7} {...props} />;
}

interface CellProps {
  size: number;
  owner: string | null;
  isLast: boolean;
  isWinning: boolean;
  palette: ThemePalette;
  skin: BoardSkin | null;
  /** When a Skia skin canvas is painting the board, cells render transparent. */
  onCanvas: boolean;
  disabled: boolean;
  onPress: () => void;
}

function Cell({ size, owner, isLast, isWinning, palette, skin, onCanvas, disabled, onPress }: CellProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  // Stone-place pop: when a cell goes empty → occupied, spring the glyph in.
  const pop = useRef(new Animated.Value(1)).current;
  const prevOwnerRef = useRef<string | null>(owner);

  useEffect(() => {
    if (prevOwnerRef.current === null && owner !== null) {
      pop.setValue(0.3);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    prevOwnerRef.current = owner;
  }, [owner, pop]);

  useEffect(() => {
    if (!isWinning) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isWinning, pulse]);

  // Bundle piece skins REPLACE the theme glyphs (glacier shards /
  // bloodmoon sigils); otherwise P1/P2 use the active theme's pieces
  // (X/Y, α/Ω, ⚔/🛡, …). Legacy X/O owners render literally.
  const glyph =
    owner === "P1" || owner === "X"
      ? skin?.p1Glyph ?? (owner === "X" ? "X" : palette.glyphP1)
      : owner === "P2" || owner === "O" || owner === "Y"
      ? skin?.p2Glyph ?? (owner === "O" || owner === "Y" ? owner : palette.glyphP2)
      : null;
  // Bundle piece skins recolor the stones (glacier shards / bloodmoon sigils).
  const pieceColor =
    owner === "P1" || owner === "X"
      ? skin?.p1Color ?? palette.p1
      : owner === "P2" || owner === "O" || owner === "Y"
      ? skin?.p2Color ?? palette.p2
      : palette.textMuted;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      android_ripple={!disabled ? { color: palette.bgRaised } : undefined}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          marginRight: CELL_GAP,
          backgroundColor: onCanvas ? "transparent" : skin?.cellBg ?? palette.boardCell,
          borderRadius: radii.xs,
          borderWidth: onCanvas ? 0 : 1,
          borderColor: onCanvas ? "transparent" : skin?.cellBorder ?? palette.boardLine,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && !disabled
          ? { backgroundColor: onCanvas ? "rgba(255,255,255,0.06)" : palette.bgCard }
          : null,
      ]}
    >
      {owner && skin && skinHasPieceArt(skin.id) ? (
        <Animated.View
          style={{
            transform: isWinning ? [{ scale: pulse }] : [{ scale: pop }],
            shadowColor: skinPieceGlow(skin.id, owner),
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <SkinPieceArt skinId={skin.id} owner={owner} size={size} />
        </Animated.View>
      ) : glyph ? (
        <Animated.Text
          style={{
            fontSize: Math.max(12, Math.floor(size * (gridSizeFontScale(size)))),
            fontWeight: "800",
            color: pieceColor,
            transform: isWinning ? [{ scale: pulse }] : [{ scale: pop }],
            ...(skin
              ? {
                  textShadowColor: skin.pieceGlow,
                  textShadowRadius: 8,
                  textShadowOffset: { width: 0, height: 0 },
                }
              : null),
          }}
        >
          {glyph}
        </Animated.Text>
      ) : null}
      {isLast && !isWinning ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.xs,
            borderWidth: 2,
            borderColor: palette.borderStrong,
          }}
        />
      ) : null}
      {isWinning ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: radii.xs,
            borderWidth: 2,
            borderColor: palette.accentHot,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function gridSizeFontScale(cellSize: number): number {
  if (cellSize < 36) return 0.38;
  if (cellSize < 44) return 0.4;
  return 0.42;
}

/**
 * Bundle atmosphere — breathing tinted washes PLUS the bundle's particle
 * weather (web parity): glacier gets drifting aurora bands and falling
 * snow; bloodmoon gets rising embers. Pointer-transparent, native-driver
 * loops only.
 */
function SkinAtmosphere({ skin }: { skin: BoardSkin }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const innerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const outerOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0.2] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radii.md, overflow: "hidden" }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: skin.atmosphereInner, opacity: innerOpacity }]}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: skin.atmosphereOuter, opacity: outerOpacity }]}
      />
      <SkinWeather id={skin.id} />
    </View>
  );
}

/**
 * Per-skin animated weather — each grid bundle's signature effect, ported
 * from its web canvas component using the shared ``AnimatedFx`` primitives.
 * Pointer-transparent, native-driver loops only.
 */
function SkinWeather({ id }: { id: string }) {
  switch (id) {
    case "red_grid":
      // Heat core + rising embers (web RedGrid).
      return (
        <>
          <PulseGlow color="rgba(255,90,0,0.28)" secondary="rgba(180,20,0,0.34)" durationMs={3000} />
          <ParticleDrift color="rgba(255,140,0,0.95)" count={12} direction="up" sizeRange={[1.5, 3.5]} durationRange={[2200, 5200]} seed={31} />
        </>
      );
    case "glacier_grid":
      return (
        <>
          <AuroraBands colors={["rgba(56,189,248,0.28)", "rgba(167,139,250,0.22)"]} seed={6} />
          <ParticleDrift color="rgba(224,242,254,0.85)" count={10} direction="down" sizeRange={[1.5, 3.5]} durationRange={[4200, 8600]} glow={false} seed={23} />
        </>
      );
    case "ice_grid":
      return (
        <>
          <AuroraBands colors={["rgba(96,200,255,0.26)", "rgba(125,211,252,0.2)"]} seed={12} />
          <ParticleDrift color="rgba(200,238,255,0.85)" count={11} direction="down" sizeRange={[1.5, 3.5]} durationRange={[4000, 8200]} glow={false} seed={24} />
        </>
      );
    case "bloodmoon_grid":
      return <ParticleDrift color="rgba(251,146,60,0.9)" count={10} direction="up" sizeRange={[1.5, 3.5]} durationRange={[2600, 6200]} seed={29} />;
    case "egypt_grid":
      // Drifting golden sand motes + warm glow (web EgyptGrid).
      return (
        <>
          <PulseGlow color="rgba(214,160,48,0.22)" durationMs={3400} />
          <ParticleDrift color="rgba(245,210,120,0.85)" count={12} direction="up" sizeRange={[1, 2.6]} durationRange={[3200, 6600]} glow={false} seed={33} />
        </>
      );
    case "synthwave_grid":
      // Neon horizon sweep (web SynthwaveGrid).
      return (
        <>
          <StreakSweep colors={["rgba(255,77,109,0.7)", "rgba(0,229,255,0.6)"]} count={5} heightRange={[1.5, 3]} angle="-4deg" durationRange={[1800, 3400]} seed={37} />
          <PulseGlow color="rgba(255,77,109,0.22)" secondary="rgba(0,229,255,0.18)" durationMs={2600} />
        </>
      );
    case "matrix_grid":
      // Falling code rain (web MatrixGrid).
      return <FallingGlyphs color="#22FF66" columns={8} fontSize={10} seed={41} />;
    case "arcane_grid":
      // Magic-circle pulse + rune sparkle (web ArcaneGrid).
      return (
        <>
          <PulseGlow color="rgba(168,85,247,0.3)" secondary="rgba(251,191,36,0.16)" durationMs={2800} />
          <PixelBlink colors={["#C084FC", "#A855F7", "#FBBF24"]} count={10} seed={45} />
        </>
      );
    case "bio_grid":
      // Drifting bioluminescent masses + rising orbs (web BioGrid).
      return (
        <>
          <DriftBlobs colors={["rgba(0,255,208,0.4)", "rgba(180,100,255,0.34)"]} count={3} seed={49} />
          <ParticleDrift color="rgba(0,255,208,0.9)" count={11} direction="up" sizeRange={[2, 4.5]} durationRange={[3800, 7600]} seed={51} />
        </>
      );
    case "forge_grid":
      // Molten heat + sparks (web ForgeGrid).
      return (
        <>
          <PulseGlow color="rgba(255,110,0,0.28)" secondary="rgba(255,204,0,0.22)" durationMs={2800} />
          <ParticleDrift color="rgba(255,170,40,0.95)" count={12} direction="up" sizeRange={[1.5, 3.5]} durationRange={[2200, 5000]} seed={53} />
        </>
      );
    case "void_grid":
      // Cosmic pulse + rising stardust (web VoidGrid).
      return (
        <>
          <PulseGlow color="rgba(140,80,255,0.3)" secondary="rgba(64,192,255,0.18)" durationMs={3000} />
          <ParticleDrift color="rgba(216,200,255,0.85)" count={14} direction="up" sizeRange={[1, 2.6]} durationRange={[5200, 9600]} glow={false} seed={57} />
        </>
      );
    case "space_grid":
      // Slow starfield + shooting streaks (web SpaceGrid).
      return (
        <>
          <ParticleDrift color="rgba(224,231,255,0.85)" count={14} direction="up" sizeRange={[1, 2.4]} durationRange={[6000, 11000]} glow={false} seed={61} />
          <StreakSweep colors={["rgba(0,217,255,0.7)"]} count={2} heightRange={[1, 2]} angle="-18deg" durationRange={[2600, 4200]} seed={63} />
        </>
      );
    case "pixel_grid":
      // 8-bit blinking pixels (web PixelGrid).
      return <PixelBlink colors={["#FFDD00", "#FF4455", "#FFFFFF", "#00D9FF"]} count={16} seed={67} />;
    case "tokyo_grid":
      // Neon rain + city streak (web TokyoGrid).
      return (
        <>
          <FallingGlyphs color="#FF2A7A" columns={6} fontSize={9} seed={71} />
          <StreakSweep colors={["rgba(0,204,255,0.6)"]} count={3} heightRange={[1.5, 2.5]} angle="6deg" durationRange={[1600, 3000]} seed={73} />
        </>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  boardWrap: {
    // Fill the (flexible) parent slot and size the square board to the
    // smaller of the available width/height — so the whole board always
    // fits on screen instead of forcing a width-sized square that pushes
    // the bottom row / controls out of bounds on shorter phones.
    width: "100%",
    flex: 1,
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  board: {
    padding: BOARD_PAD,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    marginBottom: CELL_GAP,
  },
  coordLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
