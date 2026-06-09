import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  listWithdrawalMethods,
  listWithdrawals,
  requestWithdrawal,
} from '@/features/withdrawals/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function WithdrawScreen() {
  const methods = useAsync(useCallback(() => listWithdrawalMethods(), []));
  const history = useAsync(useCallback(() => listWithdrawals(), []));

  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!methodId) {
      setError('Select a payout method.');
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal({ amount: value, withdrawalMethodId: methodId });
      setAmount('');
      Alert.alert('Requested', 'Your withdrawal request has been submitted.');
      await history.refresh();
    } catch (e) {
      setError(e instanceof Object && 'message' in e ? String((e as { message: string }).message) : 'Failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Withdraw" subtitle="Cash out your earnings" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amount</Text>
          <Input placeholder="0" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout method</Text>
          {methods.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : methods.data?.length ? (
            methods.data.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMethodId(m.id)}
                style={[styles.method, methodId === m.id && styles.methodActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodName}>{m.name}</Text>
                  {m.accountNumber ? <Text style={styles.methodAcc}>{m.accountNumber}</Text> : null}
                </View>
                {methodId === m.id ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.muted}>
              No payout methods saved. Add one on the web app first.
            </Text>
          )}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Request withdrawal" onPress={onSubmit} loading={submitting} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent requests</Text>
          {history.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : history.data?.length ? (
            history.data.map((w) => (
              <View key={w.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyAmount}>{formatMoney(w.amount, w.currency)}</Text>
                  {w.requestedAt ? <Text style={styles.muted}>{formatDate(w.requestedAt)}</Text> : null}
                </View>
                <StatusPill status={w.status} />
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No withdrawals yet.</Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  methodName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  methodAcc: { fontSize: fontSize.sm, color: colors.textMuted },
  check: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  historyAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
