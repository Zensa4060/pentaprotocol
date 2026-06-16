/**
 * Patch notes — mirrors web ``PatchNotesScreen`` content (UPDATES blocks,
 * beta-launch highlight, skins & cosmetics footer).
 */

import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Body, Caption, Heading, Screen } from "@/components/ui";
import { HudHeader, SectionLabel } from "@/components/ui/hud";
import { usePalette } from "@/theme/ThemeProvider";
import { colors, radii, space } from "@/theme/tokens";

const PATCH_NOTES_STAMP = "19";

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
      "Multiplayer stability: redesigned match-found VS animation, direct route into the rules-show phase, and in-match navigation locks during active matches.",
      "Forfeit + quit-match: server-authoritative outcome — no client-side winner selection possible during surrender, timeout, or quit.",
      "Store: INR purchases via operator-verified UPI / bank-QR. Scan the posted QR, pay with any UPI app, then paste the bank UTR — credits are applied after ops verification.",
      "Cosmetics: new skins, themes, boards, banners, and profile borders added to the Store this release.",
      "Security and privacy: tiered auth rate limiting, OTP-verified email signup, server-side TOTP 2FA with trusted-device tokens, hashed-only security-event audit trail, persistent legal acceptance tied to document version.",
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

export default function PatchNotesScreen() {
  const palette = usePalette();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <Screen padded background={palette.bg}>
      <Stack.Screen options={{ headerShown: false }} />
      <HudHeader
        title="PATCH NOTES"
        eyebrow={`OPEN BETA · v${PATCH_NOTES_STAMP}`}
        onBack={goBack}
      />

      <ScrollView
        style={{ marginTop: space[5] }}
        contentContainerStyle={{ paddingBottom: space[10] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.panel, { backgroundColor: palette.bgCard, borderColor: palette.border }]}>
          <SectionLabel label="RECENT UPDATES" style={{ marginBottom: space[4] }} />
          {UPDATES.map((block) => (
            <View
              key={block.date}
              style={[styles.block, block.highlight && styles.blockHighlight]}
            >
              {block.label ? (
                <View style={styles.labelPill}>
                  <Text style={styles.labelPillText}>{block.label}</Text>
                </View>
              ) : null}
              <Caption
                tone={block.highlight ? "warn" : "muted"}
                style={{ marginBottom: space[2], letterSpacing: 2 }}
              >
                {block.date}
              </Caption>
              {block.items.map((line) => (
                <View key={line} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: palette.accent }]}>•</Text>
                  <Body tone="muted" style={{ flex: 1 }}>
                    {line}
                  </Body>
                </View>
              ))}
            </View>
          ))}
          <Body tone="muted" style={{ fontStyle: "italic" }}>
            Stay tuned for more updates and skins — new cosmetics and features land here first.
          </Body>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: palette.bgCard, borderColor: palette.border, marginTop: space[4] },
          ]}
        >
          <Heading style={{ marginBottom: space[2] }}>Skins & cosmetics</Heading>
          <Body tone="muted">
            Unlock boards, piece styles, themes, and bundles in the Store. ProtoCredits and
            PentaShards can be used on premium and shard-priced items; check Collection to equip
            what you own.
          </Body>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: space[4],
  },
  block: {
    marginBottom: space[5],
  },
  blockHighlight: {
    backgroundColor: "rgba(255,215,0,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.45)",
    borderRadius: radii.md,
    padding: space[3],
  },
  labelPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFD700",
    borderRadius: radii.pill,
    paddingHorizontal: space[3],
    paddingVertical: 3,
    marginBottom: space[2],
  },
  labelPillText: {
    color: "#1a0e00",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  bulletRow: {
    flexDirection: "row",
    gap: space[2],
    marginBottom: space[2],
  },
  bullet: {
    color: colors.accent,
    lineHeight: 20,
  },
});
