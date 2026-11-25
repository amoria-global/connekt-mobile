/**
 * Photobooks: the books you made and, for a photographer, the books clients sent to edit.
 *
 * Compact rows (never a 2-column grid that stretches a lone book), a My photobooks / Received switch with counts,
 * filters that match the REAL statuses (All, In progress, Needs you, Completed), search, and a "New photobook" button.
 * The native stack header already says "Photobooks", so the screen draws no title of its own and takes no top inset
 * (that doubled inset was the empty gap under the header).
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { CreateFab, FAB_SPACE, useFabCollapse } from '@/features/events/CreateFab';
import { useCanCreate } from '@/features/events/useCanCreate';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FadedChipRow } from '@/components/ui/FadedChipRow';
import { StatusChip } from '@/components/ui/StatusChip';
import { useRole } from '@/features/auth/role';
import { listPhotobooks, listReceivedPhotobooks, type Photobook } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/store/language';
import { PhotobookListSkeleton, PhotobookRow } from '@/features/photobooks/PhotobookRow';
import { pbCopy, type CopyKey } from '@/features/photobooks/copy';
import { bucketCounts, filterBooks, type FilterKey, type Shelf } from '@/features/photobooks/model';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';

const FILTERS: { key: FilterKey; label: CopyKey }[] = [
  { key: 'all', label: 'f_all' },
  { key: 'progress', label: 'f_progress' },
  { key: 'needs', label: 'f_needs' },
  { key: 'done', label: 'f_done' },
];

export default function PhotobooksScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const clearance = useTabBarClearance();
  const fab = useFabCollapse();
  const canCreate = useCanCreate();
  const { isPhotographer } = useRole();
  const { language } = useLanguage();
  const t = useCallback((k: CopyKey, p?: Record<string, string | number>) => pbCopy(language, k, p), [language]);

  // A photographer has two shelves: books they made, and books clients sent them to edit.
  const [shelfChoice, setShelf] = useState<Shelf>('mine');
  const shelf: Shelf = isPhotographer ? shelfChoice : 'mine';
  const mine = useAsync(useCallback(() => listPhotobooks(), []));
  const receivedList = useAsync(useCallback(() => (isPhotographer ? listReceivedPhotobooks() : Promise.resolve([] as Photobook[])), [isPhotographer]));
  // Coming back from a book (resubmitted, accepted or closed there) must not show the old shelf. Quiet, so nothing flashes.
  const refreshMine = mine.refreshQuietly;
  const refreshReceived = receivedList.refreshQuietly;
  useFocusEffect(
    useCallback(() => {
      void refreshMine();
      void refreshReceived();
    }, [refreshMine, refreshReceived]),
  );
  const { data, loading, error, refresh } = shelf === 'received' ? receivedList : mine;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const books: Photobook[] = useMemo(() => data ?? [], [data]);
  const counts = useMemo(() => bucketCounts(books, shelf), [books, shelf]);
  const filtered = useMemo(() => filterBooks(books, shelf, filter, search), [books, shelf, filter, search]);
  const openBook = useCallback(
    (id: string, isReceived: boolean) => router.push((isReceived ? `/photobook/${id}?received=1` : `/photobook/${id}`) as Href),
    [router],
  );

  const header = (
    <View style={styles.header}>
      {isPhotographer ? (
        <View style={styles.switch} accessibilityRole="tablist">
          {(['mine', 'received'] as const).map((k) => {
            const on = shelf === k;
            const n = (k === 'mine' ? mine.data : receivedList.data)?.length ?? 0;
            return (
              <Pressable
                key={k}
                onPress={() => {
                  setShelf(k);
                  setFilter('all');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.seg, on && styles.segOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
                  {t(k === 'mine' ? 'mine' : 'received')}
                </Text>
                <View style={[styles.segCount, on && styles.segCountOn]}>
                  <Text style={[styles.segCountText, on && styles.segTextOn]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <FadedChipRow contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <StatusChip key={f.key} label={t(f.label)} count={counts[f.key]} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </FadedChipRow>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('search')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('search')}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('clear_all')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const filtering = !!search || filter !== 'all';
  return (
    <Screen padded={false} edges={[]}>
      <FlatList<Photobook>
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[styles.list, { paddingBottom: clearance + FAB_SPACE + spacing.lg }]}
        ItemSeparatorComponent={Gap}
        onScroll={fab.onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading && books.length > 0} onRefresh={refresh} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        initialNumToRender={8}
        windowSize={7}
        renderItem={({ item }) => <PhotobookRow book={item} shelf={shelf} onOpen={openBook} />}
        ListEmptyComponent={
          loading ? (
            <PhotobookListSkeleton />
          ) : error ? (
            <ErrorState title={t('error_title')} message={t('error_body')} onRetry={refresh} />
          ) : filtering ? (
            <EmptyState icon="search-outline" title={t('filter_empty_title')} message={t('filter_empty_body')} />
          ) : shelf === 'received' ? (
            <EmptyState icon="book-outline" title={t('received_empty_title')} message={t('received_empty_body')} />
          ) : (
            <EmptyState
              icon="book-outline"
              title={t('list_empty_title')}
              message={canCreate ? t('list_empty_body') : t('list_empty_guest')}
              action={canCreate ? { label: t('new_book'), onPress: () => router.push('/photobook/new' as Href), raised: true } : undefined}
            />
          )
        }
      />
      {canCreate && shelf === 'mine' ? (
        <CreateFab label={t('new_book')} collapsed={fab.collapsed} onPress={() => router.push('/photobook/new' as Href)} />
      ) : null}
    </Screen>
  );
}

function Gap() {
  return <View style={{ height: spacing.sm }} />;
}

const useStyles = makeStyles((c) => ({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  switch: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: radii.full, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  seg: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.full },
  segOn: { backgroundColor: c.primary },
  segText: { color: c.textSoft, fontFamily: fonts.bold, fontSize: 13.5 },
  segTextOn: { color: c.textOnPrimary },
  segCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full, backgroundColor: c.tint, alignItems: 'center' },
  segCountOn: { backgroundColor: 'transparent' },
  segCountText: { color: c.primary, fontFamily: fonts.bold, fontSize: 11.5 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radii.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  searchInput: { flex: 1, color: c.text, fontFamily: fonts.regular, fontSize: 14.5, paddingVertical: 8 },
}));
