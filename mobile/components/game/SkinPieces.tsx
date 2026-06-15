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
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

/** True when a skin ships illustrated (SVG) pieces rather than glyphs. */
export function skinHasPieceArt(skinId: string): boolean {
  return (
    skinId === "red_grid" ||
    skinId === "glacier_grid" ||
    skinId === "matrix_grid" ||
    skinId === "synthwave_grid" ||
    skinId === "bloodmoon_grid" ||
    skinId === "egypt_grid" ||
    skinId === "arcane_grid" ||
    skinId === "bio_grid" ||
    skinId === "forge_grid" ||
    skinId === "void_grid" ||
    skinId === "space_grid" ||
    skinId === "pixel_grid" ||
    skinId === "tokyo_grid"
  );
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
  if (skinId === "glacier_grid") {
    return isPlayerOne(owner) ? <SnowflakePiece size={size} /> : <IceShardPiece size={size} />;
  }
  if (skinId === "matrix_grid") {
    return isPlayerOne(owner) ? <MatrixBracketPiece size={size} /> : <BinaryPillPiece size={size} />;
  }
  if (skinId === "synthwave_grid") {
    return isPlayerOne(owner) ? <RetroSunPiece size={size} /> : <NeonPalmPiece size={size} />;
  }
  if (skinId === "bloodmoon_grid") {
    return isPlayerOne(owner) ? <PentagramPiece size={size} /> : <EvilEyePiece size={size} />;
  }
  if (skinId === "egypt_grid") {
    return isPlayerOne(owner) ? <AnkhPiece size={size} /> : <EyeOfRaPiece size={size} />;
  }
  if (skinId === "arcane_grid") {
    return isPlayerOne(owner) ? <RunePortalPiece size={size} /> : <GoldSigilPiece size={size} />;
  }
  if (skinId === "bio_grid") {
    return isPlayerOne(owner) ? <JellyfishPiece size={size} /> : <AnglerFishPiece size={size} />;
  }
  if (skinId === "forge_grid") {
    return isPlayerOne(owner) ? <HammerPiece size={size} /> : <MoltenSigilPiece size={size} />;
  }
  if (skinId === "void_grid") {
    return isPlayerOne(owner) ? <PulsarPiece size={size} /> : <QuasarPiece size={size} />;
  }
  if (skinId === "space_grid") {
    return isPlayerOne(owner) ? <RocketPiece size={size} /> : <SatellitePiece size={size} />;
  }
  if (skinId === "pixel_grid") {
    return isPlayerOne(owner) ? <PixelCoinPiece size={size} /> : <PixelHeartPiece size={size} />;
  }
  if (skinId === "tokyo_grid") {
    return isPlayerOne(owner) ? <DragonSealPiece size={size} /> : <KatanaPiece size={size} />;
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

/** Glacier P1 — 6-arm crystal snowflake (web ``Snowflake``). */
function SnowflakePiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.62));
  return (
    <Svg width={s} height={s} viewBox="0 0 56 56">
      <G transform="translate(28,28)">
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <G key={deg} transform={`rotate(${deg})`}>
            <Line x1={0} y1={-22} x2={0} y2={22} stroke="#7dd3fc" strokeWidth={2.2} strokeLinecap="round" />
            <Line x1={-5.5} y1={-13} x2={0} y2={-13} stroke="#38bdf8" strokeWidth={1.6} strokeLinecap="round" />
            <Line x1={5.5} y1={-13} x2={0} y2={-13} stroke="#38bdf8" strokeWidth={1.6} strokeLinecap="round" />
            <Line x1={-3.5} y1={-7} x2={0} y2={-7} stroke="#bae6fd" strokeWidth={1.2} strokeLinecap="round" />
            <Line x1={3.5} y1={-7} x2={0} y2={-7} stroke="#bae6fd" strokeWidth={1.2} strokeLinecap="round" />
            <Polygon points="0,-22 -2,-18 0,-25 2,-18" fill="#e0f2fe" opacity={0.85} />
          </G>
        ))}
        <Polygon
          points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5"
          fill="none"
          stroke="#93c5fd"
          strokeWidth={1.2}
          opacity={0.7}
        />
        <Circle cx={0} cy={0} r={3.5} fill="#e0f2fe" />
        <Circle cx={0} cy={0} r={5.5} fill="none" stroke="#bae6fd" strokeWidth={0.8} opacity={0.5} />
      </G>
    </Svg>
  );
}

/** Glacier P2 — faceted ice shard cluster (web ``IceShard``). */
function IceShardPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.62));
  return (
    <Svg width={s} height={s} viewBox="0 0 56 56">
      <Path d="M28,5 L33,24 L28,51 L23,24 Z" fill="rgba(147,197,253,0.14)" stroke="#93c5fd" strokeWidth={2.4} strokeLinejoin="round" />
      <Line x1={28} y1={5} x2={31} y2={22} stroke="rgba(255,255,255,0.55)" strokeWidth={0.9} />
      <Path d="M12,14 L18,26 L16,42 L11,27 Z" fill="rgba(191,219,254,0.10)" stroke="#bfdbfe" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M44,14 L38,26 L40,42 L45,27 Z" fill="rgba(191,219,254,0.10)" stroke="#bfdbfe" strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={28} cy={5} r={2.8} fill="#e0f2fe" />
    </Svg>
  );
}

/** Matrix P1 — code brackets ``[ ]`` with rungs + cursor (web ``MatrixBracket``). */
function MatrixBracketPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Path d="M22,6 L16,6 L16,42 L22,42" fill="none" stroke="#00ff41" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M26,6 L32,6 L32,42 L26,42" fill="none" stroke="#00ff41" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {[14, 19, 24, 29, 34].map((y, i) => (
        <Line key={i} x1={19} y1={y} x2={29} y2={y} stroke="#00cc33" strokeWidth={1.2} opacity={0.4 + i * 0.05} />
      ))}
      <Rect x={21} y={22} width={6} height={3} fill="#00ff41" opacity={0.9} />
    </Svg>
  );
}

/** Matrix P2 — binary pill ``01 | 10`` (web ``BinaryPill``). */
function BinaryPillPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Rect x={6} y={10} width={36} height={28} rx={14} fill="rgba(74,222,128,0.08)" stroke="#4ade80" strokeWidth={2.2} />
      <Line x1={24} y1={10} x2={24} y2={38} stroke="#4ade80" strokeWidth={1.2} opacity={0.4} />
      <SvgText x={10} y={28} fontSize={10} fontFamily="monospace" fontWeight="bold" fill="#4ade80">01</SvgText>
      <SvgText x={26} y={28} fontSize={10} fontFamily="monospace" fontWeight="bold" fill="#86efac">10</SvgText>
    </Svg>
  );
}

/** Synthwave P1 — retro sun: sunset disc, scanlines, rays (web ``RetroSun``). */
function RetroSunPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const uid = useId();
  const gid = `rsGrad-${uid}`;
  const cid = `rsClip-${uid}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffcc00" />
          <Stop offset="0.5" stopColor="#ff6600" />
          <Stop offset="1" stopColor="#ff0066" />
        </LinearGradient>
        <ClipPath id={cid}>
          <Circle cx={24} cy={24} r={17} />
        </ClipPath>
      </Defs>
      <Circle cx={24} cy={24} r={17} fill={`url(#${gid})`} />
      <G clipPath={`url(#${cid})`}>
        {[14, 17, 20, 23, 26, 29, 32].map((y, i) => (
          <Rect key={i} x={5} y={y} width={38} height={2.5} fill="#1a002a" opacity={0.85} />
        ))}
      </G>
      <Circle cx={24} cy={24} r={17} fill="none" stroke="#ff6688" strokeWidth={2} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <Line
            key={i}
            x1={24 + 17 * Math.cos(a)}
            y1={24 + 17 * Math.sin(a)}
            x2={24 + 21 * Math.cos(a)}
            y2={24 + 21 * Math.sin(a)}
            stroke="#ffcc00"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
    </Svg>
  );
}

const PALM_FRONDS: [number, number][] = [[-14, -12], [-10, -8], [-8, -14], [10, -8], [14, -12]];

/** Synthwave P2 — neon palm tree (web ``NeonPalm``). */
function NeonPalmPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Path
        d="M22,10 Q21,20 20,34 Q22,36 24,36 Q26,36 28,34 Q27,20 26,10 Z"
        fill="rgba(0,204,255,0.12)"
        stroke="#00eeff"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {PALM_FRONDS.map(([ex, ey], i) => {
        const ax = 24;
        const ay = 10 + (i > 2 ? 4 : 0);
        return (
          <Path
            key={i}
            d={`M${ax},${ay} Q${ax + ex * 0.4},${ay + ey * 0.5} ${ax + ex},${ay + ey}`}
            fill="none"
            stroke="#00eeff"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        );
      })}
      {PALM_FRONDS.map(([ex, ey], i) => {
        const ax = 24;
        const ay = 10 + (i > 2 ? 4 : 0);
        const perp = Math.atan2(ey, ex) + Math.PI / 2;
        return [0, 1, 2].map((j) => {
          const t2 = (j + 1) * 0.25;
          const bx = ax + ex * t2;
          const by = ay + ey * t2;
          const leafLen = 5 - t2 * 2;
          return (
            <Line
              key={`${i}-${j}`}
              x1={bx + Math.cos(perp) * leafLen}
              y1={by + Math.sin(perp) * leafLen}
              x2={bx - Math.cos(perp) * leafLen}
              y2={by - Math.sin(perp) * leafLen}
              stroke="#80ffff"
              strokeWidth={0.9}
              strokeLinecap="round"
              opacity={0.6}
            />
          );
        });
      })}
      <Ellipse cx={24} cy={36} rx={4} ry={6} fill="#006688" opacity={0.4} />
    </Svg>
  );
}

/** Bloodmoon P1 — crimson pentagram ring with pulsing core (web ``Pentagram``). */
function PentagramPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `penGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#dc2626" stopOpacity={0.45} />
          <Stop offset="0.6" stopColor="#dc2626" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#dc2626" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#dc2626" strokeWidth={1.2} />
      <Circle cx={24} cy={24} r={9} fill="none" stroke="#dc2626" strokeWidth={0.8} opacity={0.5} />
      <Polygon
        points="24,4 43.02,17.82 35.76,40.18 12.24,40.18 4.98,17.82"
        fill="rgba(220,38,38,0.09)"
        stroke="#dc2626"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={24} cy={24} r={3} fill="#ff4444" opacity={0.75} />
    </Svg>
  );
}

/** Bloodmoon P2 — violet evil-eye with glowing pupil (web ``EvilEye``). */
function EvilEyePiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `eyeGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#7c3aed" stopOpacity={0.45} />
          <Stop offset="0.6" stopColor="#7c3aed" stopOpacity={0.15} />
          <Stop offset="1" stopColor="#7c3aed" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Path d="M6,24 Q24,6 42,24" fill="none" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M6,24 Q24,42 42,24" fill="none" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" />
      <Circle cx={24} cy={24} r={9} fill="rgba(124,58,237,0.17)" stroke="#9f67ff" strokeWidth={1.8} />
      <Circle cx={24} cy={24} r={4.5} fill="#110020" stroke="#9f67ff" strokeWidth={1.2} />
      <Circle cx={24} cy={24} r={2.4} fill="#cc44ff" opacity={0.7} />
      <Circle cx={27} cy={20} r={1.5} fill="#ffffff" opacity={0.6} />
    </Svg>
  );
}

/** Egypt P1 — golden ankh (web ``AnkhSymbol``). */
function AnkhPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `ankhGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#fbbf24" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#f59e0b" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#f59e0b" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Line x1={24} y1={22} x2={24} y2={44} stroke="#fbbf24" strokeWidth={3.5} strokeLinecap="round" />
      <Line x1={10} y1={28} x2={38} y2={28} stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />
      <Ellipse cx={24} cy={16} rx={11} ry={9} fill="rgba(251,191,36,0.10)" stroke="#fbbf24" strokeWidth={2.8} />
      <Line x1={24} y1={22} x2={24} y2={44} stroke="rgba(255,255,200,0.5)" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

const RA_RAYS: [number, number][] = [[-15, 8], [-18, 15], [-8, 22], [8, 22], [18, 15], [15, 8]];

/** Egypt P2 — violet Eye of Ra (web ``EyeOfRa``). */
function EyeOfRaPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `raGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#c084fc" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#a855f7" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#a855f7" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Path d="M4,24 Q24,6 44,24 Q24,42 4,24Z" fill="rgba(192,132,252,0.10)" stroke="#c084fc" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={24} cy={24} r={8} fill="none" stroke="#e9d5ff" strokeWidth={1.5} />
      <Circle cx={24} cy={24} r={4.5} fill="#110020" />
      <Circle cx={24} cy={24} r={2.5} fill="#e9d5ff" opacity={0.9} />
      <Line x1={24} y1={4} x2={24} y2={10} stroke="#c084fc" strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
      {RA_RAYS.map(([ex, ey], i) => (
        <Line key={i} x1={24} y1={24} x2={24 + ex} y2={24 + ey} stroke="#c084fc" strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
      ))}
    </Svg>
  );
}

/** Arcane P1 — violet rune portal: concentric rings + radial ticks (web ``RunePortal``). */
function RunePortalPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `rpGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#cc88ff" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#8800ff" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#8800ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#cc88ff" strokeWidth={2} />
      <Circle cx={24} cy={24} r={14} fill="none" stroke="#aa44ff" strokeWidth={1.2} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 * Math.PI) / 180;
        return (
          <Line
            key={i}
            x1={24 + 14 * Math.cos(a)}
            y1={24 + 14 * Math.sin(a)}
            x2={24 + 20 * Math.cos(a)}
            y2={24 + 20 * Math.sin(a)}
            stroke="#cc88ff"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        );
      })}
      <Circle cx={24} cy={24} r={5} fill="none" stroke="#ee88ff" strokeWidth={1.5} />
      <Circle cx={24} cy={24} r={2.5} fill="#eebbff" />
    </Svg>
  );
}

/** Arcane P2 — gold sigil: ring + dual offset pentagons (web ``GoldSigil``). */
function GoldSigilPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `gsGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ffdd60" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#ffaa00" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#ffaa00" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Circle cx={24} cy={24} r={20} fill="none" stroke="#ffdd60" strokeWidth={1.5} />
      <Polygon
        points="24,6 41.12,18.44 34.58,38.56 13.42,38.56 6.88,18.44"
        fill="rgba(255,170,0,0.10)"
        stroke="#ffaa00"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Polygon
        points="28.70,17.53 31.61,26.47 24,32 16.39,26.47 19.30,17.53"
        fill="none"
        stroke="#ffee80"
        strokeWidth={1.2}
        opacity={0.8}
      />
      <Circle cx={24} cy={24} r={3.5} fill="#ffee80" />
    </Svg>
  );
}

const BIO_TENTACLES: [number, number, number, number][] = [
  [12, 22, 10, 46], [16, 22, 14, 44], [20, 22, 20, 48], [24, 22, 24, 46],
  [28, 22, 28, 44], [32, 22, 34, 48], [36, 22, 38, 44],
];
const BIO_SPOTS: [number, number][] = [[14, 13], [24, 9], [34, 13]];

/** Bio P1 — teal bioluminescent jellyfish: dome + tentacles (web ``Jellyfish``). */
function JellyfishPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `jelGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="40%" r="55%">
          <Stop offset="0" stopColor="#00ffcc" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#00ffaa" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#00ffaa" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Path d="M7,22 Q7,4 24,4 Q41,4 41,22 Z" fill="rgba(0,255,200,0.10)" stroke="#00ffcc" strokeWidth={2.2} />
      {BIO_TENTACLES.map(([x1, y1, x2, y2], i) => (
        <Path
          key={i}
          d={`M${x1},${y1} Q${(x1 + x2) / 2 + Math.sin(i) * 3},${(y1 + y2) * 0.55} ${x2},${y2}`}
          fill="none"
          stroke="#00ffcc"
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      ))}
      {BIO_SPOTS.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={1.8} fill="#80ffee" opacity={0.75} />
      ))}
    </Svg>
  );
}

const BIO_FINS: [number, number, number, number][] = [[16, 22, 6, 18], [18, 22, 5, 25], [32, 22, 42, 18], [30, 22, 43, 25]];

/** Bio P2 — violet anglerfish with glowing lure (web ``AnglerFish``). */
function AnglerFishPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `angGlow-${useId()}`;
  const body = "M6,28 Q4,18 12,14 Q10,10 18,10 Q18,6 24,6 Q30,6 30,10 Q38,10 36,14 Q44,18 42,28 Q40,36 24,38 Q8,36 6,28Z";
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#b464ff" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#8000ff" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#8000ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Path d={body} fill="rgba(96,0,170,0.15)" stroke="#b464ff" strokeWidth={2} strokeLinejoin="round" />
      {BIO_FINS.map(([x1, y1, x2, y2], i) => (
        <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d090ff" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      ))}
      <Ellipse cx={17} cy={20} rx={4} ry={4.5} fill="#110020" />
      <Circle cx={17} cy={20} r={2} fill="#d090ff" />
      <Ellipse cx={31} cy={20} rx={4} ry={4.5} fill="#110020" />
      <Circle cx={31} cy={20} r={2} fill="#d090ff" />
      <Path d="M24,6 L24,2" stroke="#e0b0ff" strokeWidth={2} strokeLinecap="round" />
      <Circle cx={24} cy={1.5} r={3} fill="#e0b0ff" />
    </Svg>
  );
}

/** Forge P1 — glowing blacksmith hammer (web ``Hammer``). */
function HammerPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `hamGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="40%" r="55%">
          <Stop offset="0" stopColor="#ff6600" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#ff4400" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#ff4400" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Rect x={16} y={6} width={22} height={14} rx={3} fill="rgba(255,68,0,0.20)" stroke="#ff6600" strokeWidth={2.2} />
      <Rect x={21} y={20} width={6} height={22} rx={2} fill="rgba(170,51,0,0.60)" stroke="#cc4400" strokeWidth={2} />
      {([[14, 8], [38, 8], [14, 19], [38, 19]] as [number, number][]).map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={1.5} fill="#ffcc00" opacity={0.75} />
      ))}
    </Svg>
  );
}

/** Forge P2 — molten sigil: ring + 6 radial arms + core (web ``MoltenSigil``). */
function MoltenSigilPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `molGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ffaa00" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#ff8800" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#ff8800" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Circle cx={24} cy={24} r={19} fill="none" stroke="#ffaa00" strokeWidth={1.8} />
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i * 60 * Math.PI) / 180;
        return (
          <Line key={i} x1={24} y1={24} x2={24 + 19 * Math.cos(a)} y2={24 + 19 * Math.sin(a)} stroke="#ff8800" strokeWidth={2} />
        );
      })}
      <Circle cx={24} cy={24} r={7} fill="none" stroke="#ffcc00" strokeWidth={1.5} />
      <Circle cx={24} cy={24} r={3.5} fill="#ffee80" />
    </Svg>
  );
}

/** Void P1 — violet pulsar: 8-point star + core + cross rays (web ``Pulsar``). */
function PulsarPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `pulGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#b464ff" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#8020ff" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#8020ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Polygon
        points="44,24 30.36,30.36 24,44 17.64,30.36 4,24 17.64,17.64 24,4 30.36,17.64"
        fill="rgba(128,32,204,0.25)"
        stroke="#b464ff"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i * 90 * Math.PI) / 180;
        return (
          <Line key={i} x1={24} y1={24} x2={24 + 24 * Math.cos(a)} y2={24 + 24 * Math.sin(a)} stroke="#d090ff" strokeWidth={0.8} opacity={0.6} />
        );
      })}
      <Circle cx={24} cy={24} r={5} fill="#e0b4ff" />
    </Svg>
  );
}

/** Void P2 — cyan quasar: crossed accretion ellipses + core (web ``Quasar``). */
function QuasarPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `quaGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#40d0ff" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#0080ff" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#0080ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Ellipse cx={24} cy={24} rx={20} ry={7} fill="none" stroke="#40c0ff" strokeWidth={2} />
      <Ellipse cx={24} cy={24} rx={7} ry={20} fill="none" stroke="#40c0ff" strokeWidth={2} />
      <Circle cx={24} cy={24} r={13} fill="none" stroke="rgba(80,200,255,0.5)" strokeWidth={1.2} />
      <Circle cx={24} cy={24} r={5} fill="#80e0ff" />
      <Circle cx={24} cy={24} r={2} fill="#ffffff" opacity={0.9} />
    </Svg>
  );
}

/** Space P1 — cyan rocket with flame (web ``Rocket``). */
function RocketPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.6));
  const gid = `rktGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#00ddff" stopOpacity={0.38} />
          <Stop offset="0.6" stopColor="#00aaff" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#00aaff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Path d="M24,5 Q30,10 32,22 L32,36 L16,36 L16,22 Q18,10 24,5Z" fill="rgba(0,170,204,0.15)" stroke="#00ddff" strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M24,5 Q27,10 28,16 L24,14 L20,16 Q21,10 24,5Z" fill="#80eeff" opacity={0.5} />
      <Circle cx={24} cy={22} r={4.5} fill="none" stroke="#80eeff" strokeWidth={1.5} opacity={0.9} />
      <Circle cx={24} cy={22} r={2.5} fill="#00ffff" opacity={0.7} />
      <Path d="M16,32 L10,40 L16,38Z" fill="#00aacc" stroke="#00ddff" strokeWidth={1.2} opacity={0.8} />
      <Path d="M32,32 L38,40 L32,38Z" fill="#00aacc" stroke="#00ddff" strokeWidth={1.2} opacity={0.8} />
      <Path d="M20,36 Q22,42 24,44 Q26,42 28,36Z" fill="#ff8800" opacity={0.7} />
      <Path d="M22,36 Q23,40 24,41 Q25,40 26,36Z" fill="#ffff80" opacity={0.9} />
    </Svg>
  );
}

/** Space P2 — amber satellite with solar panels + signal (web ``Satellite``). */
function SatellitePiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.6));
  const gid = `satGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ff9922" stopOpacity={0.38} />
          <Stop offset="0.6" stopColor="#ff6600" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#ff6600" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Rect x={17} y={17} width={14} height={14} rx={2} fill="rgba(204,85,0,0.20)" stroke="#ff9922" strokeWidth={2} />
      <Rect x={2} y={19} width={14} height={10} rx={1} fill="rgba(255,102,0,0.15)" stroke="#ff9922" strokeWidth={1.5} />
      {[5, 9, 13].map((x, i) => (
        <Line key={`l${i}`} x1={x} y1={19} x2={x} y2={29} stroke="#ffbb44" strokeWidth={0.9} opacity={0.6} />
      ))}
      <Rect x={32} y={19} width={14} height={10} rx={1} fill="rgba(255,102,0,0.15)" stroke="#ff9922" strokeWidth={1.5} />
      {[35, 39, 43].map((x, i) => (
        <Line key={`r${i}`} x1={x} y1={19} x2={x} y2={29} stroke="#ffbb44" strokeWidth={0.9} opacity={0.6} />
      ))}
      <Line x1={24} y1={17} x2={24} y2={9} stroke="#ffcc44" strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={24} cy={8} r={2.5} fill="none" stroke="#ffcc44" strokeWidth={1.2} opacity={0.8} />
      <Circle cx={24} cy={24} r={2} fill="#ffdd88" opacity={0.9} />
    </Svg>
  );
}

// 8×8 sprite maps ported verbatim from web PixelGrid (`0` = empty pixel).
const COIN_MAP = [
  [0, 0, 1, 1, 1, 1, 0, 0], [0, 1, 1, 1, 1, 1, 1, 0], [1, 1, 0, 1, 1, 0, 1, 1], [1, 1, 0, 1, 1, 0, 1, 1],
  [1, 1, 0, 1, 1, 0, 1, 1], [1, 1, 0, 1, 1, 0, 1, 1], [0, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 0, 0],
];
const COIN_COL: (string | 0)[][] = [
  [0, 0, "#ffd700", "#ffee44", "#ffee44", "#ffd700", 0, 0],
  [0, "#ffd700", "#ffee44", "#ffee44", "#ffee44", "#ffee44", "#ffd700", 0],
  ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
  ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
  ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
  ["#cc9900", "#ffd700", "#1a1a00", "#ffd700", "#ffd700", "#1a1a00", "#ffd700", "#cc9900"],
  [0, "#ffd700", "#ffee44", "#ffee44", "#ffee44", "#ffee44", "#ffd700", 0],
  [0, 0, "#ffd700", "#ffee44", "#ffee44", "#ffd700", 0, 0],
];
const HEART_MAP = [
  [0, 1, 1, 0, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 1, 0, 0], [0, 0, 0, 1, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
];
const HEART_COL: (string | 0)[][] = [
  [0, "#ff6677", 0, 0, 0, "#ff6677", 0, 0],
  ["#ff4455", "#ff9999", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff9999", "#ff4455"],
  ["#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455"],
  ["#cc1122", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#cc1122"],
  [0, "#cc1122", "#ff4455", "#ff4455", "#ff4455", "#ff4455", "#cc1122", 0],
  [0, 0, "#cc1122", "#ff4455", "#ff4455", "#cc1122", 0, 0],
  [0, 0, 0, "#cc1122", "#cc1122", 0, 0, 0],
];

function PixelSprite({ size, map, colMap, fallback }: { size: number; map: number[][]; colMap: (string | 0)[][]; fallback: string }) {
  const s = Math.max(16, Math.floor(size * 0.62));
  return (
    <Svg width={s} height={s} viewBox="0 0 8 8">
      {map.map((row, ry) =>
        row.map((on, rx) =>
          on ? <Rect key={`${ry}-${rx}`} x={rx} y={ry} width={1.02} height={1.02} fill={(colMap[ry]?.[rx] as string) || fallback} /> : null,
        ),
      )}
    </Svg>
  );
}

/** Pixel P1 — 8-bit gold coin (web ``PixelCoin``). */
function PixelCoinPiece({ size }: { size: number }) {
  return <PixelSprite size={size} map={COIN_MAP} colMap={COIN_COL} fallback="#ffd700" />;
}

/** Pixel P2 — 8-bit red heart (web ``PixelHeart``). */
function PixelHeartPiece({ size }: { size: number }) {
  return <PixelSprite size={size} map={HEART_MAP} colMap={HEART_COL} fallback="#ff4455" />;
}

/** Tokyo P1 — pink 8-point dragon seal (web ``DragonSeal``). */
function DragonSealPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `drGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#ff0066" stopOpacity={0.4} />
          <Stop offset="0.6" stopColor="#ff0066" stopOpacity={0.14} />
          <Stop offset="1" stopColor="#ff0066" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Polygon points="24,4 28,20 44,24 28,28 24,44 20,28 4,24 20,20" fill="rgba(255,0,102,0.12)" stroke="#ff0066" strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={24} cy={24} r={4} fill="#ff88aa" />
    </Svg>
  );
}

/** Tokyo P2 — cyan neon katana cross (web ``Katana``). */
function KatanaPiece({ size }: { size: number }) {
  const s = Math.max(16, Math.floor(size * 0.58));
  const gid = `katGlow-${useId()}`;
  return (
    <Svg width={s} height={s} viewBox="0 0 48 48">
      <Defs>
        <RadialGradient id={gid} cx="50%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#00ccff" stopOpacity={0.38} />
          <Stop offset="0.6" stopColor="#0088ff" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#0088ff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={48} height={48} fill={`url(#${gid})`} />
      <Line x1={24} y1={5} x2={24} y2={40} stroke="#00ccff" strokeWidth={3} strokeLinecap="round" />
      <Line x1={14} y1={28} x2={34} y2={28} stroke="#00ccff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Colored glow per skin/owner for the caller's iOS view shadow. */
export function skinPieceGlow(skinId: string, owner: string): string {
  if (skinId === "red_grid") {
    return isPlayerOne(owner) ? "rgba(255,80,0,0.9)" : "rgba(204,0,0,0.9)";
  }
  if (skinId === "glacier_grid") {
    return isPlayerOne(owner) ? "rgba(125,211,252,0.9)" : "rgba(147,197,253,0.9)";
  }
  if (skinId === "matrix_grid") {
    return isPlayerOne(owner) ? "rgba(0,255,65,0.9)" : "rgba(74,222,128,0.9)";
  }
  if (skinId === "synthwave_grid") {
    return isPlayerOne(owner) ? "rgba(255,0,100,0.9)" : "rgba(0,200,255,0.9)";
  }
  if (skinId === "bloodmoon_grid") {
    return isPlayerOne(owner) ? "rgba(220,38,38,0.9)" : "rgba(124,58,237,0.9)";
  }
  if (skinId === "egypt_grid") {
    return isPlayerOne(owner) ? "rgba(245,158,11,0.9)" : "rgba(192,132,252,0.9)";
  }
  if (skinId === "arcane_grid") {
    return isPlayerOne(owner) ? "rgba(168,85,247,0.9)" : "rgba(255,180,0,0.9)";
  }
  if (skinId === "bio_grid") {
    return isPlayerOne(owner) ? "rgba(0,255,200,0.9)" : "rgba(140,0,255,0.9)";
  }
  if (skinId === "forge_grid") {
    return isPlayerOne(owner) ? "rgba(255,90,0,0.9)" : "rgba(255,160,0,0.9)";
  }
  if (skinId === "void_grid") {
    return isPlayerOne(owner) ? "rgba(140,60,255,0.9)" : "rgba(0,160,255,0.9)";
  }
  if (skinId === "space_grid") {
    return isPlayerOne(owner) ? "rgba(0,200,255,0.9)" : "rgba(255,140,0,0.9)";
  }
  if (skinId === "pixel_grid") {
    return isPlayerOne(owner) ? "rgba(255,200,0,0.9)" : "rgba(255,0,40,0.9)";
  }
  if (skinId === "tokyo_grid") {
    return isPlayerOne(owner) ? "rgba(255,0,102,0.9)" : "rgba(0,200,255,0.9)";
  }
  return "rgba(0,0,0,0)";
}
