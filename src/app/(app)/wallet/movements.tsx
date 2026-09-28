/**
 * Wallet movements — the transaction feed behind the wallet card.
 *
 * Reuses `listWalletMovements()` which calls /wallet/me/movements?page=0&size=50.
 * Surfaces individual credits/debits with search, direction filtering, and
 * pagination so users can audit wallet history without long scrolling.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { cleanTransactionTitle } from '@/features/analytics/api';
import { listWalletMovements, type Movement } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

const PAGE_SIZE = 8;

export default function WalletMovementsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();

  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listWalletMovements(), []),
  );

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
        const rawTitle = m.description || m.category || (m.direction === 'in' ? 'Credit' : 'Debit');
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
      {/* Direction Filter Pills */}
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
          placeholder="Search movements..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
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
      <Stack.Screen options={{ title: '', headerTitle: '' }} />
      <ScreenHeader title="Wallet movements" subtitle="Every credit and debit on your wallet" />
      <DataList<Movement>
        data={paginatedData}
        loading={loading}
        error={error}
        onRefresh={refresh}
        headerExtra={headerExtra}
        footer={footer}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MovementRow movement={item} />}
        emptyIcon="swap-vertical-outline"
        emptyTitle={search || directionFilter !== 'all' ? 'No matching movements' : 'No movements yet'}
        emptyMessage={
          search || directionFilter !== 'all'
            ? 'Try adjusting your search terms or filters.'
            : 'Payouts, tips and donations will show up here as they happen.'
        }
      />
    </Screen>
  );
}

function MovementRow({ movement }: { movement: Movement }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isIn = movement.direction === 'in';
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: isIn ? colors.successBg : colors.errorBg }]}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={isIn ? colors.success : colors.error}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {movement.description || movement.category || (isIn ? 'Credit' : 'Debit')}
        </Text>
        {movement.createdAt ? (
          <Text style={styles.meta}>{formatDate(movement.createdAt)}</Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: isIn ? colors.success : colors.error }]}>
        {isIn ? '+' : '−'} {formatMoney(movement.amount, movement.currency)}
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
    padding: spacing.lg,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  meta: { fontSize: fontSize.xs, color: c.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold },

  // Header Filters & Search
  headerFilters: {
    gap: spacing.sm,
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
