import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';
import { acceptEventBooking, declineEventBooking } from './api';
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
  onChanged,
}: {
  event: EventItem;
  /**
   * Photographer-tab variant exposes the per-status CTAs from the web
   * (Create Album button, Album Sent chip, plus inline Accept / Decline
   * for pending bookings). Default variant stays clean for the Client /
   * Coordinator events feed.
   */
  variant?: 'default' | 'photographer';
  /**
   * Fires after a successful Accept / Decline so the parent list can
   * refresh — the booking row mutates the event's booking status and
   * the card needs to swap its CTAs.
   */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const isPhotog = variant === 'photographer';
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const bookingStatus = (event.bookingStatus ?? '').toUpperCase();
  const status = (event.status ?? '').toUpperCase();
  const streamStatus = (event.streamStatus ?? '').toLowerCase();
  // "Album sent" → the completion flow is past the album hand-off.
  // Treated as: the event is completed AND the customer's completion
  // status has moved past AWAITING_REVIEW. We rely on event.status
  // because the EventItem mapper already collapses backend variants.
  const albumSent = isPhotog && (status === 'COMPLETED' || status === 'AWAITING_REVIEW');
  const canCreateAlbum =
    isPhotog && (status === 'COMPLETED' || bookingStatus === 'ACCEPTED');
  const isPending = isPhotog && bookingStatus === 'PENDING';
  const canGoLive =
    isPhotog &&
    bookingStatus === 'ACCEPTED' &&
    streamStatus !== 'ended' &&
    status !== 'COMPLETED' &&
    status !== 'AWAITING_REVIEW' &&
    status !== 'CANCELLED';

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
         * Photographer-tab per-status CTAs and badges. Each row
         * mirrors the salo-run photographer/events card actions:
         *   • PENDING booking → Pending Approval chip + "Review →"
         *     hint so the photographer knows the card is actionable.
         *   • ACCEPTED + stream not ended → Go Live + Create Album
         *   • COMPLETED / AWAITING_REVIEW → "Album sent" chip.
         */}
        {isPhotog ? (
          <View style={styles.ctaRow}>
            {isPending ? (
              // Inline Accept / Decline so the photographer doesn't have
              // to open the event detail. e.stopPropagation() blocks the
              // outer Pressable on the list from also navigating.
              <>
                <Pressable
                  style={[styles.cta, { backgroundColor: colors.success }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    setBusy('accept');
                    acceptEventBooking(event.id)
                      .then(() => onChanged?.())
                      .catch(() => Alert.alert('Could not accept', 'Please try again.'))
                      .finally(() => setBusy(null));
                  }}
                  disabled={busy !== null}
                >
                  {busy === 'accept' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={14} color="#fff" />
                      <Text style={styles.ctaText}>Accept</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.cta, { backgroundColor: colors.error }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    Alert.alert('Decline booking?', 'This will notify the client.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Decline',
                        style: 'destructive',
                        onPress: () => {
                          setBusy('decline');
                          declineEventBooking(event.id, 'Not available')
                            .then(() => onChanged?.())
                            .catch(() => Alert.alert('Could not decline', 'Please try again.'))
                            .finally(() => setBusy(null));
                        },
                      },
                    ]);
                  }}
                  disabled={busy !== null}
                >
                  {busy === 'decline' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={14} color="#fff" />
                      <Text style={styles.ctaText}>Decline</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
            {canGoLive ? (
              <Pressable
                style={[styles.cta, { backgroundColor: '#7C3AED' }]}
                onPress={() => router.push(`/event/${event.id}` as never)}
              >
                <Ionicons name="videocam" size={14} color="#fff" />
                <Text style={styles.ctaText}>Live Stream</Text>
              </Pressable>
            ) : null}
            {albumSent ? (
              <View style={styles.sentChip}>
                <Ionicons name="checkmark-done" size={12} color="#fff" />
                <Text style={styles.sentChipText}>Album sent</Text>
              </View>
            ) : canCreateAlbum ? (
              <Pressable
                style={styles.cta}
                onPress={() => router.push(`/album/new?eventId=${event.id}` as never)}
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
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.md,
  },
  pendingChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
