/**
 * Two-factor authentication setup (TOTP).
 *
 * Three states:
 *   - ``user.totp_enabled === true``   → "Already on" panel.
 *   - User hasn't requested setup yet  → introduction + CTA.
 *   - Setup in progress                 → QR code + verify field.
 *
 * The server returns the QR code as a base64-encoded PNG, which
 * we render via ``<Image source={{ uri }} />``. The TOTP secret
 * is shown underneath as a manual-entry fallback for users
 * whose authenticator can't scan QR codes (or who prefer not
 * to).
 *
 * We deliberately don't ship a recovery-codes UI in v1 — the
 * backend doesn't generate any (TOTP can be reset by support
 * via the account-recovery flow). When that lands server-side
 * we'll add a "Save your recovery codes" step before the
 * confirm.
 */

import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Card,
  Mono,
  Row,
  Screen,
  Spinner,
  Stack as VStack,
  TextField,
} from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import {
  ApiError,
  confirmTwoFa,
  setupTwoFa,
  type TwoFaSetupResponse,
} from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { colors, radii, space } from "@/theme/tokens";

type Phase = "idle" | "setup" | "verify";

export default function TwoFactorScreen() {
  const user = useAuthStore((s) => s.user);

  const [phase, setPhase] = useState<Phase>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [setupData, setSetupData] = useState<TwoFaSetupResponse | null>(null);
  const [code, setCode] = useState("");

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile/edit");
  };

  const beginSetup = async () => {
    if (submitting) return;
    setSubmitting(true);
    setPhase("setup");
    try {
      const res = await setupTwoFa();
      setSetupData(res);
      setPhase("verify");
    } catch (err) {
      setPhase("idle");
      const msg =
        err instanceof ApiError && err.detail ? err.detail : "Could not start 2FA setup.";
      Alert.alert("Try again", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const verify = async () => {
    if (submitting) return;
    const trimmed = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      Alert.alert("Invalid code", "Enter the 6-digit code from your authenticator.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmTwoFa(trimmed);
      Alert.alert(
        "Two-factor auth enabled",
        "You'll be asked for a code from your authenticator app the next time you sign in.",
      );
      goBack();
    } catch (err) {
      const msg = err instanceof ApiError && err.detail ? err.detail : "Invalid code.";
      Alert.alert("Try again", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader title="TWO-FACTOR AUTH" eyebrow="SECURITY · 2FA" onBack={goBack} />

      {/* ── Already on ─────────────────────────────────────────── */}
      {user?.totp_enabled ? (
        <Card variant="surface" padding="lg" style={{ marginTop: space[6] }}>
          <Row gap={3} align="center">
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Body style={{ fontWeight: "700" }}>Enabled on this account</Body>
          </Row>
          <Body tone="muted" style={{ marginTop: space[3] }}>
            We&apos;ll ask for a code from your authenticator app the next time you sign in. To
            disable 2FA, contact support — there&apos;s no in-app off-switch by design.
          </Body>
        </Card>
      ) : phase === "idle" ? (
        <>
          <Body tone="muted" style={{ marginTop: space[5] }}>
            Add a six-digit code from Google Authenticator, Authy, or 1Password to every sign-in.
            Takes about a minute to set up.
          </Body>
          <View style={{ height: space[8] }} />
          <Btn variant="primary" size="lg" loading={submitting} onPress={beginSetup}>
            Set up 2FA
          </Btn>
        </>
      ) : phase === "setup" || !setupData ? (
        <Row gap={3} align="center" justify="center" style={{ marginTop: space[10] }}>
          <Spinner tone="muted" />
          <Body tone="muted">Generating your code…</Body>
        </Row>
      ) : (
        <>
          {/* ── Setup: QR + manual entry ──────────────────────── */}
          <VStack gap={5} style={{ marginTop: space[5] }}>
            <Body tone="muted">
              1. Open your authenticator app and tap &quot;Add account&quot;. Scan this code, or
              enter the key below manually.
            </Body>

            <View style={styles.qrFrame}>
              <Image
                source={{ uri: setupData.qr_code }}
                style={styles.qr}
                resizeMode="contain"
                accessibilityLabel="2FA setup QR code"
              />
            </View>

            <View style={styles.secretBox}>
              <Caption tone="muted">MANUAL ENTRY KEY</Caption>
              <Mono style={{ marginTop: space[2] }}>{setupData.secret}</Mono>
            </View>

            <Body tone="muted">
              2. Enter the six-digit code your authenticator generates for &quot;PentaProtocol&quot;
              to confirm.
            </Body>

            <TextField
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={6}
            />
          </VStack>

          <View style={{ height: space[7] }} />
          <Btn variant="primary" size="lg" loading={submitting} onPress={verify}>
            Verify and enable
          </Btn>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
  },
  qrFrame: {
    alignSelf: "center",
    padding: space[4],
    backgroundColor: colors.text,
    borderRadius: radii.md,
  },
  qr: {
    width: 200,
    height: 200,
  },
  secretBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
});
