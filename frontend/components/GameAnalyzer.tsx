"use client";

import React, { useMemo, useState } from "react";
import axios from "axios";
import API from "@/lib/api";
import { THEMES, type ThemeId } from "@/lib/themes";
import { checkWin } from "@/lib/winChecker";
import { checkWin6 } from "@/lib/winChecker6";
import { checkWin7 } from "@/lib/winChecker7";
import { SYROS_PFP_URL } from "@/lib/unrankedBots";

type Slot = "P1" | "P2";
type Quality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface AnalyzerMove {
  player: Slot;
  row: number;
  col: number;
}

interface AnalyzerAnnotation {
  move_index: number;
  player: Slot;
  played: [number, number];
  engine_best: [number, number] | null;
  quality: Quality;
  score_before: number;
  score_after: number;
  score_delta: number;
}

interface AnalyzerSummaryRow {
  accuracy: number;
  best_moves: number;
  good: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

interface AnalyzerResponse {
  move_annotations: AnalyzerAnnotation[];
  summary: {
    P1: AnalyzerSummaryRow;
    P2: AnalyzerSummaryRow;
  };
}

type ThemeT = (typeof THEMES)[ThemeId];

export interface GameAnalyzerProps {
  boardSize: 5 | 6 | 7;
  selectedPatterns: string[];
  moveHistory: AnalyzerMove[];
  isGameOver: boolean;
  t: ThemeT;
  p1Label?: string;
  p2Label?: string;
  onClose?: () => void;
  /**
   * Optional board snapshot renderer from GameScreen (preferred).
   * This lets the analyzer replay use the exact same board component
   * as live gameplay. If omitted, a compact fallback board is rendered.
   * When `opts.winHighlight` is set (final move, decisive win), cells in the
   * set use keys `"row,col"` and may be styled as the winning pattern.
   */
  renderBoardSnapshot?: (
    board: (Slot | null)[][],
    boardSize: number,
    opts?: { winHighlight?: Set<string> | null },
  ) => React.ReactNode;
}

const QUALITY_COLORS: Record<Quality, string> = {
  best: "#22c55e",
  good: "#14b8a6",
  inaccuracy: "#eab308",
  mistake: "#f97316",
  blunder: "#ef4444",
};

const VALID_PATTERNS: Record<5 | 6 | 7, string[]> = {
  5: ["V", "L", "ZZ-5", "T", "LINE", "DIAGONAL"],
  6: ["ZZ", "T", "L", "Y", "LINE", "DIAGONAL", "A"],
  7: ["Y", "L", "T", "V", "C", "zigzag", "LINE", "DIAGONAL"],
};

function fmtNum(v: number): string {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

/** Chess-style cell label (col A…, row 1… from top). */
function cellNotation(row: number, col: number, boardSize: number): string {
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return "—";
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function formatAccuracyBreakdown(row: AnalyzerSummaryRow): string {
  const parts: string[] = [];
  if (row.best_moves) parts.push(`${row.best_moves} best`);
  if (row.good) parts.push(`${row.good} good`);
  if (row.inaccuracies) {
    parts.push(`${row.inaccuracies} ${row.inaccuracies === 1 ? "inaccuracy" : "inaccuracies"}`);
  }
  if (row.mistakes) parts.push(`${row.mistakes} mistake${row.mistakes === 1 ? "" : "s"}`);
  if (row.blunders) parts.push(`${row.blunders} blunder${row.blunders === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "—";
}

/** Light page background → use theme text; dark → near-white for “neutral” P1 accuracy. */
function neutralAccuracyNumberColor(bgHex: string, fallbackText: string): string {
  const h = (bgHex || "").replace("#", "").trim();
  if (h.length !== 6) return fallbackText;
  const r = parseInt(h.slice(0, 2), 16);
  return r > 0x55 ? fallbackText : "#F4F4F5";
}

function safeAnalyzerPatterns(boardSize: 5 | 6 | 7, selectedPatterns: string[]): string[] {
  const allowed = new Set(VALID_PATTERNS[boardSize]);
  const n = selectedPatterns.filter((p) => allowed.has(p));
  return n.length > 0 ? n : [...VALID_PATTERNS[boardSize]];
}

/** Cells that belong to the winning pattern/line on the final board, or null if draw / no line. */
function finalWinningCellKeys(
  boardSize: 5 | 6 | 7,
  moveHistory: AnalyzerMove[],
  selectedPatterns: string[],
  gameOver: boolean,
): Set<string> | null {
  if (!gameOver || moveHistory.length < 2) return null;
  const last = moveHistory[moveHistory.length - 1];
  if (!last) return null;
  const safe = safeAnalyzerPatterns(boardSize, selectedPatterns);
  const board = buildBoardAtMove(boardSize, moveHistory, moveHistory.length - 1) as (string | null)[][];
  const n = moveHistory.length;
  try {
    const raw =
      boardSize === 5
        ? checkWin(board, last.row, last.col, last.player, n, safe)
        : boardSize === 6
          ? checkWin6(board, last.row, last.col, last.player, n, safe)
          : checkWin7(board, last.row, last.col, last.player, n, safe);
    if (!raw || raw.winner === "DRAW" || !raw.line?.length) return null;
    return new Set(raw.line.map(([r, c]) => `${r},${c}`));
  } catch {
    return null;
  }
}

function buildBoardAtMove(boardSize: number, moves: AnalyzerMove[], inclusiveMoveIndex: number): (Slot | null)[][] {
  const b: (Slot | null)[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => null),
  );
  const cap = Math.min(inclusiveMoveIndex, moves.length - 1);
  for (let i = 0; i <= cap; i += 1) {
    const m = moves[i];
    if (!m) continue;
    if (m.row < 0 || m.row >= boardSize || m.col < 0 || m.col >= boardSize) continue;
    if (b[m.row][m.col] !== null) continue;
    b[m.row][m.col] = m.player;
  }
  return b;
}

function FallbackReplayBoard({
  board,
  boardSize,
  t,
  lastPlayed,
  winCells,
}: {
  board: (Slot | null)[][];
  boardSize: number;
  t: ThemeT;
  /** Cell played on the current replay step (accent highlight). */
  lastPlayed: { row: number; col: number } | null;
  /** Winning pattern cells (shown only on final replay frame when not a draw). */
  winCells: Set<string> | null;
}) {
  const cell = Math.max(60, Math.ceil(380 / boardSize));
  const w = cell * boardSize;
  const pad = 0;
  const pieceFontPx = Math.max(18, Math.floor(cell * 0.44));
  const hl =
    lastPlayed &&
    lastPlayed.row >= 0 &&
    lastPlayed.row < boardSize &&
    lastPlayed.col >= 0 &&
    lastPlayed.col < boardSize
      ? lastPlayed
      : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${w}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: "100%",
        minWidth: 320,
        maxWidth: Math.max(320, w),
        height: "auto",
        aspectRatio: "1 / 1",
        border: `1px solid ${t.border}55`,
        borderRadius: 10,
        background: t.boardBg,
        display: "block",
      }}
    >
      <rect x={0} y={0} width={w} height={w} fill={t.boardBg} />
      {Array.from({ length: boardSize }, (_, r) =>
        Array.from({ length: boardSize }, (_, c) => {
          const x = c * cell;
          const y = r * cell;
          const isLastMove = hl && hl.row === r && hl.col === c;
          const onWinPattern = winCells?.has(`${r},${c}`) ?? false;
          const cellGlow = onWinPattern || isLastMove;
          return (
            <g key={`cell-${r}-${c}`}>
              <rect
                x={x + pad}
                y={y + pad}
                width={cell - pad * 2}
                height={cell - pad * 2}
                rx={4}
                fill={
                  onWinPattern
                    ? `${t.accent}35`
                    : isLastMove
                      ? `${t.accent}22`
                      : t.bgPanel
                }
                stroke={
                  onWinPattern ? `${t.accentGlow}` : isLastMove ? `${t.accent}AA` : `${t.border}44`
                }
                strokeWidth={cellGlow ? 2 : 1}
              />
              {cellGlow ? (
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={cell - 4}
                  height={cell - 4}
                  rx={4}
                  fill="none"
                  stroke={t.accentGlow}
                  strokeWidth={onWinPattern ? 2.5 : 2}
                  opacity={onWinPattern ? 1 : 0.85}
                />
              ) : null}
            </g>
          );
        }),
      )}
      {board.map((row, r) =>
        row.map((v, c) => {
          if (!v) return null;
          const fill = v === "P1" ? t.p1 : t.p2;
          const sym = v === "P1" ? t.pieces.p1 : t.pieces.p2;
          const cx = c * cell + cell / 2;
          const cy = r * cell + cell / 2;
          return (
            <text
              key={`stone-${r}-${c}`}
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill={fill}
              fontFamily={t.fontDisplay}
              fontSize={pieceFontPx}
              fontWeight={900}
              style={{ userSelect: "none", pointerEvents: "none" }}
            >
              {sym}
            </text>
          );
        }),
      )}
    </svg>
  );
}

export default function GameAnalyzer({
  boardSize,
  selectedPatterns,
  moveHistory,
  isGameOver,
  t,
  p1Label = "P1",
  p2Label = "P2",
  onClose,
  renderBoardSnapshot,
}: GameAnalyzerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzerResponse | null>(null);
  const [replayMove, setReplayMove] = useState<number>(-1);

  const replayBoard = useMemo(
    () => buildBoardAtMove(boardSize, moveHistory, replayMove),
    [boardSize, moveHistory, replayMove],
  );

  const winCellsAtEnd = useMemo(
    () => finalWinningCellKeys(boardSize, moveHistory, selectedPatterns, isGameOver),
    [boardSize, moveHistory, selectedPatterns, isGameOver],
  );
  const winCellsVisible =
    winCellsAtEnd && replayMove === moveHistory.length - 1 && moveHistory.length > 0
      ? winCellsAtEnd
      : null;

  const onAnalyze = async () => {
    if (!isGameOver || loading) return;
    if (moveHistory.length < 2) {
      setError("At least 2 moves are required to analyze a game.");
      return;
    }
    const safePatterns = safeAnalyzerPatterns(boardSize, selectedPatterns);
    setLoading(true);
    setError(null);
    try {
      const payload = {
        board_size: boardSize,
        selected_patterns: safePatterns,
        move_history: moveHistory,
      };
      const res = await API.post<AnalyzerResponse>("/api/analyze/game", payload, { timeout: 120000 });
      const data = res.data;
      setResult(data);
      setReplayMove(data.move_annotations.length > 0 ? data.move_annotations.length - 1 : -1);
    } catch (e: unknown) {
      let msg = "Analyze request failed";
      if (axios.isAxiosError(e)) {
        const low = (e.message || "").toLowerCase();
        if (e.code === "ECONNABORTED" || low.includes("timeout")) {
          msg =
            "Analysis timed out — the server may be busy. Try again; very long games can take over a minute.";
        } else if (e.response) {
          const st = e.response.status;
          const raw = e.response.data as { detail?: unknown } | undefined;
          const detail = raw?.detail;
          const fromDetail =
            typeof detail === "string" && detail.trim()
              ? detail.trim()
              : Array.isArray(detail)
                ? detail
                    .map((d) => {
                      if (typeof d === "string") return d;
                      if (d && typeof d === "object" && "msg" in d) return String((d as { msg?: unknown }).msg || "");
                      return "";
                    })
                    .filter(Boolean)
                    .join(" | ")
                : null;
          if (fromDetail) msg = fromDetail;
          else if (st === 404)
            msg =
              "Analyze API not found (404). If you deploy the frontend without NEXT_PUBLIC_API_URL, set BACKEND_REWRITE_ORIGIN or NEXT_PUBLIC_API_URL so /api reaches the Python server.";
          else if (st === 422) msg = "Invalid game data for analysis — move list or patterns may not match server rules.";
          else if (st >= 500) msg = "Analysis server error — try again in a moment.";
          else msg = `Analysis failed (HTTP ${st}).`;
        } else {
          msg =
            "Could not reach the game server. Check your network, VPN, and that the API URL / rewrites are configured.";
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const lastPlayedCell =
    replayMove >= 0 && replayMove < moveHistory.length
      ? { row: moveHistory[replayMove].row, col: moveHistory[replayMove].col }
      : null;

  const stepReplay = (delta: number) => {
    const maxIdx = Math.max(0, moveHistory.length - 1);
    setReplayMove((prev) => Math.min(maxIdx, Math.max(-1, prev + delta)));
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        marginLeft: "auto",
        marginRight: "auto",
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        background: t.bgCard,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: t.fontMono,
            fontSize: 16,
            fontWeight: 800,
            color: t.text,
            letterSpacing: "0.08em",
          }}
        >
          <img
            src={SYROS_PFP_URL}
            alt=""
            width={28}
            height={28}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              objectFit: "cover",
              flexShrink: 0,
              border: "1.5px solid rgba(192,132,252,0.85)",
              boxShadow: "0 0 10px rgba(124,58,237,0.35)",
            }}
          />
          SYROS ANALYZER
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            disabled={!isGameOver || loading}
            onClick={onAnalyze}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${t.danger}`,
              background: loading ? `${t.danger}22` : `${t.danger}14`,
              color: t.danger,
              fontFamily: t.fontMono,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.08em",
              cursor: !isGameOver || loading ? "default" : "pointer",
              opacity: !isGameOver || loading ? 0.65 : 1,
            }}
          >
            {loading ? "ANALYZING..." : "ANALYZE GAME"}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close analyzer"
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: `1px solid ${t.border}`,
                background: "transparent",
                color: t.textSecondary,
                fontFamily: t.fontMono,
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                lineHeight: "28px",
                textAlign: "center",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!isGameOver && (
        <div style={{ color: t.textMuted, fontFamily: t.fontMono, fontSize: 12 }}>
          Analysis unlocks after match end.
        </div>
      )}

      {error && (
        <div
          style={{
            border: `1px solid ${t.danger}88`,
            background: `${t.danger}18`,
            color: t.danger,
            borderRadius: 8,
            padding: "8px 10px",
            fontFamily: t.fontMono,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Accuracy cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              width: "100%",
            }}
          >
            {(
              [
                {
                  key: "P1" as const,
                  label: p1Label,
                  row: result.summary.P1,
                  numColor: neutralAccuracyNumberColor(t.bg, t.text),
                  losingAcc: false,
                },
                {
                  key: "P2" as const,
                  label: p2Label,
                  row: result.summary.P2,
                  numColor:
                    result.summary.P2.accuracy < result.summary.P1.accuracy ? "#E11D48" : t.text,
                  losingAcc: result.summary.P2.accuracy < result.summary.P1.accuracy,
                },
              ] as const
            ).map((card) => {
              const acc = Math.min(100, Math.max(0, Number(card.row?.accuracy ?? 0)));
              const breakdown = formatAccuracyBreakdown(card.row);
              return (
                <div
                  key={card.key}
                  style={{
                    position: "relative",
                    border: `1px solid ${t.border}55`,
                    borderRadius: 10,
                    background: t.bgPanel,
                    padding: "16px 16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      fontWeight: 700,
                      color: t.textMuted,
                      letterSpacing: "0.14em",
                      fontVariant: "small-caps",
                      textTransform: "lowercase",
                    }}
                  >
                    {card.label}
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontDisplay,
                      fontSize: 68,
                      fontWeight: 900,
                      lineHeight: 0.95,
                      color: card.numColor,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {card.row?.accuracy?.toFixed?.(1) ?? card.row?.accuracy ?? "0.0"}
                    <span style={{ fontSize: 28, marginLeft: 4, opacity: 0.85 }}>%</span>
                  </div>
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      color: t.textMuted,
                      lineHeight: 1.35,
                    }}
                  >
                    {breakdown}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 4,
                      background: `${t.border}33`,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${acc}%`,
                        background: card.losingAcc
                          ? "#E11D48"
                          : card.key === "P1"
                            ? t.accent
                            : t.p2,
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Board + move list */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 40%) minmax(0, 60%)",
              gap: 20,
              width: "100%",
              alignItems: "stretch",
              paddingTop: 8,
              borderTop: `1px solid ${t.border}44`,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
                position: "sticky",
                top: 8,
                alignSelf: "start",
              }}
            >
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.textMuted,
                  letterSpacing: "0.12em",
                  textAlign: "center",
                }}
              >
                MOVE {Math.max(0, replayMove + 1)} / {moveHistory.length}
              </div>
              <div style={{ width: "100%", maxWidth: 380, display: "flex", justifyContent: "center" }}>
                {renderBoardSnapshot ? (
                  <div style={{ width: "100%", minWidth: 320, maxWidth: 380 }}>
                    {renderBoardSnapshot(replayBoard, boardSize, { winHighlight: winCellsVisible })}
                  </div>
                ) : (
                  <FallbackReplayBoard
                    board={replayBoard}
                    boardSize={boardSize}
                    t={t}
                    lastPlayed={lastPlayedCell}
                    winCells={winCellsVisible}
                  />
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  aria-label="Previous move"
                  onClick={() => stepReplay(-1)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: `1px solid ${t.border}66`,
                    background: t.bgPanel,
                    color: t.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M15 6L9 12L15 18"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next move"
                  onClick={() => stepReplay(1)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    border: `1px solid ${t.border}66`,
                    background: t.bgPanel,
                    color: t.text,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M9 6L15 12L9 18"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 0,
                maxHeight: "min(70vh, 520px)",
                overflowY: "auto",
                paddingRight: 6,
              }}
              className="analyzer-move-scroll"
            >
              {result.move_annotations.map((m) => {
                const q = (m.quality || "good") as Quality;
                const qColor = QUALITY_COLORS[q] || t.textMuted;
                const engineDiffers =
                  !!m.engine_best &&
                  (m.engine_best[0] !== m.played[0] || m.engine_best[1] !== m.played[1]);
                const selected = replayMove === m.move_index;
                const dotColor = m.player === "P1" ? t.p1 : t.p2;
                const deltaStr =
                  m.score_delta >= 0 ? `+${fmtNum(m.score_delta)}` : fmtNum(m.score_delta);
                return (
                  <button
                    key={`${m.move_index}-${m.player}`}
                    type="button"
                    onClick={() => setReplayMove(m.move_index)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      boxSizing: "border-box",
                      width: "100%",
                      border: `1px solid ${selected ? t.accent : t.border}55`,
                      borderRadius: 10,
                      background: selected ? `${t.accent}18` : t.bgPanel,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: t.fontMono,
                            fontSize: 12,
                            color: t.textMuted,
                            width: 28,
                            flexShrink: 0,
                          }}
                        >
                          {m.move_index + 1}
                        </span>
                        <span
                          aria-hidden
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: dotColor,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: t.fontMono,
                            fontSize: 13,
                            fontWeight: 700,
                            color: t.text,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {cellNotation(m.played[0], m.played[1], boardSize)}
                        </span>
                        <span
                          style={{
                            color: qColor,
                            background: `${qColor}26`,
                            border: `1px solid ${qColor}55`,
                            borderRadius: 999,
                            padding: "3px 10px",
                            fontFamily: t.fontMono,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                        >
                          {q}
                        </span>
                      </div>
                      <span
                        style={{
                          fontFamily: t.fontMono,
                          fontSize: 11,
                          color: t.textMuted,
                          flexShrink: 0,
                        }}
                      >
                        {deltaStr}
                      </span>
                    </div>
                    {engineDiffers && m.engine_best ? (
                      <div
                        style={{
                          color: t.textMuted,
                          fontFamily: t.fontMono,
                          fontSize: 11,
                          paddingLeft: 38,
                        }}
                      >
                        → engine: {cellNotation(m.engine_best[0], m.engine_best[1], boardSize)}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


