"use client";

import React, { useEffect } from "react";
import type { ThemeId } from "@/lib/themes";
import { THEMES } from "@/lib/themes";
import { PATCH_NOTES_STAMP } from "@/lib/patchNotesVersion";
import { recordPatchNotesOpened } from "@/lib/navBadgeState";

const UPDATES: { date: string; items: string[]; highlight?: boolean; label?: string }[] = [
  {
    date: "18 April 2026",
    label: "Beta Launch",
    highlight: true,
    items: [
      "Global open beta: PentaProtocol is now live for public play. Report issues or feedback at support@pentaprotocol.com.",
      "Ranked ladder with ELO: placement matches, seasonal progression, and tiered ranks (ROOKIE, SKILLED, ELITE, MYTHIC, CRACKED, CHRONICLE).",
      "Derank buffer: a loss at a rank-threshold rating now clamps you to the threshold first — the NEXT loss is the actual derank match. Hidden MMR continues to update normally.",
      "Rank rewards: reaching CHRONICLE grants 200,000 XP and a free theme of your choice as a one-time milestone reward.",
      "Missions overhaul: permanent rank-milestone missions cleaned up, CHRONICLE milestone highlighted as a special golden mission at the top.",
      "AI ladder: beat JR, HIM, and HER difficulty bots to unlock banner, coin-toss, and board-skin reward slots.",
      "Multiplayer stability: redesigned sumi-e ink-brush VS match-found animation, direct route into the rules-show phase (no more mid-transition flash), and the top navigation bar hides the currency widgets and locks to the PentaProtocol logo + settings during active matches.",
      "Forfeit + quit-match: server-authoritative outcome — no client-side winner selection possible during surrender, timeout, or quit.",
      "Store: INR purchases via operator-verified UPI / bank-QR. Scan the posted QR, pay with any UPI app, then paste the bank UTR — credits are applied after ops verification.",
      "Cosmetics: new skins, themes, boards, banners, and profile borders added to the Store this release.",
      "Security and privacy: tiered auth rate limiting (5 attempts per minute on login / OTP / 2FA; 5 per 15 minutes on password reset and account deletion), OTP-verified email signup, server-side TOTP 2FA with trusted-device tokens, hashed-only security-event audit trail, persistent legal acceptance tied to document version.",
      "Data controls: in-app data export (GDPR/UK GDPR portability) and full self-service account deletion.",
      "Known beta caveats: economy and ratings may be rebalanced or reset during the beta window. Patch notes here will flag any such reset in advance.",
    ],
  },
  {
    date: "12 April 2026",
    items: [
      "Active Match Resumption: Instantly rejoin ongoing games if disconnected.",
      "Multiplayer Forfeiture: Surrender matches with confirmed ELO outcomes.",
      "Persistent Terms Acceptance: legal gate state stored server-side per account so returning sessions resume where you left off.",
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
            <div
              key={block.date}
              style={{
                marginBottom: 20,
                ...(block.highlight
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(255,215,0,0.10) 0%, rgba(255,180,0,0.05) 100%)",
                      border: `${ip ? 2 : 1}px solid rgba(255,215,0,0.45)`,
                      borderRadius: ip ? 2 : 10,
                      padding: "16px 18px",
                      boxShadow: "0 0 24px rgba(255,200,0,0.08)",
                    }
                  : {}),
              }}
            >
              {block.label && (
                <div
                  style={{
                    display: "inline-block",
                    fontFamily: t.fontMono,
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "#1a0e00",
                    background: "linear-gradient(135deg, #FFD700 0%, #FFA000 100%)",
                    padding: "3px 10px",
                    borderRadius: ip ? 2 : 999,
                    marginBottom: 8,
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {block.label}
                </div>
              )}
              <div
                style={{
                  fontFamily: t.fontMono,
                  fontSize: 11,
                  color: block.highlight ? "#FFD700" : t.textMuted,
                  marginBottom: 10,
                  letterSpacing: "0.12em",
                }}
              >
                {block.date}
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 20,
                  fontFamily: t.fontBody,
                  fontSize: 14,
                  color: t.textSecondary,
                  lineHeight: 1.65,
                }}
              >
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
