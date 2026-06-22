/**
 * Public event detail (guest-facing).
 *
 * Renders the full poster + description + organizer / photographer rows,
 * the live/paid badge, and routes guests into the join-package flow (or
 * straight to the live stream when the event is free + live + has invite
 * code). Mirrors the web `view-event/view-event.client.tsx` decision
 * points without forcing a login.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import type { PublicEvent } from '@/features/events/types';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';

function formatTime12h(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

/**
 * Price text — mirrors web events.tsx:2363-2372 (streamFee > 0 → "From
 * {code} {amount}", else price > 0 → "From …", else "Free").
 */
function priceLabel(e: { streamFee?: number | null; price?: number; streamFeeCurrencyAbbreviation?: string | null }): {
  label: string;
  amount: string;
} {
  const code = e.streamFeeCurrencyAbbreviation || 'RWF';
  if (e.streamFee && e.streamFee > 0) {
    return { label: 'From', amount: `${code} ${e.streamFee.toLocaleString()}` };
  }
  if (e.price && e.price > 0) {
    return { label: 'From', amount: `${code} ${e.price.toLocaleString()}` };
  }
  return { label: '', amount: 'Free' };
}

/**
 * Status + CTA derivation — ported verbatim from
 * knockout/app/user/events/view-event/view-event.client.tsx:1206-1410.
 *
 *   rawStatus   = eventStatus.toUpperCase()
 *   streamEnded = streamStatus === 'ended'
 *   isLive      = rawStatus === 'ONGOING' && !streamEnded
 *   isCompleted = rawStatus === 'COMPLETED' || streamEnded
 *   isCancelled = rawStatus === 'CANCELLED'
 *   isUpcoming  = !isLive && !isCompleted && !isCancelled
 *   isPaid      = streamFee > 0 || price > 0
 *
 * The CTA matrix decides the primary action label/tone:
 *   cancelled                              → "Event cancelled" (disabled)
 *   completed/ended                        → "Event ended"     (disabled)
 *   live  + free                           → "Watch live"
 *   live  + paid + hasPurchasedAccess      → "Start watching"
 *   live  + paid                           → "Buy access"      (+ price)
 *   upcoming + free                        → "Get notified"
 *   upcoming + paid + hasPurchasedAccess   → "Access reserved" (disabled)
 *   upcoming + paid                        → "Reserve your spot" (+ price)
 *
 * `hasPurchasedAccess` is the web's local-only ownership proof — it
 * checks `anonymousViewer_{id}` or `groupCode_{id}` in storage so an
 * anonymous viewer can resume a paid stream after closing the app.
 */
type CtaTone = 'live' | 'reserve' | 'owned' | 'ended' | 'cancelled';
type Cta = {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: CtaTone;
  href?: Href;
  disabled: boolean;
};

function deriveStatus(e: PublicEvent) {
  const rawStatus = (e.eventStatus || '').toUpperCase();
  const streamEnded = e.streamStatus === 'ended';
  const isLive = rawStatus === 'ONGOING' && !streamEnded;
  const isCompleted = rawStatus === 'COMPLETED' || streamEnded;
  const isCancelled = rawStatus === 'CANCELLED';
  const isUpcoming = !isLive && !isCompleted && !isCancelled;
  const streamFee = e.streamFee || 0;
  const isPaid = streamFee > 0 || (e.price || 0) > 0;
  return { rawStatus, streamEnded, isLive, isCompleted, isCancelled, isUpcoming, streamFee, isPaid };
}

function buildCta(
  e: PublicEvent,
  status: ReturnType<typeof deriveStatus>,
  hasPurchasedAccess: boolean,
  viewerId: string | null,
): Cta | null {
  const { isCancelled, isCompleted, isLive, isUpcoming, isPaid } = status;
  const price = `${(e.price || e.streamFee || 0).toLocaleString()} ${e.streamFeeCurrencyAbbreviation || 'RWF'}`;

  if (isCancelled) {
    return { label: 'Event cancelled', icon: 'close-circle', tone: 'cancelled', disabled: true };
  }
  if (isCompleted) {
    return { label: 'Event ended', icon: 'archive', tone: 'ended', disabled: true };
  }
  if (isLive) {
    if (!isPaid) {
      return {
        label: 'Watch live',
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/events/live-stream?id=${e.id}` as unknown as Href,
      };
    }
    if (hasPurchasedAccess) {
      return {
        label: 'Start watching',
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/events/live-stream?id=${e.id}${viewerId ? `&viewerId=${viewerId}` : ''}` as unknown as Href,
      };
    }
    return {
      label: 'Buy access',
      sub: price,
      icon: 'ticket',
      tone: 'live',
      disabled: false,
      href: `/events/join?id=${e.id}` as unknown as Href,
    };
  }
  if (isUpcoming) {
    if (!isPaid) {
      return { label: 'Get notified', icon: 'notifications', tone: 'reserve', disabled: false };
    }
    if (hasPurchasedAccess) {
      return { label: 'Access reserved', icon: 'checkmark-circle', tone: 'owned', disabled: true };
    }
    return {
      label: 'Reserve your spot',
      sub: price,
      icon: 'ticket',
      tone: 'reserve',
      disabled: false,
      href: `/events/join?id=${e.id}` as unknown as Href,
    };
  }
  return null;
}

export default function PublicEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

  // Local-only proof of purchase (web parity: view-event.client.tsx:1215-1224).
  // The mobile equivalents of localStorage keys: we save `anonymousViewer_{id}`
  // after the pay flow completes; checking it here resolves the "Start
  // watching" / "Access reserved" CTAs without needing auth.
  const [viewerId, setViewerId] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      storage.get(`anonymousViewer_${id}`),
      storage.get(`groupCode_${id}`),
    ])
      .then(([v, g]) => {
        if (v) setViewerId(v);
        else if (g) setViewerId(g);
      })
      .catch(() => {});
  }, [id]);
  const hasPurchasedAccess = !!viewerId;

  const onShare = async () => {
    if (!data) return;
    try {
      await Share.share({
        title: data.title,
        message: `Check out "${data.title}" on Connekyt\n${SHARE_BASE}${id}`,
      });
    } catch {
      /* user dismissed */
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (!data) return null;

  // Status comes from the same web-parity derivation as the CTA gate,
  // so the badge and the button can never disagree on whether the event
  // is ended.
  const status = deriveStatus(data);
  const cta = buildCta(data, status, hasPurchasedAccess, viewerId);
  const price = priceLabel(data);
  const organizer = data.creator
    ? `${data.creator.firstName ?? ''} ${data.creator.lastName ?? ''}`.trim() ||
      data.eventOrganizer
    : data.eventOrganizer;

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Image
            source={{ uri: data.eventPhoto || COVER_FALLBACK }}
            style={styles.cover}
            contentFit="cover"
            transition={250}
          />
          {status.isLive ? (
            <View style={[styles.statusBadge, styles.statusLive, styles.statusBadgeAbs]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>LIVE</Text>
            </View>
          ) : status.isCancelled ? (
            <View style={[styles.statusBadge, styles.statusCancelled, styles.statusBadgeAbs]}>
              <Text style={styles.statusBadgeText}>CANCELLED</Text>
            </View>
          ) : status.isCompleted ? (
            <View style={[styles.statusBadge, styles.statusEnded, styles.statusBadgeAbs]}>
              <Text style={styles.statusBadgeText}>ENDED</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, styles.statusUpcoming, styles.statusBadgeAbs]}>
              <Text style={styles.statusBadgeText}>UPCOMING</Text>
            </View>
          )}
          <Pressable style={styles.shareFab} onPress={onShare} hitSlop={8}>
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{data.title}</Text>

          {data.eventCategory?.name ? (
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
                <Text style={styles.chipText}>{data.eventCategory.name}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            {data.eventDate ? (
              <Row icon="calendar-outline" text={formatDate(data.eventDate)} />
            ) : null}
            {data.startTime ? (
              <Row
                icon="time-outline"
                text={
                  data.endTime
                    ? `${formatTime12h(data.startTime)} – ${formatTime12h(data.endTime)}`
                    : formatTime12h(data.startTime)
                }
              />
            ) : null}
            {data.location ? <Row icon="location-outline" text={data.location} /> : null}
            {organizer ? <Row icon="person-outline" text={organizer} /> : null}
            {data.photographerName ? (
              <Row icon="camera-outline" text={data.photographerName} />
            ) : null}
            {data.maxGuests ? (
              <Row icon="people-outline" text={`Up to ${data.maxGuests.toLocaleString()} guests`} />
            ) : null}
          </View>

          {data.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this event</Text>
              <Text style={styles.bodyText}>{data.description}</Text>
            </View>
          ) : null}

          {/*
           * Fee card is only shown when the event is still actionable
           * (live or upcoming). For ended/cancelled events the web hides
           * the price hint and just renders the dead CTA, so we mirror
           * that here.
           */}
          {!status.isCompleted && !status.isCancelled ? (
            <View style={styles.feeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeLabel}>Stream entry</Text>
                <Text style={styles.feeValue}>
                  {price.label ? `${price.label} ` : ''}
                  {price.amount}
                </Text>
              </View>
              <View style={styles.feeBadge}>
                <Ionicons name="videocam" size={14} color={colors.textOnPrimary} />
                <Text style={styles.feeBadgeText}>
                  {status.isLive ? 'Watch live' : 'Live stream'}
                </Text>
              </View>
            </View>
          ) : null}

          {cta ? <CtaButton cta={cta} onPress={() => cta.href && router.push(cta.href)} /> : null}

          {/*
           * Donation is hidden for cancelled events — there's nothing to
           * support. Ended events still allow donating because the web
           * keeps the donation surface available post-event.
           */}
          {!status.isCancelled ? (
            <Pressable
              style={styles.secondary}
              onPress={() => router.push(`/donate?eventId=${id}` as unknown as Href)}
            >
              <Ionicons name="heart-outline" size={18} color={colors.accent} />
              <Text style={styles.secondaryText}>Support this event with a donation</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

/**
 * Mirrors the web `renderPrimaryCTA` (view-event.client.tsx:1417-1433):
 * one tone class per state, disabled rendered with reduced opacity,
 * optional sub-label for the price hint on Buy access / Reserve.
 */
function CtaButton({ cta, onPress }: { cta: Cta; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ctaBase,
        ctaToneStyles[cta.tone],
        cta.disabled && styles.ctaDisabled,
        pressed && !cta.disabled && styles.ctaPressed,
      ]}
      disabled={cta.disabled}
      onPress={onPress}
    >
      <Ionicons
        name={cta.icon}
        size={20}
        color={cta.disabled ? colors.textMuted : colors.textOnPrimary}
      />
      <View style={styles.ctaText}>
        <Text style={[styles.ctaLabel, cta.disabled && styles.ctaLabelDisabled]}>{cta.label}</Text>
        {cta.sub ? (
          <Text style={[styles.ctaSub, cta.disabled && styles.ctaLabelDisabled]}>{cta.sub}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { paddingBottom: 120 },
  cover: { width: '100%', height: 260, backgroundColor: colors.surfaceMuted },
  statusBadgeAbs: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
  statusUpcoming: { backgroundColor: colors.primary },
  statusLive: { backgroundColor: colors.accent },
  statusEnded: { backgroundColor: '#6A6D76' },
  statusCancelled: { backgroundColor: '#991B1B' },

  // CTA tones — mirrors the web's ve-btn--{tone} classes
  // (view-event.client.tsx:2350-2360). Disabled tones use a muted surface
  // so it's unmistakably not actionable.
  ctaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaDisabled: { backgroundColor: colors.surfaceMuted },
  ctaText: { alignItems: 'flex-start' },
  ctaLabel: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
  ctaLabelDisabled: { color: colors.textMuted },
  shareFab: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  chipRow: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  chipText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.bold },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, fontSize: fontSize.md, color: colors.textSoft },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  bodyText: { fontSize: fontSize.md, color: colors.textSoft, lineHeight: 24 },
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  feeLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  feeValue: { color: colors.primary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, marginTop: 2 },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  feeBadgeText: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  secondaryText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});

/**
 * Per-tone background. Live & reserve get the primary brand fill so the
 * active CTA stands out; owned/ended/cancelled are flat muted styles so
 * the user can read the state at a glance without thinking it's still
 * actionable. Mirrors ve-btn--live / --reserve / --owned / --ended /
 * --cancelled (view-event.client.tsx:2348-2358).
 */
const ctaToneStyles = StyleSheet.create({
  live: { backgroundColor: colors.accent },
  reserve: { backgroundColor: colors.primary },
  owned: { backgroundColor: colors.successBg },
  ended: { backgroundColor: colors.surfaceMuted },
  cancelled: { backgroundColor: colors.errorBg },
});
