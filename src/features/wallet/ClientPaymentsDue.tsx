/**
 * "Payments due" on the client wallet: bookings with something left to pay, each with its own Pay now.
 *
 * Reads the same pending-payments feed as the Home. Those amounts are USD ledger values, so they are
 * formatted as USD. A failed read is an error with a retry, never "nothing to pay", and an amount that
 * is hidden by the wallet's privacy toggle stays hidden here too.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { getCustomerPendingPayments, type PendingPayment } from '@/features/analytics/api';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { DUE_CURRENCY, dueText, payable, remaining } from '@/features/client/homeModel';
import { ActionButton, Card, EmptyNote, ErrorNotice, IconTile, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
import { moneyText } from '@/features/photographer/money';
import { useAsync } from '@/hooks/useAsync';
import { useSharedT } from '@/i18n/sharedStrings';
import { makeStyles, spacing } from '@/theme';

export function ClientPaymentsDue({ hidden, version }: { hidden: boolean; version?: unknown }) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const [paying, setPaying] = useState<PendingPayment | null>(null);
  const dues = useMemo(() => payable(pending.data ?? []), [pending.data]);

  // The wallet's own pull-to-refresh changes `version`; follow it quietly.
  // Not on mount: a quiet tick then would supersede the first request and swallow its failure.
  const { refreshQuietly } = pending;
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    void refreshQuietly();
  }, [version, refreshQuietly]);

  return (
    <View>
      <SectionHeader
        title="Payments due"
        subtitle={dues.length > 0 ? `${dues.length} booking${dues.length === 1 ? '' : 's'} waiting for payment` : undefined}
      />
      {pending.error && !pending.data ? (
        <ErrorNotice message={pending.error} onRetry={pending.refresh} />
      ) : pending.loading && !pending.data ? (
        <SkeletonCard height={110} />
      ) : dues.length === 0 ? (
        <EmptyNote compact icon="checkmark-circle-outline" title="Nothing to pay" body="Bookings with a balance appear here." />
      ) : (
        <View style={styles.list}>
          {dues.map((p) => {
            const failed = p.status === 'failed';
            const due = dueText(p);
            const amount = moneyText(remaining(p), DUE_CURRENCY, hidden);
            return (
              <Card key={p.id}>
                <View style={styles.top}>
                  <IconTile icon={failed ? 'alert-circle-outline' : 'time-outline'} tone={failed ? 'error' : 'warning'} />
                  <View style={styles.text}>
                    <Text style={styles.title} numberOfLines={1}>
                      {p.eventName}
                    </Text>
                    <Text style={styles.meta} numberOfLines={2}>
                      {failed ? tr('Payment failed') : p.status === 'partially_paid' ? tr('Balance due') : tr('Payment due')}
                      {due ? ` · ${tr('Due')} ${tr(due)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.amount} accessibilityLabel={`${amount} to pay`}>
                    {amount}
                  </Text>
                </View>
                <ActionButton label={failed ? 'Try again' : 'Pay now'} variant="primary" compact onPress={() => setPaying(p)} />
              </Card>
            );
          })}
        </View>
      )}
      <PayNowSheet
        payment={paying}
        visible={!!paying}
        onClose={() => setPaying(null)}
        onSuccess={() => {
          void pending.refresh();
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  text: { flex: 1, minWidth: 0 },
  title: { color: c.text, fontSize: 16, fontWeight: '700' },
  meta: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  amount: { color: c.text, fontSize: 17, fontWeight: '800', maxWidth: '40%' },
}));
