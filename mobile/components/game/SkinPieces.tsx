/**
 * Vector board-skin pieces — true parity with the web ``GamePieces`` SVG
 * art (``frontend/components/GamePieces.tsx``). Where a grid bundle ships
 * illustrated pieces (e.g. Inferno's flame & skull), ``BoardGrid`` renders
 * these instead of a flat Unicode glyph so the phone board matches the web
 * board 1:1.
 *
 * Paths are ported verbatim from the web SVGs. Entrance / win animations
 * are driven by the wrapping ``Animated.View`` in ``BoardGrid`` (the same
 * pop-spring + win-pulse every piece already uses), so these stay static.
 * A translucent scaled halo path fakes the web's drop-shadow glow on every
 * platform; iOS additionally gets a colored view shadow from the caller.
 */

import { useId } from "react";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/** True when a skin ships illustrated (SVG) pieces rather than glyphs. */
export function skinHasPieceArt(skinId: string): boolean {
  return skinId === "red_grid";
}

/** Normalize a board owner token to player 1 vs player 2. */
function isPlayerOne(owner: string): boolean {
  return owner === "P1" || owner === "X";
}

export interface SkinPieceArtProps {
  skinId: string;
  owner: string;
  /** Cell side length (px); the art is sized to a fraction of it. */
  size: number;
}

/**
 * Render the illustrated piece for ``skinId`` + ``owner``. Returns ``null``
 * when the skin has no art for that slot (caller falls back to the glyph).
 */
export function SkinPieceArt({ skinId, owner, size }: SkinPieceArtProps) {
  if (skinId === "red_grid") {
    return isPlayerOne(owner) ? <FlamePiece size={size} /> : <SkullPiece size={size} />;
  }
  return null;
}

const FLAME_OUTER =
  "M20,36 Q8,28 10,18 Q12,12 16,10 Q14,16 18,18 Q16,10 22,4 Q24,14 28,16 Q34,18 30,28 Q28,34 20,36 Z";

/** Inferno P1 — three stacked flame tongues (web ``Flame``). */
function FlamePiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.62));
  // Unique gradient id per instance — avoids cross-Svg id collisions.
  const gid = `flameGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="58%" r="55%">
          <Stop offset="0" stopColor="#ff5a00" stopOpacity={0.7} />
          <Stop offset="0.55" stopColor="#ff3000" stopOpacity={0.28} />
          <Stop offset="1" stopColor="#ff3000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Cross-platform glow (Android ignores RN view shadows). */}
      <Rect x={0} y={0} width={40} height={40} fill={`url(#${gid})`} />
      <Path d={FLAME_OUTER} fill="#ff4400" />
      <Path
        d="M20,34 Q12,28 14,20 Q16,16 19,16 Q17,20 20,22 Q22,16 25,18 Q29,22 26,28 Q24,32 20,34 Z"
        fill="#ff8800"
      />
      <Path d="M20,32 Q16,28 17,23 Q19,20 20,21 Q21,20 23,23 Q24,28 20,32 Z" fill="#ffcc00" />
    </Svg>
  );
}

/** Inferno P2 — line-art skull with eye sockets + teeth (web ``Skull``). */
function SkullPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.62));
  const gid = `skullGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 40 40">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ff1a1a" stopOpacity={0.5} />
          <Stop offset="0.6" stopColor="#cc0000" stopOpacity={0.2} />
          <Stop offset="1" stopColor="#cc0000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Cross-platform glow (Android ignores RN view shadows). */}
      <Rect x={0} y={0} width={40} height={40} fill={`url(#${gid})`} />
      <Path d="M8,24 Q8,8 20,8 Q32,8 32,24 L32,28 L8,28 Z" fill="rgba(204,0,0,0.22)" />
      <Path
        d="M8,24 Q8,8 20,8 Q32,8 32,24 L32,28 L8,28 Z"
        fill="none"
        stroke="#cc0000"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d="M11,28 L11,34 L16,34 L16,30 L20,30 L20,34 L24,34 L24,30 L29,30 L29,34 L29,28"
        fill="none"
        stroke="#cc0000"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={15} cy={20} r={3.5} fill="#cc0000" />
      <Circle cx={25} cy={20} r={3.5} fill="#cc0000" />
      <Path d="M19,24 L20,26 L21,24" fill="none" stroke="#cc0000" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Colored glow per skin/owner for the caller's iOS view shadow. */
export function skinPieceGlow(skinId: string, owner: string): string {
  if (skinId === "red_grid") {
    return isPlayerOne(owner) ? "rgba(255,80,0,0.9)" : "rgba(204,0,0,0.9)";
  }
  return "rgba(0,0,0,0)";
}
