/**
 * Owner events dashboard — for the roles that CREATE events (Event
 * Coordinator, and reusable for Client). Mobile port of salo-run's
 * client / event-coordinator events page (they share one design):
 *
 *   • Header: eyebrow → "Events" → subtitle, with a "New event" button.
 *   • Stat strip: Total / Upcoming / Published / Completed.
 *   • Filter pills (All / Upcoming / Published / Past) with count badges +
 *     a search box.
 *   • Dark, image-led event cards with status + date pills, location,
 *     assigned-photographer line, and quick Edit / Share actions. Tapping
 *     a card opens the event detail (which carries the full Manage panel:
 *     publish, pause/resume, delete, confirm-done, …).
 *
 * Shares the visual language + Pragati Narrow type of the photographer
 * "Events & albums" dashboard.
 */
import { useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { colors, fonts, radii, spacing } from '@/theme';
import { listCoordinatorEvents, listEvents } from './api';
import type { EventItem } from './types';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=70';
const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';

type Filter = 'all' | 'upcoming' | 'published' | 'past';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const isPast = (e: EventItem, today: number) => {
  const t = e.eventDate ? new Date(e.eventDate).getTime() : NaN;
  return !Number.isNaN(t) && t < today;
};

function heroStatus(e: EventItem): { label: string; bg: string; fg: string } {
  const s = (e.status ?? '').toUpperCase();
  if (s === 'ONGOING' || s === 'IN_PROGRESS') return { label: 'ONGOING', bg: '#DBEAFE', fg: '#1D4ED8' };
  if (s === 'COMPLETED' || s === 'DONE') return { label: 'COMPLETED', bg: '#D1FAE5', fg: '#047857' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'CANCELLED', bg: '#FEE2E2', fg: '#B91C1C' };
  if (s === 'PAUSED') return { label: 'PAUSED', bg: '#E5E7EB', fg: '#374151' };
  if (e.published) return { label: 'PUBLISHED', bg: '#CCFBF1', fg: '#0F766E' };
  // An unpublished event is invisible on connekyt.com. Saying "UPCOMING" read
  // as though everything was fine, so owners never knew there was a step left.
  return { label: 'NOT PUBLISHED', bg: '#FEF3C7', fg: '#92400E' };
}

function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STAT_META = [
  { key: 'all', label: 'Total Events', accent: '#083A85', icon: 'calendar' },
  { key: 'upcoming', label: 'Upcoming', accent: '#3B82F6', icon: 'hourglass' },
  { key: 'published', label: 'Published', accent: '#10B981', icon: 'globe' },
  { key: 'completed', label: 'Completed', accent: '#8B5CF6', icon: 'checkmark-circle' },
] as const;

export function OwnerEventsDashboard({
  coordinator = false,
  topInset = 0,
}: {
  coordinator?: boolean;
  topInset?: number;
}) {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(
    coordinator ? listCoordinatorEvents : listEvents,
  );

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const events = data ?? [];
  const today = startOfToday();

  const stats = useMemo(() => {
    const c = { all: events.length, upcoming: 0, published: 0, completed: 0 };
    for (const e of events) {
      const s = (e.status ?? '').toUpperCase();
      if (e.published) c.published += 1;
      if (s === 'COMPLETED' || s === 'DONE') c.completed += 1;
      else if (!isPast(e, today)) c.upcoming += 1;
    }
    return c;
  }, [events, today]);

  const tabCounts = useMemo(() => {
    let upcoming = 0;
    let published = 0;
    let past = 0;
    for (const e of events) {
      if (e.published) published += 1;
      if (isPast(e, today)) past += 1;
      else upcoming += 1;
    }
    return { all: events.length, upcoming, published, past };
  }, [events, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'upcoming' && isPast(e, today)) return false;
      if (filter === 'past' && !isPast(e, today)) return false;
      if (filter === 'published' && !e.published) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.photographerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [events, filter, search, today]);

  const onShare = (e: EventItem) => {
    Share.share({ title: e.title, message: `Check out "${e.title}" on Connekyt\n${SHARE_BASE}${e.id}` }).catch(() => {});
  };

  const header = (
    <View style={{ paddingTop: topInset + spacing.md }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{coordinator ? 'COORDINATOR' : 'MY EVENTS'}</Text>
          <Text style={styles.h1}>Events</Text>
          <Text style={styles.subtitle}>Your bookings, sessions and live events.</Text>
        </View>
        <Pressable style={styles.newBtn} onPress={() => router.push('/event/new' as Href)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      </View>

      {/* Stat strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statStrip}>
        {STAT_META.map((s) => (
          <View key={s.key} style={styles.statCard}>
            <LinearGradient colors={[s.accent, '#F20C8F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.statAccent} />
            <View style={[styles.statIcon, { backgroundColor: `${s.accent}1A`, borderColor: `${s.accent}33` }]}>
              <Ionicons name={s.icon} size={16} color={s.accent} />
            </View>
            <View style={{ minWidth: 0 }}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statValue}>{stats[s.key]}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'upcoming', 'published', 'past'] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>{tabCounts[f]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search */}
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search events…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      renderItem={({ item }) => (
        <OwnerEventCard
          event={item}
          onOpen={() => router.push(`/event/${item.id}` as Href)}
          onEdit={() => router.push(`/event/new?editId=${item.id}` as Href)}
          onShare={() => onShare(item)}
        />
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : error ? (
          <View style={{ paddingTop: spacing.xl }}>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load events" message="Pull to refresh and try again." />
          </View>
        ) : (
          <View style={{ paddingTop: spacing.xl }}>
            <EmptyState
              icon="calendar-outline"
              title={search || filter !== 'all' ? 'No matching events' : 'No events yet'}
              message={
                search || filter !== 'all'
                  ? 'Try a different filter or search term.'
                  : 'Tap "New" to create your first event.'
              }
            />
          </View>
        )
      }
    />
  );
}

function OwnerEventCard({
  event,
  onOpen,
  onEdit,
  onShare,
}: {
  event: EventItem;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
}) {
  const pill = heroStatus(event);
  return (
    <Pressable style={styles.card} onPress={onOpen} android_ripple={{ color: 'rgba(255,255,255,0.06)' }}>
      <Image source={{ uri: event.coverImage || COVER_FALLBACK }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
      <LinearGradient
        colors={['rgba(4,10,26,0.55)', 'rgba(4,10,26,0.12)', 'rgba(4,10,26,0.9)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.cardTop}>
        <View style={styles.datePill}>
          <Ionicons name="calendar" size={11} color="#fff" />
          <Text style={styles.datePillText}>{fmtShortDate(event.eventDate) || 'No date'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusPillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="camera" size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.photographerName || 'No photographer assigned'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.actBtn, styles.actEdit]} onPress={onEdit}>
            <Ionicons name="create-outline" size={14} color="#fff" />
            <Text style={styles.actText}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actBtn, styles.actShare]} onPress={onShare}>
            <Ionicons name="share-social-outline" size={14} color="#fff" />
            <Text style={styles.actText}>Share</Text>
          </Pressable>
          <View style={styles.manageHint}>
            <Text style={styles.manageHintText}>Manage</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.lg },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: colors.accent, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 30, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radii.md,
    marginTop: 4,
  },
  newBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },

  statStrip: { gap: 10, paddingVertical: spacing.md },
  statCard: {
    width: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingTop: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  statAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  statIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  statValue: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, lineHeight: 26 },

  filterRow: { gap: 8, paddingBottom: spacing.md },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceMuted,
  },
  filterPillActive: { backgroundColor: colors.primary },
  filterText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSoft },
  filterTextActive: { color: '#fff' },
  filterBadge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full, backgroundColor: 'rgba(8,58,133,0.10)', alignItems: 'center' },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  filterBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  filterBadgeTextActive: { color: '#fff' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, padding: 0 },

  card: { height: 260, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: '#0B1B34', justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  datePillText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  statusPillText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4 },

  cardBottom: { padding: spacing.md, gap: 5 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', flex: 1 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md },
  actEdit: { backgroundColor: colors.primary },
  actShare: { backgroundColor: 'rgba(255,255,255,0.16)' },
  actText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  manageHint: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  manageHintText: { fontFamily: fonts.bold, fontSize: 13, color: 'rgba(255,255,255,0.9)' },
});
