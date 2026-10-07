import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { RefreshControl, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, Share, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet from '@gorhom/bottom-sheet';
import {
  bookmarkPhotographer,
  getPhotographer,
  getBookedDates,
  type BookedDate,
  listBookmarkedPhotographers,
  rebookPhotographer,
  reportPhotographer,
  unbookmarkPhotographer,
  type RebookInput,
} from '@/features/photographers/api';
import { CoverCarousel } from '@/features/photographers/CoverCarousel';
import { listPhotographerReviews } from '@/features/reviews/api';
import { useRole } from '@/features/auth/role';
import { useModeration } from '@/features/moderation/useModeration';
import { BookingBottomSheet } from '@/features/booking/BookingBottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isApiError } from '@/store/auth';
import { Stars } from '@/components/ui/Stars';
import { VerifiedAvatar } from '@/components/ui/VerifiedAvatar';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { PHOTOGRAPHER_COVER_PLACEHOLDER } from "@/utils/placeholders";
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';


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
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
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
  const [headerWidth, setHeaderWidth] = useState(400);

  const [activeTab, setActiveTab] = useState('Overview');
  const tabs = [
    { id: 'Overview', icon: 'grid' as const },
    { id: 'Portfolio', icon: 'images' as const },
    { id: 'Reviews', icon: 'chatbubbles' as const },
    { id: 'Working Experience', icon: 'briefcase' as const },
  ];

  // Derive carousel images from photographer profile
  const carouselImages = useMemo(() => {
    if (data?.images && data.images.length > 0) {
      return data.images;
    }
    if (data?.coverImage) {
      return [data.coverImage];
    }
    return [];
  }, [data?.images, data?.coverImage]);

  // Booked dates & availability calendar state
  const [bookedDates, setBookedDates] = useState<BookedDate[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  // Booked dates change when someone books this photographer; reload when
  // the screen comes back into focus and after the booking sheet closes,
  // instead of only on month change.
  const [calendarReload, setCalendarReload] = useState(0);
  useFocusEffect(useCallback(() => setCalendarReload((n) => n + 1), []));

  useEffect(() => {
    if (!id) return;
    const start = new Date(calendarMonth.year, calendarMonth.month, 1);
    const end = new Date(calendarMonth.year, calendarMonth.month + 2, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const toStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    let cancelled = false;
    getBookedDates(id, fromStr, toStr)
      .then((dates) => {
        if (!cancelled) setBookedDates(dates);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, calendarMonth.year, calendarMonth.month, calendarReload]);

  const now = new Date();
  const isCurrentMonth =
    calendarMonth.year === now.getFullYear() && calendarMonth.month <= now.getMonth();

  const handlePrevMonth = () => {
    if (isCurrentMonth) return;
    setCalendarMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  };

  const handleNextMonth = () => {
    setCalendarMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  };

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [calendarMonth]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const isDateBooked = useCallback(
    (day: number) => {
      const { year, month } = calendarMonth;
      const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
      return bookedDates.some((b) => {
        if (!b) return false;
        if (b.date === dateStr) return true;
        if (b.eventDate === dateStr) return true;
        return false;
      });
    },
    [calendarMonth, bookedDates]
  );

  const handleDatePress = (day: number) => {
    const { year, month } = calendarMonth;
    const targetDate = new Date(year, month, day);
    setSelectedCalendarDate(targetDate);
    bottomSheetRef.current?.snapToIndex(0);
  };

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


  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Cover Carousel & Header Overlay */}
        <View
          style={styles.headerArea}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setHeaderWidth(w);
          }}
        >
          <CoverCarousel images={carouselImages} width={headerWidth} />
          
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.95)']}
            locations={[0.1, 0.65, 1]}
            style={styles.gradient}
            pointerEvents="none"
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
            <VerifiedAvatar
              uri={data?.avatar}
              name={data?.name}
              size={90}
              verified={data?.isVerified !== false}
              style={styles.avatarWrapper}
            />

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
                    onPress={() => bottomSheetRef.current?.snapToIndex(0)}
                  >
                    <Ionicons name="calendar" size={18} color="white" />
                    <Text style={styles.bookButtonText}>BOOK NOW</Text>
                  </Pressable>
                  <View style={styles.disclaimerRow}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
                    <Text style={styles.disclaimerText}>No payment to inquire</Text>
                  </View>
                </View>

                {/* Availability Calendar Card */}
                <View style={styles.card}>
                  <View style={styles.calendarHeaderRow}>
                    <Text style={styles.cardHeaderEyebrow}>AVAILABILITY</Text>
                    
                    <View style={styles.monthNav}>
                      <Pressable 
                        onPress={handlePrevMonth} 
                        style={[styles.calendarArrowBtn, isCurrentMonth && styles.calendarArrowBtnDisabled]}
                        disabled={isCurrentMonth}
                        hitSlop={8}
                      >
                        <Ionicons 
                          name="chevron-back" 
                          size={14} 
                          color={isCurrentMonth ? colors.textMuted : colors.text} 
                        />
                      </Pressable>
                      
                      <Text style={styles.monthTitleText}>
                        {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>

                      <Pressable 
                        onPress={handleNextMonth} 
                        style={styles.calendarArrowBtn}
                        hitSlop={8}
                      >
                        <Ionicons name="chevron-forward" size={14} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Weekday labels */}
                  <View style={styles.weekdayRow}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, i) => (
                      <View key={i} style={styles.weekdayCell}>
                        <Text style={styles.weekdayText}>{wd}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Days grid */}
                  <View style={styles.calendarGrid}>
                    {calendarCells.map((day, i) => {
                      if (day === null) {
                        return <View key={`blank-${i}`} style={styles.calendarCell} />;
                      }

                      const dateStr = `${calendarMonth.year}-${pad(calendarMonth.month + 1)}-${pad(day)}`;
                      const isPast = dateStr < todayStr;
                      const isToday = dateStr === todayStr;
                      const booked = isDateBooked(day);
                      const isSelected = selectedCalendarDate &&
                        selectedCalendarDate.getFullYear() === calendarMonth.year &&
                        selectedCalendarDate.getMonth() === calendarMonth.month &&
                        selectedCalendarDate.getDate() === day;

                      const isAvailable = !isPast && !booked;

                      return (
                        <View key={`day-${day}`} style={styles.calendarCell}>
                          <Pressable
                            disabled={!isAvailable}
                            onPress={() => handleDatePress(day)}
                            style={[
                              styles.daySquare,
                              isPast && styles.daySquarePast,
                              isAvailable && styles.daySquareAvailable,
                              booked && styles.daySquareBooked,
                              isToday && styles.daySquareToday,
                              isSelected && styles.daySquareSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                isPast && styles.dayTextPast,
                                isAvailable && styles.dayTextAvailable,
                                booked && styles.dayTextBooked,
                                isToday && styles.dayTextToday,
                                isSelected && styles.dayTextSelected,
                              ]}
                            >
                              {day}
                            </Text>
                            {isAvailable && <View style={styles.dayDotAvailable} />}
                            {booked && <View style={styles.dayDotBooked} />}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>

                  {/* Legend */}
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.legendText}>Available (Tap to book)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.legendText}>Booked</Text>
                    </View>
                  </View>
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
        initialDate={selectedCalendarDate}
        onClose={() => setCalendarReload((n) => n + 1)}
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
                        {p.price ? ` · ${formatPrice(p.price, p.currency)}` : ''}
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
  container: { flex: 1, backgroundColor: c.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
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
    backgroundColor: c.surface,
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
  // Ring, seal and fallback live in VerifiedAvatar, shared with the card.
  avatarWrapper: {
    marginBottom: spacing.md,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
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
    color: '#E2E8F0',
    fontWeight: '500',
  },
  dot: {
    color: '#94A3B8',
    marginHorizontal: 4,
  },
  location: {
    fontSize: 13,
    color: '#E2E8F0',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  statValue: {
    fontWeight: '700',
    color: '#FFFFFF',
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
    backgroundColor: c.success,
  },
  availableText: {
    color: c.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  contentArea: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
    backgroundColor: c.background,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    gap: 6,
    ...e(1),
  },
  tabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
    color: c.primary,
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
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  availabilityBtnText: { color: c.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  bookButton: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radii.lg,
    gap: 8,
    marginBottom: spacing.md,
    ...e(2),
  },
  bookButtonText: {
    color: '#FFFFFF',
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
    color: c.textMuted,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarArrowBtnDisabled: {
    opacity: 0.35,
  },
  monthTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    minWidth: 90,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
    paddingBottom: 6,
    marginBottom: 6,
  },
  weekdayCell: {
    width: '14.28%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  daySquare: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  daySquarePast: {
    backgroundColor: 'transparent',
    opacity: 0.35,
  },
  daySquareAvailable: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  daySquareBooked: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  daySquareToday: {
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  daySquareSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text,
  },
  dayTextPast: {
    color: c.textMuted,
  },
  dayTextAvailable: {
    color: '#047857',
    fontWeight: '700',
  },
  dayTextBooked: {
    color: '#B91C1C',
    textDecorationLine: 'line-through',
  },
  dayTextToday: {
    color: c.primary,
    fontWeight: '800',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayDotAvailable: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10B981',
    position: 'absolute',
    bottom: 3,
  },
  dayDotBooked: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EF4444',
    position: 'absolute',
    bottom: 3,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: c.textMuted,
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    marginHorizontal: spacing.lg,
    borderRadius: radii.xl,
    ...e(1),
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
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
