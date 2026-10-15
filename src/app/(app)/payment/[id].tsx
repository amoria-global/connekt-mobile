import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import { getPayment } from '@/features/payments/api';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { canPayDeclarationHere } from '@/features/payments/policy';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

export default function PaymentDetailScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getPayment(id, role), [id, role]),
  );
  const [paying, setPaying] = useState(false);

  // Only a booking (or the extra-photos add-on) is something the user owes; the
  // server refuses every other declaration type. Digital ones stay view-only.
  const payable =
    /pending|partial/i.test(data?.status ?? '') && canPayDeclarationHere(data?.paymentType);

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Could not open this payment</Text>
          <Text style={styles.muted}>{error}</Text>
          <Button title="Try again" variant="ghost" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{data?.title}</Text>
          <Text style={styles.amount}>{data?.amount != null ? formatPrice(data.amount, data.currency) : '—'}</Text>
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
            <Button title="Pay now" onPress={() => setPaying(true)} />
            <Text style={styles.webNote}>
              The amount due is fixed to your booking balance.
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <HandoffCheckoutSheet
        visible={paying}
        onClose={() => setPaying(false)}
        onSettled={() => void refresh()}
        handoff={{ type: 'BOOKING_DECLARATION', declarationId: data?.declarationId || id }}
        title={data?.title ?? 'Payment'}
        subtitle={data?.photographerName}
        amountLabel={data?.amount != null ? formatPrice(data.amount, data.currency) : undefined}
      />
    </Screen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  errorTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  amountCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
  },
  amountLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.textSoft, textAlign: 'center' },
  amount: { fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  rowLabel: { fontSize: fontSize.sm, color: c.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  mono: { fontFamily: 'monospace' },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  body: { fontSize: fontSize.md, color: c.textSoft, lineHeight: 24 },
  webNote: { textAlign: 'center', color: c.textMuted, fontSize: fontSize.xs },
}));
