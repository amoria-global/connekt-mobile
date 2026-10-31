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
  ScrollView,
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
import { fonts, fontSize, fontWeight, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
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
      : 'You propose the production and handover date';
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
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();

  const [stage, setStage] = useState<'ringing' | 'details'>(initialStage);
  const [, setRingSecondsLeft] = useState<number>(OPPORTUNITY_RING_DURATION_SECONDS);
  const [busyAction, setBusyAction] = useState<
    'accept_client' | 'accept_package' | 'reject' | null
  >(null);
  const [showVenueSchedule, setShowVenueSchedule] = useState(false);
  const [expandedSection, setExpandedSection] = useState<
    'coordinator' | 'availability' | 'policies' | null
  >(null);
  const [bookmarked, setBookmarked] = useState(false);

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
    clientOfferNum != null ? money(clientOfferNum, currency) : tr('Flexible budget');

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
      return `${money(matchedPkgPrice, matchedPkgCurrency)} package rate`;
    }
    const diff = Math.round(matchedPkgPrice - clientOfferNum);
    if (Math.abs(diff) < 500) {
      return tr("Matches the client's offer");
    }
    if (diff > 0) {
      return `${money(diff, matchedPkgCurrency)} ${tr("above the client's offer")}`;
    }
    return `${money(Math.abs(diff), matchedPkgCurrency)} ${tr("below the client's offer")}`;
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

  const eventHeadline = titleCase(
    opportunity.eventTitle ||
      (opportunity.eventType ? `${opportunity.eventType} coverage` : tr('Wedding coverage')),
  );

  const locationAndDateLine = `${titleCase(opportunity.city || opportunity.venue || 'Kigali')} · ${formattedDate}`;

  const expired = !!left?.done;
  const locked = busyAction !== null || expired;
  const diff =
    matchedPkgPrice != null && clientOfferNum != null ? Math.round(matchedPkgPrice - clientOfferNum) : null;
  const diffColor = diff == null || Math.abs(diff) < 500 ? colors.textSoft : diff > 0 ? colors.warning : colors.success;
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
        <View
          style={[
            styles.root,
            { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 10) },
          ]}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onDismiss}
              style={styles.iconBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tr('Back')}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">
              {tr('Offer details')}
            </Text>
            <Pressable
              onPress={() => setBookmarked((b) => !b)}
              style={styles.iconBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tr('Bookmark offer')}
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={21}
                color={bookmarked ? colors.accent : colors.textSoft}
              />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Image source={{ uri: HERO_COVER_URI }} style={styles.heroImage} contentFit="cover" />

            <View style={styles.titleBlock}>
              <View style={styles.titleText}>
                <Text style={styles.headline}>{eventHeadline}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={15} color={colors.textMuted} style={styles.metaIcon} />
                  <Text style={styles.metaText}>{locationAndDateLine}</Text>
                </View>
              </View>
              <View style={[styles.statusChip, expired && styles.statusChipOff]}>
                <View style={[styles.statusDot, expired && { backgroundColor: colors.textMuted }]} />
                <Text style={[styles.statusChipText, expired && { color: colors.textMuted }]}>
                  {expired ? tr('Expired') : tr('Open offer')}
                </Text>
              </View>
            </View>

            {left && !left.done ? (
              <View style={styles.timerChip}>
                <Ionicons name="time-outline" size={14} color={colors.primary} />
                <Text style={styles.timerChipText}>
                  {tr('Expires in')} {left.label}
                </Text>
              </View>
            ) : null}

            <View style={styles.requestedBanner}>
              <Ionicons name="videocam-outline" size={18} color={colors.accent} />
              <Text style={styles.requestedBannerText}>
                {tr('Requested')}: {brief.coverageModeLabel}
              </Text>
            </View>

            <View style={[styles.card, styles.offerCard]}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="wallet-outline" size={14} color={colors.primary} />
                <Text style={[styles.eyebrow, { color: colors.primary }]}>{tr("CLIENT'S OFFER")}</Text>
              </View>
              <Text style={styles.amount}>{offerBudgetLabel}</Text>
              <Text style={styles.cardSub}>{tr('For the complete requested scope')}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.eyebrowRow}>
                <Ionicons name="pricetag-outline" size={14} color={colors.info} />
                <Text style={[styles.eyebrow, { color: colors.info }]}>{tr('YOUR PACKAGE')}</Text>
              </View>
              <Text style={styles.amount}>
                {matchedPkgPrice != null ? `${matchedPkgName} · ${money(matchedPkgPrice, matchedPkgCurrency)}` : tr('No active package')}
              </Text>
              <Text style={[styles.diffText, { color: diffColor }]}>{packageDiffLabel}</Text>
              {packageDays != null && packageDays > 0 ? (
                <Text style={styles.cardSub}>
                  {tr('Delivers in')} {packageDays} {packageDays === 1 ? tr('day') : tr('days')}
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="list-outline" size={17} color={colors.primary} />
                <Text style={styles.cardTitle}>{tr('Requested deliverables')}</Text>
              </View>
              <DetailRow icon="time-outline" label={tr('Coverage')} value={brief.coverageHoursLabel} />
              <DetailRow icon="images-outline" label={tr('Edited photos')} value={brief.editedPhotosLabel} />
              <DetailRow icon="videocam-outline" label={tr('Short videos')} value={brief.shortVideosLabel} />
              <DetailRow icon="film-outline" label={tr('Long videos')} value={brief.longVideosLabel} />
              <DetailRow icon="book-outline" label={tr('Photo book')} value={brief.photoBookLabel} />
              <DetailRow icon="albums-outline" label={tr('Photo album')} value={brief.photoAlbumLabel} />
              <DetailRow icon="image-outline" label={tr('Wall portraits')} value={brief.wallPortraitsLabel} />
              <DetailRow icon="flash-outline" label={tr('Instant updates')} value={brief.instantUpdatesLabel} />
              {opportunity.hasLiveStream || brief.liveStreamLabel !== 'Not requested' ? (
                <DetailRow icon="radio-outline" label={tr('Live stream')} value={brief.liveStreamLabel} />
              ) : null}
              {opportunity.allowWishInvites || brief.wishesShareLabel !== 'Not requested' ? (
                <DetailRow icon="heart-outline" label={tr('Wishes & memories')} value={brief.wishesShareLabel} />
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                <Text style={styles.cardTitle}>{tr('Delivery requested')}</Text>
              </View>
              <DetailRow icon="cloud-outline" label={tr('Digital')} value={brief.digitalDeliveryLabel} />
              <DetailRow icon="print-outline" label={tr('Print products')} value={brief.printDeliveryLabel} />

              <Pressable
                onPress={() => setShowVenueSchedule((s) => !s)}
                style={styles.linkRow}
                accessibilityRole="button"
                accessibilityState={{ expanded: showVenueSchedule }}
              >
                <Ionicons name="location-outline" size={16} color={colors.link} />
                <Text style={styles.linkText}>{tr('Venue and schedule')}</Text>
                <Ionicons
                  name={showVenueSchedule ? 'chevron-up' : 'chevron-forward'}
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>
              {showVenueSchedule ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandTitle}>
                    {titleCase(opportunity.venue || opportunity.city || 'Kigali')}
                    {opportunity.distanceLabel ? ` (${opportunity.distanceLabel})` : ''}
                  </Text>
                  <Text style={styles.expandText}>
                    {formattedDate}
                    {opportunity.startTime ? ` · ${opportunity.startTime.slice(0, 5)}` : ''}
                    {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''}
                  </Text>
                  {brief.notesText ? <Text style={styles.expandText}>{brief.notesText}</Text> : null}
                </View>
              ) : null}
            </View>

            <View style={styles.accordion}>
              <Pressable
                onPress={() => toggleSection('coordinator')}
                style={styles.expandRow}
                accessibilityRole="button"
                accessibilityState={{ expanded: expandedSection === 'coordinator' }}
              >
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <View style={styles.expandRowText}>
                  <Text style={styles.expandRowTitle}>{tr('Offer coordination services')}</Text>
                  <Text style={styles.expandRowSub}>{tr('Define a separate scope and price.')}</Text>
                </View>
                <Ionicons
                  name={expandedSection === 'coordinator' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={colors.textMuted}
                />
              </Pressable>
              {expandedSection === 'coordinator' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandText}>
                    {tr('After you accept, you can propose event coordination as a separate service, with its own scope and fee.')}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => toggleSection('availability')}
                style={styles.expandRow}
                accessibilityRole="button"
                accessibilityState={{ expanded: expandedSection === 'availability' }}
              >
                <Ionicons name="calendar-number-outline" size={19} color={colors.primary} />
                <View style={styles.expandRowText}>
                  <Text style={styles.expandRowTitle}>{tr('Availability and team')}</Text>
                </View>
                <Ionicons
                  name={expandedSection === 'availability' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={colors.textMuted}
                />
              </Pressable>
              {expandedSection === 'availability' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandText}>
                    {formattedDate} · {opportunity.startTime?.slice(0, 5) || tr('Time to be confirmed')}
                    {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''} · {brief.coverageModeLabel} (
                    {brief.coverageHoursLabel})
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => toggleSection('policies')}
                style={styles.expandRow}
                accessibilityRole="button"
                accessibilityState={{ expanded: expandedSection === 'policies' }}
              >
                <Ionicons name="document-text-outline" size={19} color={colors.primary} />
                <View style={styles.expandRowText}>
                  <Text style={styles.expandRowTitle}>{tr('Policies and exclusions')}</Text>
                </View>
                <Ionicons
                  name={expandedSection === 'policies' ? 'chevron-up' : 'chevron-forward'}
                  size={17}
                  color={colors.textMuted}
                />
              </Pressable>
              {expandedSection === 'policies' ? (
                <View style={styles.expandContent}>
                  <Text style={styles.expandText}>
                    {tr("Client's schedule")}: {brief.digitalDeliveryLabel}
                  </Text>
                  <Text style={styles.expandText}>
                    {tr('Your package')}:{' '}
                    {packageDays != null && packageDays > 0 ? `${packageDays} ${packageDays === 1 ? tr('day') : tr('days')}` : tr('Not set')}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [styles.acceptBtn, pressed && styles.btnPressed, locked && styles.btnDisabled]}
                  onPress={handleAcceptClientPolicy}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Accept offer')}
                >
                  <Ionicons name="checkmark-circle" size={22} color={onFill} />
                  <Text style={styles.acceptBtnText}>
                    {busyAction === 'accept_client' ? tr('Sending...') : tr('Accept offer')}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.packageBtn, pressed && styles.btnPressed, locked && styles.btnDisabled]}
                  onPress={handleAcceptPackagePolicy}
                  disabled={locked}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Accept with my delivery package policy')}
                >
                  <Ionicons name="cube-outline" size={22} color={colors.link} />
                  <Text style={styles.packageBtnText}>
                    {busyAction === 'accept_package' ? tr('Sending...') : tr('Accept with my delivery package policy')}
                  </Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [styles.declineBtn, pressed && styles.btnPressed, busyAction !== null && styles.btnDisabled]}
                onPress={handleRejectOffer}
                disabled={busyAction !== null}
                accessibilityRole="button"
                accessibilityLabel={tr('Reject offer')}
              >
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={styles.declineBtnText}>
                  {busyAction === 'reject' ? tr('Sending...') : tr('Reject offer')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

/** One line of an offer: what it is on the left, the value on the right, wrapping onto more lines when it is long. */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelCol}>
        <Ionicons name={icon} size={15} color={colors.textMuted} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
