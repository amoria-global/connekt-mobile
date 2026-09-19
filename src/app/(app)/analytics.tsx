import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image as RNImage } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type CoordinatorPhotographer,
  type CustomerAnalytics,
  type DashboardActivity,
  type PerformancePoint,
  type PhotographerAnalytics,
  type PhotographerClient,
  type RecentActivity,
  type RecentPayment,
  type RecentPhotographer,
  type RecentTransaction,
  type TrendsMap,
  getCoordinatorAnalytics,
  getCoordinatorPerformance,
  getCoordinatorPhotographers,
  getCoordinatorRecentActivities,
  getCoordinatorTrends,
  getCustomerAnalytics,
  getCustomerPerformance,
  getCustomerPhotographers,
  getCustomerRecentActivities,
  getCustomerRecentPayments,
  getCustomerTrends,
  getPhotographerAnalytics,
  getPhotographerClients,
  getPhotographerPerformance,
  getPhotographerRecentTransactions,
  getPhotographerTrends,
} from '@/features/analytics/api';
import { useRole } from '@/features/auth/role';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  today: 'yesterday',
  week: 'last week',
  month: 'last month',
  custom: 'custom period',
};

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isClient, isCoordinator, isPhotographer } = useRole();
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const currency = wallet.data?.currency;

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // ── Client state ─────────────────────────────────────────────────────────
  const [clientData, setClientData] = useState<CustomerAnalytics | null>(null);
  const [clientActivities, setClientActivities] = useState<RecentActivity[]>([]);
  const [clientPhotographers, setClientPhotographers] = useState<RecentPhotographer[]>([]);
  const [clientPayments, setClientPayments] = useState<RecentPayment[]>([]);
  const [clientPerf, setClientPerf] = useState<PerformancePoint[]>([]);

  // ── Coordinator state ─────────────────────────────────────────────────────
  const [coordData, setCoordData] = useState<CoordinatorAnalytics | null>(null);
  const [coordPhotographers, setCoordPhotographers] = useState<CoordinatorPhotographer[]>([]);
  const [coordActivities, setCoordActivities] = useState<DashboardActivity[]>([]);
  const [coordPerf, setCoordPerf] = useState<PerformancePoint[]>([]);

  // ── Photographer state ────────────────────────────────────────────────────
  const [photogData, setPhotogData] = useState<PhotographerAnalytics | null>(null);
  const [photogClients, setPhotogClients] = useState<PhotographerClient[]>([]);
  const [photogTransactions, setPhotogTransactions] = useState<RecentTransaction[]>([]);
  const [photogPerf, setPhotogPerf] = useState<PerformancePoint[]>([]);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [trends, setTrends] = useState<TrendsMap>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const from = period === 'custom' ? customFrom : undefined;
    const to   = period === 'custom' ? customTo   : undefined;
    try {
      if (isClient) {
        const [a, t, activities, photographers, payments, perf] = await Promise.allSettled([
          getCustomerAnalytics(),
          getCustomerTrends(period, from, to),
          getCustomerRecentActivities(),
          getCustomerPhotographers(),
          getCustomerRecentPayments(),
          getCustomerPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled')             setClientData(a.value);
        if (t.status === 'fulfilled')             setTrends(t.value);
        if (activities.status === 'fulfilled')    setClientActivities(activities.value);
        if (photographers.status === 'fulfilled') setClientPhotographers(photographers.value);
        if (payments.status === 'fulfilled')      setClientPayments(payments.value);
        if (perf.status === 'fulfilled')          setClientPerf(perf.value);
      } else if (isCoordinator) {
        const [a, t, photographers, activities, perf] = await Promise.allSettled([
          getCoordinatorAnalytics(),
          getCoordinatorTrends(period, from, to),
          getCoordinatorPhotographers(),
          getCoordinatorRecentActivities(),
          getCoordinatorPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled')             setCoordData(a.value);
        if (t.status === 'fulfilled')             setTrends(t.value);
        if (photographers.status === 'fulfilled') setCoordPhotographers(photographers.value);
        if (activities.status === 'fulfilled')    setCoordActivities(activities.value);
        if (perf.status === 'fulfilled')          setCoordPerf(perf.value);
      } else if (isPhotographer) {
        const [a, t, clients, transactions, perf] = await Promise.allSettled([
          getPhotographerAnalytics(),
          getPhotographerTrends(period, from, to),
          getPhotographerClients(),
          getPhotographerRecentTransactions(),
          getPhotographerPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled')              setPhotogData(a.value);
        if (t.status === 'fulfilled')              setTrends(t.value);
        if (clients.status === 'fulfilled')        setPhotogClients(clients.value);
        if (transactions.status === 'fulfilled')   setPhotogTransactions(transactions.value);
        if (perf.status === 'fulfilled')           setPhotogPerf(perf.value);
      }
    } finally {
      setLoading(false);
    }
  }, [isClient, isCoordinator, isPhotographer, period, customFrom, customTo]);

  useEffect(() => { load(); }, [load]);

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (isClient && clientData) return [
      kpi('Total Spent',   formatMoney(clientData.totalSpent, currency),            'cash-outline',             '#083A85', trends.totalSpent),
      kpi('Pending',       formatMoney(clientData.pendingAmount, currency),          'time-outline',             '#F59E0B', trends.pending),
      kpi('Bookings',      String(clientData.totalBookings),                         'people-outline',           '#3B82F6', trends.events),
      kpi('Gifts',         formatMoney(clientData.gifts, currency),                  'gift-outline',             '#10B981', trends.gifts),
      kpi('Favorites',     String(clientData.bookmarkedPhotographers),               'star-outline',             '#8B5CF6', trends.photographers),
      kpi('Photos',        String(clientData.totalPhotos),                           'images-outline',           '#06B6D4', trends.totalPhotos),
      kpi('Events',        String(clientData.totalEvents),                           'calendar-outline',         '#F97316', trends.totalEvents),
      kpi('Completed',     String(clientData.completedEvents),                       'checkmark-circle-outline', '#22C55E', trends.completedEvents),
    ];
    if (isCoordinator && coordData) return [
      kpi('Revenue',        formatMoney(coordData.totalRevenue, currency),           'cash-outline',     '#083A85', trends.totalRevenue),
      kpi('Pending',        formatMoney(coordData.totalPending, currency),           'time-outline',     '#F59E0B', trends.totalPending),
      kpi('Events',         String(coordData.totalEvents),                           'calendar-outline', '#3B82F6', trends.totalEvents),
      kpi('Clients',        String(coordData.totalCustomers),                        'people-outline',   '#10B981', trends.totalCustomers),
      kpi('Photographers',  String(coordData.totalPhotographers),                    'camera-outline',   '#8B5CF6', trends.totalPhotographers),
      kpi('Active Streams', String(coordData.activeStreams),                         'videocam-outline', '#F97316', trends.activeStreams),
      kpi('Paid',           formatMoney(coordData.totalPaid, currency),              'card-outline',     '#22C55E', trends.totalPaid),
    ];
    if (isPhotographer && photogData) return [
      kpi('Earnings',   formatMoney(photogData.totalEarnings, currency),             'cash-outline',    '#083A85', trends.totalEarnings),
      kpi('Pending',    formatMoney(photogData.pendingPayments, currency),           'time-outline',    '#F59E0B', trends.pending),
      kpi('Clients',    String(photogData.totalClients),                             'people-outline',  '#3B82F6', trends.clients),
      kpi('Bonuses',    formatMoney(photogData.bonuses, currency),                   'gift-outline',    '#10B981', trends.bonuses),
      kpi('Rating',     `${(photogData.averageRating ?? 5).toFixed(1)}/5`,           'star-outline',    '#8B5CF6', trends.rating),
      kpi('Photos',     String(photogData.totalPhotosUploaded),                      'images-outline',  '#06B6D4', trends.totalPhotos),
      kpi('Events',     String(photogData.totalEvents),                              'calendar-outline','#F97316', trends.totalEvents),
      kpi('Completed',  String(photogData.completedEvents),                          'checkmark-circle-outline', '#22C55E', trends.completedEvents),
    ];
    return [];
  }, [isClient, isCoordinator, isPhotographer, clientData, coordData, photogData, currency, trends]);

  const activePerf = isClient ? clientPerf : isCoordinator ? coordPerf : isPhotographer ? photogPerf : [];

  return (
    <Screen padded={false}>
      <ScreenHeader title="Analytics" />
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.subtitle}>Your activity at a glance</Text>

        {/* Period tabs */}
        <View style={styles.periodTabs}>
          {PERIOD_TABS.map((t) => {
            const active = period === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setPeriod(t.value)}
                style={[styles.periodTab, active && styles.periodTabActive]}
              >
                <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom date range */}
        {period === 'custom' ? (
          <View style={styles.customDateRow}>
            <View style={styles.customDateField}>
              <Text style={styles.customDateLabel}>From</Text>
              <TextInput
                style={styles.customDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={customFrom}
                onChangeText={setCustomFrom}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.customDateField}>
              <Text style={styles.customDateLabel}>To</Text>
              <TextInput
                style={styles.customDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={customTo}
                onChangeText={setCustomTo}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
        ) : null}

        {/* KPI grid */}
        {loading && kpis.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : kpis.length > 0 ? (
          <View style={styles.kpiGrid}>
            {kpis.map((k) => (
              <KpiCard key={k.title} {...k} timeframe={PERIOD_LABEL[period]} />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No analytics yet.</Text>
          </View>
        )}

        {/* Performance chart — all roles */}
        {activePerf.length > 0 ? (
          <Section title="Performance">
            <PerformanceMiniChart data={activePerf} />
          </Section>
        ) : null}

        {/* ── CLIENT sections ──────────────────────────────────────────── */}
        {isClient && clientActivities.length > 0 ? (
          <Section title="Recent activity">
            <ListCard>
              {clientActivities.map((a) => <ActivityRow key={a.id} activity={a} />)}
            </ListCard>
          </Section>
        ) : null}

        {isClient && clientPhotographers.length > 0 ? (
          <Section title="Photographers">
            <ListCard>
              {clientPhotographers.map((p) => (
                <PhotographerRow
                  key={p.id}
                  name={p.name}
                  sub={p.event}
                  avatar={p.avatar}
                  status={p.status}
                  onPress={() => router.push('/photographers' as never)}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {isClient && clientPayments.length > 0 ? (
          <Section title="Recent payments">
            <ListCard>
              {clientPayments.map((p) => (
                <PaymentRow
                  key={p.id}
                  name={p.name}
                  sub={p.type}
                  avatar={p.avatar}
                  amount={formatMoney(p.amount, currency)}
                  failed={p.type === 'Failed'}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {/* ── COORDINATOR sections ─────────────────────────────────────── */}
        {isCoordinator && coordPhotographers.length > 0 ? (
          <Section title="Photographers">
            <ListCard>
              {coordPhotographers.map((p) => (
                <PhotographerRow
                  key={p.id}
                  name={p.name}
                  sub={`${p.totalEvents} event${p.totalEvents === 1 ? '' : 's'}`}
                  avatar={p.avatar}
                  status={p.status}
                  onPress={() => router.push('/photographers' as never)}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {isCoordinator && coordActivities.length > 0 ? (
          <Section title="Recent activity">
            <ListCard>
              {coordActivities.map((a) => (
                <ActivityRow
                  key={a.id}
                  activity={{ id: a.id, type: a.type, title: a.title, createdAt: a.createdAt }}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {/* ── PHOTOGRAPHER sections ────────────────────────────────────── */}
        {isPhotographer && photogClients.length > 0 ? (
          <Section title="Clients">
            <ListCard>
              {photogClients.map((c) => (
                <PhotographerRow
                  key={c.id}
                  name={c.name}
                  sub={c.lastEvent ? formatDate(c.lastEvent) : `${c.totalEvents} event${c.totalEvents === 1 ? '' : 's'}`}
                  avatar={c.avatar}
                  onPress={() => router.push('/clients' as never)}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {isPhotographer && photogTransactions.length > 0 ? (
          <Section title="Recent transactions">
            <ListCard>
              {photogTransactions.map((t) => (
                <PaymentRow
                  key={t.id}
                  name={t.eventName}
                  sub={t.status}
                  amount={formatMoney(t.amount, currency)}
                  failed={t.status === 'FAILED'}
                  rightSub={t.createdAt ? formatDate(t.createdAt) : undefined}
                />
              ))}
            </ListCard>
          </Section>
        ) : null}

      </ScrollView>
    </Screen>
  );
}

// ────── Helpers ────────────────────────────────────────────────────────────────

type KpiSpec = {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  trend?: { percentage: string; direction: 'up' | 'down' };
};

function kpi(title: string, value: string, icon: KpiSpec['icon'], accent: string, trend?: KpiSpec['trend']): KpiSpec {
  return { title, value, icon, accent, trend };
}

// ────── Components ─────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon, accent, trend, timeframe }: KpiSpec & { timeframe: string }) {
  const styles = useStyles();
  const dir = trend?.direction ?? 'up';
  const trendColor = dir === 'up' ? '#10B981' : '#EF4444';
  return (
    <View style={styles.kpi}>
      <View style={styles.kpiHead}>
        <View style={[styles.kpiIcon, { backgroundColor: accent + '20' }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        {trend ? (
          <View style={styles.kpiTrend}>
            <Ionicons name={dir === 'up' ? 'trending-up' : 'trending-down'} size={11} color={trendColor} />
            <Text style={[styles.kpiTrendText, { color: trendColor }]}>{trend.percentage}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.kpiTimeframe}>vs {timeframe}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ListCard({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.listCard}>{children}</View>;
}

function PerformanceMiniChart({ data }: { data: PerformancePoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const maxVal = Math.max(...data.flatMap((d) => [d.value1, d.value2]), 1);
  return (
    <View style={styles.perfCard}>
      <View style={styles.perfBars}>
        {data.map((d, i) => (
          <View key={i} style={styles.perfCol}>
            <View style={styles.perfBarGroup}>
              <View style={[styles.perfBar, styles.perfBar1, { height: Math.max(4, (d.value1 / maxVal) * 80) }]} />
              <View style={[styles.perfBar, styles.perfBar2, { height: Math.max(4, (d.value2 / maxVal) * 80) }]} />
            </View>
            <Text style={styles.perfDayLabel} numberOfLines={1}>{d.day.slice(0, 3)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.perfLegend}>
        <View style={styles.perfLegendItem}>
          <View style={[styles.perfLegendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.perfLegendText}>Value 1</Text>
        </View>
        <View style={styles.perfLegendItem}>
          <View style={[styles.perfLegendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.perfLegendText}>Value 2</Text>
        </View>
      </View>
    </View>
  );
}

function ActivityRow({ activity }: { activity: { id: string; type: string; title: string; createdAt?: string } }) {
  const styles = useStyles();
  const label = activity.type.charAt(0).toUpperCase() + activity.type.slice(1).toLowerCase();
  return (
    <View style={styles.listRow}>
      <View style={styles.activityDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowName} numberOfLines={2}>{activity.title}</Text>
      </View>
      {activity.createdAt ? (
        <Text style={styles.rowMeta}>{formatDate(activity.createdAt)}</Text>
      ) : null}
    </View>
  );
}

const STATUS_CHIP: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: '#FCE7F3', text: '#DB2777' },
  Completed:     { bg: '#D1FAE5', text: '#059669' },
  Pending:       { bg: '#FEF3C7', text: '#D97706' },
  Active:        { bg: '#DBEAFE', text: '#2563EB' },
};

function PhotographerRow({
  name, sub, avatar, status, onPress,
}: {
  name: string; sub?: string; avatar?: string; status?: string; onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const chip = status ? (STATUS_CHIP[status] ?? { bg: colors.surfaceMuted, text: colors.textMuted }) : null;
  return (
    <Pressable style={({ pressed }) => [styles.listRow, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={styles.rowAvatar}>
        {avatar ? (
          <RNImage source={{ uri: avatar }} style={styles.rowAvatarImg} />
        ) : (
          <Ionicons name="person" size={18} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {chip ? (
        <View style={[styles.statusChip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.statusChipText, { color: chip.text }]}>{status}</Text>
        </View>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

function PaymentRow({
  name, sub, avatar, amount, failed, rightSub,
}: {
  name: string; sub?: string; avatar?: string; amount: string; failed?: boolean; rightSub?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const amountColor = failed ? colors.error : colors.primary;
  const subColor = failed ? colors.error : colors.warning;
  return (
    <View style={styles.listRow}>
      {avatar !== undefined ? (
        <View style={styles.rowAvatar}>
          {avatar ? (
            <RNImage source={{ uri: avatar }} style={styles.rowAvatarImg} />
          ) : (
            <Ionicons name="person" size={18} color={colors.textMuted} />
          )}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        {sub ? <Text style={[styles.rowSub, { color: subColor }]}>{sub}</Text> : null}
        {rightSub ? <Text style={styles.rowMeta}>{rightSub}</Text> : null}
      </View>
      <Text style={[styles.rowAmount, { color: amountColor }]}>{amount}</Text>
    </View>
  );
}

// ────── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  scroll: { padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  subtitle: { fontSize: fontSize.sm, color: c.textMuted, marginTop: -spacing.sm },

  periodTabs: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  periodTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radii.full },
  periodTabActive: {
    backgroundColor: c.surface,
    ...e(1),
  },
  periodTabText: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  periodTabTextActive: { color: c.primary, fontWeight: fontWeight.bold },

  customDateRow: { flexDirection: 'row', gap: spacing.sm },
  customDateField: { flex: 1, gap: 4 },
  customDateLabel: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  customDateInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: c.text,
  },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 2,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kpiTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  kpiTrendText: { fontSize: 10, fontWeight: fontWeight.bold },
  kpiTitle: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold, marginTop: 6 },
  kpiValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  kpiTimeframe: { fontSize: 10, color: c.textMuted },

  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing['2xl'] },
  emptyText: { color: c.textMuted, fontSize: fontSize.sm },

  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },

  perfCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  perfBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 },
  perfCol: { flex: 1, alignItems: 'center', gap: 4 },
  perfBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  perfBar: { width: 8, borderRadius: 4 },
  perfBar1: { backgroundColor: c.primary },
  perfBar2: { backgroundColor: c.accent },
  perfDayLabel: { fontSize: 9, color: c.textMuted, fontWeight: fontWeight.semibold },
  perfLegend: { flexDirection: 'row', gap: spacing.md },
  perfLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perfLegendDot: { width: 8, height: 8, borderRadius: 4 },
  perfLegendText: { fontSize: fontSize.xs, color: c.textMuted },

  listCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent, flexShrink: 0 },
  rowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowAvatarImg: { width: 36, height: 36 },
  rowLabel: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  rowName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  rowSub: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  rowMeta: { fontSize: 10, color: c.textMuted },
  rowAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  statusChipText: { fontSize: 10, fontWeight: fontWeight.bold },
}));
