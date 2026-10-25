/**
 * IncomingOpportunityAlertModal — Full-screen incoming shoot request overlay.
 *
 * Connekyt Branded On-Demand Shoot Incoming Alert:
 *   1. Follows official Connekyt palette (Royal Navy #083A85, Accent Pink #F20C8F)
 *   2. Instant, single-screen fit without scrolling
 *   3. Live countdown urgency timer in header
 *   4. The client's budget, labelled as a budget (nothing is held until the client books and pays)
 *   5. Clean logistics grid (date, time, venue, distance) with matching brand icons
 *   6. Client brief / instructions callout
 *   7. Symmetrical, ergonomic Accept (Connekyt Royal Navy) & Decline action bar
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from '@/utils/safeAudio';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useSharedT } from '@/i18n/sharedStrings';
import type { PhotographerOpportunity } from './types';
import { countdownString, useCountdown } from './hybridUi';

const RINGTONE = require('../../../assets/sounds/connekyt_ringtone.wav');

/** Stop ringing after this long even if nobody answers; the alert stays up. */
const MAX_RING_MS = 30_000;

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
  const { tr } = useSharedT();

  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);

  // Pulse animation for live badge
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Ring while the alert is up. The push only rings when the app is in the
  // background; with the app open this modal is the alert, and it used to
  // just vibrate once. Silent mode is respected (playsInSilentMode is off).
  const ringtone = useRef<AudioPlayer | null>(null);
  const stopRinging = useCallback(() => {
    ringtone.current?.pause();
  }, []);

  const ringingFor = visible ? opportunity?.candidateId : undefined;
  useEffect(() => {
    if (!ringingFor || Platform.OS === 'web') return;
    let player: AudioPlayer | null = null;
    try {
      void setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
      });
      player = createAudioPlayer(RINGTONE);
      player.loop = true;
      player.play();
      ringtone.current = player;
    } catch {
      // Non-fatal: the alert still shows and vibrates
    }
    const cap = setTimeout(() => player?.pause(), MAX_RING_MS);
    return () => {
      clearTimeout(cap);
      player?.remove();
      ringtone.current = null;
    };
  }, [ringingFor]);

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

    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.18,
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

  // The invite's own deadline, on the server's clock.
  const left = useCountdown(
    visible ? (opportunity?.responseDeadlineAt || opportunity?.candidateExpiresAt || opportunity?.expiresAt) : null,
  );

  if (!visible || !opportunity) return null;

  const handleApprove = async () => {
    stopRinging();
    try {
      setBusyAction('approve');
      await onApprove(opportunity);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    stopRinging();
    try {
      setBusyAction('reject');
      await onReject(opportunity);
    } finally {
      setBusyAction(null);
    }
  };

  const formattedCountdown = left ? countdownString(left, 'Time is up') : '';

  const budgetDisplay =
    opportunity.minBudget != null && opportunity.maxBudget != null
        ? `${formatPrice(opportunity.minBudget, opportunity.currency)} – ${formatPrice(opportunity.maxBudget, opportunity.currency)}`
        : opportunity.maxBudget != null
          ? formatPrice(opportunity.maxBudget, opportunity.currency)
          : opportunity.minBudget != null
            ? formatPrice(opportunity.minBudget, opportunity.currency)
            : 'Not shared';

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
            <Text style={styles.liveText}>{tr('NEW NEARBY OPPORTUNITY')}</Text>
          </View>

          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={styles.timerText}>{left?.done ? formattedCountdown : `${formattedCountdown} to answer`}</Text>
          </View>

          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={tr('Close')}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* 2. BODY CONTENT (FIT VIEWPORT) */}
        <View style={styles.contentWrap}>
          {/* EVENT CATEGORY & TITLE */}
          <View style={styles.eventHeader}>
            <View style={styles.categoryPill}>
              <Ionicons name="camera-outline" size={12} color={colors.primary} />
              <Text style={styles.categoryText}>
                {(opportunity.eventType || 'PHOTOGRAPHY').toUpperCase()}
              </Text>
            </View>

            <Text style={styles.eventTitle} numberOfLines={2}>
              {opportunity.eventTitle}
            </Text>

            <View style={styles.clientRow}>
              <Ionicons name="radio-outline" size={13} color={colors.textMuted} />
              <Text style={styles.clientText}>{tr('Post My Event · you were matched to this event')}</Text>
            </View>
          </View>

          {/* HERO PAYOUT CARD */}
          <View style={styles.payoutCard}>
            <View style={styles.payoutHeader}>
              <Text style={styles.payoutLabel}>{tr("CLIENT'S BUDGET")}</Text>
              <View style={styles.escrowBadge}>
                <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                <Text style={styles.escrowBadgeText}>{tr('PAID VIA ESCROW IF CHOSEN')}</Text>
              </View>
            </View>

            <Text style={styles.payoutAmount}>{budgetDisplay}</Text>
          </View>

          {/* LOGISTICS TILES (DATE & TIME + VENUE & LOCATION) */}
          <View style={styles.logisticsContainer}>
            {/* Tile 1: Date & Time */}
            <View style={styles.logisticsTile}>
              <View style={styles.logisticsIconBox}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
              </View>
              <View style={styles.logisticsTextWrap}>
                <Text style={styles.logisticsPrimary}>{formattedDate}</Text>
                <Text style={styles.logisticsSecondary}>
                  {opportunity.startTime?.slice(0, 5)}
                  {opportunity.endTime ? ` – ${opportunity.endTime.slice(0, 5)}` : ''}
                  {opportunity.durationLabel ? ` · ${opportunity.durationLabel}` : ''}
                </Text>
              </View>
            </View>

            {/* Tile 2: Venue & Location */}
            <View style={styles.logisticsTile}>
              <View style={styles.logisticsIconBox}>
                <Ionicons name="location-outline" size={17} color={colors.primary} />
              </View>
              <View style={styles.logisticsTextWrap}>
                <Text style={styles.logisticsPrimary} numberOfLines={2}>
                  {opportunity.city || opportunity.venue || 'Location shared on booking'}
                </Text>
                <Text style={styles.logisticsSecondary} numberOfLines={2}>
                  {opportunity.distanceLabel || opportunity.venue || ''}
                </Text>
              </View>
            </View>
          </View>

          {/* WHAT WAS MATCHED (from the server) */}
          {opportunity.matchReasons && opportunity.matchReasons.length > 0 ? (
            <View style={styles.instructionsBox}>
              {opportunity.matchReasons.slice(0, 4).map((reason) => (
                <View key={reason} style={styles.instructionsHeader}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                  <Text style={styles.instructionsText} numberOfLines={2}>{reason}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* CLIENT INSTRUCTIONS CALLOUT (ONLY IF SPECIFIED) */}
          {opportunity.instructions ? (
            <View style={styles.instructionsBox}>
              <View style={styles.instructionsHeader}>
                <Ionicons name="document-text-outline" size={13} color={colors.primary} />
                <Text style={styles.instructionsLabel}>CLIENT SPECIAL INSTRUCTIONS</Text>
              </View>
              <Text style={styles.instructionsText} numberOfLines={3}>
                "{opportunity.instructions}"
              </Text>
            </View>
          ) : null}
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
            accessibilityLabel="Not this time"
          >
            <Ionicons name="close" size={18} color={colors.textSoft} />
            <Text style={styles.declineBtnText}>
              {busyAction === 'reject' ? 'Sending...' : 'Not this time'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && styles.btnPressed,
              busyAction === 'approve' && styles.btnDisabled,
            ]}
            onPress={handleApprove}
            disabled={busyAction !== null || !!left?.done}
            accessibilityRole="button"
            accessibilityLabel="Yes, I'm available. The client will see you and can choose you."
          >
            <Ionicons name="checkmark-sharp" size={20} color={colors.textOnPrimary} />
            <Text style={styles.acceptBtnText}>
              {busyAction === 'approve' ? 'Sending...' : "Yes, I'm available"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flex: 1,
    backgroundColor: c.background,
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
    backgroundColor: c.tintAccent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.25)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.accent,
  },
  liveText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.accent,
    letterSpacing: 0.8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.15)',
  },
  timerText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surfaceMuted,
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
    gap: 5,
    backgroundColor: c.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
  },
  categoryText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.8,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: c.text,
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
    color: c.textMuted,
  },
  payoutCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 6,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payoutLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  escrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
  },
  escrowBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: c.primary,
    letterSpacing: 0.5,
  },
  payoutAmount: {
    fontFamily: fonts.bold,
    fontSize: 32,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: -0.5,
  },
  logisticsContainer: {
    gap: spacing.sm,
  },
  logisticsTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  logisticsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.tint,
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
    color: c.text,
  },
  logisticsSecondary: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },
  instructionsBox: {
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
    padding: spacing.sm + 3,
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
    color: c.primary,
    letterSpacing: 0.6,
  },
  instructionsText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textSoft,
    lineHeight: 17,
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
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  acceptBtn: {
    flex: 1.6,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: c.textOnPrimary,
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
