/**
 * Legal acceptance gate.
 *
 * Shown immediately after sign-in when ``user.legal_accepted`` is
 * false (i.e. the user has never accepted, or the server bumped
 * ``legal_accepted_version`` past what they accepted).
 *
 * The screen is intentionally short:
 *   - Brief plain-English summary.
 *   - Links out to the full Terms / Privacy on the website (the
 *     authoritative copy — we don't ship a 4-page legal blob in
 *     the bundle).
 *   - One CTA: "Accept and continue". No "Decline" — declining
 *     means signing out (we treat the close button / hardware
 *     back the same way).
 *
 * Why a hard gate: Google Play's Data Safety form + EU privacy
 * regs require that the user actively consents to data processing
 * before any account-bound API call. Login alone isn't that — the
 * /accept-legal POST is. We won't let the user past this screen
 * without it.
 */

import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Eyebrow,
  Screen,
  Stack as VStack,
  Title,
} from "@/components/ui";
import { acceptLegal, ApiError, POLICY_VERSION } from "@/lib/profile";
import { logout } from "@/lib/auth";
import { colors, radii, space } from "@/theme/tokens";

const SITE_BASE = "https://www.pentaprotocol.com";

export default function LegalGateScreen() {
  const [submitting, setSubmitting] = useState(false);

  const onAccept = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await acceptLegal(POLICY_VERSION);
      // Auth gate (/) decides where to go next (onboarding vs tabs).
      router.replace("/");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail ? err.detail : "Could not record acceptance.";
      Alert.alert("Try again", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onDecline = async () => {
    Alert.alert(
      "Sign out?",
      "You can't use PentaProtocol without accepting the terms. You can come back any time.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <View style={{ height: space[4] }} />
      <Eyebrow tone="muted">PENTAPROTOCOL · TERMS & PRIVACY</Eyebrow>
      <View style={{ height: space[3] }} />
      <Title>Before we start</Title>

      <View style={{ height: space[5] }} />
      <Body tone="muted">
        We need your acceptance of our Terms of Service and Privacy Policy. The short version
        of what we collect and why:
      </Body>

      <VStack gap={3} style={{ marginTop: space[5] }}>
        <BulletPoint
          title="Account & gameplay"
          body="Your email, username, and match history — used to run the game and your account."
        />
        <BulletPoint
          title="Anti-cheat"
          body="Move timings + rate signals to detect bots and unfair play. No keystroke logging, no screen capture."
        />
        <BulletPoint
          title="No selling, no ads"
          body="We don't sell personal data and we don't run third-party ads."
        />
      </VStack>

      <View style={{ height: space[5] }} />
      <View style={styles.linkRow}>
        <Pressable
          onPress={() => Linking.openURL(`${SITE_BASE}/legal/terms`)}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Caption tone="accent">Read full Terms →</Caption>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL(`${SITE_BASE}/legal/privacy`)}
          hitSlop={8}
          accessibilityRole="link"
        >
          <Caption tone="accent">Read full Privacy Policy →</Caption>
        </Pressable>
      </View>

      <View style={{ height: space[8] }} />
      <Btn variant="primary" size="lg" loading={submitting} onPress={onAccept}>
        Accept and continue
      </Btn>
      <View style={{ height: space[3] }} />
      <Btn variant="ghost" onPress={onDecline}>
        Decline (signs out)
      </Btn>
    </Screen>
  );
}

function BulletPoint({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletDot} />
      <View style={{ flex: 1 }}>
        <Caption tone="default" style={{ fontWeight: "700" }}>
          {title}
        </Caption>
        <Body tone="muted" style={{ marginTop: space[1] }}>
          {body}
        </Body>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bullet: {
    flexDirection: "row",
    gap: space[3],
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    marginTop: space[2],
  },
  linkRow: {
    flexDirection: "row",
    gap: space[5],
    flexWrap: "wrap",
  },
});
