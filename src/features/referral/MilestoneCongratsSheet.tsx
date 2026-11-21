/**
 * The milestone congratulations sheet. Shown once on the next app open after a milestone (10, 20, 30, 40) is unlocked:
 * the server reports it in stats.unlocked until it is acknowledged here. The wording uses the newly unlocked rate.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { fonts, makeStyles, spacing, useTheme } from '@/theme';
import { congratsText, FeeCap } from './congratsModel';
import { acknowledgeMilestone, useMilestoneCopy, type ReferralStats, type UnlockedMilestone } from './referral';

export function MilestoneCongratsSheet({
  unlocked,
  onInviteMore,
  onViewMilestones,
  onDismiss,
}: {
  unlocked: UnlockedMilestone | null;
  onInviteMore: () => void;
  onViewMilestones: () => void;
  onDismiss: () => void;
}) {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const { colors } = useTheme();
  if (!unlocked) return null;
  const t = congratsText(m, unlocked);
  const maxed = unlocked.milestone >= FeeCap;
  return (
    <Sheet visible title={m.congratsEyebrow} onClose={onDismiss}>
      <View style={styles.wrap} testID="congrats-sheet">
        <Ionicons name="sparkles" size={40} color={colors.accent} />
        <Text style={styles.eyebrow}>{m.congratsEyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">{t.title}</Text>
        <Text style={styles.body}>{t.body}</Text>
        {maxed ? null : <PrimaryButton title={m.inviteMore} onPress={onInviteMore} />}
        <GhostButton title={m.viewMilestones} onPress={onViewMilestones} />
      </View>
    </Sheet>
  );
}

/** The unlocked milestone from the loaded stats; dismissing acknowledges it so the server never offers it again. */
export function useMilestoneCongrats(stats: ReferralStats | null): { unlocked: UnlockedMilestone | null; dismiss: () => void } {
  const [hidden, setHidden] = useState(false);
  const unlocked = !hidden && stats?.unlocked ? stats.unlocked : null;
  useEffect(() => {
    if (unlocked) void acknowledgeMilestone();
  }, [unlocked?.milestone]); // eslint-disable-line react-hooks/exhaustive-deps
  return { unlocked, dismiss: () => setHidden(true) };
}

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: c.textMuted, textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 22, fontWeight: '800', textAlign: 'center', color: c.text },
  body: { fontSize: 13.5, lineHeight: 19, textAlign: 'center', color: c.textMuted },
}));
