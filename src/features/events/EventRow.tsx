/**
 * A compact event row: a date tile, the title, "Sun · 1:00 PM · Kabuga", and a chevron. Ongoing rows carry a cyan
 * ONGOING pill; a booking still waiting for the photographer's reply says so, so it is never lost among the upcoming.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { DateTile } from '@/components/ui/DateTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { alpha, fontSize, fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { clock12, parseDayKey } from '@/features/photographer/schedule';
import type { EventItem } from './types';
import { dayOf, type StatusKey } from './eventsFilter';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function EventRow({ event, status, pending, onOpen, onLongPress, onAccept, onDecline }: { event: EventItem; status: StatusKey; pending?: boolean; onOpen: () => void; onLongPress?: () => void; onAccept?: () => void; onDecline?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const day = dayOf(event);
  const date = day ? parseDayKey(day) : null;
  const meta = [date ? WEEKDAY[date.getDay()] : '', clock12(event.startTime), event.location].filter(Boolean).join(' · ');
  const live = status === 'ongoing';
  return (
    <Pressable
      onPress={onOpen}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}. ${meta}. ${live ? 'Ongoing' : status === 'completed' ? 'Completed' : pending ? 'Awaiting your reply' : 'Upcoming'}`}
      accessibilityHint={onLongPress ? 'Press and hold for more actions' : undefined}
      style={({ pressed }) => [styles.row, live && styles.live, pressed && { opacity: 0.85 }]}
    >
      {date ? <DateTile date={date} variant="glass" size={64} /> : <View style={styles.noDate} />}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {pending && (onAccept || onDecline) ? (
          <View style={styles.reply}>
            {onAccept ? <Button title="Accept" variant="primary" onPress={onAccept} accessibilityLabel="Accept" style={styles.replyBtn} /> : null}
            {onDecline ? <Button title="Deny" variant="outline" onPress={onDecline} accessibilityLabel="Deny" style={styles.replyBtn} /> : null}
          </View>
        ) : null}
      </View>
      {live ? <StatusChip label="ONGOING" tone="active" /> : pending ? <StatusChip label="PENDING" tone="pending" /> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface },
    live: { borderColor: alpha(c.active, 0.6) },
    noDate: { width: 46, height: 46 },
    body: { flex: 1, gap: 2 },
    title: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.md },
    meta: { color: c.textMuted, fontSize: fontSize.sm },
    reply: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    replyBtn: { flex: 1, minHeight: 36 },
  }),
);
