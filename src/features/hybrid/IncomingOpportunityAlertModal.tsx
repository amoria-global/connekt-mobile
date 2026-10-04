/**
 * IncomingOpportunityAlertModal — Full-screen incoming shoot request overlay.
 *
 * Professional on-demand gig incoming alert:
 *   1. Solid, opaque obsidian midnight backdrop (no bleed-through)
 *   2. Instant, single-screen fit without scrolling
 *   3. Live countdown urgency timer in header
 *   4. Standout guaranteed payout card with Escrow assurance
 *   5. Clean logistics grid (date, time, venue, distance)
 *   6. Client brief / instructions callout
 *   7. Symmetrical, ergonomic Accept & Decline action bar
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
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
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);

  // Pulse animation for live badge
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Initialize vibration & looping pulse animation
  useEffect(() => {
    if (!visible || !opportunity) return;

    try {
      if (Platform.OS !== 'web') {
        Vibration.vibrate([0, 200, 150, 200]);
      }
    } catch {
      // Non-fatal
    }

    if (opportunity.expiresAt) {
      const diffSecs = Math.max(
        0,
        Math.floor((new Date(opportunity.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diffSecs > 0 ? diffSecs : 15 * 60);
    } else {
      setSecondsLeft(15 * 60);
    }

    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.15,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    heartbeat.start();

    return () => {
      heartbeat.stop();
      pulseScale.setValue(1);
    };
  }, [visible, opportunity, pulseScale]);

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
    opportunity.estimatedEarnings != null
      ? `${opportunity.currency || 'RWF'} ${opportunity.estimatedEarnings.toLocaleString()}`
      : opportunity.minBudget != null && opportunity.maxBudget != null
        ? `${formatPrice(opportunity.minBudget, opportunity.currency)} – ${formatPrice(opportunity.maxBudget, opportunity.currency)}`
        : opportunity.maxBudget != null
          ? formatPrice(opportunity.maxBudget, opportunity.currency)
          : opportunity.minBudget != null
            ? formatPrice(opportunity.minBudget, opportunity.currency)
            : 'Custom Quote';

  const formattedDate = (() => {
    if (!opportunity.eventDate) return 'Date TBD';
    try {
      const parts = opportunity.eventDate.slice(0, 10).split('-');
      if (parts.length === 3) {
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return opportunity.eventDate;
  })();

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onDismiss}>
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {/* 1. TOP STATUS & COUNTDOWN BAR */}
        <View style={styles.topBar}>
          <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseScale }] }]} />
            <Text style={styles.liveText}>NEW SHOOT</Text>
          </View>

          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color="#F59E0B" />
            <Text style={styles.timerText}>{formattedCountdown} left</Text>
          </View>

          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Dismiss to decide later"
          >
            <Ionicons name="close" size={18} color="#94A3B8" />
          </Pressable>
        </View>

        {/* 2. BODY CONTENT (FIT VIEWPORT) */}
        <View style={styles.contentWrap}>
          {/* EVENT CATEGORY & TITLE */}
          <View style={styles.eventHeader}>
            <View style={styles.categoryPill}>
              <Ionicons name="camera-outline" size={12} color="#60A5FA" />
              <Text style={styles.categoryText}>
                {(opportunity.eventType || 'PHOTOGRAPHY').toUpperCase()}
              </Text>
            </View>

            <Text style={styles.eventTitle} numberOfLines={2}>
              {opportunity.eventTitle}
            </Text>

            {opportunity.clientName ? (
              <View style={styles.clientRow}>
                <Ionicons name="person-circle-outline" size={13} color="#94A3B8" />
                <Text style={styles.clientText}>Client: {opportunity.clientName}</Text>
              </View>
            ) : null}
          </View>

          {/* HERO PAYOUT CARD */}
          <View style={styles.payoutCard}>
            <View style={styles.payoutHeader}>
              <Text style={styles.payoutLabel}>GUARANTEED EARNINGS</Text>
              {opportunity.escrowGuaranteed && (
                <View style={styles.escrowBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#10B981" />
                  <Text style={styles.escrowBadgeText}>ESCROW LOCKED</Text>
                </View>
              )}
            </View>

            <Text style={styles.payoutAmount}>{budgetDisplay}</Text>
            <Text style={styles.payoutSubtext}>
              50% deposit held safely in escrow before you head out
            </Text>
          </View>

          {/* LOGISTICS TILES (DATE & TIME + VENUE & LOCATION) */}
          <View style={styles.logisticsContainer}>
            {/* Tile 1: Date & Time */}
            <View style={styles.logisticsTile}>
              <View style={styles.logisticsIconBox}>
                <Ionicons name="calendar-outline" size={17} color="#F59E0B" />
              </View>
              <View style={styles.logisticsTextWrap}>
                <Text style={styles.logisticsPrimary}>{formattedDate}</Text>
                <Text style={styles.logisticsSecondary}>
                  {opportunity.startTime?.slice(0, 5)}
                  {opportunity.endTime ? ` – ${opportunity.endTime.slice(0, 5)}` : ''}
                  {opportunity.durationHours ? ` (${opportunity.durationHours} hrs)` : ''}
                </Text>
              </View>
            </View>

            {/* Tile 2: Venue & Location */}
            <View style={styles.logisticsTile}>
              <View style={styles.logisticsIconBox}>
                <Ionicons name="location-outline" size={17} color="#38BDF8" />
              </View>
              <View style={styles.logisticsTextWrap}>
                <Text style={styles.logisticsPrimary} numberOfLines={1}>
                  {opportunity.venue || opportunity.city || 'Kigali'}
                </Text>
                <Text style={styles.logisticsSecondary} numberOfLines={1}>
                  {opportunity.eventAddress || opportunity.city || 'Venue Location'}
                  {opportunity.distanceKm != null ? ` • ${opportunity.distanceKm.toFixed(1)} km away` : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* CLIENT INSTRUCTIONS CALLOUT (OR MATCH ASSURANCE) */}
          {opportunity.instructions ? (
            <View style={styles.instructionsBox}>
              <View style={styles.instructionsHeader}>
                <Ionicons name="document-text-outline" size={13} color="#93C5FD" />
                <Text style={styles.instructionsLabel}>CLIENT SPECIAL INSTRUCTIONS</Text>
              </View>
              <Text style={styles.instructionsText} numberOfLines={3}>
                "{opportunity.instructions}"
              </Text>
            </View>
          ) : (
            <View style={styles.matchAssurance}>
              <Ionicons name="sparkles" size={14} color="#10B981" />
              <Text style={styles.matchAssuranceText}>
                Matches your verified specialties, rate preferences, and calendar availability.
              </Text>
            </View>
          )}
        </View>

        {/* 3. SYMMETRICAL ACTION BUTTONS */}
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.declineBtn,
              pressed && styles.btnPressed,
              busyAction === 'reject' && styles.btnDisabled,
            ]}
            onPress={handleReject}
            disabled={busyAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Decline shoot"
          >
            <Ionicons name="close" size={18} color="#EF4444" />
            <Text style={styles.declineBtnText}>
              {busyAction === 'reject' ? 'Declining...' : 'Decline'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && styles.btnPressed,
              busyAction === 'approve' && styles.btnDisabled,
            ]}
            onPress={handleApprove}
            disabled={busyAction !== null}
            accessibilityRole="button"
            accessibilityLabel="Accept shoot and join shortlist"
          >
            <Ionicons name="checkmark-sharp" size={20} color="#FFFFFF" />
            <Text style={styles.acceptBtnText}>
              {busyAction === 'approve' ? 'Accepting...' : 'Accept Shoot'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: '#060B14',
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#34D399',
    letterSpacing: 0.6,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#F59E0B',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  eventHeader: {
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8, 58, 133, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  categoryText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: '#93C5FD',
    letterSpacing: 0.6,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  clientText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#94A3B8',
  },
  payoutCard: {
    backgroundColor: '#0B132B',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(8, 58, 133, 0.45)',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#083A85',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payoutLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  escrowBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#34D399',
    letterSpacing: 0.5,
  },
  payoutAmount: {
    fontFamily: fonts.bold,
    fontSize: 32,
    fontWeight: fontWeight.extrabold,
    color: '#10B981',
    letterSpacing: -0.5,
  },
  payoutSubtext: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  logisticsContainer: {
    gap: spacing.sm,
  },
  logisticsTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  logisticsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logisticsTextWrap: {
    flex: 1,
    gap: 2,
  },
  logisticsPrimary: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#F1F5F9',
  },
  logisticsSecondary: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: '#94A3B8',
  },
  instructionsBox: {
    backgroundColor: 'rgba(8, 58, 133, 0.14)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.35)',
    padding: spacing.sm + 2,
    gap: 4,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  instructionsLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#93C5FD',
    letterSpacing: 0.5,
  },
  instructionsText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#E2E8F0',
    lineHeight: 17,
  },
  matchAssurance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: radii.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  matchAssuranceText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  declineBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#EF4444',
  },
  acceptBtn: {
    flex: 1.6,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
}));
