/**
 * Explore: photos and short video clips from Connekyt creators, in a two column masonry.
 *
 * Store builds follow the digital goods rule in features/payments/policy.ts to the letter: no price, no Buy, no cart
 * and no wording about buying elsewhere. A viewer can browse, watch the 15 second previews, save, share, and open what
 * they already bought with the code from their receipt. Buying is on connekyt.com. The rule is expressed once, in
 * layout.capabilities, and everything price- or purchase-shaped in this folder reads it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScene } from '@/components/ui/GlassCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { GhostButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { useAuth } from '@/store/auth';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, onMedia, radii, spacing, useReducedMotion, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { fetchFacets, fetchFeed, fetchItem, type ExploreItem, type Facets, type FeedQuery } from './api';
import { capabilities, chunk, clock, distribute } from './layout';
import { useSaves } from './saves';
import { ItemSheet } from './ItemSheet';
import { OwnedSheet } from './OwnedSheet';
import { CartSheet } from './CartSheet';
import { FiltersSheet, matches, NO_FILTERS, type Filters } from './FiltersSheet';
import { useCart } from './cart';

const BLOCK = 8;
const GAP = 12;
const CAPTION = 44;

type Sort = NonNullable<FeedQuery['sort']>;

export default function ExploreScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const caps = capabilities(digitalPurchasesEnabled);
  const signedIn = !!useAuth(s => s.user);
  const saves = useSaves();
  const cart = useCart();
  const displayCurrency = useCurrency(s => s.currency);

  const [items, setItems] = useState<ExploreItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [creator, setCreator] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const barBottom = useRef(9999);
  const type = filters.type;
  // One category goes to the server; several are narrowed on the phone (see FiltersSheet.matches).
  const category = filters.cats.length === 1 ? filters.cats[0] : '';
  useEffect(() => { const h = setTimeout(() => setQ(query.trim()), 350); return () => clearTimeout(h); }, [query]);
  const [sort, setSort] = useState<Sort>('newest');
  const [open, setOpen] = useState<ExploreItem | null>(null);
  const [owned, setOwned] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const seq = useRef(0);
  // On web the page is pre-rendered at another width, so draw the grid only after the first client render: no hydration mismatch.
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => { setReady(true); }, []);

  const colWidth = (width - spacing.lg * 2 - GAP) / 2;

  const load = useCallback(async (reset: boolean) => {
    const mine = ++seq.current;
    if (reset) { setLoading(true); setError(null); } else setMore(true);
    try {
      const page = await fetchFeed({ type, category, sort, q, cursor: reset ? null : cursor });
      if (mine !== seq.current) return;
      setItems(prev => (reset ? page.items : [...prev, ...page.items.filter(n => !prev.some(p => p.id === n.id))]));
      setCursor(page.nextCursor);
    } catch (e) {
      if (mine !== seq.current) return;
      const status = (e as { status?: number }).status;
      setError(status ? 'failed' : 'offline');
    } finally {
      if (mine === seq.current) { setLoading(false); setMore(false); setRefreshing(false); }
    }
  }, [type, category, sort, q, cursor]);

  // The Saved view: the items this person hearted, looked up one by one (an item that stopped being public drops out).
  const loadSaved = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true); setError(null); setCursor(null);
    try {
      const found = await Promise.all(saves.ids.map(id => fetchItem(id)));
      if (mine !== seq.current) return;
      setItems(found.filter((x): x is ExploreItem => !!x));
    } catch {
      if (mine !== seq.current) return;
      setError('offline');
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saves.ids.join(',')]);
  useEffect(() => { void (savedOnly ? loadSaved() : load(true)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type, category, sort, q, savedOnly]);
  useEffect(() => { fetchFacets().then(setFacets).catch(() => setFacets(null)); }, []);
  useEffect(() => { void saves.load(signedIn); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signedIn]);

  const visible = useMemo(
    () => items.filter(i => matches(i, filters, facets) && (!creator || i.creatorId === creator)),
    [items, filters, facets, creator],
  );
  const blocks = useMemo(() => chunk(visible, BLOCK), [visible]);

  // Featured creators come from what is loaded: the ones with the most items first, three pictures each.
  const creators = useMemo(() => {
    const by = new Map<string, ExploreItem[]>();
    for (const i of items) { const k = i.creatorId || i.creatorName; by.set(k, [...(by.get(k) ?? []), i]); }
    return [...by.entries()].map(([id, list]) => ({ id, name: list[0].creatorName, logo: list[0].creatorLogo, list }))
      .sort((a, b) => b.list.length - a.list.length).slice(0, 8);
  }, [items]);

  // The clip that plays is the first clip in the first block on screen; every other card shows its poster.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.isViewable);
    const block = first?.item as ExploreItem[] | undefined;
    setActiveClip(block?.find(i => i.mediaType === 'VIDEO' && i.previewVideoUrl)?.id ?? null);
  }).current;

  const resetAll = () => { setFilters(NO_FILTERS); setSavedOnly(false); setCreator(null); };
  const chips = [
    { key: 'all', label: t('explore_all'), on: type === '' && filters.cats.length === 0 && !savedOnly, press: resetAll },
    { key: 'photos', label: t('explore_photos'), on: type === 'PHOTO', press: () => setFilters({ ...filters, type: type === 'PHOTO' ? '' : 'PHOTO' }) },
    { key: 'clips', label: t('explore_clips'), on: type === 'VIDEO', press: () => setFilters({ ...filters, type: type === 'VIDEO' ? '' : 'VIDEO' }) },
    ...(facets?.categories ?? []).map(c => ({ key: c.name, label: c.label, on: filters.cats.includes(c.name), press: () => setFilters({ ...filters, cats: filters.cats.includes(c.name) ? [] : [c.name] }) })),
    { key: 'saved', label: `${t('explore_savedTitle')}${saves.ids.length ? ` ${saves.ids.length}` : ''}`, on: savedOnly, press: () => setSavedOnly(!savedOnly) },
  ];
  const sorts: { v: Sort; label: string }[] = [
    { v: 'newest', label: t('explore_sortNewest') },
    { v: 'popular', label: t('explore_sortPopular') },
    ...(caps.showPrices ? [{ v: 'price_asc' as Sort, label: t('explore_sortPriceAsc') }, { v: 'price_desc' as Sort, label: t('explore_sortPriceDesc') }] : []),
  ];
  const sortLabel = sorts.find(s => s.v === sort)?.label ?? '';
  const activeFilters = (filters.cats.length ? 1 : 0) + (filters.price ? 1 : 0) + (filters.orient !== 'any' ? 1 : 0);

  const renderBlock = ({ item: block }: { item: ExploreItem[] }) => {
    const cols = distribute(block, 2, colWidth, GAP + CAPTION);
    return (
      <View style={styles.block}>
        {cols.map((col, ci) => (
          <View key={ci} style={{ width: colWidth, gap: GAP }}>
            {col.map(it => (
              <Card key={it.id} item={it} width={colWidth} playing={!reduced && activeClip === it.id} showPrice={caps.showPrices}
                saved={saves.ids.includes(it.id)} onSave={() => void saves.toggle(it.id, signedIn)} onOpen={() => setOpen(it)} />
            ))}
          </View>
        ))}
      </View>
    );
  };

  const searchRow = (
    <View style={styles.searchRow}>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t('explore_searchShort')} placeholderTextColor={colors.textMuted}
          returnKeyType="search" autoCorrect={false} style={styles.searchInput} accessibilityLabel={t('explore_searchShort')} />
      </View>
      <Pressable onPress={() => setFiltersOpen(true)} accessibilityRole="button" accessibilityLabel={t('explore_filters')} hitSlop={4} style={styles.round}>
        <Ionicons name="options-outline" size={18} color={colors.text} />
        {activeFilters > 0 && <View style={styles.dot} />}
      </Pressable>
    </View>
  );
  const chipRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {chips.map(c => (
        <Pressable key={c.key} onPress={c.press} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: c.on }}
          style={[styles.chip, c.on && styles.chipOn]}>
          <Text style={[styles.chipText, c.on && styles.chipTextOn]}>{c.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">{t('explore_title')}</Text>
        {caps.canBuy && (
          <Pressable onPress={() => setCartOpen(true)} accessibilityRole="button" accessibilityLabel={`${t('explore_cart')} ${cart.items.length}`} hitSlop={4} style={styles.round}>
            <Ionicons name="bag-outline" size={18} color={colors.text} />
            {cart.items.length > 0 && <View style={styles.badgeCount}><Text style={styles.badgeCountText}>{cart.items.length}</Text></View>}
          </Pressable>
        )}
      </View>
      <View onLayout={e => { barBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}>
        {searchRow}
        {chipRow}
      </View>

      {!savedOnly && !q && creators.length > 1 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('explore_featured')}</Text>
            {creator && <Pressable onPress={() => setCreator(null)} hitSlop={10} accessibilityRole="button"><Text style={styles.link}>{t('explore_seeAll')}</Text></Pressable>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.creatorRow}>
            {creators.map(c => (
              <Pressable key={c.id} onPress={() => setCreator(creator === c.id ? null : c.id)} accessibilityRole="button" accessibilityState={{ selected: creator === c.id }}
                accessibilityLabel={`${c.name}, ${t('explore_itemsCount').replace('{n}', String(c.list.length))}`} style={styles.creator}>
                <View style={[styles.mosaic, creator === c.id && styles.mosaicOn]}>
                  <View style={styles.mosaicBig}>{c.list[0].thumbnailUrl && <Image source={{ uri: c.list[0].thumbnailUrl }} style={styles.fillAll} contentFit="cover" />}</View>
                  <View style={styles.mosaicSide}>
                    {[1, 2].map(n => (
                      <View key={n} style={styles.mosaicSmall}>{c.list[n]?.thumbnailUrl && <Image source={{ uri: c.list[n].thumbnailUrl as string }} style={styles.fillAll} contentFit="cover" />}</View>
                    ))}
                  </View>
                </View>
                <View style={styles.creatorMeta}>
                  <View style={styles.avatar}>{c.logo ? <Image source={{ uri: c.logo }} style={styles.fillAll} contentFit="cover" /> : <Text style={styles.avatarText}>{c.name.slice(0, 1).toUpperCase()}</Text>}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.creatorName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.creatorCount}>{t('explore_itemsCount').replace('{n}', String(c.list.length))}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{savedOnly ? t('explore_savedTitle') : t('explore_latest')}</Text>
        <Pressable onPress={() => setSortOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${t('explore_sort')}: ${sortLabel}`} style={styles.sortBtn}>
          <Text style={styles.link}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.link} />
        </Pressable>
      </View>
    </View>
  );

  let body;
  if (loading && items.length === 0) {
    body = (
      <View style={styles.block}>
        {[0, 1].map(c => (
          <View key={c} style={{ width: colWidth, gap: GAP }}>
            {[170, 120, 210, 140].map((h, i) => <Skeleton key={i} height={h + (c ? 20 : 0)} radius={radii.lg} />)}
          </View>
        ))}
      </View>
    );
  } else if (error && items.length === 0) {
    body = (
      <View style={styles.state}>
        {error === 'offline'
          ? <EmptyState icon="cloud-offline-outline" title={t('explore_offlineTitle')} message={t('explore_offlineBody')} action={{ label: t('explore_retry'), onPress: () => void load(true) }} />
          : <ErrorState title={t('explore_errorTitle')} message={t('explore_errorBody')} onRetry={() => void load(true)} />}
      </View>
    );
  } else if (!loading && visible.length === 0) {
    body = (
      <View style={styles.state}>
        {savedOnly && !creator
          ? <EmptyState icon="heart-outline" title={t('explore_savedTitle')} message={t('explore_savedEmpty')} action={{ label: t('explore_seeAll'), onPress: () => setSavedOnly(false) }} />
          : <EmptyState icon="images-outline" title={t('explore_emptyTitle')} message={t('explore_emptyBody')}
              action={{ label: t('explore_clearFilters'), onPress: () => { resetAll(); setQuery(''); } }} />}
      </View>
    );
  }

  if (!ready) return <GlassScene />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > barBottom.current;
    if (next !== stuck) setStuck(next);
  };

  return (
    <GlassScene>
      <FlatList
        data={blocks}
        keyExtractor={b => b[0].id}
        renderItem={renderBlock}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        ListFooterComponent={(
          <View style={styles.footer}>
            {more ? <Skeleton height={60} radius={radii.lg} /> : error && items.length > 0 ? <GhostButton title={t('explore_retry')} onPress={() => void load(false)} /> : null}
            <Pressable onPress={() => setOwned(true)} hitSlop={10} accessibilityRole="button" style={styles.ownedChip}>
              <Ionicons name="lock-open-outline" size={14} color={colors.link} />
              <Text style={styles.link}>{t('explore_alreadyBought')}</Text>
            </Pressable>
          </View>
        )}
        onScroll={onScroll}
        scrollEventThrottle={32}
        onEndReached={() => { if (!savedOnly && cursor && !loading && !more && !error) void load(false); }}
        onEndReachedThreshold={0.8}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void (savedOnly ? loadSaved() : load(true)); }} tintColor={colors.link} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        removeClippedSubviews
      />
      {stuck && (
        <View style={styles.sticky} pointerEvents="box-none">
          {searchRow}
          {chipRow}
        </View>
      )}
      {open && <ItemSheet item={open} onClose={() => setOpen(null)} saved={saves.ids.includes(open.id)} onSave={() => void saves.toggle(open.id, signedIn)}
        more={items.filter(i => i.id !== open.id && (i.creatorId === open.creatorId || i.categoryLabel === open.categoryLabel)).slice(0, 6)} onOpenOther={setOpen} />}
      {owned && <OwnedSheet onClose={() => setOwned(false)} />}
      {cartOpen && <CartSheet onClose={() => setCartOpen(false)} />}
      {filtersOpen && <FiltersSheet initial={filters} items={items} facets={facets} showPrices={caps.showPrices} currency={displayCurrency} onApply={setFilters} onClose={() => setFiltersOpen(false)} />}
      {sortOpen && (
        <Sheet title={t('explore_sort')} onClose={() => setSortOpen(false)}>
          {sorts.map(s => (
            <Pressable key={s.v} onPress={() => { setSort(s.v); setSortOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: sort === s.v }} style={styles.sortRow}>
              <Text style={[styles.sortRowText, sort === s.v && styles.link]}>{s.label}</Text>
              {sort === s.v && <Ionicons name="checkmark" size={18} color={colors.link} />}
            </Pressable>
          ))}
        </Sheet>
      )}
    </GlassScene>
  );
}

function Card({ item, width, playing, showPrice, saved, onSave, onOpen }: {
  item: ExploreItem; width: number; playing: boolean; showPrice: boolean; saved: boolean; onSave: () => void; onOpen: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  const video = item.mediaType === 'VIDEO';
  const height = Math.round(width / item.aspectRatio);
  const title = item.title || (video ? t('explore_clip') : t('explore_photo'));
  return (
    <View>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${title}, ${item.creatorName}`} style={[styles.card, { height }]}>
        {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} style={styles.fill} contentFit="cover" transition={160} recyclingKey={item.id} />}
        {video && playing && item.previewVideoUrl && <ClipPreview url={item.previewVideoUrl} />}
        {video && (
          <View style={styles.badge}>
            <Ionicons name="play" size={11} color={styles.badgeText.color} />
            <Text style={styles.badgeText}>{clock(item.durationSeconds) || t('explore_clip')}</Text>
          </View>
        )}
        <Pressable onPress={onSave} hitSlop={10} accessibilityRole="button" accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? t('explore_saved') : t('explore_save')} style={[styles.heart, saved && styles.heartOn]}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={16} color={styles.badgeText.color} />
        </Pressable>
      </Pressable>
      <View style={styles.caption}>
        <Text style={styles.capTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.capRow}>
          <Text style={styles.capCreator} numberOfLines={1}>{item.creatorName}</Text>
          {showPrice && item.priceAmount != null && <Text style={styles.capPrice}>{formatPrice(item.priceAmount, item.priceCurrency)}</Text>}
        </View>
      </View>
    </View>
  );
}

/** The muted, looping 15 second preview. Mounted for one card at a time. */
function ClipPreview({ url }: { url: string }) {
  const styles = useStyles();
  const player = useVideoPlayer(url, p => { p.muted = true; p.loop = true; p.play(); });
  return <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls={false} />;
}

const useStyles = makeStyles((c) => ({
  block: { flexDirection: 'row', gap: GAP, marginBottom: GAP },
  state: { paddingTop: spacing.xl },
  footer: { paddingVertical: spacing.md, gap: spacing.md, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { color: c.text, fontFamily: fonts.display, fontSize: 32 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md },
  search: { flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 14, borderRadius: radii.full, backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  searchInput: { flex: 1, color: c.text, fontFamily: fonts.regular, fontSize: fontSize.sm, paddingVertical: 0 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  badgeCount: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent },
  badgeCountText: { color: onMedia.text, fontFamily: fonts.bold, fontSize: 11 },
  chips: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.lg },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: radii.full, justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextOn: { color: c.textOnPrimary },
  sticky: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: c.glassSolid, borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  section: { marginTop: spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, marginBottom: spacing.md },
  sectionTitle: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.md },
  link: { color: c.link, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  sortRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortRowText: { color: c.text, fontFamily: fonts.medium, fontSize: fontSize.md },
  creatorRow: { gap: GAP, paddingRight: spacing.lg },
  creator: { width: 168 },
  mosaic: { height: 96, flexDirection: 'row', gap: 2, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.borderSoft },
  mosaicOn: { borderColor: c.primary, borderWidth: 2 },
  mosaicBig: { flex: 3, backgroundColor: c.surfaceMuted },
  mosaicSide: { flex: 2, gap: 2 },
  mosaicSmall: { flex: 1, backgroundColor: c.surfaceMuted },
  creatorMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  avatar: { width: 28, height: 28, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  avatarText: { color: c.textOnPrimary, fontFamily: fonts.bold, fontSize: fontSize.xs },
  creatorName: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  creatorCount: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  fillAll: { flex: 1 },
  ownedChip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.borderSoft },
  fill: { ...({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const) },
  badge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, backgroundColor: onMedia.smoke },
  badgeText: { color: onMedia.text, fontFamily: fonts.semibold, fontSize: fontSize.xs },
  heart: { position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: onMedia.smoke },
  heartOn: { backgroundColor: c.accent },
  caption: { height: CAPTION, paddingTop: 6, paddingHorizontal: 2 },
  capTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  capRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  capCreator: { flex: 1, color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  capPrice: { color: c.link, fontFamily: fonts.bold, fontSize: fontSize.xs },
}));
