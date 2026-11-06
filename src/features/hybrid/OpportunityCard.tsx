/**
 * One Post My Event opportunity for a photographer, in the Home screen's style: glass card, Space Grotesk numbers, blue
 * for the action, magenta for the opportunity, amber for the deadline, green only for a good match.
 *
 * The card previews; it does not accept. "View offer" opens Offer details, where the photographer accepts or rejects.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, type TranslationKey } from '@/store/language';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme, type Palette } from '@/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { chipColors } from '@/components/ui/StatusChip';
import type { OpportunityDeliveryPolicy, PhotographerOpportunity } from './types';
import { countdownString, EventStartClock, useCountdown } from './hybridUi';
import { parseOpportunityOfferBrief } from './offerBrief';
import { cardLines, formatMoney, matchChips, titleCasePlace } from './offerPresentation';

type Props = {
  opportunity: PhotographerOpportunity;
  onApprove: (item: PhotographerOpportunity, deliveryPolicy?: OpportunityDeliveryPolicy) => void;
  onReject: (item: PhotographerOpportunity) => void;
  onPress?: (item: PhotographerOpportunity) => void;
  busy?: boolean;
  highlighted?: boolean;
};

const STATUS = (c: Palette): Record<string, { key: TranslationKey; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> => ({
  INVITED: { key: 'oppInvited', color: c.accent, icon: 'radio-outline' },
  APPROVED: { key: 'oppApproved', color: c.primary, icon: 'hourglass-outline' },
  SELECTED: { key: 'oppSelected', color: c.success, icon: 'trophy-outline' },
  NOT_SELECTED: { key: 'oppNotSelected', color: c.textMuted, icon: 'person-outline' },
  REJECTED: { key: 'oppRejected', color: c.textMuted, icon: 'close-circle-outline' },
  EXPIRED: { key: 'oppExpired', color: c.textMuted, icon: 'timer-outline' },
  WITHDRAWN: { key: 'oppWithdrawn', color: c.textMuted, icon: 'lock-closed-outline' },
  NO_LONGER_AVAILABLE: { key: 'oppNoLongerAvailable', color: c.textMuted, icon: 'calendar-outline' },
});

const prettyDate = (d: string, lang: string) => {
  const t = Date.parse(`${d.slice(0, 10)}T00:00:00`);
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) : d;
};

export function OpportunityCard({ opportunity: o, onApprove, onReject, onPress, busy, highlighted }: Props) {
  const { colors, gradients, isDark } = useTheme();
  const { language, t } = useLanguage();
  const styles = useStyles();
  const open = (o.status ?? 'INVITED') === 'INVITED';
  const left = useCountdown(open ? o.responseDeadlineAt || o.candidateExpiresAt : null);
  const expired = open && !!left?.done;
  const urgent = open && !!left && !left.done && left.ms < 5 * 60 * 1000;
  const st = STATUS(colors)[o.status ?? 'INVITED'] ?? STATUS(colors).INVITED;
  const brief = parseOpportunityOfferBrief(o);
  const clientOffer = o.maxBudget || o.minBudget || null;
  const dateText = o.eventDate ? prettyDate(o.eventDate, language) : t('oppDateTbc');
  const title = titleCasePlace([o.eventType || o.eventTitle || 'Event', o.city].filter(Boolean).join(' · '));
  const lines = cardLines(o, brief, dateText);
  const { chips, more } = matchChips(o.matchReasons, 3, o.city);
  // The deadline is amber; the last five minutes turn red because the offer is about to disappear.
  const timer = chipColors(colors, gradients, isDark, urgent ? 'error' : 'pending');

  // The card never accepts. Without a details screen to open (no onPress), View offer keeps the old behaviour.
  const viewOffer = () => (onPress ? onPress(o) : onApprove(o, 'CLIENT'));
  const decline = () => (onPress ? onPress(o) : onReject(o));

  return (
    <GlassCard style={[styles.card, (open || highlighted) && { borderColor: colors.accent }, highlighted && { borderWidth: 2 }]}>
      <Pressable
        onPress={onPress ? () => onPress(o) : undefined}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `${title}. ${t(st.key)}` : undefined}
        style={styles.body}
      >
        <View style={styles.header}>
          <IconTile icon={st.icon} tone={open ? 'accent' : 'neutral'} />
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: st.color }]}>{open ? 'NEW NEARBY OPPORTUNITY' : t(st.key).toUpperCase()}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          {open && left ? (
            <View
              style={[styles.timer, { backgroundColor: timer.bg }]}
              accessibilityLabel={`Time left to answer ${countdownString(left)}`}
            >
              <Ionicons name="stopwatch-outline" size={13} color={timer.fg} />
              <Text style={[styles.timerText, { color: timer.fg }]}>{countdownString(left, '00m 00s')}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.offerRow}>
          <View style={styles.offerText}>
            <Text style={styles.offerEyebrow}>{"CLIENT'S OFFER"}</Text>
            <Text style={styles.offerAmount}>{clientOffer != null ? formatMoney(clientOffer) : 'Flexible budget'}</Text>
            <Text style={styles.offerSub}>Full requested scope</Text>
          </View>
          <View style={styles.kind}>
            <Text style={styles.kindText}>{brief.clientTypeLabel}</Text>
          </View>
        </View>

        <View style={styles.list}>
          {lines.map((l) => (
            <View key={l.icon} style={styles.line}>
              <Ionicons name={l.icon} size={16} color={colors.textMuted} style={styles.lineIcon} />
              <Text style={styles.lineLeft}>{l.left}</Text>
              {l.right ? <Text style={styles.lineRight}>{l.right}</Text> : null}
            </View>
          ))}
        </View>

        {chips.length ? (
          <View style={styles.chips}>
            {chips.map((c) => {
              const ok = chipColors(colors, gradients, isDark, 'success');
              return (
                <View key={c} style={[styles.chip, { backgroundColor: ok.bg }]}>
                  <Ionicons name="checkmark" size={13} color={ok.fg} />
                  <Text style={[styles.chipText, { color: ok.fg }]}>{c}</Text>
                </View>
              );
            })}
            {more > 0 ? (
              <View style={[styles.chip, styles.chipMore]}>
                <Text style={styles.chipMoreText}>{`+${more} more`}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {o.status === 'APPROVED' && o.deliveryPolicy ? (
          <View style={styles.policyPill}>
            <Ionicons
              name={o.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE' ? 'cube-outline' : 'checkmark-circle-outline'}
              size={14}
              color={colors.primary}
            />
            <Text style={styles.policyPillText}>
              {o.deliveryPolicy === 'PHOTOGRAPHER_PACKAGE'
                ? 'Accepted with your package delivery policy'
                : "Accepted with client's delivery schedule"}
            </Text>
          </View>
        ) : null}

        {o.status === 'SELECTED' && o.eventStartAt ? <EventStartClock startAt={o.eventStartAt} /> : null}
      </Pressable>

      {open ? (
        <View style={styles.actions}>
          <View style={styles.declineWrap}>
            <GhostButton title="Decline" onPress={decline} disabled={busy || expired} accessibilityLabel={t('oppNotThisTime')} />
          </View>
          <View style={styles.viewWrap}>
            <PrimaryButton
              title={expired ? t('oppTimeIsUp') : 'View offer'}
              onPress={viewOffer}
              loading={busy}
              disabled={expired}
              accessibilityLabel="View offer"
            />
          </View>
        </View>
      ) : null}
      {open ? <Text style={styles.note}>Accepting happens on Offer details, after you review scope and policies.</Text> : null}
    </GlassCard>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.xl, borderWidth: 1, borderColor: c.stroke, padding: spacing.md, gap: spacing.md },
  body: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8 },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: spacing.md, borderRadius: radii.full },
  timerText: { fontFamily: fonts.bold, fontSize: fontSize.xs },
  offerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  offerText: { flex: 1, gap: 2 },
  offerEyebrow: { fontFamily: fonts.semibold, fontSize: fontSize.xs, letterSpacing: 0.8, color: c.textMuted },
  offerAmount: { fontFamily: fonts.display, fontSize: fontSize['2xl'], color: c.text },
  offerSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textSoft },
  kind: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
  kindText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.textSoft },
  list: { borderRadius: radii.md, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.well, padding: spacing.md, gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lineIcon: { marginTop: 2 },
  lineLeft: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, lineHeight: 20, color: c.textSoft },
  lineRight: { flexShrink: 1, maxWidth: '55%', textAlign: 'right', fontFamily: fonts.semibold, fontSize: fontSize.sm, lineHeight: 20, color: c.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, paddingHorizontal: spacing.md, borderRadius: radii.full },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.xs },
  chipMore: { backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
  chipMoreText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.textSoft },
  policyPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.well },
  policyPillText: { flex: 1, fontFamily: fonts.medium, fontSize: fontSize.sm, color: c.primary },
  actions: { flexDirection: 'row', gap: spacing.md },
  declineWrap: { flex: 1 },
  viewWrap: { flex: 1.5 },
  note: { fontFamily: fonts.regular, fontSize: fontSize.xs, lineHeight: 18, color: c.textMuted },
}));
