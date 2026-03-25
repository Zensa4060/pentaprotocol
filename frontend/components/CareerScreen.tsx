"use client";
import { useState, useEffect } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";
import { loadCustomTheme } from "@/lib/customTheme";
import { BannerRenderer } from "./BannerRenderer";
import { RANKS, getRank, NavRankBadge, rankGlowVisualStrength, buildRankEmblemGlowFilter, rankHaloGradientForRank } from "./NavBar";



const RankBadge = ({ elo, size = 48 }: { elo: number; size?: number }) => {
  const rank = getRank(elo);
  return <NavRankBadge rank={rank as any} size={size} />;
};

// ── Match record type from API ────────────────────────────────────────────────
const CAREER_PATTERN_LABELS: Record<string, string> = {
  Y: "Y-SHAPE", L: "L-SHAPE", W: "W-SHAPE", V: "V-SHAPE", C: "C-SHAPE", zigzag: "ZIGZAG",
};

interface MatchRecord {
  opponent_username: string;
  opponent_elo: number;
  result: "win" | "loss" | "draw";
  elo_before: number;
  elo_after: number;
  elo_delta: number;
  mode: "ranked" | "unranked" | "custom";
  played_at: string;
  banned_pattern_7x7?: string;
  board_mode?: string;
  game_number?: number;
}

interface Props { themeId: ThemeId; onHoverAction?: () => void; }

export default function CareerScreen({ themeId, onHoverAction }: Props) {
  const t = THEMES[themeId as keyof typeof THEMES];
  const { user } = useAuthStore();
  const ip = themeId === "pixel";

  const elo = user?.elo ?? 100;
  const rank = getRank(elo);
  const scale = (rank as any).scale ?? 1;
  const badgeSize = 120;
  const imgSize = badgeSize * 0.85 * scale;

  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("/api/profile/career");
        if (!cancelled) setHistory(res.data);
      } catch (err) {
        console.error("Failed to load career data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute career stats from real data
  const wins = history.filter(m => m.result === "win").length;
  const losses = history.filter(m => m.result === "loss").length;
  const eloGained = history.filter(m => m.elo_delta > 0).reduce((s, m) => s + m.elo_delta, 0);
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0;

  const nextRank  = RANKS[Math.min(RANKS.indexOf(rank) + 1, RANKS.length - 1)];
  const isMaxRank = rank === nextRank;
  const eloToNext = isMaxRank ? 0 : nextRank.min - elo;
  const rankProgress = isMaxRank
    ? 100
    : Math.min(100, Math.round(((elo - rank.min) / (nextRank.min - rank.min)) * 100));

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const modeLabel = (mode: string) => {
    if (mode === "ranked") return "Ranked";
    if (mode === "custom") return "Custom";
    return "Unranked";
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2, background: themeId === "pixel" ? "url(/bg-pixel.png) center/cover no-repeat" : themeId === "space" ? "transparent" : t.bg,
      overflowY: "scroll",
      overflowX: "hidden",
      scrollBehavior: "smooth",
      WebkitOverflowScrolling: "touch",
      transition: "background 0.4s",
    } as React.CSSProperties}>
      <style>{`
        .career-row {
          transition: background 0.18s ease, transform 0.18s cubic-bezier(.22,.68,0,1.2);
          cursor: default;
        }
        .career-row:hover {
          background: rgba(255,255,255,0.035) !important;
          transform: translateX(4px);
        }

        /* Custom buttery smooth scrollbar */
        .career-scroll::-webkit-scrollbar { width: 5px; }
        .career-scroll::-webkit-scrollbar-track { background: transparent; }
        .career-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .career-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.22);
        }

        /* Momentum / smooth scroll for all browsers */
        * { scroll-behavior: smooth; }

        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .career-row-animated {
          animation: rowFadeIn 0.5s ease-out both;
        }
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "84px 24px 80px" }}>

        {/* ── TOP: Rank hero section ───────────────────────────────────────── */}
        <div style={{
          position: "relative",
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          padding: "60px 0 50px", gap: 16,
          borderRadius: ip ? 2 : 24,
          overflow: "hidden",
          border: `1px solid ${t.border}`,
          marginBottom: 32,
          boxShadow: `0 20px 50px rgba(0,0,0,0.3)`,
          boxSizing: "border-box",
        }}>
          {/* Banner background */}
          <div style={{ position: "absolute", inset: 0, opacity: 1.0, zIndex: 0 }}>
            <BannerRenderer bannerId={loadCustomTheme().bannerSkin ?? "default"} />
            
            {/* Glossy / Shiny Effect */}
            <div style={{
              position: "absolute",
              top: 0, left: "-150%",
              width: "200%", height: "100%",
              background: "linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 38%, rgba(255,255,255,0.2) 40%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 50%)",
              zIndex: 1,
              animation: "shineSweep 4s infinite linear",
            }} />
          </div>
          
          <style>{`
            @keyframes shineSweep {
              from { transform: translateX(-50%); }
              to { transform: translateX(100%); }
            }
          `}</style>
          
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {/* Big rank badge */}
          <div style={{
            width: badgeSize, height: badgeSize, borderRadius: "50%",
            background: "transparent", display: "flex", alignItems: "center",
            justifyContent: "center", overflow: "visible", position: "relative",
            boxShadow: "none",
            border: `1px solid ${rank.color}33`,
          }}>
            {rankGlowVisualStrength(rank) >= 0.0012 && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: "135%",
                  height: "135%",
                  borderRadius: "50%",
                  background: rankHaloGradientForRank(rank.color, rank),
                  pointerEvents: "none",
                  zIndex: 0,
                  animation: "rankHaloPulse 2.6s ease-in-out infinite",
                }}
              />
            )}
            <img
              src={rank.img}
              alt={rank.name}
              draggable={false}
              style={{
                width: imgSize,
                height: imgSize,
                objectFit: "contain",
                userSelect: "none",
                pointerEvents: "none",
                position: "relative",
                zIndex: 1,
                filter: buildRankEmblemGlowFilter(rank.color, rankGlowVisualStrength(rank)),
              }}
            />
          </div>

          {/* Rank name */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: t.fontMono, fontSize: 11, letterSpacing: "0.22em",
              color: rank.color, opacity: 0.8, marginBottom: 4,
            }}>CURRENT RANK</div>
            <div style={{
              fontFamily: t.fontDisplay, fontSize: ip ? 28 : 42, fontWeight: 800,
              color: rank.color, letterSpacing: "0.08em",
              textShadow: `0 0 30px ${rank.color}66`,
            }}>{rank.name}</div>
            <div style={{
              fontFamily: t.fontMono, fontSize: 22, fontWeight: 700,
              color: t.text, marginTop: 4,
            }}>{elo} <span style={{ fontSize: 12, color: t.textMuted, letterSpacing: "0.1em" }}>ELO</span></div>
          </div>

          {/* Progress to next rank */}
          {nextRank !== rank && (
            <div style={{ width: "100%", maxWidth: 340 }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontFamily: t.fontMono, fontSize: 10, color: t.textMuted,
                letterSpacing: "0.1em", marginBottom: 6,
              }}>
                <span>{rank.name}</span>
                <span style={{ color: nextRank.color }}>{nextRank.name} in {eloToNext} ELO</span>
              </div>
              <div style={{ height: 5, background: `${t.border}44`, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${rankProgress}%`,
                  background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
                  borderRadius: 3,
                  boxShadow: `0 0 8px ${rank.color}88`,
                  transition: "width 1s ease",
                }} />
              </div>
              <div style={{ textAlign: "center", fontFamily: t.fontMono, fontSize: 10, color: t.textMuted, marginTop: 4 }}>
                {rankProgress}% to {nextRank.name}
              </div>
            </div>
          )}
            {/* Stats row */}
          <div style={{
            display: "flex", gap: 0,
            background: t.bgCard, border: `1px solid ${t.border}`,
            borderRadius: ip ? 2 : 12, overflow: "hidden",
            marginTop: 4, width: "100%", maxWidth: 480,
          }}>
            {[
              { label: "WINS",     value: wins,              color: "#34D399" },
              { label: "LOSSES",   value: losses,            color: "#FF4444" },
              { label: "WIN RATE", value: `${winRate}%`,     color: t.accent  },
              { label: "ELO GAIN", value: `+${eloGained}`,  color: "#34D399" },
            ].map((s, i) => (
              <div key={s.label} style={{
                flex: 1, padding: "14px 8px", textAlign: "center",
                borderRight: i < 3 ? `1px solid ${t.border}` : "none",
              }}>
                <div style={{ fontFamily: t.fontMono, fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontFamily: t.fontMono, fontSize: 9, color: t.textMuted, letterSpacing: "0.12em", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

        {/* ── MATCH HISTORY ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, transparent, ${t.border})` }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <div style={{ fontFamily: t.fontDisplay, fontSize: 13, fontWeight: 900, color: t.text, letterSpacing: "0.25em", opacity: 0.9 }}>BATTLE ARCHIVE</div>
          </div>
          <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, ${t.border}, transparent)` }} />
        </div>

        <div style={{
          background: "rgba(25,25,25,0.4)", backdropFilter: "blur(24px)",
          border: `1px solid ${t.border}`, borderRadius: 20, overflow: "hidden",
          boxShadow: `0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,255,255,0.02)`,
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "100px 1fr 140px 100px 100px",
            padding: "16px 24px",
            background: "rgba(255,255,255,0.03)",
            borderBottom: `1px solid ${t.border}`,
            fontFamily: t.fontMono, fontSize: 10, letterSpacing: "0.2em", color: t.textMuted,
            fontWeight: 800,
          }}>
            <span>RESULT</span>
            <span>OPPONENT</span>
            <span>TYPE</span>
            <span style={{ textAlign: "center" }}>ELO Δ</span>
            <span style={{ textAlign: "right" }}>DATE</span>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{
              padding: "60px 20px", textAlign: "center",
              fontFamily: t.fontMono, fontSize: 13, color: t.textMuted,
              letterSpacing: "0.1em",
            }}>
              LOADING MATCH HISTORY...
            </div>
          )}

          {/* Empty state */}
          {!loading && history.length === 0 && (
            <div style={{
              padding: "80px 24px", textAlign: "center",
              background: "rgba(255,255,255,0.01)",
            }}>
              <div style={{ 
                width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.03)",
                margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${t.border}`
              }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{
                fontFamily: t.fontDisplay, fontSize: 18, fontWeight: 800,
                color: t.text, letterSpacing: "0.1em", marginBottom: 8,
              }}>NO BATTLES RECORDED</div>
              <div style={{
                fontFamily: t.fontMono, fontSize: 11, color: t.textMuted,
                opacity: 0.6, letterSpacing: "0.06em", maxWidth: 280, margin: "0 auto", lineHeight: 1.6
              }}>Play matches to begin documenting your legendary career archive</div>
            </div>
          )}

          {/* Rows */}
          {!loading && history.map((match, i) => {
            const oppRank = getRank(match.opponent_elo);
            const isWin = match.result === "win";
            const isDraw = match.result === "draw";
            const deltaColor = isWin ? "#34D399" : isDraw ? "#F59E0B" : "#FF4444";
            const resultLabel = isWin ? "VICTORY" : isDraw ? "DRAW" : "DEFEAT";
            const resultColor = isWin ? "#10B981" : isDraw ? "#F5960B" : "#EF4444";
            const rowDelay = (i * 0.05).toFixed(2) + "s";

            return (
              <div
                key={i}
                className="career-row career-row-animated"
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 140px 100px 100px",
                  padding: "16px 24px",
                  borderBottom: i < history.length - 1 ? `1px solid ${t.border}22` : "none",
                  alignItems: "center",
                  background: "transparent",
                  animationDelay: rowDelay,
                }}
              >
                {/* Result badge */}
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "4px 10px", borderRadius: 6,
                    background: `${resultColor}15`,
                    border: `1px solid ${resultColor}33`,
                    fontFamily: t.fontMono, fontSize: 10, fontWeight: 900,
                    color: resultColor,
                    letterSpacing: "0.08em",
                    boxShadow: `0 0 15px ${resultColor}22`,
                  }}>
                    {resultLabel}
                  </div>
                </div>

                {/* Opponent */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ 
                    width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.03)", 
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${oppRank.color}33`, boxShadow: `0 0 10px ${oppRank.color}11`
                  }}>
                    <RankBadge elo={match.opponent_elo} size={24} />
                  </div>
                  <div>
                    <div style={{
                      fontFamily: t.fontDisplay, fontSize: 16, fontWeight: 800,
                      color: t.text, letterSpacing: "0.03em",
                    }}>{match.opponent_username}</div>
                    <div style={{
                      fontFamily: t.fontMono, fontSize: 9,
                      color: oppRank.color, letterSpacing: "0.1em", fontWeight: 700,
                      opacity: 0.9
                    }}>{oppRank.name.toUpperCase()} · {match.opponent_elo}</div>
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <div style={{ 
                    fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, 
                    letterSpacing: "0.08em", fontWeight: 600, opacity: 0.8 
                  }}>
                    {modeLabel(match.mode).toUpperCase()}
                  </div>
                  {match.banned_pattern_7x7 ? (
                    <div style={{
                      fontFamily: t.fontMono, fontSize: 9, color: "#EF4444",
                      letterSpacing: "0.06em", fontWeight: 700, marginTop: 6, lineHeight: 1.35, maxWidth: 140,
                    }}>
                      7×7 BAN:{" "}
                      {CAREER_PATTERN_LABELS[match.banned_pattern_7x7] ?? match.banned_pattern_7x7.toUpperCase()}
                    </div>
                  ) : null}
                </div>

                {/* ELO delta */}
                <div style={{ textAlign: "center" }}>
                  <span style={{
                    fontFamily: t.fontMono, fontSize: 16, fontWeight: 900,
                    color: deltaColor,
                    textShadow: `0 0 12px ${deltaColor}77`,
                  }}>
                    {match.elo_delta > 0 ? "+" : ""}{match.elo_delta}
                  </span>
                </div>

                {/* Date */}
                <div style={{
                  fontFamily: t.fontMono, fontSize: 10, color: t.textMuted,
                  textAlign: "right", letterSpacing: "0.05em", fontWeight: 500
                }}>
                  {formatDate(match.played_at).toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        {!loading && history.length > 0 && (
          <div style={{
            textAlign: "center", marginTop: 16,
            fontFamily: t.fontMono, fontSize: 10,
            color: t.textMuted, letterSpacing: "0.1em",
          }}>
            SHOWING LAST {history.length} MATCH{history.length !== 1 ? "ES" : ""}
          </div>
        )}

      </div>
    </div>
  );
}