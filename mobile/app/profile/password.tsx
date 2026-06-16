/**
 * Password change — two-step OTP flow.
 *
 * Backend contract (see ``backend/app/routers/otp.py``):
 *   1. POST /api/otp/change-password/send  → email an OTP.
 *   2. POST /api/otp/change-password/verify with current password,
 *      OTP, and new password → write.
 *
 * Both steps require the user to be authenticated. The OTP is
 * short-lived and rate-limited server-side. We model the flow as
 * two states in one screen rather than two routes — keeps it
 * simple and lets us reuse the "we sent a code" banner without
 * a navigation animation between steps.
 */

import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  Body,
  Btn,
  Caption,
  Screen,
  Stack as VStack,
  TextField,
} from "@/components/ui";
import { HudHeader } from "@/components/ui/hud";
import {
  ApiError,
  changePassword,
  sendChangePasswordOtp,
} from "@/lib/profile";
import { useAuthStore } from "@/lib/store";
import { space } from "@/theme/tokens";

type Step = "request" | "verify";

const MIN_PW_LEN = 8;
const RESEND_COOLDOWN_S = 30;

export default function PasswordChangeScreen() {
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<Step>("request");
  const [submitting, setSubmitting] = useState(false);

  // Verify-step fields.
  const [currentPw, setCurrentPw] = useState("");
  const [otp, setOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Resend cooldown — visual only, server enforces real rate limit.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/profile/edit");
  };

  const sendCode = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await sendChangePasswordOtp();
      setStep("verify");
      setResendIn(RESEND_COOLDOWN_S);
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail
          ? err.detail
          : "Could not send the verification code.";
      Alert.alert("Try again", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyAndChange = async () => {
    if (submitting) return;
    if (newPw.length < MIN_PW_LEN) {
      Alert.alert("Password too short", `Use at least ${MIN_PW_LEN} characters.`);
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert("Mismatch", "Both new-password fields must match.");
      return;
    }
    if (!otp.trim()) {
      Alert.alert("Missing code", "Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({
        currentPassword: currentPw,
        otp: otp.trim(),
        newPassword: newPw,
      });
      Alert.alert("Password changed", "Use your new password the next time you sign in.");
      goBack();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.detail ? err.detail : "Could not change password.";
      Alert.alert("Not changed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scrollable padded contentContainerStyle={{ paddingBottom: space[10] }}>
      <Stack.Screen options={{ headerShown: false }} />

      <HudHeader title="CHANGE PASSWORD" eyebrow="ACCOUNT · PASSWORD" onBack={goBack} />

      <Body tone="muted" style={{ marginTop: space[4] }}>
        We&apos;ll email a 6-digit code to {user?.email ?? "your address"}. You&apos;ll need it,
        plus your current password, to set a new one.
      </Body>

      {step === "request" ? (
        <View style={{ marginTop: space[8] }}>
          <Btn variant="primary" size="lg" loading={submitting} onPress={sendCode}>
            Send verification code
          </Btn>
        </View>
      ) : (
        <VStack gap={5} style={{ marginTop: space[8] }}>
          <TextField
            label="Verification code"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={8}
            hint="Sent to your email moments ago."
          />

          <TextField
            label="Current password"
            value={currentPw}
            onChangeText={setCurrentPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextField
            label="New password"
            value={newPw}
            onChangeText={setNewPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            hint={`At least ${MIN_PW_LEN} characters.`}
          />

          <TextField
            label="Confirm new password"
            value={confirmPw}
            onChangeText={setConfirmPw}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={
              confirmPw.length > 0 && confirmPw !== newPw ? "Doesn't match the new password." : undefined
            }
          />

          <View>
            <Btn variant="primary" size="lg" loading={submitting} onPress={verifyAndChange}>
              Change password
            </Btn>
            <View style={{ height: space[3] }} />
            <Btn
              variant="ghost"
              onPress={sendCode}
              disabled={resendIn > 0 || submitting}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </Btn>
          </View>
        </VStack>
      )}
    </Screen>
  );
}
