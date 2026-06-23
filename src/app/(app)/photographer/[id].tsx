import React, { useCallback, useState, useRef, useEffect } from 'react';
import { RefreshControl, ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import { getPhotographer } from '@/features/photographers/api';
import { listPhotographerReviews } from '@/features/reviews/api';
import { BookingBottomSheet } from '@/features/booking/BookingBottomSheet';
import { Stars } from '@/components/ui/Stars';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

let hasAutoShownWizard = false;

function CalendarPreview() {
  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  // June 2026 starts on Monday. 30 days.
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const offset = 1; 
  
  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeaderCenter}>
        <View style={styles.calendarArrowBtn}>
          <Feather name="chevron-left" size={16} color={colors.primary} />
        </View>
        <Text style={styles.monthTextCenter}>June 2026</Text>
        <View style={styles.calendarArrowBtn}>
          <Feather name="chevron-right" size={16} color={colors.primary} />
        </View>
      </View>

      <View style={styles.calendarGrid}>
        {daysOfWeek.map((d, i) => (
          <View key={`dow-${i}`} style={styles.calendarCell}>
            <Text style={styles.dayOfWeek}>{d}</Text>
          </View>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.calendarCell} />
        ))}
        {days.map(d => {
          // Mock past/unavailable days vs available days
          const isPast = d < 13;
          const isToday = d === 13; // Highlight today's date instead of making it selectable
          return (
            <View 
              key={d} 
              style={styles.calendarCell}
            >
              <View style={[
                styles.daySquare, 
                isPast ? styles.daySquarePast : styles.daySquareAvailable,
                isToday && styles.daySquareSelected
              ]}>
                <Text style={[
                  styles.dayText, 
                  isPast ? styles.dayTextPast : styles.dayTextAvailable
                ]}>{d}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Booked</Text>
        </View>
      </View>
    </View>
  );
}

function IconButton({ icon, onPress, style }: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; style?: any }) {
  return (
    <Pressable style={[styles.iconButton, style]} onPress={onPress}>
      <Feather name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

export default function PhotographerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out this amazing photographer on Connekyt!',
        title: 'Share Photographer',
      });
    } catch (error) {
      console.error(error);
    }
  };

  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    if (!isBookmarked) {
      Alert.alert('Saved', 'Photographer added to your bookmarks');
    }
  };
  const insets = useSafeAreaInsets();
  
  const { data, loading, error } = useAsync(useCallback(() => getPhotographer(id), [id]));
  const reviews = useAsync(useCallback(() => listPhotographerReviews(id), [id]));
  
  const bottomSheetRef = useRef<BottomSheet>(null);

  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = [
    { id: 'Overview', icon: 'grid' as const },
    { id: 'Portfolio', icon: 'images' as const },
    { id: 'Reviews', icon: 'chatbubbles' as const },
    { id: 'Working Experience', icon: 'briefcase' as const },
  ];

  // Show bottom sheet automatically after 5 seconds
  useEffect(() => {
    if (!hasAutoShownWizard) {
      const timer = setTimeout(() => {
        bottomSheetRef.current?.expand();
        hasAutoShownWizard = true;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        <Text style={styles.muted}>{error}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const initials = (data?.name?.[0] ?? '?').toUpperCase();
  const coverSource = data?.coverImage 
    ? { uri: data.coverImage } 
    : { uri: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1000&auto=format&fit=crop' };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Cover Image & Header Overlay */}
        <View style={styles.headerArea}>
          <Image source={coverSource} style={styles.coverImage} />
          
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
            locations={[0.2, 0.7, 1]}
            style={styles.gradient}
          />

          {/* Floating Top Nav */}
          <View style={[styles.topNav, { top: Math.max(insets.top, 20) }]}>
            <IconButton icon="arrow-left" onPress={() => router.back()} />
            <View style={styles.topNavRight}>
              <IconButton icon="share-2" style={{ marginRight: 8 }} onPress={handleShare} />
              <IconButton icon="bookmark" onPress={toggleBookmark} style={isBookmarked ? { backgroundColor: colors.surfaceMuted } : {}} />
            </View>
          </View>

          {/* Profile Info Overlay */}
          <View style={styles.profileInfoContainer}>
            <View style={styles.avatarWrapper}>
              {data?.avatar ? (
                <Image source={{ uri: data.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#3B82F6" style={{ backgroundColor: 'white', borderRadius: 10, overflow: 'hidden' }} />
              </View>
            </View>

            <Text style={styles.name}>{data?.name}</Text>
            
            <View style={styles.roleRow}>
              <Text style={styles.role}>{data?.category || 'Photographer'}</Text>
              <Text style={styles.dot}>•</Text>
              <Ionicons name="location-outline" size={12} color="#D1D5DB" />
              <Text style={styles.location}>{data?.location || 'Unknown'}</Text>
            </View>

            <View style={styles.statsRow}>
              <Ionicons name="star" size={12} color="#FBBF24" />
              <Text style={styles.statText}>
                <Text style={styles.statValue}>{data?.rating ? data.rating.toFixed(1) : '5.0'}</Text> ({data?.reviewCount || 0} reviews)
              </Text>
              <Ionicons name="people" size={12} color="#D1D5DB" style={{ marginLeft: 8 }} />
              <Text style={styles.statText}>
                <Text style={styles.statValue}>0</Text> Events
              </Text>
              <Ionicons name="calendar-outline" size={12} color="#D1D5DB" style={{ marginLeft: 8 }} />
              <Text style={styles.statText}>Since May 2026</Text>
            </View>

            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>AVAILABLE</Text>
            </View>
          </View>
        </View>

        {/* Lower White Background Section */}
        <View style={styles.contentArea}>
          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.id)}
                >
                  <Ionicons 
                    name={tab.icon} 
                    size={14} 
                    color={isActive ? 'white' : colors.textMuted} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.id}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'Overview' && (
              <>
                {/* Book Now Card */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderEyebrow}>AVAILABLE TO BOOK</Text>
                  <Pressable 
                    style={styles.bookButton}
                    onPress={() => bottomSheetRef.current?.expand()}
                  >
                    <Ionicons name="calendar" size={18} color="white" />
                    <Text style={styles.bookButtonText}>BOOK NOW</Text>
                  </Pressable>
                  <View style={styles.disclaimerRow}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
                    <Text style={styles.disclaimerText}>No payment to inquire</Text>
                  </View>
                </View>

                {/* Availability Preview */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderEyebrow}>AVAILABILITY</Text>
                  <CalendarPreview />
                </View>
              </>
            )}

            {activeTab === 'Portfolio' && (
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No portfolio images available yet.</Text>
              </View>
            )}

            {activeTab === 'Reviews' && (
              <View style={styles.reviewsContainer}>
                {reviews.data?.length ? (
                  reviews.data.map((r) => (
                    <View key={r.id} style={styles.reviewCard}>
                      <View style={styles.reviewTop}>
                        <Text style={styles.reviewer}>{r.reviewerName ?? 'Client'}</Text>
                        <Stars value={r.rating} />
                      </View>
                      {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No reviews yet.</Text>
                  </View>
                )}
              </View>
            )}

            {activeTab === 'Working Experience' && (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No working experience listed.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <BookingBottomSheet 
        ref={bottomSheetRef} 
        photographerId={id as string} 
        photographerName={data?.name}
        photographerImage={data?.avatar}
        packages={data?.packages || []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 10 },
  
  headerArea: {
    height: 480, // Substantial height for the cover and gradient
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topNav: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topNavRight: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfoContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#D4AF37', // Gold-ish border
    marginBottom: spacing.md,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  role: {
    fontSize: 13,
    color: '#D1D5DB',
    fontWeight: '500',
  },
  dot: {
    color: '#9CA3AF',
    marginHorizontal: 4,
  },
  location: {
    fontSize: 13,
    color: '#D1D5DB',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  statValue: {
    fontWeight: '700',
    color: 'white',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    gap: 6,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  availableText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  contentArea: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#083A85',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: 'white',
  },

  card: {
    backgroundColor: 'white',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardHeaderEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#083A85',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  bookButton: {
    backgroundColor: '#083A85',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.lg,
    gap: 8,
    marginBottom: spacing.md,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#6B7280',
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: -spacing.md,
  },
  monthText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  calendarContainer: {
    marginTop: 0,
  },
  calendarHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  calendarArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTextCenter: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayOfWeek: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  daySquare: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySquarePast: {
    backgroundColor: 'transparent',
  },
  daySquareAvailable: {
    backgroundColor: '#10B981', // Vibrant green
  },
  daySquareSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayTextPast: {
    color: '#D1D5DB',
  },
  dayTextAvailable: {
    color: 'white',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabContent: {
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: 'white',
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  reviewsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  reviewCard: {
    backgroundColor: 'white',
    padding: spacing.lg,
    borderRadius: radii.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: spacing.xs,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewer: {
    fontWeight: '600',
    color: colors.text,
    fontSize: fontSize.md,
  },
  reviewComment: {
    color: colors.textSoft,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
});
