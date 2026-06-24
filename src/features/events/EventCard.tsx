import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';
import type { EventItem } from './types';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=70';

/**
 * Event list card. Renders the cover photo above the meta strip so the
 * mobile list matches the public events grid on the web. When the
 * backend hasn't attached an event photo, we show a soft brand-colored
 * fallback so the layout stays consistent.
 */
export function EventCard({
  event,
  variant = 'default',
}: {
  event: EventItem;
  /**
   * Photographer-tab variant exposes the per-status CTAs from the web
   * (Create Album button, Album Sent chip). Default variant stays
   * clean for the Client / Coordinator events feed.
   */
  variant?: 'default' | 'photographer';
}) {
  const router = useRouter();
  const isPhotog = variant === 'photographer';
  const bookingStatus = (event.bookingStatus ?? '').toUpperCase();
  const status = (event.status ?? '').toUpperCase();
  // "Album sent" → the completion flow is past the album hand-off.
  // Treated as: the event is completed AND the customer's completion
  // status has moved past AWAITING_REVIEW. We rely on event.status
  // because the EventItem mapper already collapses backend variants.
  const albumSent = isPhotog && (status === 'COMPLETED' || status === 'AWAITING_REVIEW');
  const canCreateAlbum =
    isPhotog && (status === 'COMPLETED' || bookingStatus === 'ACCEPTED');

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: event.coverImage || COVER_FALLBACK }}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.scrim} pointerEvents="none" />
      <View style={styles.overlayTop}>
        {event.status ? <StatusPill status={event.status} /> : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {event.eventDate ? (
          <Row icon="calendar-outline" text={formatDate(event.eventDate)} />
        ) : null}
        {event.location ? <Row icon="location-outline" text={event.location} /> : null}
        {event.photographerName ? (
          <Row icon="camera-outline" text={event.photographerName} />
        ) : null}

        {/*
         * Photographer-tab per-status CTAs.
         *   • Pending booking → Accept / Decline (route to event detail
         *     where the dedicated photographer-actions panel handles it).
         *   • Accepted / completed → Create Album (route to /album/new
         *     pre-filled with eventId).
         *   • Already sent → green "Album Sent" chip (read-only).
         */}
        {isPhotog ? (
          <View style={styles.ctaRow}>
            {albumSent ? (
              <View style={styles.sentChip}>
                <Ionicons name="checkmark-done" size={12} color="#fff" />
                <Text style={styles.sentChipText}>Album sent</Text>
              </View>
            ) : canCreateAlbum ? (
              <Pressable
                style={styles.cta}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push(`/album/new?eventId=${event.id}` as never);
                }}
              >
                <Ionicons name="add-circle-outline" size={14} color="#fff" />
                <Text style={styles.ctaText}>Create Album</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.rowText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 160, backgroundColor: colors.surfaceMuted },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  overlayTop: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
  },
  body: { padding: spacing.lg, gap: spacing.xs },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  rowText: { flex: 1, fontSize: fontSize.sm, color: colors.textSoft },

  ctaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.md,
  },
  ctaText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
  },
  sentChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
