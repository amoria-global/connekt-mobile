import { forwardRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { darkPalette, fonts, shadows, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
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
          focused && styles.inputRowFocused,
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
    fontFamily: fonts.semibold,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  // Midnight Glass fields sit inset: a sunk well with an inner shadow, the rim lighting on focus.
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.stroke,
    borderRadius: radii.md,
    backgroundColor: c.well,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: c.text,
  },
  // Light: a milky field that still shows the glass behind it. Dark: a faint
  // lift off the smoked panel; a white wash would glow.
  // On glass the well is the same; kept as its own style so a glass panel can still tune it.
  inputRowGlass: {},
  inputRowGlassFocused: {},
  inputRowFocused: { borderColor: c.primaryLight },
  eye: { paddingHorizontal: spacing.md },
  well: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
    padding: spacing.md,
  },
  inputError: { borderColor: c.error },
  error: { fontSize: fontSize.xs, color: c.error },
}));

/** The kit name for the inset field. */
export const InsetField = Input;

/**
 * An inset well that is not a field: the sunk panel inside a glass card that holds a value or a
 * linked account (Pending release, the connected Instagram row).
 */
export function InsetWell({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.well, style]}>{children}</View>;
}
