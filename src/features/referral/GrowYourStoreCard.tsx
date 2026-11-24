/**
 * Home card "Grow your store", kept to one slim row so it does not crowd the Home screen: the current photo sale share,
 * progress to the next milestone and a thin bar. Tapping it opens the Milestones screen, which holds the Invite action,
 * the "How referrals count" explainer and the full tier list. At 40 referrals it shows "90% unlocked · Maximum rate
 * active" with a "View sale earnings" link.
 */
import { Pressable, Text, View } from 'react-native';
import { GhostButton } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/Skeleton';
import { fonts, makeStyles, radii, spacing } from '@/theme';
import { cardModel } from './milestoneModel';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy, type ReferralStats } from './referral';

export function GrowYourStoreCard({
  stats,
  status,
  onMilestones,
  onViewEarnings,
  onRetry,
}: {
  stats: ReferralStats | null;
  status: 'loading' | 'error' | 'ready';
  /** Still passed by Home; the Invite action now lives on the Milestones screen. */
  onInvite?: () => void;
  onMilestones: () => void;
  onViewEarnings: () => void;
  onRetry: () => void;
}) {
  const m = useMilestoneCopy();
  const styles = useStyles();

  if (status === 'loading' && !stats) {
    return (
      <View style={styles.card} accessibilityLabel="Loading" testID="grow-loading">
        <Text style={styles.title}>{m.growTitle}</Text>
        <Skeleton height={26} radius={radii.md} />
      </View>
    );
  }
  if (!stats) {
    return (
      <View style={styles.card} testID="grow-error">
        <Text style={styles.title}>{m.growTitle}</Text>
        <Text style={styles.sub}>{m.loadError}</Text>
        <GhostButton title={m.retry} onPress={onRetry} />
      </View>
    );
  }

  const model = cardModel(stats);
  return (
    <Pressable onPress={onMilestones} accessibilityRole="button" accessibilityLabel={m.milestones} style={styles.card} testID="grow-card">
      <View style={styles.top}>
        <IconTile icon="sparkles-outline" tone="accent" size="md" />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{m.growTitle}</Text>
          {model.maxRate ? (
            <Text style={styles.sub} numberOfLines={1} testID="grow-max">{m.maxTitle}</Text>
          ) : (
            <Text style={styles.sub} numberOfLines={1} testID="grow-progress">
              <Text style={styles.rate} testID="grow-rate">{model.share}%</Text>
              {'  ·  '}
              {fillCopy(m.progress, { n: model.qualified, target: model.target })}
            </Text>
          )}
        </View>
        {model.maxRate ? (
          <Pressable onPress={onViewEarnings} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.link}>{m.viewSaleEarnings} ›</Text>
          </Pressable>
        ) : (
          <Text style={styles.link}>{m.milestones} ›</Text>
        )}
      </View>
      {model.maxRate ? null : (
        <View
          style={styles.bar}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: model.target, now: Math.min(model.qualified, model.target) }}
        >
          <View style={[styles.barFill, { width: `${model.pct}%` }]} />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titleWrap: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: c.text },
  sub: { fontSize: 12.5, lineHeight: 17, color: c.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: c.link },
  rate: { fontWeight: '800', color: c.text },
  bar: { height: 6, borderRadius: 999, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: c.accent },
}));
