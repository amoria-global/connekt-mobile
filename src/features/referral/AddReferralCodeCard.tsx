/**
 * "Add a referral code" for an existing photographer (Preferences). Validates as they type, shows "Referred by Jane D."
 * and asks for a confirm because the referrer can never be changed. Once saved, or when the account already has a
 * referrer, only the name is shown, read-only.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sheet } from '@/components/ui/Sheet';
import { makeStyles, spacing } from '@/theme';
import { ReferralCodeField } from './ReferralCodeField';
import { attachCode, fetchMyReferral, fill, useReferralStrings, type CheckResult, type ReferralStats } from './referral';

export function AddReferralCodeCard({ initialCode = '' }: { initialCode?: string }) {
  const s = useReferralStrings();
  const styles = useStyles();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState(initialCode);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyReferral().then(setStats).catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!stats) return <Skeleton height={64} />;
  if (stats.hasReferrer) {
    return (
      <View testID="referrer-readonly" style={styles.wrap}>
        <Text style={styles.title}>{s.ui.addCode}</Text>
        <Text style={styles.body}>{fill(s.ui.referredBy, { name: stats.referrerName || '' })}</Text>
      </View>
    );
  }

  const save = async () => {
    if (check?.kind !== 'ok') return;
    setBusy(true);
    setError('');
    const r = await attachCode(check.code);
    setBusy(false);
    setConfirming(false);
    if (r.ok) setStats({ ...stats, hasReferrer: true, referrerName: r.referrerName || check.name });
    else setError(s.field[r.key ?? 'error']);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{s.ui.addCode}</Text>
      <Text style={styles.body}>{s.ui.addCodeHelp}</Text>
      <ReferralCodeField value={value} onChange={setValue} signedIn onResult={setCheck} label={s.ui.addCode} />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <PrimaryButton title={s.ui.confirm} disabled={check?.kind !== 'ok'} onPress={() => setConfirming(true)} />
      <Sheet visible={confirming} title={s.ui.confirmTitle} onClose={() => setConfirming(false)}>
        <View style={styles.wrap}>
          <Text style={styles.title}>{check?.kind === 'ok' ? fill(s.ui.referredBy, { name: check.name }) : ''}</Text>
          <Text style={styles.body}>{s.ui.confirmWarning}</Text>
          <PrimaryButton title={s.ui.confirm} loading={busy} onPress={save} />
          <GhostButton title={s.ui.cancel} onPress={() => setConfirming(false)} />
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  title: { fontSize: 15, fontWeight: '700', color: c.text },
  body: { fontSize: 13.5, color: c.textMuted },
  error: { fontSize: 13, color: c.error },
}));
