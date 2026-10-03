/**
 * IncomingOpportunityAlertModal — Full-screen incoming shoot request overlay.
 *
 * Modeled after on-demand ride/gig incoming call screens (Uber / Bolt / CallKit):
 *   1. Screen takeover with pulsing radar ripple animations
 *   2. Haptic vibration alert pulse on reveal
 *   3. Prominent shoot brief: Title, Venue, Distance, Time, Duration & Earnings
 *   4. Live response countdown timer
 *   5. Dual phone-call-style actions:
 *      - 🟢 Giant Green Accept & Join Shortlist
 *      - 🔴 Decline & Pass to Next Creator
 *   6. Top right "Decide Later" dismiss to keep in Opportunities queue
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import type { PhotographerOpportunity } from './types';

type Props = {
  opportunity: PhotographerOpportunity | null;
  visible: boolean;
  onApprove: (opp: PhotographerOpportunity) => Promise<void> | void;
  onReject: (opp: PhotographerOpportunity) => Promise<void> | void;
  onDismiss: () => void;
};

export function IncomingOpportunityAlertModal({
  opportunity,
  visible,
  onApprove,
  onReject,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60); // 15 mins default

  // Radar wave animations
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Initialize vibration & looping pulse animation
  useEffect(() => {
    if (!visible || !opportunity) return;

    // Trigger phone vibration pulse (like incoming call)
    try {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 250, 150, 250]);
      }
    } catch {
      // Non-fatal if vibrations not supported
    }

    // Set countdown based on expiresAt or fallback to 15 mins
    if (opportunity.expiresAt) {
      const diffSecs = Math.max(
        0,
        Math.floor((new Date(opportunity.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diffSecs > 0 ? diffSecs : 15 * 60);
    } else {
      setSecondsLeft(15 * 60);
    }

    // Start radar wave animations
    const createWaveAnim = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const waveAnim1 = createWaveAnim(wave1, 0);
    const waveAnim2 = createWaveAnim(wave2, 1100);

    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    waveAnim1.start();
    waveAnim2.start();
    heartbeat.start();

    return () => {
      waveAnim1.stop();
      waveAnim2.stop();
      heartbeat.stop();
      wave1.setValue(0);
      wave2.setValue(0);
      pulseScale.setValue(1);
    };
  }, [visible, opportunity, wave1, wave2, pulseScale]);

  // Countdown timer
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible || !opportunity) return null;

  const handleApprove = async () => {
    try {
      setBusyAction('approve');
      await onApprove(opportunity);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    try {
      setBusyAction('reject');
      await onReject(opportunity);
    } finally {
      setBusyAction(null);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedCountdown = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const budgetDisplay =
    opportunity.minBudget != null && opportunity.maxBudget != null
      ? `${formatPrice(opportunity.minBudget, opportunity.currency)} – ${formatPrice(opportunity.maxBudget, opportunity.currency)}`
      : opportunity.maxBudget != null
        ? formatPrice(opportunity.maxBudget, opportunity.currency)
        : opportunity.minBudget != null
          ? formatPrice(opportunity.minBudget, opportunity.currency)
          : 'Competitive Rate';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        {/* Safe Area Container */}
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
          
          {/* Top Live Bar */}
          <View style={styles.topBar}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>INCOMING SHOOT REQUEST</Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              style={styles.dismissBtn}
              accessibilityLabel="Decide later"
            >
              <Text style={styles.dismissText}>Decide Later</Text>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Pulsing Radar Ring Hero */}
            <View style={styles.radarWrapper}>
              {/* Animated Ripple Wave 1 */}
              <Animated.View
                style={[
                  styles.radarWave,
                  {
                    transform: [
                      {
                        scale: wave1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2.4],
                        }),
                      },
                    ],
                    opacity: wave1.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.65, 0.3, 0],
                    }),
                  },
                ]}
              />

              {/* Animated Ripple Wave 2 */}
              <Animated.View
                style={[
                  styles.radarWave,
                  {
                    transform: [
                      {
                        scale: wave2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 2.4],
                        }),
                      },
                    ],
                    opacity: wave2.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.65, 0.3, 0],
                    }),
                  },
                ]}
              />

              {/* Center Pulsing Icon Circle */}
              <Animated.View
                style={[
                  styles.radarCenter,
                  { transform: [{ scale: pulseScale }] },
                ]}
              >
                <Ionicons name="camera" size={36} color="#FFFFFF" />
                <View style={styles.sparkleBadge}>
                  <Ionicons name="flash" size={12} color="#F59E0B" />
                </View>
              </Animated.View>
            </View>

            {/* Event Name & Type */}
            <View style={styles.titleSection}>
              {opportunity.eventType && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {opportunity.eventType.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.eventTitle}>{opportunity.eventTitle}</Text>
              <Text style={styles.subtitle}>
                You have been selected as a top verified candidate for this shoot.
              </Text>
            </View>

            {/* Earnings / Payout Card */}
            <View style={styles.earningsCard}>
              <View style={styles.earningsHeader}>
                <Ionicons name="cash-outline" size={16} color="#10B981" />
                <Text style={styles.earningsLabel}>ESTIMATED PAYOUT</Text>
              </View>
              <Text style={styles.earningsValue}>{budgetDisplay}</Text>
              <Text style={styles.earningsNote}>Escrow locked upon client confirmation</Text>
            </View>

            {/* Key Shoot Metrics (Distance, Time, Date) */}
            <View style={styles.metricsGrid}>
              {/* Distance */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="navigate" size={18} color="#3B82F6" />
                </View>
                <Text style={styles.metricValue}>
                  {opportunity.distanceKm != null ? `${opportunity.distanceKm.toFixed(1)} km` : 'Near you'}
                </Text>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  {opportunity.venue || opportunity.city || 'Location'}
                </Text>
              </View>

              {/* Date */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="calendar" size={18} color="#F59E0B" />
                </View>
                <Text style={styles.metricValue}>{opportunity.eventDate}</Text>
                <Text style={styles.metricLabel} numberOfLines={1}>Event Date</Text>
              </View>

              {/* Time & Duration */}
              <View style={styles.metricCard}>
                <View style={styles.metricIconWrap}>
                  <Ionicons name="time" size={18} color="#8B5CF6" />
                </View>
                <Text style={styles.metricValue}>
                  {opportunity.startTime?.slice(0, 5) || '18:00'}
                  {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''}
                </Text>
                <Text style={styles.metricLabel}>
                  {opportunity.durationHours ? `${opportunity.durationHours} hrs duration` : 'Scheduled Shoot'}
                </Text>
              </View>
            </View>

            {/* Why You Match Checklist */}
            <View style={styles.matchCard}>
              <Text style={styles.matchTitle}>Why this brief matches you:</Text>
              <View style={styles.matchItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.matchText}>Available on event schedule</Text>
              </View>
              <View style={styles.matchItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.matchText}>Matches your verified specialty</Text>
              </View>
              <View style={styles.matchItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.matchText}>Location is inside your coverage area</Text>
              </View>
            </View>

            {/* Countdown Clock */}
            <View style={styles.countdownRow}>
              <Ionicons name="hourglass-outline" size={15} color="#E2E8F0" />
              <Text style={styles.countdownText}>
                Response window: <Text style={styles.countdownBold}>{formattedCountdown}</Text> remaining
              </Text>
            </View>
          </ScrollView>

          {/* Action Call Bar (Like an incoming phone call) */}
          <View style={styles.actionSection}>
            {/* Decline Action */}
            <Pressable
              style={({ pressed }) => [
                styles.declineBtn,
                pressed && styles.btnPressed,
                busyAction === 'reject' && styles.btnDisabled,
              ]}
              onPress={handleReject}
              disabled={busyAction !== null}
            >
              <View style={styles.declineIconCircle}>
                <Ionicons name="close" size={24} color="#EF4444" />
              </View>
              <Text style={styles.declineBtnText}>
                {busyAction === 'reject' ? 'Declining...' : 'Decline'}
              </Text>
            </Pressable>

            {/* Accept Action (Large green phone-call style) */}
            <Pressable
              style={({ pressed }) => [
                styles.acceptBtn,
                pressed && styles.btnPressed,
                busyAction === 'approve' && styles.btnDisabled,
              ]}
              onPress={handleApprove}
              disabled={busyAction !== null}
            >
              <View style={styles.acceptIconCircle}>
                <Ionicons name="checkmark" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.acceptTextWrap}>
                <Text style={styles.acceptTitle}>
                  {busyAction === 'approve' ? 'Accepting...' : 'ACCEPT SHOOT'}
                </Text>
                <Text style={styles.acceptSub}>Join client candidate shortlist</Text>
              </View>
            </Pressable>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.96)',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#34D399',
    letterSpacing: 0.8,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  dismissText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#94A3B8',
  },
  scrollContent: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  radarWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  radarWave: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  radarCenter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  sparkleBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#1E293B',
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#0284C7',
  },
  titleSection: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  categoryBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.4)',
  },
  categoryBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#C4B5FD',
    letterSpacing: 0.6,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: fontWeight.extrabold,
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  earningsCard: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#10B981',
    letterSpacing: 0.8,
  },
  earningsValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: '#F0FDF4',
    letterSpacing: -0.3,
  },
  earningsNote: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: '#6EE7B7',
  },
  metricsGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.sm,
    alignItems: 'center',
    gap: 3,
  },
  metricIconWrap: {
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    fontWeight: fontWeight.bold,
    color: '#F1F5F9',
    textAlign: 'center',
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  matchCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: spacing.md,
    gap: 8,
  },
  matchTitle: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#CBD5E1',
    marginBottom: 2,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: '#94A3B8',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  countdownText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#CBD5E1',
  },
  countdownBold: {
    fontFamily: fonts.bold,
    color: '#F59E0B',
  },
  actionSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  declineBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    minWidth: 88,
    gap: 4,
  },
  declineIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FCA5A5',
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: '#10B981',
    borderRadius: radii.xl,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  acceptIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptTextWrap: {
    alignItems: 'flex-start',
  },
  acceptTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.extrabold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  acceptSub: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
}));
