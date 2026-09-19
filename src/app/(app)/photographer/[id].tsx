import React, { useCallback, useState, useRef, useEffect } from 'react';
import { RefreshControl, ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  bookmarkPhotographer,
  getPhotographer,
  listBookmarkedPhotographers,
  rebookPhotographer,
  reportPhotographer,
  unbookmarkPhotographer,
  type RebookInput,
} from '@/features/photographers/api';
import { listPhotographerReviews } from '@/features/reviews/api';
import { useRole } from '@/features/auth/role';
import { useModeration } from '@/features/moderation/useModeration';
import { BookingBottomSheet } from '@/features/booking/BookingBottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isApiError } from '@/store/auth';
import { Stars } from '@/components/ui/Stars';
import { useAsync } from '@/hooks/useAsync';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { PHOTOGRAPHER_COVER_PLACEHOLDER } from "@/utils/placeholders";

let hasAutoShownWizard = false;

function IconButton({ icon, onPress, style }: { icon: keyof typeof Feather.glyphMap; onPress?: () => void; style?: any }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable style={[styles.iconButton, style]} onPress={onPress}>
      <Feather name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

const REPORT_REASONS = [
  'Inappropriate content',
  'No-show',
  'Poor communication',
  'Quality issues',
  'Misleading profile',
  'Other',
];

export default function PhotographerProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isCoordinator } = useRole();
  const isBlocked = useModeration((st) => st.blockedIds.has(id));
  const block = useModeration((st) => st.block);
  const unblock = useModeration((st) => st.unblock);
  const loadModeration = useModeration((st) => st.load);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Rebook state
  const [rebookOpen, setRebookOpen] = useState(false);
  const [rebookPackageId, setRebookPackageId] = useState('');
  const [rebookTitle, setRebookTitle] = useState('');
  const [rebookDate, setRebookDate] = useState('');
  const [rebookStart, setRebookStart] = useState('');
  const [rebookEnd, setRebookEnd] = useState('');
  const [rebookLocation, setRebookLocation] = useState('');
  const [rebookNotes, setRebookNotes] = useState('');
  const [rebookSubmitting, setRebookSubmitting] = useState(false);

  // Hydrate the block list so the menu shows Block vs Unblock correctly.
  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  // Hydrate bookmark state on mount. Best-effort: a failure here just
  // leaves the button in the not-bookmarked default; we don't tank the
  // profile view.
  useEffect(() => {
    let cancelled = false;
    listBookmarkedPhotographers()
      .then((rows) => {
        if (!cancelled) setIsBookmarked(rows.some((r) => r.id === id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

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

  const toggleBookmark = async () => {
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const next = !isBookmarked;
    try {
      if (next) await bookmarkPhotographer(id);
      else await unbookmarkPhotographer(id);
      setIsBookmarked(next);
    } catch (e) {
      Alert.alert('Could not update bookmark', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBookmarkBusy(false);
    }
  };

  const submitReport = async () => {
    setReportSubmitting(true);
    try {
      await reportPhotographer(id, reportReason, reportDescription);
      setReportOpen(false);
      setReportDescription('');
      Alert.alert('Report submitted', 'Our team will review the report shortly.');
    } catch (e) {
      Alert.alert('Could not submit report', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const submitRebook = async () => {
    if (!rebookPackageId) {
      Alert.alert('Pick a package', 'Choose one of the photographer’s packages first.');
      return;
    }
    if (!rebookTitle.trim() || !rebookDate.trim() || !rebookStart.trim() || !rebookEnd.trim() || !rebookLocation.trim()) {
      Alert.alert('Missing fields', 'Title, date, start/end time, and location are required.');
      return;
    }
    setRebookSubmitting(true);
    try {
      const input: RebookInput = {
        photographerId: id,
        packageId: rebookPackageId,
        title: rebookTitle,
        eventDate: rebookDate,
        startTime: rebookStart.length === 5 ? `${rebookStart}:00` : rebookStart,
        endTime: rebookEnd.length === 5 ? `${rebookEnd}:00` : rebookEnd,
        location: rebookLocation,
        notes: rebookNotes,
      };
      await rebookPhotographer(input, isCoordinator);
      setRebookOpen(false);
      Alert.alert('Rebook submitted', 'Your rebooking request has been sent to the photographer.');
    } catch (e) {
      Alert.alert('Could not rebook', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setRebookSubmitting(false);
    }
  };

  const onBlock = () => {
    Alert.alert(
      `Block ${data?.name ?? 'this photographer'}?`,
      "They won't be able to message you, and you won't see their content.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await block(id);
            } catch (e) {
              Alert.alert('Could not block', isApiError(e) ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  // Long-press → action menu. Report AND block, matching every other
  // user-profile surface (Play requires both for user-to-user content).
  const onLongPressHeader = () => {
    Alert.alert('Photographer actions', undefined, [
      { text: 'Rebook', onPress: () => setRebookOpen(true) },
      { text: 'Report', style: 'destructive', onPress: () => setReportOpen(true) },
      isBlocked
        ? { text: 'Unblock', onPress: () => void unblock(id) }
        : { text: 'Block', style: 'destructive' as const, onPress: onBlock },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
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
    : PHOTOGRAPHER_COVER_PLACEHOLDER;

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
              <IconButton icon="more-horizontal" style={{ marginRight: 8 }} onPress={onLongPressHeader} />
              <IconButton icon="share-2" style={{ marginRight: 8 }} onPress={handleShare} />
              <IconButton
                icon="bookmark"
                onPress={toggleBookmark}
                style={isBookmarked ? { backgroundColor: colors.primary } : {}}
              />
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

                {/* Availability — confirmed against the real calendar at booking
                    time (the backend rejects a taken date), so we don't show a
                    fabricated month here. */}
                <View style={styles.card}>
                  <Text style={styles.cardHeaderEyebrow}>AVAILABILITY</Text>
                  <Text style={styles.availabilityBody}>
                    Pick your event date in the booking form, and we check this photographer is
                    free for that day before you pay anything.
                  </Text>
                  <Pressable
                    style={styles.availabilityBtn}
                    onPress={() => bottomSheetRef.current?.expand()}
                  >
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={styles.availabilityBtnText}>Check a date &amp; book</Text>
                  </Pressable>
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

      {/* Report photographer sheet */}
      <Modal
        visible={reportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setReportOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Report photographer</Text>
            <Text style={styles.sheetHint}>
              Pick a reason and add details so our team can take action.
            </Text>
            <View style={styles.chipRow}>
              {REPORT_REASONS.map((r) => {
                const active = r === reportReason;
                return (
                  <Pressable
                    key={r}
                    onPress={() => setReportReason(r)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              placeholder="Describe what happened (optional)"
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
              style={styles.modalInput}
            />
            <Button title="Submit report" onPress={submitReport} loading={reportSubmitting} />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rebook sheet — only enabled if there are packages */}
      <Modal
        visible={rebookOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRebookOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRebookOpen(false)}>
          <Pressable style={[styles.sheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>Rebook photographer</Text>
              <Text style={styles.sheetHint}>
                Book this photographer again for a new event. Backend enforces that you’ve worked
                with them before.
              </Text>
              <Text style={styles.formLabel}>Package</Text>
              <View style={styles.chipRow}>
                {(data?.packages ?? []).map((p) => {
                  const active = p.id === rebookPackageId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setRebookPackageId(p.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {p.name}
                        {p.price ? ` · ${p.currency ?? ''} ${p.price}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input
                label="Event title"
                value={rebookTitle}
                onChangeText={setRebookTitle}
                placeholder="e.g. Eric & Diana Reception"
                style={styles.modalInput}
              />
              <Input
                label="Event date (YYYY-MM-DD)"
                value={rebookDate}
                onChangeText={setRebookDate}
                placeholder="2026-08-12"
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <Input
                label="Start time (HH:mm)"
                value={rebookStart}
                onChangeText={setRebookStart}
                placeholder="15:00"
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <Input
                label="End time (HH:mm)"
                value={rebookEnd}
                onChangeText={setRebookEnd}
                placeholder="20:00"
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <Input
                label="Location"
                value={rebookLocation}
                onChangeText={setRebookLocation}
                placeholder="Venue + city"
                style={styles.modalInput}
              />
              <Input
                label="Notes (optional)"
                value={rebookNotes}
                onChangeText={setRebookNotes}
                multiline
                style={styles.modalInput}
              />
              <Button
                title={rebookSubmitting ? 'Sending…' : 'Submit rebook'}
                onPress={submitRebook}
                loading={rebookSubmitting}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
  muted: { color: c.textMuted, fontSize: fontSize.sm, marginTop: 10 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  sheetHint: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  formLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.textSoft, marginTop: spacing.sm, letterSpacing: 0.4 },
  modalInput: { marginTop: spacing.sm },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.xs, color: c.textSoft, fontWeight: fontWeight.semibold },
  chipTextActive: { color: c.textOnPrimary },
  
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
    ...StyleSheet.absoluteFill,
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
    ...e(3),
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
    backgroundColor: c.primary,
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
    color: c.textMuted,
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
    ...e(1),
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
  availabilityBody: {
    fontSize: fontSize.sm,
    color: c.textSoft,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  availabilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  availabilityBtnText: { color: c.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
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
    color: c.text,
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
    color: c.primary,
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
    borderColor: c.primary,
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
    color: c.textMuted,
  },
  reviewsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  reviewCard: {
    backgroundColor: 'white',
    padding: spacing.lg,
    borderRadius: radii.xl,
    ...e(1),
    gap: spacing.xs,
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewer: {
    fontWeight: '600',
    color: c.text,
    fontSize: fontSize.md,
  },
  reviewComment: {
    color: c.textSoft,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
  },
}));
