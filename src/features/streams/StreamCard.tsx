import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { LivePill, LiveTwinkle } from '@/components/ui/live';
import type { Stream } from './api';

export function StreamCard({ stream }: { stream: Stream }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const initial = (stream.photographerName || stream.title || 'C').charAt(0).toUpperCase();

  return (
    <LiveTwinkle active={!!stream.isLive} radius={radii.xl}>
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        <Image
          source={stream.thumbnail ? { uri: stream.thumbnail } : EVENT_COVER_PLACEHOLDER}
          style={styles.thumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.thumbScrim} />

        {/* Top Badges */}
        <View style={styles.thumbTopRow}>
          {stream.isLive ? (
            <LivePill size="sm" sparkle />
          ) : (
            <View style={styles.offAirBadge}>
              <Text style={styles.offAirText}>STANDBY</Text>
            </View>
          )}

          {stream.viewerCount != null && stream.isLive ? (
            <View style={styles.viewerBadge}>
              <Ionicons name="eye" size={11} color="#fff" />
              <Text style={styles.viewerBadgeText}>{stream.viewerCount}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom thumbnail tag */}
        <View style={styles.thumbBottomRow}>
          <View style={styles.tuneInPill}>
            <Ionicons name="play" size={10} color="#fff" />
            <Text style={styles.tuneInText}>Watch Stream</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {stream.title}
        </Text>

        <View style={styles.creatorRow}>
          <View style={styles.creatorAvatar}>
            <Text style={styles.creatorAvatarText}>{initial}</Text>
          </View>
          <Text style={styles.creatorName} numberOfLines={1}>
            {stream.photographerName || 'Connekyt Broadcaster'}
          </Text>
          <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
        </View>
      </View>
    </View>
    </LiveTwinkle>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbWrap: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: '#071224',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 28, 0.35)',
  },
  thumbTopRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E11D48',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  offAirBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
  },
  offAirText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  viewerBadgeText: {
    color: '#fff',
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  thumbBottomRow: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
  },
  tuneInPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  tuneInText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  body: {
    padding: spacing.md,
    gap: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    letterSpacing: -0.2,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  creatorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
  },
  creatorName: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    flexShrink: 1,
  },
}));
