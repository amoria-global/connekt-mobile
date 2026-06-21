/**
 * Public events explorer — mirrors the web `pages/events/events.tsx` flow:
 * a hero, a live-events strip, status tabs (All / Live / Upcoming /
 * Completed) and a list of poster-style cards. Tapping a card routes into
 * the public event detail (no login required).
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { listPublicEventsDetailed } from '@/features/events/api';
import type { PublicEvent } from '@/features/events/types';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=70';

type TabKey = 'all' | 'live' | 'upcoming' | 'completed';

const TABS: { label: string; value: TabKey }[] = [
  { label: 'All', value: 'all' },
  { label: 'Live', value: 'live' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'completed' },
];

function isLive(e: PublicEvent): boolean {
  return e.hasLiveStream || e.streamStatus === 'live' || e.status === 'ONGOING';
}
function isUpcoming(e: PublicEvent): boolean {
  if (!e.eventDate) return e.status === 'UPCOMING' || e.status === 'AWAITING_REVIEW';
  return new Date(e.eventDate).getTime() > Date.now() - 24 * 3600 * 1000;
}
function isCompleted(e: PublicEvent): boolean {
  return e.status === 'COMPLETED' || e.streamStatus === 'ended';
}

function formatTime12h(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function describeWhen(e: PublicEvent): string {
  if (!e.eventDate) return 'Date TBA';
  const target = new Date(e.eventDate + (e.startTime ? `T${e.startTime}` : 'T00:00'));
  const diff = target.getTime() - Date.now();
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  if (diff < 0) {
    return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (diff < HOUR) return `Starts in ${Math.max(1, Math.round(diff / 60000))} min`;
  if (diff < DAY) return `Starts in ${Math.round(diff / HOUR)}h`;
  if (diff < 7 * DAY) {
    const d = Math.round(diff / DAY);
    return `In ${d} day${d === 1 ? '' : 's'}`;
  }
  return target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatFee(e: PublicEvent): string {
  if (!e.streamFee || e.streamFee <= 0) return 'Free';
  const code = e.streamFeeCurrencySymbol ?? e.streamFeeCurrencyCode;
  return `${e.streamFee.toLocaleString()} ${code}`;
}

export default function ExploreEventsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');

  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listPublicEventsDetailed(), []),
  );

  const liveEvents = useMemo(() => (data ?? []).filter(isLive), [data]);

  const filtered = useMemo(() => {
    const all = data ?? [];
    const matchesTab = (e: PublicEvent) =>
      tab === 'all'
        ? true
        : tab === 'live'
        ? isLive(e)
        : tab === 'upcoming'
        ? isUpcoming(e) && !isLive(e) && !isCompleted(e)
        : isCompleted(e);
    const matchesSearch = (e: PublicEvent) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location?.toLowerCase().includes(q) ?? false) ||
        (e.category?.toLowerCase().includes(q) ?? false) ||
        (e.organizer?.toLowerCase().includes(q) ?? false)
      );
    };
    return all.filter((e) => matchesTab(e) && matchesSearch(e));
  }, [data, tab, search]);

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>EVENTS</Text>
        <Text style={styles.heroTitle}>Catch every moment, live.</Text>
        <Text style={styles.heroSub}>
          Discover events near you and join the live stream — no login needed.
        </Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.85)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search events, location, organizer…"
            placeholderTextColor="rgba(255,255,255,0.65)"
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {liveEvents.length > 0 ? (
        <View style={styles.trendsSection}>
          <Text style={styles.trendsHeading}>Live now</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendsRow}
          >
            {liveEvents.slice(0, 12).map((e) => (
              <Pressable
                key={e.id}
                style={styles.trendItem}
                onPress={() => router.push(`/event/${e.id}`)}
              >
                <View style={styles.trendRing}>
                  <Image
                    source={{ uri: e.coverImage || COVER_FALLBACK }}
                    style={styles.trendAvatar}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.liveDotPill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveDotText}>LIVE</Text>
                </View>
                <Text style={styles.trendCaption} numberOfLines={2}>
                  {e.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.tabsWrap}>
        <Segmented value={tab} options={TABS} onChange={setTab} />
      </View>
    </View>
  );

  if (loading && !data) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.cardRowPad}>
            <PosterCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
          </View>
        )}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title="No events match"
              message="Try a different filter or clear your search."
            />
          </View>
        }
      />
    </Screen>
  );
}

function PosterCard({ event, onPress }: { event: PublicEvent; onPress: () => void }) {
  const live = isLive(event);
  const fee = formatFee(event);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <Image
        source={{ uri: event.coverImage || COVER_FALLBACK }}
        style={styles.cardCover}
        contentFit="cover"
        transition={250}
      />

      {live ? (
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
      ) : null}

      <View style={styles.cardOverlay}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar" size={13} color="#fff" />
          <Text style={styles.cardMetaText}>{describeWhen(event)}</Text>
          {event.startTime ? (
            <>
              <Text style={styles.cardMetaDivider}>·</Text>
              <Text style={styles.cardMetaText}>{formatTime12h(event.startTime)}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.cardBody}>
        {event.location ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={styles.cardRowText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
        {event.organizer ? (
          <View style={styles.cardRow}>
            <Ionicons name="person-outline" size={15} color={colors.textMuted} />
            <Text style={styles.cardRowText} numberOfLines={1}>
              {event.organizer}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardFee}>{fee}</Text>
          <View style={styles.cardCta}>
            <Text style={styles.cardCtaText}>{live ? 'Watch live' : 'View'}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: '#FFD28A',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: colors.textOnPrimary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: 32,
  },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.sm },
  searchWrap: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textOnPrimary, fontSize: fontSize.sm, paddingVertical: 0 },

  trendsSection: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  trendsHeading: {
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  trendsRow: { paddingHorizontal: spacing.xl, gap: spacing.md },
  trendItem: { width: 88, alignItems: 'center', gap: 6 },
  trendRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendAvatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.surfaceMuted },
  liveDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginTop: -10,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveDotText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
  trendCaption: {
    fontSize: fontSize.xs,
    color: colors.textSoft,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },

  tabsWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md },
  listContent: { paddingBottom: 120, gap: spacing.md, flexGrow: 1 },
  cardRowPad: { paddingHorizontal: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  emptyWrap: { paddingTop: spacing['2xl'] },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  cardPressed: { opacity: 0.93 },
  cardCover: { width: '100%', height: 180, backgroundColor: colors.surfaceMuted },
  livePill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  livePillText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  cardOverlay: {
    position: 'absolute',
    bottom: 90,
    left: spacing.md,
    right: spacing.md,
    gap: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  cardMetaDivider: { color: 'rgba(255,255,255,0.7)' },
  cardBody: { padding: spacing.lg, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardRowText: { flex: 1, color: colors.textSoft, fontSize: fontSize.sm },
  cardFooter: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardFee: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  cardCtaText: { color: colors.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
