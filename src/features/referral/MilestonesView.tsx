/**
 * The Milestones screen: current rate, progress and the money example (in the photographer's currency), the
 * "How referrals count" card, the five tier rows, Invite with the code, the referral list with three checks each,
 * pending and review counts, Program rules and a store stats strip. Loading, empty and error states are designed.
 */
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { PrimaryButton, GhostButton } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { copyText } from '@/utils/copyText';
import { formatMoney } from '@/utils/format';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { HowItCountsCard } from './HowReferralsCount';
import { ReferralSheet } from './ReferralSheet';
import { cardModel, extraOnSample, rowView, sampleSale, tierRows } from './milestoneModel';
import { fillCopy, type MilestoneCopy } from './referralCopy';
import { POLICY_PATH, useMilestoneCopy, useReferralStats, useReferralStrings, type ReferralRow, type ReferralStats } from './referral';
import { useStoreStats } from './useStoreStats';

function Check({ done, label }: { done: boolean; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.check} accessibilityLabel={`${label}: ${done ? '✓' : '…'}`}>
      <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={done ? colors.success : colors.textMuted} />
      <Text style={[styles.checkText, done && styles.checkDone]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function ReferralRowItem({ r, m }: { r: ReferralRow; m: MilestoneCopy }) {
  const styles = useStyles();
  const v = rowView(r);
  return (
    <View style={styles.refRow} testID="referral-row">
      <View style={styles.refTop}>
        <Text style={styles.refName} numberOfLines={1}>{r.name}</Text>
        <StatusChip compact tone={v.tone} label={m[v.statusKey]} />
      </View>
      <View style={styles.checks}>
        <Check done={r.signedUp} label={m.checkSignedUp} />
        <Check done={r.verifiedPublished} label={m.checkVerified} />
        <Check done={r.firstSale} label={m.checkFirstSale} />
      </View>
      <Text style={styles.hint} testID="referral-hint">{m[v.hintKey]}</Text>
    </View>
  );
}

export function MilestonesBody({
  stats,
  currency,
  onInvite,
  onCopyCode,
  onRules,
  store,
}: {
  stats: ReferralStats;
  currency: string | null;
  onInvite: () => void;
  onCopyCode: () => void;
  onRules: () => void;
  store: ReturnType<typeof useStoreStats>;
}) {
  const m = useMilestoneCopy();
  const rs = useReferralStrings();
  const styles = useStyles();
  const model = cardModel(stats);
  const sale = sampleSale(currency);
  const extra = extraOnSample(model.share, model.nextShare, sale.amount);
  const rows = tierRows(stats.qualifying);
  const money = (n: number | null) => (n == null ? '-' : formatMoney(n, store.currency ?? currency ?? ''));

  return (
    <View style={styles.stack}>
      <View style={styles.hero} testID="ms-hero">
        <Text style={styles.eyebrow}>{m.yourRate}</Text>
        <Text style={styles.heroRate}>{model.share}% <Text style={styles.heroOf}>{m.ofEvery}</Text></Text>
        <Text style={styles.progressText}>{fillCopy(m.progressQualified, { n: model.qualified, target: model.target })}</Text>
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: model.target, now: Math.min(model.qualified, model.target) }}>
          <View style={[styles.barFill, { width: `${model.pct}%` }]} />
        </View>
        {model.maxRate ? (
          <Text style={styles.unlock} testID="ms-max">{m.maxTitle}</Text>
        ) : (
          <>
            <Text style={styles.unlock}>{fillCopy(m.moreReferralsUnlock, { more: model.more, rate: model.nextShare ?? '' })}</Text>
            {extra != null ? (
              <Text style={styles.sub} testID="ms-example">
                {fillCopy(m.moneyExample, { amount: formatMoney(extra, sale.currency), sale: formatMoney(sale.amount, sale.currency) })}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <HowItCountsCard minUsd={stats.minQualifyingUsd} />

      <View style={styles.block}>
        <Text style={styles.h2} accessibilityRole="header">{m.earningsMilestones}</Text>
        {rows.map((t) => {
          const exact = t.from === t.to;
          const range = exact ? fillCopy(m.tierExact, { n: t.from }) : fillCopy(m.tierRange, { from: t.from, to: t.to });
          const caption =
            t.state === 'current' ? (t.max ? m.tierMax : fillCopy(m.tierCurrent, { n: model.qualified, target: model.target }))
            : t.state === 'done' ? (t.from === 0 ? m.tierStarting : m.tierLocked)
            : t.max ? m.tierMax : fillCopy(m.tierMoreToUnlock, { more: Math.max(0, t.from - model.qualified) });
          return (
            <View
              key={t.share}
              style={[styles.tier, t.state === 'current' && styles.tierCurrent, t.max && styles.tierMax]}
              testID={`tier-${t.share}`}
              accessibilityLabel={`${t.share}%, ${range}, ${t.state}`}
            >
              <Text style={styles.tierShare}>{t.share}%</Text>
              <View style={styles.tierText}>
                <Text style={styles.tierRange}>{range}</Text>
                <Text style={styles.sub}>{t.state === 'done' && t.from === 0 ? m.tierStarting : caption}</Text>
              </View>
              <Ionicons
                name={t.state === 'done' ? 'checkmark' : t.state === 'current' ? 'radio-button-on' : t.max ? 'sparkles' : 'lock-closed-outline'}
                size={16}
                color={t.state === 'done' ? styles.okIcon.color : t.state === 'current' ? styles.hotIcon.color : styles.mutedIcon.color}
              />
            </View>
          );
        })}
      </View>

      {model.canInvite ? (
        <View style={styles.inviteRow}>
          <View style={styles.flex}><PrimaryButton title={m.invite} onPress={onInvite} /></View>
          {stats.code ? <GhostButton title={stats.code} onPress={onCopyCode} accessibilityLabel={`${m.copy} ${stats.code}`} /> : null}
        </View>
      ) : null}
      <Text style={styles.counts} testID="ms-counts">
        {[fillCopy(m.pendingCount, { n: stats.pending }), fillCopy(m.reviewCount, { n: stats.underReview })].join(' · ')}
      </Text>
      <Pressable onPress={onRules} accessibilityRole="link" hitSlop={10}>
        <Text style={styles.link}>{m.programRules}</Text>
      </Pressable>

      <View style={styles.block}>
        <Text style={styles.h2} accessibilityRole="header">{rs.ui.referralsTitle}</Text>
        {stats.referrals.length === 0 ? (
          <View style={styles.empty} testID="ms-empty">
            <Text style={styles.emptyTitle}>{m.emptyTitle}</Text>
            <Text style={styles.sub}>{m.emptyBody}</Text>
          </View>
        ) : (
          stats.referrals.map((r, i) => <ReferralRowItem key={`${r.name}-${i}`} r={r} m={m} />)
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.h2} accessibilityRole="header">{m.storeStats}</Text>
        {store.loading ? (
          <Skeleton height={64} radius={radii.lg} />
        ) : (
          <View style={styles.statGrid} testID="ms-store-stats">
            <View style={styles.stat}><Text style={styles.statValue}>{money(store.monthEarnings)}</Text><Text style={styles.sub}>{m.statEarnings}</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{store.photosSold ?? '-'}</Text><Text style={styles.sub}>{m.statPhotosSold}</Text></View>
            <View style={styles.stat}><Text style={styles.statValue}>{money(store.available)}</Text><Text style={styles.sub}>{m.statAvailable}</Text></View>
            {store.topAlbum ? <View style={styles.stat}><Text style={styles.statValue} numberOfLines={1}>{store.topAlbum}</Text><Text style={styles.sub}>{m.statTopAlbum}</Text></View> : null}
          </View>
        )}
      </View>
    </View>
  );
}

export function MilestonesScreenContent() {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const router = useRouter();
  const { stats, status, reload } = useReferralStats();
  const store = useStoreStats();
  const [invite, setInvite] = useState(false);

  if (status === 'loading' && !stats) {
    return (
      <View style={styles.stack} accessibilityLabel="Loading" testID="ms-loading">
        <Skeleton height={150} radius={radii.lg} />
        <Skeleton height={120} radius={radii.lg} />
        <Skeleton height={200} radius={radii.lg} />
      </View>
    );
  }
  if (!stats) {
    return <ErrorState card={false} title={m.loadError} message="" onRetry={reload} />;
  }
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <MilestonesBody
        stats={stats}
        currency={store.currency}
        store={store}
        onInvite={() => setInvite(true)}
        onCopyCode={() => { if (stats.code) void copyText(stats.code); }}
        onRules={() => router.push(POLICY_PATH as Href)}
      />
      <ReferralSheet visible={invite} onClose={() => setInvite(false)} />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  stack: { gap: spacing.lg },
  flex: { flex: 1 },
  hero: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface },
  eyebrow: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: c.textMuted, textTransform: 'uppercase' },
  heroRate: { fontFamily: fonts.display, fontSize: 40, fontWeight: '800', color: c.text },
  heroOf: { fontSize: 13.5, fontWeight: '500', color: c.textMuted },
  progressText: { fontSize: 14, fontWeight: '700', color: c.text },
  bar: { height: 8, borderRadius: 999, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: c.accent },
  unlock: { fontSize: 14, fontWeight: '800', color: c.text },
  sub: { fontSize: 12.5, lineHeight: 17, color: c.textMuted },
  block: { gap: spacing.sm },
  h2: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: c.text },
  tier: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
  tierCurrent: { borderColor: c.accent, backgroundColor: c.surface },
  tierMax: { borderColor: c.accent },
  tierShare: { width: 52, fontFamily: fonts.display, fontSize: 18, fontWeight: '800', color: c.text },
  tierText: { flex: 1, gap: 1 },
  tierRange: { fontSize: 13.5, fontWeight: '700', color: c.text },
  okIcon: { color: c.success },
  hotIcon: { color: c.accent },
  mutedIcon: { color: c.textMuted },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counts: { textAlign: 'center', fontSize: 12.5, color: c.textMuted },
  link: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: c.link },
  refRow: { gap: 6, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
  refTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  refName: { flex: 1, fontSize: 14, fontWeight: '700', color: c.text },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkText: { fontSize: 12, color: c.textMuted },
  checkDone: { color: c.text },
  hint: { fontSize: 12.5, color: c.textMuted },
  empty: { alignItems: 'center', gap: 4, paddingVertical: spacing.lg },
  emptyTitle: { fontSize: 14.5, fontWeight: '700', color: c.text },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 2, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: c.border },
  statValue: { fontFamily: fonts.display, fontSize: 16, fontWeight: '800', color: c.text },
}));
