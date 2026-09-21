/**
 * PhotographerHome — modern, creator-centric dashboard for the `Photographer` role.
 *
 * Tailored for photography pros to manage their business:
 *   1. KYC Banner (Recommended for photographers to receive payouts)
 *   2. Gradient Creator Hero with personalized greeting, status pill, and shoot category chips
 *   3. 2x2 Action Tiles (My Packages, Upcoming Shoots, Clients, Upload Gallery)
 *   4. "Share Your Booking Link" promotional card for client acquisition
 *   5. Upcoming Shoots & Bookings list (with client avatars, dates, and status pills)
 *   6. Creator Performance Snapshot (Earnings, Completed Shoots, Rating, Photos Uploaded)
 */
import { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { getPhotographerAnalytics } from '@/features/analytics/api';
import { listPhotographerEvents } from '@/features/events/api';
import { getWallet } from '@/features/wallet/api';
import { formatDate, formatMoney } from '@/utils/format';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

const SHOOT_CATEGORIES = [
  { label: 'All', icon: 'sparkles' as const },
  { label: 'Weddings', icon: 'heart' as const },
  { label: 'Portraits', icon: 'person' as const },
  { label: 'Events', icon: 'calendar' as const },
  { label: 'Fashion', icon: 'camera' as const },
  { label: 'Studio', icon: 'flash' as const },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 22) return 'Good Evening';
  return 'Good Night';
}

export function PhotographerHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'Creator';

  const [selectedCategory, setSelectedCategory] = useState('All');

  // Async data sources
  const analytics = useAsync(useCallback(() => getPhotographerAnalytics(), []));
  const events = useAsync(useCallback(() => listPhotographerEvents(), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));

  const refreshing = analytics.loading || events.loading || wallet.loading;

  const onRefresh = () => {
    analytics.refresh();
    events.refresh();
    wallet.refresh();
  };

  const a = analytics.data;
  const currency = wallet.data?.currency || 'USD';

  const eventList = events.data ?? [];
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return eventList.filter((e) => {
      const s = (e.status ?? '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      return !e.eventDate || e.eventDate >= today;
    });
  }, [eventList]);

  const greeting = getTimeGreeting();

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Book a photography shoot with ${name} on Connekt! Check out my portfolio and packages.`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Prominent KYC Banner — Recommended for Photographer payouts */}
        <KycBanner />

        {/* Creator Hero */}
        <LinearGradient
          colors={['#083A85', '#0a4da3', '#F20C8F']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Ambient decorative depth orbs */}
          <View style={styles.heroOrbTopRight} pointerEvents="none" />
          <View style={styles.heroOrbBottomLeft} pointerEvents="none" />

          {/* Top Row: Role Pill & Verified Badge */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="camera" size={11} color="#FFD1EC" />
              <Text style={styles.heroBadgeText}>CONNEKYT CREATOR</Text>
            </View>
            <View style={styles.heroTopRightPill}>
              <Ionicons name="star" size={12} color="#FBBF24" />
              <Text style={styles.heroTopRightText}>
                {a?.averageRating ? `${a.averageRating.toFixed(1)} Rating` : 'Pro Verified'}
              </Text>
            </View>
          </View>

          {/* Greeting & Name Heading */}
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroGreeting}>{greeting},</Text>
            <Text style={styles.heroTitle}>
              <Text style={styles.heroName}>{name}</Text> 📸
            </Text>
            <Text style={styles.heroSub}>
              Manage your client bookings, packages, and shoot deliveries all in one place.
            </Text>
          </View>

          {/* Search / Filter bar */}
          <Pressable
            style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
            onPress={() => router.push('/events' as never)}
            accessibilityRole="button"
            accessibilityLabel="Search your shoots and bookings"
          >
            <View style={styles.searchLeftContent}>
              <Ionicons name="search" size={17} color="rgba(255,255,255,0.85)" />
              <Text style={styles.searchPlaceholder}>Search shoots, clients, locations...</Text>
            </View>
            <View style={styles.searchActionChip}>
              <Ionicons name="arrow-forward" size={13} color="#083A85" />
            </View>
          </Pressable>

          {/* Shoot Category Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
          >
            {SHOOT_CATEGORIES.map((c) => {
              const active = selectedCategory === c.label;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => {
                    setSelectedCategory(c.label);
                    router.push('/events' as never);
                  }}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Ionicons
                    name={c.icon}
                    size={12}
                    color={active ? '#083A85' : 'rgba(255,255,255,0.9)'}
                  />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        {/* Primary Action Tiles (2x2 Grid) */}
        <View style={styles.actionsGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/packages' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#083A85' }]}>
              <Ionicons name="pricetags" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>My Packages</Text>
              <Text style={styles.actionSub}>Set rates & shoot tiers</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/events' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#0EA5E9' }]}>
              <Ionicons name="calendar" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Assigned Shoots</Text>
              <Text style={styles.actionSub}>Upcoming event bookings</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/clients' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#10B981' }]}>
              <Ionicons name="people" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>My Clients</Text>
              <Text style={styles.actionSub}>Client roster & contacts</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/content-albums' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#F20C8F' }]}>
              <Ionicons name="images" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Content Albums</Text>
              <Text style={styles.actionSub}>Deliver event photos</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Share Booking Profile Spotlight Banner */}
        <View style={styles.spotlightCard}>
          <LinearGradient
            colors={['#1E1B4B', '#083A85']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.spotlightGradient}
          >
            <View style={styles.spotlightIconBubble}>
              <Ionicons name="share-social" size={24} color="#FFD1EC" />
            </View>
            <View style={styles.spotlightContent}>
              <Text style={styles.spotlightBadge}>GET MORE CLIENTS</Text>
              <Text style={styles.spotlightTitle}>Share Your Booking Profile</Text>
              <Text style={styles.spotlightDetail}>
                Send your direct profile link on WhatsApp & social media to accept verified bookings.
              </Text>
              <View style={styles.spotlightButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.spotlightPrimaryBtn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleShareProfile}
                >
                  <Ionicons name="paper-plane" size={14} color="#083A85" />
                  <Text style={styles.spotlightPrimaryBtnText}>Share Link</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.spotlightSecondaryBtn,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => router.push('/profile' as never)}
                >
                  <Text style={styles.spotlightSecondaryBtnText}>View Profile</Text>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Upcoming Shoots Section */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Upcoming Shoots</Text>
            <Text style={styles.sectionSubtitle}>Your scheduled assignments & events</Text>
          </View>
          <Pressable onPress={() => router.push('/events' as never)}>
            <Text style={styles.sectionLink}>View All</Text>
          </Pressable>
        </View>

        {events.loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : upcomingEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Upcoming Shoots</Text>
            <Text style={styles.emptySubtitle}>
              You don&apos;t have any scheduled bookings right now. Share your packages to get booked by clients!
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push('/packages' as never)}
            >
              <Text style={styles.emptyActionBtnText}>Manage Packages</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {upcomingEvents.slice(0, 4).map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.eventRow, pressed && styles.cardPressed]}
                onPress={() => router.push(`/event/${item.id}` as never)}
              >
                <View style={styles.eventIcon}>
                  <Ionicons name="camera-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {item.title || 'Photo Shoot'}
                  </Text>
                  <Text style={styles.eventSub} numberOfLines={1}>
                    {[item.clientName, formatDate(item.eventDate), item.location]
                      .filter(Boolean)
                      .join(' · ') || 'Scheduled'}
                  </Text>
                </View>
                <StatusPill status={item.status || 'UPCOMING'} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Creator Performance Snapshot */}
        <View style={styles.activityBox}>
          <View style={styles.activityHeader}>
            <View style={styles.activityIconCircle}>
              <Ionicons name="trending-up" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.activityHeading}>Creator Performance</Text>
              <Text style={styles.activitySub}>Your activity & earnings snapshot</Text>
            </View>
          </View>

          <View style={styles.activityStatsRow}>
            <View style={styles.activityStatItem}>
              <View style={[styles.activityStatBadge, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="cash" size={16} color="#083A85" />
              </View>
              <Text style={styles.activityStatNumber}>
                {a?.totalEarnings ? formatMoney(a.totalEarnings, currency) : '$0'}
              </Text>
              <Text style={styles.activityStatLabel}>Total Earnings</Text>
            </View>

            <View style={styles.activityStatItem}>
              <View style={[styles.activityStatBadge, { backgroundColor: '#FDF2F8' }]}>
                <Ionicons name="checkmark-done-circle" size={16} color="#F20C8F" />
              </View>
              <Text style={styles.activityStatNumber}>{a?.completedEvents ?? 0}</Text>
              <Text style={styles.activityStatLabel}>Shoots Done</Text>
            </View>

            <View style={styles.activityStatItem}>
              <View style={[styles.activityStatBadge, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="star" size={16} color="#10B981" />
              </View>
              <Text style={styles.activityStatNumber}>
                {a?.averageRating ? a.averageRating.toFixed(1) : '5.0'}
              </Text>
              <Text style={styles.activityStatLabel}>Rating</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 130,
    gap: spacing.lg,
  },

  // Hero section
  hero: {
    position: 'relative',
    borderRadius: radii['2xl'],
    padding: spacing.xl,
    gap: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    ...e(3),
  },
  heroOrbTopRight: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(242,12,143,0.30)',
  },
  heroOrbBottomLeft: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(8,58,133,0.40)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#FFD1EC',
    letterSpacing: 0.6,
  },
  heroTopRightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  heroTopRightText: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: 11,
    color: '#fff',
  },
  heroTextGroup: {
    gap: 2,
    marginTop: 2,
  },
  heroGreeting: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize['2xl'],
    color: '#fff',
    lineHeight: 34,
  },
  heroName: {
    color: '#FFD1EC',
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
    marginTop: 4,
  },

  // Frosted Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.full,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: 4,
  },
  searchBarPressed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  searchLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  searchPlaceholder: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.82)',
  },
  searchActionChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category Filter Chips
  categoryChips: {
    gap: 7,
    paddingTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.92)',
  },
  chipTextActive: {
    color: '#083A85',
    fontFamily: fonts.bold,
  },

  // 2x2 Action Tiles
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    width: '47.8%',
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...e(1),
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    gap: 2,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  actionSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 15,
  },

  // Spotlight Banner
  spotlightCard: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(2),
  },
  spotlightGradient: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  spotlightIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(242,12,143,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.4)',
  },
  spotlightContent: {
    flex: 1,
    gap: 4,
  },
  spotlightBadge: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#FFD1EC',
    letterSpacing: 0.8,
  },
  spotlightTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: '#fff',
  },
  spotlightDetail: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 17,
  },
  spotlightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  spotlightPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  spotlightPrimaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#083A85',
  },
  spotlightSecondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  spotlightSecondaryBtnText: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: 12,
    color: '#FFD1EC',
  },
  btnPressed: {
    opacity: 0.85,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 1,
  },
  sectionLink: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.primary,
  },

  // Events List
  eventsList: {
    gap: spacing.sm,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    ...e(1),
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  eventSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },

  // Empty State
  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.md,
  },
  emptyActionBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    marginTop: 6,
  },
  emptyActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },

  // Activity / Performance Snapshot
  activityBox: {
    backgroundColor: c.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...e(1),
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityHeading: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  activitySub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  activityStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  activityStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  activityStatBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activityStatNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  activityStatLabel: {
    fontFamily: fonts.regular,
    fontWeight: fontWeight.medium,
    fontSize: 10.5,
    color: c.textMuted,
  },
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
}));
