"use client";
import React, { useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import PatternDiagram from "./PatternDiagram";
import {
  PATTERN_METADATA_5,
  PATTERN_METADATA_6,
  PATTERN_METADATA_7,
  type PatternInfo,
} from "@/lib/patterns_metadata";

interface Props {
  themeId: ThemeId;
  onHoverAction?: () => void;
  onClickAction?: () => void;
}

interface Rule {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  detail: string;
  screenshot: string | null;
  screenshotCaption?: string;
  screenshots?: { src: string; caption?: string }[];
  /** Rendered below `detail` (e.g. pattern grids). */
  extra?: React.ReactNode;
}

function WinPatternsBlock({
  accent,
  textMuted,
  fontMono,
  ip,
}: {
  accent: string;
  textMuted: string;
  fontMono: string;
  ip: boolean;
}) {
  const cellSize = ip ? 10 : 12;
  const group = (label: string, meta: Record<string, PatternInfo>) => (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: fontMono,
          fontSize: 11,
          letterSpacing: "0.14em",
          color: textMuted,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {Object.values(meta).map((p) => (
          <div key={p.id} style={{ maxWidth: 220 }}>
            <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, color: accent, marginBottom: 6 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 8, lineHeight: 1.45 }}>{p.desc}</div>
            <PatternDiagram info={p} accent={accent} cellSize={cellSize} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: 8 }}>
      {group("5×5 — shape patterns", PATTERN_METADATA_5)}
      {group("6×6 — shape patterns", PATTERN_METADATA_6)}
      {group("7×7 — structural patterns", PATTERN_METADATA_7)}
    </div>
  );
}

const RULES_BASE: Omit<Rule, "extra">[] = [
  {
    id: "centre",
    emoji: "",
    title: "CENTRE RULE (C3)",
    summary: "Playing on C3 on the very first move gives your opponent 2 extra turns.",
    detail: `The centre cell (column C, row 3) is a powerful strategic position. To balance this advantage, if you place your very first piece of the game on C3, your opponent immediately receives 2 consecutive extra turns.\n\nThis rule only applies to the first move of each game. After the first move, C3 can be occupied freely without any penalty.\n\nIn the Rulebreaker phase before Game 3, the toss winner may choose to block C3 entirely — preventing anyone from playing there on the first move.`,
    screenshot: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1CQ6sbHUrl_Cu13cmPo6BlZ3T0IQjYrf6",
    screenshotCaption: "P1 opened on C3 — P2 immediately gets 2 extra turns (moves 2 and 3 both by P2)",
  },
  {
    id: "win-conditions",
    emoji: "",
    title: "WIN CONDITIONS",
    summary:
      "Lines, structural patterns, or full-board chain resolution — requirements scale with board size (5×5, 6×6, 7×7).",
    detail: `Lines\nPlace a continuous straight line of your pieces with no gaps — the required length matches the grid: 5 on a 5×5 board, 6 on 6×6, 7 on 7×7. Directions: horizontal, vertical, and both diagonals.\n\nStructural patterns\nEach board size has its own mandatory or selectable shape wins (see diagrams below). All rotations and reflections count unless a mode specifies otherwise.\n\nFull board (no prior win)\nWhen every cell is filled, the game resolves by longest connected chain (pieces adjacent horizontally, vertically, or diagonally): at least 10 on 5×5, 15 on 6×6, 20 on 7×7. If only one player reaches their threshold, that player wins; if both or neither do, the result is a draw as appropriate.`,
    screenshot: null,
    screenshotCaption: "Example line wins",
    screenshots: [
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1spemezZ3gcELGbHcQROvdoGzAGdDJhbo", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1HfqhyZRgU5BwDneeMggblksI9w4_0_On", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1BeY0og5DBs2i2CTEG_rxCyI9QcWhFcuP", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1fu3aNx4dkgKGrU3sJDcMTIsDhfnFYboS", caption: "" },
    ],
  },
  {
    id: "rulebreaker",
    emoji: "",
    title: "RULEBREAKER",
    summary: "If a game ends in a DRAW and the overall match points are tied, a tiebreaker mini-game occurs.",
    detail: `If game 9 ends in a DRAW and the match is still tied, the Limitbreaker phase begins.\n\nA coin is flipped — the toss winner chooses one of two tracks:\n\n1. CHOOSE WHO PLAYS FIRST — the toss winner decides who starts game 10, then the other player bans the first board and the toss winner bans the second.\n\n2. BAN A BOARD FIRST — the toss winner bans the first board, then the other player decides who starts game 10 and also bans the second board.\n\nThe only remaining board size is used for the final deciding game.`,
    screenshot: null,
    screenshotCaption: "Rulebreaker coin toss and choice screens",
    screenshots: [
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1ruG7o40ffMD6mQL5MrbQ1I8E7OLRmzs6", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1d13MnJIlZ1Ck9hi58A25-r9-fcpO6b-M", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1fQO_jm0XiOnJuEiQNLdrcMDTC9Fh6Y-L", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1BptPliDW0t-Xr6XcZmiGNScRY-CpPILd", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1hWHJWYh_E1YtoF3dwtBeO2np1U496rOr", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1rOGVSql0QvlzNjTV2ozVTYLGQjO3H-in", caption: "" },
      { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1zp0kUPrtYCHF0BBq0oCHZjwPGshU2tTz", caption: "" },
    ],
  },
];

export default function RulesScreen({ themeId, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const [openId, setOpenId] = useState<string | null>(null);

  const rules: Rule[] = RULES_BASE.map((r) =>
    r.id === "win-conditions"
      ? {
          ...r,
          extra: (
            <WinPatternsBlock accent={t.accent} textMuted={t.textMuted} fontMono={t.fontMono} ip={ip} />
          ),
        }
      : r
  );

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "84px 24px 64px",
        background: t.bg,
        transition: "background 0.4s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        zIndex: 2,
      }}
    >
      <div style={{ maxWidth: 820, width: "100%" }}>
        <h1
          style={{
            fontFamily: t.fontDisplay,
            fontSize: ip ? 22 : 36,
            fontWeight: 700,
            color: t.accent,
            marginBottom: 8,
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          How to Play
        </h1>
        <p
          style={{
            fontFamily: t.fontBody,
            fontSize: 15,
            color: t.textMuted,
            textAlign: "center",
            marginBottom: 40,
            letterSpacing: "0.08em",
          }}
        >
          PENTAPROTOCOL · RULES & PATTERNS
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map((rule) => {
            const isOpen = openId === rule.id;
            const panelMax = rule.id === "win-conditions" ? "min(88vh, 2800px)" : "520px";
            return (
              <div
                key={rule.id}
                style={{
                  background: themeId === "space" ? "rgba(8,20,60,0.82)" : t.bgPanel,
                  border: `${ip ? 2 : 1}px solid ${isOpen ? t.accent : t.border}`,
                  backdropFilter: themeId === "space" ? "blur(12px)" : undefined,
                  WebkitBackdropFilter: themeId === "space" ? "blur(12px)" : undefined,
                  borderRadius: ip ? 2 : 14,
                  overflow: "hidden",
                  transition: "border-color 0.22s",
                }}
              >
                <button
                  onClick={() => {
                    onClickAction?.();
                    toggle(rule.id);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "20px 24px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.18s",
                  }}
                  className="rule-row-btn"
                  onMouseEnter={(e) => {
                    onHoverAction?.();
                    (e.currentTarget as HTMLElement).style.background = `${t.accent}0E`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {rule.emoji && <span style={{ fontSize: ip ? 22 : 28, flexShrink: 0 }}>{rule.emoji}</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: t.fontDisplay,
                        fontSize: ip ? 13 : 18,
                        fontWeight: 700,
                        color: isOpen ? t.accent : t.text,
                        transition: "color 0.18s",
                        marginBottom: 3,
                      }}
                    >
                      {rule.title}
                    </div>
                    <div style={{ fontFamily: t.fontBody, fontSize: ip ? 11 : 14, color: t.textMuted, lineHeight: 1.5 }}>{rule.summary}</div>
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      fontSize: 16,
                      color: isOpen ? t.accent : t.textMuted,
                      transition: "transform 0.22s, color 0.18s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    ▼
                  </div>
                </button>

                <div
                  style={{
                    maxHeight: isOpen ? panelMax : "0px",
                    overflow: "hidden",
                    transition: "max-height 0.38s cubic-bezier(.4,0,.2,1)",
                  }}
                >
                  <div
                    style={{
                      padding: "0 24px 26px 68px",
                      borderTop: `1px solid ${t.border}22`,
                      maxHeight: panelMax,
                      overflowY: "auto",
                      scrollbarWidth: "thin",
                      scrollbarColor: `${t.border} transparent`,
                    }}
                  >
                    <div
                      style={{
                        paddingTop: 18,
                        fontFamily: t.fontBody,
                        fontSize: ip ? 12 : 15,
                        color: t.textSecondary,
                        lineHeight: 1.85,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {rule.detail}
                    </div>

                    {rule.extra}

                    <div style={{ marginTop: 22 }}>
                      {rule.screenshots && rule.screenshots.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          <div style={{ fontFamily: t.fontMono, fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.12em" }}>
                            EXAMPLE SCREENSHOTS — {rule.screenshots.length} POSITIONS
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {rule.screenshots.map((s, i) => (
                              <div
                                key={i}
                                style={{
                                  borderRadius: ip ? 2 : 10,
                                  overflow: "hidden",
                                  border: `1px solid ${t.borderAccent}`,
                                  background: t.bgCard,
                                }}
                              >
                                <img
                                  src={s.src}
                                  alt={s.caption ?? `Example ${i + 1}`}
                                  style={{ width: "100%", display: "block" }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                                {s.caption && (
                                  <div
                                    style={{
                                      padding: "10px 16px",
                                      fontFamily: t.fontMono,
                                      fontSize: ip ? 10 : 12,
                                      color: t.textSecondary,
                                      letterSpacing: "0.07em",
                                      borderTop: `1px solid ${t.border}`,
                                      background: t.bgPanel,
                                    }}
                                  >
                                    <span style={{ color: t.accent, marginRight: 8 }}>{i + 1}.</span>
                                    {s.caption}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : rule.screenshot ? (
                        <div style={{ borderRadius: ip ? 2 : 10, overflow: "hidden", border: `1px solid ${t.border}` }}>
                          <img src={rule.screenshot} alt={rule.screenshotCaption ?? rule.title} style={{ width: "100%", display: "block" }} />
                          {rule.screenshotCaption && (
                            <div
                              style={{
                                padding: "8px 14px",
                                background: t.bgCard,
                                fontFamily: t.fontMono,
                                fontSize: 11,
                                color: t.textMuted,
                                letterSpacing: "0.08em",
                              }}
                            >
                              {rule.screenshotCaption}
                            </div>
                          )}
                        </div>
                      ) : !rule.screenshots?.length && !rule.extra ? (
                        <div
                          style={{
                            border: `1px dashed ${t.border}`,
                            borderRadius: ip ? 2 : 8,
                            padding: "18px 20px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            background: `${t.accent}06`,
                          }}
                        >
                          <span style={{ fontSize: 20, opacity: 0.4 }}>🖼</span>
                          <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>
                            SCREENSHOT COMING SOON — {rule.screenshotCaption?.toUpperCase()}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 36, fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>
          CLICK ANY RULE TO EXPAND · SCREENSHOTS UPLOAD PROGRESSIVELY
        </div>
      </div>
    </div>
  );
}
