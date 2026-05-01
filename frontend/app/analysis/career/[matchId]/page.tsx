"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import GameAnalyzer, { type AnalyzerMove } from "@/components/GameAnalyzer";
import { THEMES, type ThemeId } from "@/lib/themes";
import API from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { DEFAULT_PATTERNS_5, DEFAULT_PATTERNS_6, DEFAULT_PATTERNS_7 } from "@/lib/patterns_metadata";

interface MatchRound {
  winner: string;
  board: (string | null)[][];
  moves: { row: number; col: number; player: string; ext?: number }[];
  board_mode?: string;
  game_number?: number;
}

interface CareerMatchPayload {
  id?: string;
  opponent_username: string;
  result: string;
  played_at: string;
  mode: string;
  my_slot?: "P1" | "P2";
  match_rounds?: MatchRound[];
}

function boardSizeFromRound(round: MatchRound): 5 | 6 | 7 {
  const bm = String(round.board_mode || "").toLowerCase();
  if (bm.includes("7x7")) return 7;
  if (bm.includes("6x6")) return 6;
  const n = Array.isArray(round.board) ? round.board.length : 0;
  if (n === 7 || n === 6 || n === 5) return n as 5 | 6 | 7;
  return 5;
}

function defaultPatternsForSize(sz: 5 | 6 | 7): string[] {
  if (sz === 7) return [...DEFAULT_PATTERNS_7];
  if (sz === 6) return [...DEFAULT_PATTERNS_6];
  return [...DEFAULT_PATTERNS_5];
}

function normalizeCareerMoves(moves: MatchRound["moves"]): AnalyzerMove[] {
  if (!Array.isArray(moves)) return [];
  const out: AnalyzerMove[] = [];
  for (const m of moves) {
    if (!m || typeof m.row !== "number" || typeof m.col !== "number") continue;
    const p = String(m.player || "").toUpperCase();
    if (p !== "P1" && p !== "P2") continue;
    out.push({ row: m.row, col: m.col, player: p });
  }
  return out;
}

function CareerAnalysisPageInner() {
  const router = useRouter();
  const params = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const matchId = decodeURIComponent(String(params?.matchId ?? ""));
  const gameQ = searchParams.get("game");
  const parsedGame = gameQ != null && gameQ !== "" ? Number.parseInt(gameQ, 10) : NaN;

  const { themeId: ctxThemeId } = useApp();
  const user = useAuthStore((s) => s.user);
  const themeId = (ctxThemeId || "space") as ThemeId;
  const t = THEMES[themeId as keyof typeof THEMES];

  const [match, setMatch] = useState<CareerMatchPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

  const load = useCallback(async () => {
    if (!matchId) {
      setLoadError("Missing match id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await API.get<CareerMatchPayload>(`/api/profile/career-match/${encodeURIComponent(matchId)}`);
      setMatch(res.data);
    } catch {
      setLoadError("Could not load this career match. It may have been removed or you may not have access.");
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const analysisRounds = useMemo(() => {
    const rounds = Array.isArray(match?.match_rounds) ? match!.match_rounds! : [];
    return rounds
      .map((r, idx) => ({ ...r, _idx: idx }))
      .filter((r) => normalizeCareerMoves(r.moves).length >= 2);
  }, [match]);

  useEffect(() => {
    if (analysisRounds.length === 0) return;
    if (Number.isFinite(parsedGame) && parsedGame >= 1) {
      const idx = analysisRounds.findIndex(
        (r) => Number(r.game_number) === parsedGame,
      );
      if (idx >= 0) {
        setActiveRoundIdx(idx);
        return;
      }
    }
    setActiveRoundIdx(0);
  }, [analysisRounds, parsedGame]);

  const selectedRound = analysisRounds.length > 0
    ? analysisRounds[Math.min(activeRoundIdx, analysisRounds.length - 1)]
    : null;

  const boardSize = selectedRound ? boardSizeFromRound(selectedRound) : 5;
  const moveHistory = selectedRound ? normalizeCareerMoves(selectedRound.moves) : [];
  const me = String(user?.username || "You").trim() || "You";
  const opp = String(match?.opponent_username || "Opponent").trim() || "Opponent";
  const p1Label = match?.my_slot === "P2" ? opp : me;
  const p2Label = match?.my_slot === "P2" ? me : opp;

  const patterns = useMemo(() => defaultPatternsForSize(boardSize as 5 | 6 | 7), [boardSize]);

  return (
    <AuthGuard>
      <div
        style={{
          minHeight: "100vh",
          background: t.bg,
          color: t.text,
          padding: "24px 24px 64px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ width: "min(1100px, 100%)", display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 12,
                  letterSpacing: "0.24em",
                  color: t.textMuted,
                  textTransform: "uppercase",
                }}
              >
                Career · Game analysis
              </div>
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  color: t.text,
                }}
              >
                vs {String(match?.opponent_username || "—").toUpperCase()}
              </div>
              {selectedRound && (
                <div style={{ fontFamily: t.fontMono, fontSize: 12, color: t.textSecondary, letterSpacing: "0.05em" }}>
                  Game {selectedRound.game_number ?? "—"} · {boardSize}×{boardSize} · {moveHistory.length} moves
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/career")}
              style={{
                background: "transparent",
                border: `1px solid ${t.border}`,
                color: t.textSecondary,
                fontFamily: t.fontMono,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                padding: "10px 18px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              ← BACK TO CAREER
            </button>
          </div>

          {loading && (
            <div style={{ fontFamily: t.fontMono, fontSize: 13, color: t.textMuted }}>
              Loading match…
            </div>
          )}

          {!loading && loadError && (
            <div
              style={{
                border: `1px solid ${t.border}`,
                background: t.bgPanel,
                borderRadius: 12,
                padding: "24px 20px",
                fontFamily: t.fontMono,
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.6,
              }}
            >
              {loadError}
            </div>
          )}

          {!loading && !loadError && match && analysisRounds.length === 0 && (
            <div
              style={{
                border: `1px solid ${t.border}`,
                background: t.bgPanel,
                borderRadius: 12,
                padding: "24px 20px",
                fontFamily: t.fontMono,
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.6,
              }}
            >
              This career entry does not include a move log for analysis (older matches may only store
              results). Try another round or a more recent match.
            </div>
          )}

          {!loading && !loadError && match && analysisRounds.length > 0 && (
            <>
              {analysisRounds.length > 1 && (
                <div
                  style={{
                    border: `1px solid ${t.border}`,
                    background: t.bgPanel,
                    borderRadius: 10,
                    padding: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.fontMono,
                      fontSize: 11,
                      color: t.textMuted,
                      letterSpacing: "0.12em",
                      marginRight: 8,
                    }}
                  >
                    SELECT ROUND
                  </div>
                  {analysisRounds.map((r, i) => {
                    const active = i === activeRoundIdx;
                    const sz = boardSizeFromRound(r);
                    return (
                      <button
                        key={`${r.game_number}-${i}`}
                        type="button"
                        onClick={() => setActiveRoundIdx(i)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${active ? t.accent : t.border}`,
                          background: active ? `${t.accent}22` : "transparent",
                          color: active ? t.accent : t.textSecondary,
                          fontFamily: t.fontMono,
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          cursor: "pointer",
                        }}
                      >
                        G{r.game_number ?? i + 1} · {sz}×{sz}
                      </button>
                    );
                  })}
                </div>
              )}
              <GameAnalyzer
                boardSize={boardSize as 5 | 6 | 7}
                selectedPatterns={patterns}
                moveHistory={moveHistory}
                isGameOver={true}
                t={t}
                p1Label={p1Label}
                p2Label={p2Label}
              />
            </>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

export default function CareerAnalysisPage() {
  return (
    <Suspense fallback={null}>
      <CareerAnalysisPageInner />
    </Suspense>
  );
}
