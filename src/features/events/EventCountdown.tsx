/**
 * The "Starts in" block at the top of the date and time card: four equal tiles (days, hours, minutes, seconds) under a
 * small eyebrow, then a hairline that hands over to the date. It owns the one-second clock, so only this block
 * re-renders each second and not the screen above it. It counts to the event's own start (its timezone, Kigali unless
 * the event says otherwise), so a viewer in another timezone sees the same countdown. It renders nothing once the start
 * has passed, and the card below it then reads as the plain date card.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/store/language';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { eventStartMs, type StatusInput } from './eventStatus';

export function msToCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function EventCountdown({ event }: { event: StatusInput }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const startMs = eventStartMs(event);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);
  if (startMs === null || startMs - now <= 0) return null;
  const c = msToCountdown(startMs - now);
  const cells: { n: number; unit: string }[] = [
    ...(c.days > 0 ? [{ n: c.days, unit: c.days === 1 ? t('b4_daySingular') : t('b4_dayPlural') }] : []),
    { n: c.hours, unit: t('b4_hr') },
    { n: c.minutes, unit: t('b4_min') },
    { n: c.seconds, unit: t('b4_sec') },
  ];
  return (
    <View style={styles.wrap}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="hourglass-outline" size={13} color={colors.primary} />
        <Text style={styles.eyebrow}>{t('b4_startsIn')}</Text>
      </View>
      <View style={styles.grid} accessible accessibilityRole="timer" accessibilityLabel={`${t('b4_startsIn')} ${cells.map((x) => `${x.n} ${x.unit}`).join(', ')}`}>
        {cells.map((x) => (
          <View key={x.unit} style={styles.cell}>
            <Text style={styles.num}>{pad(x.n)}</Text>
            <Text style={styles.unit}>{x.unit}</Text>
          </View>
        ))}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    eyebrow: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
    grid: { flexDirection: 'row', gap: spacing.sm },
    cell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, backgroundColor: c.well },
    num: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text, fontVariant: ['tabular-nums'] },
    unit: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.stroke, marginTop: spacing.xs },
  }),
);
