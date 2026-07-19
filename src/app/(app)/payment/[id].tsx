import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import { getPayment } from '@/features/payments/api';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getPayment(id, role), [id, role]),
  );
  const [opening, setOpening] = useState(false);

  // Unsettled declarations can be completed on the connekyt.com checkout —
  // the app never collects payment details itself.
  const payable = /pending|partial/i.test(data?.status ?? '');

  const onCompleteOnWeb = async () => {
    if (!id || opening) return;
    setOpening(true);
    try {
      const url = await mintHandoffUrl('BOOKING_DECLARATION', { declarationId: id });
      await openWebCheckout(url);
      // Re-fetch after the browser closes so a settled payment shows as paid.
      await refresh();
    } catch (e) {
      Alert.alert(
        'Could not open checkout',
        isApiError(e) ? e.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setOpening(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{data?.title}</Text>
          <Text style={styles.amount}>{data?.amount != null ? formatMoney(data.amount, data.currency) : '—'}</Text>
          <StatusPill status={data?.status} />
        </View>

        <View style={styles.card}>
          {data?.paymentType ? <Row label="Type" value={data.paymentType} /> : null}
          {data?.method ? <Row label="Method" value={data.method} /> : null}
          {data?.photographerName ? <Row label="Photographer" value={data.photographerName} /> : null}
          {data?.createdAt ? <Row label="Date" value={formatDate(data.createdAt)} /> : null}
          {data?.reference ? <Row label="Reference" value={data.reference} mono /> : null}
        </View>

        {data?.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note</Text>
            <Text style={styles.body}>{data.description}</Text>
          </View>
        ) : null}

        {payable ? (
          <View style={styles.section}>
            <Button
              title="Complete payment on connekyt.com"
              onPress={onCompleteOnWeb}
              loading={opening}
              disabled={opening}
            />
            <Text style={styles.webNote}>
              You&apos;ll finish this payment on the connekyt.com secure checkout.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  amountCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
  },
  amountLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textSoft, textAlign: 'center' },
  amount: { fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  mono: { fontFamily: 'monospace' },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  body: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 24 },
  webNote: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs },
});
