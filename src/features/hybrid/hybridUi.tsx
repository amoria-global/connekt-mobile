/**
 * Shared pieces for Post My Event screens, mirroring the web dashboard's
 * hybridUi: the two ways to book have the same names, colours and icons on
 * web, iOS and Android, so a client always knows which path they are on.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { useLanguage } from '@/store/language';
import { serverNowMs } from './api';
import type { RecommendationTier } from './types';

export const MODE_META = {
  DIRECT: {
    label: 'Find a Photographer',
    short: 'Direct booking',
    icon: 'search' as const,
    color: '#083A85',
    soft: 'rgba(8,58,133,0.10)',
    line: 'You browse photographers, pick one, and send them a request.',
  },
  HYBRID: {
    label: 'Post My Event',
    short: 'Matched booking',
    icon: 'radio-outline' as const,
    color: '#F20C8F',
    soft: 'rgba(242,12,143,0.10)',
    line: 'You describe the event; available photographers who fit say yes; you pick one.',
  },
};

const MODE_META_I18N = {
  fr: {
    DIRECT: {
      label: 'Trouver un photographe',
      short: 'Réservation directe',
      line: 'Parcourez les photographes, choisissez-en un et envoyez-lui une demande.',
    },
    HYBRID: {
      label: 'Publier mon événement',
      short: 'Réservation sur mesure',
      line: "Décrivez l'événement ; les photographes disponibles qui correspondent disent oui ; vous choisissez.",
    },
  },
  es: {
    DIRECT: {
      label: 'Buscar un fotógrafo',
      short: 'Reserva directa',
      line: 'Explora fotógrafos, elige uno y envíale una solicitud.',
    },
    HYBRID: {
      label: 'Publicar mi evento',
      short: 'Reserva emparejada',
      line: 'Describes el evento; los fotógrafos disponibles que encajan dicen que sí; tú eliges uno.',
    },
  },
} as const;

export type BookingModeKey = keyof typeof MODE_META;

export function modeOf(bookingMode?: string | null): BookingModeKey {
  return (bookingMode || '').toUpperCase() === 'HYBRID' ? 'HYBRID' : 'DIRECT';
}

export const TIER_META: Record<RecommendationTier, { label: string; hint: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  HIGH: { label: 'Top match', hint: 'Closest fit to what you asked for', color: '#047857', bg: 'rgba(16,185,129,0.12)', icon: 'sparkles' },
  MEDIUM: { label: 'Good match', hint: 'Fits most of your requirements', color: '#083A85', bg: 'rgba(8,58,133,0.10)', icon: 'thumbs-up-outline' },
  LOW: { label: 'Possible match', hint: 'Available, with fewer requirements matched', color: '#9A3412', bg: 'rgba(234,88,12,0.10)', icon: 'checkmark' },
};

const TIER_META_I18N: Record<'fr' | 'es', Record<RecommendationTier, { label: string; hint: string }>> = {
  fr: {
    HIGH: { label: 'Meilleure correspondance', hint: 'Le plus proche de ce que vous avez demandé' },
    MEDIUM: { label: 'Bonne correspondance', hint: 'Correspond à la plupart de vos critères' },
    LOW: { label: 'Correspondance possible', hint: 'Disponible, avec moins de critères remplis' },
  },
  es: {
    HIGH: { label: 'Mejor coincidencia', hint: 'El más cercano a lo que pediste' },
    MEDIUM: { label: 'Buena coincidencia', hint: 'Cumple la mayoría de tus requisitos' },
    LOW: { label: 'Coincidencia posible', hint: 'Disponible, con menos requisitos cumplidos' },
  },
};

const FRIENDLY_STATUS: Record<string, string> = {
  MATCHING: 'Matching',
  PUBLISHED_PENDING_ASSIGNMENT: 'Finding photographers',
  CANDIDATES_AVAILABLE: 'Photographers said yes',
  MATCHES_AWAITING_SELECTION: 'Choose your photographer',
  HYBRID_TIMEOUT: 'Matching ended',
  MATCHING_FAILED: 'No match yet',
  UNASSIGNED: 'Needs a photographer',
  BOOKED: 'Booked',
};

const FRIENDLY_STATUS_I18N: Record<'fr' | 'es', Record<string, string>> = {
  fr: {
    MATCHING: 'Recherche en cours',
    PUBLISHED_PENDING_ASSIGNMENT: 'Recherche de photographes',
    CANDIDATES_AVAILABLE: 'Des photographes ont dit oui',
    MATCHES_AWAITING_SELECTION: 'Choisissez votre photographe',
    HYBRID_TIMEOUT: 'Recherche terminée',
    MATCHING_FAILED: 'Aucune correspondance',
    UNASSIGNED: "Besoin d'un photographe",
    BOOKED: 'Réservé',
  },
  es: {
    MATCHING: 'Buscando coincidencias',
    PUBLISHED_PENDING_ASSIGNMENT: 'Buscando fotógrafos',
    CANDIDATES_AVAILABLE: 'Fotógrafos dijeron que sí',
    MATCHES_AWAITING_SELECTION: 'Elige a tu fotógrafo',
    HYBRID_TIMEOUT: 'Búsqueda finalizada',
    MATCHING_FAILED: 'Sin coincidencias aún',
    UNASSIGNED: 'Necesita un fotógrafo',
    BOOKED: 'Reservado',
  },
};

export function friendlyEventStatus(status?: string | null): string {
  const s = (status || '').toUpperCase();
  const lang = useLanguage.getState().language;
  if (lang !== 'en' && FRIENDLY_STATUS_I18N[lang]?.[s]) {
    return FRIENDLY_STATUS_I18N[lang][s];
  }
  return FRIENDLY_STATUS[s] || s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isOpenHybrid(bookingMode?: string | null, status?: string | null, hasPhotographer?: boolean): boolean {
  return modeOf(bookingMode) === 'HYBRID' && !hasPhotographer
    && ['MATCHING', 'PUBLISHED_PENDING_ASSIGNMENT', 'CANDIDATES_AVAILABLE', 'MATCHES_AWAITING_SELECTION', 'HYBRID_TIMEOUT', 'MATCHING_FAILED']
      .includes((status || '').toUpperCase());
}

/** Minutes between "HH:mm" times; an end at or before the start runs past midnight. */
export function durationBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export function durationText(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  const lang = useLanguage.getState().language;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hrUnit = lang === 'en' ? (h === 1 ? 'hr' : 'hrs') : 'h';
  const hrs = h === 0 ? '' : `${h} ${hrUnit}`;
  return m === 0 ? hrs : `${hrs ? hrs + ' ' : ''}${m} min`;
}

export function budgetLabel(min?: number | null, max?: number | null): string | null {
  const lang = useLanguage.getState().language;
  const f = (n: number) => Math.round(n).toLocaleString('en-US');
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${f(min)} - ${f(max)} RWF`;
  if (max != null) {
    if (lang === 'fr') return `Jusqu'à ${f(max)} RWF`;
    if (lang === 'es') return `Hasta ${f(max)} RWF`;
    return `Up to ${f(max)} RWF`;
  }
  if (lang === 'fr') return `À partir de ${f(min as number)} RWF`;
  if (lang === 'es') return `Desde ${f(min as number)} RWF`;
  return `From ${f(min as number)} RWF`;
}

export const hhmm = (t?: string) => (t ? t.slice(0, 5) : '');

/** Time left until an instant, on the server's clock; ticks every second. */
export function useCountdown(targetIso?: string | null) {
  const target = targetIso ? Date.parse(targetIso) : NaN;
  const [now, setNow] = useState(() => serverNowMs());
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = setInterval(() => setNow(serverNowMs()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!Number.isFinite(target)) return null;
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return { done: ms <= 0, ms, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function countdownString(c: ReturnType<typeof useCountdown>, doneText?: string): string {
  if (!c) return '';
  const lang = useLanguage.getState().language;
  const fallbackDone = lang === 'fr' ? 'Maintenant' : lang === 'es' ? 'Ahora' : 'Now';
  if (c.done) return doneText ?? fallbackDone;
  const dUnit = lang === 'fr' ? 'j' : 'd';
  if (c.days > 0) return `${pad(c.days)}${dUnit} ${pad(c.hours)}h ${pad(c.minutes)}m ${pad(c.seconds)}s`;
  if (c.hours > 0) return `${pad(c.hours)}h ${pad(c.minutes)}m ${pad(c.seconds)}s`;
  return `${pad(c.minutes)}m ${pad(c.seconds)}s`;
}

export function CountdownText({ to, doneText, style }: { to?: string | null; doneText?: string; style?: any }) {
  useLanguage();
  const c = useCountdown(to);
  if (!c) return null;
  return <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>{countdownString(c, doneText)}</Text>;
}

const useStyles = makeStyles((c) => ({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radii.full, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card, minHeight: 40,
  },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  chipTextOn: { color: '#fff' },
  card: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg,
    borderWidth: 2, borderColor: c.border, backgroundColor: c.card, alignItems: 'flex-start',
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  cardDesc: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2, lineHeight: 16 },
  clockWrap: { flexDirection: 'row', gap: 6 },
  clockCell: { minWidth: 54, alignItems: 'center', paddingVertical: 6, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  clockNum: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text, fontVariant: ['tabular-nums'] },
  clockLbl: { fontSize: 10, color: c.textMuted, fontWeight: fontWeight.bold },
  clockTitle: { fontSize: 11, fontWeight: fontWeight.extrabold, letterSpacing: 0.8, color: c.textMuted, marginBottom: 6 },
}));

export function ModeBadge({ mode }: { mode: BookingModeKey }) {
  const styles = useStyles();
  const { language } = useLanguage();
  const m = MODE_META[mode];
  const loc = language === 'en' ? m : MODE_META_I18N[language][mode];
  return (
    <View style={[styles.badge, { backgroundColor: m.soft }]} accessibilityLabel={`${loc.label}: ${loc.line}`}>
      <Ionicons name={m.icon} size={12} color={m.color} />
      <Text style={[styles.badgeText, { color: m.color }]}>{loc.label}</Text>
    </View>
  );
}

export function TierBadge({ tier }: { tier: RecommendationTier }) {
  const styles = useStyles();
  const { language } = useLanguage();
  const t = TIER_META[tier];
  const loc = language === 'en' ? t : TIER_META_I18N[language][tier];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessibilityLabel={`${loc.label}. ${loc.hint}`}>
      <Ionicons name={t.icon} size={11} color={t.color} />
      <Text style={[styles.badgeText, { color: t.color }]}>{loc.label}</Text>
    </View>
  );
}

export function Chip({ selected, onPress, label, icon }: { selected: boolean; onPress: () => void; label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} style={[styles.chip, selected && styles.chipOn]} hitSlop={4}>
      {icon && <Ionicons name={icon} size={14} color={selected ? '#fff' : undefined} />}
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function OptionCard({
  selected, onPress, title, description, icon, accent,
}: { selected: boolean; onPress: () => void; title: string; description?: string; icon?: keyof typeof Ionicons.glyphMap; accent?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = accent || colors.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}
      style={[styles.card, selected && { borderColor: tone, backgroundColor: `${tone}12` }]}>
      <View style={[styles.radio, selected && { borderColor: tone }]}>{selected && <View style={[styles.radioDot, { backgroundColor: tone }]} />}</View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon && <Ionicons name={icon} size={15} color={tone} />}
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {description ? <Text style={styles.cardDesc}>{description}</Text> : null}
      </View>
    </Pressable>
  );
}

/** A large event-start clock for booked events. */
export function EventStartClock({ startAt, label }: { startAt?: string | null; label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const c = useCountdown(startAt);
  if (!c) return null;
  const startedText =
    language === 'fr'
      ? "L'événement a commencé"
      : language === 'es'
        ? 'El evento ha comenzado'
        : 'The event has started';
  if (c.done) return <Text style={{ fontWeight: fontWeight.bold, color: colors.primary }}>{startedText}</Text>;
  const defaultLabel =
    language === 'fr'
      ? "L'ÉVÉNEMENT COMMENCE DANS"
      : language === 'es'
        ? 'EL EVENTO COMIENZA EN'
        : 'EVENT STARTS IN';
  const resolvedLabel = label ?? defaultLabel;
  const parts: [number, string][] =
    language === 'fr'
      ? [[c.days, 'jours'], [c.hours, 'h'], [c.minutes, 'min'], [c.seconds, 'sec']]
      : language === 'es'
        ? [[c.days, 'días'], [c.hours, 'hrs'], [c.minutes, 'min'], [c.seconds, 'seg']]
        : [[c.days, 'days'], [c.hours, 'hrs'], [c.minutes, 'min'], [c.seconds, 'sec']];
  return (
    <View accessibilityLabel={`${resolvedLabel.toLowerCase()} ${countdownString(c)}`}>
      <Text style={styles.clockTitle}>{resolvedLabel}</Text>
      <View style={styles.clockWrap}>
        {parts.map(([v, l]) => (
          <View key={l} style={styles.clockCell}>
            <Text style={styles.clockNum}>{pad(v)}</Text>
            <Text style={styles.clockLbl}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
