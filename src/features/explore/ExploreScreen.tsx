/**
 * Explore: photos and short video clips from Connekyt creators, in a two column masonry.
 *
 * Store builds follow the digital goods rule in features/payments/policy.ts to the letter: no price, no Buy, no cart
 * and no wording about buying elsewhere. A viewer can browse, watch the 15 second previews, save, share, and open what
 * they already bought with the code from their receipt. Buying is on connekyt.com. The rule is expressed once, in
 * layout.capabilities, and everything price- or purchase-shaped in this folder reads it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScene } from '@/components/ui/GlassCard';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { GhostButton } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useReducedMotion, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { fetchFacets, fetchFeed, type ExploreItem, type Facets, type FeedQuery } from './api';
import { capabilities, chunk, clock, distribute } from './layout';
import { useSaves } from './saves';
import { ItemSheet } from './ItemSheet';
import { OwnedSheet } from './OwnedSheet';

const BLOCK = 8;
const GAP = 8;

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

  const [items, setItems] = useState<ExploreItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [type, setType] = useState<'' | 'PHOTO' | 'VIDEO'>('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [open, setOpen] = useState<ExploreItem | null>(null);
  const [owned, setOwned] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const seq = useRef(0);

  const colWidth = (width - spacing.lg * 2 - GAP) / 2;

  const load = useCallback(async (reset: boolean) => {
    const mine = ++seq.current;
    if (reset) { setLoading(true); setError(null); } else setMore(true);
    try {
      const page = await fetchFeed({ type, category, sort, cursor: reset ? null : cursor });
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
  }, [type, category, sort, cursor]);

  useEffect(() => { void load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type, category, sort]);
  useEffect(() => { fetchFacets().then(setFacets).catch(() => setFacets(null)); }, []);
  useEffect(() => { void saves.load(signedIn); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [signedIn]);

  const blocks = useMemo(() => chunk(items, BLOCK), [items]);

  // The clip that plays is the first clip in the first block on screen; every other card shows its poster.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find(v => v.isViewable);
    const block = first?.item as ExploreItem[] | undefined;
    setActiveClip(block?.find(i => i.mediaType === 'VIDEO' && i.previewVideoUrl)?.id ?? null);
  }).current;

  const chips = [
    { key: 'all', label: t('explore_all'), on: type === '' && !category, press: () => { setType(''); setCategory(''); } },
    { key: 'photos', label: t('explore_photos'), on: type === 'PHOTO', press: () => setType(type === 'PHOTO' ? '' : 'PHOTO') },
    { key: 'clips', label: t('explore_clips'), on: type === 'VIDEO', press: () => setType(type === 'VIDEO' ? '' : 'VIDEO') },
    ...(facets?.categories ?? []).map(c => ({ key: c.name, label: c.label, on: category === c.name, press: () => setCategory(category === c.name ? '' : c.name) })),
  ];
  const sorts: { v: Sort; label: string }[] = [
    { v: 'newest', label: t('explore_sortNewest') },
    { v: 'popular', label: t('explore_sortPopular') },
    ...(caps.showPrices ? [{ v: 'price_asc' as Sort, label: t('explore_sortPriceAsc') }, { v: 'price_desc' as Sort, label: t('explore_sortPriceDesc') }] : []),
  ];

  const renderBlock = ({ item: block }: { item: ExploreItem[] }) => {
    const cols = distribute(block, 2, colWidth, GAP);
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

  const header = (
    <View>
      <ScreenHeader title={t('explore_title')} subtitle={t(caps.subtitleKey)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
        {chips.map(c => (
          <Pressable key={c.key} onPress={c.press} hitSlop={6} accessibilityRole="tab" accessibilityState={{ selected: c.on }}
            style={[styles.chip, c.on && styles.chipOn]}>
            <Text style={[styles.chipText, c.on && styles.chipTextOn]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {sorts.map(s => (
          <Pressable key={s.v} onPress={() => setSort(s.v)} hitSlop={6} accessibilityRole="button" accessibilityState={{ selected: sort === s.v }}
            style={[styles.sortChip, sort === s.v && styles.sortChipOn]}>
            <Text style={[styles.sortText, sort === s.v && styles.chipTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setOwned(true)} hitSlop={6} accessibilityRole="button" style={styles.ownedChip}>
          <Ionicons name="lock-open-outline" size={14} color={colors.link} />
          <Text style={styles.ownedText}>{t('explore_alreadyBought')}</Text>
        </Pressable>
      </ScrollView>
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
  } else if (!loading && items.length === 0) {
    body = (
      <View style={styles.state}>
        <EmptyState icon="images-outline" title={t('explore_emptyTitle')} message={t('explore_emptyBody')}
          action={type || category ? { label: t('explore_clearFilters'), onPress: () => { setType(''); setCategory(''); } } : undefined} />
      </View>
    );
  }

  return (
    <GlassScene>
      <FlatList
        data={blocks}
        keyExtractor={b => b[0].id}
        renderItem={renderBlock}
        ListHeaderComponent={header}
        ListEmptyComponent={body}
        ListFooterComponent={more ? <View style={styles.footer}><Skeleton height={60} radius={radii.lg} /></View> : error && items.length > 0 ? (
          <View style={styles.footer}><GhostButton title={t('explore_retry')} onPress={() => void load(false)} /></View>) : null}
        onEndReached={() => { if (cursor && !loading && !more && !error) void load(false); }}
        onEndReachedThreshold={0.8}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.link} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96, paddingHorizontal: spacing.lg }}
        showsVerticalScrollIndicator={false}
        windowSize={7}
        removeClippedSubviews
      />
      {open && <ItemSheet item={open} onClose={() => setOpen(null)} saved={saves.ids.includes(open.id)} onSave={() => void saves.toggle(open.id, signedIn)} />}
      {owned && <OwnedSheet onClose={() => setOwned(false)} />}
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
  return (
    <Pressable onPress={onOpen} accessibilityRole="button"
      accessibilityLabel={`${item.title || (video ? t('explore_clip') : t('explore_photo'))}, ${item.creatorName}`}
      style={[styles.card, { height }]}>
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
      {(showPrice && item.priceAmount != null) && (
        <View style={styles.price}><Text style={styles.badgeText}>{formatPrice(item.priceAmount, item.priceCurrency)}</Text></View>
      )}
    </Pressable>
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
  footer: { paddingVertical: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  chip: { minHeight: 32, paddingHorizontal: 14, borderRadius: radii.full, justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontFamily: fonts.medium, fontSize: fontSize.sm },
  chipTextOn: { color: c.textOnPrimary },
  sortChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: radii.full, justifyContent: 'center' },
  sortChipOn: { backgroundColor: c.tintAccent },
  sortText: { color: c.textMuted, fontFamily: fonts.medium, fontSize: fontSize.xs },
  ownedChip: { minHeight: 28, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownedText: { color: c.link, fontFamily: fonts.semibold, fontSize: fontSize.xs },
  card: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.borderSoft },
  fill: { ...({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const) },
  badge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, backgroundColor: c.scrim },
  badgeText: { color: c.textOnPrimary, fontFamily: fonts.semibold, fontSize: fontSize.xs },
  heart: { position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.scrim },
  heartOn: { backgroundColor: c.accent },
  price: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, backgroundColor: c.scrim },
}));
