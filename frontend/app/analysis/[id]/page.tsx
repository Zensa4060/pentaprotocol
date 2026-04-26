"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { useApp } from "@/components/AppShell";
import GameAnalyzer, { type AnalyzerMove } from "@/components/GameAnalyzer";
import { THEMES, type ThemeId } from "@/lib/themes";

interface AnalysisPayload {
  boardSize: 5 | 6 | 7;
  selectedPatterns: string[];
  moveHistory: AnalyzerMove[];
  p1Label: string;
  p2Label: string;
  themeId?: ThemeId;
}

const PAYLOAD_PREFIX = "pp_analysis_";

function readPayload(id: string): AnalysisPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${PAYLOAD_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalysisPayload;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.moveHistory) ||
      !Array.isArray(parsed.selectedPatterns) ||
      (parsed.boardSize !== 5 && parsed.boardSize !== 6 && parsed.boardSize !== 7)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function AnalysisPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const { themeId: ctxThemeId } = useApp();
  const [payload, setPayload] = useState<AnalysisPayload | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPayload(readPayload(id));
    setHydrated(true);
  }, [id]);

  const themeId: ThemeId = (payload?.themeId as ThemeId) || ctxThemeId;
  const t = THEMES[themeId as keyof typeof THEMES];

  const moveCount = useMemo(
    () => (payload?.moveHistory?.length ?? 0),
    [payload],
  );

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
        <div
          style={{
            width: "min(1100px, 100%)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
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
                Game Analysis
              </div>
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 28,
                  fontWeight: 900,
                  letterSpacing: "0.06em",
                  color: t.text,
                }}
              >
                Match #{id}
              </div>
              {payload && (
                <div
                  style={{
                    fontFamily: t.fontMono,
                    fontSize: 12,
                    color: t.textSecondary,
                    letterSpacing: "0.05em",
                  }}
                >
                  {payload.boardSize}×{payload.boardSize} · {moveCount} moves ·{" "}
                  {payload.p1Label} vs {payload.p2Label}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/home")}
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
              ← BACK TO HOME
            </button>
          </div>

          {hydrated && !payload && (
            <div
              style={{
                border: `1px solid ${t.border}`,
                background: t.bgPanel,
                borderRadius: 12,
                padding: "32px 24px",
                fontFamily: t.fontMono,
                fontSize: 13,
                color: t.textSecondary,
                lineHeight: 1.6,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: t.fontDisplay,
                  fontSize: 18,
                  fontWeight: 800,
                  color: t.text,
                  marginBottom: 8,
                  letterSpacing: "0.06em",
                }}
              >
                NO ANALYSIS DATA
              </div>
              <div>
                We could not find an analysis snapshot for this match. Analyses
                are only available immediately after the match ends, from the
                same browser tab.
              </div>
            </div>
          )}

          {payload && (
            <GameAnalyzer
              boardSize={payload.boardSize}
              selectedPatterns={payload.selectedPatterns}
              moveHistory={payload.moveHistory}
              isGameOver={true}
              t={t}
              p1Label={payload.p1Label}
              p2Label={payload.p2Label}
            />
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
