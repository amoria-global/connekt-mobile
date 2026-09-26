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
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import {
  listPayments,
  listStreamingPayments,
  listGiftPayments,
  type PaymentRecord,
  type StreamingPayment,
  type GiftPayment,
} from '@/features/payments/api';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import type { PendingPayment } from '@/features/analytics/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

type Filter = 'all' | 'paid' | 'pending' | 'failed';
type Section = 'events' | 'streaming' | 'gifts';

function bucket(status?: string): Exclude<Filter, 'all'> {
  const s = (status ?? '').toLowerCase();
  if (/paid|complete|success|approved/.test(s)) return 'paid';
  if (/fail|cancel|declin|error/.test(s)) return 'failed';
  return 'pending';
}

const STATUS_TONE: Record<Exclude<Filter, 'all'>, { bg: string; fg: string; label: string }> = {
  paid: { bg: '#D1FAE5', fg: '#047857', label: 'Paid' },
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'Pending' },
  failed: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Failed' },
};

export default function PaymentsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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
  const currency = payments.find((p) => p.currency)?.currency;

  const stats = useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    for (const p of payments) {
      const amt = p.amount ?? 0;
      total += amt;
      const b = bucket(p.status);
      if (b === 'paid') paid += amt;
      else if (b === 'pending') pending += amt;
    }
    return { total, paid, pending };
  }, [payments]);

  const counts = useMemo(() => {
    const c = { all: payments.length, paid: 0, pending: 0, failed: 0 };
    for (const p of payments) c[bucket(p.status)] += 1;
    return c;
  }, [payments]);

  const filteredPayments = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => bucket(p.status) === filter)),
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

  const onOpenPayNow = (item: PaymentRecord) => {
    setPaySheetPayment({
      id: item.declarationId || item.id,
      eventName: item.title,
      photographerName: 'Event Booking',
      amount: item.amount ?? 0,
      paidAmount: 0,
      dueDate: item.createdAt ?? '',
      status: 'pending',
      paymentType: item.paymentType || 'BOOKING_DECLARATION',
    });
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>FINANCE</Text>
      <Text style={styles.title}>Payments</Text>
      <Text style={styles.subtitle}>
        {isCoordinator
          ? 'Manage event payments, streaming revenue, and gifts.'
          : 'Your event payments and purchases.'}
      </Text>

      {/* Role-aware Section Switcher for Coordinators */}
      {isCoordinator ? (
        <View style={styles.sectionTabs}>
          <Pressable
            style={[styles.sectionTab, section === 'events' && styles.sectionTabActive]}
            onPress={() => setSection('events')}
          >
            <Ionicons
              name="card-outline"
              size={15}
              color={section === 'events' ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.sectionTabText, section === 'events' && styles.sectionTabTextActive]}>
              Event Payments
            </Text>
          </Pressable>

          <Pressable
            style={[styles.sectionTab, section === 'streaming' && styles.sectionTabActive]}
            onPress={() => setSection('streaming')}
          >
            <Ionicons
              name="radio-outline"
              size={15}
              color={section === 'streaming' ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.sectionTabText, section === 'streaming' && styles.sectionTabTextActive]}>
              Stream Revenue
            </Text>
          </Pressable>

          <Pressable
            style={[styles.sectionTab, section === 'gifts' && styles.sectionTabActive]}
            onPress={() => setSection('gifts')}
          >
            <Ionicons
              name="heart-outline"
              size={15}
              color={section === 'gifts' ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.sectionTabText, section === 'gifts' && styles.sectionTabTextActive]}>
              Gift Earnings
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Section 1: Event Payments Summary Card */}
      {section === 'events' ? (
        <>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>{isCoordinator ? 'TOTAL PAYMENTS' : 'TOTAL SPENDING'}</Text>
            <Text style={styles.totalValue}>{formatMoney(stats.total, currency)}</Text>
            <View style={styles.totalSplit}>
              <View style={styles.totalSplitCell}>
                <Text style={styles.totalSplitLabel}>Paid</Text>
                <Text style={styles.totalSplitValue}>{formatMoney(stats.paid, currency)}</Text>
              </View>
              <View style={styles.totalDivider} />
              <View style={styles.totalSplitCell}>
                <Text style={styles.totalSplitLabel}>Pending</Text>
                <Text style={styles.totalSplitValue}>{formatMoney(stats.pending, currency)}</Text>
              </View>
            </View>
          </View>

          {stats.pending > 0 ? (
            <View style={styles.pendingAlert}>
              <Ionicons name="alert-circle" size={20} color="#D97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingAlertTitle}>
                  {formatMoney(stats.pending, currency)} in pending payments
                </Text>
                <Text style={styles.pendingAlertSub}>
                  Complete payments to avoid booking cancellations.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'paid', 'pending', 'failed'] as const).map((f) => {
              const active = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {f === 'all' ? 'All' : STATUS_TONE[f].label}
                  </Text>
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                      {counts[f]}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
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
            <Pressable
              style={styles.withdrawBtn}
              onPress={() => router.push('/withdraw' as Href)}
            >
              <Ionicons name="cash-outline" size={14} color="#fff" />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </Pressable>
          </View>
          <View style={styles.streamDivider} />
          <View style={styles.streamCardBottom}>
            <Text style={styles.streamBottomLabel}>Total Stream Revenue</Text>
            <Text style={styles.streamBottomValue}>{formatMoney(totalStreamingRevenue, 'RWF')}</Text>
          </View>
        </View>
      ) : null}

      {/* Section 3: Gift Earnings Summary Card */}
      {section === 'gifts' ? (
        <View style={styles.giftCard}>
          <View style={styles.giftCardHead}>
            <View style={styles.giftBadgeIcon}>
              <Ionicons name="heart" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.giftEyebrow}>CONNEKTLIVE GIFTS</Text>
              <Text style={styles.giftCardTitle}>Viewer Gift Earnings</Text>
              <Text style={styles.giftCardSub}>65% withdrawable share</Text>
            </View>
            <Pressable
              style={styles.withdrawBtn}
              onPress={() => router.push('/withdraw' as Href)}
            >
              <Ionicons name="cash-outline" size={14} color="#fff" />
              <Text style={styles.withdrawBtnText}>Withdraw</Text>
            </Pressable>
          </View>
          <View style={styles.giftDivider} />
          <View style={styles.giftCardBottom}>
            <Text style={styles.giftBottomLabel}>Total Gift Revenue</Text>
            <Text style={styles.giftBottomValue}>{formatMoney(totalGiftRevenue, 'RWF')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      {section === 'events' ? (
        <FlatList
          data={filteredPayments}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={currentLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const b = bucket(item.status);
            const tone = STATUS_TONE[b];
            const isPending = b === 'pending';
            const isFailed = b === 'failed';

            return (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                onPress={() => router.push(`/payment/${item.id}` as Href)}
              >
                <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                  <Ionicons name="card" size={18} color={tone.fg} />
                </View>

                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.createdAt ? (
                    <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                  ) : null}
                </View>

                <View style={styles.rowRight}>
                  {item.amount != null ? (
                    <Text style={styles.rowAmount}>
                      {formatMoney(item.amount, item.currency)}
                    </Text>
                  ) : null}

                  {isPending || isFailed ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.payNowBtn,
                        isFailed && styles.retryBtn,
                        pressed && { opacity: 0.8 },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onOpenPayNow(item);
                      }}
                    >
                      <Ionicons
                        name={isFailed ? 'refresh-outline' : 'card-outline'}
                        size={12}
                        color="#fff"
                      />
                      <Text style={styles.payNowBtnText}>
                        {isFailed ? 'Retry' : 'Pay Now'}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusChipText, { color: tone.fg }]}>
                        {tone.label}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
            ) : paymentsError ? (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="cloud-offline-outline"
                  title="Couldn't load payments"
                  message="Pull to refresh and try again."
                />
              </View>
            ) : (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="card-outline"
                  title={filter === 'all' ? 'No payments yet' : 'Nothing here'}
                  message={
                    filter === 'all'
                      ? 'Your event payments and purchases will appear here.'
                      : 'No payments match this filter.'
                  }
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
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={currentLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isCompleted = item.status === 'completed';
            const statusTone = isCompleted
              ? { bg: '#D1FAE5', fg: '#047857', label: 'Completed' }
              : { bg: '#FEF3C7', fg: '#92400E', label: item.status.toUpperCase() };

            return (
              <View style={styles.streamRow}>
                <View style={styles.streamRowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.streamViewerName}>{item.viewerName}</Text>
                    {item.viewerEmail ? (
                      <Text style={styles.streamViewerEmail}>{item.viewerEmail}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: statusTone.bg }]}>
                    <Text style={[styles.statusChipText, { color: statusTone.fg }]}>
                      {statusTone.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.streamRowMeta}>
                  <View style={styles.streamRowMetaItem}>
                    <Ionicons name="radio" size={13} color={colors.accent} />
                    <Text style={styles.streamEventTitle} numberOfLines={1}>
                      {item.eventTitle}
                    </Text>
                  </View>
                  <Text style={styles.streamRowAmount}>
                    {formatMoney(item.amount, item.currency)}
                  </Text>
                </View>

                <View style={styles.streamRowFooter}>
                  <Text style={styles.streamFooterText}>Method: {item.method}</Text>
                  {item.date ? (
                    <Text style={styles.streamFooterText}>{formatDate(item.date)}</Text>
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
            ) : streamingError ? (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="cloud-offline-outline"
                  title="Couldn't load stream revenue"
                  message="Pull down to refresh and try again."
                />
              </View>
            ) : (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="radio-outline"
                  title="No stream revenue yet"
                  message="Ticket fees from ConnektLive viewers will appear here."
                />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={giftPayments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={currentLoading}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const isCompleted = item.status === 'completed';
            const statusTone = isCompleted
              ? { bg: '#D1FAE5', fg: '#047857', label: 'Completed' }
              : { bg: '#FEF3C7', fg: '#92400E', label: item.status.toUpperCase() };

            return (
              <View style={styles.giftRow}>
                <View style={styles.giftRowHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.giftSender}>
                      {item.customerPhone || 'Anonymous Viewer'}
                    </Text>
                    <Text style={styles.giftEvent}>{item.eventTitle}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.giftNetAmount}>
                      {formatMoney(item.netAmount, item.currency)}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: statusTone.bg }]}>
                      <Text style={[styles.statusChipText, { color: statusTone.fg }]}>
                        {statusTone.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {item.giftMessage ? (
                  <View style={styles.giftMessageWrap}>
                    <Text style={styles.giftMessage}>&ldquo;{item.giftMessage}&rdquo;</Text>
                  </View>
                ) : null}

                {item.date ? (
                  <Text style={styles.giftDate}>{formatDate(item.date)}</Text>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            currentLoading ? (
              <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
            ) : giftsError ? (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="cloud-offline-outline"
                  title="Couldn't load gifts"
                  message="Pull down to refresh and try again."
                />
              </View>
            ) : (
              <View style={{ paddingTop: spacing.xl }}>
                <EmptyState
                  icon="heart-outline"
                  title="No gifts received yet"
                  message="Gifts sent by live-stream viewers will appear here."
                />
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },

  header: { paddingTop: spacing.md, gap: spacing.md },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, marginTop: -6 },

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
    backgroundColor: c.primary,
  },
  totalLabel: { fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)', fontSize: 11, letterSpacing: 1 },
  totalValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 32, letterSpacing: -0.5 },
  totalSplit: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  totalSplitCell: { flex: 1, gap: 1 },
  totalSplitLabel: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  totalSplitValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 16 },
  totalDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  pendingAlertTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#92400E' },
  pendingAlertSub: { fontFamily: fonts.regular, fontSize: 11, color: '#B45309', marginTop: 1 },

  filterRow: { gap: 8, paddingVertical: 2 },
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
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowAmount: { fontFamily: fonts.bold, fontSize: 15, color: c.primary },

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
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.2,
  },

  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  statusChipText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },

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
  streamEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: c.accent, letterSpacing: 0.8 },
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
  streamFooterText: { fontFamily: fonts.regular, fontSize: 11, color: c.textMuted },

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
  giftEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: c.accent, letterSpacing: 0.8 },
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
  giftDate: { fontFamily: fonts.regular, fontSize: 11, color: c.textMuted, marginTop: 2 },
}));
