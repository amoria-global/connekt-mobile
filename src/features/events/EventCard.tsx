import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';
import type { EventItem } from './types';

export function EventCard({ event }: { event: EventItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        <StatusPill status={event.status} />
      </View>

      {event.eventDate ? (
        <Row icon="calendar-outline" text={formatDate(event.eventDate)} />
      ) : null}
      {event.location ? <Row icon="location-outline" text={event.location} /> : null}
      {event.photographerName ? (
        <Row icon="camera-outline" text={event.photographerName} />
      ) : null}
    </View>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
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
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowText: { flex: 1, fontSize: fontSize.sm, color: colors.textSoft },
});
