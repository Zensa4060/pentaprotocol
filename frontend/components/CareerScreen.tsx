"use client";
import { useState, useEffect } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { useAuthStore } from "@/lib/store";
import API from "@/lib/api";

// ── Rank definitions (mirrors ProfileScreen exactly) ─────────────────────────
const RANKS = [
  { name: "NOVICE",       min: 0,    max: 500,  color: "#9CA3AF", img: "/novice.svg",       scale: 1.3   },
  { name: "ADVANCED",     min: 500,  max: 1000, color: "#60A5FA", img: "/advanced.svg",     scale: 1.3   },
  { name: "PROFESSIONAL", min: 1000, max: 1500, color: "#34D399", img: "/professional.svg", scale: 1.3   },
  { name: "EMERALD",      min: 1500, max: 2000, color: "#10B981", img: "/emerald.svg",      scale: 1.495 },
  { name: "MASTER",       min: 2000, max: 2500, color: "#FF3333", img: "/master.png"                     },
  { name: "LEGEND",       min: 2500, max: 9999, color: "#F59E0B", img: "/legend.png"                     },
];
const getRank = (elo: number) => RANKS.find(r => elo >= r.min && elo < r.max) || RANKS[0];

const RankBadge = ({ elo, size = 48 }: { elo: number; size?: number }) => {
  const rank = getRank(elo);
  const scale = (rank as any).scale ?? 1;
  const imgSize = size * 0.85 * scale;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "#000", display: "flex", alignItems: "center",
      justifyContent: "center", overflow: "hidden", flexShrink: 0,
      boxShadow: `0 0 14px ${rank.color}55`,
    }}>
      <img src={rank.img} alt={rank.name} style={{ width: imgSize, height: imgSize, objectFit: "contain" }} />
    </div>
  );
};

// ── Match record type from API ────────────────────────────────────────────────
interface MatchRecord {
  opponent_username: string;
  opponent_elo: number;
  result: "win" | "loss" | "draw";
  elo_before: number;
  elo_after: number;
  elo_delta: number;
  mode: "ranked" | "unranked" | "custom";
  played_at: string;
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
  const eloToNext = nextRank !== rank ? nextRank.min - elo : 0;
  const rankProgress = nextRank !== rank
    ? Math.min(100, Math.round(((elo - rank.min) / (nextRank.min - rank.min)) * 100))
    : 100;

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
      position: "fixed", inset: 0, zIndex: 2, background: t.bg,
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
      `}</style>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "84px 24px 80px" }}>

        {/* ── TOP: Rank hero section ───────────────────────────────────────── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "40px 0 36px", gap: 16,
        }}>
          {/* Big rank badge */}
          <div style={{
            width: badgeSize, height: badgeSize, borderRadius: "50%",
            background: "#000", display: "flex", alignItems: "center",
            justifyContent: "center", overflow: "hidden",
            boxShadow: `0 0 40px ${rank.color}55, 0 0 80px ${rank.color}22`,
            border: `2px solid ${rank.color}44`,
          }}>
            <img src={rank.img} alt={rank.name}
              style={{ width: imgSize, height: imgSize, objectFit: "contain" }} />
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

        {/* ── MATCH HISTORY ─────────────────────────────────────────────────── */}
        <div style={{
          background: t.bgCard, border: `1px solid ${t.border}`,
          borderRadius: ip ? 2 : 14, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "56px 1fr 140px 80px 80px",
            padding: "10px 20px",
            background: `${t.border}18`,
            borderBottom: `1px solid ${t.border}`,
            fontFamily: t.fontMono, fontSize: 10, letterSpacing: "0.14em", color: t.textMuted,
          }}>
            <span>RESULT</span>
            <span>OPPONENT</span>
            <span>MODE</span>
            <span style={{ textAlign: "center" }}>ELO</span>
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
              padding: "60px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}></div>
              <div style={{
                fontFamily: t.fontDisplay, fontSize: ip ? 14 : 18, fontWeight: 700,
                color: t.textMuted, letterSpacing: "0.08em", marginBottom: 8,
              }}>NO MATCHES YET</div>
              <div style={{
                fontFamily: t.fontMono, fontSize: 11, color: t.textMuted,
                opacity: 0.6, letterSpacing: "0.06em",
              }}>Play multiplayer matches to build your career history</div>
            </div>
          )}

          {/* Rows */}
          {!loading && history.map((match, i) => {
            const oppRank = getRank(match.opponent_elo);
            const isWin = match.result === "win";
            const isDraw = match.result === "draw";
            const deltaColor = isWin ? "#34D399" : isDraw ? "#F59E0B" : "#FF4444";
            const resultLabel = isWin ? "WIN" : isDraw ? "DRAW" : "LOSS";
            const resultBg = isWin ? "#34D39922" : isDraw ? "#F59E0B22" : "#FF444422";
            const resultBorder = isWin ? "#34D39966" : isDraw ? "#F59E0B66" : "#FF444466";

            return (
              <div
                key={i}
                className="career-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr 140px 80px 80px",
                  padding: "13px 20px",
                  borderBottom: i < history.length - 1 ? `1px solid ${t.border}22` : "none",
                  alignItems: "center",
                  background: "transparent",
                }}
              >
                {/* Result badge */}
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: isDraw ? 44 : 36, height: 22, borderRadius: 4,
                    background: resultBg,
                    border: `1px solid ${resultBorder}`,
                    fontFamily: t.fontMono, fontSize: 11, fontWeight: 800,
                    color: deltaColor,
                    letterSpacing: "0.06em",
                  }}>
                    {resultLabel}
                  </div>
                </div>

                {/* Opponent */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <RankBadge elo={match.opponent_elo} size={30} />
                  <div>
                    <div style={{
                      fontFamily: t.fontBody, fontSize: 14, fontWeight: 600,
                      color: t.text, letterSpacing: "0.02em",
                    }}>{match.opponent_username}</div>
                    <div style={{
                      fontFamily: t.fontMono, fontSize: 10,
                      color: oppRank.color, letterSpacing: "0.08em",
                    }}>{oppRank.name} · {match.opponent_elo}</div>
                  </div>
                </div>

                {/* Mode */}
                <div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.06em" }}>
                    {modeLabel(match.mode)}
                  </div>
                </div>

                {/* ELO delta */}
                <div style={{ textAlign: "center" }}>
                  <span style={{
                    fontFamily: t.fontMono, fontSize: 15, fontWeight: 800,
                    color: deltaColor,
                    textShadow: `0 0 8px ${deltaColor}66`,
                  }}>
                    {match.elo_delta > 0 ? "+" : ""}{match.elo_delta}
                  </span>
                </div>

                {/* Date */}
                <div style={{
                  fontFamily: t.fontMono, fontSize: 10, color: t.textMuted,
                  textAlign: "right", letterSpacing: "0.04em",
                }}>
                  {formatDate(match.played_at)}
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