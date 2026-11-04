import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, TextInput, View } from 'react-native';

import { useSharedT } from '@/i18n/sharedStrings';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { glassTile } from './GlassCard';

/**
 * One real text input drawn as six boxes.
 *
 * It is a single field underneath so the OS treats it as one code: SMS and email
 * autofill (`one-time-code`), paste, and a screen reader all see one control
 * instead of six. The boxes are only a picture of its value.
 *
 *   - digits only; spaces and dashes in a pasted code are dropped
 *   - `onComplete` fires once per code, when the sixth digit lands
 *   - `busy` locks the field while the server checks, so a second submit cannot start
 *   - `shakeKey` runs the wrong-code shake and the field clears and refocuses
 *   - the code is never validated here; the server decides
 */

export const OTP_LENGTH = 6;

/** Keeps digits only and cuts to six. Exported for tests. */
export function cleanOtp(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Shown under the boxes, in the error tone, and announced to screen readers. */
  error?: string;
  /** Neutral line under the boxes, such as "3 attempts left". */
  hint?: string;
  label?: string;
  editable?: boolean;
  /** True while the server is checking: the field locks and the boxes dim. */
  busy?: boolean;
  /** Set after a verified code to show the success tone. */
  success?: boolean;
  /** Fired once the sixth digit lands, so callers can auto-submit. */
  onComplete?: (code: string) => void;
  /** Change this number to run the wrong-code shake. */
  shakeKey?: number;
  /** Translucent boxes for a glass panel; see `Input`'s `glass`. */
  glass?: boolean;
};

export function OtpInput({
  value,
  onChange,
  error,
  hint,
  label,
  editable = true,
  busy = false,
  success = false,
  onComplete,
  shakeKey = 0,
  glass = false,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const reduceMotion = useReducedMotion();
  const input = useRef<TextInput>(null);
  const [shake] = useState(() => new Animated.Value(0));
  const lastCompleted = useRef('');
  const locked = !editable || busy || success;

  // A cleared field is a fresh attempt: allow the next full code to submit.
  useEffect(() => {
    if (value.length < OTP_LENGTH) lastCompleted.current = '';
  }, [value]);

  // Wrong code: shake, then hand the field back focused.
  useEffect(() => {
    if (!shakeKey) return;
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -8, duration: 70, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 5, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
    input.current?.focus();
  }, [shakeKey, reduceMotion, shake]);

  const handleChange = (raw: string) => {
    if (locked) return;
    const next = cleanOtp(raw);
    onChange(next);
    if (next.length === OTP_LENGTH && lastCompleted.current !== next) {
      lastCompleted.current = next;
      onComplete?.(next);
    }
  };

  const active = value.length < OTP_LENGTH ? value.length : OTP_LENGTH - 1;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{tr(label)}</Text> : null}

      <Animated.View style={{ transform: [{ translateX: shake }] }}>
        <Pressable
          onPress={() => input.current?.focus()}
          accessible={false}
          style={[styles.row, busy && styles.dim]}
        >
          {Array.from({ length: OTP_LENGTH }).map((_, i) => {
            const char = value[i] ?? '';
            const focused = !locked && i === active;
            return (
              <View
                key={i}
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.box,
                  glass && styles.boxGlass,
                  !!char && styles.boxFilled,
                  glass && !!char && styles.boxGlassFilled,
                  focused && styles.boxActive,
                  !!error && styles.boxError,
                  success && styles.boxSuccess,
                ]}
              >
                <Text style={styles.digit}>{char}</Text>
              </View>
            );
          })}

          {/* The real control. Transparent and stretched over the boxes so a tap anywhere lands on it. */}
          <TextInput
            ref={input}
            style={styles.field}
            value={value}
            onChangeText={handleChange}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoCorrect={false}
            maxLength={OTP_LENGTH + 4}
            editable={!locked}
            caretHidden
            autoFocus
            contextMenuHidden={false}
            accessibilityLabel={label ? tr(label) : tr('Verification code')}
            accessibilityHint={tr('Enter the 6 digit code')}
            selectionColor={colors.primary}
          />
        </Pressable>
      </Animated.View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="assertive" accessibilityRole="alert">
          {tr(error)}
        </Text>
      ) : null}
      {hint ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {tr(hint)}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  dim: { opacity: 0.6 },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxGlass: glassTile(c),
  boxFilled: { borderColor: c.primary },
  boxGlassFilled: { backgroundColor: c.tint },
  boxActive: { borderColor: c.primary, borderWidth: 2 },
  boxError: { borderColor: c.error },
  boxSuccess: { borderColor: c.success },
  digit: { color: c.text, fontSize: 22, fontWeight: fontWeight.bold },
  field: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.02,
    color: 'transparent',
  },
  error: { fontSize: fontSize.xs, color: c.error },
  hint: { fontSize: fontSize.xs, color: c.textMuted },
}));
