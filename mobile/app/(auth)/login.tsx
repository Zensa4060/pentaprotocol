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

import { useGameAudio } from "@/lib/audio/AudioProvider";
import { getApiBaseUrl } from "@/lib/api";
import { AuthError, signInWithGoogle, signInWithPassword } from "@/lib/auth";
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
      await signInWithPassword({ username: username.trim(), password });
      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof AuthError ? err.message : "Something went wrong. Try again.";
      setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    if (busy) return;
    setGeneralError("");
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogleNative();
      await signInWithGoogle({ credential: idToken });
      router.replace("/(tabs)");
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
