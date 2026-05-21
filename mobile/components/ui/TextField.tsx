/**
 * ``<TextField />`` — labelled native ``TextInput`` with built-in
 * error / hint / count slots.
 *
 * v1 surface is deliberately small:
 *   - label (always shown above)
 *   - hint (subtle help text)
 *   - error (replaces the hint when set, in danger color)
 *   - characterCount (max ⇒ shows ``n / max`` aligned right)
 *
 * Multiline + secureTextEntry + keyboardType are passed through to
 * the underlying ``TextInput`` so screens don't lose any standard
 * behavior. The component is uncontrolled-friendly: pass ``value``
 * + ``onChangeText`` for a controlled field, or just ``defaultValue``
 * + ``onChangeText`` for a one-shot edit.
 */

import { forwardRef } from "react";
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";

import { colors, fonts, fontSizes, radii, space } from "@/theme/tokens";

import { Caption } from "./Text";

export interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  /** Optional max-length indicator. Doesn't enforce — pair with ``maxLength``. */
  characterCount?: { current: number; max: number };
  /** Style escape hatch for the outer container. */
  containerStyle?: ViewStyle;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, characterCount, containerStyle, style, multiline, ...rest },
  ref,
) {
  const hasError = !!error;
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Caption tone={hasError ? "danger" : "muted"} style={styles.label}>
        {label.toUpperCase()}
      </Caption>
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.textDim}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          hasError ? styles.inputError : null,
          style,
        ]}
        {...rest}
      />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          {hasError ? (
            <Caption tone="danger">{error}</Caption>
          ) : hint ? (
            <Caption tone="muted">{hint}</Caption>
          ) : null}
        </View>
        {characterCount ? (
          <Caption
            tone={characterCount.current > characterCount.max ? "danger" : "muted"}
          >
            {characterCount.current} / {characterCount.max}
          </Caption>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  label: {
    marginBottom: space[2],
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: "top",
    paddingTop: space[3],
  },
  inputError: {
    borderColor: colors.danger,
  },
  footer: {
    marginTop: space[2],
    flexDirection: "row",
    alignItems: "center",
  },
});
