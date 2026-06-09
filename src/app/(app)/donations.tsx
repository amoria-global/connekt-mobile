import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { donate, getDonationTiers, listDonations, type Donation } from '@/features/donations/api';
import { listCurrencies, type Currency } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

const FALLBACK_TIERS = [1000, 5000, 10000, 25000];

export default function DonationsScreen() {
  const history = useAsync(useCallback(() => listDonations(), []));

  const [tiers, setTiers] = useState<number[]>(FALLBACK_TIERS);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getDonationTiers()
      .then((t) => t.length && setTiers(t.map((x) => x.amount)))
      .catch(() => {});
    listCurrencies()
      .then(setCurrencies)
      .catch(() => {});
  }, []);

  const currency = currencies[0];

  const onDonate = async () => {
    setError(null);
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) return setError('Enter a valid amount.');
    if (!currency) return setError('Currencies unavailable. Try again shortly.');
    setSubmitting(true);
    try {
      await donate({ amount: value, currencyId: currency.id, message });
      setDone(true);
      setAmount('');
      setMessage('');
      await history.refresh();
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not submit your donation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Donate" subtitle="Support the Connekyt community" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.tierRow}>
          {tiers.map((t) => (
            <Pressable
              key={t}
              onPress={() => setAmount(String(t))}
              style={[styles.tier, amount === String(t) && styles.tierActive]}
            >
              <Text style={[styles.tierText, amount === String(t) && styles.tierTextActive]}>
                {currency?.symbol ?? ''}
                {t.toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Enter an amount" />
        <Input label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Say something nice" multiline style={styles.multiline} />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {done ? <Text style={styles.success}>Thank you for your donation! 💛</Text> : null}

        <Button title="Donate" onPress={onDonate} loading={submitting} />

        <Text style={styles.historyTitle}>Your donations</Text>
        {history.loading && !history.data ? (
          <ActivityIndicator color={colors.primary} />
        ) : history.data?.length ? (
          history.data.map((d) => <DonationRow key={d.id} donation={d} />)
        ) : (
          <Text style={styles.muted}>You haven&apos;t donated yet.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function DonationRow({ donation }: { donation: Donation }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        {donation.message ? (
          <Text style={styles.rowMsg} numberOfLines={1}>
            {donation.message}
          </Text>
        ) : (
          <Text style={styles.rowMsg}>Donation</Text>
        )}
        {donation.createdAt ? <Text style={styles.rowDate}>{formatDate(donation.createdAt)}</Text> : null}
      </View>
      <Text style={styles.rowAmount}>{formatMoney(donation.amount, donation.currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tierActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tierText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  tierTextActive: { color: colors.textOnPrimary },
  multiline: { height: 88, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  success: { color: colors.success, fontSize: fontSize.sm, textAlign: 'center' },
  historyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  rowMsg: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
  rowDate: { fontSize: fontSize.xs, color: colors.textMuted },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
});
