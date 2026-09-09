import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import type { Stream } from './api';

export function StreamCard({ stream }: { stream: Stream }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        {stream.thumbnail ? (
          <Image source={{ uri: stream.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="videocam" size={28} color={colors.textMuted} />
          </View>
        )}
        {stream.isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {stream.title}
        </Text>
        {stream.photographerName ? (
          <Text style={styles.meta} numberOfLines={1}>
            {stream.photographerName}
          </Text>
        ) : null}
        {stream.viewerCount != null ? (
          <View style={styles.viewers}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text style={styles.meta}>{stream.viewerCount} watching</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: '100%', height: 160, backgroundColor: c.surfaceMuted },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  liveBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: c.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  liveText: { color: c.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  body: { padding: spacing.lg, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  meta: { fontSize: fontSize.sm, color: c.textMuted },
  viewers: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
}));
