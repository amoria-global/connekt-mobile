import { forwardRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { darkPalette, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  leftElement?: React.ReactNode;
  /**
   * Translucent field for a glass panel (see `GlassCard`): frosted fill, a
   * rim that brightens on focus. Off by default; solid fields elsewhere.
   */
  glass?: boolean;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, leftElement, style, secureTextEntry, glass = false, onFocus, onBlur, placeholder, ...rest },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const isPassword = secureTextEntry === true;
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const translatedLabel = label ? tr(label) : undefined;
  const translatedPlaceholder = placeholder ? tr(placeholder) : undefined;

  return (
    <View style={styles.wrap}>
      {translatedLabel ? <Text style={styles.label}>{translatedLabel}</Text> : null}
      <View
        style={[
          styles.inputRow,
          glass && styles.inputRowGlass,
          glass && focused && styles.inputRowGlassFocused,
          !!error && styles.inputError,
        ]}
      >
        {leftElement}
        <TextInput
          ref={ref}
          placeholder={translatedPlaceholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword ? hidden : secureTextEntry}
          style={[styles.input, style]}
          // React Native does NOT associate the sibling <Text> label with this
          // field the way <label for> does on the web, so without an explicit
          // name VoiceOver and TalkBack announce it as an unlabelled field.
          // Declared BEFORE {...rest} so a screen can still override it.
          accessibilityLabel={translatedLabel}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={tr(hidden ? 'Show password' : 'Hide password')}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{tr(error)}</Text> : null}
    </View>
  );
});

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: c.text,
  },
  // Light: a milky field that still shows the glass behind it. Dark: a faint
  // lift off the smoked panel; a white wash would glow.
  inputRowGlass:
    c === darkPalette
      ? { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }
      : { backgroundColor: 'rgba(255,255,255,0.62)', borderColor: 'rgba(15,18,23,0.1)' },
  inputRowGlassFocused: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  eye: { paddingHorizontal: spacing.md },
  inputError: { borderColor: c.error },
  error: { fontSize: fontSize.xs, color: c.error },
}));
