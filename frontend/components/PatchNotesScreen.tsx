"use client";

import React, { useEffect } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { PATCH_NOTES_STAMP } from "@/lib/patchNotesVersion";
import { recordPatchNotesOpened } from "@/lib/navBadgeState";

const UPDATES: { date: string; items: string[] }[] = [
  {
    date: "12 April 2026",
    items: [
      "Active Match Resumption: Instantly rejoin ongoing games if disconnected.",
      "Multiplayer Forfeiture: Surrender matches with confirmed ELO outcomes.",
      "Persistent Terms Acceptance: Legal gate is now synced across all devices.",
      "Career Perspective: Match history now reflects your POV (Victory/Defeat).",
    ],
  },
  {
    date: "2026",
    items: [
      "Ranked and custom matches with 5×5, 6×6, and 7×7 legs",
      "Missions, battle pass-style rewards, and PentaShards",
      "Store themes, boards, and cosmetic skins",
    ],
  },
];

interface Props {
  themeId: ThemeId;
}

export default function PatchNotesScreen({ themeId }: Props) {
  const t = THEMES[themeId];
  const ip = themeId === "pixel";

  useEffect(() => {
    recordPatchNotesOpened();
  }, []);

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
      <div style={{ maxWidth: 720, width: "100%" }}>
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
          Patch notes
        </h1>
        <p
          style={{
            fontFamily: t.fontBody,
            fontSize: 15,
            color: t.textMuted,
            textAlign: "center",
            marginBottom: 28,
            letterSpacing: "0.06em",
          }}
        >
          Open beta · v{PATCH_NOTES_STAMP}
        </p>

        <div
          style={{
            background: themeId === "space" ? "rgba(8,20,60,0.82)" : t.bgPanel,
            border: `${ip ? 2 : 1}px solid ${t.border}`,
            borderRadius: ip ? 2 : 14,
            padding: "24px 22px",
            marginBottom: 20,
            backdropFilter: themeId === "space" ? "blur(12px)" : undefined,
            WebkitBackdropFilter: themeId === "space" ? "blur(12px)" : undefined,
          }}
        >
          <h2
            style={{
              fontFamily: t.fontDisplay,
              fontSize: ip ? 14 : 18,
              fontWeight: 700,
              color: t.text,
              marginBottom: 16,
              letterSpacing: "0.08em",
            }}
          >
            Recent updates
          </h2>
          {UPDATES.map((block) => (
            <div key={block.date} style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, color: t.textMuted, marginBottom: 10, letterSpacing: "0.12em" }}>
                {block.date}
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, lineHeight: 1.65 }}>
                {block.items.map((line) => (
                  <li key={line} style={{ marginBottom: 8 }}>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textMuted, fontStyle: "italic", margin: 0, lineHeight: 1.6 }}>
            Stay tuned for more updates and skins — new cosmetics and features land here first.
          </p>
        </div>

        <div
          style={{
            background: themeId === "space" ? "rgba(8,20,60,0.82)" : t.bgPanel,
            border: `${ip ? 2 : 1}px solid ${t.border}`,
            borderRadius: ip ? 2 : 14,
            padding: "24px 22px",
            backdropFilter: themeId === "space" ? "blur(12px)" : undefined,
            WebkitBackdropFilter: themeId === "space" ? "blur(12px)" : undefined,
          }}
        >
          <h2
            style={{
              fontFamily: t.fontDisplay,
              fontSize: ip ? 14 : 18,
              fontWeight: 700,
              color: t.text,
              marginBottom: 12,
              letterSpacing: "0.08em",
            }}
          >
            Skins &amp; cosmetics
          </h2>
          <p style={{ fontFamily: t.fontBody, fontSize: 14, color: t.textSecondary, lineHeight: 1.65, margin: 0 }}>
            Unlock boards, piece styles, themes, and bundles in the Store. ProtoCredits and PentaShards can be used on premium and shard-priced items; check Collection to equip what you own.
          </p>
        </div>
      </div>
    </div>
  );
}
