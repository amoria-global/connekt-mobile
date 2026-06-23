import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
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
export function EventCard({ event }: { event: EventItem }) {
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
});
