/**
 * Home dashboard for the `User` role — the mobile/smart-TV consumer.
 *
 * A User doesn't run a business dashboard (no analytics/wallet-earnings); they
 * consume: buy stream access, buy photos, book photographers, and clear pending
 * payments. So this is an action-first home: a greeting, a grid of the four
 * things they can do, a "pending payments" section they can pay right here, and
 * their recent bookings.
 */
import { useCallback, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { getCustomerPendingPayments, type PendingPayment } from '@/features/analytics/api';
import { listEvents } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { formatMoney } from '@/utils/format';
import { colors, fonts, fontSize, radii, spacing } from '@/theme';

type Action = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
};

// The four things a User can do — each maps to an existing screen.
const ACTIONS: Action[] = [
  { label: 'Book a photographer', sub: 'Find & hire talent', icon: 'camera', color: '#083A85', href: '/photographers' as Href },
  { label: 'Live streams', sub: 'Watch & buy access', icon: 'videocam', color: '#F20C8F', href: '/streams' as Href },
  { label: 'Find my photos', sub: 'Buy your event photos', icon: 'images', color: '#0EA5E9', href: '/find-my-photos' as Href },
  { label: 'Payments', sub: 'Pay & track', icon: 'card', color: '#10B981', href: '/payments' as Href },
];

export function UserHome() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';

  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const events = useAsync(useCallback(() => listEvents(), []));

  const [payNow, setPayNow] = useState<PendingPayment | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const refreshing = pending.loading || events.loading;
  const onRefresh = () => {
    pending.refresh();
    events.refresh();
  };

  const pendingItems = pending.data ?? [];
  const totalPending = pendingItems.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const recent = (events.data ?? []).slice(0, 4);
  // The backend row may carry a currency even though the typed shape omits it
  // (PayNowSheet reads it the same defensive way). Default to USD like the sheet.
  const currency = (pendingItems[0] as { currency?: string } | undefined)?.currency ?? 'USD';

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>WELCOME BACK</Text>
          <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
          <Text style={styles.heroSub}>Book shoots, buy photos, and watch live — all in one place.</Text>
        </View>

        {/* Quick actions */}
        <View style={styles.grid}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(a.href as never)}
            >
              <View style={[styles.cardIcon, { backgroundColor: a.color }]}>
                <Ionicons name={a.icon} size={22} color="#fff" />
              </View>
              <Text style={styles.cardLabel}>{a.label}</Text>
              <Text style={styles.cardSub}>{a.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Pending payments */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Pending payments</Text>
          {pendingItems.length > 0 ? (
            <Pressable onPress={() => router.push('/payments' as never)}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          ) : null}
        </View>

        {pending.loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : pendingItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <Text style={styles.emptyText}>You're all settled up — no payments due.</Text>
          </View>
        ) : (
          <>
            <View style={styles.pendingTotal}>
              <Text style={styles.pendingTotalLabel}>Total due</Text>
              <Text style={styles.pendingTotalValue}>{formatMoney(totalPending, currency)}</Text>
            </View>
            {pendingItems.slice(0, 4).map((p) => (
              <View key={p.id} style={styles.payRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.payTitle} numberOfLines={1}>{p.eventName}</Text>
                  <Text style={styles.paySub} numberOfLines={1}>
                    {p.photographerName || 'Booking'} · {formatMoney(p.amount - p.paidAmount, (p as { currency?: string }).currency ?? currency)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.payBtn, p.status === 'failed' && { backgroundColor: colors.error }]}
                  onPress={() => {
                    setPayNow(p);
                    setPayOpen(true);
                  }}
                >
                  <Text style={styles.payBtnText}>{p.status === 'failed' ? 'Retry' : 'Pay'}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {/* Recent bookings */}
        {recent.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Your bookings</Text>
              <Pressable onPress={() => router.push('/bookings' as never)}>
                <Text style={styles.link}>View all</Text>
              </Pressable>
            </View>
            {recent.map((e: EventItem) => (
              <Pressable
                key={e.id}
                style={styles.eventRow}
                onPress={() => router.push(`/event/${e.id}` as never)}
              >
                <View style={styles.eventIcon}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{e.title || 'Event'}</Text>
                  <Text style={styles.eventSub} numberOfLines={1}>
                    {[e.photographerName, e.eventDate].filter(Boolean).join(' · ') || 'Booking'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>

      <TopBar />

      <PayNowSheet
        payment={payNow}
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => {
          setPayOpen(false);
          pending.refresh();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg },

  hero: { gap: 4 },
  heroEyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.accent },
  heroName: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.3 },
  heroSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: 8,
  },
  pressed: { opacity: 0.85 },
  cardIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  cardSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  link: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.primary },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  emptyText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text },

  pendingTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  pendingTotalLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)' },
  pendingTotalValue: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: '#fff' },

  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  payTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  paySub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  payBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radii.full },
  payBtnText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: '#fff' },

  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  eventIcon: {
    width: 38, height: 38, borderRadius: radii.md,
    backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  eventSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
});
