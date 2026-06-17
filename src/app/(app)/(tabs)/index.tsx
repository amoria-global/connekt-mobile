import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Modal } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { listBookings } from '@/features/bookings/api';
import { listCoordinatorEvents, listEvents } from '@/features/events/api';
import { listStreams } from '@/features/streams/api';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

type Href =
  | '/events'
  | '/wallet'
  | '/streams'
  | '/photographers'
  | '/packages'
  | '/gallery'
  | '/find-my-photos'
  | '/donations'
  | '/clients';

type Action = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

// Quick actions deliberately EXCLUDE bottom-tab destinations so nothing is duplicated.
const COMMON_TAIL: Action[] = [
  { label: 'Gallery', icon: 'images', href: '/gallery' },
  { label: 'Donate', icon: 'heart', href: '/donations' },
];

const ACTIONS_BY_ROLE: Record<string, Action[]> = {
  Client: [
    { label: 'Find Photographers', icon: 'camera', href: '/photographers' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
  Photographer: [
    { label: 'My Packages', icon: 'pricetags', href: '/packages' },
    { label: 'Clients', icon: 'people', href: '/clients' },
    ...COMMON_TAIL,
  ],
  Coordinator: [
    { label: 'Find Photographers', icon: 'camera', href: '/photographers' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
  Viewer: [
    { label: 'Live Streams', icon: 'videocam', href: '/streams' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
};

type Preview = { id: string; title: string; subtitle?: string; status?: string; onPress: () => void };

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const { role, isPhotographer, isViewer, isCoordinator } = useRole();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const name = user?.firstName || 'there';

  const actions = ACTIONS_BY_ROLE[role] ?? ACTIONS_BY_ROLE.Client;
  const wallet = useAsync(useCallback(() => getWallet(), []));

  // Role-aware "Upcoming" feed.
  const upcoming = useAsync(
    useCallback(async (): Promise<Preview[]> => {
      if (isPhotographer) {
        const bookings = await listBookings();
        return bookings.slice(0, 3).map((b) => ({
          id: b.id,
          title: b.eventTitle,
          subtitle: b.clientName,
          status: b.status,
          onPress: () => router.push('/events'),
        }));
      }
      if (isViewer) {
        const streams = await listStreams();
        return streams.slice(0, 3).map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.photographerName,
          status: s.isLive ? 'Live' : undefined,
          onPress: () => router.push(`/stream/${s.id}`),
        }));
      }
      const events = isCoordinator ? await listCoordinatorEvents() : await listEvents();
      return events.slice(0, 3).map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: [formatDate(e.eventDate), e.location].filter(Boolean).join(' · '),
        status: e.status,
        onPress: () => router.push(`/event/${e.id}`),
      }));
    }, [isPhotographer, isViewer, isCoordinator, router]),
  );

  const upcomingTitle = isPhotographer ? 'Recent bookings' : isViewer ? 'Live now' : 'Upcoming events';
  const seeAllHref: '/events' | '/streams' = isViewer ? '/streams' : '/events';

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {name} 👋</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        </View>

        {/* Wallet balance */}
        <Pressable
          style={({ pressed }) => [styles.balanceCard, pressed && styles.cardPressed]}
          onPress={() => router.push('/wallet')}
        >
          <Text style={styles.balanceLabel}>Wallet balance</Text>
          <Text style={styles.balanceValue}>
            {wallet.loading && !wallet.data ? '—' : formatMoney(wallet.data?.total, wallet.data?.currency)}
          </Text>
          <View style={styles.balanceFoot}>
            <Text style={styles.balanceLink}>Open wallet</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accentLight} />
          </View>
        </Pressable>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsPanel}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              onPress={() => {
                if (a.href === '/find-my-photos') {
                  setFindPhotosModalVisible(true);
                } else {
                  router.push(a.href);
                }
              }}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={a.icon} size={22} color={colors.textOnPrimary} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Upcoming feed */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{upcomingTitle}</Text>
          <Pressable onPress={() => router.push(seeAllHref)}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {upcoming.loading && !upcoming.data ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : upcoming.data?.length ? (
          upcoming.data.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}
              onPress={item.onPress}
            >
              <View style={styles.previewBody}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              {item.status ? <StatusPill status={item.status} /> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.muted}>Nothing here yet.</Text>
        )}
      </ScrollView>

      <FindPhotosBottomSheet visible={findPhotosModalVisible} onClose={() => setFindPhotosModalVisible(false)} getPhotosRoute="/find-my-photos" />

      <TopBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  roleBadge: {
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  roleText: { color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardPressed: { opacity: 0.95 },
  balanceLabel: { color: '#C7D2FE', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  balanceValue: { color: colors.textOnPrimary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold },
  balanceFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  balanceLink: { color: colors.accentLight, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  actionsPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  tile: {
    width: '50%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  pressed: { opacity: 0.6 },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },

  loader: { alignSelf: 'flex-start' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  previewBody: { flex: 1, gap: 2 },
  previewTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  previewSub: { fontSize: fontSize.sm, color: colors.textMuted },
});

