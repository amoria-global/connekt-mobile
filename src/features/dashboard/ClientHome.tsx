/**
 * ClientHome — Staff-grade, luxury client home tab for the `Client` role.
 *
 * Engineered with premier mobile design craft:
 *   1. Frosted TopBar integration with safe area metrics
 *   2. KYC Banner & Pending Payments alert handling
 *   3. Editorial Date & Warm Personalized Greeting Header
 *   4. Cinematic Next-Shoot Spotlight (or Curated Talent Discovery Hero)
 *   5. Tactile Floating Search Pill & Category Rail
 *   6. 2x2 Bento Action Hub (Book, Find Photos, Live Events, Vault)
 *   7. Minimalist Trio Stats Snapshot (Bookings, Photos Ready, Saved Pros)
 *   8. "Smart Face Match" AI Photo Retrieval Card
 *   9. Editorial Featured Photographers Rail (with verified tags & ratings)
 *  10. My Bookings / Upcoming Sessions with calendar date blocks
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '@/services/storage';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { KycBanner } from '@/features/kyc/KycBanner';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCustomerAnalytics,
  getCustomerPendingPayments,
  getCustomerRecentActivities,
  type PendingPayment,
  type RecentActivity,
} from '@/features/analytics/api';
import { listEvents, listPublicEventsDetailed } from '@/features/events/api';
import { isEventLive, type PublicEvent } from '@/features/events/types';
import {
  listPhotographers,
  listBookmarkedPhotographers,
  bookmarkPhotographer,
  unbookmarkPhotographer,
  type Photographer,
} from '@/features/photographers/api';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import { getWallet } from '@/features/wallet/api';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { EVENT_COVER_PLACEHOLDER, PHOTOGRAPHER_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

const RECENT_SEARCHES_KEY = 'connekt.global_search_recents';

const POPULAR_STYLES = [
  { name: 'Live Streams', icon: 'videocam' as const, color: '#EF4444' },
  { name: 'Weddings', icon: 'heart' as const, color: '#F20C8F' },
  { name: 'Portraits', icon: 'person' as const, color: '#3B82F6' },
  { name: 'Events', icon: 'calendar' as const, color: '#0EA5E9' },
  { name: 'Birthdays', icon: 'gift' as const, color: '#F59E0B' },
  { name: 'Studio', icon: 'camera' as const, color: '#10B981' },
  { name: 'Fashion', icon: 'shirt-outline' as const, color: '#8B5CF6' },
  { name: 'Graduation', icon: 'school-outline' as const, color: '#EC4899' },
  { name: 'Family', icon: 'people-outline' as const, color: '#14B8A6' },
  { name: 'Corporate', icon: 'briefcase-outline' as const, color: '#64748B' },
];

const CATEGORY_CHIPS = [
  { label: 'All', icon: 'apps-outline' as const, color: '#083A85' },
  { label: 'Live Streams', icon: 'videocam-outline' as const, color: '#EF4444', isLive: true },
  { label: 'Wedding', icon: 'heart-outline' as const, color: '#F20C8F' },
  { label: 'Portraits', icon: 'person-outline' as const, color: '#3B82F6' },
  { label: 'Events', icon: 'calendar-outline' as const, color: '#0EA5E9' },
  { label: 'Birthday', icon: 'gift-outline' as const, color: '#F59E0B' },
  { label: 'Studio', icon: 'camera-outline' as const, color: '#10B981' },
  { label: 'Fashion', icon: 'shirt-outline' as const, color: '#8B5CF6' },
  { label: 'Graduation', icon: 'school-outline' as const, color: '#EC4899' },
  { label: 'Family', icon: 'people-outline' as const, color: '#14B8A6' },
  { label: 'Corporate', icon: 'briefcase-outline' as const, color: '#64748B' },
];

type BookingRowItem = {
  id: string;
  title: string;
  category: string;
  photographerName: string;
  eventDate?: string;
  price?: number;
  statusType: 'LIVE' | 'PAID' | 'BOOKED';
  isLive: boolean;
};

type ClientActivityItem = {
  id: string;
  type: string;
  title: string;
  message?: string;
  timeAgo: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  actionText: string;
  route: string;
};

type FeedUnifiedItem =
  | { kind: 'booking'; data: BookingRowItem }
  | { kind: 'activity'; data: ClientActivityItem };

function parseBookingDateBadge(dateStr?: string): { month: string; day: string } {
  if (!dateStr) return { month: 'TBD', day: '--' };
  const lower = dateStr.toLowerCase().trim();
  if (lower === 'today') return { month: 'TODAY', day: '●' };
  if (lower === 'tomorrow') return { month: 'TMRW', day: '→' };
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      const parts = dateStr.split(' ');
      if (parts.length >= 2) {
        return { month: parts[0].slice(0, 3).toUpperCase(), day: parts[1].replace(/[^0-9]/g, '') || parts[1] };
      }
      return { month: 'DATE', day: dateStr.slice(0, 3) };
    }
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    return { month, day };
  } catch {
    return { month: 'DATE', day: '--' };
  }
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Recently';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function mapApiActivity(a: RecentActivity): ClientActivityItem {
  const t = (a.type || '').toUpperCase();
  let icon: keyof typeof Ionicons.glyphMap = 'notifications-outline';
  let iconColor = '#083A85';
  let iconBg = 'rgba(8, 58, 133, 0.10)';
  let actionText = 'Details';
  let route = '/events';

  if (t.includes('GALLERY') || t.includes('PHOTO') || t.includes('ALBUM')) {
    icon = 'images';
    iconColor = '#10B981';
    iconBg = 'rgba(16, 185, 129, 0.12)';
    actionText = 'View Photos';
    route = '/gallery';
  } else if (t.includes('STREAM') || t.includes('LIVE')) {
    icon = 'videocam';
    iconColor = '#EF4444';
    iconBg = 'rgba(239, 68, 68, 0.12)';
    actionText = 'Watch Live';
    route = '/explore-events';
  } else if (t.includes('PAY') || t.includes('ESCROW') || t.includes('TRANSACTION')) {
    icon = 'card';
    iconColor = '#083A85';
    iconBg = 'rgba(8, 58, 133, 0.12)';
    actionText = 'Receipt';
    route = '/events';
  } else if (t.includes('BOOK')) {
    icon = 'calendar';
    iconColor = '#8B5CF6';
    iconBg = 'rgba(139, 92, 246, 0.12)';
    actionText = 'Details';
    route = '/events';
  }

  return {
    id: a.id,
    type: a.type,
    title: a.title,
    message: a.message,
    timeAgo: a.createdAt ? formatRelativeTime(a.createdAt) : 'Recently',
    icon,
    iconColor,
    iconBg,
    actionText,
    route,
  };
}

function formatBookingDate(dateStr?: string): string {
  if (!dateStr) return 'TBD';
  if (dateStr === 'Today' || dateStr === 'Tomorrow') return dateStr;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 22) return 'Good Evening';
  return 'Good Night';
}

function getTodayFormatted(): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date()).toUpperCase();
  } catch {
    return 'TODAY';
  }
}

function parseEventDate(iso?: string) {
  if (!iso) return { month: 'TBD', day: '--' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { month: 'TBD', day: '--' };
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate().toString();
  return { month, day };
}

const PENDING_PAYMENT_SNOOZE_MS = 6 * 60 * 60 * 1000; // 6 hours
const STORAGE_KEY_PENDING_DISMISSED = 'connekt.pending_payment_dismissed_until';

export function ClientHome() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'there';

  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [payNowOpen, setPayNowOpen] = useState(false);
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [isPendingDismissed, setIsPendingDismissed] = useState(false);

  // Real-Time Inline Global Search State
  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [searchBarY, setSearchBarY] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchEvents, setSearchEvents] = useState<PublicEvent[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Feeds
  const analytics = useAsync(useCallback(() => getCustomerAnalytics(), []));
  const events = useAsync(useCallback(() => listEvents(), []));
  const recentActivities = useAsync(useCallback(() => getCustomerRecentActivities(8), []));
  const photographers = useAsync(useCallback(() => listPhotographers(), []));
  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));

  const [feedFilterTab, setFeedFilterTab] = useState<'ALL' | 'BOOKINGS' | 'ACTIVITY'>('ALL');

  const checkDismissed = useCallback(async () => {
    try {
      const val = await storage.get(STORAGE_KEY_PENDING_DISMISSED);
      if (val) {
        const until = Number(val);
        if (!Number.isNaN(until) && Date.now() < until) {
          setIsPendingDismissed(true);
          return;
        } else {
          await storage.remove(STORAGE_KEY_PENDING_DISMISSED);
        }
      }
      setIsPendingDismissed(false);
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    checkDismissed();
  }, [checkDismissed]);

  const handleDismissPending = async () => {
    setIsPendingDismissed(true);
    try {
      const until = Date.now() + PENDING_PAYMENT_SNOOZE_MS;
      await storage.set(STORAGE_KEY_PENDING_DISMISSED, String(until));
    } catch {
      // Ignored
    }
  };

  // Load & persist recent searches
  const loadRecentSearches = useCallback(async () => {
    try {
      const raw = await storage.get(RECENT_SEARCHES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 5));
      }
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    loadRecentSearches();
  }, [loadRecentSearches]);

  const saveRecentSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      const next = [
        trimmed,
        ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 6);
      setRecentSearches(next);
      await storage.set(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // Ignored
    }
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    try {
      await storage.remove(RECENT_SEARCHES_KEY);
    } catch {
      // Ignored
    }
  };

  // Real-time backend search debounced
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSearchEvents([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await listPublicEventsDetailed({ search: q, size: 8 });
        setSearchEvents(res.content ?? []);
      } catch {
        setSearchEvents([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Bookmarks State & Hydration
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkLoading, setBookmarkLoading] = useState<Record<string, boolean>>({});

  const refreshBookmarks = useCallback(() => {
    listBookmarkedPhotographers()
      .then((items) => {
        setBookmarkedIds(new Set(items.map((p) => p.id)));
      })
      .catch(() => {
        // Offline / unauthenticated fallback
      });
  }, []);

  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  const handleToggleBookmark = async (id: string) => {
    if (bookmarkLoading[id]) return;
    const isBookmarked = bookmarkedIds.has(id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setBookmarkLoading((prev) => ({ ...prev, [id]: true }));
    try {
      if (isBookmarked) {
        await unbookmarkPhotographer(id);
      } else {
        await bookmarkPhotographer(id);
      }
      analytics.refresh();
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    } finally {
      setBookmarkLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const refreshing =
    analytics.loading ||
    events.loading ||
    recentActivities.loading ||
    photographers.loading ||
    pending.loading;

  const onRefresh = () => {
    checkDismissed();
    analytics.refresh();
    events.refresh();
    recentActivities.refresh();
    photographers.refresh();
    pending.refresh();
    wallet.refresh();
    refreshBookmarks();
  };

  const photographerList = useMemo(() => {
    return photographers.data ?? [];
  }, [photographers.data]);

  const featuredCardWidth = responsive.isLarge ? 270 : 236;

  // Auto-scroll mechanics for Featured Photographers Rail
  const featuredRailRef = useRef<ScrollView>(null);
  const featuredScrollIndexRef = useRef(0);
  const isUserTouchingRailRef = useRef(false);
  const touchResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const featuredList = useMemo(() => photographerList.slice(0, 6), [photographerList]);

  useEffect(() => {
    if (featuredList.length <= 1) return;

    const interval = setInterval(() => {
      if (isUserTouchingRailRef.current) return;

      const nextIndex = (featuredScrollIndexRef.current + 1) % featuredList.length;
      featuredScrollIndexRef.current = nextIndex;

      const cardGap = spacing.md;
      const targetOffset = nextIndex * (featuredCardWidth + cardGap);

      featuredRailRef.current?.scrollTo({
        x: targetOffset,
        animated: true,
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [featuredList.length, featuredCardWidth]);

  const onRailScrollBeginDrag = () => {
    isUserTouchingRailRef.current = true;
    if (touchResumeTimeoutRef.current) {
      clearTimeout(touchResumeTimeoutRef.current);
    }
  };

  const onRailScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent?.contentOffset?.x ?? 0;
    const cardGap = spacing.md;
    const estimatedIndex = Math.round(offsetX / (featuredCardWidth + cardGap));
    featuredScrollIndexRef.current = Math.max(0, Math.min(estimatedIndex, featuredList.length - 1));

    if (touchResumeTimeoutRef.current) {
      clearTimeout(touchResumeTimeoutRef.current);
    }
    touchResumeTimeoutRef.current = setTimeout(() => {
      isUserTouchingRailRef.current = false;
    }, 4000);
  };

  const searchPhotographers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return photographerList
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          (p.category && p.category.toLowerCase().includes(q)) ||
          (p.location && p.location.toLowerCase().includes(q)) ||
          (p.specialties && p.specialties.some((s) => s.toLowerCase().includes(q)))
        );
      })
      .slice(0, 6);
  }, [photographerList, searchQuery]);

  const searchMatchingStyles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return POPULAR_STYLES.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const searchMatchingLive = useMemo(() => {
    return searchEvents.filter((e) => isEventLive(e));
  }, [searchEvents]);

  const handleSelectPhotographer = (id: string, phName: string) => {
    saveRecentSearch(phName);
    setIsSearchFocused(false);
    router.push(`/photographer/${id}` as never);
  };

  const handleSelectEvent = (id: string, title: string, isLive?: boolean) => {
    saveRecentSearch(title);
    setIsSearchFocused(false);
    if (isLive) {
      router.push(`/(public)/events/live-stream?id=${id}` as never);
    } else {
      router.push(`/(public)/event/${id}` as never);
    }
  };

  const handleSelectStyle = (styleName: string) => {
    saveRecentSearch(styleName);
    setSearchQuery(styleName);
    setSelectedCategory(styleName);
    setIsSearchFocused(true);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchEvents([]);
    setIsSearchFocused(false);
    setSelectedCategory('All');
    searchInputRef.current?.blur();
  };

  const handleCategorySelect = (categoryLabel: string) => {
    setSelectedCategory(categoryLabel);
    if (categoryLabel === 'All') {
      handleClearSearch();
    } else {
      setSearchQuery(categoryLabel);
      setIsSearchFocused(true);
      searchInputRef.current?.focus();
      if (searchBarY > 0) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, searchBarY - topBarHeight - 12),
          animated: true,
        });
      }
    }
  };

  const upcomingEvents = useMemo(() => {
    const eventList = events.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return eventList.filter((e) => {
      const s = (e.status ?? '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      // ONGOING events are actively streaming / happening right now
      if (s === 'ONGOING') return true;
      return !e.eventDate || e.eventDate >= today;
    });
  }, [events.data]);

  const latestBookings: BookingRowItem[] = useMemo(() => {
    const list = events.data ?? [];
    if (list.length > 0) {
      return [...list]
        .sort((a, b) => {
          const aTime = a.createdAt
            ? new Date(a.createdAt).getTime()
            : a.eventDate
              ? new Date(a.eventDate).getTime()
              : 0;
          const bTime = b.createdAt
            ? new Date(b.createdAt).getTime()
            : b.eventDate
              ? new Date(b.eventDate).getTime()
              : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((e) => {
          const rawStatus = (e.status ?? '').toUpperCase();
          const isLive =
            rawStatus === 'ONGOING' ||
            (e as any).streamStatus === 'live' ||
            Boolean((e as any).hasLiveStream);
          const isPaid =
            rawStatus === 'PAID' ||
            rawStatus === 'CONFIRMED' ||
            rawStatus === 'COMPLETED' ||
            Boolean(e.price);
          const statusType: 'LIVE' | 'PAID' | 'BOOKED' = isLive
            ? 'LIVE'
            : isPaid
              ? 'PAID'
              : 'BOOKED';

          return {
            id: String(e.id),
            title: e.title || 'Event Shoot',
            category: e.category || 'Photography',
            photographerName: e.photographerName || 'Assigned Pro',
            eventDate: e.eventDate,
            price: e.price,
            statusType,
            isLive,
          };
        });
    }

    return [];
  }, [events.data]);

  const activityList: ClientActivityItem[] = useMemo(() => {
    const apiData = recentActivities.data ?? [];
    if (apiData.length > 0) {
      return apiData.map(mapApiActivity);
    }
    return [];
  }, [recentActivities.data]);

  const displayedFeedItems: FeedUnifiedItem[] = useMemo(() => {
    if (feedFilterTab === 'BOOKINGS') {
      return latestBookings.map((b) => ({ kind: 'booking' as const, data: b }));
    }
    if (feedFilterTab === 'ACTIVITY') {
      return activityList.map((a) => ({ kind: 'activity' as const, data: a }));
    }
    // 'ALL' tab: interleave top bookings and activities
    const items: FeedUnifiedItem[] = [];
    const maxLen = Math.max(latestBookings.length, activityList.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < latestBookings.length && items.length < 6) {
        items.push({ kind: 'booking' as const, data: latestBookings[i] });
      }
      if (i < activityList.length && items.length < 6) {
        items.push({ kind: 'activity' as const, data: activityList[i] });
      }
      if (items.length >= 6) break;
    }
    return items;
  }, [feedFilterTab, latestBookings, activityList]);

  const nextEvent = useMemo(() => {
    // If an event is currently live/ongoing, prioritize it in the spotlight!
    const live = upcomingEvents.find((e) => (e.status ?? '').toUpperCase() === 'ONGOING');
    if (live) return live;

    return [...upcomingEvents].sort((a, b) => {
      const aTime = a.eventDate ? new Date(a.eventDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.eventDate ? new Date(b.eventDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })[0];
  }, [upcomingEvents]);

  const isNextEventLive = useMemo(() => {
    if (!nextEvent) return false;
    const s = (nextEvent.status ?? '').toUpperCase();
    return (
      s === 'ONGOING' ||
      (nextEvent as any).streamStatus === 'live' ||
      (nextEvent as any).hasLiveStream === true
    );
  }, [nextEvent]);

  const hasAnyLiveStream = useMemo(() => {
    if (isNextEventLive) return true;
    const list = events.data ?? [];
    return list.some((e) => {
      const s = (e.status ?? '').toUpperCase();
      const stream = ((e as any).streamStatus ?? '').toLowerCase();
      return s === 'ONGOING' || stream === 'live' || stream === 'connected' || stream === 'streaming';
    });
  }, [events.data, isNextEventLive]);

  const deliveredPhotosCount = analytics.data?.totalPhotos ?? 0;

  const pendingList = pending.data ?? [];
  const totalPendingAmount = pendingList.reduce(
    (sum, p) => sum + (p.amount - (p.paidAmount ?? 0)),
    0,
  );
  const hasFailedPayment = pendingList.some((p) => (p.status ?? '').toUpperCase() === 'FAILED');

  const greeting = getTimeGreeting();
  const dateFormatted = getTodayFormatted();

  return (
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? topBarHeight : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: topBarHeight + spacing.sm,
              paddingBottom: isSearchFocused ? 340 : spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Optional KYC Banner */}
        <KycBanner />

        {/* Pending Payment Alert if any payment is required and not dismissed */}
        {!isPendingDismissed && pendingList.length > 0 && totalPendingAmount > 0 && (
          <View
            style={[
              styles.pendingAlert,
              hasFailedPayment && styles.pendingAlertFailed,
            ]}
          >
            <Pressable
              style={styles.pendingAlertMain}
              onPress={() => {
                setPayNowPayment(pendingList[0]);
                setPayNowOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={hasFailedPayment ? 'Payment action required' : 'Pending payment'}
            >
              <View
                style={[
                  styles.pendingAlertIcon,
                  hasFailedPayment ? styles.pendingAlertIconFailed : styles.pendingAlertIconWarning,
                ]}
              >
                <Ionicons
                  name={hasFailedPayment ? 'alert-circle' : 'time'}
                  size={16}
                  color={hasFailedPayment ? colors.error : colors.warning}
                />
              </View>
              <View style={styles.pendingAlertTextWrap}>
                <Text style={styles.pendingAlertTitle}>
                  {hasFailedPayment ? 'Payment action required' : 'Pending payment'}
                </Text>
                <Text style={styles.pendingAlertSub}>
                  {formatPrice(totalPendingAmount, wallet.data?.currency)} due for your booking
                </Text>
              </View>
            </Pressable>

            <View style={styles.pendingAlertActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.pendingPayBtn,
                  hasFailedPayment && styles.pendingPayBtnFailed,
                  pressed && styles.pressed,
                ]}
                onPress={() => {
                  setPayNowPayment(pendingList[0]);
                  setPayNowOpen(true);
                }}
              >
                <Text style={styles.pendingPayBtnText}>Pay Now</Text>
                <Ionicons name="arrow-forward" size={11} color="#FFFFFF" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.pendingDismissBtn, pressed && styles.pressed]}
                onPress={handleDismissPending}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Dismiss payment alert for 6 hours"
              >
                <Ionicons name="close" size={15} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Refined Header */}
        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>
            {dateFormatted} · CLIENT OVERVIEW
          </Text>
          <Text style={styles.headerTitle}>
            {greeting},{' '}
            <Text style={styles.headerName}>{name}</Text>
          </Text>
          <Text style={styles.headerSubtitle}>
            Discover top-tier creators or relive your captured memories.
          </Text>
        </View>

        {/* Hero Section: Dynamic Spotlight */}
        {nextEvent ? (
          /* Case A: Next upcoming session or live event */
          <Pressable
            style={({ pressed }) => [styles.spotlightHero, pressed && styles.cardPressed]}
            onPress={() => router.push(`/(public)/event/${nextEvent.id}` as never)}
          >
            <Image
              source={
                nextEvent.coverImage
                  ? { uri: nextEvent.coverImage }
                  : EVENT_COVER_PLACEHOLDER
              }
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={250}
            />
            <LinearGradient
              colors={['rgba(8,20,48,0.2)', 'rgba(8,16,36,0.7)', 'rgba(6,12,28,0.96)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.spotlightContent}>
              <View style={styles.spotlightTopRow}>
                <View
                  style={[
                    styles.spotlightLiveBadge,
                    isNextEventLive && styles.spotlightLiveBadgeLive,
                  ]}
                >
                  <View
                    style={[
                      styles.livePulseDot,
                      isNextEventLive && styles.livePulseDotRed,
                    ]}
                  />
                  <Text style={styles.spotlightLiveText}>
                    {isNextEventLive ? 'LIVE NOW' : 'UPCOMING SHOOT'}
                  </Text>
                </View>
                {isNextEventLive ? (
                  <View style={[styles.spotlightDatePill, styles.spotlightDatePillLive]}>
                    <Ionicons name="videocam" size={11} color="#EF4444" />
                    <Text style={[styles.spotlightDatePillText, { color: '#FCA5A5' }]}>
                      BROADCASTING
                    </Text>
                  </View>
                ) : nextEvent.eventDate ? (
                  <View style={styles.spotlightDatePill}>
                    <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.spotlightDatePillText}>
                      {formatDate(nextEvent.eventDate)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.spotlightBottomRow}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={styles.spotlightTitle} numberOfLines={1}>
                    {nextEvent.title || 'Event Booking'}
                  </Text>
                  <Text style={styles.spotlightMeta} numberOfLines={1}>
                    {[nextEvent.photographerName, nextEvent.location].filter(Boolean).join(' · ')}
                  </Text>
                </View>

                <View style={[styles.spotlightCta, isNextEventLive && styles.spotlightCtaLive]}>
                  <Text
                    style={[
                      styles.spotlightCtaText,
                      isNextEventLive && styles.spotlightCtaTextLive,
                    ]}
                  >
                    {isNextEventLive ? 'Watch Live' : 'Details'}
                  </Text>
                  <Ionicons
                    name={isNextEventLive ? 'play' : 'arrow-forward'}
                    size={12}
                    color={isNextEventLive ? '#FFFFFF' : '#083A85'}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        ) : (
          /* Case B: Editorial Discovery Spotlight */
          <Pressable
            style={({ pressed }) => [styles.editorialHero, pressed && styles.cardPressed]}
            onPress={() => {
              searchInputRef.current?.focus();
              setIsSearchFocused(true);
              if (searchBarY > 0) {
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, searchBarY - topBarHeight - 12),
                  animated: true,
                });
              }
            }}
          >
            <LinearGradient
              colors={['#083A85', '#0C2B68', '#161233']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Subtle ambient lighting spheres */}
            <View style={styles.ambientOrbRight} pointerEvents="none" />
            <View style={styles.ambientOrbLeft} pointerEvents="none" />

            <View style={styles.editorialContent}>
              <View style={styles.editorialBadge}>
                <Ionicons name="sparkles" size={11} color="#FFD1EC" />
                <Text style={styles.editorialBadgeText}>CURATED CREATORS</Text>
              </View>
              <Text style={styles.editorialTitle}>
                Capture your next unforgettable story.
              </Text>
              <Text style={styles.editorialSubtitle}>
                Vetted professionals for weddings, portraits, and private events.
              </Text>

              <View style={styles.editorialCtaRow}>
                <View style={styles.editorialCtaBtn}>
                  <Ionicons name="camera" size={13} color="#083A85" />
                  <Text style={styles.editorialCtaBtnText}>Browse Photographers</Text>
                </View>
                <View style={styles.editorialExploreChip}>
                  <Text style={styles.editorialExploreChipText}>Top Rated 2026</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}

        {/* Interactive Real-Time Search Bar — Start Typing Directly */}
        <View
          onLayout={(e) => setSearchBarY(e.nativeEvent.layout.y)}
          style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}
        >
          <Ionicons
            name="search"
            size={18}
            color={isSearchFocused ? colors.primary : colors.textMuted}
          />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search photographers, live streams, events..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!isSearchFocused) setIsSearchFocused(true);
            }}
            onFocus={() => {
              setIsSearchFocused(true);
              if (searchBarY > 0) {
                scrollViewRef.current?.scrollTo({
                  y: Math.max(0, searchBarY - topBarHeight - 12),
                  animated: true,
                });
              }
            }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
          ) : searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          {isSearchFocused && (
            <Pressable
              onPress={() => {
                setIsSearchFocused(false);
                searchInputRef.current?.blur();
              }}
              hitSlop={8}
              style={styles.searchDoneBtn}
            >
              <Text style={styles.searchDoneText}>Done</Text>
            </Pressable>
          )}
        </View>

        {/* Real-Time Live Suggestions Overlay / Card */}
        {(isSearchFocused || searchQuery.trim().length > 0) && (
          <View style={styles.suggestionsCard}>
            {/* Header / Status row */}
            <View style={styles.suggestionsHeader}>
              <View style={styles.suggestionsHeaderLeft}>
                <Ionicons
                  name={searchLoading ? 'sync' : 'sparkles'}
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.suggestionsHeaderTitle}>
                  {searchLoading
                    ? 'SEARCHING PLATFORM GLOBALLY...'
                    : searchQuery.trim().length > 0
                    ? `RESULTS FOR "${searchQuery.trim().toUpperCase()}"`
                    : 'QUICK SUGGESTIONS & RECENT SEARCHES'}
                </Text>
              </View>
              <Pressable onPress={handleClearSearch} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* If user is typing query and has live matching broadcasts */}
            {searchMatchingLive.length > 0 && (
              <View style={styles.suggestionSection}>
                <View style={styles.liveSectionHeader}>
                  <View style={styles.livePulseDotRed} />
                  <Text style={styles.liveSectionTitle}>LIVE BROADCASTS NOW</Text>
                </View>
                {searchMatchingLive.slice(0, 2).map((ev) => (
                  <Pressable
                    key={'live-' + ev.id}
                    style={({ pressed }) => [styles.liveSuggestionRow, pressed && styles.pressed]}
                    onPress={() => handleSelectEvent(ev.id, ev.title, true)}
                  >
                    <Image
                      source={ev.eventPhoto ? { uri: ev.eventPhoto } : EVENT_COVER_PLACEHOLDER}
                      style={styles.liveSuggestionThumb}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.suggestionItemTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.suggestionItemSub} numberOfLines={1}>
                        {[ev.photographerName, ev.location].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.watchLiveBadge}>
                      <Ionicons name="play" size={10} color="#FFFFFF" />
                      <Text style={styles.watchLiveBadgeText}>Watch</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Public Events Section */}
            {searchEvents.length > 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.suggestionSectionTitle}>
                  Events & Shoots ({searchEvents.length})
                </Text>
                {searchEvents.slice(0, 3).map((ev) => (
                  <Pressable
                    key={'ev-' + ev.id}
                    style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
                    onPress={() => handleSelectEvent(ev.id, ev.title, isEventLive(ev))}
                  >
                    <Image
                      source={ev.eventPhoto ? { uri: ev.eventPhoto } : EVENT_COVER_PLACEHOLDER}
                      style={styles.suggestionThumb}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={styles.suggestionItemTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.suggestionItemSub} numberOfLines={1}>
                        {[
                          ev.eventCategory?.name,
                          ev.eventDate ? formatDate(ev.eventDate) : null,
                          ev.location,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Photographers Section */}
            {searchPhotographers.length > 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.suggestionSectionTitle}>
                  Photographers ({searchPhotographers.length})
                </Text>
                {searchPhotographers.slice(0, 3).map((ph) => (
                  <Pressable
                    key={'ph-' + ph.id}
                    style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
                    onPress={() => handleSelectPhotographer(ph.id, ph.name)}
                  >
                    <Image
                      source={ph.coverImage ? { uri: ph.coverImage } : PHOTOGRAPHER_COVER_PLACEHOLDER}
                      style={styles.suggestionAvatar}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.suggestionItemTitle} numberOfLines={1}>
                          {ph.name}
                        </Text>
                        <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                      </View>
                      <Text style={styles.suggestionItemSub} numberOfLines={1}>
                        {[ph.category, ph.location].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {ph.rating ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Ionicons name="star" size={11} color="#F59E0B" />
                          <Text style={styles.suggestionRating}>{ph.rating.toFixed(1)}</Text>
                        </View>
                      ) : null}
                      {ph.startingPrice ? (
                        <Text style={styles.suggestionPrice}>From ${ph.startingPrice}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Matching Style Chips */}
            {searchMatchingStyles.length > 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.suggestionSectionTitle}>Matching Styles</Text>
                <View style={styles.suggestionPillsRow}>
                  {searchMatchingStyles.map((st) => (
                    <Pressable
                      key={st.name}
                      style={styles.suggestionStylePill}
                      onPress={() => handleSelectStyle(st.name)}
                    >
                      <Ionicons name={st.icon} size={12} color={st.color} />
                      <Text style={styles.suggestionStylePillText}>{st.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Empty state when query is non-empty but nothing matches */}
            {searchQuery.trim().length >= 2 &&
              !searchLoading &&
              searchEvents.length === 0 &&
              searchPhotographers.length === 0 &&
              searchMatchingStyles.length === 0 && (
                <View style={styles.suggestionEmptyState}>
                  <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.suggestionEmptyTitle}>No matching results</Text>
                  <Text style={styles.suggestionEmptySub}>
                    We couldn't find any photographers or events matching "{searchQuery}". Try browsing by
                    popular categories below.
                  </Text>
                </View>
              )}

            {/* Recent Searches (when query is empty) */}
            {searchQuery.trim().length === 0 && recentSearches.length > 0 && (
              <View style={styles.suggestionSection}>
                <View style={styles.recentSectionHeader}>
                  <Text style={styles.suggestionSectionTitle}>Recent Searches</Text>
                  <Pressable onPress={clearRecentSearches} hitSlop={6}>
                    <Text style={styles.clearRecentsText}>Clear all</Text>
                  </Pressable>
                </View>
                <View style={styles.suggestionPillsRow}>
                  {recentSearches.map((rec) => (
                    <Pressable
                      key={rec}
                      style={styles.recentSearchPill}
                      onPress={() => {
                        setSearchQuery(rec);
                        setIsSearchFocused(true);
                      }}
                    >
                      <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.recentSearchText}>{rec}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Popular Categories (when query is empty) */}
            {searchQuery.trim().length === 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.suggestionSectionTitle}>Popular Categories</Text>
                <View style={styles.suggestionPillsRow}>
                  {POPULAR_STYLES.map((st) => (
                    <Pressable
                      key={st.name}
                      style={styles.suggestionStylePill}
                      onPress={() => handleSelectStyle(st.name)}
                    >
                      <Ionicons name={st.icon} size={12} color={st.color} />
                      <Text style={styles.suggestionStylePillText}>{st.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Responsive Category Selector Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.categoryRail,
            { paddingHorizontal: responsive.isCompact ? spacing.md : spacing.lg },
          ]}
        >
          {CATEGORY_CHIPS.map((c) => {
            const active = selectedCategory === c.label;
            const chipPaddingH = responsive.isCompact ? 11 : responsive.isLarge ? 17 : 14;
            const chipPaddingV = responsive.isCompact ? 7 : responsive.isLarge ? 10 : 8;
            const iconSize = responsive.isCompact ? 13 : responsive.isLarge ? 16 : 14;
            const fontSizeVal = responsive.isCompact ? 11 : responsive.isLarge ? 13 : 12;

            return (
              <Pressable
                key={c.label}
                onPress={() => handleCategorySelect(c.label)}
                style={({ pressed }) => [
                  styles.categoryChip,
                  {
                    paddingHorizontal: chipPaddingH,
                    paddingVertical: chipPaddingV,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                  active && styles.categoryChipActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={active ? { selected: true } : {}}
                accessibilityLabel={`Filter by ${c.label}`}
              >
                <View
                  style={[
                    styles.categoryIconWrap,
                    active && styles.categoryIconWrapActive,
                    !active && { backgroundColor: c.color + '18' },
                  ]}
                >
                  <Ionicons
                    name={c.icon}
                    size={iconSize}
                    color={active ? '#FFFFFF' : c.color}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryChipText,
                    { fontSize: fontSizeVal },
                    active && styles.categoryChipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
                {c.isLive && (
                  <View style={[styles.liveDotSmall, active && styles.liveDotSmallActive]} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 2x2 Bento Action Hub */}
        <View style={styles.bentoGrid}>
          {/* Card 1: Book Talent */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/photographers' as never)}
          >
            <View style={styles.bentoTopRow}>
              <View
                style={[
                  styles.bentoIconBox,
                  {
                    backgroundColor: colors.tint,
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="camera" size={19} color={colors.primary} />
              </View>
              <View
                style={[
                  styles.bentoBadge,
                  {
                    backgroundColor: colors.tint,
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={9.5} color={colors.primary} />
                <Text style={[styles.bentoBadgeText, { color: colors.primary }]}>PROS</Text>
              </View>
            </View>

            <View style={styles.bentoBottomRow}>
              <View style={styles.bentoTextWrap}>
                <Text style={styles.bentoTitle} numberOfLines={1}>
                  Book Photographer
                </Text>
                <Text style={styles.bentoSub} numberOfLines={1}>
                  Find verified pros
                </Text>
              </View>
              <View style={styles.bentoArrowCircle}>
                <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>

          {/* Card 2: Find My Photos */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => setFindPhotosModalVisible(true)}
          >
            <View style={styles.bentoTopRow}>
              <View
                style={[
                  styles.bentoIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(242, 12, 143, 0.16)' : 'rgba(242, 12, 143, 0.08)',
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="scan" size={19} color="#F20C8F" />
              </View>
              <View
                style={[
                  styles.bentoBadge,
                  {
                    backgroundColor: isDark ? 'rgba(242, 12, 143, 0.14)' : 'rgba(242, 12, 143, 0.06)',
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                <Ionicons name="flash" size={9.5} color="#F20C8F" />
                <Text style={[styles.bentoBadgeText, { color: '#F20C8F' }]}>AI SCAN</Text>
              </View>
            </View>

            <View style={styles.bentoBottomRow}>
              <View style={styles.bentoTextWrap}>
                <Text style={styles.bentoTitle} numberOfLines={1}>
                  Find My Photos
                </Text>
                <Text style={styles.bentoSub} numberOfLines={1}>
                  Instant face match
                </Text>
              </View>
              <View style={styles.bentoArrowCircle}>
                <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>

          {/* Card 3: Live Events */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/explore-events' as never)}
          >
            <View style={styles.bentoTopRow}>
              <View
                style={[
                  styles.bentoIconBox,
                  hasAnyLiveStream
                    ? {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.08)',
                        borderColor: colors.borderSoft,
                      }
                    : {
                        backgroundColor: colors.tint,
                        borderColor: colors.borderSoft,
                      },
                ]}
              >
                <Ionicons
                  name={hasAnyLiveStream ? 'videocam' : 'videocam-outline'}
                  size={19}
                  color={hasAnyLiveStream ? '#EF4444' : colors.primary}
                />
              </View>

              {hasAnyLiveStream ? (
                <View
                  style={[
                    styles.bentoBadge,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)',
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                    },
                  ]}
                >
                  <View style={styles.bentoLiveDot} />
                  <Text style={[styles.bentoBadgeText, { color: '#EF4444' }]}>LIVE NOW</Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.bentoBadge,
                    {
                      backgroundColor: colors.tint,
                      borderColor: colors.borderSoft,
                    },
                  ]}
                >
                  <Ionicons name="radio" size={9.5} color={colors.primary} />
                  <Text style={[styles.bentoBadgeText, { color: colors.primary }]}>STREAMS</Text>
                </View>
              )}
            </View>

            <View style={styles.bentoBottomRow}>
              <View style={styles.bentoTextWrap}>
                <Text style={styles.bentoTitle} numberOfLines={1}>
                  Live Events
                </Text>
                <Text style={styles.bentoSub} numberOfLines={1}>
                  {hasAnyLiveStream ? 'Broadcasts in real-time' : 'Shoots & streams'}
                </Text>
              </View>
              <View style={styles.bentoArrowCircle}>
                <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>

          {/* Card 4: My Gallery */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/gallery' as never)}
          >
            <View style={styles.bentoTopRow}>
              <View
                style={[
                  styles.bentoIconBox,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.08)',
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                <Ionicons
                  name="images"
                  size={19}
                  color="#10B981"
                />
              </View>
              <View
                style={[
                  styles.bentoBadge,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.06)',
                    borderColor: colors.borderSoft,
                  },
                ]}
              >
                {deliveredPhotosCount > 0 ? (
                  <Text
                    style={[
                      styles.bentoBadgeText,
                      { color: isDark ? '#34D399' : '#10B981' },
                    ]}
                  >
                    {deliveredPhotosCount} READY
                  </Text>
                ) : (
                  <>
                    <Ionicons name="albums-outline" size={9.5} color="#10B981" />
                    <Text style={[styles.bentoBadgeText, { color: '#10B981' }]}>VAULT</Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.bentoBottomRow}>
              <View style={styles.bentoTextWrap}>
                <Text style={styles.bentoTitle} numberOfLines={1}>
                  My Photos
                </Text>
                <Text style={styles.bentoSub} numberOfLines={1}>
                  Saved collections
                </Text>
              </View>
              <View style={styles.bentoArrowCircle}>
                <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Client Trio Stats Snapshot Card */}
        <View style={styles.statsBar}>
          {/* Segment 1: Bookings */}
          <Pressable
            style={({ pressed }) => [styles.statsSegment, pressed && styles.statsSegmentPressed]}
            onPress={() => router.push('/events' as never)}
            accessibilityRole="button"
            accessibilityLabel="View Total Bookings"
          >
            <View style={styles.statsHeaderRow}>
              <View style={[styles.statsIconBox, { backgroundColor: colors.tint }]}>
                <Ionicons name="calendar" size={13} color={colors.primary} />
              </View>
              <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={{ opacity: 0.5 }} />
            </View>
            <Text style={styles.statsNum}>
              {analytics.data?.totalBookings ?? 0}
            </Text>
            <Text style={styles.statsLabel} numberOfLines={1}>Bookings</Text>
          </Pressable>

          <View style={styles.statsDivider} />

          {/* Segment 2: Photos Ready */}
          <Pressable
            style={({ pressed }) => [styles.statsSegment, pressed && styles.statsSegmentPressed]}
            onPress={() => router.push('/gallery' as never)}
            accessibilityRole="button"
            accessibilityLabel="View Ready Photos"
          >
            <View style={styles.statsHeaderRow}>
              <View style={[styles.statsIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.10)' }]}>
                <Ionicons name="images" size={13} color="#10B981" />
              </View>
              <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={{ opacity: 0.5 }} />
            </View>
            <Text style={styles.statsNum}>
              {analytics.data?.totalPhotos ?? 0}
            </Text>
            <Text style={styles.statsLabel} numberOfLines={1}>Photos Ready</Text>
          </Pressable>

          <View style={styles.statsDivider} />

          {/* Segment 3: Saved Pros */}
          <Pressable
            style={({ pressed }) => [styles.statsSegment, pressed && styles.statsSegmentPressed]}
            onPress={() => router.push('/photographers' as never)}
            accessibilityRole="button"
            accessibilityLabel="View Saved Photographers"
          >
            <View style={styles.statsHeaderRow}>
              <View style={[styles.statsIconBox, { backgroundColor: isDark ? 'rgba(242, 12, 143, 0.16)' : 'rgba(242, 12, 143, 0.08)' }]}>
                <Ionicons name="bookmark" size={13} color="#F20C8F" />
              </View>
              <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={{ opacity: 0.5 }} />
            </View>
            <Text style={styles.statsNum}>
              {analytics.data?.bookmarkedPhotographers ?? 0}
            </Text>
            <Text style={styles.statsLabel} numberOfLines={1}>Saved Pros</Text>
          </Pressable>
        </View>

        {/* Featured Photographers Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Featured Photographers</Text>
            <Text style={styles.sectionSubtitle}>Vetted artists available for direct booking</Text>
          </View>
          <Pressable
            onPress={() => router.push('/photographers' as never)}
            hitSlop={8}
            style={styles.sectionLinkWrap}
          >
            <Text style={styles.sectionLink}>See all</Text>
            <Ionicons name="arrow-forward" size={13.5} color={colors.primary} />
          </Pressable>
        </View>

        {photographers.loading ? (
          <View style={styles.photographersEmptyCard}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.photographersEmptySub}>Loading featured photographers...</Text>
          </View>
        ) : featuredList.length === 0 ? (
          <View style={styles.photographersEmptyCard}>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            <Text style={styles.photographersEmptyTitle}>No Photographers Available</Text>
            <Text style={styles.photographersEmptySub}>
              Discover vetted photographers and book your next photography session
            </Text>
            <Pressable
              style={styles.photographersEmptyAction}
              onPress={() => router.push('/photographers' as never)}
            >
              <Text style={styles.photographersEmptyActionText}>Browse Photographers</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={featuredRailRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photographersRail}
            snapToInterval={featuredCardWidth + spacing.md}
            snapToAlignment="start"
            decelerationRate="fast"
            onScrollBeginDrag={onRailScrollBeginDrag}
            onMomentumScrollEnd={onRailScrollEnd}
            onScrollEndDrag={onRailScrollEnd}
          >
            {featuredList.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [
                  styles.featuredPhotogCardWrap,
                  { width: featuredCardWidth },
                  pressed && styles.cardPressed,
                ]}
                onPress={() => {
                  router.push(`/photographer/${p.id}` as never);
                }}
              >
                <PhotographerCard
                  photographer={p}
                  coverHeight={130}
                  isBookmarked={bookmarkedIds.has(p.id)}
                  onToggleBookmark={() => handleToggleBookmark(p.id)}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Recent Bookings & Activity Hub */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Bookings & Activity</Text>
            <Text style={styles.sectionSubtitle}>
              Live shoots, bookings & photo delivery updates
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (feedFilterTab === 'ACTIVITY') {
                router.push('/analytics' as never);
              } else {
                router.push('/events' as never);
              }
            }}
            hitSlop={8}
            style={styles.sectionLinkWrap}
          >
            <Text style={styles.sectionLink}>See all</Text>
            <Ionicons name="arrow-forward" size={13.5} color={colors.primary} />
          </Pressable>
        </View>

        {/* Commercial Activity Feed Card */}
        <View style={styles.activityFeedCard}>
          {/* Segmented Filter Control */}
          <View style={styles.feedFilterTrack}>
            <Pressable
              style={[
                styles.filterPill,
                feedFilterTab === 'ALL' && styles.filterPillActive,
              ]}
              onPress={() => setFeedFilterTab('ALL')}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedFilterTab === 'ALL' }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  feedFilterTab === 'ALL' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterPill,
                feedFilterTab === 'BOOKINGS' && styles.filterPillActive,
              ]}
              onPress={() => setFeedFilterTab('BOOKINGS')}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedFilterTab === 'BOOKINGS' }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  feedFilterTab === 'BOOKINGS' && styles.filterPillTextActive,
                ]}
              >
                Bookings ({latestBookings.length})
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.filterPill,
                feedFilterTab === 'ACTIVITY' && styles.filterPillActive,
              ]}
              onPress={() => setFeedFilterTab('ACTIVITY')}
              accessibilityRole="tab"
              accessibilityState={{ selected: feedFilterTab === 'ACTIVITY' }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  feedFilterTab === 'ACTIVITY' && styles.filterPillTextActive,
                ]}
              >
                Activity ({activityList.length})
              </Text>
            </Pressable>
          </View>

          {/* Feed Items */}
          {displayedFeedItems.length === 0 ? (
            <View style={styles.feedEmptyState}>
              <Ionicons name="folder-open-outline" size={26} color={colors.textMuted} />
              <Text style={styles.feedEmptyTitle}>No items found</Text>
              <Text style={styles.feedEmptySubtitle}>
                Your recent bookings and updates will appear here
              </Text>
            </View>
          ) : (
            displayedFeedItems.map((item, idx) => {
              const isLast = idx === displayedFeedItems.length - 1;

              if (item.kind === 'booking') {
                const b = item.data;
                const dateBadge = parseBookingDateBadge(b.eventDate);

                return (
                  <Pressable
                    key={`booking-${b.id}`}
                    style={({ pressed }) => [
                      styles.feedRow,
                      isLast && styles.feedRowLast,
                      pressed && styles.feedRowPressed,
                    ]}
                    onPress={() => {
                      if (b.isLive) {
                        router.push(`/(public)/events/live-stream?id=${b.id}` as never);
                      } else {
                        router.push(`/(public)/event/${b.id}` as never);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${b.title} with ${b.photographerName}`}
                  >
                    {/* Visual Anchor: Date Box */}
                    <View
                      style={[
                        styles.dateBadge,
                        b.isLive && styles.dateBadgeLive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateMonthText,
                          b.isLive && styles.dateMonthTextLive,
                        ]}
                      >
                        {b.isLive ? 'LIVE' : dateBadge.month}
                      </Text>
                      {b.isLive ? (
                        <Ionicons name="videocam" size={15} color="#EF4444" style={{ marginTop: 1 }} />
                      ) : (
                        <Text style={styles.dateDayText}>{dateBadge.day}</Text>
                      )}
                    </View>

                    {/* Center Details */}
                    <View style={styles.feedContentCol}>
                      <View style={styles.feedTitleRow}>
                        {b.isLive && <View style={styles.feedLiveDot} />}
                        <Text style={styles.feedTitle} numberOfLines={1}>
                          {b.title}
                        </Text>
                      </View>

                      <View style={styles.feedSubRow}>
                        <Ionicons name="camera-outline" size={11} color={colors.primary} />
                        <Text style={styles.feedSubText} numberOfLines={1}>
                          {b.photographerName} · {b.category}
                        </Text>
                      </View>

                      <View style={styles.feedMetaRow}>
                        <Ionicons name="calendar-outline" size={10} color={colors.textMuted} />
                        <Text style={styles.feedMetaText} numberOfLines={1}>
                          {formatBookingDate(b.eventDate)}
                        </Text>
                      </View>
                    </View>

                    {/* Right Col: Status Pill & Price & Chevron */}
                    <View style={styles.feedRightCol}>
                      {b.statusType === 'LIVE' ? (
                        <View style={styles.feedPillLive}>
                          <View style={styles.feedLiveDot} />
                          <Text style={styles.feedLivePillText}>LIVE</Text>
                        </View>
                      ) : b.statusType === 'PAID' ? (
                        <View style={styles.feedPillPaid}>
                          <Ionicons name="checkmark-circle" size={10} color="#10B981" />
                          <Text style={styles.feedPaidPillText}>PAID</Text>
                        </View>
                      ) : (
                        <View style={styles.feedPillBooked}>
                          <Ionicons name="calendar" size={10} color="#3B82F6" />
                          <Text style={styles.feedBookedPillText}>BOOKED</Text>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        {b.price != null && (
                          <Text style={styles.feedPriceText}>${b.price}</Text>
                        )}
                        <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                      </View>
                    </View>
                  </Pressable>
                );
              }

              // Activity Item
              const a = item.data;
              return (
                <Pressable
                  key={`activity-${a.id}`}
                  style={({ pressed }) => [
                    styles.feedRow,
                    isLast && styles.feedRowLast,
                    pressed && styles.feedRowPressed,
                  ]}
                  onPress={() => router.push(a.route as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}: ${a.message || ''}`}
                >
                  {/* Visual Anchor: Activity Squircle Icon */}
                  <View
                    style={[
                      styles.activityIconBox,
                      { backgroundColor: a.iconBg },
                    ]}
                  >
                    <Ionicons name={a.icon} size={19} color={a.iconColor} />
                  </View>

                  {/* Center Details */}
                  <View style={styles.feedContentCol}>
                    <Text style={styles.feedTitle} numberOfLines={1}>
                      {a.title}
                    </Text>

                    {a.message ? (
                      <Text style={styles.feedSubText} numberOfLines={1}>
                        {a.message}
                      </Text>
                    ) : null}

                    <View style={styles.feedMetaRow}>
                      <Ionicons name="time-outline" size={10} color={colors.textMuted} />
                      <Text style={styles.feedMetaText} numberOfLines={1}>
                        {a.timeAgo}
                      </Text>
                    </View>
                  </View>

                  {/* Right Col: Action Pill & Chevron */}
                  <View style={styles.feedRightCol}>
                    <View style={styles.feedActionPill}>
                      <Text style={styles.feedActionPillText}>{a.actionText}</Text>
                      <Ionicons name="chevron-forward" size={10} color={colors.primary} />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}

          {/* Footer Action Bar */}
          <Pressable
            style={styles.cardFooterBar}
            onPress={() => router.push('/events' as never)}
            hitSlop={6}
          >
            <Text style={styles.cardFooterText}>
              {feedFilterTab === 'BOOKINGS'
                ? 'Manage All Bookings & Escrow'
                : feedFilterTab === 'ACTIVITY'
                ? 'View All Account Activity'
                : 'View All Bookings & Activity History'}
            </Text>
            <Ionicons name="arrow-forward" size={11} color={colors.primary} />
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Translucent TopBar */}
      <TopBar />

      {/* Find My Photos Sheet */}
      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-my-photos"
      />

      {/* Pay Now Sheet */}
      <PayNowSheet
        payment={payNowPayment}
        visible={payNowOpen}
        onClose={() => {
          setPayNowOpen(false);
          setPayNowPayment(null);
        }}
        onSuccess={() => {
          pending.refresh();
          events.refresh();
          analytics.refresh();
        }}
      />

      {/* Global Real-Time Search Modal */}
      <GlobalSearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        initialQuery={searchQuery}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  pressed: {
    opacity: 0.85,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  // Refined Greeting Header
  header: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    gap: 3,
  },
  headerEyebrow: {
    color: c.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.1,
  },
  headerTitle: {
    color: c.text,
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  headerName: {
    color: c.primary,
  },
  headerSubtitle: {
    color: c.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },

  // Pending Alert (Theme Adaptive & Dismissable)
  pendingAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.warningBg,
    borderWidth: 1,
    borderColor: c.warning + '35',
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    ...e(1),
  },
  pendingAlertFailed: {
    backgroundColor: c.errorBg,
    borderColor: c.error + '45',
  },
  pendingAlertMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  pendingAlertIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAlertIconWarning: {
    backgroundColor: c.warning + '20',
  },
  pendingAlertIconFailed: {
    backgroundColor: c.error + '20',
  },
  pendingAlertTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  pendingAlertTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  pendingAlertSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    marginTop: 1,
  },
  pendingAlertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.primary,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: radii.full,
  },
  pendingPayBtnFailed: {
    backgroundColor: c.error,
  },
  pendingPayBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  pendingDismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Spotlight Hero (Next Session)
  spotlightHero: {
    height: 195,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.lg,
    ...e(3),
  },
  spotlightContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  spotlightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotlightLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.full,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  spotlightLiveText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
  },
  spotlightDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  spotlightDatePillText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  spotlightBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  spotlightTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: -0.3,
  },
  spotlightMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  spotlightCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...e(1),
  },
  spotlightCtaText: {
    color: '#083A85',
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  spotlightLiveBadgeLive: {
    backgroundColor: 'rgba(220, 38, 38, 0.75)',
    borderColor: 'rgba(254, 202, 202, 0.4)',
  },
  livePulseDotRed: {
    backgroundColor: '#EF4444',
  },
  spotlightDatePillLive: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  spotlightCtaLive: {
    backgroundColor: '#DC2626',
  },
  spotlightCtaTextLive: {
    color: '#FFFFFF',
  },

  // Editorial Discovery Hero (No next session)
  editorialHero: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    padding: spacing.xl,
    minHeight: 180,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    ...e(3),
  },
  ambientOrbRight: {
    position: 'absolute',
    top: -30,
    right: -25,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  ambientOrbLeft: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  editorialContent: {
    gap: 6,
    zIndex: 2,
  },
  editorialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  editorialBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#FFFFFF',
    letterSpacing: 0.7,
  },
  editorialTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 27,
    marginTop: 2,
  },
  editorialSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 17,
  },
  editorialCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  editorialCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...e(1),
  },
  editorialCtaBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#083A85',
  },
  editorialExploreChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  editorialExploreChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
  },

  // Real-Time Inline Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    height: 50,
    gap: spacing.sm,
    ...e(1),
  },
  searchBarFocused: {
    borderColor: c.primary,
    backgroundColor: c.elevated,
    ...e(2),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.text,
    paddingVertical: 0,
  },
  searchDoneBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  searchDoneText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  // Live Suggestions Card
  suggestionsCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii['2xl'],
    padding: spacing.md,
    gap: spacing.md,
    ...e(2),
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  suggestionsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  suggestionsHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: c.primary,
  },
  suggestionSection: {
    gap: spacing.xs,
  },
  suggestionSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  liveSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  liveSuggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: radii.lg,
  },
  liveSuggestionThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: c.surfaceMuted,
  },
  watchLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: radii.full,
  },
  watchLiveBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radii.md,
  },
  suggestionThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: c.surfaceMuted,
  },
  suggestionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
  },
  suggestionItemTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  suggestionItemSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  suggestionRating: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#F59E0B',
  },
  suggestionPrice: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  suggestionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionStylePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  suggestionStylePillText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  clearRecentsText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  recentSearchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  recentSearchText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
  },
  suggestionEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  suggestionEmptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  suggestionEmptySub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Category Selector Rail
  categoryRail: {
    gap: spacing.xs,
    paddingRight: spacing.xl,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.full,
    ...e(1),
  },
  categoryChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
    ...e(2),
  },
  categoryIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  categoryChipText: {
    fontFamily: fonts.regular,
    color: c.text,
  },
  categoryChipTextActive: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveDotSmallActive: {
    backgroundColor: '#FFFFFF',
  },

  // Bento 2x2 Action Hub
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  bentoCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    minHeight: 126,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    ...e(1),
  },
  bentoCardLarge: {
    width: '23%',
  },
  bentoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bentoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  bentoBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  bentoLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  bentoBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: spacing.md,
  },
  bentoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  bentoTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: c.text,
    letterSpacing: -0.2,
  },
  bentoSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    marginTop: 2,
  },
  bentoArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Luxury Trio Stats KPI Card
  statsBar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...e(1),
  },
  statsSegment: {
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.lg,
    justifyContent: 'space-between',
  },
  statsSegmentPressed: {
    backgroundColor: c.surfaceMuted,
  },
  statsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statsIconBox: {
    width: 26,
    height: 26,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: c.borderSoft,
    marginVertical: spacing.xs,
  },
  statsNum: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: c.text,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  statsLabel: {
    fontFamily: fonts.regular,
    fontWeight: '600',
    fontSize: 11,
    color: c.textMuted,
    marginTop: 2,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    marginTop: 1,
  },
  sectionLinkWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  sectionLink: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize: 13,
    color: c.primary,
    letterSpacing: -0.2,
  },

  // Featured Photographers Rail
  photographersRail: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingBottom: spacing.xs,
  },
  featuredPhotogCardWrap: {
    flexShrink: 0,
  },
  photographersEmptyCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    ...e(1),
  },
  photographersEmptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
    marginTop: 4,
  },
  photographersEmptySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  photographersEmptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    marginTop: 6,
  },
  photographersEmptyActionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Commercial Activity & Bookings Hub
  activityFeedCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(1),
  },
  feedFilterTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 6,
    backgroundColor: c.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
  },
  filterPillActive: {
    backgroundColor: c.surface,
    ...e(1),
  },
  filterPillText: {
    fontFamily: fonts.regular,
    fontWeight: '600',
    fontSize: 12,
    color: c.textMuted,
  },
  filterPillTextActive: {
    fontFamily: fonts.bold,
    color: c.text,
  },

  // Feed Item Row
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    gap: 12,
  },
  feedRowLast: {
    borderBottomWidth: 0,
  },
  feedRowPressed: {
    backgroundColor: c.surfaceMuted,
  },

  // Left Visual Anchor (Date Box or Activity Icon)
  dateBadge: {
    width: 44,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: 'rgba(8, 58, 133, 0.08)',
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  dateBadgeLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dateMonthText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: c.primary,
    letterSpacing: 0.6,
  },
  dateMonthTextLive: {
    color: '#EF4444',
  },
  dateDayText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    lineHeight: 18,
  },
  activityIconBox: {
    width: 44,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Center Content
  feedContentCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  feedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
    letterSpacing: -0.2,
  },
  feedSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedSubText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    lineHeight: 15,
  },
  feedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  feedMetaText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },

  // Right Status & Trailing
  feedRightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  feedPriceText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: c.text,
  },
  feedPillLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  feedLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  feedLivePillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#EF4444',
    letterSpacing: 0.4,
  },
  feedPillPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  feedPaidPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#10B981',
    letterSpacing: 0.4,
  },
  feedPillBooked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  feedBookedPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#3B82F6',
    letterSpacing: 0.4,
  },
  feedActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  feedActionPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
  },

  // Empty State
  feedEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 6,
  },
  feedEmptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  feedEmptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    textAlign: 'center',
  },

  // Card Footer Action
  cardFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: c.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  cardFooterText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
}));
