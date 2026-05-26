/**
 * Native sign-up — OTP email verification + register (same API as web).
 */

import { Stack, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AuthError,
  sendSignupOtp,
  verifySignupOtpAndRegister,
} from "@/lib/auth";
import { validateUsername } from "@/lib/validateUsername";
import { colors, fontSizes, radii, space } from "@/theme/tokens";

type Step = "form" | "verify";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [ageConfirm, setAgeConfirm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const next: Record<string, string> = {};
    const ue = validateUsername(username.trim());
    if (ue) next.username = ue;
    const em = email.trim().toLowerCase();
    if (!em.includes("@") || !em.includes(".")) next.email = "Enter a valid email";
    if (password.length < 6) next.password = "Minimum 6 characters";
    if (password !== confirm) next.confirm = "Passwords do not match";
    if (!ageConfirm) next.age = "You must be at least 13 years old";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSendOtp = async () => {
    if (loading) return;
    setGeneralError("");
    setSuccessMsg("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      await sendSignupOtp(email.trim().toLowerCase());
      setSuccessMsg(`A 6-digit code was sent to ${email.trim().toLowerCase()}`);
      setStep("verify");
      setFieldErrors({});
    } catch (err) {
      setGeneralError(err instanceof AuthError ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  };

  const onCompleteSignup = async () => {
    if (loading) return;
    setGeneralError("");
    if (otp.trim().length !== 6) {
      setFieldErrors({ otp: "Enter the 6-digit code" });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await verifySignupOtpAndRegister({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        username: username.trim(),
        password,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setGeneralError(err instanceof AuthError ? err.message : "Sign-up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[4] },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandMark}>
              <Text style={styles.brandPenta}>PENTA</Text>
              <Text style={styles.brandProtocol}>PROTOCOL</Text>
            </Text>
            <View style={styles.brandRule} />
            <Text style={styles.brandTag}>{step === "form" ? "SIGN UP" : "VERIFY EMAIL"}</Text>
          </View>

          {successMsg ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : null}

          {generalError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {step === "form" ? (
            <>
              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="3–16 characters"
                autoCapitalize="none"
                error={fieldErrors.username}
              />
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                error={fieldErrors.email}
              />
              <PasswordField
                label="Password"
                value={password}
                onChangeText={setPassword}
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                error={fieldErrors.password}
              />
              <PasswordField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                error={fieldErrors.confirm}
              />
              <Pressable
                onPress={() => setAgeConfirm((v) => !v)}
                style={styles.ageRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ageConfirm }}
              >
                <View style={[styles.ageBox, ageConfirm && styles.ageBoxOn]}>
                  {ageConfirm ? <Text style={styles.ageCheck}>✓</Text> : null}
                </View>
                <Text style={styles.ageLabel}>I am at least 13 years old</Text>
              </Pressable>
              {fieldErrors.age ? <Text style={styles.fieldError}>{fieldErrors.age}</Text> : null}

              <Pressable
                onPress={onSendOtp}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                  loading && styles.primaryBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.primaryBtnLabel}>SEND VERIFICATION CODE</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Enter the 6-digit code sent to{" "}
                <Text style={styles.hintAccent}>{email.trim().toLowerCase()}</Text>
              </Text>
              <Field
                label="Verification code"
                value={otp}
                onChangeText={setOtp}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                error={fieldErrors.otp}
              />
              <Pressable
                onPress={onCompleteSignup}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.primaryBtnPressed,
                  loading && styles.primaryBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.primaryBtnLabel}>CREATE ACCOUNT</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep("form");
                  setOtp("");
                  setSuccessMsg("");
                }}
                style={{ marginTop: space[4], alignItems: "center" }}
              >
                <Text style={styles.footerLink}>← Back to form</Text>
              </Pressable>
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  autoCapitalize = "none",
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string;
  autoCapitalize?: "none" | "sentences";
  keyboardType?: "default" | "email-address" | "number-pad";
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={[styles.input, styles.passwordInput, error ? styles.inputError : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textDim}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onToggle} style={styles.eyeBtn} hitSlop={8}>
          <Text style={styles.eyeLabel}>{show ? "HIDE" : "SHOW"}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space[5] },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: space[6] },
  brand: { alignItems: "center", marginBottom: space[8] },
  brandMark: { fontSize: fontSizes["2xl"], fontWeight: "900", letterSpacing: 4 },
  brandPenta: { color: colors.text },
  brandProtocol: { color: colors.accent },
  brandRule: {
    width: 56,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: space[3],
    marginBottom: space[3],
    borderRadius: 1,
  },
  brandTag: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginBottom: space[4],
    textAlign: "center",
  },
  hintAccent: { color: colors.accent },
  field: { marginBottom: space[4] },
  label: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: space[2],
  },
  input: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: fontSizes.base,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  passwordRow: { position: "relative" },
  passwordInput: { paddingRight: 64 },
  eyeBtn: {
    position: "absolute",
    right: space[2],
    top: 0,
    bottom: 0,
    paddingHorizontal: space[3],
    justifyContent: "center",
  },
  eyeLabel: {
    color: colors.textMuted,
    fontSize: fontSizes.xs,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  fieldError: { color: colors.danger, fontSize: fontSizes.xs, marginTop: space[2] },
  ageRow: { flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[2] },
  ageBox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ageBoxOn: { borderColor: colors.accent, backgroundColor: "rgba(204,0,0,0.15)" },
  ageCheck: { color: colors.accent, fontSize: 14, fontWeight: "800" },
  ageLabel: { color: colors.textMuted, fontSize: fontSizes.sm, flex: 1 },
  errorBanner: {
    backgroundColor: "rgba(204,0,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(204,0,0,0.4)",
    borderRadius: radii.md,
    padding: space[3],
    marginBottom: space[4],
  },
  errorBannerText: { color: colors.danger, fontSize: fontSizes.sm, lineHeight: 20 },
  successBanner: {
    backgroundColor: "rgba(0,180,80,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,180,80,0.35)",
    borderRadius: radii.md,
    padding: space[3],
    marginBottom: space[4],
  },
  successText: { color: "#6EE7A0", fontSize: fontSizes.sm, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: space[4],
    alignItems: "center",
    minHeight: 56,
    marginTop: space[2],
  },
  primaryBtnPressed: { backgroundColor: colors.accentDeep },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnLabel: {
    color: colors.text,
    fontSize: fontSizes.base,
    fontWeight: "800",
    letterSpacing: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: space[2],
    marginTop: space[7],
  },
  footerText: { color: colors.textMuted, fontSize: fontSizes.sm },
  footerLink: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: "700" },
});
