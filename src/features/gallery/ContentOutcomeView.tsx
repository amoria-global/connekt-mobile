/**
 * What the photographer sees once a content (Stock & content) album is created: submitted for review, or saved as a
 * draft with a "Submit for review" action. It never talks about face search: content albums are reviewed, then sold
 * per photo in the stock catalogue, and are never face-scanned.
 */
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import type { ContentOutcome } from './sellPhotos';

export function ContentOutcomeView({
  outcome,
  title,
  submitting,
  onSubmit,
  onView,
}: {
  outcome: ContentOutcome;
  title: string;
  submitting: boolean;
  onSubmit: () => void;
  onView: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const submitted = outcome.state === 'submitted';
  const failed = outcome.state === 'draft-submit-failed';
  const tone = submitted ? colors.success : failed ? colors.warning : colors.primary;
  return (
    <View style={styles.wrap} testID="content-outcome" accessibilityLiveRegion="polite">
      <View style={[styles.badge, { backgroundColor: tone }]}>
        <Ionicons name={failed ? 'alert' : submitted ? 'checkmark' : 'document-text-outline'} size={30} color={colors.textOnPrimary} />
      </View>
      <Text style={styles.headline}>{outcome.headline}</Text>
      <Text style={styles.album} numberOfLines={2}>{title}</Text>
      <View style={[styles.status, { borderColor: tone }]}>
        <Text style={styles.statusText} testID="content-status">{outcome.status}</Text>
      </View>
      <View style={styles.buttons}>
        {submitted ? null : <PrimaryButton title="Submit for review" onPress={onSubmit} loading={submitting} />}
        {submitted ? <PrimaryButton title="View album" onPress={onView} /> : <GhostButton title="View album" onPress={onView} disabled={submitting} />}
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
  buttons: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
}));
