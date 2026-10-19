import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { cleanTransactionTitle } from '@/features/analytics/api';
import { listWalletMovementsPage, type Movement } from '@/features/wallet/api';
import { useMovementPages } from '@/features/wallet/useMovementPages';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { useAuth } from '@/store/auth';
import {
  getDirectionFilters,
  isVisibleToRole,
  matchesDirectionFilter,
  toRole,
  type DashboardRole,
  type DirectionFilter,
} from '@/features/wallet/moneyView';

const PAGE_SIZE = 8;

export default function TransactionsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const user = useAuth((s) => s.user);
  const role: DashboardRole = toRole(user?.customerType);
  const directionFilters = getDirectionFilters(role);
  const { data, loading, error, refresh } = useAsync(useCallback(() => listWalletMovementsPage(0, 50), []));
  const pages = useMovementPages(data);

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [directionFilter, search]);

  const filtered = useMemo(() => {
    const list = pages.items;
    return list.filter((m) => {
      if (!isVisibleToRole(m, role)) return false;
      if (!matchesDirectionFilter(m, directionFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const rawTitle = m.description || m.category || 'Transaction';
        const cleanTitle = cleanTransactionTitle(rawTitle).toLowerCase();
        const matchCat = (m.category ?? '').toLowerCase().includes(q);
        const matchAmt = String(m.amount).includes(q);
        if (!cleanTitle.includes(q) && !matchCat && !matchAmt) return false;
      }
      return true;
    });
  }, [pages.items, directionFilter, search, role]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const headerExtra = (
    <View style={styles.headerFilters}>
      {/* Direction Pills */}
      <View style={styles.filterRow}>
        {directionFilters.map((d) => {
          const active = directionFilter === d.value;
          let label = d.label;
          if (d.value === 'all') label = t('allTransactions');
          else if (d.value === 'in') label = role === 'photographer' ? `${t('earnings')} (+)` : `${t('moneyIn')} (+)`;
          else if (d.value === 'out') label = `${t('moneyOut')} (−)`;
          else if (d.value === 'withdrawals') label = t('withdrawals');
          return (
            <Pressable
              key={d.value}
              onPress={() => setDirectionFilter(d.value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search Input */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchTransactionsPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={6}>
            <Ionicons name="close-circle" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const footer = filtered.length > 0 ? (
    <View style={styles.paginationRow}>
      <Text style={styles.paginationInfo}>
        {t('showingRangeOfTotal', {
          from: (safePage - 1) * PAGE_SIZE + 1,
          to: Math.min(safePage * PAGE_SIZE, filtered.length),
          total: filtered.length,
        })}
      </Text>
      {totalPages > 1 ? (
        <View style={styles.paginationButtons}>
          <Pressable
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={[styles.pageNavBtn, safePage <= 1 && styles.pageNavBtnDisabled]}
            hitSlop={6}
          >
            <Ionicons
              name="chevron-back"
              size={14}
              color={safePage <= 1 ? colors.textMuted : colors.text}
            />
            <Text style={[styles.pageNavBtnText, safePage <= 1 && styles.pageNavBtnTextDisabled]}>
              {t('prev')}
            </Text>
          </Pressable>

          <View style={styles.pageIndicatorPill}>
            <Text style={styles.pageIndicatorText}>
              {safePage} / {totalPages}
            </Text>
          </View>

          <Pressable
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={[styles.pageNavBtn, safePage >= totalPages && styles.pageNavBtnDisabled]}
            hitSlop={6}
          >
            <Text
              style={[
                styles.pageNavBtnText,
                safePage >= totalPages && styles.pageNavBtnTextDisabled,
              ]}
            >
              {t('next')}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={safePage >= totalPages ? colors.textMuted : colors.text}
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  ) : undefined;

  const loadOlder =
    pages.hasMore || pages.moreError ? (
      <View style={{ alignItems: 'center', gap: 6, paddingBottom: spacing.lg }}>
        {pages.hasMore ? (
          <Pressable
            onPress={pages.loadMore}
            disabled={pages.loadingMore}
            accessibilityRole="button"
            accessibilityLabel="Load older transactions"
            accessibilityState={{ disabled: pages.loadingMore, busy: pages.loadingMore }}
            style={[styles.pageNavBtn, { minHeight: 44, justifyContent: 'center' }]}
          >
            <Text style={styles.pageNavBtnText}>{pages.loadingMore ? 'Loading older...' : 'Load older transactions'}</Text>
          </Pressable>
        ) : null}
        {pages.moreError ? <Text style={styles.paginationInfo} accessibilityRole="alert">{pages.moreError}</Text> : null}
      </View>
    ) : null;

  return (
    <Screen padded={false} edges={[]}>
      <DataList
        data={paginatedData}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title={t('transactionsTitle')}
        duplicatesHeader
        subtitle={t('walletActivitySubtitle')}
        headerExtra={headerExtra}
        footer={
          footer || loadOlder ? (
            <View>
              {footer}
              {loadOlder}
            </View>
          ) : undefined
        }
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Row movement={item} />}
        emptyIcon="swap-horizontal-outline"
        emptyTitle={search || directionFilter !== 'all' ? t('noMatchingTransactions') : t('noTransactionsYet')}
        emptyMessage={
          search || directionFilter !== 'all'
            ? t('adjustSearchFilters')
            : t('moneyInOutWallet')
        }
      />
    </Screen>
  );
}

function Row({ movement }: { movement: Movement }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inbound = movement.direction === 'in';
  const rawTitle = movement.description || movement.category || 'Transaction';
  const cleanTitle = cleanTransactionTitle(rawTitle);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: inbound ? colors.successBg : colors.errorBg }]}>
        <Text style={[styles.sign, { color: inbound ? colors.success : colors.error }]}>
          {inbound ? '↓' : '↑'}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {cleanTitle}
        </Text>
        {movement.createdAt ? <Text style={styles.date}>{formatDate(movement.createdAt)}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: inbound ? colors.success : colors.text }]}>
        {inbound ? '+' : '-'}
        {formatPrice(movement.amount, movement.currency)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text, lineHeight: 19 },
  date: { fontSize: 12, color: c.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Header Filters & Search
  headerFilters: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: 14,
    minHeight: 40,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textSoft,
  },
  filterPillTextActive: {
    color: c.textOnPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
  },

  // Pagination Controls
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: 2,
    gap: 8,
    marginTop: spacing.xs,
  },
  paginationInfo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.text,
  },
  pageNavBtnTextDisabled: {
    color: c.textMuted,
  },
  pageIndicatorPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: c.tint,
  },
  pageIndicatorText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
}));
