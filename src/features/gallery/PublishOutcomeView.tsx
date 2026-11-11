/**
 * What the photographer sees once a PAID album is saved: either "your photos are being prepared for Find my photos"
 * with how far indexing got, or the real reason it is not listed with "Retry publishing" (publish only, no re-upload).
 */
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { LISTING_NOTE, type PublishOutcome } from './sellPhotos';

export function PublishOutcomeView({
  outcome,
  title,
  retrying,
  onRetry,
  onView,
  onShare,
}: {
  outcome: PublishOutcome;
  title: string;
  retrying: boolean;
  onRetry: () => void;
  onView: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const failed = outcome.state === 'failed';
  const tone = failed ? colors.error : outcome.warn ? colors.warning : colors.success;
  return (
    <View style={styles.wrap} testID="publish-outcome" accessibilityLiveRegion="polite">
      <View style={[styles.badge, { backgroundColor: tone }]}>
        {retrying ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Ionicons name={failed ? 'alert' : outcome.warn ? 'alert' : 'checkmark'} size={30} color={colors.textOnPrimary} />
        )}
      </View>
      <Text style={styles.headline}>{outcome.headline}</Text>
      <Text style={styles.album} numberOfLines={2}>{title}</Text>
      <View style={[styles.status, { borderColor: tone }]}>
        <Text style={styles.statusText} testID="publish-status">{retrying ? 'Preparing your photos. This can take a minute for a large album.' : outcome.status}</Text>
      </View>
      {failed ? null : <Text style={styles.note}>{LISTING_NOTE}</Text>}
      <View style={styles.buttons}>
        {failed ? <PrimaryButton title="Retry publishing" onPress={onRetry} loading={retrying} /> : null}
        {failed ? null : <PrimaryButton title="Share album" onPress={onShare} />}
        <GhostButton title="View album" onPress={onView} disabled={retrying} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  headline: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, color: c.text, textAlign: 'center' },
  album: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, textAlign: 'center' },
  status: { alignSelf: 'stretch', borderWidth: 1, borderRadius: radii.md, padding: spacing.md, backgroundColor: c.surface },
  statusText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.text },
  note: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17, color: c.textMuted, textAlign: 'center' },
  buttons: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
}));
