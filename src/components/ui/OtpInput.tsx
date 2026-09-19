import { useEffect, useRef } from 'react';
import { Text, TextInput, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';

import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

/**
 * Six single-digit boxes for a verification code.
 *
 * Mirrors the web client's behaviour (knockout verify-otp.tsx):
 *   • typing a digit fills the box and advances focus
 *   • Backspace on an empty box steps back to the previous one
 *   • pasting a code fills every box and focuses the next empty one
 *   • only digits are accepted
 *
 * Mobile previously used one plain field, so a mistyped digit meant clearing
 * the whole code, and the two clients looked nothing alike.
 *
 * iOS SMS autofill delivers the whole code to the FIRST box in one event, so
 * `onChangeText` handles a multi-character value by distributing it across the
 * boxes rather than truncating to one digit.
 */

const LENGTH = 6;

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Shown under the boxes, in the error tone when `error` is set. */
  error?: string;
  label?: string;
  editable?: boolean;
  /** Fired once the sixth digit lands, so callers can auto-submit. */
  onComplete?: (code: string) => void;
};

export function OtpInput({ value, onChange, error, label, editable = true, onComplete }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const refs = useRef<(TextInput | null)[]>([]);

  const digits = value.padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  useEffect(() => {
    if (!value) {
      refs.current[0]?.focus();
    }
  }, [value]);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    // A multi-digit value means a paste or iOS SMS autofill: spread it from
    // this box onward instead of keeping only the first character.
    if (typed.length > 1) {
      const next = (value.slice(0, index) + typed).replace(/\D/g, '').slice(0, LENGTH);
      commit(next);
      refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
      return;
    }

    const chars = value.padEnd(LENGTH, ' ').split('');
    chars[index] = typed;
    const next = chars.join('').replace(/\s+$/, '').slice(0, LENGTH);
    commit(next);
    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    const chars = value.padEnd(LENGTH, ' ').split('');
    if (!chars[index]?.trim() && index > 0) {
      // Empty box: step back and clear the previous digit.
      chars[index - 1] = ' ';
      onChange(chars.join('').replace(/\s+$/, ''));
      refs.current[index - 1]?.focus();
      return;
    }
    chars[index] = ' ';
    onChange(chars.join('').replace(/\s+$/, ''));
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.row}>
        {Array.from({ length: LENGTH }).map((_, i) => {
          const char = digits[i]?.trim() ?? '';
          return (
            <TextInput
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              style={[styles.box, !!char && styles.boxFilled, !!error && styles.boxError]}
              value={char}
              onChangeText={(t) => handleChange(i, t)}
              onKeyPress={(e) => handleKeyPress(i, e)}
              keyboardType="number-pad"
              // Only the first box declares this: iOS fills a code group's
              // leading field, and handleChange spreads it across the rest.
              textContentType={i === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LENGTH}
              editable={editable}
              selectTextOnFocus
              accessibilityLabel={`Digit ${i + 1} of ${LENGTH}`}
              placeholderTextColor={colors.textMuted}
            />
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: fontWeight.bold,
  },
  boxFilled: { borderColor: c.primary },
  boxError: { borderColor: c.error },
  error: { fontSize: fontSize.xs, color: c.error },
}));
