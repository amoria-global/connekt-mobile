/**
 * Home card "Grow your store": the photographer's share of every photo sale, progress to the next milestone with a
 * bar, the Invite and Milestones actions and a "How referrals count" link. At 40 referrals it turns into the maximum
 * state ("90% unlocked · Maximum rate active", View sale earnings) and the Invite button is gone for good.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { HowItCountsSheet } from './HowReferralsCount';
import { cardModel } from './milestoneModel';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy, type ReferralStats } from './referral';

export function GrowYourStoreCard({
  stats,
  status,
  onInvite,
  onMilestones,
  onViewEarnings,
  onRetry,
}: {
  stats: ReferralStats | null;
  status: 'loading' | 'error' | 'ready';
  onInvite: () => void;
  onMilestones: () => void;
  onViewEarnings: () => void;
  onRetry: () => void;
}) {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const { colors } = useTheme();
  const [how, setHow] = useState(false);

  const header = (
    <View style={styles.top}>
      <IconTile icon="sparkles-outline" tone="accent" size="lg" />
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{m.growTitle}</Text>
        <Text style={styles.sub} numberOfLines={2}>{m.growSub}</Text>
      </View>
      <Pressable onPress={onMilestones} accessibilityRole="button" accessibilityLabel={m.milestones} hitSlop={10} testID="grow-milestones">
        <Text style={styles.link}>{m.milestones} ›</Text>
      </Pressable>
    </View>
  );

  if (status === 'loading' && !stats) {
    return (
      <View style={styles.card} accessibilityLabel="Loading" testID="grow-loading">
        {header}
        <Skeleton height={44} radius={radii.md} />
        <Skeleton height={44} radius={radii.md} />
      </View>
    );
  }
  if (!stats) {
    return (
      <View style={styles.card} testID="grow-error">
        {header}
        <Text style={styles.sub}>{m.loadError}</Text>
        <GhostButton title={m.retry} onPress={onRetry} />
      </View>
    );
  }

  const model = cardModel(stats);
  return (
    <View style={styles.card} testID="grow-card">
      {header}
      {model.maxRate ? (
        <View style={styles.maxBlock} testID="grow-max">
          <Text style={styles.maxText}>{m.maxTitle}</Text>
          <GhostButton title={m.viewSaleEarnings} onPress={onViewEarnings} />
        </View>
      ) : (
        <>
          <View style={styles.progressRow}>
            <View style={styles.rateBlock}>
              <Text style={styles.rate} testID="grow-rate">{model.share}%</Text>
              <Text style={styles.rateLabel}>{m.yourRate}</Text>
            </View>
            <View style={styles.progressBlock}>
              <Text style={styles.progressText} testID="grow-progress">{fillCopy(m.progress, { n: model.qualified, target: model.target })}</Text>
              <View
                style={styles.bar}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: model.target, now: Math.min(model.qualified, model.target) }}
              >
                <View style={[styles.barFill, { width: `${model.pct}%` }]} />
              </View>
              <Text style={styles.sub} testID="grow-more">{fillCopy(m.moreUnlock, { more: model.more, rate: model.nextShare ?? '' })}</Text>
            </View>
          </View>
          <Pressable onPress={() => setHow(true)} accessibilityRole="link" accessibilityLabel={m.howTitle} hitSlop={10} style={styles.howRow} testID="grow-how">
            <Ionicons name="information-circle-outline" size={15} color={colors.primary} />
            <Text style={styles.link}>{m.howTitle}</Text>
          </Pressable>
          <PrimaryButton title={m.invite} onPress={onInvite} />
        </>
      )}
      <HowItCountsSheet visible={how} onClose={() => setHow(false)} minUsd={stats.minQualifyingUsd} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleWrap: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 15.5, fontWeight: '700', color: c.text },
  sub: { fontSize: 12.5, lineHeight: 17, color: c.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: c.link },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  rateBlock: { alignItems: 'center', minWidth: 64 },
  rate: { fontFamily: fonts.display, fontSize: 30, fontWeight: '800', color: c.text },
  rateLabel: { fontSize: 11.5, color: c.textMuted },
  progressBlock: { flex: 1, gap: 6 },
  progressText: { fontSize: 13.5, fontWeight: '700', color: c.text },
  bar: { height: 8, borderRadius: 999, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: c.accent },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maxBlock: { gap: spacing.md },
  maxText: { fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: c.text },
}));
