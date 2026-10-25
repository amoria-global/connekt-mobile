/**
 * One Post My Event opportunity for a photographer. Everything shown comes
 * from the server: duration, distance, what was matched and the deadline.
 * The internal match score never reaches this screen.
 */
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, type TranslationKey } from '@/store/language';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme, onFill, type Palette } from '@/theme';
import type { PhotographerOpportunity } from './types';
import { budgetLabel, countdownString, EventStartClock, hhmm, MODE_META, useCountdown } from './hybridUi';

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
  NO_LONGER_AVAILABLE: { key: 'oppNoLongerAvailable', color: c.textMuted, icon: 'calendar-outline' },});

const prettyDate = (d: string, lang: string) => {
  const t = Date.parse(`${d.slice(0, 10)}T00:00:00`);
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';
  return Number.isFinite(t) ? new Date(t).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : d;
};

export function OpportunityCard({ opportunity: o, onApprove, onReject, onPress, busy, highlighted }: Props) {
  const { colors } = useTheme();
  const { language, t } = useLanguage();
  const styles = useStyles();
  const open = (o.status ?? 'INVITED') === 'INVITED';
  const left = useCountdown(open ? o.responseDeadlineAt || o.candidateExpiresAt : null);
  const expired = open && !!left?.done;
  const urgent = open && !!left && !left.done && left.ms < 5 * 60 * 1000;
  const st = STATUS(colors)[o.status ?? 'INVITED'] ?? STATUS(colors).INVITED;
  const budget = budgetLabel(o.minBudget, o.maxBudget);

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

      <Text style={styles.title} numberOfLines={2}>{o.eventTitle}</Text>
      {o.eventType ? <Text style={styles.sub}>{o.eventType}</Text> : null}

      <View style={styles.facts}>
        <Fact icon="calendar-outline" text={o.eventDate ? prettyDate(o.eventDate, language) : t('oppDateTbc')} />
        <Fact icon="time-outline" text={`${hhmm(o.startTime)}${o.endTime ? `–${hhmm(o.endTime)}` : ''}${o.durationLabel ? ` · ${o.durationLabel}` : ''}`} strong={!!o.durationLabel} />
        <Fact icon="location-outline" text={`${o.city || o.venue || t('oppLocationSharedOnBooking')}${o.distanceLabel ? ` · ${o.distanceLabel}` : ''}`} />
        {budget ? <Fact icon="cash-outline" text={budget} /> : null}
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

      {o.instructions ? <Text style={styles.notes} numberOfLines={3}>“{o.instructions}”</Text> : null}

      {o.status === 'SELECTED' && o.eventStartAt ? <EventStartClock startAt={o.eventStartAt} /> : null}

      {open ? (
        <View style={styles.actions}>
          <Pressable onPress={() => onReject(o)} disabled={busy || expired} style={[styles.secondary, (busy || expired) && styles.disabled]}
            accessibilityRole="button" accessibilityLabel={t('oppNotThisTime')}>
            <Text style={styles.secondaryText}>{t('oppNotThisTime')}</Text>
          </Pressable>
          <Pressable onPress={() => onApprove(o)} disabled={busy || expired} style={[styles.primary, (busy || expired) && styles.disabled]}
            accessibilityRole="button" accessibilityLabel={t('oppYesAvailable')}>
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

function Fact({ icon, text, strong }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; strong?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={[styles.factText, strong && { fontWeight: fontWeight.bold, color: colors.text }]} numberOfLines={2}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.card, borderRadius: radii.xl, borderWidth: 1, borderColor: c.border, padding: spacing.lg, gap: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  eyebrow: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.6 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full, backgroundColor: 'rgba(242,12,143,0.10)' },
  timerText: { fontSize: 12, fontWeight: fontWeight.extrabold, color: c.accent, fontVariant: ['tabular-nums'] },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  sub: { fontSize: fontSize.xs, color: c.textMuted, marginTop: -4 },
  facts: { gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { fontSize: fontSize.sm, color: c.textSoft, flex: 1 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.successBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.full },
  reasonText: { fontSize: 11, color: c.text },
  notes: { fontSize: fontSize.xs, color: c.textSoft, backgroundColor: c.surfaceMuted, padding: spacing.sm, borderRadius: radii.md, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primary: { flex: 1.4, minHeight: 48, borderRadius: radii.md, backgroundColor: c.success, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
  secondary: { flex: 1, minHeight: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: c.textSoft, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  disabled: { opacity: 0.5 },
}));
