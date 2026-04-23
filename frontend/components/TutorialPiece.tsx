"use client";

import React from "react";
import { THEMES, type ThemeId } from "@/lib/themes";

/**
 * Renders a game piece as theme-appropriate SVG text (X / Y / α / Ω / ⚔ / 🛡)
 * centred in the given cell. Used by every tutorial board renderer so the
 * on-screen pieces match the real game's piece glyphs exactly — swap the
 * theme and all tutorial visuals update alongside it.
 */
export function PieceGlyph({
  cx,
  cy,
  cell,
  slot,
  themeT,
  ringColor,
}: {
  cx: number;
  cy: number;
  cell: number;
  slot: "P1" | "P2";
  themeT: (typeof THEMES)[ThemeId];
  ringColor?: string;
}) {
  const glyph = slot === "P1" ? themeT.pieces.p1 : themeT.pieces.p2;
  const fill = slot === "P1" ? themeT.p1 : themeT.p2;
  return (
    <g>
      {ringColor && (
        <circle cx={cx} cy={cy} r={cell * 0.42} fill="none" stroke={ringColor} strokeWidth={2} opacity={0.9} />
      )}
      <text
        x={cx}
        y={cy}
        fontFamily={themeT.fontDisplay}
        fontSize={cell * 0.62}
        fontWeight={900}
        fill={fill}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ userSelect: "none", paintOrder: "stroke" }}
        stroke={fill}
        strokeWidth={0.4}
      >
        {glyph}
      </text>
    </g>
  );
}
