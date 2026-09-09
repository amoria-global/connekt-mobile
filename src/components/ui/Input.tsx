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
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  leftElement?: React.ReactNode;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, leftElement, style, secureTextEntry, ...rest },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isPassword = secureTextEntry === true;
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        {leftElement}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword ? hidden : secureTextEntry}
          style={[styles.input, style]}
          // React Native does NOT associate the sibling <Text> label with this
          // field the way <label for> does on the web, so without an explicit
          // name VoiceOver and TalkBack announce it as an unlabelled field.
          // Declared BEFORE {...rest} so a screen can still override it.
          accessibilityLabel={label}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  eye: { paddingHorizontal: spacing.md },
  inputError: { borderColor: c.error },
  error: { fontSize: fontSize.xs, color: c.error },
}));
