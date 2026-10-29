/**
 * One Post My Event opportunity for a photographer.
 * Renders the structured 4-step offer summary (Event details, Coverage & print
 * products, Delivery & budget) and opens the full comparison sheet on tap.
 */
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, type TranslationKey } from '@/store/language';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill, type Palette } from '@/theme';
import type { PhotographerOpportunity } from './types';
import { countdownString, EventStartClock, MODE_META, useCountdown } from './hybridUi';
import { parseOpportunityOfferBrief } from './offerBrief';

type Props = {
  opportunity: PhotographerOpportunity;
  onApprove: (item: PhotographerOpportunity) => void;
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
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : d;
};

const formatRwf = (n?: number | null) => `RWF ${Math.round(n || 450000).toLocaleString('en-US')}`;

export function OpportunityCard({ opportunity: o, onApprove, onReject, onPress, busy, highlighted }: Props) {
  const { colors } = useTheme();
  const { language, t } = useLanguage();
  const styles = useStyles();
  const open = (o.status ?? 'INVITED') === 'INVITED';
  const left = useCountdown(open ? o.responseDeadlineAt || o.candidateExpiresAt : null);
  const expired = open && !!left?.done;
  const urgent = open && !!left && !left.done && left.ms < 5 * 60 * 1000;
  const st = STATUS(colors)[o.status ?? 'INVITED'] ?? STATUS(colors).INVITED;
  const brief = parseOpportunityOfferBrief(o);
  const clientOfferRwf = o.maxBudget || o.minBudget || 450000;
  const dateStr = o.eventDate ? prettyDate(o.eventDate, language) : t('oppDateTbc');
  const locStr = o.venue ? `${o.venue}${o.city ? ` • ${o.city}` : ''}` : o.city || t('oppLocationSharedOnBooking');
  const eventTypeLabel = o.eventType || o.eventTitle || 'Event';

  return (
    <Pressable
      onPress={onPress ? () => onPress(o) : undefined}
      style={[styles.card, (open || highlighted) && { borderColor: MODE_META.HYBRID.color }, highlighted && { borderWidth: 2 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Ionicons name={st.icon} size={13} color={st.color} />
          <Text style={[styles.eyebrow, { color: st.color }]} numberOfLines={1}>{t(st.key).toUpperCase()}</Text>
        </View>
        {open && left ? (
          <View style={[styles.timer, urgent && { backgroundColor: colors.errorBg }]} accessibilityLabel={`Time left to answer ${countdownString(left)}`}>
            <Ionicons name="stopwatch-outline" size={12} color={urgent ? colors.error : MODE_META.HYBRID.color} />
            <Text style={[styles.timerText, urgent && { color: colors.error }]}>{countdownString(left, '00m 00s')}</Text>
          </View>
        ) : null}
      </View>

      {/* Requested service badge */}
      <View style={styles.requestedRow}>
        <View style={styles.requestedPill}>
          <Ionicons name="videocam-outline" size={13} color={colors.accent} />
          <Text style={styles.requestedText}>Requested: {brief.coverageModeLabel}</Text>
        </View>
        <Text style={styles.clientKindBadge}>{brief.clientTypeLabel}</Text>
      </View>

      {/* Client Offer Banner */}
      <View style={styles.offerBanner}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="wallet-outline" size={13} color={colors.accent} />
            <Text style={styles.offerEyebrow}>{"CLIENT'S OFFER"}</Text>
          </View>
          <Text style={styles.offerPrice}>{formatRwf(clientOfferRwf)}</Text>
          <Text style={styles.offerSub}>For the complete requested scope</Text>
        </View>
        {onPress ? (
          <View style={styles.compareChip}>
            <Text style={styles.compareChipText}>Compare package</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.primary} />
          </View>
        ) : null}
      </View>

      {/* 2-Column Compact Offer Summary Strip (matching uploaded_media_1) */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryCol}>
          <SummaryLine
            icon="calendar-outline"
            text={`${eventTypeLabel} • ${dateStr} • ${locStr} • ${brief.coverageHoursLabel}`}
          />
          <SummaryLine
            icon="camera-outline"
            text={`${brief.editedPhotosLabel} photos • ${brief.shortVideosLabel !== 'None' || brief.longVideosLabel !== 'None' ? `${brief.shortVideosLabel !== 'None' ? `Short ${brief.shortVideosLabel}` : ''}${brief.shortVideosLabel !== 'None' && brief.longVideosLabel !== 'None' ? ' / ' : ''}${brief.longVideosLabel !== 'None' ? `Long ${brief.longVideosLabel}` : ''}` : 'No video'} • ${brief.instantUpdatesLabel.startsWith('Yes') ? 'Instant updates' : 'No instant updates'}`}
          />
          <SummaryLine
            icon="book-outline"
            text={`Book: ${brief.photoBookLabel} • Album: ${brief.photoAlbumLabel} • Portraits: ${brief.wallPortraitsLabel}`}
          />
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryColRight}>
          <SummaryLine icon="document-text-outline" text={brief.digitalDeliveryLabel} />
          <SummaryLine icon="print-outline" text={brief.printDeliveryLabel} />
          <SummaryLine icon="cash-outline" text={formatRwf(clientOfferRwf)} strong />
        </View>
      </View>

      {o.matchReasons && o.matchReasons.length > 0 ? (
        <View style={styles.reasons}>
          {o.matchReasons.map((r) => (
            <View key={r} style={styles.reason}>
              <Ionicons name="checkmark" size={12} color={colors.success} />
              <Text style={styles.reasonText}>{r}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {o.status === 'SELECTED' && o.eventStartAt ? <EventStartClock startAt={o.eventStartAt} /> : null}

      {open ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onReject(o)}
            disabled={busy || expired}
            style={[styles.secondary, (busy || expired) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={t('oppNotThisTime')}
          >
            <Text style={styles.secondaryText}>{t('oppNotThisTime')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onApprove(o)}
            disabled={busy || expired}
            style={[styles.primary, (busy || expired) && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={t('oppYesAvailable')}
          >
            {busy ? <ActivityIndicator color={onFill} /> : (
              <>
                <Ionicons name="checkmark" size={18} color={onFill} />
                <Text style={styles.primaryText}>{expired ? t('oppTimeIsUp') : t('oppYesAvailable')}</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

function SummaryLine({
  icon,
  text,
  strong,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  strong?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.summaryLine}>
      <Ionicons name={icon} size={13} color={colors.primary} style={{ marginTop: 1 }} />
      <Text
        style={[styles.summaryText, strong && { fontWeight: fontWeight.extrabold, color: colors.text }]}
        numberOfLines={2}
      >
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: spacing.md, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.6 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, backgroundColor: 'rgba(242,12,143,0.10)' },
  timerText: { fontSize: 12, fontWeight: fontWeight.extrabold, color: c.accent, fontVariant: ['tabular-nums'] },
  requestedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  requestedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(242,12,143,0.12)', borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: c.accent },
  requestedText: { fontSize: 11, fontWeight: fontWeight.bold, color: c.text },
  clientKindBadge: { fontSize: 11, fontWeight: fontWeight.semibold, color: c.textMuted },
  offerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(242,12,143,0.08)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.primary,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  offerEyebrow: { fontSize: 10, fontWeight: fontWeight.extrabold, color: c.primary, letterSpacing: 0.5 },
  offerPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  offerSub: { fontSize: 11, color: c.textSoft },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
  },
  compareChipText: { fontSize: 11, fontWeight: fontWeight.bold, color: c.primary },
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  summaryCol: { flex: 1.4, gap: 6 },
  summaryColRight: { flex: 1, gap: 6 },
  summaryDivider: { width: 1, backgroundColor: c.border },
  summaryLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  summaryText: { fontSize: 11, color: c.textSoft, flex: 1, lineHeight: 15 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  reasonText: { fontSize: 11, color: c.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { flex: 1.4, minHeight: 48, borderRadius: radii.md, backgroundColor: c.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
  secondary: { flex: 1, minHeight: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.textSoft, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  disabled: { opacity: 0.5 },
}));
