/**
 * Public event detail (guest-facing).
 *
 * Renders the full poster + description + organizer / photographer rows,
 * the live/paid badge, and routes guests into the join-package flow (or
 * straight to the live stream when the event is free + live + has invite
 * code). Mirrors the web `view-event/view-event.client.tsx` decision
 * points without forcing a login.
 */
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPublicEventDetailed } from '@/features/events/api';
import { useAsync } from '@/hooks/useAsync';
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

function feeLabel(fee: number, code: string, symbol?: string): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol ?? code}`;
}

export default function PublicEventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

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

  const onJoin = () => {
    if (!data) return;
    const target =
      data.streamFee > 0
        ? (`/events/join?id=${id}` as unknown as Href)
        : (`/events/live-stream?id=${id}` as unknown as Href);
    router.push(target);
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
          <Button title="Try again" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  if (!data) return null;

  const live = data.hasLiveStream || data.streamStatus === 'live' || data.status === 'ONGOING';
  const fee = feeLabel(data.streamFee, data.streamFeeCurrencyCode, data.streamFeeCurrencySymbol);

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Image
            source={{ uri: data.coverImage || COVER_FALLBACK }}
            style={styles.cover}
            contentFit="cover"
            transition={250}
          />
          {live ? (
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE NOW</Text>
            </View>
          ) : null}
          <Pressable style={styles.shareFab} onPress={onShare} hitSlop={8}>
            <Ionicons name="share-social-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{data.title}</Text>
            <StatusPill status={data.status} />
          </View>

          {data.category ? (
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
                <Text style={styles.chipText}>{data.category}</Text>
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
            {data.organizer ? <Row icon="person-outline" text={data.organizer} /> : null}
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

          <View style={styles.feeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeLabel}>Stream entry</Text>
              <Text style={styles.feeValue}>{fee}</Text>
            </View>
            <View style={styles.feeBadge}>
              <Ionicons name="videocam" size={14} color={colors.textOnPrimary} />
              <Text style={styles.feeBadgeText}>{live ? 'Watch live' : 'Live stream'}</Text>
            </View>
          </View>

          <Button
            title={data.streamFee > 0 ? 'Join event' : live ? 'Watch live' : 'Join when live'}
            onPress={onJoin}
          />
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/donate?eventId=${id}` as unknown as Href)}
          >
            <Ionicons name="heart-outline" size={18} color={colors.accent} />
            <Text style={styles.secondaryText}>Support this event with a donation</Text>
          </Pressable>
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { paddingBottom: 120 },
  cover: { width: '100%', height: 260, backgroundColor: colors.surfaceMuted },
  livePill: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  livePillText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.8 },
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
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
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
});
