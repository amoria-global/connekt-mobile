/**
 * IncomingOpportunityAlertModal — Two-stage Photographer Hybrid Offer Experience:
 *
 * Stage 1 ('ringing'):
 *   • Rings like an incoming phone call for 47 seconds (OPPORTUNITY_RING_DURATION_MS = 47_000).
 *   • Shows Accept & Decline call buttons.
 *   • Clicking ANY button (Accept, Decline, or View Details) stops the ringtone and opens Stage 2
 *     (the full Offer details accept screen on the photographer's incoming opportunities view).
 *   • If 47 seconds pass without interaction, the ringing stops and auto-closes while the offer
 *     remains available for 2 hours in Notifications and the Opportunities feed before expiring.
 *
 * Stage 2 ('details'):
 *   • Full Offer Details screen matching the Connekyt Offer Details specification:
 *     - Hero event cover banner, title, city/date, and green "Open offer" pill
 *     - "Viewing as: Photographer | Coordinator" switcher
 *     - "Requested: Photography + video" scope banner
 *     - Side-by-side "CLIENT'S OFFER" vs "YOUR UPLOADED PACKAGE" comparison cards
 *     - Side-by-side "Requested deliverables" vs "Delivery requested" detail boxes
 *     - Expandable rows (Coordinator proposal, Check availability & team, Review policies)
 *     - Three response buttons:
 *         1. "Accept offer" (uses client's delivery policy -> deliveryPolicy = 'CLIENT')
 *         2. "Accept with my delivery package policy" (updates event digital & print delivery once client confirms -> deliveryPolicy = 'PHOTOGRAPHER_PACKAGE')
 *         3. "Reject offer" (normal rejection, offer remains active for other photographers)
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Image } from 'expo-image';
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
import { formatPrice } from '@/utils/format';
import { serverNowMs } from './api';
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

const UI = {
  white: 'rgb(255, 255, 255)',
  offWhite: 'rgb(248, 250, 252)',
  slate200: 'rgb(226, 232, 240)',
  slate300: 'rgb(203, 213, 225)',
  slate400: 'rgb(148, 163, 184)',
  purpleLight: 'rgb(196, 181, 253)',
  purpleSoft: 'rgb(167, 139, 250)',
  purpleMid: 'rgb(192, 132, 252)',
  purpleBright: 'rgb(168, 85, 247)',
  purplePrimary: 'rgb(109, 40, 217)',
  purpleBorder: 'rgb(139, 92, 246)',
  purplePillBg: 'rgb(233, 213, 255)',
  skyBlue: 'rgb(56, 189, 248)',
  royalBlue: 'rgb(37, 99, 235)',
  emeraldBright: 'rgb(34, 197, 94)',
  emeraldSoft: 'rgb(52, 211, 153)',
  emeraldBorder: 'rgb(16, 185, 129)',
  emeraldBtn: 'rgb(22, 163, 74)',
  roseSoft: 'rgb(251, 113, 133)',
  roseBorder: 'rgb(244, 63, 94)',
  roseBtn: 'rgb(225, 29, 72)',
  darkRejectIcon: 'rgb(26, 20, 41)',
} as const;

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

type ParsedBriefScope = {
  coverageModeLabel: string;
  coverageHoursLabel: string;
  editedPhotosLabel: string;
  shortVideosLabel: string;
  longVideosLabel: string;
  liveStreamLabel: string;
  wishesShareLabel: string;
  photoBookLabel: string;
  photoAlbumLabel: string;
  wallPortraitsLabel: string;
  instantUpdatesLabel: string;
  digitalDeliveryLabel: string;
  printDeliveryLabel: string;
  budgetModeLabel: string;
  notesText: string;
};

function parseOpportunityScope(opp: PhotographerOpportunity): ParsedBriefScope {
  const raw = opp.instructions ?? '';
  const map: Record<string, string> = {};
  const freeNotes: string[] = [];
  let inScopeBlock = false;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === '[OFFER_SCOPE]') {
      inScopeBlock = true;
      continue;
    }
    if (trimmed.startsWith('[DRAFT_STATE]')) {
      continue;
    }
    const colonIdx = trimmed.indexOf(':');
    if (inScopeBlock && colonIdx > 0) {
      const k = trimmed.slice(0, colonIdx).trim();
      const v = trimmed.slice(colonIdx + 1).trim();
      map[k] = v;
    } else if (!inScopeBlock) {
      freeNotes.push(trimmed);
    }
  }

  const coverageModeLabel =
    map.Coverage ||
    (opp.hasLiveStream ? 'Photography + video + live stream' : 'Photography + video');

  const hours =
    opp.durationLabel ||
    (opp.durationHours ? `${opp.durationHours} hours` : undefined) ||
    (opp.durationMinutes ? `${Math.max(1, Math.round(opp.durationMinutes / 60))} hours` : '6 hours');

  const editedPhotosLabel =
    map.EditedPhotos ||
    (opp.minimumPhotos != null && opp.minimumPhotos > 0 ? String(opp.minimumPhotos) : '100');

  const shortVideosLabel = map.ShortVideos || '2 × 30 seconds';
  const longVideosLabel = map.LongVideos || 'None';
  const liveStreamLabel =
    map.LiveStream || (opp.hasLiveStream ? 'Requested' : 'Not requested');
  const wishesShareLabel =
    map.WishesShare || (opp.allowWishInvites ? 'Enabled' : 'Not requested');
  const photoBookLabel = map.PhotoBook || 'None';
  const photoAlbumLabel = map.PhotoAlbum || 'None';
  const wallPortraitsLabel = map.WallPortraits || 'None';
  const instantUpdatesLabel = map.InstantUpdates || 'Not requested';
  const digitalDeliveryLabel = map.DigitalDelivery || 'Within 7 days after the event';
  const printDeliveryLabel =
    map.PrintDelivery && map.PrintDelivery !== 'None'
      ? map.PrintDelivery
      : 'Propose production & handover date';
  const budgetModeLabel =
    map.BudgetMode === 'RECOMMENDED'
      ? 'Client used recommended package pricing.'
      : 'Client published their own budget.';

  return {
    coverageModeLabel,
    coverageHoursLabel: hours,
    editedPhotosLabel,
    shortVideosLabel,
    longVideosLabel,
    liveStreamLabel,
    wishesShareLabel,
    photoBookLabel,
    photoAlbumLabel,
    wallPortraitsLabel,
    instantUpdatesLabel,
    digitalDeliveryLabel,
    printDeliveryLabel,
    budgetModeLabel,
    notesText: map.Notes || freeNotes.join(' '),
  };
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
  const { tr } = useSharedT();

  const [stage, setStage] = useState<'ringing' | 'details'>(initialStage);
  const [ringSecondsLeft, setRingSecondsLeft] = useState<number>(OPPORTUNITY_RING_DURATION_SECONDS);
  const [busyAction, setBusyAction] = useState<
    'accept_client' | 'accept_package' | 'reject' | null
  >(null);
  const [viewingAs, setViewingAs] = useState<'photographer' | 'coordinator'>('photographer');
  const [showVenueSchedule, setShowVenueSchedule] = useState(false);
  const [expandedSection, setExpandedSection] = useState<
    'coordinator' | 'availability' | 'policies' | null
  >(null);
  const [bookmarked, setBookmarked] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const pulseAnim = useSharedValue(1);

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
      setShowVenueSchedule(false);
      setExpandedSection(null);
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
        onDismiss();
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
  }, [visible, opportunity?.candidateId, stage, onDismiss, pulseAnim, stopRinging]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const brief = useMemo(
    () => (opportunity ? parseOpportunityScope(opportunity) : null),
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
    clientOfferNum != null ? formatPrice(clientOfferNum, currency) : tr('Flexible budget');

  const matchedPkgPrice =
    opportunity.matchedPackagePrice != null && opportunity.matchedPackagePrice > 0
      ? opportunity.matchedPackagePrice
      : null;
  const matchedPkgCurrency = opportunity.matchedPackageCurrency || currency;
  const matchedPkgName = opportunity.matchedPackageName || tr('Complete');

  const packageDiffLabel = (() => {
    if (matchedPkgPrice == null) {
      return tr('Configure packages in Profile to compare.');
    }
    if (clientOfferNum == null) {
      return `${formatPrice(matchedPkgPrice, matchedPkgCurrency)} package rate`;
    }
    const diff = Math.round(matchedPkgPrice - clientOfferNum);
    if (Math.abs(diff) < 500) {
      return tr("Matches the client's offer");
    }
    if (diff > 0) {
      return `${formatPrice(diff, matchedPkgCurrency)} ${tr("above the client's offer")}`;
    }
    return `${formatPrice(Math.abs(diff), matchedPkgCurrency)} ${tr("below the client's offer")}`;
  })();

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

  const toggleSection = (sec: 'coordinator' | 'availability' | 'policies') => {
    setExpandedSection((prev) => (prev === sec ? null : sec));
  };

  const eventHeadline =
    opportunity.eventTitle ||
    (opportunity.eventType ? `${opportunity.eventType} coverage` : tr('Wedding coverage'));

  const locationAndDateLine = `${opportunity.city || opportunity.venue || 'Kigali'}  •  ${formattedDate}`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={stage === 'ringing' ? openAcceptDetailsFromCall : onDismiss}
    >
      {stage === 'ringing' ? (
        /* ───────────────────────── STAGE 1: 47-SECOND RINGING CALL ───────────────────────── */
        <View
          style={[
            styles.callScreen,
            {
              paddingTop: Math.max(insets.top, 20) + 12,
              paddingBottom: Math.max(insets.bottom, 20) + 16,
            },
          ]}
        >
          {/* Top Ringing Status Bar */}
          <View style={styles.callTopHeader}>
            <View style={styles.callRingingPill}>
              <View style={styles.callRingingDot} />
              <Text style={styles.callRingingPillText}>
                {tr('INCOMING OFFER CALL')} • {ringSecondsLeft}s
              </Text>
            </View>
            <Text style={styles.callWindowSub}>
              {tr('Rings for 47s • Available for 2 hrs before disappearing')}
            </Text>
          </View>

          {/* Center Pulsing Call Avatar & Event Summary */}
          <View style={styles.callCenterBody}>
            <Animated.View style={[styles.callAvatarOuterRing, pulseStyle]}>
              <View style={styles.callAvatarInner}>
                <Ionicons name="camera" size={44} color={UI.purpleLight} />
              </View>
            </Animated.View>

            <Text style={styles.callTitle} numberOfLines={2}>
              {eventHeadline}
            </Text>
            <View style={styles.callLocationRow}>
              <Ionicons name="location-outline" size={16} color={UI.purpleSoft} />
              <Text style={styles.callLocationText}>{locationAndDateLine}</Text>
            </View>

            <View style={styles.callOfferHighlightCard}>
              <Text style={styles.callOfferEyebrow}>{tr("CLIENT'S OFFER")}</Text>
              <Text style={styles.callOfferAmount}>{offerBudgetLabel}</Text>
              <Text style={styles.callOfferScope}>
                {brief.coverageModeLabel} • {brief.coverageHoursLabel}
              </Text>
              {left && !left.done ? (
                <View style={styles.callExpiryBadge}>
                  <Ionicons name="time-outline" size={13} color={UI.emeraldSoft} />
                  <Text style={styles.callExpiryText}>
                    {tr('Expires in')} {left.label}
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={openAcceptDetailsFromCall}
              style={styles.callViewDetailsLink}
              accessibilityRole="button"
            >
              <Text style={styles.callViewDetailsLinkText}>
                {tr('Tap any button below to review full offer details')}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={UI.purpleSoft} />
            </Pressable>
          </View>

          {/* Bottom Accept & Decline Call Buttons (both open the Offer Details Accept Page) */}
          <View style={styles.callActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.callDeclineBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={openAcceptDetailsFromCall}
              accessibilityRole="button"
              accessibilityLabel={tr('Decline')}
            >
              <View style={styles.callActionIconCircle}>
                <Ionicons name="close" size={26} color={UI.white} />
              </View>
              <Text style={styles.callActionBtnLabel}>{tr('Decline')}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.callAcceptBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={openAcceptDetailsFromCall}
              accessibilityRole="button"
              accessibilityLabel={tr('Accept')}
            >
              <View style={styles.callActionIconCircle}>
                <Ionicons name="call" size={24} color={UI.white} />
              </View>
              <Text style={styles.callActionBtnLabel}>{tr('Accept')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* ───────────────────────── STAGE 2: OFFER DETAILS SCREEN ───────────────────────── */
        <View
          style={[
            styles.root,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          {/* TOP NAVIGATION HEADER */}
          <View style={styles.headerContainer}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={onDismiss}
                style={styles.headerIconBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={tr('Back')}
              >
                <Ionicons name="chevron-back" size={24} color={UI.offWhite} />
              </Pressable>

              <Text style={styles.brandWordmark}>C O N N E K Y T</Text>

              <Pressable
                onPress={() => setBookmarked((b) => !b)}
                style={styles.headerIconBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={tr('Bookmark offer')}
              >
                <Ionicons
                  name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                  size={21}
                  color={UI.slate300}
                />
              </Pressable>
            </View>

            <View style={styles.headerTitleRow}>
              <View style={{ width: 90 }} />
              <Text style={styles.screenTitle}>{tr('Offer details')}</Text>
              <View style={styles.illustrativePill}>
                <Ionicons name="information-circle-outline" size={13} color={UI.purpleLight} />
                <Text style={styles.illustrativePillText}>
                  {left && !left.done ? left.label : tr('Live offer')}
                </Text>
              </View>
            </View>
          </View>

          {/* SCROLLABLE BODY */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* HERO COVER IMAGE */}
            <View style={styles.heroWrap}>
              <Image
                source={{ uri: HERO_COVER_URI }}
                style={styles.heroImage}
                contentFit="cover"
              />
            </View>

            {/* TITLE, LOCATION & OPEN OFFER PILL */}
            <View style={styles.titleSection}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.eventHeadline} numberOfLines={2}>
                  {eventHeadline}
                </Text>
                <View style={styles.locationMetaRow}>
                  <Ionicons name="location-outline" size={15} color={UI.purpleSoft} />
                  <Text style={styles.locationMetaText} numberOfLines={1}>
                    {locationAndDateLine}
                  </Text>
                </View>
              </View>

              <View style={styles.openOfferBadge}>
                <View style={styles.openOfferDot} />
                <Text style={styles.openOfferText}>
                  {left?.done ? tr('Expired') : tr('Open offer')}
                </Text>
              </View>
            </View>

            {/* VIEWING AS: PHOTOGRAPHER | COORDINATOR */}
            <View style={styles.viewingAsBar}>
              <Text style={styles.viewingAsLabel}>{tr('Viewing as:')}</Text>
              <Pressable
                onPress={() => setViewingAs('photographer')}
                style={[
                  styles.viewingAsTab,
                  viewingAs === 'photographer' && styles.viewingAsTabActive,
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={viewingAs === 'photographer' ? UI.white : UI.slate300}
                />
                <Text
                  style={[
                    styles.viewingAsTabText,
                    viewingAs === 'photographer' && styles.viewingAsTabTextActive,
                  ]}
                >
                  {tr('Photographer')}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setViewingAs('coordinator');
                  setExpandedSection('coordinator');
                }}
                style={[
                  styles.viewingAsTab,
                  viewingAs === 'coordinator' && styles.viewingAsTabActive,
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={viewingAs === 'coordinator' ? UI.white : UI.slate300}
                />
                <Text
                  style={[
                    styles.viewingAsTabText,
                    viewingAs === 'coordinator' && styles.viewingAsTabTextActive,
                  ]}
                >
                  {tr('Coordinator')}
                </Text>
              </Pressable>
            </View>

            {/* REQUESTED COVERAGE BANNER */}
            <View style={styles.requestedBanner}>
              <Ionicons name="videocam-outline" size={18} color={UI.purpleBright} />
              <Text style={styles.requestedBannerText}>
                {tr('Requested')}: {brief.coverageModeLabel}
              </Text>
            </View>

            {/* SIDE-BY-SIDE COMPARISON: CLIENT'S OFFER vs YOUR UPLOADED PACKAGE */}
            <View style={styles.comparisonGrid}>
              {/* Left Card: Client's Offer */}
              <View style={[styles.compareCard, styles.clientOfferCard]}>
                <View style={styles.compareEyebrowRow}>
                  <Ionicons name="wallet-outline" size={14} color={UI.purpleMid} />
                  <Text style={[styles.compareEyebrow, { color: UI.slate200 }]}>
                    {tr("CLIENT'S OFFER")}
                  </Text>
                </View>
                <Text style={styles.clientOfferAmount}>{offerBudgetLabel}</Text>
                <Text style={styles.compareSubtitle}>
                  {tr('For the complete requested scope')}
                </Text>
                <View style={styles.compareDividerPurple} />
                <Text style={styles.compareFootnote}>{brief.budgetModeLabel}</Text>
              </View>

              {/* Right Card: Your Uploaded Package */}
              <View style={[styles.compareCard, styles.uploadedPkgCard]}>
                <View style={styles.compareEyebrowRow}>
                  <Ionicons name="pricetag-outline" size={14} color={UI.skyBlue} />
                  <Text style={[styles.compareEyebrow, { color: UI.skyBlue }]}>
                    {tr('YOUR UPLOADED PACKAGE')}
                  </Text>
                </View>
                <Text style={styles.uploadedPkgAmount} numberOfLines={2}>
                  {matchedPkgPrice != null
                    ? `${matchedPkgName} • ${formatPrice(matchedPkgPrice, matchedPkgCurrency)}`
                    : tr('No active package')}
                </Text>
                <Text style={styles.diffHighlight}>{packageDiffLabel}</Text>
                <View style={styles.compareDividerSlate} />
                <Text style={styles.compareFootnote}>
                  {opportunity.matchedPackageDeliveryDays != null &&
                  opportunity.matchedPackageDeliveryDays > 0
                    ? `${tr('Compare inclusions before responding.')} (${opportunity.matchedPackageDeliveryDays}d delivery)`
                    : tr('Compare inclusions before responding.')}
                </Text>
              </View>
            </View>

            {/* SIDE-BY-SIDE DETAILS: REQUESTED DELIVERABLES & DELIVERY REQUESTED */}
            <View style={styles.detailsRowGrid}>
              {/* Left Box: Requested deliverables */}
              <View style={styles.detailBox}>
                <View style={styles.detailBoxHeader}>
                  <Ionicons name="list-outline" size={17} color={UI.purpleSoft} />
                  <Text style={styles.detailBoxTitle}>{tr('Requested deliverables')}</Text>
                </View>

                <DeliverableRow
                  icon="time-outline"
                  label={tr('Coverage')}
                  value={brief.coverageHoursLabel}
                />
                <DeliverableRow
                  icon="images-outline"
                  label={tr('Edited photos')}
                  value={brief.editedPhotosLabel}
                />
                <DeliverableRow
                  icon="videocam-outline"
                  label={tr('Short videos')}
                  value={brief.shortVideosLabel}
                />
                <DeliverableRow
                  icon="film-outline"
                  label={tr('Long videos')}
                  value={brief.longVideosLabel}
                />
                <DeliverableRow
                  icon="book-outline"
                  label={tr('Photo book')}
                  value={brief.photoBookLabel}
                />
                <DeliverableRow
                  icon="albums-outline"
                  label={tr('Photo album')}
                  value={brief.photoAlbumLabel}
                />
                <DeliverableRow
                  icon="image-outline"
                  label={tr('Wall portraits')}
                  value={brief.wallPortraitsLabel}
                />
                <DeliverableRow
                  icon="flash-outline"
                  label={tr('Instant updates')}
                  value={brief.instantUpdatesLabel}
                />
                {opportunity.hasLiveStream || brief.liveStreamLabel !== 'Not requested' ? (
                  <DeliverableRow
                    icon="radio-outline"
                    label={tr('Live stream')}
                    value={brief.liveStreamLabel}
                  />
                ) : null}
                {opportunity.allowWishInvites || brief.wishesShareLabel !== 'Not requested' ? (
                  <DeliverableRow
                    icon="heart-outline"
                    label={tr('Wishes & memories')}
                    value={brief.wishesShareLabel}
                  />
                ) : null}
              </View>

              {/* Right Box: Delivery requested */}
              <View style={[styles.detailBox, { justifyContent: 'space-between' }]}>
                <View style={{ gap: 10 }}>
                  <View style={styles.detailBoxHeader}>
                    <Ionicons name="calendar-outline" size={17} color={UI.purpleSoft} />
                    <Text style={styles.detailBoxTitle}>{tr('Delivery requested')}</Text>
                  </View>

                  <View style={styles.deliveryItemRow}>
                    <Ionicons name="cloud-outline" size={16} color={UI.slate400} />
                    <Text style={styles.deliveryKey}>{tr('Digital')}</Text>
                    <Text style={styles.deliveryVal}>{brief.digitalDeliveryLabel}</Text>
                  </View>

                  <View style={styles.deliveryItemRow}>
                    <Ionicons name="print-outline" size={16} color={UI.slate400} />
                    <Text style={styles.deliveryKey}>{tr('Print products')}</Text>
                    <Text style={styles.deliveryVal}>{brief.printDeliveryLabel}</Text>
                  </View>
                </View>

                <View style={{ gap: 6, marginTop: 8 }}>
                  <Pressable
                    onPress={() => setShowVenueSchedule((s) => !s)}
                    style={styles.venueLinkRow}
                    accessibilityRole="button"
                  >
                    <Ionicons name="location-outline" size={16} color={UI.purpleSoft} />
                    <Text style={styles.venueLinkText}>
                      {tr('View venue, schedule & references')}
                    </Text>
                    <Ionicons
                      name={showVenueSchedule ? 'chevron-up' : 'chevron-forward'}
                      size={15}
                      color={UI.slate400}
                    />
                  </Pressable>

                  {showVenueSchedule ? (
                    <View style={styles.venueExpandedBox}>
                      <Text style={styles.venueExpandedTitle}>
                        {opportunity.venue || opportunity.city || tr('Kigali')}
                        {opportunity.distanceLabel ? ` (${opportunity.distanceLabel})` : ''}
                      </Text>
                      <Text style={styles.venueExpandedMeta}>
                        {formattedDate}
                        {opportunity.startTime ? ` • ${opportunity.startTime.slice(0, 5)}` : ''}
                        {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''}
                      </Text>
                      {brief.notesText ? (
                        <Text style={styles.venueExpandedMeta}>{brief.notesText}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* THREE EXPANDABLE ACCORDION ROWS */}
            <View style={{ gap: 8 }}>
              <Pressable
                onPress={() => toggleSection('coordinator')}
                style={styles.expandRow}
                accessibilityRole="button"
              >
                <Ionicons name="people-outline" size={20} color={UI.purpleMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.expandRowTitle}>
                    {tr('Coordinator? Propose coordination services')}
                  </Text>
                  <Text style={styles.expandRowSub}>
                    {tr('Define a separate scope and price.')}
                  </Text>
                </View>
                <Ionicons
                  name={expandedSection === 'coordinator' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={UI.slate400}
                />
              </Pressable>
              {expandedSection === 'coordinator' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandContentText}>
                    {tr(
                      'After accepting availability, you can propose dedicated event coordination services with a separate scope and fee directly to the client.',
                    )}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => toggleSection('availability')}
                style={styles.expandRow}
                accessibilityRole="button"
              >
                <Ionicons name="document-text-outline" size={19} color={UI.purpleMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.expandRowTitle}>{tr('Check availability & team')}</Text>
                </View>
                <Ionicons
                  name={expandedSection === 'availability' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={UI.slate400}
                />
              </Pressable>
              {expandedSection === 'availability' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandContentText}>
                    {formattedDate} • {opportunity.startTime?.slice(0, 5) || 'TBD'}
                    {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''} •{' '}
                    {brief.coverageModeLabel} ({brief.coverageHoursLabel})
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => toggleSection('policies')}
                style={styles.expandRow}
                accessibilityRole="button"
              >
                <Ionicons name="document-text-outline" size={19} color={UI.purpleMid} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.expandRowTitle}>{tr('Review policies and exclusions')}</Text>
                </View>
                <Ionicons
                  name={expandedSection === 'policies' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={UI.slate400}
                />
              </Pressable>
              {expandedSection === 'policies' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandContentText}>
                    {tr(
                      "Accepting with the client's delivery policy keeps the requested digital and print schedule. Accepting with your delivery package policy updates both digital and print delivery to your package schedule once the client confirms and books you.",
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* GUIDANCE INFO BAR */}
            <View style={styles.guidanceBar}>
              <Ionicons name="information-circle-outline" size={17} color={UI.slate300} />
              <Text style={styles.guidanceBarText}>
                {tr("Choose the client's delivery schedule or your package delivery policy.")}
              </Text>
            </View>

            {/* THREE ACTION BUTTONS ROW */}
            <View style={styles.threeButtonsRow}>
              {/* 1. Accept offer (Client delivery policy) */}
              <Pressable
                style={({ pressed }) => [
                  styles.acceptClientBtn,
                  pressed && styles.btnPressed,
                  (busyAction !== null || !!left?.done) && styles.btnDisabled,
                ]}
                onPress={handleAcceptClientPolicy}
                disabled={busyAction !== null || !!left?.done}
                accessibilityRole="button"
                accessibilityLabel={tr('Accept offer')}
              >
                <View style={styles.acceptCheckCircle}>
                  <Ionicons name="checkmark" size={16} color={UI.purplePrimary} />
                </View>
                <Text style={styles.acceptClientBtnText}>
                  {busyAction === 'accept_client' ? tr('Sending...') : tr('Accept offer')}
                </Text>
              </Pressable>

              {/* 2. Accept with my delivery package policy */}
              <Pressable
                style={({ pressed }) => [
                  styles.acceptPackageBtn,
                  pressed && styles.btnPressed,
                  (busyAction !== null || !!left?.done) && styles.btnDisabled,
                ]}
                onPress={handleAcceptPackagePolicy}
                disabled={busyAction !== null || !!left?.done}
                accessibilityRole="button"
                accessibilityLabel={tr('Accept with my delivery package policy')}
              >
                <Ionicons name="cube-outline" size={22} color={UI.white} />
                <Text style={styles.acceptPackageBtnText}>
                  {busyAction === 'accept_package'
                    ? tr('Sending...')
                    : tr('Accept with my delivery package policy')}
                </Text>
              </Pressable>

              {/* 3. Reject offer */}
              <Pressable
                style={({ pressed }) => [
                  styles.rejectOfferBtn,
                  pressed && styles.btnPressed,
                  busyAction !== null && styles.btnDisabled,
                ]}
                onPress={handleRejectOffer}
                disabled={busyAction !== null}
                accessibilityRole="button"
                accessibilityLabel={tr('Reject offer')}
              >
                <View style={styles.rejectIconCircle}>
                  <Ionicons name="close" size={15} color={UI.darkRejectIcon} />
                </View>
                <Text style={styles.rejectOfferBtnText}>
                  {busyAction === 'reject' ? tr('Sending...') : tr('Reject offer')}
                </Text>
              </Pressable>
            </View>

            {/* BULLET EXPLAINER BOX */}
            <View style={styles.bulletInfoBox}>
              <Ionicons name="information-circle-outline" size={20} color={UI.skyBlue} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.bulletInfoLine}>
                  •  {tr("Both acceptance options keep the client's price and scope.")}
                </Text>
                <Text style={styles.bulletInfoLine}>
                  •  {tr('Your delivery policy requires client agreement before booking.')}
                </Text>
              </View>
            </View>

            {/* SHIELD FOOTER NOTE */}
            <View style={styles.shieldFooterRow}>
              <Ionicons name="shield-outline" size={20} color={UI.slate300} />
              <Text style={styles.shieldFooterText}>
                {tr(
                  'Client selects a professional, reviews terms and completes required payment before booking is confirmed.',
                )}
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

function DeliverableRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.deliverableRow}>
      <Ionicons name={icon} size={15} color={UI.slate400} />
      <Text style={styles.deliverableKey} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.deliverableVal} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ────────── Stage 1: 47-Second Incoming Call Styles ──────────
  callScreen: {
    flex: 1,
    backgroundColor: 'rgb(9, 13, 26)',
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  callTopHeader: {
    alignItems: 'center',
    gap: 6,
  },
  callRingingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  callRingingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.emeraldBright,
  },
  callRingingPillText: {
    color: UI.offWhite,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  callWindowSub: {
    color: UI.slate400,
    fontSize: 12,
  },
  callCenterBody: {
    alignItems: 'center',
    gap: 14,
  },
  callAvatarOuterRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    borderColor: 'rgb(124, 58, 237)',
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  callAvatarInner: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgb(30, 27, 75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTitle: {
    color: UI.white,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  callLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callLocationText: {
    color: UI.slate300,
    fontSize: 13.5,
  },
  callOfferHighlightCard: {
    alignSelf: 'stretch',
    marginTop: 8,
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgb(35, 20, 79)',
    borderWidth: 1.5,
    borderColor: UI.purplePrimary,
    alignItems: 'center',
    gap: 6,
  },
  callOfferEyebrow: {
    color: UI.purpleLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  callOfferAmount: {
    color: UI.white,
    fontSize: 28,
    fontWeight: '900',
  },
  callOfferScope: {
    color: UI.slate200,
    fontSize: 13,
  },
  callExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  callExpiryText: {
    color: UI.emeraldSoft,
    fontSize: 11.5,
    fontWeight: '700',
  },
  callViewDetailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  callViewDetailsLinkText: {
    color: UI.purpleSoft,
    fontSize: 13,
    fontWeight: '600',
  },
  callActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  callDeclineBtn: {
    flex: 1,
    height: 62,
    borderRadius: 999,
    backgroundColor: UI.roseBtn,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  callAcceptBtn: {
    flex: 1,
    height: 62,
    borderRadius: 999,
    backgroundColor: UI.emeraldBtn,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  callActionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callActionBtnLabel: {
    color: UI.white,
    fontSize: 16,
    fontWeight: '800',
  },

  // ────────── Stage 2: Offer Details Screen Styles ──────────
  root: {
    flex: 1,
    backgroundColor: 'rgb(11, 16, 33)',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandWordmark: {
    color: UI.offWhite,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    color: UI.white,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  illustrativePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgb(46, 16, 101)',
    borderWidth: 1,
    borderColor: UI.purplePrimary,
  },
  illustrativePillText: {
    color: UI.purplePillBg,
    fontSize: 11,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  heroWrap: {
    height: 118,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  eventHeadline: {
    color: UI.white,
    fontSize: 23,
    fontWeight: '800',
  },
  locationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationMetaText: {
    color: UI.slate300,
    fontSize: 12.5,
  },
  openOfferBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: UI.emeraldBorder,
  },
  openOfferDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: UI.emeraldBright,
  },
  openOfferText: {
    color: UI.emeraldSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  viewingAsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgb(17, 24, 39)',
    borderRadius: 12,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
    gap: 6,
  },
  viewingAsLabel: {
    color: UI.slate300,
    fontSize: 12.5,
    paddingHorizontal: 8,
  },
  viewingAsTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewingAsTabActive: {
    backgroundColor: 'rgb(91, 33, 182)',
    borderWidth: 1,
    borderColor: UI.purpleBorder,
  },
  viewingAsTabText: {
    color: UI.slate300,
    fontSize: 12.5,
    fontWeight: '600',
  },
  viewingAsTabTextActive: {
    color: UI.white,
    fontWeight: '800',
  },
  requestedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgb(19, 28, 49)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
  },
  requestedBannerText: {
    color: UI.offWhite,
    fontSize: 13.5,
    fontWeight: '700',
  },
  comparisonGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  compareCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  clientOfferCard: {
    backgroundColor: 'rgb(36, 18, 77)',
    borderColor: UI.purplePrimary,
  },
  uploadedPkgCard: {
    backgroundColor: 'rgb(17, 24, 39)',
    borderColor: 'rgb(30, 41, 59)',
  },
  compareEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compareEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  clientOfferAmount: {
    color: UI.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  uploadedPkgAmount: {
    color: UI.white,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  compareSubtitle: {
    color: UI.slate200,
    fontSize: 11.5,
  },
  diffHighlight: {
    color: UI.roseSoft,
    fontSize: 11.5,
    fontWeight: '700',
  },
  compareDividerPurple: {
    height: 1,
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
    marginVertical: 5,
  },
  compareDividerSlate: {
    height: 1,
    backgroundColor: 'rgb(30, 41, 59)',
    marginVertical: 5,
  },
  compareFootnote: {
    color: UI.slate300,
    fontSize: 11,
  },
  detailsRowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailBox: {
    flex: 1,
    minWidth: 165,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
    backgroundColor: 'rgb(17, 24, 39)',
    padding: 12,
    gap: 7,
  },
  detailBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  detailBoxTitle: {
    color: UI.white,
    fontSize: 13.5,
    fontWeight: '800',
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliverableKey: {
    color: UI.slate300,
    fontSize: 11.5,
    width: 86,
  },
  deliverableVal: {
    flex: 1,
    color: UI.offWhite,
    fontSize: 11.5,
    fontWeight: '600',
  },
  deliveryItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  deliveryKey: {
    color: UI.slate300,
    fontSize: 11.5,
    width: 78,
  },
  deliveryVal: {
    flex: 1,
    color: UI.offWhite,
    fontSize: 11.5,
    lineHeight: 16,
  },
  venueLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 6,
  },
  venueLinkText: {
    flex: 1,
    color: UI.skyBlue,
    fontSize: 11.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  venueExpandedBox: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgb(15, 23, 42)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
    gap: 2,
  },
  venueExpandedTitle: {
    color: UI.offWhite,
    fontSize: 11.5,
    fontWeight: '700',
  },
  venueExpandedMeta: {
    color: UI.slate400,
    fontSize: 11,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgb(19, 28, 49)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
  },
  expandRowTitle: {
    color: UI.offWhite,
    fontSize: 13,
    fontWeight: '700',
  },
  expandRowSub: {
    color: UI.slate400,
    fontSize: 11,
  },
  expandContent: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'rgb(15, 23, 42)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
  },
  expandContentText: {
    color: UI.slate300,
    fontSize: 11.5,
    lineHeight: 16,
  },
  guidanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgb(19, 28, 49)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
  },
  guidanceBarText: {
    flex: 1,
    color: UI.slate300,
    fontSize: 12,
  },
  threeButtonsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  acceptClientBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: UI.purplePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  acceptCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: UI.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptClientBtnText: {
    color: UI.white,
    fontSize: 13.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  acceptPackageBtn: {
    flex: 1.15,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: UI.royalBlue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 7,
  },
  acceptPackageBtnText: {
    color: UI.white,
    fontSize: 12,
    lineHeight: 15.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  rejectOfferBtn: {
    flex: 0.95,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: UI.darkRejectIcon,
    borderWidth: 1.5,
    borderColor: UI.roseBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 7,
  },
  rejectIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: UI.roseBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectOfferBtnText: {
    color: UI.roseSoft,
    fontSize: 13.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  bulletInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgb(17, 24, 39)',
    borderWidth: 1,
    borderColor: 'rgb(30, 41, 59)',
  },
  bulletInfoLine: {
    color: UI.slate300,
    fontSize: 11.5,
    lineHeight: 16,
  },
  shieldFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  shieldFooterText: {
    flex: 1,
    color: UI.slate400,
    fontSize: 11.5,
    lineHeight: 16,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.55,
  },
});
