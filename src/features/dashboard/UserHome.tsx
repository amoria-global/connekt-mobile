/**
 * Dashboard for the `User` role — the mobile/smart-TV consumer.
 *
 * A User consumes rather than runs a business, so this dashboard surfaces
 * everything they've bought and watched, each wired to a real customer-scoped
 * endpoint:
 *   • Snapshot        → /customer/analytics (spent) + counts below
 *   • Recent watches  → /customer/streams   (completed streams, most recent)
 *   • Photos purchased→ /customer/albums     (active albums)
 *   • Archives        → /customer/albums     (archived albums)
 *   • Recent payments → /customer/payments/pending (pay right here)
 *   • Settings / Help → navigation
 *
 * Every section degrades to a clean empty state, so a brand-new User sees a
 * welcoming, non-broken dashboard rather than spinners or errors.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { getCustomerAnalytics, getCustomerPendingPayments, type PendingPayment } from '@/features/analytics/api';
import { getCompletedStreams, getPurchasedAlbums } from '@/features/library/api';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { formatMoney } from '@/utils/format';
import { colors, fonts, fontSize, radii, spacing } from '@/theme';

type Action = {
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
};

// The four things a User can do — each maps to an existing screen.
const ACTIONS: Action[] = [
  { label: 'Book a photographer', sub: 'Find & hire talent', icon: 'camera', color: '#083A85', href: '/photographers' as Href },
  { label: 'Live streams', sub: 'Watch & buy access', icon: 'videocam', color: '#F20C8F', href: '/streams' as Href },
  { label: 'Find my photos', sub: 'Buy your event photos', icon: 'images', color: '#0EA5E9', href: '/find-my-photos' as Href },
  { label: 'Payments', sub: 'Pay & track', icon: 'card', color: '#10B981', href: '/payments' as Href },
];

export function UserHome() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'there';

  const analytics = useAsync(useCallback(() => getCustomerAnalytics(), []));
  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const albums = useAsync(useCallback(() => getPurchasedAlbums(), []));
  const streams = useAsync(useCallback(() => getCompletedStreams(), []));

  const [payNow, setPayNow] = useState<PendingPayment | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const refreshing = analytics.loading || pending.loading || albums.loading || streams.loading;
  const onRefresh = () => {
    analytics.refresh();
    pending.refresh();
    albums.refresh();
    streams.refresh();
  };

  const pendingItems = pending.data ?? [];
  const totalPending = pendingItems.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const currency = (pendingItems[0] as { currency?: string } | undefined)?.currency ?? 'USD';

  const allAlbums = albums.data ?? [];
  const purchasedPhotos = useMemo(() => allAlbums.filter((a) => !a.archived), [allAlbums]);
  const archived = useMemo(() => allAlbums.filter((a) => a.archived), [allAlbums]);
  const watches = streams.data ?? [];

  const a = analytics.data;
  const stats = [
    { label: 'Spent', value: a ? formatMoney(a.totalSpent, currency) : '—', icon: 'wallet-outline' as const },
    { label: 'Streams', value: String(watches.length), icon: 'videocam-outline' as const },
    { label: 'Photos', value: String(a?.totalPhotos ?? purchasedPhotos.reduce((s, p) => s + p.photoCount, 0)), icon: 'image-outline' as const },
  ];

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>WELCOME BACK</Text>
          <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
          <Text style={styles.heroSub}>Your photos, streams, and payments — all in one place.</Text>
        </View>

        {/* Snapshot */}
        <View style={styles.statsCard}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.statCell, i > 0 && styles.statDivider]}>
              <Ionicons name={s.icon} size={16} color={colors.accent} />
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={styles.grid}>
          {ACTIONS.map((act) => (
            <Pressable
              key={act.label}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(act.href as never)}
            >
              <View style={[styles.cardIcon, { backgroundColor: act.color }]}>
                <Ionicons name={act.icon} size={22} color="#fff" />
              </View>
              <Text style={styles.cardLabel}>{act.label}</Text>
              <Text style={styles.cardSub}>{act.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recent watches (streams purchased) */}
        <Section
          title="Recent watches"
          actionLabel={watches.length > 0 ? 'All streams' : undefined}
          onAction={() => router.push('/streams' as never)}
        />
        {streams.loading ? (
          <Loader />
        ) : watches.length === 0 ? (
          <EmptyCard icon="videocam-outline" text="No streams yet — buy access to watch live events." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {watches.slice(0, 8).map((s) => (
              <Pressable
                key={s.id}
                style={styles.mediaCard}
                onPress={() => router.push(`/event/${s.eventId ?? s.id}` as never)}
              >
                <View style={styles.mediaThumbWrap}>
                  {s.coverImage ? (
                    <Image source={{ uri: s.coverImage }} style={styles.mediaThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.mediaThumb, styles.mediaThumbFallback]}>
                      <Ionicons name="play-circle" size={30} color={colors.primary} />
                    </View>
                  )}
                  {s.duration && s.duration !== '0:00:00' ? (
                    <View style={styles.durationPill}>
                      <Text style={styles.durationText}>{s.duration}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.mediaTitle} numberOfLines={1}>{s.title}</Text>
                <Text style={styles.mediaSub} numberOfLines={1}>
                  {[s.photographer, s.date].filter(Boolean).join(' · ') || 'Watched'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Photos purchased */}
        <Section
          title="Photos purchased"
          actionLabel={purchasedPhotos.length > 0 ? 'Gallery' : undefined}
          onAction={() => router.push('/gallery' as never)}
        />
        {albums.loading ? (
          <Loader />
        ) : purchasedPhotos.length === 0 ? (
          <EmptyCard icon="images-outline" text="No purchased photos yet — find yours from any event." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {purchasedPhotos.slice(0, 8).map((p) => (
              <Pressable
                key={p.id}
                style={styles.mediaCard}
                onPress={() => router.push(`/album/${p.id}` as never)}
              >
                <View style={styles.mediaThumbWrap}>
                  {p.thumbnail ? (
                    <Image source={{ uri: p.thumbnail }} style={styles.mediaThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.mediaThumb, styles.mediaThumbFallback]}>
                      <Ionicons name="images" size={28} color={colors.primary} />
                    </View>
                  )}
                  {p.locked ? (
                    <View style={styles.lockPill}>
                      <Ionicons name="lock-closed" size={11} color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.mediaTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.mediaSub} numberOfLines={1}>
                  {p.photoCount > 0 ? `${p.photoCount} photo${p.photoCount === 1 ? '' : 's'}` : (p.photographer || 'Album')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Archives (archived albums) — only when the user has any */}
        {archived.length > 0 ? (
          <>
            <Section title="Archives" actionLabel="Gallery" onAction={() => router.push('/gallery' as never)} />
            {archived.slice(0, 4).map((p) => (
              <Pressable key={p.id} style={styles.listRow} onPress={() => router.push(`/album/${p.id}` as never)}>
                <View style={styles.listIcon}>
                  <Ionicons name="archive-outline" size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.listTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.listSub} numberOfLines={1}>
                    {[p.photoCount > 0 ? `${p.photoCount} photos` : null, p.date].filter(Boolean).join(' · ') || 'Archived'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Recent payments */}
        <Section
          title="Recent payments"
          actionLabel={pendingItems.length > 0 ? 'View all' : undefined}
          onAction={() => router.push('/payments' as never)}
        />
        {pending.loading ? (
          <Loader />
        ) : pendingItems.length === 0 ? (
          <View style={styles.settledCard}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <Text style={styles.settledText}>You're all settled up — no payments due.</Text>
          </View>
        ) : (
          <>
            <View style={styles.pendingTotal}>
              <Text style={styles.pendingTotalLabel}>Total due</Text>
              <Text style={styles.pendingTotalValue}>{formatMoney(totalPending, currency)}</Text>
            </View>
            {pendingItems.slice(0, 4).map((p) => (
              <View key={p.id} style={styles.payRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.payTitle} numberOfLines={1}>{p.eventName}</Text>
                  <Text style={styles.paySub} numberOfLines={1}>
                    {p.photographerName || 'Booking'} · {formatMoney(p.amount - p.paidAmount, (p as { currency?: string }).currency ?? currency)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.payBtn, p.status === 'failed' && { backgroundColor: colors.error }]}
                  onPress={() => {
                    setPayNow(p);
                    setPayOpen(true);
                  }}
                >
                  <Text style={styles.payBtnText}>{p.status === 'failed' ? 'Retry' : 'Pay'}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {/* Settings & Help */}
        <View style={styles.manageRow}>
          <Pressable style={({ pressed }) => [styles.manageTile, pressed && styles.pressed]} onPress={() => router.push('/preferences' as never)}>
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
            <Text style={styles.manageLabel}>Settings</Text>
            <Text style={styles.manageSub}>Account & preferences</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.manageTile, pressed && styles.pressed]} onPress={() => router.push('/help-center' as never)}>
            <Ionicons name="help-buoy-outline" size={20} color={colors.primary} />
            <Text style={styles.manageLabel}>Help</Text>
            <Text style={styles.manageSub}>Support & FAQs</Text>
          </Pressable>
        </View>
      </ScrollView>

      <TopBar />

      <PayNowSheet
        payment={payNow}
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={() => {
          setPayOpen(false);
          pending.refresh();
        }}
      />
    </Screen>
  );
}

// ────── Small building blocks ────────────────────────────────────────────

function Section({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.link}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Loader() {
  return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
}

function EmptyCard({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.lg },

  hero: { gap: 4 },
  heroEyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.accent },
  heroName: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.3 },
  heroSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.borderSoft },
  statValue: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  statLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: 8,
  },
  pressed: { opacity: 0.85 },
  cardIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text },
  cardSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  link: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.primary },

  // Horizontal media rails (watches + photos)
  hRow: { gap: spacing.md, paddingRight: spacing.xl },
  mediaCard: { width: 150, gap: 6 },
  mediaThumbWrap: { position: 'relative' },
  mediaThumb: { width: 150, height: 96, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  mediaThumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft },
  durationPill: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm,
  },
  durationText: { color: '#fff', fontFamily: fonts.bold, fontSize: 10 },
  lockPill: {
    position: 'absolute', right: 6, top: 6,
    backgroundColor: 'rgba(8,58,133,0.85)', width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  mediaSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

  // Compact list rows (archives)
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  listIcon: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  listSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

  // Empty states
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  emptyText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },

  settledCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.successBg, borderRadius: radii.lg, padding: spacing.lg,
  },
  settledText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.text },

  pendingTotal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg,
  },
  pendingTotalLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)' },
  pendingTotalValue: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: '#fff' },

  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  payTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.text },
  paySub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  payBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 9, borderRadius: radii.full },
  payBtnText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: '#fff' },

  // Settings + Help
  manageRow: { flexDirection: 'row', gap: spacing.md },
  manageTile: {
    flex: 1, gap: 4,
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  manageLabel: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.text, marginTop: 4 },
  manageSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
});
