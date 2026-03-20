"use client";
import { useState } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";

interface Props { themeId: ThemeId; onHoverAction?: () => void; onClickAction?: () => void; }

interface Rule {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  detail: string;
  // Path to screenshot — set to null until you upload the image
  screenshot: string | null;
  screenshotCaption?: string;
  screenshots?: { src: string; caption?: string }[];
}

const RULES = [
  {
    id: "objective",
    emoji: "",
    summary: "Be the first player to complete a winning pattern on the 5×5 grid.",
     detail: `The goal of PentaProtocol is to outmaneuver your opponent by placing your pieces strategically on the 5×5 grid. You win a game by completing one of the recognized winning patterns before your opponent does.\n\nEach match is Best-of-3 — the first player to win 2 games wins the series. A draw counts as neither a win nor a loss for series purposes.`,
    title: "OBJECTIVE",
    screenshot: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1SjiJqsN4Vcb4OZimsIYpFADV0OsMK7jn",
  },
  {
    id: "turns",
    emoji: "",
    title: "TAKING TURNS",
    summary: "Players alternate placing their piece on any empty cell.",
    detail: `P1 places first, then players alternate turns. On your turn, click any empty cell on the board to place your piece.\n\nP1 uses the X symbol, P2 uses the Y symbol (visual style depends on your chosen theme).\n\nYou cannot skip a turn, and once placed a piece cannot be moved. The timer counts down during your turn — if it reaches zero, you forfeit that game.`,
    screenshot: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1E3BaL0LAC-MNiMB8CHiVn_pa6aHkoXuV",
    screenshotCaption: "P1 at C2, P2 at C3 — green highlight shows the next available cell hover",
  },
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
  id: "win-line",
  emoji: "",
  title: "WIN CONDITION: 5 IN A LINE",
  summary: "Connect 5 of your pieces in a straight line — horizontal, vertical, or diagonal.",
  detail: `The most straightforward win condition: place 5 of your pieces in a continuous straight line.\n\nLines can go in any of 4 directions:\n• Horizontal (left–right)\n• Vertical (up–down)\n• Diagonal (top-left to bottom-right)\n• Anti-diagonal (top-right to bottom-left)\n\nAll 5 cells must be occupied by your pieces with no gaps. The winning cells will flash and highlight when this condition is triggered.`,
  screenshot: null,
  screenshotCaption: "Example of a 5-in-a-line win",
  screenshots: [
    { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1spemezZ3gcELGbHcQROvdoGzAGdDJhbo", caption: "" },
    { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1HfqhyZRgU5BwDneeMggblksI9w4_0_On", caption: "" },
    { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1BeY0og5DBs2i2CTEG_rxCyI9QcWhFcuP", caption: "" },
    { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1fu3aNx4dkgKGrU3sJDcMTIsDhfnFYboS", caption: "" },
  ],
},
  {
    id: "win-pattern",
    emoji: "",
    title: "WIN CONDITION: SHAPE PATTERNS",
    summary: "Complete a recognized shape pattern — V, L, W, or Zigzag — with 5 of your pieces.",
    detail: `Beyond simple lines, PentaProtocol recognizes several geometric shape patterns. Completing any of these with exactly 5 of your pieces anywhere on the board triggers a win:\n\n• V / Chevron — a wide V shape spanning 3 rows and 5 columns\n• L / Corner — an L or J shape in any rotation (3 in a line then 2 turning)\n• W / Zigzag — two alternating diagonal steps forming a W\n• Diagonal V / Triangle — a pointed triangle with the tip at the centre\n• Zigzag Arrow — a diagonal line that reverses direction, forming a vertical zigzag or hourglass\n\nAll rotations and reflections of each shape count. The game engine checks for these patterns after every single move.`,
    screenshot: null,
    screenshotCaption: "All recognized shape patterns",
    screenshots: [
  { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1h3dDP1AGw9Xsv9nkskYyvwf_eCswuzP9", caption: "" },
  { src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1Cd_NJ1qOGHSSgGLZ-VAPkudpZ-uOIdPA", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1Uuo9BcoktYONSnh9LFyuHf7m3HIAmiEi", caption: "" },
],
  },
  {
    id: "win-chain",
    emoji: "",
    title: "WIN CONDITION: 10-CELL CHAIN",
    summary: "On a completely full board, the player with a connected chain of 10 pieces wins.",
    detail: `If the board fills up completely with no prior win, a special full-board resolution occurs:\n\nThe game searches for any player who has a connected chain of 10 or more of their own pieces — where each piece in the chain must be adjacent (horizontally, vertically, or diagonally) to the next.\n\n• If only one player has a 10-chain → that player wins\n• If both players have a 10-chain → DRAW\n• If neither player has a 10-chain → DRAW\n\nThis rule rewards players who build dense, connected structures even if they cannot complete a line or shape.`,
    screenshot: null,
    screenshotCaption: "Full board with a 10-cell chain highlighted",
    screenshots: [{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1BK29BTXUe36_wUO9d9G97_jkMxLmurRe", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1yioyF21ucKS-bi8RjDbgRayJVzI08Vg5", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1dU1n6A3b3yhlEMctkA8mn0XlP4tJy63P", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1bkhRzNneVhRw2lhTajYuRKMr0hMZ2ily", caption: "" },
      ], 
      },{
    id: "rulebreaker",
    emoji: "",
    title: "RULEBREAKER",
    summary: "Before Game 3, a coin toss grants one player the power to set a special rule.",
    detail: `If the series reaches Game 3 (1–1 or split with draws), the Rulebreaker phase begins before the deciding game.\n\nA coin is flipped — YIN gives the toss to P1, YANG gives it to P2.\n\nThe toss winner chooses one of two rule tracks:\n\n1. DECIDE WHO PLAYS FIRST — the winner picks which player goes first in Game 3. Then the loser decides the C3 rule.\n\n2. BLOCK C3 FIRST MOVE — the winner decides whether C3 is blocked or allowed for the first move. Then the loser picks who goes first.\n\nEach player has a countdown timer to make their choice — if time runs out, the first option is selected automatically.`,
    screenshot: null,
    screenshotCaption: "Rulebreaker coin toss and choice screens",
    screenshots: [{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1ruG7o40ffMD6mQL5MrbQ1I8E7OLRmzs6", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1d13MnJIlZ1Ck9hi58A25-r9-fcpO6b-M", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1fQO_jm0XiOnJuEiQNLdrcMDTC9Fh6Y-L", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1BptPliDW0t-Xr6XcZmiGNScRY-CpPILd", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1hWHJWYh_E1YtoF3dwtBeO2np1U496rOr", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1rOGVSql0QvlzNjTV2ozVTYLGQjO3H-in", caption: "" },
{ src: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1zp0kUPrtYCHF0BBq0oCHZjwPGshU2tTz", caption: "" },
    ],
  },
  {
  id: "series",
  emoji: "",
  title: "SERIES & MATCH FORMAT",
  summary: "First to win 2 games wins the match. Draws count as neither win nor loss.",
  detail: `Every match is Best-of-3:\n\n• Win Game 1 + Win Game 2 → you win the series (no Game 3 needed)\n• Win Game 1, Draw Game 2 → you still win the series\n• Win Game 1, Lose Game 2 → series goes to Game 3 with Rulebreaker\n• Draw Game 1, Draw Game 2 → Game 3 with Rulebreaker\n\nGame 1: P1 goes first.\nGame 2: P2 goes first.\nGame 3: Decided by Rulebreaker coin toss.\n\nAfter the series, ELO is updated based on the final result.`,
  screenshot: "/api/proxy-image?url=https://lh3.googleusercontent.com/d/1X8BPjljEUplyX_nzhRu3P_Ic9tg4SToA",
  screenshotCaption: "Match timer, history panel (P1 won Game 1), and ready-to-deploy buttons",
},
];

export default function RulesScreen({ themeId, onHoverAction, onClickAction }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(prev => prev === id ? null : id);

  return (
    <div style={{ minHeight:"100vh", padding:"84px 24px 64px", background:themeId === "space" ? "url(/bg-earth.png) center/cover no-repeat" : t.bg, transition:"background 0.4s", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ maxWidth:820, width:"100%" }}>

        <h1 style={{ fontFamily:t.fontDisplay, fontSize:ip?22:36, fontWeight:700, color:t.accent, marginBottom:8, textAlign:"center", letterSpacing:"0.04em" }}>
          How to Play
        </h1>
        <p style={{ fontFamily:t.fontBody, fontSize:15, color:t.textMuted, textAlign:"center", marginBottom:40, letterSpacing:"0.08em" }}>
          PENTAPROTOCOL · 5×5 · Best of 3 · Rulebreaker
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {RULES.map(rule => {
            const isOpen = openId === rule.id;
            return (
              <div key={rule.id} style={{ background:t.bgPanel, border:`${ip?2:1}px solid ${isOpen ? t.accent : t.border}`, borderRadius:ip?2:14, overflow:"hidden", transition:"border-color 0.22s" }}>

                {/* Clickable header row */}
                <button
                  onClick={() => { onClickAction?.(); toggle(rule.id); }}
                  style={{
                    width:"100%", display:"flex", alignItems:"center", gap:16,
                    padding:"20px 24px", background:"transparent", border:"none",
                    cursor:"pointer", textAlign:"left",
                    transition:"background 0.18s",
                  }}
                  className="rule-row-btn"
                  onMouseEnter={e => { onHoverAction?.(); (e.currentTarget as HTMLElement).style.background = `${t.accent}0E`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {rule.emoji && <span style={{ fontSize:ip?22:28, flexShrink:0 }}>{rule.emoji}</span>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:t.fontDisplay, fontSize:ip?13:18, fontWeight:700, color:isOpen?t.accent:t.text, transition:"color 0.18s", marginBottom:3 }}>
                      {rule.title}
                    </div>
                    <div style={{ fontFamily:t.fontBody, fontSize:ip?11:14, color:t.textMuted, lineHeight:1.5 }}>
                      {rule.summary}
                    </div>
                  </div>
                  {/* Chevron */}
                  <div style={{ flexShrink:0, fontSize:16, color:isOpen?t.accent:t.textMuted, transition:"transform 0.22s, color 0.18s", transform:isOpen?"rotate(180deg)":"rotate(0deg)" }}>
                    ▼
                  </div>
                </button>

                {/* Expandable detail panel */}
                <div style={{
                  maxHeight: isOpen ? "520px" : "0px",
                  overflow:"hidden",
                  transition:"max-height 0.38s cubic-bezier(.4,0,.2,1)",
                }}>
                  <div style={{
                    padding:"0 24px 26px 68px",
                    borderTop:`1px solid ${t.border}22`,
                    maxHeight:"520px",
                    overflowY:"auto",
                    scrollbarWidth:"thin",
                    scrollbarColor:`${t.border} transparent`,
                  }}>

                    {/* Detail text */}
                    <div style={{ paddingTop:18, fontFamily:t.fontBody, fontSize:ip?12:15, color:t.textSecondary, lineHeight:1.85, whiteSpace:"pre-line" }}>
                      {rule.detail}
                    </div>

                    {/* Screenshot slot */}
                    <div style={{ marginTop:22 }}>
                      {rule.screenshots && rule.screenshots.length > 0 ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                          <div style={{ fontFamily:t.fontMono, fontSize:11, fontWeight:700, color:t.textMuted, letterSpacing:"0.12em" }}>
                            EXAMPLE SCREENSHOTS — {rule.screenshots.length} POSITIONS
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                            {rule.screenshots.map((s, i) => (
                              <div key={i} style={{ borderRadius:ip?2:10, overflow:"hidden", border:`1px solid ${t.borderAccent}`, background:t.bgCard }}>
                                <img
                                  src={s.src}
                                  alt={s.caption ?? `Example ${i+1}`}
                                  style={{ width:"100%", display:"block" }}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }}
                                />
                                {s.caption && (
                                  <div style={{ padding:"10px 16px", fontFamily:t.fontMono, fontSize:ip?10:12, color:t.textSecondary, letterSpacing:"0.07em", borderTop:`1px solid ${t.border}`, background:t.bgPanel }}>
                                    <span style={{ color:t.accent, marginRight:8 }}>{i+1}.</span>{s.caption}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : rule.screenshot ? (
                        <div style={{ borderRadius:ip?2:10, overflow:"hidden", border:`1px solid ${t.border}` }}>
                          <img
                            src={rule.screenshot}
                            alt={rule.screenshotCaption ?? rule.title}
                            style={{ width:"100%", display:"block" }}
                          />
                          {rule.screenshotCaption && (
                            <div style={{ padding:"8px 14px", background:t.bgCard, fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.08em" }}>
                              {rule.screenshotCaption}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ border:`1px dashed ${t.border}`, borderRadius:ip?2:8, padding:"18px 20px", display:"flex", alignItems:"center", gap:12, background:`${t.accent}06` }}>
                          <span style={{ fontSize:20, opacity:0.4 }}>🖼</span>
                          <span style={{ fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em" }}>
                            SCREENSHOT COMING SOON — {rule.screenshotCaption?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            );
          })}
        </div>

        <div style={{ textAlign:"center", marginTop:36, fontFamily:t.fontMono, fontSize:11, color:t.textMuted, letterSpacing:"0.1em" }}>
          CLICK ANY RULE TO EXPAND · SCREENSHOTS UPLOAD PROGRESSIVELY
        </div>
      </div>
    </div>
  );
}