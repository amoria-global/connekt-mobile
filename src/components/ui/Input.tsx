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
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, style, secureTextEntry, ...rest },
  ref,
) {
  const isPassword = secureTextEntry === true;
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword ? hidden : secureTextEntry}
          style={[styles.input, style]}
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSoft,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  eye: { paddingHorizontal: spacing.md },
  inputError: { borderColor: colors.error },
  error: { fontSize: fontSize.xs, color: colors.error },
});
