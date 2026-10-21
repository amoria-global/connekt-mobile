/**
 * Payments — history of event payments, streaming revenue, and viewer gifts.
 *
 * Full functional parity with salo-run payments:
 *   • Pure solid theme tokens: NO LinearGradient, NO top-tear accents.
 *   • Event Payments: Total / Paid / Pending breakdown, All/Paid/Pending/Failed filters.
 *   • Instant "Pay Now" / "Retry" action on pending & failed items via PayNowSheet.
 *   • Coordinator Live Stream Revenue & Gift Earnings views matching salo-run.
 *   • Seamless link to Withdraw flow.
 */
import { useCallback, useMemo, useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActionButton, Chip, EmptyNote, ErrorNotice, SectionHeader, SegmentedTabs, SkeletonCard, StatusBadge } from '@/features/photographer/kit';
import { StatusBreakdownCard } from '@/features/client/ClientCharts';
import { ListRow } from '@/features/client/studio';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import {
  PAYMENTS_PAGE_SIZE,
  listPayments,
  listStreamingPayments,
  listGiftPayments,
  type PaymentRecord,
  type StreamingPayment,
  type GiftPayment,
} from '@/features/payments/api';
import { isOwedObligation } from '@/features/payments/policy';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { getCoordinatorPendingPayments, getCustomerPendingPayments, type PendingPayment } from '@/features/analytics/api';
import { pendingFor } from '@/features/payments/payNowLookup';
import { Alert } from '@/components/ui/dialog';
import { isApiError } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { canUsePaymentsScreen } from '@/features/payments/access';
import { paymentBucket } from '@/features/payments/statusBucket';
import { summarizePayments } from '@/features/payments/summary';
import { useStackClearance } from '@/hooks/useScrollClearance';

type Filter = 'all' | 'paid' | 'pending' | 'failed';
type Section = 'events' | 'streaming' | 'gifts';

function bucket(status?: string): Exclude<Filter, 'all'> {
  return paymentBucket(status);
}

/**
 * Bucket for a whole record. An unsettled digital declaration (a viewer's
 * unfinished ticket or gift) is not owed by the signed-in user, so it must not
 * feed the pending total, the pending banner or a pay button.
 */
type RowBucket = Exclude<Filter, 'all'> | 'unfinished';

function bucketOf(p: { status?: string; paymentType?: string }): RowBucket {
  const b = bucket(p.status);
  return b === 'pending' && !isOwedObligation(p.paymentType) ? 'unfinished' : b;
}

const STATUS_TONE: Record<RowBucket, { tone: 'success' | 'warning' | 'error' | 'neutral'; rowTone: 'primary' | 'success' | 'warning' | 'error'; label: string }> = {
  unfinished: { tone: 'neutral', rowTone: 'primary', label: 'Not completed' },
  paid: { tone: 'success', rowTone: 'success', label: 'Paid' },
  pending: { tone: 'warning', rowTone: 'warning', label: 'Pending' },
  failed: { tone: 'error', rowTone: 'error', label: 'Failed' },
};

/** Spacing between payment rows (rows are margin-inset cards, so the separator is only vertical). */
function RowGap() {
  return <View style={{ height: spacing.sm }} />;
}

function PaymentsContent() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const clearance = useStackClearance();
  const router = useRouter();
  const { role, isCoordinator } = useRole();

  const [section, setSection] = useState<Section>('events');
  const [filter, setFilter] = useState<Filter>('all');
  const [paySheetPayment, setPaySheetPayment] = useState<PendingPayment | null>(null);

  // 1. Regular booking / event payments
  const {
    data: paymentsData,
    loading: paymentsLoading,
    error: paymentsError,
    refresh: refreshPayments,
  } = useAsync(useCallback(() => listPayments(role), [role]));

  // 2. Dedicated streaming payments (Coordinator)
  const {
    data: streamingData,
    loading: streamingLoading,
    error: streamingError,
    refresh: refreshStreaming,
  } = useAsync(
    useCallback(() => (isCoordinator ? listStreamingPayments() : Promise.resolve(null)), [isCoordinator]),
  );

  // 3. Dedicated gift payments (Coordinator)
  const {
    data: giftsData,
    loading: giftsLoading,
    error: giftsError,
    refresh: refreshGifts,
  } = useAsync(
    useCallback(() => (isCoordinator ? listGiftPayments() : Promise.resolve(null)), [isCoordinator]),
  );

  const payments: PaymentRecord[] = paymentsData ?? [];

  // Totals are per currency: adding a RWF and a USD payment and labelling the sum with the first one's
  // currency invented a figure. Nothing is drawn until the list has loaded, and none after a failed read.
  const summary = useMemo(
    () =>
      paymentsData
        ? summarizePayments(paymentsData.map((p) => ({ amount: p.amount, currency: p.currency, bucket: bucketOf(p) })))
        : null,
    [paymentsData],
  );
  const single = summary && summary.totals.length === 1 ? summary.totals[0] : null;
  const pendingText = summary
    ? summary.totals
        .filter((t) => t.pending > 0)
        .map((t) => (summary.totals.length === 1 ? formatPrice(t.pending, t.currency) : formatMoney(t.pending, t.currency)))
        .join(' + ')
    : '';
  // The list is the latest page only, so it is not the person's all-time spending.
  const partial = payments.length >= PAYMENTS_PAGE_SIZE;

  const counts = useMemo(() => {
    const c = { all: payments.length, paid: 0, pending: 0, failed: 0 };
    for (const p of payments) {
      const b = bucketOf(p);
      if (b !== 'unfinished') c[b] += 1;
    }
    return c;
  }, [payments]);

  const filteredPayments = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => bucketOf(p) === filter)),
    [payments, filter],
  );

  const streamingPayments: StreamingPayment[] = streamingData?.payments ?? [];
  const totalStreamingRevenue = streamingData?.totalStreamingRevenue ?? 0;

  const giftPayments: GiftPayment[] = giftsData ?? [];
  const totalGiftRevenue = useMemo(
    () => giftPayments.filter((g) => g.status === 'completed').reduce((sum, g) => sum + g.netAmount, 0),
    [giftPayments],
  );

  const onRefresh = () => {
    if (section === 'events') refreshPayments();
    else if (section === 'streaming') refreshStreaming();
    else refreshGifts();
  };

  const currentLoading =
    section === 'events'
      ? paymentsLoading
      : section === 'streaming'
        ? streamingLoading
        : giftsLoading;

  const currentError = section === 'events' ? paymentsError : section === 'streaming' ? streamingError : giftsError;

  // What is owed comes from the pending feed (its USD balance and its real paid amount), never from the history
  // record: that carries the amount in its own currency and no paid amount, and the sheet labels it as USD.
  const [payChecking, setPayChecking] = useState(false);
  const onOpenPayNow = async (item: PaymentRecord) => {
    if (payChecking) return;
    setPayChecking(true);
    try {
      const feed = await (isCoordinator ? getCoordinatorPendingPayments() : getCustomerPendingPayments());
      const found = pendingFor(item, feed);
      if (found) {
        setPaySheetPayment(found);
      } else {
        Alert.alert('Could not confirm the balance', 'We could not confirm what is still owed on this payment. Pull down to refresh, or open it from Payments due in your wallet.');
      }
    } catch (e) {
      Alert.alert('Could not open payment', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setPayChecking(false);
    }
  };

  const retryCurrent = () => onRefresh();

  const header = (
    <View>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>FINANCE</Text>
        <Text style={styles.subtitle}>
          {isCoordinator
            ? 'Manage event payments, streaming revenue, and gifts.'
            : 'Your event payments and purchases.'}
        </Text>

        {/* Role-aware Section Switcher for Coordinators */}
        {isCoordinator ? (
          <SegmentedTabs
            label="Payment sections"
            value={section}
            onChange={setSection}
            tabs={[
              { key: 'events', label: 'Events' },
              { key: 'streaming', label: 'Streams' },
              { key: 'gifts', label: 'Gifts' },
            ]}
          />
        ) : null}

        {/* Section 1: Event Payments Summary (the one gradient hero on this screen) */}
        {section === 'events' ? (
          <>
            {summary && summary.totals.length > 0 ? (
              <LinearGradient colors={gradients.heroBlue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.totalCard}>
                <Text style={styles.totalLabel}>{isCoordinator ? 'TOTAL PAYMENTS' : 'TOTAL SPENDING'}</Text>
                {single ? (
                  <>
                    <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatPrice(single.total, single.currency)}</Text>
                    <View style={styles.totalSplit}>
                      <View style={styles.totalSplitCell}>
                        <Text style={styles.totalSplitLabel}>Paid</Text>
                        <Text style={styles.totalSplitValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPrice(single.paid, single.currency)}</Text>
                      </View>
                      <View style={styles.totalDivider} />
                      <View style={styles.totalSplitCell}>
                        <Text style={styles.totalSplitLabel}>Pending</Text>
                        <Text style={styles.totalSplitValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPrice(single.pending, single.currency)}</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.totalMixed}>Several currencies</Text>
                    {summary.totals.map((t) => (
                      <View key={t.currency} style={styles.totalCurrencyRow} accessible accessibilityLabel={`${t.currency}: ${formatMoney(t.total, t.currency)} total, ${formatMoney(t.paid, t.currency)} paid, ${formatMoney(t.pending, t.currency)} pending`}>
                        <Text style={styles.totalSplitLabel}>{t.currency}</Text>
                        <Text style={styles.totalSplitValue}>{formatMoney(t.total, t.currency)}</Text>
                      </View>
                    ))}
                  </>
                )}
                {summary.uncounted > 0 ? (
                  <Text style={styles.totalNote}>
                    {summary.uncounted} payment{summary.uncounted === 1 ? '' : 's'} without an amount or currency not included.
                  </Text>
                ) : null}
                {partial ? <Text style={styles.totalNote}>Based on your latest {payments.length} payments.</Text> : null}
              </LinearGradient>
            ) : null}

            {pendingText ? (
              <View style={styles.pendingAlert} accessible accessibilityLabel={`${pendingText} in pending payments. Complete payments to avoid booking cancellations.`}>
                <Ionicons name="alert-circle" size={20} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingAlertTitle}>{pendingText} in pending payments</Text>
                  <Text style={styles.pendingAlertSub}>Complete payments to avoid booking cancellations.</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* Section 2: Stream Revenue Summary Card */}
        {section === 'streaming' ? (
          <View style={styles.streamCard}>
            <View style={styles.streamCardHead}>
              <View style={styles.streamBadgeIcon}>
                <Ionicons name="radio" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.streamEyebrow}>CONNEKTLIVE</Text>
                <Text style={styles.streamCardTitle}>Live Stream Revenue</Text>
                <Text style={styles.streamCardSub}>Ticketed stream entry fees</Text>
              </View>
            </View>
            <View style={styles.streamDivider} />
            <View style={styles.streamCardBottom}>
              <View style={{ flex: 1 }}>
                <Text style={styles.streamBottomLabel}>Total Stream Revenue</Text>
                <Text style={styles.streamBottomValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPrice(totalStreamingRevenue, 'RWF')}</Text>
              </View>
              <ActionButton compact variant="primary" icon="cash-outline" label="Withdraw" onPress={() => router.push('/withdraw' as Href)} />
            </View>
          </View>
        ) : null}

        {/* Section 3: Gift Earnings Summary Card */}
        {section === 'gifts' ? (
          <View style={styles.streamCard}>
            <View style={styles.streamCardHead}>
              <View style={styles.streamBadgeIcon}>
                <Ionicons name="heart" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.streamEyebrow}>CONNEKTLIVE GIFTS</Text>
                <Text style={styles.streamCardTitle}>Viewer Gift Earnings</Text>
                <Text style={styles.streamCardSub}>65% withdrawable share</Text>
              </View>
            </View>
            <View style={styles.streamDivider} />
            <View style={styles.streamCardBottom}>
              <View style={{ flex: 1 }}>
                <Text style={styles.streamBottomLabel}>Total Gift Revenue</Text>
                <Text style={styles.giftBottomValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{formatPrice(totalGiftRevenue, 'RWF')}</Text>
              </View>
              <ActionButton compact variant="primary" icon="cash-outline" label="Withdraw" onPress={() => router.push('/withdraw' as Href)} />
            </View>
          </View>
        ) : null}
      </View>

      {section === 'events' ? (
        <>
          {payments.length > 0 ? (
            <StatusBreakdownCard
              segments={[
                { key: 'paid', label: 'Paid', value: counts.paid, color: colors.success },
                { key: 'pending', label: 'Pending', value: counts.pending, color: colors.warning },
                { key: 'failed', label: 'Failed', value: counts.failed, color: colors.error },
              ]}
              centerLabel="payments"
              summary="Payments by status"
              emptyText="No payments yet."
            />
          ) : null}
          <SectionHeader
            title="Activity"
            subtitle={paymentsData ? `${payments.length} payment${payments.length === 1 ? '' : 's'}${partial ? ' (latest)' : ''}` : undefined}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', 'paid', 'pending', 'failed'] as const).map((f) => (
              <Chip key={f} label={f === 'all' ? 'All' : STATUS_TONE[f].label} selected={filter === f} count={currentLoading || currentError ? undefined : counts[f]} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>
        </>
      ) : (
        <SectionHeader title={section === 'streaming' ? 'Stream payments' : 'Gifts received'} />
      )}
    </View>
  );

  const skeletons = (
    <View style={styles.skeletons}>
      <SkeletonCard height={72} />
      <SkeletonCard height={72} />
      <SkeletonCard height={72} />
    </View>
  );
  const errorBlock = (message: string) => (
    <View style={styles.emptyWrap}>
      <ErrorNotice message={message} onRetry={retryCurrent} />
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      {section === 'events' ? (
        <FlatList
          data={filteredPayments}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          ItemSeparatorComponent={RowGap}
          refreshControl={<RefreshControl refreshing={currentLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const b = bucketOf(item);
            const tone = STATUS_TONE[b];
            const isPending = b === 'pending';
            const isFailed = b === 'failed' && isOwedObligation(item.paymentType);
            const dateText = item.createdAt ? formatDate(item.createdAt) : undefined;

            return (
              <View style={styles.rowCard}>
                <ListRow
                  icon="card"
                  tone={tone.rowTone}
                  title={item.title}
                  meta={dateText}
                  onPress={() => router.push(`/payment/${item.id}` as Href)}
                  trailing={
                    <View style={styles.rowRight}>
                      {item.amount != null ? <Text style={styles.rowAmount}>{formatPrice(item.amount, item.currency)}</Text> : null}
                      {isPending || isFailed ? (
                        <Pressable
                          style={({ pressed }) => [styles.payNowBtn, isFailed && styles.retryBtn, pressed && { opacity: 0.8 }]}
                          disabled={payChecking}
                          accessibilityRole="button"
                          accessibilityState={{ busy: payChecking, disabled: payChecking }}
                          accessibilityLabel={`${isFailed ? 'Retry' : 'Pay now'}, ${item.title}`}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            void onOpenPayNow(item);
                          }}
                        >
                          <Ionicons name={isFailed ? 'refresh-outline' : 'card-outline'} size={12} color="#fff" />
                          <Text style={styles.payNowBtnText}>{isFailed ? 'Retry' : 'Pay Now'}</Text>
                        </Pressable>
                      ) : (
                        <StatusBadge label={tone.label} tone={tone.tone} />
                      )}
                    </View>
                  }
                />
              </View>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              skeletons
            ) : paymentsError ? (
              errorBlock("Couldn't load payments. Check your connection and try again.")
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyNote
                  icon="card-outline"
                  title={filter === 'all' ? 'No payments yet' : 'Nothing here'}
                  body={filter === 'all' ? 'Your event payments and purchases will appear here.' : 'No payments match this filter.'}
                />
              </View>
            )
          }
        />
      ) : section === 'streaming' ? (
        <FlatList
          data={streamingPayments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          ItemSeparatorComponent={RowGap}
          refreshControl={<RefreshControl refreshing={currentLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const isCompleted = item.status === 'completed';
            const meta = [item.eventTitle, `Method: ${item.method}`, item.date ? formatDate(item.date) : null].filter(Boolean).join(' · ');
            return (
              <View style={styles.rowCard}>
                <ListRow
                  icon="radio"
                  tone={isCompleted ? 'success' : 'warning'}
                  title={item.viewerName}
                  meta={meta}
                  trailing={
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{formatPrice(item.amount, item.currency)}</Text>
                      <StatusBadge label={isCompleted ? 'Completed' : item.status.toUpperCase()} tone={isCompleted ? 'success' : 'warning'} />
                    </View>
                  }
                />
              </View>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              skeletons
            ) : streamingError ? (
              errorBlock("Couldn't load stream revenue. Check your connection and try again.")
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyNote icon="radio-outline" title="No stream revenue yet" body="Ticket fees from ConnektLive viewers will appear here." />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={giftPayments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingBottom: clearance }]}
          ItemSeparatorComponent={RowGap}
          refreshControl={<RefreshControl refreshing={currentLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => {
            const isCompleted = item.status === 'completed';
            const meta = [item.eventTitle, item.giftMessage ? `\u201C${item.giftMessage}\u201D` : null, item.date ? formatDate(item.date) : null].filter(Boolean).join(' · ');
            return (
              <View style={styles.rowCard}>
                <ListRow
                  icon="heart"
                  tone={isCompleted ? 'accent' : 'warning'}
                  title={item.customerPhone || 'Anonymous Viewer'}
                  meta={meta}
                  trailing={
                    <View style={styles.rowRight}>
                      <Text style={styles.giftNetAmount}>{formatPrice(item.netAmount, item.currency)}</Text>
                      <StatusBadge label={isCompleted ? 'Completed' : item.status.toUpperCase()} tone={isCompleted ? 'success' : 'warning'} />
                    </View>
                  }
                />
              </View>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              skeletons
            ) : giftsError ? (
              errorBlock("Couldn't load gifts. Check your connection and try again.")
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyNote icon="heart-outline" title="No gifts received yet" body="Gifts sent by live-stream viewers will appear here." />
              </View>
            )
          }
        />
      )}

      {/* Instant Pay Now Bottom Sheet */}
      <PayNowSheet
        payment={paySheetPayment}
        visible={!!paySheetPayment}
        onClose={() => setPaySheetPayment(null)}
        onSuccess={() => {
          setPaySheetPayment(null);
          onRefresh();
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: {},
  rowCard: { marginHorizontal: spacing.lg, backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, overflow: 'hidden' },
  skeletons: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  emptyWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  header: { paddingTop: spacing.md, gap: spacing.md, paddingHorizontal: spacing.lg },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, marginTop: -4 },

  sectionTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
    gap: 4,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  sectionTabActive: {
    backgroundColor: c.primary,
  },
  sectionTabText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  sectionTabTextActive: {
    color: '#fff',
  },

  totalCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: 4,
  },
  totalLabel: { fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: 1 },
  totalValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 32, letterSpacing: -0.5 },
  totalSplit: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  totalSplitCell: { flex: 1, gap: 1 },
  totalSplitLabel: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  totalSplitValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 16 },
  totalDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  totalMixed: { fontFamily: fonts.bold, color: '#fff', fontSize: 22, letterSpacing: -0.3 },
  totalCurrencyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: 6 },
  totalNote: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },

  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.warningBg,
    borderWidth: 1,
    borderColor: c.warning,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  pendingAlertTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.text },
  pendingAlertSub: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, marginTop: 1 },

  filterRow: { gap: 8, paddingTop: 2, paddingBottom: spacing.md, paddingHorizontal: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  pillActive: { backgroundColor: c.primary },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: c.textSoft },
  pillTextActive: { color: '#fff' },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(8,58,133,0.10)',
    alignItems: 'center',
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  badgeTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  rowDate: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rowAmount: { fontFamily: fonts.bold, fontSize: 15, color: c.text },

  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  retryBtn: {
    backgroundColor: c.accent,
  },
  payNowBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.2,
  },

  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  statusChipText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.3 },

  // Stream Revenue styling
  streamCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  streamCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streamBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamEyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 0.8 },
  streamCardTitle: { fontFamily: fonts.bold, fontSize: 16, color: c.text },
  streamCardSub: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  withdrawBtnText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  streamDivider: { height: 1, backgroundColor: c.borderSoft },
  streamCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streamBottomLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  streamBottomValue: { fontFamily: fonts.bold, fontSize: 20, color: c.primary },

  streamRow: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  streamRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  streamViewerName: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  streamViewerEmail: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  streamRowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  streamRowMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  streamEventTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.text },
  streamRowAmount: { fontFamily: fonts.bold, fontSize: 14, color: '#047857' },
  streamRowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  streamFooterText: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },

  // Gift Earnings styling
  giftCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  giftCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  giftBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftEyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 0.8 },
  giftCardTitle: { fontFamily: fonts.bold, fontSize: 16, color: c.text },
  giftCardSub: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  giftDivider: { height: 1, backgroundColor: c.borderSoft },
  giftCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftBottomLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  giftBottomValue: { fontFamily: fonts.bold, fontSize: 20, color: c.accent },

  giftRow: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  giftRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  giftSender: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  giftEvent: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, marginTop: 1 },
  giftNetAmount: { fontFamily: fonts.bold, fontSize: 15, color: c.accent },
  giftMessageWrap: {
    backgroundColor: c.surfaceMuted,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
  },
  giftMessage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontStyle: 'italic',
    color: c.textSoft,
  },
  giftDate: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, marginTop: 2 },
}));

/** Photographers only receive payments; send them to their earnings view instead. */
export default function PaymentsScreen() {
  const { role } = useRole();
  if (!canUsePaymentsScreen(role)) return <Redirect href="/transactions" />;
  return <PaymentsContent />;
}
