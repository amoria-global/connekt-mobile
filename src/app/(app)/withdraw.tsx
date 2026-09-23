import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import { listPaymentAccounts } from '@/features/paymentAccounts/api';
import { maskAccountNumber } from '@/features/paymentAccounts/model';
import { listWithdrawals, requestWithdrawal } from '@/features/withdrawals/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function WithdrawScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { role } = useRole();
  // Same namespace the web uses per role; this used to always read the
  // photographer path, so coordinators never saw their saved accounts.
  const methods = useAsync(useCallback(() => listPaymentAccounts(role), [role]));
  const history = useAsync(useCallback(() => listWithdrawals(), []));

  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from Payment accounts must show the account just added.
  const refreshMethods = methods.refresh;
  useFocusEffect(
    useCallback(() => {
      refreshMethods();
    }, [refreshMethods]),
  );

  // Until the user picks one, the default account is selected, as in the web
  // withdraw modal.
  const accounts = methods.data ?? [];
  const selectedId =
    methodId && accounts.some((m) => m.id === methodId)
      ? methodId
      : (accounts.find((m) => m.isDefault)?.id ?? accounts[0]?.id ?? null);

  const onSubmit = async () => {
    setError(null);
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!selectedId) {
      setError('Select a payout method.');
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal({ amount: value, withdrawalMethodId: selectedId });
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
          {methods.loading && !methods.data ? (
            <ActivityIndicator color={colors.primary} />
          ) : methods.data?.length ? (
            methods.data.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMethodId(m.id)}
                style={[styles.method, selectedId === m.id && styles.methodActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodName}>{m.label}</Text>
                  <Text style={styles.methodAcc}>
                    {[maskAccountNumber(m.accountNumber), m.accountName].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {selectedId === m.id ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.muted}>No payout accounts saved yet.</Text>
          )}
          <Pressable
            style={({ pressed }) => [styles.manage, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/payment-accounts' as Href)}
            accessibilityRole="button"
          >
            <Text style={styles.manageText}>
              {methods.data?.length ? 'Manage payment accounts' : '+ Add a payment account'}
            </Text>
          </Pressable>
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

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.textMuted, textTransform: 'uppercase' },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
  },
  methodActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  methodName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  methodAcc: { fontSize: fontSize.sm, color: c.textMuted },
  manage: { alignSelf: 'flex-start', paddingVertical: spacing.xs, minHeight: 32, justifyContent: 'center' },
  manageText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  check: { color: c.primary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  historyAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  muted: { fontSize: fontSize.sm, color: c.textMuted },
  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
