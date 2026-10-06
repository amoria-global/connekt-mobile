import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { CandidateCard } from '@/features/hybrid/CandidateCard';
import { listEventCandidates, selectPhotographer, convertToHybridRescue } from '@/features/hybrid/api';
import type { CandidateSummary, CandidatesResponse } from '@/features/hybrid/types';
import { getEvent } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { isApiError } from '@/store/auth';
import { formatPrice } from '@/utils/format';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

export default function EventCandidatesScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const eventId = params.id || params.eventId || '';

  const [data, setData] = useState<CandidatesResponse | null>(null);
  const [eventDetails, setEventDetails] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [retryingMatching, setRetryingMatching] = useState(false);

  // Escrow payment state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payHandoff, setPayHandoff] = useState<{ declarationId: string; depositAmount?: number; currency?: string } | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSummary | null>(null);

  // Radar animation for empty state
  const radarWave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const waveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarWave, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(radarWave, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    waveLoop.start();
    return () => waveLoop.stop();
  }, [radarWave]);

  const fetchCandidates = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await listEventCandidates(eventId);
      setData(res);
    } catch (e) {
      console.warn('Could not fetch candidates:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  const fetchEventDetails = useCallback(async () => {
    if (!eventId) return;
    try {
      const ev = await getEvent(eventId);
      setEventDetails(ev);
    } catch {
      // Non-fatal
    }
  }, [eventId]);

  useEffect(() => {
    fetchCandidates();
    fetchEventDetails();
  }, [fetchCandidates, fetchEventDetails]);

  // Polling every 12 seconds if 0 candidates approved yet
  useEffect(() => {
    if (data && data.candidates && data.candidates.length > 0) return;
    const interval = setInterval(fetchCandidates, 12000);
    return () => clearInterval(interval);
  }, [data, fetchCandidates]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCandidates();
    fetchEventDetails();
  };

  const handleSelectCandidate = (candidate: CandidateSummary) => {
    Alert.alert(
      'Confirm Selection',
      `Book ${candidate.name} for your event? This reserves their schedule and secures your date with Connekyt Escrow deposit protection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Pay Deposit',
          onPress: async () => {
            setSelectingId(candidate.candidateId);
            try {
              const res = await selectPhotographer(eventId, {
                candidateId: candidate.candidateId,
                photographerId: candidate.photographerId,
                escrowPercentage: 50,
              });

              setSelectedCandidate(candidate);
              setPayHandoff({
                declarationId: res.declarationId,
                depositAmount: res.depositAmount,
                currency: res.currency,
              });
              setCheckoutOpen(true);
            } catch (e: any) {
              const msg = isApiError(e) ? e.message : 'Could not confirm photographer. Please try again.';
              Alert.alert('Selection Error', msg);
              fetchCandidates();
            } finally {
              setSelectingId(null);
            }
          },
        },
      ],
    );
  };

  const handleViewProfile = (candidate: CandidateSummary) => {
    router.push(`/photographer/${candidate.photographerId}` as never);
  };

  const candidates = data?.candidates ?? [];

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Navigation Bar with Connekyt Branding */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.topBarCenter}>
          <Text style={styles.screenTitle}>Approved Candidates</Text>
          <View style={styles.liveBadgeRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveBadgeText}>
              {candidates.length > 0 ? `${candidates.length} AVAILABLE` : 'BROADCASTING'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onRefresh}
          hitSlop={12}
          style={styles.refreshIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh candidates"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={20} color={colors.text} />
          )}
        </Pressable>
      </View>

      {/* Event Context Card (Real event brief data) */}
      {eventDetails && (
        <View style={styles.eventContextCard}>
          <View style={styles.eventContextTop}>
            <View style={styles.categoryPill}>
              <Ionicons name="sparkles" size={11} color={colors.primary} />
              <Text style={styles.categoryPillText}>
                {(eventDetails.category || 'Event').toUpperCase()}
              </Text>
            </View>
            <Text style={styles.eventContextDate}>{eventDetails.eventDate}</Text>
          </View>

          <Text style={styles.eventContextTitle} numberOfLines={1}>
            {eventDetails.title}
          </Text>

          <View style={styles.eventContextPills}>
            {eventDetails.location ? (
              <View style={styles.eventPill}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.eventPillText} numberOfLines={1}>
                  {eventDetails.location}
                </Text>
              </View>
            ) : null}

            {eventDetails.price ? (
              <View style={styles.eventPill}>
                <Ionicons name="cash-outline" size={12} color={colors.primary} />
                <Text style={[styles.eventPillText, { color: colors.primary, fontWeight: fontWeight.bold }]}>
                  {formatPrice(eventDetails.price, eventDetails.currency)} Budget
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching available local talent...</Text>
        </View>
      ) : candidates.length === 0 ? (
        (() => {
          const isTimedOut =
            eventDetails?.status?.toUpperCase() === 'HYBRID_TIMEOUT' ||
            data?.status?.toUpperCase() === 'EXPIRED';

          if (isTimedOut) {
            return (
              <View style={styles.emptyContainer}>
                <View style={[styles.radarCircle, { backgroundColor: '#FEF3C7', width: 72, height: 72, borderRadius: 36 }]}>
                  <Ionicons name="alert-circle" size={40} color="#D97706" />
                </View>

                <Text style={styles.emptyTitle}>Matching Window Concluded</Text>
                <Text style={styles.emptyDesc}>
                  No photographers accepted within the match window. You can easily switch to Direct Booking to browse and select available creators nearby on our interactive radar map.
                </Text>

                <View style={{ width: '100%', maxWidth: 340, gap: 10, marginTop: spacing.md }}>
                  <Pressable
                    style={[styles.refreshBtn, { backgroundColor: '#083A85' }]}
                    onPress={() => {
                      const lat = eventDetails?.latitude ?? -1.9536;
                      const lng = eventDetails?.longitude ?? 30.0606;
                      const date = eventDetails?.eventDate ? `&eventDate=${encodeURIComponent(eventDetails.eventDate)}` : '';
                      router.push(`/map?lat=${lat}&lng=${lng}${date}&radiusKm=25` as never);
                    }}
                  >
                    <Ionicons name="map-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.refreshBtnText}>Browse Nearby on Map</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.refreshBtn, { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderSoft }]}
                    onPress={() => router.push('/(app)/(tabs)/photographers' as never)}
                  >
                    <Ionicons name="list-outline" size={16} color={colors.text} />
                    <Text style={[styles.refreshBtnText, { color: colors.text }]}>Browse Creators List</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.refreshBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary }]}
                    disabled={retryingMatching}
                    onPress={async () => {
                      setRetryingMatching(true);
                      try {
                        await convertToHybridRescue(eventId);
                        Alert.alert('Matching Reactivated! 🚀', 'Your brief has been broadcast to local creators.');
                        onRefresh();
                      } catch (e) {
                        Alert.alert('Could not retry matching', isApiError(e) ? e.message : 'Please try again.');
                      } finally {
                        setRetryingMatching(false);
                      }
                    }}
                  >
                    {retryingMatching ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                        <Text style={[styles.refreshBtnText, { color: colors.primary }]}>Retry Hybrid Matching</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }

          return (
            <View style={styles.emptyContainer}>
              {/* Animated Pulsing Radar */}
              <View style={styles.radarWrapper}>
                <Animated.View
                  style={[
                    styles.radarWaveRing,
                    {
                      transform: [
                        {
                          scale: radarWave.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.2],
                          }),
                        },
                      ],
                      opacity: radarWave.interpolate({
                        inputRange: [0, 0.7, 1],
                        outputRange: [0.6, 0.25, 0],
                      }),
                    },
                  ]}
                />
                <View style={styles.radarCircle}>
                  <Ionicons name="radio" size={36} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.emptyTitle}>Inviting Local Photographers</Text>
              <Text style={styles.emptyDesc}>
                Your brief is being broadcast to top vetted creators. Photographers who accept your date and venue will appear here automatically.
              </Text>

              {/* 3-Step Live Dispatch Tracker */}
              <View style={styles.dispatchTracker}>
                <View style={styles.trackerStep}>
                  <View style={[styles.trackerDot, styles.trackerDotDone]}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                  <Text style={styles.trackerStepText}>1. Brief posted</Text>
                </View>

                <View style={styles.trackerDivider} />

                <View style={styles.trackerStep}>
                  <View style={[styles.trackerDot, styles.trackerDotActive]}>
                    <View style={styles.innerPulseDot} />
                  </View>
                  <Text style={[styles.trackerStepText, styles.trackerStepActiveText]}>
                    2. Creators reviewing
                  </Text>
                </View>

                <View style={styles.trackerDivider} />

                <View style={styles.trackerStep}>
                  <View style={styles.trackerDot}>
                    <Ionicons name="lock-closed-outline" size={10} color={colors.textMuted} />
                  </View>
                  <Text style={styles.trackerStepText}>3. Lock & book</Text>
                </View>
              </View>

              <View style={styles.tipBox}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.tipText}>
                  Responses usually arrive in 15–30 minutes. We&apos;ll notify you immediately when a photographer accepts.
                </Text>
              </View>

              <Pressable style={styles.refreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.refreshBtnText}>Check for Responses</Text>
              </Pressable>
            </View>
          );
        })()
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.candidateId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderWrap}>
              <View style={styles.listHeaderRow}>
                <Text style={styles.listHeaderTitle}>
                  {candidates.length} {candidates.length === 1 ? 'Creator' : 'Creators'} Ready to Shoot
                </Text>
                <Text style={styles.listHeaderSub}>Choose one to lock your date</Text>
              </View>

              {/* Escrow Trust Banner */}
              <View style={styles.escrowBanner}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                <Text style={styles.escrowBannerText}>
                  <Text style={{ fontWeight: fontWeight.bold, color: colors.text }}>100% Escrow Protected: </Text>
                  Your 50% deposit remains safely in escrow and is released only after you approve the final gallery.
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <CandidateCard
              candidate={item}
              onSelect={handleSelectCandidate}
              onViewProfile={handleViewProfile}
              selecting={selectingId === item.candidateId}
            />
          )}
        />
      )}

      {/* Shared Downstream Escrow Checkout */}
      {payHandoff && (
        <HandoffCheckoutSheet
          visible={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          handoff={{ type: 'BOOKING_DECLARATION', declarationId: payHandoff.declarationId }}
          title="Booking Deposit Escrow"
          subtitle={selectedCandidate?.name || 'Photographer'}
          amountLabel={formatPrice(payHandoff.depositAmount ?? 0, payHandoff.currency)}
          onSettled={() => {
            setCheckoutOpen(false);
            Alert.alert(
              'Booking Confirmed! 🎉',
              'Your deposit is securely held in Connekyt Escrow. The photographer has been locked for your date.',
              [
                {
                  text: 'View Event',
                  onPress: () => router.replace(`/event/${eventId}` as never),
                },
              ],
            );
          }}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  topBarCenter: {
    alignItems: 'center',
    gap: 2,
  },
  screenTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#059669',
    letterSpacing: 0.6,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  eventContextCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 6,
  },
  eventContextTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  categoryPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
    letterSpacing: 0.4,
  },
  eventContextDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  eventContextTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  eventContextPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  eventPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  eventPillText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textSoft,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  listHeaderWrap: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  listHeaderRow: {
    gap: 2,
  },
  listHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  listHeaderSub: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs + 1,
    color: c.textMuted,
  },
  escrowBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  escrowBannerText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textSoft,
    flex: 1,
    lineHeight: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  radarWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  radarWaveRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#083A85',
    backgroundColor: 'rgba(8, 58, 133, 0.1)',
  },
  radarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#083A85',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#083A85',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  dispatchTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    marginVertical: spacing.xs,
    gap: 8,
  },
  trackerStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trackerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerDotDone: {
    backgroundColor: '#10B981',
  },
  trackerDotActive: {
    backgroundColor: c.tint,
    borderWidth: 1.5,
    borderColor: c.primary,
  },
  innerPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  trackerStepText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  trackerStepActiveText: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  trackerDivider: {
    width: 12,
    height: 1,
    backgroundColor: c.borderSoft,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceMuted,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginVertical: spacing.xs,
    maxWidth: 340,
  },
  tipText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textSoft,
    flex: 1,
    lineHeight: 17,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.full,
    backgroundColor: '#083A85',
    shadowColor: '#083A85',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  refreshBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
}));

