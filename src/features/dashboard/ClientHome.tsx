/**
 * ClientHome — attractive, client-centric home dashboard for the `Client` role.
 *
 * Designed to inspire and convert clients:
 *   1. KYC Banner (Complete KYC - Optional)
 *   2. Pending Payments Alert (only shown when actual payments are due)
 *   3. Inspiring Hero with warm greeting & category discovery chips
 *   4. Visual Quick Action tiles (Book, Find Photos, Explore, Gallery)
 *   5. "Find Your Event Photos" promotional AI face-scan banner
 *   6. Featured & Top Photographers showcase rail
 *   7. My Bookings / Scheduled Events (with welcoming empty state)
 *   8. Client Activity Snapshot (Bookings, Photos, Saved Photographers — no accounting clutter)
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { KycBanner } from '@/features/kyc/KycBanner';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCustomerAnalytics,
  getCustomerPendingPayments,
  type PendingPayment,
} from '@/features/analytics/api';
import { listEvents } from '@/features/events/api';
import { listPhotographers, type Photographer } from '@/features/photographers/api';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { formatDate, formatMoney } from '@/utils/format';
import { colors, spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

const CATEGORY_CHIPS = [
  { label: 'All', icon: 'sparkles' as const },
  { label: 'Weddings', icon: 'heart' as const },
  { label: 'Portraits', icon: 'person' as const },
  { label: 'Events', icon: 'calendar' as const },
  { label: 'Birthdays', icon: 'gift' as const },
  { label: 'Studio', icon: 'camera' as const },
];

const SHOWCASE_PHOTOGRAPHERS: Photographer[] = [
  {
    id: 'showcase-1',
    name: 'Aura Studio',
    category: 'Weddings & Celebrations',
    rating: 4.9,
    reviewCount: 38,
    location: 'Kigali, Rwanda',
    startingPrice: 120,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=500',
  },
  {
    id: 'showcase-2',
    name: 'Apex Visuals',
    category: 'Portraits & Lifestyle',
    rating: 5.0,
    reviewCount: 52,
    location: 'Kigali, Rwanda',
    startingPrice: 85,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    coverImage: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500',
  },
  {
    id: 'showcase-3',
    name: 'Lumina Media',
    category: 'Corporate & Events',
    rating: 4.8,
    reviewCount: 29,
    location: 'Kigali, Rwanda',
    startingPrice: 150,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    coverImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500',
  },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 22) return 'Good Evening';
  return 'Good Night';
}

export function ClientHome() {
  const styles = useStyles();
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'there';

  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const [payNowOpen, setPayNowOpen] = useState(false);
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Async feeds
  const analytics = useAsync(useCallback(() => getCustomerAnalytics(), []));
  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const events = useAsync(useCallback(() => listEvents(), []));
  const photographers = useAsync(useCallback(() => listPhotographers(), []));

  const refreshing =
    analytics.loading || pending.loading || events.loading || photographers.loading;

  const onRefresh = () => {
    analytics.refresh();
    pending.refresh();
    events.refresh();
    photographers.refresh();
  };

  const pendingList = pending.data ?? [];
  const totalPendingAmount = pendingList.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const hasFailedPayments = pendingList.some((p) => p.status === 'failed');

  const photographerList = useMemo(() => {
    const apiList = photographers.data ?? [];
    return apiList.length > 0 ? apiList : SHOWCASE_PHOTOGRAPHERS;
  }, [photographers.data]);

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

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Top KYC Banner — clearly marks Optional for Clients */}
        <KycBanner />

        {/* Pending Payments Alert (only displayed when payments are actually due) */}
        {pendingList.length > 0 ? (
          <View
            style={[
              styles.alertBox,
              {
                backgroundColor: hasFailedPayments ? colors.errorBg : colors.warningBg,
                borderColor: hasFailedPayments ? colors.error : colors.warning,
              },
            ]}
          >
            <View style={styles.alertHeader}>
              <Ionicons
                name="alert-circle"
                size={20}
                color={hasFailedPayments ? colors.error : colors.warning}
              />
              <Text
                style={[
                  styles.alertTitle,
                  { color: hasFailedPayments ? colors.error : colors.warning },
                ]}
              >
                {hasFailedPayments ? 'Payment action required' : 'Pending booking payments'}
              </Text>
            </View>
            <Text style={styles.alertDetail}>
              You have {pendingList.length} pending booking{pendingList.length === 1 ? '' : 's'}{' '}
              totaling{' '}
              <Text style={{ fontFamily: fonts.bold }}>
                {formatMoney(totalPendingAmount, (pendingList[0] as { currency?: string })?.currency)}
              </Text>
            </Text>
            <View style={styles.alertActions}>
              <Pressable
                style={[styles.alertPayBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setPayNowPayment(pendingList[0]);
                  setPayNowOpen(true);
                }}
              >
                <Text style={styles.alertPayBtnText}>Pay Now</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/payments' as never)}>
                <Text style={[styles.alertViewAll, { color: colors.primary }]}>View All →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Inspiring Client Welcome Hero */}
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

          {/* Top Row: Badge & Verified Tag */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={11} color="#FFD1EC" />
              <Text style={styles.heroBadgeText}>CONNEKYT CLIENT</Text>
            </View>
            <View style={styles.heroTopRightPill}>
              <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={styles.heroTopRightText}>Verified Talent</Text>
            </View>
          </View>

          {/* Greeting & Name Heading */}
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroGreeting}>{greeting},</Text>
            <Text style={styles.heroTitle}>
              <Text style={styles.heroName}>{name}</Text> ✨
            </Text>
            <Text style={styles.heroSub}>
              Discover top professional photographers & capture your unforgettable moments.
            </Text>
          </View>

          {/* Interactive Frosted Search Bar */}
          <Pressable
            style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
            onPress={() => router.push('/photographers' as never)}
            accessibilityRole="button"
            accessibilityLabel="Search photographers by name, style, or location"
          >
            <View style={styles.searchLeftContent}>
              <Ionicons name="search" size={17} color="rgba(255,255,255,0.85)" />
              <Text style={styles.searchPlaceholder}>Search photographers, styles, events...</Text>
            </View>
            <View style={styles.searchActionChip}>
              <Ionicons name="arrow-forward" size={13} color="#083A85" />
            </View>
          </Pressable>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
          >
            {CATEGORY_CHIPS.map((c) => {
              const active = selectedCategory === c.label;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => {
                    setSelectedCategory(c.label);
                    router.push('/photographers' as never);
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
            onPress={() => router.push('/photographers' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#083A85' }]}>
              <Ionicons name="camera" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Book Photographer</Text>
              <Text style={styles.actionSub}>Hire top verified talent</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => setFindPhotosModalVisible(true)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#F20C8F' }]}>
              <Ionicons name="scan" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Find My Photos</Text>
              <Text style={styles.actionSub}>Instant AI face match</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/explore-events' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#0EA5E9' }]}>
              <Ionicons name="videocam" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>Explore Events</Text>
              <Text style={styles.actionSub}>Public shoots & streams</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push('/gallery' as never)}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#10B981' }]}>
              <Ionicons name="images" size={22} color="#fff" />
            </View>
            <View style={styles.actionTextWrap}>
              <Text style={styles.actionTitle}>My Gallery</Text>
              <Text style={styles.actionSub}>Purchased photo sets</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Promotional "Find Your Photos" Card */}
        <Pressable
          style={({ pressed }) => [styles.promoCard, pressed && styles.cardPressed]}
          onPress={() => setFindPhotosModalVisible(true)}
        >
          <View style={styles.promoContent}>
            <View style={styles.promoBadge}>
              <Ionicons name="sparkles" size={11} color={colors.accent} />
              <Text style={styles.promoBadgeText}>AI PHOTO RETRIEVAL</Text>
            </View>
            <Text style={styles.promoTitle}>Attended an event recently?</Text>
            <Text style={styles.promoSub}>
              Scan your face or enter an event code to find all your photos in seconds.
            </Text>
            <View style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>Scan & Find Photos</Text>
              <Ionicons name="arrow-forward" size={13} color="#fff" />
            </View>
          </View>
          <View style={styles.promoIconArt}>
            <Ionicons name="images" size={54} color={colors.primary + '25'} />
          </View>
        </Pressable>

        {/* Featured Photographers Rail */}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>Featured Photographers</Text>
            <Text style={styles.sectionSubtitle}>Top-rated professionals available for hire</Text>
          </View>
          <Pressable onPress={() => router.push('/photographers' as never)} hitSlop={8}>
            <Text style={styles.sectionLink}>See all →</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photographersRail}
        >
          {photographerList.slice(0, 6).map((p) => (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.photogCard, pressed && styles.cardPressed]}
              onPress={() => {
                if (p.id.startsWith('showcase-')) {
                  router.push('/photographers' as never);
                } else {
                  router.push(`/photographer/${p.id}` as never);
                }
              }}
            >
              <View style={styles.photogCoverWrap}>
                {p.coverImage ? (
                  <Image source={{ uri: p.coverImage }} style={styles.photogCover} contentFit="cover" />
                ) : (
                  <View style={[styles.photogCover, styles.photogCoverFallback]}>
                    <Ionicons name="camera-outline" size={28} color={colors.primary} />
                  </View>
                )}
                {p.rating ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={styles.ratingText}>{p.rating.toFixed(1)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.photogInfo}>
                <Text style={styles.photogName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.photogCategory} numberOfLines={1}>
                  {p.category || 'Professional Photography'}
                </Text>

                <View style={styles.photogFooter}>
                  <Text style={styles.photogPrice}>
                    {p.startingPrice ? `From $${p.startingPrice}` : 'View packages'}
                  </Text>
                  <View style={styles.bookMiniBtn}>
                    <Text style={styles.bookMiniText}>Book</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* My Bookings Section */}
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>My Bookings</Text>
            <Text style={styles.sectionSubtitle}>Your scheduled shoots & organized events</Text>
          </View>
          {upcomingEvents.length > 0 ? (
            <Pressable onPress={() => router.push('/events' as never)} hitSlop={8}>
              <Text style={styles.sectionLink}>View all →</Text>
            </Pressable>
          ) : null}
        </View>

        {events.loading && !events.data ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : upcomingEvents.length === 0 ? (
          <View style={styles.emptyBookingsCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={26} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySub}>
                Planning a wedding, party, or photoshoot? Connect with a top photographer.
              </Text>
            </View>
            <Pressable
              style={styles.emptyCta}
              onPress={() => router.push('/photographers' as never)}
            >
              <Text style={styles.emptyCtaText}>Browse</Text>
            </Pressable>
          </View>
        ) : (
          upcomingEvents.slice(0, 3).map((e) => (
            <Pressable
              key={e.id}
              style={({ pressed }) => [styles.eventRow, pressed && styles.cardPressed]}
              onPress={() => router.push(`/event/${e.id}` as never)}
            >
              <View style={styles.eventIcon}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {e.title || 'Event Booking'}
                </Text>
                <Text style={styles.eventSub} numberOfLines={1}>
                  {[e.photographerName, e.eventDate ? formatDate(e.eventDate) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              {e.status ? <StatusPill status={e.status} /> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        )}

        {/* Client Activity Snapshot (Clean & helpful, NOT accounting financial cards) */}
        <View style={styles.activityBox}>
          <Text style={styles.activityBoxTitle}>YOUR CONNEKYT SNAPSHOT</Text>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotCell}>
              <Text style={styles.snapshotValue}>{analytics.data?.totalBookings ?? 0}</Text>
              <Text style={styles.snapshotLabel}>Bookings</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotCell}>
              <Text style={styles.snapshotValue}>{analytics.data?.totalPhotos ?? 0}</Text>
              <Text style={styles.snapshotLabel}>Photos</Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotCell}>
              <Text style={styles.snapshotValue}>
                {analytics.data?.bookmarkedPhotographers ?? 0}
              </Text>
              <Text style={styles.snapshotLabel}>Favorites</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Persistent Frosted TopBar */}
      <TopBar />

      {/* Find My Photos Bottom Sheet */}
      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-my-photos"
      />

      {/* Pay Now Bottom Sheet */}
      <PayNowSheet
        payment={payNowPayment}
        visible={payNowOpen}
        onClose={() => setPayNowOpen(false)}
        onSuccess={() => {
          setPayNowOpen(false);
          pending.refresh();
          analytics.refresh();
        }}
      />
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
    left: -25,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.8,
  },
  heroTopRightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  heroTopRightText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  heroTextGroup: {
    gap: 2,
    marginTop: 2,
  },
  heroGreeting: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  heroName: {
    fontFamily: fonts.bold,
    color: '#FFE3F3',
  },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.86)',
    lineHeight: 18,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: radii.full,
    paddingLeft: spacing.md,
    paddingRight: 6,
    height: 46,
  },
  searchBarPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...e(1),
  },
  categoryChips: {
    gap: spacing.xs,
    paddingTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    borderRadius: radii.full,
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    ...e(1),
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  chipTextActive: {
    color: '#083A85',
  },

  // 2x2 Action Tiles
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...e(1),
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  actionSub: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
    marginTop: 1,
  },

  // Promotional Banner
  promoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    overflow: 'hidden',
    ...e(1),
  },
  promoContent: {
    flex: 1,
    gap: 4,
    zIndex: 2,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tintAccent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  promoBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.accent,
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  promoSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 16,
    marginBottom: 4,
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  promoBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  promoIconArt: {
    position: 'absolute',
    right: 12,
    bottom: -6,
    opacity: 0.6,
  },

  // Section Headers
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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

  // Photographers Rail
  photographersRail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  photogCard: {
    width: 170,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(1),
  },
  photogCoverWrap: {
    position: 'relative',
    width: '100%',
    height: 105,
    backgroundColor: c.surfaceMuted,
  },
  photogCover: {
    width: '100%',
    height: '100%',
  },
  photogCoverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  ratingText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
  },
  photogInfo: {
    padding: spacing.sm,
    gap: 3,
  },
  photogName: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  photogCategory: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },
  photogFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  photogPrice: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  bookMiniBtn: {
    backgroundColor: c.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  bookMiniText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#fff',
  },

  // My Bookings Rows / Empty State
  emptyBookingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    ...e(1),
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyCta: {
    backgroundColor: c.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  emptyCtaText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: '#fff',
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

  // Client Snapshot Box
  activityBox: {
    backgroundColor: c.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
    ...e(1),
  },
  activityBoxTitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: c.textMuted,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snapshotCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  snapshotValue: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    color: c.primary,
  },
  snapshotLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  snapshotDivider: {
    width: 1,
    height: 32,
    backgroundColor: c.borderSoft,
  },

  // Alert Box for Pending Payments
  alertBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  alertTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
  },
  alertDetail: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
  },
  alertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  alertPayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  alertPayBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  alertViewAll: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
  },
}));
