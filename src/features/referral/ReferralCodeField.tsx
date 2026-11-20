/**
 * "Referral code or link" input with live server validation. Used at sign-up (public check, optional, never blocks
 * the form) and in Preferences (the signed-in check with the full account rules). It accepts a bare code or a full
 * link, validates as the user types after a short pause, and shows who the code belongs to.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { makeStyles, spacing } from '@/theme';
import { HowItCountsSheet } from './HowReferralsCount';
import { checkCode, fill, parseReferralCode, useMilestoneCopy, useReferralStrings, type CheckResult } from './referral';

type State = { kind: 'idle' } | { kind: 'checking' } | CheckResult;

export function ReferralCodeField({
  value,
  onChange,
  signedIn = false,
  onResult,
  editable = true,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  signedIn?: boolean;
  onResult?: (r: CheckResult | null) => void;
  editable?: boolean;
  label?: string;
}) {
  const s = useReferralStrings();
  const m = useMilestoneCopy();
  const styles = useStyles();
  const [how, setHow] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const seq = useRef(0);

  useEffect(() => {
    const raw = value.trim();
    if (!raw) {
      setState({ kind: 'idle' });
      onResult?.(null);
      return;
    }
    const code = parseReferralCode(raw);
    if (!code) {
      const bad: CheckResult = { kind: 'bad', key: 'invalid' };
      setState(bad);
      onResult?.(bad);
      return;
    }
    setState({ kind: 'checking' });
    onResult?.(null);
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const r = await checkCode(code, signedIn);
      if (mine !== seq.current) return;
      setState(r);
      onResult?.(r);
    }, 450);
    return () => clearTimeout(timer);
    // onResult is a callback from the parent and is deliberately not a dependency: it must not restart the check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, signedIn]);

  const message =
    state.kind === 'checking' ? s.field.checking
    : state.kind === 'ok' ? fill(s.field.applied, { name: state.name })
    : state.kind === 'bad' ? s.field[state.key]
    : '';

  return (
    <View style={styles.wrap}>
      <Input
        label={label ?? s.field.label}
        value={value}
        onChangeText={onChange}
        placeholder={s.field.placeholder}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={editable}
        testID="referral-code-input"
        accessibilityLabel={label ?? s.field.label}
      />
      <View style={styles.statusRow}>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, state.kind === 'ok' && styles.ok, state.kind === 'bad' && styles.bad]}
          testID="referral-code-status"
        >
          {message}
        </Text>
        {value && editable ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel={s.field.remove} hitSlop={12}>
            <Text style={styles.remove}>{s.field.remove}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.helper} testID="referral-field-helper">{m.fieldHelper}</Text>
      <Pressable onPress={() => setHow(true)} accessibilityRole="link" hitSlop={10} testID="referral-field-how">
        <Text style={styles.remove}>{m.howTitle}</Text>
      </Pressable>
      <HowItCountsSheet visible={how} onClose={() => setHow(false)} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md, minHeight: 18 },
  status: { flex: 1, fontSize: 12.5, color: c.textMuted },
  ok: { color: c.success },
  bad: { color: c.error },
  helper: { fontSize: 12.5, lineHeight: 17, color: c.textMuted },
  remove: { fontSize: 12.5, fontWeight: '700', color: c.link },
}));
