/**
 * IncomingOpportunityAlertModal: what a photographer sees for a new offer.
 *
 * 'ringing': the incoming-call screen. Accept and Decline both open the offer details.
 * 'details': the offer, with the client's price, the photographer's own package, what was asked for, and three
 * answers: Accept (on the client's schedule), Accept with my delivery terms (on the package's schedule), Decline.
 *
 * Colours, fonts and radii come from the app theme (makeStyles), so it follows Midnight Glass, in dark and light.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from '@/utils/safeAudio';
import { fonts, fontSize, fontWeight, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
import { serverNowMs } from './api';
import { parseOpportunityOfferBrief } from './offerBrief';
import { OfferDetailsView } from './OfferDetailsView';
import { timeLeft } from './countdown';
import type { OpportunityDeliveryPolicy, PhotographerOpportunity } from './types';
import { useSharedT } from '@/i18n/sharedStrings';

const RINGTONE = require('../../../assets/sounds/connekyt_ringtone.wav');

/** Ringing duration: 47 seconds as required. */
export const OPPORTUNITY_RING_DURATION_SECONDS = 47;
export const OPPORTUNITY_RING_DURATION_MS = OPPORTUNITY_RING_DURATION_SECONDS * 1000;

/** Offer remains available for 2 hours before permanently disappearing. */
export const OPPORTUNITY_AVAILABILITY_WINDOW_MS = 2 * 60 * 60 * 1000;

const HERO_COVER_URI =
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80';

/** Money as the rest of the app writes it: the code, then the amount. */
const money = (amount: number, currency?: string | null) =>
  `${currency || 'RWF'} ${Math.round(amount).toLocaleString('en-US')}`;

/** "Wedding · kigali" reads "Wedding · Kigali": a capital at the start of each word. */
const titleCase = (text: string) => text.replace(/(^|[\s·•-]+)([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

interface Props {
  opportunity: PhotographerOpportunity | null;
  visible: boolean;
  /** 'ringing' starts with the 47s incoming call screen; 'details' opens directly to Offer details. */
  initialStage?: 'ringing' | 'details';
  onApprove: (
    opp: PhotographerOpportunity,
    deliveryPolicy?: OpportunityDeliveryPolicy,
  ) => Promise<void> | void;
  onReject: (opp: PhotographerOpportunity) => Promise<void> | void;
  onDismiss: () => void;
  /** Invoked when photographer clicks Accept/Decline on the ringing call to open the Offer Details page. */
  onOpenOfferPage?: (opp: PhotographerOpportunity) => void;
}


export function IncomingOpportunityAlertModal({
  opportunity,
  visible,
  initialStage = 'details',
  onApprove,
  onReject,
  onDismiss,
  onOpenOfferPage,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();

  const [stage, setStage] = useState<'ringing' | 'details'>(initialStage);
  const [, setRingSecondsLeft] = useState<number>(OPPORTUNITY_RING_DURATION_SECONDS);
  const [busyAction, setBusyAction] = useState<
    'accept_client' | 'accept_package' | 'reject' | null
  >(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const pulseAnim = useSharedValue(1);
  // The ring effect must not restart (ringtone, 47s clock) just because the parent passed a new callback.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const stopRinging = useCallback(() => {
    try {
      playerRef.current?.pause();
    } catch {
      // ignore
    }
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
  }, []);

  // Reset stage when a new opportunity opens
  useEffect(() => {
    if (visible && opportunity) {
      setStage(initialStage);
      setRingSecondsLeft(OPPORTUNITY_RING_DURATION_SECONDS);
      setBusyAction(null);
    }
  }, [visible, opportunity?.candidateId, initialStage]);

  // 2-hour expiry countdown ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!visible || !opportunity) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [visible, opportunity]);

  // 47-second ringing timer + ringtone audio + vibration when in 'ringing' stage
  useEffect(() => {
    if (!visible || !opportunity || stage !== 'ringing') {
      stopRinging();
      pulseAnim.value = 1;
      return;
    }

    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );

    let p: AudioPlayer | null = null;
    try {
      if (Platform.OS !== 'web') {
        void setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: 'mixWithOthers',
        });
      }
      p = createAudioPlayer(RINGTONE);
      p.loop = true;
      p.play();
      playerRef.current = p;
    } catch {
      // Fallback to vibration if audio fails
    }
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 600, 350, 600, 350, 600], true);
    }

    const startedAt = Date.now();
    const countdownTimer = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const remainingSec = Math.max(
        0,
        Math.ceil((OPPORTUNITY_RING_DURATION_MS - elapsedMs) / 1000),
      );
      setRingSecondsLeft(remainingSec);
      if (elapsedMs >= OPPORTUNITY_RING_DURATION_MS) {
        clearInterval(countdownTimer);
        stopRinging();
        // After 47 seconds of ringing, stop ringing and dismiss the call overlay;
        // the offer stays available for 2 hours in notifications & Opportunities tab.
        onDismissRef.current();
      }
    }, 250);

    return () => {
      clearInterval(countdownTimer);
      if (Platform.OS !== 'web') {
        Vibration.cancel();
      }
      p?.remove();
      playerRef.current = null;
    };
  }, [visible, opportunity?.candidateId, stage, pulseAnim, stopRinging]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const brief = useMemo(
    () => (opportunity ? parseOpportunityOfferBrief(opportunity) : null),
    [opportunity],
  );

  if (!opportunity || !brief) return null;

  // 2-hour expiry calculation (defaults to invitedAt + 2 hours if responseDeadlineAt is missing)
  const effectiveDeadline =
    opportunity.responseDeadlineAt ??
    opportunity.candidateExpiresAt ??
    (opportunity.invitedAt
      ? new Date(Date.parse(opportunity.invitedAt) + OPPORTUNITY_AVAILABILITY_WINDOW_MS).toISOString()
      : undefined);
  const left = timeLeft(effectiveDeadline, serverNowMs());

  const currency = opportunity.currency || 'RWF';
  const clientOfferNum =
    opportunity.maxBudget != null && opportunity.maxBudget > 0
      ? opportunity.maxBudget
      : opportunity.minBudget != null && opportunity.minBudget > 0
        ? opportunity.minBudget
        : null;

  const offerBudgetLabel =
    clientOfferNum != null ? money(clientOfferNum, currency) : tr('Flexible budget');

  const matchedPkgPrice =
    opportunity.matchedPackagePrice != null && opportunity.matchedPackagePrice > 0
      ? opportunity.matchedPackagePrice
      : null;
  const matchedPkgCurrency = opportunity.matchedPackageCurrency || currency;
  const matchedPkgName = opportunity.matchedPackageName || tr('Complete');


  const formattedDate = (() => {
    if (!opportunity.eventDate) return tr('Date to be confirmed');
    try {
      const [y, m, d] = opportunity.eventDate.split('-').map(Number);
      if (!y || !m || !d) return opportunity.eventDate;
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return opportunity.eventDate;
    }
  })();

  const openAcceptDetailsFromCall = () => {
    stopRinging();
    setStage('details');
    onOpenOfferPage?.(opportunity);
  };

  const handleAcceptClientPolicy = async () => {
    if (busyAction) return;
    stopRinging();
    setBusyAction('accept_client');
    try {
      await onApprove(opportunity, 'CLIENT');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAcceptPackagePolicy = async () => {
    if (busyAction) return;
    stopRinging();
    setBusyAction('accept_package');
    try {
      await onApprove(opportunity, 'PHOTOGRAPHER_PACKAGE');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRejectOffer = async () => {
    if (busyAction) return;
    stopRinging();
    setBusyAction('reject');
    try {
      await onReject(opportunity);
    } finally {
      setBusyAction(null);
    }
  };

  const eventHeadline = titleCase(
    opportunity.eventTitle ||
      (opportunity.eventType ? `${opportunity.eventType} coverage` : tr('Wedding coverage')),
  );

  const locationAndDateLine = `${titleCase(opportunity.city || opportunity.venue || 'Kigali')} · ${formattedDate}`;

  const expired = !!left?.done;
  const packageDays = opportunity.matchedPackageDeliveryDays;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={stage === 'ringing' ? openAcceptDetailsFromCall : onDismiss}
    >
      {stage === 'ringing' ? (
        <View
          style={[
            styles.callScreen,
            { paddingTop: Math.max(insets.top, 20) + 12, paddingBottom: Math.max(insets.bottom, 20) + 16 },
          ]}
        >
          <View style={styles.callTopHeader}>
            <View style={styles.callRingingPill}>
              <View style={styles.callRingingDot} />
              <Text style={styles.callRingingPillText}>{tr('New offer')}</Text>
            </View>
          </View>

          <View style={styles.callCenterBody}>
            <Animated.View style={[styles.callAvatarOuterRing, pulseStyle]}>
              <View style={styles.callAvatarInner}>
                <Ionicons name="camera" size={44} color={colors.accent} />
              </View>
            </Animated.View>

            <Text style={styles.callTitle}>{eventHeadline}</Text>
            <View style={styles.callLocationRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.callLocationText}>{locationAndDateLine}</Text>
            </View>

            <View style={styles.callOfferCard}>
              <Text style={styles.eyebrow}>{tr("CLIENT'S OFFER")}</Text>
              <Text style={styles.callOfferAmount}>{offerBudgetLabel}</Text>
              <Text style={styles.callOfferScope}>
                {brief.coverageModeLabel} · {brief.coverageHoursLabel}
              </Text>
              {left && !left.done ? (
                <View style={styles.timerChip}>
                  <Ionicons name="time-outline" size={13} color={colors.primary} />
                  <Text style={styles.timerChipText}>
                    {tr('Expires in')} {left.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.callActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.callBtn, styles.callDeclineBtn, pressed && styles.btnPressed]}
              onPress={openAcceptDetailsFromCall}
              accessibilityRole="button"
              accessibilityLabel={tr('Decline')}
            >
              <Ionicons name="close" size={26} color={colors.error} />
              <Text style={[styles.callBtnLabel, { color: colors.error }]}>{tr('Decline')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.callBtn, styles.callAcceptBtn, pressed && styles.btnPressed]}
              onPress={openAcceptDetailsFromCall}
              accessibilityRole="button"
              accessibilityLabel={tr('Accept')}
            >
              <Ionicons name="call" size={24} color={onFill} />
              <Text style={[styles.callBtnLabel, { color: onFill }]}>{tr('Accept')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <OfferDetailsView
          opportunity={opportunity}
          brief={brief}
          coverUri={HERO_COVER_URI}
          headline={eventHeadline}
          dateText={formattedDate}
          placeText={titleCase(opportunity.venue || opportunity.city || 'Kigali')}
          timeLeft={left && !left.done ? left.label : null}
          expired={expired}
          offer={clientOfferNum}
          currency={currency}
          pkg={matchedPkgPrice != null ? { name: matchedPkgName, price: matchedPkgPrice, currency: matchedPkgCurrency, days: packageDays } : null}
          busyAction={busyAction}
          topInset={insets.top}
          bottomInset={insets.bottom}
          tr={tr}
          onBack={onDismiss}
          onAccept={(choice) => void (choice === 'CLIENT' ? handleAcceptClientPolicy() : handleAcceptPackagePolicy())}
          onReject={() => void handleRejectOffer()}
        />
      )}
    </Modal>
  );
}


const useStyles = makeStyles((c) => ({
  // ── Offer details ───────────────────────────────────────────────────────────────────────────
  root: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: fontSize.lg, color: c.text },
  scrollContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  heroImage: { width: '100%', height: 120, borderRadius: radii.lg, backgroundColor: c.surfaceMuted },
  titleBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titleText: { flex: 1, gap: 4 },
  headline: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  metaIcon: { marginTop: 2 },
  metaText: { flex: 1, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.success,
    backgroundColor: c.successBg,
  },
  statusChipOff: { borderColor: c.border, backgroundColor: c.surfaceMuted },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
  statusChipText: { fontSize: 12, fontWeight: fontWeight.bold, color: c.success },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  timerChipText: { fontSize: 12, fontWeight: fontWeight.bold, color: c.primary, fontVariant: ['tabular-nums'] },

  requestedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tintAccent,
  },
  requestedBannerText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },

  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  offerCard: { borderColor: c.primary, backgroundColor: c.tint },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.6, color: c.textMuted },
  amount: { fontFamily: fonts.display, fontSize: fontSize.xl, color: c.text },
  cardSub: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },
  diffText: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  cardTitle: { flex: 1, fontFamily: fonts.display, fontSize: fontSize.md, color: c.text },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  detailLabelCol: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flexBasis: '42%', flexGrow: 0 },
  detailLabel: { flex: 1, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },
  detailValue: { flex: 1, textAlign: 'right', fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold, color: c.text },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  linkText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.link },

  accordion: { gap: spacing.sm },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  expandRowText: { flex: 1, gap: 2 },
  expandRowTitle: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.semibold, color: c.text },
  expandRowSub: { fontSize: 12, lineHeight: 17, fontWeight: fontWeight.regular, color: c.textMuted },
  expandContent: {
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
  },
  expandTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  expandText: { fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },

  actions: { gap: spacing.sm, marginTop: spacing.xs },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  acceptBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.primary,
  },
  acceptBtnText: { textAlign: 'center', fontFamily: fonts.display, fontSize: fontSize.sm, color: onFill },
  packageBtn: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  packageBtnText: { textAlign: 'center', fontFamily: fonts.display, fontSize: fontSize.sm, color: c.link },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.error,
    backgroundColor: c.errorBg,
  },
  declineBtnText: { fontFamily: fonts.display, fontSize: fontSize.md, color: c.error },
  btnPressed: { opacity: 0.88 },
  btnDisabled: { opacity: 0.5 },

  // ── Ringing screen ──────────────────────────────────────────────────────────────────────────
  callScreen: { flex: 1, backgroundColor: c.background, paddingHorizontal: spacing.lg, justifyContent: 'space-between' },
  callTopHeader: { alignItems: 'center' },
  callRingingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.tintAccent,
  },
  callRingingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  callRingingPillText: { fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.8, color: c.accent },
  callCenterBody: { alignItems: 'center', gap: spacing.md },
  callAvatarOuterRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callAvatarInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: c.tintAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: { textAlign: 'center', fontFamily: fonts.display, fontSize: fontSize['2xl'], color: c.text },
  callLocationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: spacing.lg },
  callLocationText: { flexShrink: 1, textAlign: 'center', fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },
  callOfferCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 6,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  callOfferAmount: { textAlign: 'center', fontFamily: fonts.display, fontSize: fontSize['2xl'], color: c.text },
  callOfferScope: { textAlign: 'center', fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.regular, color: c.textSoft },
  callActionsRow: { flexDirection: 'row', gap: spacing.md },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 60,
    borderRadius: radii.lg,
  },
  callDeclineBtn: { borderWidth: 1.5, borderColor: c.error, backgroundColor: c.errorBg },
  callAcceptBtn: { backgroundColor: c.success },
  callBtnLabel: { fontFamily: fonts.display, fontSize: fontSize.md },
}));
