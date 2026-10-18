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
 * Status taxonomy:
 *   isLive   = an active stream lifecycle status, or (for legacy rows)
 *              an ONGOING event with live-stream metadata.
 *   isEnded  = eventStatus === 'COMPLETED' || streamStatus === 'ended'
 *   tab → backend status: all → undefined, live → ONGOING,
 *                          upcoming → PUBLISHED, completed → COMPLETED
 *
 * The public list includes enough stream metadata to render the same feed
 * for signed-in clients and guests without an additional Cloudflare request.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { isApiError, useAuth } from '@/store/auth';
import { colors, darkPalette, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { canShowDigitalPrice } from '@/features/payments/policy';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { GlassLayer, GlassOnMedia, glassClear, glassTile } from '@/components/ui/GlassCard';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

/** Brand navy, for type on a white pill over a photo. */
const ON_MEDIA_INK = '#083A85';


const PAGE_SIZE = 8;

export type EventSortOption = 'newest' | 'oldest' | 'date_asc' | 'title_asc';

export const SORT_OPTIONS: {
  key: EventSortOption;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'newest',
    label: 'Newest created first',
    description: 'Recently booked or created events appear first',
    icon: 'sparkles-outline',
  },
  {
    key: 'oldest',
    label: 'Oldest created first',
    description: 'Earliest booked or created events first',
    icon: 'time-outline',
  },
  {
    key: 'date_asc',
    label: 'Event date (Upcoming first)',
    description: 'Scheduled event date & time in chronological order',
    icon: 'calendar-outline',
  },
  {
    key: 'title_asc',
    label: 'Title (A–Z)',
    description: 'Alphabetical order by event name',
    icon: 'text-outline',
  },
];
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

function filterByDateRange(events: PublicEvent[], range: DateRange): PublicEvent[] {
  if (range === 'all') return events;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return events.filter((e) => {
    if (!e.eventDate) return false;
    const d = new Date(e.eventDate);
    if (Number.isNaN(d.getTime())) return false;

    if (range === 'today') {
      return d >= startOfDay && d <= endOfDay;
    }
    if (range === 'tomorrow') {
      const startOfTom = new Date(startOfDay);
      startOfTom.setDate(startOfTom.getDate() + 1);
      const endOfTom = new Date(endOfDay);
      endOfTom.setDate(endOfTom.getDate() + 1);
      return d >= startOfTom && d <= endOfTom;
    }
    if (range === 'this-week') {
      const dayOfWeek = startOfDay.getDay();
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return d >= startOfWeek && d <= endOfWeek;
    }
    if (range === 'this-month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return d >= startOfMonth && d <= endOfMonth;
    }
    if (range === 'next-month') {
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
      return d >= startOfNextMonth && d <= endOfNextMonth;
    }
    return true;
  });
}

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
    return { label: 'From', amount: formatPrice(e.streamFee, code) };
  }
  if (e.price && e.price > 0) {
    return { label: 'From', amount: formatPrice(e.price, code) };
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

type SuggestionItem = {
  id: string;
  type: 'event' | 'category' | 'location' | 'organizer';
  title: string;
  subtitle?: string;
  badge?: string;
  eventId?: string;
  filterValue?: string;
};

export default function ExploreEventsScreen() {
  useLanguage();
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const authStatus = useAuth((s) => s.status);
  const isAuthenticated = authStatus === 'authenticated';
  const params = useLocalSearchParams<{
    status?: string;
    category?: string;
    location?: string;
    date?: string;
  }>();

  const listRef = useRef<FlatList<PublicEvent>>(null);
  const [tab, setTab] = useState<PublicEventsTab>(() => tabFromStatusParam(params.status));
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // debounced for the API
  const [sortBy, setSortBy] = useState<EventSortOption>('newest');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [category, setCategory] = useState<string>(params.category ?? 'all');
  const [location, setLocation] = useState<string>(params.location ?? 'all');
  const [dateRange, setDateRange] = useState<DateRange>(
    (DATE_RANGE_OPTIONS.find((o) => o.value === (params.date ?? 'all'))?.value ?? 'all') as DateRange,
  );
  const [page, setPage] = useState(1);

  // Kept as an extension point for any server-verified live IDs. The public
  // list's normalized stream status is the primary source of truth.
  const liveStreamIds = useMemo(() => new Set<string>(), []);

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
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortConfig = useMemo(() => {
    switch (sortBy) {
      case 'newest':
        return { column: 'createdAt', direction: 'desc' as const };
      case 'oldest':
        return { column: 'createdAt', direction: 'asc' as const };
      case 'date_asc':
        return { column: 'eventDate', direction: 'asc' as const };
      case 'title_asc':
        return { column: 'title', direction: 'asc' as const };
    }
  }, [sortBy]);

  const goToPage = (nextPage: number) => {
    const valid = Math.max(1, Math.min(totalPages, nextPage));
    setPage(valid);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

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
      let res = await listPublicEventsDetailed({
        page: page - 1,
        // Live state is not always reflected in the event's publication
        // status. Load the live pool broadly, then use streamStatus and the
        // stream URLs to decide which cards are actually live.
        size: tab === 'live' ? 50 : PAGE_SIZE,
        sortColumn: sortConfig.column,
        sortDirection: tab === 'completed' ? 'desc' : sortConfig.direction,
        category: category !== 'all' ? category : undefined,
        location: location !== 'all' ? location : undefined,
        status: tab === 'live' ? undefined : TAB_TO_STATUS[tab],
        dateRange: dateRange !== 'all' ? dateRange : undefined,
        search: searchTerm || undefined,
      });

      // Resilient fallback:
      // In live database, events often have `eventStatus: "AWAITING_REVIEW"` with `isPublished: true`.
      // Calling backend with strict status (e.g. status=PUBLISHED or status=ONGOING) returns 0 results.
      // If 0 items are returned for a specific tab or dateRange, fallback to querying
      // without strict status and filter client-side so user sees matching events.
      if (res.content.length === 0 && (tab !== 'all' || (dateRange !== 'all' && res.totalElements === 0))) {
        const fallbackRes = await listPublicEventsDetailed({
          page: 0,
          size: 50,
          sortColumn: sortConfig.column,
          sortDirection: tab === 'completed' ? 'desc' : sortConfig.direction,
          category: category !== 'all' ? category : undefined,
          location: location !== 'all' ? location : undefined,
          search: searchTerm || undefined,
        });

        if (fallbackRes.content.length > 0) {
          let filtered = fallbackRes.content;
          if (tab === 'live') {
            filtered = filtered.filter((e) => isEventLive(e, liveStreamIds));
          } else if (tab === 'upcoming') {
            filtered = filtered.filter((e) => !isEventLive(e, liveStreamIds) && !isEventEnded(e));
          } else if (tab === 'completed') {
            filtered = filtered.filter((e) => isEventEnded(e));
          }

          if (dateRange !== 'all') {
            filtered = filterByDateRange(filtered, dateRange);
          }

          switch (sortBy) {
            case 'newest':
              filtered.sort((a, b) => {
                const ta = a.eventDate ? Date.parse(a.eventDate) : 0;
                const tb = b.eventDate ? Date.parse(b.eventDate) : 0;
                return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
              });
              break;
            case 'oldest':
              filtered.sort((a, b) => {
                const ta = a.eventDate ? Date.parse(a.eventDate) : 0;
                const tb = b.eventDate ? Date.parse(b.eventDate) : 0;
                return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
              });
              break;
            case 'date_asc':
              filtered.sort((a, b) => {
                const ta = a.eventDate ? Date.parse(a.eventDate) : 0;
                const tb = b.eventDate ? Date.parse(b.eventDate) : 0;
                return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
              });
              break;
            case 'title_asc':
              filtered.sort((a, b) => a.title.localeCompare(b.title));
              break;
          }

          const start = (page - 1) * PAGE_SIZE;
          const paged = filtered.slice(start, start + PAGE_SIZE);

          res = {
            ...fallbackRes,
            content: paged,
            totalElements: filtered.length,
            totalPages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
          };
        }
      }

      if (tab === 'live') {
        const liveContent = res.content.filter((event) => isEventLive(event, liveStreamIds));
        const start = (page - 1) * PAGE_SIZE;
        const pagedLive = liveContent.slice(start, start + PAGE_SIZE);
        res = {
          ...res,
          content: pagedLive,
          totalElements: liveContent.length,
          totalPages: Math.max(1, Math.ceil(liveContent.length / PAGE_SIZE)),
        };
      }

      if (!isCurrent()) return;
      setData(res.content);
      setTotalPages(Math.max(1, res.totalPages));
      setTotalElements(res.totalElements ?? res.content.length);
    } catch (e) {
      if (!isCurrent()) return;
      setError(isApiError(e) ? e.message : 'Could not load events. Pull to retry.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [page, tab, category, location, dateRange, searchTerm, liveStreamIds, sortConfig, sortBy]);

  // Any change to the filters starts a new result set, so go back to its
  // first page. Searching from page 3 used to keep page 3 against a result
  // set that often had only one, leaving an empty list and — because the
  // pager hides itself when there is nothing to page through — no way back.
  useEffect(() => {
    setPage(1);
  }, [tab, category, location, dateRange, searchTerm, sortBy]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Dedicated pool for story circles so live & upcoming events remain visible
  // even if the user applies specific filters/searches in the feed below.
  // Supports smooth horizontal virtualization and pagination for 100+ events.
  const [storiesList, setStoriesList] = useState<PublicEvent[]>([]);
  const [storiesPage, setStoriesPage] = useState(0);
  const [storiesTotalPages, setStoriesTotalPages] = useState(1);
  const [loadingMoreStories, setLoadingMoreStories] = useState(false);

  const fetchStoriesPage = useCallback(async (pageNum: number, isInitial = false) => {
    try {
      if (!isInitial) setLoadingMoreStories(true);
      const res = await listPublicEventsDetailed({
        page: pageNum,
        size: 25,
        sortColumn: 'eventDate',
        sortDirection: 'asc',
      });
      if (res.content.length > 0) {
        setStoriesList((prev) => {
          if (isInitial) return res.content;
          const map = new Map<string, PublicEvent>();
          for (const ev of prev) map.set(ev.id, ev);
          for (const ev of res.content) map.set(ev.id, ev);
          return Array.from(map.values());
        });
      }
      setStoriesPage(pageNum);
      setStoriesTotalPages(res.totalPages || 1);
    } catch {
      // Fallback gracefully
    } finally {
      if (!isInitial) setLoadingMoreStories(false);
    }
  }, []);

  useEffect(() => {
    fetchStoriesPage(0, true);
  }, [fetchStoriesPage]);

  const loadMoreStories = useCallback(() => {
    if (loadingMoreStories) return;
    if (storiesPage + 1 < storiesTotalPages) {
      fetchStoriesPage(storiesPage + 1);
    }
  }, [loadingMoreStories, storiesPage, storiesTotalPages, fetchStoriesPage]);

  const handleRefresh = useCallback(async () => {
    fetchStoriesPage(0, true);
    await fetchEvents();
  }, [fetchStoriesPage, fetchEvents]);

  const activeStories = useMemo(() => {
    const pool = storiesList.length > 0 ? storiesList : data;
    // Deduplicate by event ID
    const map = new Map<string, PublicEvent>();
    for (const e of pool) {
      if (e.id && !map.has(e.id)) map.set(e.id, e);
    }
    const allUnique = Array.from(map.values());
    const live = allUnique.filter((e) => isEventLive(e, liveStreamIds));
    const upcoming = allUnique.filter((e) => !isEventLive(e, liveStreamIds) && !isEventEnded(e));
    const rest = allUnique.filter(
      (e) => !live.some((l) => l.id === e.id) && !upcoming.some((u) => u.id === e.id),
    );
    // Uncapped — users can scroll smoothly through all events (even 100+)
    return [...live, ...upcoming, ...rest];
  }, [storiesList, data, liveStreamIds]);

  // Discovered categories (from storiesList + data pool)
  const categoryOptions = useMemo(() => {
    const allEventsPool = new Map<string, PublicEvent>();
    for (const e of storiesList) if (e.id) allEventsPool.set(e.id, e);
    for (const e of data) if (e.id) allEventsPool.set(e.id, e);
    const cats = new Set<string>();
    for (const e of allEventsPool.values()) {
      const c = e.eventCategory?.name?.trim();
      if (c) cats.add(c);
    }
    return Array.from(cats).sort();
  }, [storiesList, data]);

  // Discovered locations (from storiesList + data pool)
  const locationOptions = useMemo(() => {
    const allEventsPool = new Map<string, PublicEvent>();
    for (const e of storiesList) if (e.id) allEventsPool.set(e.id, e);
    for (const e of data) if (e.id) allEventsPool.set(e.id, e);
    const locs = new Set<string>();
    for (const e of allEventsPool.values()) {
      if (e.location?.trim()) locs.add(e.location.trim());
    }
    return Array.from(locs).sort();
  }, [storiesList, data]);

  // Global live count across the entire event pool (stories + feed)
  const liveCount = useMemo(() => {
    const pool = storiesList.length > 0 ? storiesList : data;
    return pool.filter((e) => isEventLive(e, liveStreamIds)).length;
  }, [storiesList, data, liveStreamIds]);

  // Global search autocomplete suggestions across events, categories, locations, and organizers
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const allEventsPool = new Map<string, PublicEvent>();
    for (const e of storiesList) if (e.id) allEventsPool.set(e.id, e);
    for (const e of data) if (e.id) allEventsPool.set(e.id, e);
    const pool = Array.from(allEventsPool.values());

    const results: SuggestionItem[] = [];
    const seenTitles = new Set<string>();

    // 1. Matching Events (by title)
    for (const e of pool) {
      if (e.title && e.title.toLowerCase().includes(q)) {
        if (!seenTitles.has(`event-${e.id}`)) {
          seenTitles.add(`event-${e.id}`);
          const isLive = isEventLive(e, liveStreamIds);
          results.push({
            id: `event-${e.id}`,
            type: 'event',
            title: e.title,
            subtitle: [e.location, e.eventCategory?.name].filter(Boolean).join(' · '),
            badge: isLive ? 'LIVE' : undefined,
            eventId: e.id,
          });
        }
      }
      if (results.length >= 3) break;
    }

    // 2. Matching Categories
    for (const cat of categoryOptions) {
      if (cat.toLowerCase().includes(q)) {
        if (!seenTitles.has(`cat-${cat}`)) {
          seenTitles.add(`cat-${cat}`);
          results.push({
            id: `cat-${cat}`,
            type: 'category',
            title: cat,
            subtitle: 'Category',
            filterValue: cat,
          });
        }
      }
      if (results.length >= 5) break;
    }

    // 3. Matching Locations
    for (const loc of locationOptions) {
      if (loc.toLowerCase().includes(q)) {
        if (!seenTitles.has(`loc-${loc}`)) {
          seenTitles.add(`loc-${loc}`);
          results.push({
            id: `loc-${loc}`,
            type: 'location',
            title: loc,
            subtitle: 'Location / Venue',
            filterValue: loc,
          });
        }
      }
      if (results.length >= 7) break;
    }

    // 4. Matching Organizers
    const organizers = Array.from(
      new Set(
        pool
          .map((e) =>
            (e.creator
              ? `${e.creator.firstName ?? ''} ${e.creator.lastName ?? ''}`.trim()
              : e.eventOrganizer
            )?.trim(),
          )
          .filter((o): o is string => Boolean(o)),
      ),
    );
    for (const org of organizers) {
      if (org.toLowerCase().includes(q)) {
        if (!seenTitles.has(`org-${org}`)) {
          seenTitles.add(`org-${org}`);
          results.push({
            id: `org-${org}`,
            type: 'organizer',
            title: org,
            subtitle: 'Organizer / Host',
            filterValue: org,
          });
        }
      }
      if (results.length >= 8) break;
    }

    return results.slice(0, 6);
  }, [search, storiesList, data, categoryOptions, locationOptions, liveStreamIds]);

  const handleSelectSuggestion = useCallback(
    (item: SuggestionItem) => {
      setSearchFocused(false);
      Keyboard.dismiss();
      if (item.type === 'event' && item.eventId) {
        router.push(`/(public)/event/${item.eventId}` as never);
      } else if (item.type === 'category' && item.filterValue) {
        setCategory(item.filterValue);
        setSearch('');
        setTab('all');
        setPage(1);
      } else if (item.type === 'location' && item.filterValue) {
        setLocation(item.filterValue);
        setSearch('');
        setTab('all');
        setPage(1);
      } else if (item.filterValue) {
        setSearch(item.filterValue);
        setTab('all');
        setPage(1);
      }
    },
    [router],
  );
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

  const renderTopBar = () => (
    <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.topBarPill}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          hitSlop={12}
          style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={tr('b4_backToSignIn')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <View style={styles.topBarPillCenter}>
          <Text style={styles.topBarPillText}>{tr('b4_exploreEventsTitle')}</Text>
        </View>

        <Pressable
          onPress={() => (isAuthenticated ? router.replace('/(app)/(tabs)') : router.push('/login'))}
          hitSlop={8}
          style={({ pressed }) => [styles.topBarSignInBtn, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? 'Dashboard' : 'Sign in'}
        >
          <Text style={styles.topBarSignInText}>{isAuthenticated ? 'Dashboard' : 'Sign In'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const header = (
    <View>
      {/* Instagram-Style Story Circles Tray (Virtualized & Paginated for 100+ events) */}
      {activeStories.length > 0 ? (
        <View style={styles.storiesContainer}>
          <FlatList
            data={activeStories}
            keyExtractor={(e) => `story-${e.id}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.storiesScroll}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReached={loadMoreStories}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMoreStories ? (
                <View style={styles.storyFooterLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            renderItem={({ item: e }) => {
              const isLive = isEventLive(e, liveStreamIds);
              const isEnded = isEventEnded(e);
              return (
                <Pressable
                  key={e.id}
                  style={({ pressed }) => [styles.storyItem, pressed && { opacity: 0.8 }]}
                  onPress={() => router.push(`/(public)/event/${e.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.title}, ${isLive ? 'Live now' : 'Event'}`}
                >
                  <View style={styles.storyCircleWrapper}>
                    <LinearGradient
                      colors={
                        isLive
                          ? ['#F58529', '#DD2A7B', '#8134AF']
                          : isEnded
                          ? ['#64748B', '#94A3B8']
                          : ['#4F46E5', '#7C3AED', '#EC4899']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.storyGradientRing}
                    >
                      <View style={styles.storyInnerGap}>
                        <Image
                          source={e.eventPhoto ? { uri: e.eventPhoto } : EVENT_COVER_PLACEHOLDER}
                          style={styles.storyImage}
                          contentFit="cover"
                          transition={200}
                        />
                      </View>
                    </LinearGradient>

                    {isLive ? (
                      <View style={styles.storyLivePill}>
                        <View style={styles.storyLivePillDot} />
                        <Text style={styles.storyLivePillText}>{tr('b4_badgeLive')}</Text>
                      </View>
                    ) : !isEnded ? (
                      <View style={styles.storySoonPill}>
                        <Text style={styles.storySoonPillText}>{tr('b4_badgeSoon')}</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.storyNameText} numberOfLines={1} ellipsizeMode="tail">
                    {e.title}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
            <Ionicons name="search" size={17} color={searchFocused ? colors.primary : colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                if (!searchFocused) setSearchFocused(true);
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
              placeholder={tr('b4_searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => {
                setSearchFocused(false);
                Keyboard.dismiss();
              }}
            />
            {search ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setPage(1);
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={tr('b4_clearSearch')}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={[styles.sortBtn, sortBy !== 'newest' && styles.sortBtnActive]}
            onPress={() => setSortSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('b4_sortEvents')}
          >
            <Ionicons
              name="funnel-outline"
              size={17}
              color={sortBy !== 'newest' ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Global Search Autocomplete Suggestions */}
        {searchFocused && suggestions.length > 0 ? (
          <View style={styles.suggestionsCard}>
            <View style={styles.suggestionsHeader}>
              <Text style={styles.suggestionsHeaderTitle}>{tr('b4_suggestionsHeader')}</Text>
              <Text style={styles.suggestionsHeaderCount}>{suggestions.length}</Text>
            </View>
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionRowPressed]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <View
                  style={[
                    styles.suggestionIconWrap,
                    item.type === 'event' && item.badge ? styles.suggestionIconWrapLive : null,
                  ]}
                >
                  <Ionicons
                    name={
                      item.type === 'event'
                        ? 'calendar'
                        : item.type === 'category'
                        ? 'pricetag'
                        : item.type === 'location'
                        ? 'location'
                        : 'person'
                    }
                    size={14}
                    color={item.type === 'event' && item.badge ? '#E11D48' : colors.primary}
                  />
                </View>
                <View style={styles.suggestionTextCol}>
                  <View style={styles.suggestionTitleRow}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View style={styles.suggestionBadge}>
                        <Text style={styles.suggestionBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.subtitle ? (
                    <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.suggestionTypeTag}>
                  <Text style={styles.suggestionTypeTagText}>{item.type}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Status and filters share one row: one control strip, not three. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.filtersRow}
        >
          {TABS.map((tDef) => {
            const active = tab === tDef.value;
            return (
              <Pressable
                key={tDef.value}
                onPress={() => switchTab(tDef.value)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                {tDef.value === 'live' ? <View style={styles.chipLiveDot} /> : null}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tDef.short}</Text>
                {tDef.value === 'live' && liveCount > 0 ? (
                  <View style={styles.tabCount}>
                    <Text style={styles.tabCountText}>{liveCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          <FilterChip
            icon="pricetag"
            title={tr('b4_filterCategories')}
            value={category}
            options={[{ value: 'all', label: 'All categories' }, ...categoryOptions.map((c) => ({ value: c, label: c }))]}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
          />
          <FilterChip
            icon="location"
            title={tr('b4_filterLocations')}
            value={location}
            options={[
              { value: 'all', label: 'All locations' },
              ...locationOptions.map((l) => ({ value: l, label: l })),
            ]}
            onChange={(v) => {
              setLocation(v);
              setPage(1);
            }}
          />
          <FilterChip
            icon="calendar"
            title={tr('b4_filterDateRange')}
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
    data.length > 0 || totalElements > 0 ? (
      <View style={styles.paginationFooter}>
        <View style={styles.pagerBar}>
          <Pressable
            style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
            onPress={() => goToPage(page - 1)}
            disabled={page <= 1}
            accessibilityRole="button"
            accessibilityLabel="Previous page"
          >
            <Ionicons
              name="chevron-back"
              size={16}
              color={page <= 1 ? colors.textMuted : colors.text}
            />
            <Text style={[styles.pagerBtnText, page <= 1 && styles.pagerBtnTextDisabled]}>
              {tr('b4_prevPage')}
            </Text>
          </Pressable>

          <View style={styles.pagerIndicator}>
            <Text style={styles.pagerIndicatorText}>
              {tr('b4_pageWord')} <Text style={styles.pagerIndicatorBold}>{page}</Text> of{' '}
              <Text style={styles.pagerIndicatorBold}>{Math.max(1, totalPages)}</Text>
            </Text>
            <Text style={styles.pagerTotalText}>
              ({totalElements || data.length} {(totalElements || data.length) === 1 ? 'event' : 'events'})
            </Text>
          </View>

          <Pressable
            style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
            onPress={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            accessibilityRole="button"
            accessibilityLabel="Next page"
          >
            <Text style={[styles.pagerBtnText, page >= totalPages && styles.pagerBtnTextDisabled]}>
              {tr('b4_nextPage')}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={page >= totalPages ? colors.textMuted : colors.text}
            />
          </Pressable>
        </View>
      </View>
    ) : null;

  if (loading && data.length === 0 && !error) {
    return (
      <Screen padded={false} edges={[]}>
        {renderTopBar()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      {/* Ambient backdrop: the first event's photo, blurred to colour and
          washed toward the theme, so the glass above it has something to frost. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image
          source={data[0]?.eventPhoto ? { uri: data[0].eventPhoto } : EVENT_COVER_PLACEHOLDER}
          style={styles.ambient}
          contentFit="cover"
          blurRadius={48}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(14,17,23,0.78)' : 'rgba(244,246,251,0.74)' }]} />
      </View>
      {renderTopBar()}
      <FlatList
        key="explore-events-list"
        ref={listRef}
        data={data}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <PosterCard
              event={item}
              isLive={isEventLive(item, liveStreamIds)}
              isEnded={isEventEnded(item)}
              isSaved={saved.has(item.id)}
              onToggleSave={() => toggleSaved(item.id)}
              onPress={() => router.push(`/(public)/event/${item.id}` as never)}
            />
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primary} />
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

      {/* Sort Options Bottom Sheet */}
      <Modal
        visible={sortSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSortSheetOpen(false)}>
          <Pressable
            style={[
              styles.sortSheet,
              { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sortSheetHeader}>
              <View>
                <Text style={styles.sortSheetTitle}>{tr('b4_sortSheetTitle')}</Text>
                <Text style={styles.sortSheetSubtitle}>{tr('b4_sortSheetSubtitle')}</Text>
              </View>
              <Pressable
                onPress={() => setSortSheetOpen(false)}
                hitSlop={8}
                style={styles.sortSheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.sortOptionsList}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.sortOptionItem, active && styles.sortOptionItemActive]}
                    onPress={() => {
                      setSortBy(opt.key);
                      setSortSheetOpen(false);
                    }}
                  >
                    <View
                      style={[
                        styles.sortOptionIconBox,
                        active && styles.sortOptionIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={active ? '#fff' : colors.primary}
                      />
                    </View>
                    <View style={styles.sortOptionTextCol}>
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          active && styles.sortOptionLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.sortOptionDesc}>{opt.description}</Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <View style={styles.sortOptionRadio} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  const router = useRouter();
  const date = dateParts(event.eventDate);
  const price = priceText(event);
  const org = organizerInfo(event);

  return (
    <View style={styles.pcCard}>
      {/* The card's own tap target sits underneath; the chips and buttons above
          are its siblings, never nested inside it (a button may not hold a button). */}
      <Pressable
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pcCardPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}${isLive ? ', live now' : isEnded ? ', ended' : ''}`}
      />
      <Image
        source={event.eventPhoto ? { uri: event.eventPhoto } : EVENT_COVER_PLACEHOLDER}
        style={styles.pcArt}
        contentFit="cover"
        transition={250}
        pointerEvents="none"
      />
      {/* Darkens the top for the chips and the bottom for the words. */}
      <LinearGradient
        colors={['rgba(4,10,26,0.4)', 'rgba(4,10,26,0)', 'rgba(4,10,26,0.55)', 'rgba(4,10,26,0.94)']}
        locations={[0, 0.3, 0.58, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.pcTop} pointerEvents="box-none">
        {date ? (
          <GlassOnMedia style={styles.pcDate} edge>
            <Text style={styles.pcDateMo}>{date.mo}</Text>
            <Text style={styles.pcDateDay}>{date.day}</Text>
          </GlassOnMedia>
        ) : (
          <View />
        )}
        <View style={styles.pcTopRight} pointerEvents="box-none">
          {isLive ? (
            <View style={[styles.pcStatus, styles.pcStatusLive]}>
              <View style={styles.pcLiveDot} />
              <Text style={styles.pcStatusText}>{tr('b4_badgeLive')}</Text>
            </View>
          ) : (
            <GlassOnMedia style={styles.pcStatus} edge>
              <Text style={styles.pcStatusText}>{isEnded ? 'ENDED' : 'UPCOMING'}</Text>
            </GlassOnMedia>
          )}
          {/* Dark glass with a white icon: readable on any photo, in both themes. */}
          <Pressable
            style={({ pressed }) => [styles.pcBookmark, glassClear, pressed && styles.pcPressed]}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSave();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save event'}
          >
            <GlassLayer />
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? colors.accent : '#FFFFFF'}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.pcBottom} pointerEvents="box-none">
        <Text style={styles.pcTitle} numberOfLines={2} pointerEvents="none">
          {event.title}
        </Text>
        <Text style={styles.pcMeta} numberOfLines={1} pointerEvents="none">
          {[event.location, org.label].filter(Boolean).join('  ·  ')}
        </Text>
        <View style={styles.pcActions} pointerEvents="box-none">
          <GlassOnMedia style={styles.pcPrice} edge>
            <Ionicons name="pricetag" size={11} color="#FFFFFF" />
            <Text style={styles.pcPriceText}>
              {price.label ? `${price.label} ` : ''}
              {price.amount}
            </Text>
          </GlassOnMedia>
          {/* The whole card opens the event; only distinct actions get a button. */}
          {isLive ? (
            <Pressable
              style={({ pressed }) => [styles.pcAction, styles.pcActionLive, pressed && styles.pcPressed]}
              onPress={(e) => {
                e.stopPropagation?.();
                onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Watch ${event.title} live`}
            >
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={styles.pcActionText}>Watch live</Text>
            </Pressable>
          ) : isEnded ? (
            <Pressable
              style={({ pressed }) => [styles.pcAction, styles.pcActionPhotos, pressed && styles.pcPressed]}
              onPress={(e) => {
                e.stopPropagation?.();
                router.push('/find-photos' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('b4_findMyPhotos')}
            >
              <Ionicons name="scan-outline" size={13} color={ON_MEDIA_INK} />
              <Text style={[styles.pcActionText, { color: ON_MEDIA_INK }]}>Find my photos</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// ────── Filter chip dropdown (Bottom Sheet Modal) ──────────────────────────

function FilterChip({
  icon,
  title,
  value,
  options,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const active = value !== 'all';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.filterChip, active && styles.filterChipActive]}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${current?.label ?? 'Any'}`}
      >
        <Ionicons name={icon} size={14} color={active ? colors.primary : colors.textMuted} />
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
          {current?.label ?? 'Any'}
        </Text>
        <Ionicons name="chevron-down" size={12} color={active ? colors.primary : colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name={icon} size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>{title}</Text>
              </View>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
                accessibilityLabel={tr('b4_close')}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.modalOptionsList}
              renderItem={({ item }) => {
                const selected = item.value === value;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.modalOptionRow,
                      selected && styles.modalOptionRowSelected,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        selected && styles.modalOptionLabelSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={18} color={colors.borderSoft} />
                    )}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  // Containers
  listContent: { paddingBottom: 120, flexGrow: 1 },
  cardWrap: { paddingHorizontal: spacing.xl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyWrap: { paddingTop: spacing['2xl'], paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.md },
  errorText: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  // Top bar in head — full-width rounded floating bar matching FindMyPhotos
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  topBarPill: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  topBarBackBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarBackBtnPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  topBarPillCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  topBarPillText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  topBarSignInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  topBarSignInText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },

  // Instagram Story Circles Tray
  storiesContainer: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  storiesScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  storyItem: {
    width: 74,
    alignItems: 'center',
    gap: 5,
  },
  storyCircleWrapper: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  storyGradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyInnerGap: {
    width: '100%',
    height: '100%',
    borderRadius: 31.5,
    backgroundColor: c.background,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 29.5,
  },
  storyLivePill: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E11D48',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.background,
  },
  storyLivePillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  storyLivePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.5,
  },
  storySoonPill: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.background,
  },
  storySoonPillText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  storyNameText: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: c.text,
    textAlign: 'center',
    width: 70,
  },
  storyFooterLoader: {
    width: 44,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.xs,
  },

  // Tabs
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    ...glassTile(c),
  },
  searchWrapFocused: { borderColor: c.primary },
  sortBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnActive: { borderColor: c.primary, backgroundColor: c.tint },
  searchInput: { flex: 1, color: c.text, fontSize: fontSize.sm, padding: 0 },

  // Suggestions Card (Global Autocomplete)
  suggestionsCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    marginTop: 2,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(3),
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: c.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  suggestionsHeaderTitle: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  suggestionsHeaderCount: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    gap: spacing.sm,
  },
  suggestionRowPressed: {
    backgroundColor: c.tint,
  },
  suggestionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconWrapLive: {
    backgroundColor: '#FFE4E6',
  },
  suggestionTextCol: {
    flex: 1,
    gap: 1,
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionTitle: {
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.semibold,
    color: c.text,
    flexShrink: 1,
  },
  suggestionSubtitle: {
    fontSize: 11,
    color: c.textMuted,
  },
  suggestionBadge: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  suggestionBadgeText: {
    color: '#fff',
    fontSize: 8.5,
    fontWeight: fontWeight.bold,
  },
  suggestionTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: c.background,
  },
  suggestionTypeTagText: {
    fontSize: 10,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
  },
  // Bleeds to the screen edges so chips scroll under the gutter, not into it.
  chipScroll: { marginHorizontal: -spacing.xl },
  filtersRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xs, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontSize: 13, fontWeight: fontWeight.semibold },
  chipTextActive: { color: c.textOnPrimary },
  chipLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' },
  chipDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: c.border, marginHorizontal: 2 },
  ambient: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
  },
  filterChipActive: { borderColor: c.primary, backgroundColor: c.tint },
  filterChipText: { color: c.text, fontSize: 13, fontWeight: fontWeight.semibold },
  filterChipTextActive: { color: c.primary, fontWeight: fontWeight.bold },

  // Filter Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: spacing.xl,
    maxHeight: '75%',
    ...e(4),
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionsList: {
    marginVertical: spacing.xs,
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    marginVertical: 2,
  },
  modalOptionRowSelected: {
    backgroundColor: c.infoBg,
  },
  modalOptionLabel: {
    fontSize: fontSize.sm,
    color: c.text,
    fontWeight: fontWeight.medium,
    flex: 1,
    paddingRight: spacing.md,
  },
  modalOptionLabelSelected: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },

  // Ended & Live Event Card Section

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

  // A paper calendar tile over the event photo: white in both themes, so its
  // ink is fixed too. Theme text (c.text) turns near-white in dark mode and
  // made the day vanish on the white tile.



  // Pagination
  paginationFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: 4,
  },
  pagerBtnDisabled: {
    opacity: 0.35,
  },
  pagerBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  pagerBtnTextDisabled: {
    color: c.textMuted,
  },
  pagerIndicator: {
    alignItems: 'center',
  },
  pagerIndicatorText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  pagerIndicatorBold: {
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  pagerTotalText: {
    fontSize: 10,
    color: c.textMuted,
    marginTop: 1,
  },

  // Sort sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sortSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sortSheetTitle: {
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  sortSheetSubtitle: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },
  sortSheetCloseBtn: {
    padding: spacing.xs,
  },
  sortOptionsList: {
    gap: spacing.xs,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  sortOptionItemActive: {
    backgroundColor: c.infoBg,
  },
  sortOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionIconBoxActive: {
    backgroundColor: c.primary,
  },
  sortOptionTextCol: {
    flex: 1,
  },
  sortOptionLabel: {
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  sortOptionLabelActive: {
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  sortOptionDesc: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 1,
  },
  sortOptionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },

  // ── Event card: one photo, words on a fade, glass chips ──────────────
  pcCard: {
    height: 228,
    borderRadius: radii.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c === darkPalette ? 'rgba(255,255,255,0.14)' : 'rgba(15,18,23,0.08)',
  },
  pcPressed: { opacity: 0.75 },
  // A press darkens the whole photo slightly; scaling a full-width card would jitter.
  pcCardPressed: { backgroundColor: 'rgba(0,0,0,0.12)' },
  // Navy while a cover loads: a deliberate dark card, not a grey gap.
  pcArt: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', backgroundColor: '#0B1B3A' },
  pcTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md },
  pcTopRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pcDate: {
    width: 48,
    paddingVertical: 5,
    borderRadius: radii.md,
    alignItems: 'center',
    // Solid enough to hold its own over busy poster artwork.
    backgroundColor: 'rgba(6,10,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pcDateMo: { color: '#FFFFFF', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  pcDateDay: { color: '#FFFFFF', fontSize: 20, lineHeight: 22, fontWeight: fontWeight.extrabold },
  pcStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    // Solid enough to hold its own over busy poster artwork.
    backgroundColor: 'rgba(6,10,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pcStatusLive: { backgroundColor: '#E11D48' },
  pcLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  pcStatusText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  pcBookmark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    // Solid enough to hold its own over busy poster artwork.
    backgroundColor: 'rgba(6,10,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pcBottom: { padding: spacing.md, gap: 4 },
  pcTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: fontWeight.extrabold, letterSpacing: -0.3 },
  pcMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  pcActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  pcPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radii.full,
    // Solid enough to hold its own over busy poster artwork.
    backgroundColor: 'rgba(6,10,20,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  pcPriceText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: fontWeight.bold },
  pcAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radii.full,
  },
  pcActionLive: { backgroundColor: '#F20C8F' },
  pcActionPhotos: { backgroundColor: '#FFFFFF' },
  pcActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: fontWeight.bold },
}));
