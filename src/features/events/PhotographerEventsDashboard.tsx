/**
 * Photographer "Events & albums" dashboard — mobile port of
 * salo-run/app/pages/photographer/events.tsx.
 *
 * Matches the web layout 1:1, adapted for a phone:
 *   • Header: "LIBRARY" eyebrow → "Events & albums" → subtitle.
 *   • View toggle: Events / Albums / Photobooks / Content.
 *   • Stat strip: Total / Upcoming / Ongoing / Completed (accent-topped
 *     cards, horizontally scrollable).
 *   • Filter pills (All / Upcoming / Ongoing / Completed) with live count
 *     badges + a search box.
 *   • Dark, image-led event cards with the same overlays and per-status
 *     CTAs the web card exposes: Accept / Deny (pending), Live Stream,
 *     Create Album, Accepted chip, and the package badge.
 *   • Accept-booking confirmation sheet (green header, event summary,
 *     escrow note, Confirm Accept).
 *
 * Type is Pragati Narrow throughout, matching the web brand.
 */
import { useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useAsync } from '@/hooks/useAsync';
import { colors, fonts, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';
import {
  acceptEventBooking,
  declineEventBooking,
  listPhotographerEvents,
} from './api';
import type { EventItem } from './types';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=70';

type ViewTab = 'events' | 'albums' | 'photobooks' | 'content';
type EventFilter = 'all' | 'upcoming' | 'ongoing' | 'completed';
type PhotogStatus = 'pending' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

/** Collapse the many backend status strings into the web's 5 buckets. */
function statusOf(e: EventItem): PhotogStatus {
  switch ((e.status ?? '').toUpperCase()) {
    case 'PENDING':
    case 'PROPOSED':
    case 'ASSIGNED':
      return 'pending';
    case 'ONGOING':
    case 'IN_PROGRESS':
      return 'ongoing';
    case 'COMPLETED':
    case 'DONE':
    case 'AWAITING_REVIEW':
      return 'completed';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

const STATUS_PILL: Record<PhotogStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'PENDING' },
  upcoming: { bg: '#FACC15', fg: '#1A2E05', label: 'UPCOMING' },
  ongoing: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'ONGOING' },
  completed: { bg: '#D1FAE5', fg: '#047857', label: 'COMPLETED' },
  cancelled: { bg: '#FEE2E2', fg: '#B91C1C', label: 'CANCELLED' },
};

/** "8:20 PM" from an "HH:mm[:ss]" or ISO time. */
function fmtTime(t?: string): string {
  if (!t) return '';
  const hm = /^(\d{1,2}):(\d{2})/.exec(t);
  let h: number;
  let m: number;
  if (hm) {
    h = Number(hm[1]);
    m = Number(hm[2]);
  } else {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return '';
    h = d.getHours();
    m = d.getMinutes();
  }
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "Jun 26, 2026" (screenshot style). */
function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Events is the in-place default; the other three link to their existing
// (or newly-created) library screens.
const VIEW_TABS: { key: ViewTab; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = [
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'albums', label: 'Albums', icon: 'images', route: '/gallery' as Href },
  { key: 'photobooks', label: 'Photobooks', icon: 'book', route: '/photobooks' as Href },
  { key: 'content', label: 'Content', icon: 'newspaper', route: '/content-albums' as Href },
];

const STAT_META = [
  { key: 'all', label: 'Total Events', accent: '#083A85', icon: 'calendar' },
  { key: 'upcoming', label: 'Upcoming', accent: '#F59E0B', icon: 'hourglass' },
  { key: 'ongoing', label: 'Ongoing', accent: '#3B82F6', icon: 'radio' },
  { key: 'completed', label: 'Completed', accent: '#10B981', icon: 'checkmark-circle' },
] as const;

export function PhotographerEventsDashboard({ topInset = 0 }: { topInset?: number }) {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(listPhotographerEvents);

  const [view, setView] = useState<ViewTab>('events');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [acceptTarget, setAcceptTarget] = useState<EventItem | null>(null);
  const [declineTarget, setDeclineTarget] = useState<EventItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const events = data ?? [];

  const counts = useMemo(() => {
    const c = { all: events.length, upcoming: 0, ongoing: 0, completed: 0 };
    for (const e of events) {
      const s = statusOf(e);
      if (s === 'upcoming') c.upcoming += 1;
      else if (s === 'ongoing') c.ongoing += 1;
      else if (s === 'completed') c.completed += 1;
    }
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const s = statusOf(e);
      if (filter !== 'all' && s !== filter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.clientName ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [events, filter, search]);

  const onAcceptConfirmed = async (e: EventItem) => {
    setBusyId(e.id);
    try {
      await acceptEventBooking(e.id);
      setAcceptTarget(null);
      refresh();
    } catch {
      Alert.alert('Could not accept', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onDeclineConfirmed = async (e: EventItem) => {
    setBusyId(e.id);
    try {
      await declineEventBooking(e.id, declineReason);
      setDeclineTarget(null);
      setDeclineReason('');
      refresh();
    } catch {
      Alert.alert('Could not decline', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Streaming and albums both hang off the public event page, so the backend
   * only accepts them once the event is published. The photographer can't
   * publish it themselves — that's the event creator's call — so say so.
   */
  const requirePublished = (e: EventItem, action: string): boolean => {
    if (e.published) return true;
    Alert.alert(
      'Event not published yet',
      `${action} is only available for published events. Ask the event creator to publish "${e.title}" first.`,
    );
    return false;
  };

  const onLiveStream = (e: EventItem) => {
    if (!requirePublished(e, 'Live streaming')) return;
    router.push(`/stream/control/${e.id}` as Href);
  };

  const onCreateAlbum = (e: EventItem) => {
    if (!requirePublished(e, 'Album creation')) return;
    router.push(`/album/new?eventId=${e.id}` as Href);
  };

  const header = (
    <View style={{ paddingTop: topInset + spacing.md }}>
      {/* Title block */}
      <Text style={styles.eyebrow}>LIBRARY</Text>
      <Text style={styles.h1}>Events &amp; albums</Text>
      <Text style={styles.subtitle}>
        Manage your assigned events, live streams, and event lifecycle.
      </Text>

      {/* View toggle */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.viewTabs}
      >
        {VIEW_TABS.map((t) => {
          const active = view === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => (t.route ? router.push(t.route) : setView('events'))}
              style={[styles.viewTab, active && styles.viewTabActive]}
            >
              <Ionicons name={t.icon} size={15} color={active ? '#fff' : colors.textMuted} />
              <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {view === 'events' ? (
        <>
          {/* Stat strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statStrip}
          >
            {STAT_META.map((s) => (
              <View key={s.key} style={styles.statCard}>
                <LinearGradient
                  colors={[s.accent, '#F20C8F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.statAccent}
                />
                <View style={[styles.statIcon, { backgroundColor: `${s.accent}1A`, borderColor: `${s.accent}33` }]}>
                  <Ionicons name={s.icon} size={16} color={s.accent} />
                </View>
                <View style={{ minWidth: 0 }}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>{counts[s.key]}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'upcoming', 'ongoing', 'completed'] as const).map((f) => {
              const active = filter === f;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                  <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                      {counts[f]}
                    </Text>
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
        </>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <PhotographerEventCard
            event={item}
            busy={busyId === item.id}
            onOpen={() => router.push(`/event/${item.id}` as Href)}
            onAccept={() => setAcceptTarget(item)}
            onDecline={() => setDeclineTarget(item)}
            onLiveStream={() => onLiveStream(item)}
            onCreateAlbum={() => onCreateAlbum(item)}
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
                    : 'Events you get booked for will appear here.'
                }
              />
            </View>
          )
        }
      />

      <AcceptBookingSheet
        event={acceptTarget}
        busy={busyId === acceptTarget?.id}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => acceptTarget && onAcceptConfirmed(acceptTarget)}
      />

      <DeclineBookingSheet
        event={declineTarget}
        reason={declineReason}
        onChangeReason={setDeclineReason}
        busy={busyId === declineTarget?.id}
        onCancel={() => {
          setDeclineTarget(null);
          setDeclineReason('');
        }}
        onConfirm={() => declineTarget && onDeclineConfirmed(declineTarget)}
      />
    </>
  );
}

// ─── Event card ──────────────────────────────────────────────────────────

function PhotographerEventCard({
  event,
  busy,
  onOpen,
  onAccept,
  onDecline,
  onLiveStream,
  onCreateAlbum,
}: {
  event: EventItem;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onLiveStream: () => void;
  onCreateAlbum: () => void;
}) {
  const s = statusOf(event);
  const booking = (event.bookingStatus ?? '').toUpperCase();
  const pill = STATUS_PILL[s];
  const isPending = booking === 'PENDING';
  const isAccepted = booking === 'ACCEPTED';
  const canStream = event.hasLiveStream && (s === 'upcoming' || s === 'ongoing');
  const canCreateAlbum = s === 'completed' || isAccepted;
  const showStreamPill = event.hasLiveStream && s !== 'completed';

  return (
    <Pressable
      style={styles.card}
      onPress={onOpen}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
    >
      <Image
        source={{ uri: event.coverImage || COVER_FALLBACK }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={['rgba(4,10,26,0.55)', 'rgba(4,10,26,0.15)', 'rgba(4,10,26,0.88)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top row: date + status (left), stream (right) */}
      <View style={styles.cardTop}>
        <View style={styles.topLeft}>
          <View style={styles.datePill}>
            <Ionicons name="calendar" size={11} color="#fff" />
            <Text style={styles.datePillText}>{fmtShortDate(event.eventDate)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        {showStreamPill ? (
          <View style={styles.streamPill}>
            <Ionicons name="radio" size={11} color="#fff" />
            <Text style={styles.streamPillText}>STREAM</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom content */}
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {event.location ? (
          <View style={styles.locRow}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.locText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}

        {/* Client + time strip */}
        <View style={styles.clientRow}>
          <View style={styles.clientLeft}>
            {event.clientAvatar ? (
              <Image source={{ uri: event.clientAvatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(event.clientName || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.clientName} numberOfLines={1}>
              {event.clientName || 'Client'}
            </Text>
          </View>
          {event.startTime ? (
            <View style={styles.timePill}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.timeText}>{fmtTime(event.startTime)}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isPending ? (
            <>
              <Pressable
                style={[styles.actBtn, styles.actAccept, busy && styles.actBusy]}
                onPress={onAccept}
                disabled={busy}
              >
                <Ionicons name="checkmark-circle" size={13} color="#fff" />
                <Text style={styles.actText}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.actBtn, styles.actDeny, busy && styles.actBusy]}
                onPress={onDecline}
                disabled={busy}
              >
                <Ionicons name="close-circle" size={13} color="#fff" />
                <Text style={styles.actText}>Deny</Text>
              </Pressable>
            </>
          ) : (
            <>
              {canStream ? (
                <Pressable style={[styles.actBtn, styles.actStream]} onPress={onLiveStream}>
                  <Ionicons name="radio" size={13} color="#fff" />
                  <Text style={styles.actText}>Live Stream</Text>
                </Pressable>
              ) : null}
              {canCreateAlbum ? (
                <Pressable style={[styles.actBtn, styles.actAlbum]} onPress={onCreateAlbum}>
                  <Ionicons name="add-circle" size={13} color="#fff" />
                  <Text style={styles.actText}>Create Album</Text>
                </Pressable>
              ) : null}
              {isAccepted ? (
                <View style={[styles.actBtn, styles.actAcceptedChip]}>
                  <Ionicons name="checkmark-circle" size={13} color="#fff" />
                  <Text style={styles.actText}>Accepted</Text>
                </View>
              ) : null}
              {event.packageName ? (
                <View style={styles.pkgBadge}>
                  <Ionicons name="cube" size={12} color="#fff" />
                  <Text style={styles.pkgText}>{event.packageName}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ─── Accept-booking confirmation sheet ───────────────────────────────────

function AcceptBookingSheet({
  event,
  busy,
  onCancel,
  onConfirm,
}: {
  event: EventItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={() => !busy && onCancel()}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetIcon}>
            <Ionicons name="checkmark" size={30} color="#fff" />
          </View>
          <Text style={styles.sheetEyebrow}>CONFIRM ACCEPTANCE</Text>
          <Text style={styles.sheetTitle}>Accept booking</Text>

          {event ? (
            <View style={styles.sheetCard}>
              <Text style={styles.sheetCardEyebrow}>EVENT</Text>
              <Text style={styles.sheetEventTitle}>{event.title}</Text>
              <View style={styles.sheetMetaGrid}>
                <SheetMeta icon="calendar-outline" text={fmtShortDate(event.eventDate)} />
                <SheetMeta
                  icon="time-outline"
                  text={[fmtTime(event.startTime), fmtTime(event.endTime)].filter(Boolean).join(' · ')}
                />
                {event.clientName ? <SheetMeta icon="person-outline" text={event.clientName} /> : null}
                {event.location ? <SheetMeta icon="location-outline" text={event.location} /> : null}
                {event.packageName ? <SheetMeta icon="cube-outline" text={event.packageName} /> : null}
              </View>
            </View>
          ) : null}

          <View style={styles.sheetTerms}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={styles.sheetTermsText}>
              100% paid upfront by the client, held in escrow and released upon event completion.
            </Text>
          </View>

          <Text style={styles.sheetNote}>
            By accepting, you confirm your availability. The client is notified and a payment is initiated.
          </Text>

          <View style={styles.sheetActions}>
            <Pressable style={[styles.sheetBtn, styles.sheetCancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.sheetBtn, styles.sheetConfirm]} onPress={onConfirm} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.sheetConfirmText}>Confirm accept</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Decline-booking reason sheet ────────────────────────────────────────

function DeclineBookingSheet({
  event,
  reason,
  onChangeReason,
  busy,
  onCancel,
  onConfirm,
}: {
  event: EventItem | null;
  reason: string;
  onChangeReason: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={() => !busy && onCancel()}>
        <Pressable style={styles.declineSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.declineTitle}>Decline booking</Text>
          <Text style={styles.declineHint}>
            Share a short reason so {event?.clientName || 'the client'} knows why you&apos;re not taking
            this on.
          </Text>
          <Input
            placeholder="e.g. Schedule conflict, location too far, etc."
            value={reason}
            onChangeText={onChangeReason}
            multiline
            style={styles.declineInput}
          />
          <Button title="Submit decline" onPress={onConfirm} loading={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.sheetMeta}>
      <Ionicons name={icon} size={13} color={colors.accent} />
      <Text style={styles.sheetMetaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.lg },

  // Header
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  h1: { fontFamily: fonts.bold, fontSize: 30, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, marginTop: 2, lineHeight: 20 },

  viewTabs: { gap: 6, paddingVertical: spacing.md },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  viewTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  viewTabText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  viewTabTextActive: { color: '#fff' },

  // Stats
  statStrip: { gap: 10, paddingBottom: spacing.md },
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
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  statValue: { fontFamily: fonts.bold, fontSize: 24, color: colors.text, lineHeight: 26 },

  // Filters
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
  filterBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(8,58,133,0.10)',
    alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  filterBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  filterBadgeTextActive: { color: '#fff' },

  // Search
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
    marginBottom: spacing.xs,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, padding: 0 },

  // Card
  card: {
    height: 300,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#0B1B34',
    justifyContent: 'space-between',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  datePillText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  statusPillText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4 },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  streamPillText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.4 },

  cardBottom: { padding: spacing.md, gap: 6 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  locText: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', flex: 1 },

  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  clientLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  clientName: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.9)', flexShrink: 1 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  timeText: { fontFamily: fonts.bold, fontSize: 12, color: 'rgba(255,255,255,0.95)' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  actText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  actBusy: { opacity: 0.6 },
  actAccept: { backgroundColor: '#10B981', flex: 1 },
  actDeny: { backgroundColor: '#EF4444', flex: 1 },
  actStream: { backgroundColor: '#8B5CF6' },
  actAlbum: { backgroundColor: colors.primary },
  actAcceptedChip: { backgroundColor: '#10B981' },
  pkgBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  pkgText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },

  // Accept sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,26,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  sheetIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sheetEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: '#10B981', letterSpacing: 1 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  sheetCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: 6,
  },
  sheetCardEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: colors.accent, letterSpacing: 1 },
  sheetEventTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  sheetMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  sheetMetaText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSoft, flex: 1 },
  sheetTerms: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sheetTermsText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.primary, lineHeight: 18 },
  sheetNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  sheetActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: spacing.lg },
  sheetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radii.md,
  },
  sheetCancel: { backgroundColor: colors.surfaceMuted },
  sheetCancelText: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSoft },
  sheetConfirm: { backgroundColor: '#10B981' },
  sheetConfirmText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },

  // Decline sheet
  declineSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  declineTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  declineHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  declineInput: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
});
