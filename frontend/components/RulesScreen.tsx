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
import {
  formatRuleshowBlocks,
  RULESHOW_BLOCKS_6X6,
  RULESHOW_BLOCKS_7X7,
  RULESHOW_BLOCKS_PROTOCOLBREAKER,
} from "@/lib/ruleshowNarrative";

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

/** Generic mini-board: cells in `filled` use accent; optional `ring` cells get a highlight ring (e.g. centre C3). */
function MiniBoardGrid({
  size,
  filled,
  ring,
  accent,
  muted,
  cellSize,
  gap = 2,
}: {
  size: number;
  filled: Set<string>;
  ring?: Set<string>;
  accent: string;
  muted: string;
  cellSize: number;
  gap?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
        gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
        gap,
      }}
    >
      {Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
          const key = `${r},${c}`;
          const on = filled.has(key);
          const isRing = ring?.has(key);
          return (
            <div
              key={key}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                background: on ? accent : "rgba(255,255,255,0.04)",
                border: isRing
                  ? `2px solid ${accent}`
                  : on
                    ? `1px solid ${accent}`
                    : `1px solid ${muted}33`,
                boxShadow: isRing ? `0 0 10px ${accent}44` : undefined,
              }}
            />
          );
        })
      )}
    </div>
  );
}

function CentreC3Illustration({ accent, textMuted, fontMono, ip }: { accent: string; textMuted: string; fontMono: string; ip: boolean }) {
  const n = 5;
  const cell = ip ? 14 : 18;
  const centre = new Set<string>([`${Math.floor(n / 2)},${Math.floor(n / 2)}`]);
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.12em", color: textMuted, marginBottom: 10 }}>
        5×5 · FIRST MOVE ON C3 (CENTRE)
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <MiniBoardGrid size={n} filled={centre} ring={centre} accent={accent} muted={textMuted} cellSize={cell} />
        <div style={{ fontFamily: fontMono, fontSize: 11, color: textMuted, maxWidth: 260, lineHeight: 1.55 }}>
          Highlighted cell = C3. Landing your first stone here gives your opponent two consecutive extra turns (5×5 only).
        </div>
      </div>
    </div>
  );
}

function LineWinStrip({ accent, textMuted, fontMono, ip }: { accent: string; textMuted: string; fontMono: string; ip: boolean }) {
  const cell = ip ? 9 : 11;
  const rows: { label: string; n: number; lineR: number }[] = [
    { label: "5 in a row", n: 5, lineR: 2 },
    { label: "6 in a row", n: 6, lineR: 3 },
    { label: "7 in a row", n: 7, lineR: 3 },
  ];
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.12em", color: textMuted, marginBottom: 12 }}>
        LINE WINS · LENGTH MATCHES GRID
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-end" }}>
        {rows.map(({ label, n, lineR }) => {
          const filled = new Set<string>();
          for (let c = 0; c < n; c++) filled.add(`${lineR},${c}`);
          return (
            <div key={label}>
              <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, color: accent, marginBottom: 6 }}>{label}</div>
              <MiniBoardGrid size={n} filled={filled} accent={accent} muted={textMuted} cellSize={cell} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Rulebreaker5Illustration({ accent, gold, textMuted, fontMono, ip }: { accent: string; gold: string; textMuted: string; fontMono: string; ip: boolean }) {
  const box = (title: string, body: string) => (
    <div
      style={{
        flex: "1 1 200px",
        border: `1px solid ${accent}44`,
        borderRadius: ip ? 2 : 10,
        padding: "14px 16px",
        background: `${accent}08`,
      }}
    >
      <div style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, color: gold, letterSpacing: "0.14em", marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: fontMono, fontSize: 10, color: textMuted, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: `2px solid ${gold}`,
            background: `linear-gradient(135deg, ${gold}33, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontMono,
            fontSize: 10,
            fontWeight: 800,
            color: gold,
            letterSpacing: "0.08em",
          }}
        >
          COIN
        </div>
        <div style={{ fontFamily: fontMono, fontSize: 11, color: textMuted, letterSpacing: "0.1em", maxWidth: 320 }}>
          Toss winner picks a track before the next 5×5 game (when Rulebreaker runs).
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {box("WHO STARTS / C3", "Choose opening priority or block centre for move one — follow in-game prompts.")}
        {box("PATTERN BANS (7×7 LEG)", "When scheduled, ban paths affect structural patterns — see 7×7 section.")}
      </div>
    </div>
  );
}

function SingleSizePatternGroup({
  label,
  meta,
  accent,
  textMuted,
  fontMono,
  ip,
}: {
  label: string;
  meta: Record<string, PatternInfo>;
  accent: string;
  textMuted: string;
  fontMono: string;
  ip: boolean;
}) {
  const cellSize = ip ? 10 : 12;
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.14em", color: textMuted, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        {Object.values(meta).map((p) => (
          <div key={p.id} style={{ maxWidth: 220 }}>
            <div style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700, color: accent, marginBottom: 6 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 8, lineHeight: 1.45 }}>{p.desc}</div>
            <PatternDiagram info={p} accent={accent} isSelected={false} cellSize={cellSize} />
          </div>
        ))}
      </div>
    </div>
  );
}

function G10LimitbreakerIllustration({ accent, danger, textMuted, fontMono, ip }: { accent: string; danger: string; textMuted: string; fontMono: string; ip: boolean }) {
  const cell = ip ? 8 : 10;
  const mini = (n: number, banned: boolean, label: string) => {
    const filled = new Set<string>();
    return (
      <div style={{ textAlign: "center", opacity: banned ? 0.45 : 1 }}>
        <div style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, color: banned ? danger : accent, marginBottom: 6, letterSpacing: "0.1em" }}>
          {label}
        </div>
        <div style={{ position: "relative", display: "inline-block" }}>
          <MiniBoardGrid size={n} filled={filled} accent={accent} muted={textMuted} cellSize={cell} />
          {banned && (
            <div
              style={{
                position: "absolute",
                inset: -4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span style={{ fontFamily: fontMono, fontSize: ip ? 28 : 34, fontWeight: 900, color: `${danger}CC`, textShadow: "0 0 12px #000" }}>✕</span>
            </div>
          )}
        </div>
      </div>
    );
  };
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.12em", color: textMuted, marginBottom: 14 }}>
        GAME 10 · TWO BANS → ONE SURVIVING BOARD
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end", justifyContent: "center" }}>
        {mini(5, true, "5×5 BAN")}
        {mini(6, true, "6×6 BAN")}
        {mini(7, false, "7×7 PLAYS")}
      </div>
      <div style={{ fontFamily: fontMono, fontSize: 10, color: textMuted, marginTop: 14, textAlign: "center", lineHeight: 1.55, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
        Illustrative: which sizes are banned depends on toss choices. One size remains for the sudden-death decider.
      </div>
    </div>
  );
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
      <LineWinStrip accent={accent} textMuted={textMuted} fontMono={fontMono} ip={ip} />
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
    screenshot: null,
  },
  {
    id: "win-conditions",
    emoji: "",
    title: "WIN CONDITIONS",
    summary:
      "Lines, structural patterns, or full-board chain resolution — requirements scale with board size (5×5, 6×6, 7×7).",
    detail: `Lines\nPlace a continuous straight line of your pieces with no gaps — the required length matches the grid: 5 on a 5×5 board, 6 on 6×6, 7 on 7×7. Directions: horizontal, vertical, and both diagonals.\n\nStructural patterns\nEach board size has its own mandatory or selectable shape wins (see diagrams below). All rotations and reflections count unless a mode specifies otherwise.\n\nFull board (no prior win)\nWhen every cell is filled, the game resolves by longest connected chain (pieces adjacent horizontally, vertically, or diagonally): at least 10 on 5×5, 15 on 6×6, 20 on 7×7. If only one player reaches their threshold, that player wins; if both or neither do, the result is a draw as appropriate.`,
    screenshot: null,
  },
  {
    id: "rulebreaker",
    emoji: "",
    title: "RULEBREAKER (5×5 · BEFORE GAME 3)",
    summary: "Coin-toss phase before the third game on the 5×5 leg when the match schedule calls for it.",
    detail: `On ranked triple-leg matches, **Rulebreaker** can run before **game 3** on **5×5**: a coin toss and choices (who starts, C3 block, etc.). Follow the on-screen flow.\n\nSudden death **game 10** when the series is still tied after nine games is covered under **G10 · LIMITBREAKER** below.`,
    screenshot: null,
  },
  {
    id: "leg-6x6-timebreaker",
    emoji: "",
    title: "6×6 · TIMEBREAKER",
    summary: "Six-in-a-line, fixed shape patterns, chain threshold, and Timebreaker before game 6 on this leg.",
    detail: formatRuleshowBlocks(RULESHOW_BLOCKS_6X6),
    screenshot: null,
  },
  {
    id: "leg-7x7-mindbreaker",
    emoji: "",
    title: "7×7 · MINDBREAKER",
    summary: "Structural patterns, chain resolution, extra-turn token, and Mindbreaker before game 9 on this leg.",
    detail: formatRuleshowBlocks(RULESHOW_BLOCKS_7X7),
    screenshot: null,
  },
  {
    id: "g10-limitbreaker",
    emoji: "",
    title: "G10 · LIMITBREAKER",
    summary: "Protocolbreaker / Limitbreaker — final deciding game after a tied nine-game series.",
    detail: formatRuleshowBlocks(RULESHOW_BLOCKS_PROTOCOLBREAKER),
    screenshot: null,
  },
];

export default function RulesScreen({ themeId, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const [openId, setOpenId] = useState<string | null>(null);

  const rules: Rule[] = RULES_BASE.map((r) => {
    if (r.id === "win-conditions") {
      return {
        ...r,
        extra: <WinPatternsBlock accent={t.accent} textMuted={t.textMuted} fontMono={t.fontMono} ip={ip} />,
      };
    }
    if (r.id === "centre") {
      return {
        ...r,
        extra: <CentreC3Illustration accent={t.accent} textMuted={t.textMuted} fontMono={t.fontMono} ip={ip} />,
      };
    }
    if (r.id === "rulebreaker") {
      return {
        ...r,
        extra: (
          <Rulebreaker5Illustration accent={t.accent} gold={t.gold} textMuted={t.textMuted} fontMono={t.fontMono} ip={ip} />
        ),
      };
    }
    if (r.id === "leg-6x6-timebreaker") {
      return {
        ...r,
        extra: (
          <SingleSizePatternGroup
            label="6×6 — mandatory shape patterns (same geometry as in-game)"
            meta={PATTERN_METADATA_6}
            accent={t.accent}
            textMuted={t.textMuted}
            fontMono={t.fontMono}
            ip={ip}
          />
        ),
      };
    }
    if (r.id === "leg-7x7-mindbreaker") {
      return {
        ...r,
        extra: (
          <SingleSizePatternGroup
            label="7×7 — structural patterns (reference; ranked set is server-authoritative)"
            meta={PATTERN_METADATA_7}
            accent={t.accent}
            textMuted={t.textMuted}
            fontMono={t.fontMono}
            ip={ip}
          />
        ),
      };
    }
    if (r.id === "g10-limitbreaker") {
      return {
        ...r,
        extra: (
          <G10LimitbreakerIllustration accent={t.accent} danger={t.danger} textMuted={t.textMuted} fontMono={t.fontMono} ip={ip} />
        ),
      };
    }
    return r;
  });

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
            const panelMax =
              rule.id === "win-conditions" ||
              rule.id === "leg-6x6-timebreaker" ||
              rule.id === "leg-7x7-mindbreaker" ||
              rule.id === "g10-limitbreaker"
                ? "min(88vh, 2800px)"
                : "520px";
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

                    {(rule.screenshots && rule.screenshots.length > 0) || rule.screenshot ? (
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
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", marginTop: 36, fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, letterSpacing: "0.1em" }}>
          CLICK ANY RULE TO EXPAND · DIAGRAMS MATCH IN-GAME PATTERN PREVIEWS
        </div>
      </div>
    </div>
  );
}
