import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { Text, View } from 'react-native';
import { ActionButton } from '@/features/photographer/kit';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

/**
 * What the viewer shows when an event is over or was cancelled. The cover sits on its own at the top with a status pill,
 * and the words and the two actions sit below it on the card's own surface. They used to be laid over the photograph,
 * where a busy picture ran through the text and the buttons and each button was a different width and off centre.
 * Both actions are full width and equal, the main one first. A cancelled event offers only its details, because there
 * are no photos to find.
 */
export function EndedEventCard({
  cover,
  cancelled,
  message,
  onDetails,
  onFindPhotos,
}: {
  cover: ImageSource | number;
  cancelled: boolean;
  /** Why photos are worth a look (ended events only). */
  message?: string;
  onDetails: () => void;
  onFindPhotos?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const headline = cancelled ? 'This event was cancelled' : 'This event has ended';
  return (
    <View style={styles.card} accessibilityLabel={headline}>
      <View style={styles.media}>
        <Image source={cover} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors />
        <View style={styles.pill}>
          <Ionicons name={cancelled ? 'close-circle' : 'checkmark-circle'} size={14} color="#FFFFFF" />
          <Text style={styles.pillText}>{cancelled ? 'Cancelled' : 'Ended'}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.headline} accessibilityRole="header">
          {headline}
        </Text>
        {message && !cancelled ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
        <View style={styles.actions}>
          {!cancelled && onFindPhotos ? (
            <ActionButton label="Find my photos" icon="scan-outline" variant="primary" onPress={onFindPhotos} style={styles.action} />
          ) : null}
          <ActionButton label="View event details" icon="eye-outline" variant="secondary" onPress={onDetails} style={styles.action} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: 'hidden' },
  media: { aspectRatio: 16 / 9, backgroundColor: c.surfaceMuted },
  cover: { width: '100%', height: '100%' },
  pill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(7,8,13,0.78)',
  },
  pillText: { color: '#FFFFFF', fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.4, textTransform: 'uppercase' },
  body: { padding: spacing.lg, gap: spacing.md },
  headline: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  message: { fontSize: fontSize.sm, lineHeight: 20 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  action: { alignSelf: 'stretch' },
}));
