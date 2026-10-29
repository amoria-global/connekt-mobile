/**
 * Date and time as one card: "Fri, 27 Nov 2026" over "4:11 PM · Kigali time (CAT)", with an Add to calendar button.
 * Extra rows (venue, capacity) the event page already showed sit under them in the same card.
 */
import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { fontSize, fontWeight, makeStyles, onFill, radii, spacing } from '@/theme';
import { calendarUrl, eventWhen, type WhenInput } from './eventWhen';

export function EventWhenCard({ event, title, location, children }: { event: WhenInput; title: string; location?: string | null; children?: ReactNode }) {
  const styles = useStyles();
  const when = eventWhen(event);
  const url = calendarUrl({ ...event, title, location });
  if (!when.date && !when.time) return children ? <View style={styles.card}>{children}</View> : null;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name="calendar-outline" size={18} color={onFill} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.date}>{when.date}</Text>
          {when.time ? <Text style={styles.time}>{when.time}</Text> : null}
        </View>
        {url ? (
          <Button
            title="Add to calendar"
            variant="outline"
            onPress={() => void Linking.openURL(url)}
            accessibilityLabel={`Add ${title} to your calendar`}
            style={styles.add}
          />
        ) : null}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: spacing.md, gap: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icon: { width: 36, height: 36, borderRadius: 11, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    date: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
    time: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 2 },
    add: { minWidth: 0, paddingHorizontal: spacing.md },
  }),
);
