/**
 * Payments — history of event payments / purchases, with a summary and
 * status filters. Mobile port of the salo-run payments pages. Role-aware
 * (client / coordinator / photographer share this list). Brand design:
 * eyebrow header, Total/Paid/Pending summary, All/Paid/Pending/Failed
 * filter pills, refined rows — all Pragati Narrow.
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
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { listPayments, type PaymentRecord } from '@/features/payments/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

type Filter = 'all' | 'paid' | 'pending' | 'failed';

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
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { role } = useRole();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPayments(role), [role]));
  const [filter, setFilter] = useState<Filter>('all');

  const payments: PaymentRecord[] = data ?? [];
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

  const filtered = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => bucket(p.status) === filter)),
    [payments, filter],
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>FINANCE</Text>
      <Text style={styles.title}>Payments</Text>
      <Text style={styles.subtitle}>Your event payments and purchases.</Text>

      <LinearGradient
        colors={[...gradients.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.totalCard}
      >
        <Text style={styles.totalLabel}>TOTAL</Text>
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
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'paid', 'pending', 'failed'] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {f === 'all' ? 'All' : STATUS_TONE[f].label}
              </Text>
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{counts[f]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const tone = STATUS_TONE[bucket(item.status)];
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/payment/${item.id}` as Href)}
            >
              <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                <Ionicons name="card" size={18} color={tone.fg} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                {item.createdAt ? <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text> : null}
              </View>
              <View style={styles.rowRight}>
                {item.amount != null ? (
                  <Text style={styles.rowAmount}>{formatMoney(item.amount, item.currency)}</Text>
                ) : null}
                <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusChipText, { color: tone.fg }]}>{tone.label}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : error ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title="Couldn't load payments" message="Pull to refresh and try again." />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon="card-outline"
                title={filter === 'all' ? 'No payments yet' : 'Nothing here'}
                message={filter === 'all' ? 'Your event payments and purchases will appear here.' : 'No payments match this filter.'}
              />
            </View>
          )
        }
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

  totalCard: { borderRadius: radii.xl, padding: spacing.xl, gap: 4 },
  totalLabel: { fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)', fontSize: 11, letterSpacing: 1 },
  totalValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 32, letterSpacing: -0.5 },
  totalSplit: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  totalSplitCell: { flex: 1, gap: 1 },
  totalSplitLabel: { fontFamily: fonts.regular, color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  totalSplitValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 16 },
  totalDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

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
  badge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full, backgroundColor: 'rgba(8,58,133,0.10)', alignItems: 'center' },
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
  rowAmount: { fontFamily: fonts.bold, fontSize: 15, color: c.primary },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  statusChipText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },
}));
