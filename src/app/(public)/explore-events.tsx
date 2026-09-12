/**
 * Public events explorer — mirrors the web `pages/events/events.tsx` 1:1.
 *
 * Web parity in this file:
 *   • Dismissable banner ("The Smart Way to Capture Life · Discover amazing
 *     events near you!") with × close button.
 *   • Hero with brand-blue background + eyebrow ("✨ Connekyt events") +
 *     title + sub.
 *   • Hot Live Trends row above the tabs (only when ≥1 event is live):
 *     pill "🔥 Hot Live Trends · {count}" + circular avatars with rotating
 *     gradient ring + "LIVE" pulse badge.
 *   • Tab segment: All events / Live now / Upcoming / Recently ended
 *     (web tabs 2147-2193). Live tab shows a count chip.
 *   • Filter controls card: search input + category / location / date
 *     dropdowns (web 2197-2260). On mobile we keep the search visible
 *     and put the dropdowns in a horizontal scroll row.
 *   • Result strip ("X events live now · N filters active") (web 2263).
 *   • Poster cards (web 2342-2487):
 *       - full-bleed cover + dark scrim
 *       - TL: stacked date tear-off "MAY / 09"
 *       - TR: status banner (LIVE pulse / ENDED gray / UPCOMING blue) +
 *         bookmark toggle
 *       - meta strip: location · title · footer (organizer chip + price)
 *   • Pagination (Prev / 1 2 3 / Next) when totalPages > 1.
 *   • Saved-events bookmarks persisted to SecureStore under
 *     `connekyt:savedEvents` (matches the web's localStorage key).
 *
 * Status taxonomy (verbatim from knockout events.tsx:373-379):
 *   isLive   = eventStatus === 'ONGOING' && streamStatus !== 'ended'
 *              && (hasLiveStream === true || id ∈ liveStreamIds)
 *   isEnded  = eventStatus === 'COMPLETED' || streamStatus === 'ended'
 *   tab → backend status: all → undefined, live → ONGOING,
 *                          upcoming → PUBLISHED, completed → COMPLETED
 *
 * The web extra-verifies "ONGOING" via Cloudflare's `getStreamVideo`
 * (auth-required); guests on mobile can't call that, so the live set is
 * always empty and we fall back to the `hasLiveStream` flag (same code
 * path the web takes when the verification check is unavailable).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { listPublicEventsDetailed } from '@/features/events/api';
import {
  isEventEnded,
  isEventLive,
  TAB_TO_STATUS,
  type PublicEvent,
  type PublicEventsTab,
} from '@/features/events/types';
import { storage } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { canShowDigitalPrice } from '@/features/payments/policy';


const PAGE_SIZE = 12;
// No colon: `storage` is expo-secure-store on device, whose keys may only
// contain alphanumerics, '.', '-' and '_'. 'connekyt:savedEvents' made every
// read and write reject, and both call sites swallow the error — so saved
// events silently never persisted on iOS or Android. It worked on web
// (localStorage accepts anything), which is why it looked correct in dev.
const SAVED_KEY = 'connekyt_savedEvents';

type DateRange = 'all' | 'today' | 'tomorrow' | 'this-week' | 'this-month' | 'next-month';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'next-month', label: 'Next month' },
];

const TABS: { label: string; short: string; value: PublicEventsTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'All events', short: 'All', value: 'all', icon: 'grid' },
  { label: 'Live now', short: 'Live', value: 'live', icon: 'radio' },
  { label: 'Upcoming', short: 'Soon', value: 'upcoming', icon: 'calendar' },
  { label: 'Recently ended', short: 'Ended', value: 'completed', icon: 'checkmark-circle' },
];

/**
 * The chip under each event card. Paid events show no figure where digital
 * purchases are gated off (see features/payments/policy), because a price is
 * part of the purchase surface. "Ticketed" still tells the user what kind of
 * event it is, which is the useful half.
 */
function priceText(e: PublicEvent): { label: string; amount: string } {
  const code = e.streamFeeCurrencyAbbreviation || 'RWF';
  const paid = (e.streamFee || 0) > 0 || (e.price || 0) > 0;
  if (paid && !canShowDigitalPrice(false)) {
    return { label: '', amount: 'Ticketed' };
  }
  if (e.streamFee && e.streamFee > 0) {
    return { label: 'From', amount: `${code} ${e.streamFee.toLocaleString()}` };
  }
  if (e.price && e.price > 0) {
    return { label: 'From', amount: `${code} ${e.price.toLocaleString()}` };
  }
  return { label: '', amount: 'Free' };
}

function dateParts(eventDate?: string): { mo: string; day: string } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  return {
    mo: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()).padStart(2, '0'),
  };
}

function organizerInfo(e: PublicEvent): { label: string; image?: string; initial: string } {
  const creatorName = e.creator
    ? `${e.creator.firstName ?? ''} ${e.creator.lastName ?? ''}`.trim()
    : '';
  const label = creatorName || e.eventOrganizer || 'Connekyt';
  const rawImg = e.creator?.profilePicture;
  const image = rawImg && !rawImg.includes('/null') ? rawImg : undefined;
  return { label, image, initial: (label.charAt(0) || '?').toUpperCase() };
}

function tabFromStatusParam(s: string | undefined): PublicEventsTab {
  const v = (s ?? '').toUpperCase();
  if (v === 'ONGOING') return 'live';
  if (v === 'PUBLISHED') return 'upcoming';
  if (v === 'COMPLETED') return 'completed';
  return 'all';
}

export default function ExploreEventsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{
    status?: string;
    category?: string;
    location?: string;
    date?: string;
  }>();

  const [tab, setTab] = useState<PublicEventsTab>(() => tabFromStatusParam(params.status));
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); // debounced for the API
  const [category, setCategory] = useState<string>(params.category ?? 'all');
  const [location, setLocation] = useState<string>(params.location ?? 'all');
  const [dateRange, setDateRange] = useState<DateRange>(
    (DATE_RANGE_OPTIONS.find((o) => o.value === (params.date ?? 'all'))?.value ?? 'all') as DateRange,
  );
  const [bannerShown, setBannerShown] = useState(true);
  const [page, setPage] = useState(1);

  // Discovered categories (web seeds this from previously-seen events).
  const seenCats = useRef<Set<string>>(new Set());
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  // Bookmarks — persisted to SecureStore under the same key the web uses.
  const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => {
    storage
      .get(SAVED_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          setSaved(new Set(JSON.parse(raw) as string[]));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);
  const toggleSaved = useCallback((id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      storage.set(SAVED_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  // Debounce free-text search to mirror the web's form-submit cadence.
  useEffect(() => {
    const handle = setTimeout(() => setSearchTerm(search.trim()), 350);
    return () => clearTimeout(handle);
  }, [search]);

  // Fetch events whenever the resolved filter set changes.
  const [data, setData] = useState<PublicEvent[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may write results: switching tab or typing a
  // search used to let a slow earlier response land last and repaint the list
  // with the previous filter's events.
  const fetchGeneration = useRef(0);

  const fetchEvents = useCallback(async () => {
    const myGeneration = ++fetchGeneration.current;
    const isCurrent = () => myGeneration === fetchGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listPublicEventsDetailed({
        page: page - 1,
        size: PAGE_SIZE,
        sortColumn: 'eventDate',
        sortDirection: tab === 'completed' ? 'desc' : 'asc',
        category: category !== 'all' ? category : undefined,
        location: location !== 'all' ? location : undefined,
        status: TAB_TO_STATUS[tab],
        dateRange: dateRange !== 'all' ? dateRange : undefined,
        search: searchTerm || undefined,
      });
      if (!isCurrent()) return;
      setData(res.content);
      setTotalPages(res.totalPages);

      // Accumulate categories the way the web does.
      let changed = false;
      for (const e of res.content) {
        const c = e.eventCategory?.name?.trim();
        if (c && !seenCats.current.has(c)) {
          seenCats.current.add(c);
          changed = true;
        }
      }
      if (changed) setCategoryOptions(Array.from(seenCats.current).sort());
    } catch (e) {
      if (!isCurrent()) return;
      setError(isApiError(e) ? e.message : 'Could not load events. Pull to retry.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [page, tab, category, location, dateRange, searchTerm]);

  // Any change to the filters starts a new result set, so go back to its
  // first page. Searching from page 3 used to keep page 3 against a result
  // set that often had only one, leaving an empty list and — because the
  // pager hides itself when there is nothing to page through — no way back.
  useEffect(() => {
    setPage(1);
  }, [tab, category, location, dateRange, searchTerm]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Live verification (`liveStreamIds`) needs the auth-required Cloudflare
  // check, which guests can't make. Pass empty — the helpers fall back to
  // `hasLiveStream === true`, identical to the web when the check fails.
  const liveStreamIds = useMemo(() => new Set<string>(), []);

  const featuredLive = useMemo(
    () => data.filter((e) => isEventLive(e, liveStreamIds)),
    [data, liveStreamIds],
  );

  const liveCount = featuredLive.length;
  const activeFilterCount =
    (category !== 'all' ? 1 : 0) +
    (location !== 'all' ? 1 : 0) +
    (dateRange !== 'all' ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const switchTab = (next: PublicEventsTab) => {
    if (next === tab) return;
    setTab(next);
    setPage(1);
  };

  const resultLabel = (() => {
    if (loading) return 'Searching events…';
    const count = data.length;
    const noun = count === 1 ? 'event' : 'events';
    const suffix =
      tab === 'live'
        ? 'live now'
        : tab === 'upcoming'
        ? 'coming up'
        : tab === 'completed'
        ? 'recently ended'
        : 'available';
    return `${count} ${noun} ${suffix}`;
  })();

  const header = (
    <View>
      {bannerShown ? (
        <View style={styles.banner}>
          <Ionicons name="megaphone" size={14} color={colors.textOnPrimary} />
          <Text style={styles.bannerCta} numberOfLines={1}>
            Discover amazing events near you!
          </Text>
          <Pressable onPress={() => setBannerShown(false)} hitSlop={8}>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroEyebrow}>
          <Ionicons name="sparkles" size={12} color="#FFD28A" />
          <Text style={styles.heroEyebrowText}>CONNEKYT EVENTS</Text>
        </View>
        <Text style={styles.heroTitle}>Catch every moment, live.</Text>
        <Text style={styles.heroSub}>
          Discover events near you and join the live stream. No login needed.
        </Text>
      </View>

      {featuredLive.length > 0 ? (
        <View style={styles.trends}>
          <View style={styles.trendsHead}>
            <View style={styles.trendsPill}>
              <Text style={styles.trendsFlame}>🔥</Text>
              <Text style={styles.trendsPillText}>Hot Live Trends</Text>
              <View style={styles.trendsCount}>
                <Text style={styles.trendsCountText}>{featuredLive.length}</Text>
              </View>
            </View>
            {featuredLive.length > 4 ? (
              <Pressable onPress={() => switchTab('live')} hitSlop={8}>
                <Text style={styles.trendsAll}>View all →</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendsScroll}
          >
            {featuredLive.map((e) => (
              <Pressable
                key={e.id}
                style={styles.story}
                onPress={() => router.push(`/event/${e.id}` as never)}
              >
                <View style={styles.storyRing}>
                  <View style={styles.storyAvatar}>
                    <Image
                      source={e.eventPhoto ? { uri: e.eventPhoto } : EVENT_COVER_PLACEHOLDER}
                      style={styles.storyImg}
                      contentFit="cover"
                    />
                  </View>
                </View>
                <View style={styles.storyLive}>
                  <View style={styles.storyLiveDot} />
                  <Text style={styles.storyLiveText}>LIVE</Text>
                </View>
                <Text style={styles.storyTitle} numberOfLines={2}>
                  {e.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.tabsRow}>
        {TABS.map((tDef) => {
          const active = tab === tDef.value;
          return (
            <Pressable
              key={tDef.value}
              onPress={() => switchTab(tDef.value)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Ionicons
                name={tDef.icon}
                size={14}
                color={active ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tDef.short}</Text>
              {tDef.value === 'live' && liveCount > 0 ? (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{liveCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search events…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              onPress={() => {
                setSearch('');
                setPage(1);
              }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <FilterChip
            icon="pricetag"
            value={category}
            options={[{ value: 'all', label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          />
          <FilterChip
            icon="location"
            value={location}
            options={[{ value: 'all', label: 'All locations' }]}
            onChange={(v) => {
              setLocation(v);
              setPage(1);
            }}
          />
          <FilterChip
            icon="calendar"
            value={dateRange}
            options={DATE_RANGE_OPTIONS}
            onChange={(v) => {
              setDateRange(v as DateRange);
              setPage(1);
            }}
          />
        </ScrollView>
      </View>

      <View style={styles.resultStrip}>
        <Text style={styles.resultText}>{resultLabel}</Text>
        {activeFilterCount > 0 ? (
          <Text style={styles.resultFilters}>
            · {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
          </Text>
        ) : null}
      </View>
    </View>
  );

  const footer =
    totalPages > 1 ? (
      <View style={styles.pager}>
        <Pressable
          style={[styles.pagerBtn, page === 1 && styles.pagerBtnDisabled]}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <Ionicons name="chevron-back" size={16} color={page === 1 ? colors.textMuted : colors.primary} />
          <Text style={[styles.pagerBtnText, page === 1 && styles.pagerBtnTextDisabled]}>Prev</Text>
        </Pressable>
        <Text style={styles.pagerInfo}>
          Page {page} of {totalPages}
        </Text>
        <Pressable
          style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          <Text style={[styles.pagerBtnText, page >= totalPages && styles.pagerBtnTextDisabled]}>Next</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={page >= totalPages ? colors.textMuted : colors.primary}
          />
        </Pressable>
      </View>
    ) : null;

  if (loading && data.length === 0 && !error) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <FlatList
        data={data}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <PosterCard
              event={item}
              isLive={isEventLive(item, liveStreamIds)}
              isEnded={isEventEnded(item)}
              isSaved={saved.has(item.id)}
              onToggleSave={() => toggleSaved(item.id)}
              onPress={() => router.push(`/event/${item.id}` as never)}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchEvents} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon={
                  tab === 'live'
                    ? 'radio-outline'
                    : tab === 'completed'
                    ? 'checkmark-circle-outline'
                    : tab === 'upcoming'
                    ? 'calendar-outline'
                    : 'grid-outline'
                }
                title={
                  tab === 'live'
                    ? 'Nothing live right now'
                    : tab === 'completed'
                    ? 'No events ended recently'
                    : tab === 'upcoming'
                    ? 'No events coming up'
                    : 'No events match'
                }
                message={
                  tab === 'live'
                    ? 'Check back when an event goes live, or browse upcoming events.'
                    : 'Try a different filter or clear your search.'
                }
              />
            </View>
          )
        }
      />
    </Screen>
  );
}

// ────── Card (web `ev-card` 2386-2486) ─────────────────────────────────────

function PosterCard({
  event,
  isLive,
  isEnded,
  isSaved,
  onPress,
  onToggleSave,
}: {
  event: PublicEvent;
  isLive: boolean;
  isEnded: boolean;
  isSaved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const date = dateParts(event.eventDate);
  const price = priceText(event);
  const org = organizerInfo(event);

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.cardMedia}>
        <Image
          source={event.eventPhoto ? { uri: event.eventPhoto } : EVENT_COVER_PLACEHOLDER}
          style={styles.cardArt}
          contentFit="cover"
          transition={250}
        />
        <View style={styles.cardScrim} />

        {date ? (
          <View style={styles.cardTl}>
            <View style={styles.cardDate}>
              <Text style={styles.cardDateMo}>{date.mo}</Text>
              <Text style={styles.cardDateDay}>{date.day}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.cardTr}>
          {isLive ? (
            <View style={[styles.statusBadge, styles.statusLive]}>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>LIVE</Text>
            </View>
          ) : isEnded ? (
            <View style={[styles.statusBadge, styles.statusEnded]}>
              <Text style={styles.statusText}>ENDED</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusUpcoming]}>
              <Text style={styles.statusText}>UPCOMING</Text>
            </View>
          )}
          <Pressable
            style={[styles.bookmark, isSaved && styles.bookmarkSaved]}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSave();
            }}
            hitSlop={6}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? colors.accent : colors.text}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardMeta}>
        {event.location ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardVenue} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.orgChip}>
            <View style={styles.orgAvatar}>
              {org.image ? (
                <Image source={{ uri: org.image }} style={styles.orgAvatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.orgInitial}>{org.initial}</Text>
              )}
            </View>
            <Text style={styles.orgName} numberOfLines={1}>
              {org.label}
            </Text>
          </View>
          <View style={styles.priceChip}>
            <Ionicons name="pricetag" size={11} color={colors.primary} />
            <Text style={styles.priceText}>
              {price.label ? `${price.label} ` : ''}
              <Text style={styles.priceNum}>{price.amount}</Text>
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ────── Filter chip dropdown ───────────────────────────────────────────────

function FilterChip({
  icon,
  value,
  options,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const active = value !== 'all';
  return (
    <View style={styles.filterChipWrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={[styles.filterChip, active && styles.filterChipActive]}
      >
        <Ionicons name={icon} size={13} color={active ? colors.primary : colors.textMuted} />
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
          {current?.label ?? 'Any'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <View style={styles.filterMenu}>
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <Pressable
                key={o.value}
                style={[styles.filterMenuItem, sel && styles.filterMenuItemActive]}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.filterMenuText, sel && styles.filterMenuTextActive]}>{o.label}</Text>
                {sel ? <Ionicons name="checkmark" size={14} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  // Containers
  listContent: { paddingBottom: 120, gap: spacing.md, flexGrow: 1 },
  cardWrap: { paddingHorizontal: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyWrap: { paddingTop: spacing['2xl'], paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.md },
  errorText: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: c.primaryDark,
  },
  bannerCta: { flex: 1, color: c.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  // Hero
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: c.primary,
    gap: spacing.xs,
  },
  heroEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: 6,
  },
  heroEyebrowText: { color: '#FFD28A', fontSize: 10, letterSpacing: 1.4, fontWeight: fontWeight.bold },
  heroTitle: {
    color: c.textOnPrimary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: 32,
  },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.sm, maxWidth: 320 },

  // Trends row
  trends: { paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  trendsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  trendsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.infoBg,
  },
  trendsFlame: { fontSize: 14 },
  trendsPillText: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  trendsCount: {
    backgroundColor: c.accent,
    minWidth: 18,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendsCountText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },
  trendsAll: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  trendsScroll: { paddingHorizontal: spacing.xl, gap: spacing.md },
  story: { width: 84, alignItems: 'center', gap: 6 },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: c.surface,
    padding: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImg: { width: '100%', height: '100%', borderRadius: 33 },
  storyLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    marginTop: -10,
  },
  storyLiveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  storyLiveText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  storyTitle: { fontSize: 11, color: c.textSoft, fontWeight: fontWeight.semibold, textAlign: 'center' },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  tabActive: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.primary },
  tabLabel: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  tabLabelActive: { color: c.primary, fontWeight: fontWeight.bold },
  tabCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold },

  // Controls (search + filters)
  controls: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchInput: { flex: 1, color: c.text, fontSize: fontSize.sm, padding: 0 },
  filtersRow: { gap: spacing.sm, paddingVertical: spacing.xs },

  filterChipWrap: { position: 'relative' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  filterChipActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  filterChipText: { color: c.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  filterChipTextActive: { color: c.primary, fontWeight: fontWeight.bold },
  filterMenu: {
    position: 'absolute',
    top: 38,
    left: 0,
    minWidth: 180,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingVertical: 4,
    zIndex: 10,
    elevation: 6,
    ...e(2),
  },
  filterMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  filterMenuItemActive: { backgroundColor: c.infoBg },
  filterMenuText: { color: c.text, fontSize: fontSize.sm },
  filterMenuTextActive: { color: c.primary, fontWeight: fontWeight.bold },

  // Result strip
  resultStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  resultText: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resultFilters: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Card
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardPressed: { opacity: 0.92 },
  cardMedia: { width: '100%', height: 180, position: 'relative', backgroundColor: c.surfaceMuted },
  cardArt: { width: '100%', height: '100%' },
  cardScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  cardTl: { position: 'absolute', top: spacing.md, left: spacing.md },
  cardDate: {
    width: 46,
    backgroundColor: '#fff',
    borderRadius: radii.sm,
    overflow: 'hidden',
    alignItems: 'center',
  },
  cardDateMo: {
    width: '100%',
    paddingVertical: 3,
    backgroundColor: c.primary,
    color: '#fff',
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  cardDateDay: {
    color: c.text,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    paddingVertical: 2,
  },

  cardTr: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  statusText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  statusUpcoming: { backgroundColor: c.primary },
  statusLive: { backgroundColor: c.accent },
  statusEnded: { backgroundColor: '#6A6D76' },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  bookmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkSaved: { backgroundColor: c.surface },

  cardMeta: { padding: spacing.md, gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardVenue: { flex: 1, color: c.textMuted, fontSize: fontSize.xs },
  cardTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 22 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  orgChip: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  orgAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgAvatarImg: { width: '100%', height: '100%' },
  orgInitial: { color: c.textSoft, fontSize: 11, fontWeight: fontWeight.bold },
  orgName: { flex: 1, color: c.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  priceText: { color: c.primary, fontSize: fontSize.xs },
  priceNum: { fontWeight: fontWeight.bold },

  // Pagination
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.primary,
    backgroundColor: c.surface,
  },
  pagerBtnDisabled: { borderColor: c.borderSoft, backgroundColor: c.surfaceMuted },
  pagerBtnText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  pagerBtnTextDisabled: { color: c.textMuted },
  pagerInfo: { color: c.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
}));
