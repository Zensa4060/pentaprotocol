/**
 * Native login screen.
 *
 * This is deliberately built with raw React Native primitives
 * (``View`` / ``Text`` / ``TextInput`` / ``Pressable``) rather than
 * Tamagui's styled API. We want this screen to feel like a phone
 * app, not a phone-shaped website — that means tight touch targets,
 * fast tap feedback, native keyboard handling, and zero
 * web-style "hover" state inflation.
 *
 * Design language (also see ``theme/tokens.ts``):
 *   - Black surface, single accent in PentaProtocol blood red.
 *   - One column, generous vertical rhythm, centered logotype.
 *   - 56pt touch targets for the primary buttons (a14 Android
 *     Material 3 standard; iOS 44pt floor is also satisfied).
 *   - System font stack — no remote fonts to wait on at first paint.
 *   - All errors are inline + scoped (per field + general banner)
 *     so the user never has to scroll back up to find what's wrong.
 *
 * Google Sign-In runs the native flow when the app is launched from
 * a development / production build, and falls back to a clear
 * "needs dev build" message when running inside Expo Go (the SDK
 * isn't bundled in the Go client). See ``lib/googleAuth.ts`` for
 * the wrapper.
 */

import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGameAudio } from "@/lib/audio/AudioProvider";
import { getApiBaseUrl } from "@/lib/api";
import {
  AuthError,
  completeTwoFactorLogin,
  requestPasswordReset,
  resetPasswordWithCode,
  signInWithGoogle,
  signInWithPassword,
} from "@/lib/auth";
import { GoogleAuthError, isGoogleSignInAvailable, signInWithGoogleNative } from "@/lib/googleAuth";
import { colors, fontSizes, radii, space } from "@/theme/tokens";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const audio = useGameAudio();

  useEffect(() => {
    audio.playAuthBgm();
  }, [audio]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  // ── 2FA challenge (TOTP accounts) ─────────────────────────────
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaError, setTwoFaError] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // ── Forgot-password (email → code → new password) ─────────────
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPw, setResetNewPw] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  const busy = loading || googleLoading;

  const validate = (): boolean => {
    const next: typeof fieldErrors = {};
    if (!username.trim()) next.username = "Username or email is required.";
    if (password.length < 6) next.password = "Minimum 6 characters.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (loading) return;
    setGeneralError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await signInWithPassword({ username: username.trim(), password });
      if (result.status === "2fa_required") {
        setTwoFaCode("");
        setTwoFaError("");
        setTwoFaToken(result.tempToken);
        return;
      }
      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : "Something went wrong. Try again.";
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit2fa = async () => {
    if (!twoFaToken || twoFaBusy) return;
    const code = twoFaCode.trim();
    if (code.length < 6) {
      setTwoFaError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setTwoFaBusy(true);
    setTwoFaError("");
    try {
      await completeTwoFactorLogin({ tempToken: twoFaToken, code });
      setTwoFaToken(null);
      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : "Invalid code. Try again.";
      setTwoFaError(msg);
      // An expired temp token means the whole sign-in must restart.
      if (err instanceof AuthError && err.status === 400 && /expired/i.test(msg)) {
        setTwoFaToken(null);
        setGeneralError("Sign-in session expired — please sign in again.");
      }
    } finally {
      setTwoFaBusy(false);
    }
  };

  const runGoogle = async (confirmMerge: boolean, credential?: string) => {
    const idToken = credential ?? (await signInWithGoogleNative());
    const result = await signInWithGoogle({ credential: idToken, confirmMerge });
    if (result.status === "merge_consent") {
      Alert.alert(
        "Link accounts?",
        `An account already exists for ${result.email || "this email"}. Link your Google account to it? You'll keep your profile, rating and purchases, and can sign in either way.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Link accounts",
            onPress: () => {
              setGoogleLoading(true);
              runGoogle(true, idToken)
                .catch((err) => {
                  setGeneralError(
                    err instanceof AuthError ? err.message : "Could not link accounts. Try again.",
                  );
                })
                .finally(() => setGoogleLoading(false));
            },
          },
        ],
      );
      return;
    }
    router.replace("/(tabs)");
  };

  const onGoogle = async () => {
    if (busy) return;
    setGeneralError("");
    setGoogleLoading(true);
    try {
      await runGoogle(false);
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        // User cancelling shouldn't look like an error — just reset.
        if (err.code !== "cancelled") setGeneralError(err.message);
      } else if (err instanceof AuthError) {
        setGeneralError(err.message);
      } else {
        setGeneralError("Google sign-in failed. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const openReset = () => {
    setResetStep("email");
    setResetEmail(username.includes("@") ? username.trim() : "");
    setResetCode("");
    setResetNewPw("");
    setResetError("");
    setResetInfo("");
    setResetOpen(true);
  };

  const onSendResetCode = async () => {
    const email = resetEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setResetError("Enter a valid email address.");
      return;
    }
    setResetBusy(true);
    setResetError("");
    try {
      await requestPasswordReset(email);
      setResetInfo("If that email is registered, a 6-digit code is on its way. It expires in 15 minutes.");
      setResetStep("code");
    } catch (err) {
      setResetError(err instanceof AuthError ? err.message : "Could not send the code. Try again.");
    } finally {
      setResetBusy(false);
    }
  };

  const onConfirmReset = async () => {
    if (resetCode.trim().length !== 6) {
      setResetError("Enter the 6-digit code from the email.");
      return;
    }
    if (resetNewPw.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }
    setResetBusy(true);
    setResetError("");
    try {
      await resetPasswordWithCode({
        email: resetEmail,
        code: resetCode,
        newPassword: resetNewPw,
      });
      setResetOpen(false);
      setPassword("");
      setGeneralError("");
      Alert.alert("Password reset", "Your password was updated. Sign in with the new password.");
    } catch (err) {
      setResetError(err instanceof AuthError ? err.message : "Reset failed. Try again.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[4] }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand block ─────────────────────────────────────────── */}
          <View style={styles.brand}>
            <Text style={styles.brandMark}>
              <Text style={styles.brandPenta}>PENTA</Text>
              <Text style={styles.brandProtocol}>PROTOCOL</Text>
            </Text>
            <View style={styles.brandRule} />
            <Text style={styles.brandTag}>SIGN IN</Text>
          </View>

          {__DEV__ ? (
            <Text style={styles.devApiHint} selectable>
              API: {getApiBaseUrl()}
            </Text>
          ) : null}

          {/* ── Username / email field ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Username or email</Text>
            <TextInput
              value={username}
              onChangeText={(v) => {
                setUsername(v);
                if (fieldErrors.username) setFieldErrors((e) => ({ ...e, username: undefined }));
              }}
              placeholder="you@example.com"
              placeholderTextColor={colors.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              style={[styles.input, fieldErrors.username && styles.inputError]}
              editable={!busy}
            />
            {fieldErrors.username ? <Text style={styles.fieldError}>{fieldErrors.username}</Text> : null}
          </View>

          {/* ── Password field with show/hide toggle ────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined }));
                }}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textDim}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                style={[styles.input, styles.passwordInput, fieldErrors.password && styles.inputError]}
                editable={!busy}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={12}
                style={styles.eyeBtn}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Text style={styles.eyeLabel}>{showPassword ? "HIDE" : "SHOW"}</Text>
              </Pressable>
            </View>
            {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
            <Pressable onPress={openReset} hitSlop={8} style={{ alignSelf: "flex-end", marginTop: space[2] }}>
              <Text style={styles.footerLink}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* ── Server-side error banner ────────────────────────────── */}
          {generalError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{generalError}</Text>
            </View>
          ) : null}

          {/* ── Primary CTA ─────────────────────────────────────────── */}
          <Pressable
            onPress={onSubmit}
            disabled={busy}
            android_ripple={{ color: colors.accentDeep }}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.primaryBtnPressed,
              busy && styles.primaryBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.primaryBtnLabel}>SIGN IN</Text>
            )}
          </Pressable>

          {isGoogleSignInAvailable() ? (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                onPress={onGoogle}
                disabled={busy}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                style={({ pressed }) => [
                  styles.googleBtn,
                  pressed && styles.googleBtnPressed,
                  busy && styles.googleBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy: googleLoading }}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.textInverse} />
                ) : (
                  <Text style={styles.googleBtnLabel}>Continue with Google</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {/* ── Footer ──────────────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account?</Text>
            <Pressable onPress={() => router.push("/(auth)/signup")} hitSlop={8}>
              <Text style={styles.footerLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── 2FA challenge modal ─────────────────────────────────────── */}
      <Modal
        visible={twoFaToken !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTwoFaToken(null)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>TWO-FACTOR CHECK</Text>
            <Text style={styles.modalBody}>
              Enter the 6-digit code from your authenticator app.
            </Text>
            <TextInput
              value={twoFaCode}
              onChangeText={(v) => {
                setTwoFaCode(v.replace(/[^0-9]/g, ""));
                if (twoFaError) setTwoFaError("");
              }}
              placeholder="000000"
              placeholderTextColor={colors.textDim}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              style={[styles.input, styles.codeInput, twoFaError ? styles.inputError : null]}
              editable={!twoFaBusy}
              onSubmitEditing={onSubmit2fa}
            />
            {twoFaError ? <Text style={styles.fieldError}>{twoFaError}</Text> : null}
            <Pressable
              onPress={onSubmit2fa}
              disabled={twoFaBusy}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
                twoFaBusy && styles.primaryBtnDisabled,
                { marginTop: space[4] },
              ]}
            >
              {twoFaBusy ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.primaryBtnLabel}>VERIFY</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setTwoFaToken(null)} hitSlop={8} style={styles.modalCancel}>
              <Text style={styles.footerLink}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Forgot-password modal ───────────────────────────────────── */}
      <Modal
        visible={resetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetOpen(false)}
      >
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>RESET PASSWORD</Text>
            {resetStep === "email" ? (
              <>
                <Text style={styles.modalBody}>
                  Enter your account email — we&apos;ll send a 6-digit reset code.
                </Text>
                <TextInput
                  value={resetEmail}
                  onChangeText={(v) => {
                    setResetEmail(v);
                    if (resetError) setResetError("");
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={[styles.input, resetError ? styles.inputError : null]}
                  editable={!resetBusy}
                  onSubmitEditing={onSendResetCode}
                />
                {resetError ? <Text style={styles.fieldError}>{resetError}</Text> : null}
                <Pressable
                  onPress={onSendResetCode}
                  disabled={resetBusy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    resetBusy && styles.primaryBtnDisabled,
                    { marginTop: space[4] },
                  ]}
                >
                  {resetBusy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.primaryBtnLabel}>SEND CODE</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                {resetInfo ? <Text style={styles.modalBody}>{resetInfo}</Text> : null}
                <TextInput
                  value={resetCode}
                  onChangeText={(v) => {
                    setResetCode(v.replace(/[^0-9]/g, ""));
                    if (resetError) setResetError("");
                  }}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textDim}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.input, styles.codeInput]}
                  editable={!resetBusy}
                />
                <TextInput
                  value={resetNewPw}
                  onChangeText={(v) => {
                    setResetNewPw(v);
                    if (resetError) setResetError("");
                  }}
                  placeholder="New password (8+ characters)"
                  placeholderTextColor={colors.textDim}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.input, { marginTop: space[3] }]}
                  editable={!resetBusy}
                  onSubmitEditing={onConfirmReset}
                />
                {resetError ? <Text style={styles.fieldError}>{resetError}</Text> : null}
                <Pressable
                  onPress={onConfirmReset}
                  disabled={resetBusy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.primaryBtnPressed,
                    resetBusy && styles.primaryBtnDisabled,
                    { marginTop: space[4] },
                  ]}
                >
                  {resetBusy ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.primaryBtnLabel}>SET NEW PASSWORD</Text>
                  )}
                </Pressable>
                <Pressable onPress={onSendResetCode} hitSlop={8} style={styles.modalCancel} disabled={resetBusy}>
                  <Text style={styles.footerLink}>Resend code</Text>
                </Pressable>
              </>
            )}
            <Pressable onPress={() => setResetOpen(false)} hitSlop={8} style={styles.modalCancel}>
              <Text style={styles.footerText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[5],
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: space[6],
  },

  brand: {
    alignItems: "center",
    marginBottom: space[9],
  },
  brandMark: {
    fontSize: fontSizes["2xl"],
    fontWeight: "900",
    letterSpacing: 4,
  },
  brandPenta: {
    color: colors.text,
  },
  brandProtocol: {
    color: colors.accent,
  },
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
  devApiHint: {
    color: colors.textDim,
    fontSize: fontSizes.xs,
    textAlign: "center",
    marginBottom: space[4],
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  field: {
    marginBottom: space[4],
  },
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
    // 48 pt minimum height gives finger-friendly touch + a stable
    // baseline for the show/hide affordance to sit against.
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.danger,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 64,
  },
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
  fieldError: {
    color: colors.danger,
    fontSize: fontSizes.xs,
    marginTop: space[2],
  },

  errorBanner: {
    backgroundColor: "rgba(204,0,0,0.10)",
    borderWidth: 1,
    borderColor: "rgba(204,0,0,0.4)",
    borderRadius: radii.md,
    padding: space[3],
    marginBottom: space[4],
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: space[4],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    marginTop: space[2],
  },
  primaryBtnPressed: {
    backgroundColor: colors.accentDeep,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnLabel: {
    color: colors.text,
    fontSize: fontSizes.base,
    fontWeight: "800",
    letterSpacing: 2,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: space[5],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textDim,
    fontSize: fontSizes.xs,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginHorizontal: space[3],
  },

  googleBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    paddingVertical: space[4],
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  googleBtnPressed: {
    backgroundColor: "#EAEAEA",
  },
  googleBtnDisabled: {
    opacity: 0.55,
  },
  googleBtnLabel: {
    color: colors.textInverse,
    fontSize: fontSizes.base,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: space[5],
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderAccent,
    padding: space[5],
  },
  modalTitle: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontWeight: "900",
    letterSpacing: 2.4,
    marginBottom: space[3],
  },
  modalBody: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    marginBottom: space[4],
  },
  codeInput: {
    letterSpacing: 6,
    textAlign: "center",
    fontWeight: "800",
  },
  modalCancel: {
    alignSelf: "center",
    marginTop: space[4],
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: space[2],
    marginTop: space[7],
  },
  footerText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  footerLink: {
    color: colors.accent,
    fontSize: fontSizes.sm,
    fontWeight: "700",
  },
});
