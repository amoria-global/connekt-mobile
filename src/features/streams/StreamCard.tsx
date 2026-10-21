/**
 * One stream in the list: its photograph, where it is in its life (live, upcoming, replay), the facts a person scans
 * for (who, when, how many watched) and one clear target. Night-studio kit, flat card, no glass over media.
 * Status is a word and an icon, never colour alone, and every line wraps instead of being cut.
 */
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { LivePill, LiveTwinkle } from '@/components/ui/live';
import { Card, StatusBadge } from '@/features/photographer/kit';
import { Thumb } from '@/features/photographer/homeParts';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import type { Stream } from './api';
import { viewersLabel, whenLabel } from './streamsModel';

type IconName = keyof typeof Ionicons.glyphMap;

export function StreamCard({
  stream,
  onPress,
  footer,
  messages,
  videos,
  unviewed,
}: {
  stream: Stream;
  onPress: () => void;
  footer?: ReactNode;
  /** Totals resolved with the chat history (the feed's own totals can be 0 when the history has rows). */
  messages?: number;
  videos?: number;
  /** Video messages not opened yet, the web's "N new" badge. */
  unviewed?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const when = whenLabel(stream);
  const audience = viewersLabel(stream.viewerCount, stream.phase);
  const facts: { key: string; icon: IconName; text: string }[] = [
    ...(stream.photographerName ? [{ key: 'who', icon: 'camera-outline' as const, text: stream.photographerName }] : []),
    ...(when ? [{ key: 'when', icon: 'calendar-outline' as const, text: when }] : []),
    ...(audience ? [{ key: 'aud', icon: 'eye-outline' as const, text: audience }] : []),
    ...(stream.duration ? [{ key: 'dur', icon: 'time-outline' as const, text: stream.duration }] : []),
    ...(messages ? [{ key: 'msg', icon: 'chatbubble-outline' as const, text: `${messages.toLocaleString('en-US')} ${messages === 1 ? 'message' : 'messages'}` }] : []),
    ...(videos ? [{ key: 'vid', icon: 'videocam-outline' as const, text: `${videos.toLocaleString('en-US')} ${videos === 1 ? 'video message' : 'video messages'}` }] : []),
  ];
  const live = stream.phase === 'live';
  const a11y = [stream.title, live ? 'Live now' : stream.phase === 'ended' ? 'Replay' : 'Upcoming', ...(unviewed ? [`${unviewed} new videos`] : []), ...facts.map((f) => f.text)].join(', ');

  return (
    <LiveTwinkle active={live} radius={radii.lg}>
      <Card style={styles.card}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Thumb uri={stream.thumbnail} size={88} />
          <View style={styles.text}>
            {live ? (
              <LivePill label="Live now" size="sm" sparkle />
            ) : stream.phase === 'ended' ? (
              <StatusBadge label="Replay" tone="neutral" icon="play-circle-outline" />
            ) : (
              <StatusBadge label="Upcoming" tone="info" icon="time-outline" />
            )}
            {unviewed ? <StatusBadge label={`${unviewed} new`} tone="error" icon="ellipse" /> : null}
            <Text style={styles.title} numberOfLines={4} maxFontSizeMultiplier={1.6}>
              {stream.title}
            </Text>
            {stream.eventType ? (
              <Text style={styles.type} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                {stream.eventType}
              </Text>
            ) : null}
            {facts.map((f) => (
              <View key={f.key} style={styles.fact}>
                <Ionicons name={f.icon} size={13} color={colors.textMuted} />
                <Text style={styles.factText} maxFontSizeMultiplier={1.6}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </Card>
    </LiveTwinkle>
  );
}

const useStyles = makeStyles((c) => ({
  card: { marginHorizontal: 0, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, minHeight: 56 },
  pressed: { opacity: 0.85 },
  text: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  title: { color: c.text, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  type: { color: c.textMuted, fontSize: 12 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 1 },
  factText: { flex: 1, minWidth: 0, color: c.textMuted, fontSize: 13, lineHeight: 18 },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
}));
