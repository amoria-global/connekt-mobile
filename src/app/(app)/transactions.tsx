import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { cleanTransactionTitle } from '@/features/analytics/api';
import { listWalletMovements, type Movement } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';

const PAGE_SIZE = 8;

export default function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listWalletMovements(), []));

  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [directionFilter, search]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((m) => {
      if (directionFilter !== 'all' && m.direction !== directionFilter) return false;
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
  }, [data, directionFilter, search]);

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
        {(
          [
            { label: 'All', value: 'all' },
            { label: 'Money in (+)', value: 'in' },
            { label: 'Money out (−)', value: 'out' },
          ] as const
        ).map((d) => {
          const active = directionFilter === d.value;
          return (
            <Pressable
              key={d.value}
              onPress={() => setDirectionFilter(d.value)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {d.label}
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
          placeholder="Search transactions..."
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
        Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of{' '}
        {filtered.length}
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
              Prev
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
              Next
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

  return (
    <Screen padded={false} edges={[]}>
      <DataList
        data={paginatedData}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title="Transactions"
        subtitle="Your wallet activity"
        headerExtra={headerExtra}
        footer={footer}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Row movement={item} />}
        emptyIcon="swap-horizontal-outline"
        emptyTitle={search || directionFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
        emptyMessage={
          search || directionFilter !== 'all'
            ? 'Try adjusting your search terms or filters.'
            : 'Money in and out of your wallet will show up here.'
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
        <Text style={styles.title} numberOfLines={1}>
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
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  icon: { width: 40, height: 40, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  date: { fontSize: fontSize.xs, color: c.textMuted },
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
    paddingHorizontal: 12,
    height: 30,
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
    fontSize: 12,
    color: c.textMuted,
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.sm,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
