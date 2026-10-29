/**
 * IncomingOpportunityAlertModal — Full-screen incoming shoot offer overlay.
 *
 * Matches the Offer Receiver design:
 *   - Top "Requested: Photography + video" scope banner
 *   - Side-by-side "CLIENT'S OFFER" & "YOUR UPLOADED PACKAGE" comparison cards
 *   - "Requested deliverables" (Coverage, Edited photos, Short/Long videos,
 *     Photo book, Photo album, Wall portraits, Instant updates)
 *   - "Delivery requested" (Digital deadline, Print products, Venue & schedule)
 *   - Expandable rows:
 *       1. Coordinator? Propose coordination services
 *       2. Check availability & team
 *       3. Review policies and exclusions
 *   - Accept & Decline action bar
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from '@/utils/safeAudio';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useSharedT } from '@/i18n/sharedStrings';
import type { PhotographerOpportunity } from './types';
import { countdownString, useCountdown } from './hybridUi';
import { parseOpportunityOfferBrief } from './offerBrief';

const RINGTONE = require('../../../assets/sounds/connekyt_ringtone.wav');

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
  const [showVenueDetails, setShowVenueDetails] = useState(false);
  const [expandedSection, setExpandedSection] = useState<
    null | 'coordinator' | 'availability' | 'policies'
  >(null);

  const pulseScale = useRef(new Animated.Value(1)).current;

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
      // Non-fatal
    }
    const cap = setTimeout(() => player?.pause(), MAX_RING_MS);
    return () => {
      clearTimeout(cap);
      player?.remove();
      ringtone.current = null;
    };
  }, [ringingFor]);

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

  const left = useCountdown(
    visible ? opportunity?.responseDeadlineAt || opportunity?.candidateExpiresAt || opportunity?.expiresAt : null,
  );

  if (!visible || !opportunity) return null;

  const brief = parseOpportunityOfferBrief(opportunity);

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

  const clientOfferNum = opportunity.maxBudget ?? opportunity.minBudget ?? 450000;
  const uploadedPkgNum =
    typeof opportunity.matchedPackagePrice === 'number' && opportunity.matchedPackagePrice > 0
      ? Math.round(opportunity.matchedPackagePrice)
      : Math.round((clientOfferNum * 1.22) / 10000) * 10000;
  const uploadedPkgName = opportunity.matchedPackageName?.trim() || tr('Complete');
  const diffNum = Math.max(0, uploadedPkgNum - clientOfferNum);

  const clientOfferDisplay = formatPrice(clientOfferNum, opportunity.currency || 'RWF');
  const uploadedPkgDisplay = formatPrice(
    uploadedPkgNum,
    opportunity.matchedPackageCurrency || opportunity.currency || 'RWF',
  );
  const diffDisplay = formatPrice(diffNum, opportunity.currency || 'RWF');

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

  const toggleSection = (key: 'coordinator' | 'availability' | 'policies') => {
    setExpandedSection((prev) => (prev === key ? null : key));
  };

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
            <Text style={styles.liveText}>{tr('INCOMING CLIENT OFFER')}</Text>
          </View>

          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={styles.timerText}>
              {left?.done ? formattedCountdown : `${formattedCountdown} to answer`}
            </Text>
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

        {/* 2. SCROLLABLE OFFER CONTENT (Matches uploaded_media_2) */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Requested Mode Pill Bar */}
          <View style={styles.requestedBanner}>
            <Ionicons name="videocam-outline" size={16} color={colors.accent} />
            <Text style={styles.requestedBannerText}>
              {tr('Requested')}: {brief.coverageModeLabel}
            </Text>
            {opportunity.eventType ? (
              <Text style={styles.requestedEventType}>• {opportunity.eventType}</Text>
            ) : null}
          </View>

          {/* Side-by-Side Comparison Cards: CLIENT'S OFFER vs YOUR UPLOADED PACKAGE */}
          <View style={styles.comparisonGrid}>
            {/* Left Card: CLIENT'S OFFER */}
            <View style={[styles.compareCard, styles.clientOfferCard]}>
              <View style={styles.compareEyebrowRow}>
                <Ionicons name="wallet-outline" size={14} color={colors.accent} />
                <Text style={styles.compareEyebrow}>{tr("CLIENT'S OFFER")}</Text>
              </View>
              <Text style={styles.clientOfferAmount}>{clientOfferDisplay}</Text>
              <Text style={styles.compareSubtitle}>{tr('For the complete requested scope')}</Text>
              <View style={styles.compareDivider} />
              <Text style={styles.compareFootnote}>
                {brief.pricingDecisionLabel === 'RECOMMENDED'
                  ? tr('Client used recommended package pricing.')
                  : tr('Client published their own budget.')}
              </Text>
            </View>

            {/* Right Card: YOUR UPLOADED PACKAGE */}
            <View style={[styles.compareCard, styles.uploadedPkgCard]}>
              <View style={styles.compareEyebrowRow}>
                <Ionicons name="pricetag-outline" size={14} color={colors.info} />
                <Text style={[styles.compareEyebrow, { color: colors.info }]}>
                  {tr('YOUR UPLOADED PACKAGE')}
                </Text>
              </View>
              <Text style={styles.uploadedPkgAmount}>
                {uploadedPkgName} • {uploadedPkgDisplay}
              </Text>
              <Text style={styles.diffHighlight}>
                {diffNum > 0
                  ? `${diffDisplay} ${tr("above the client's offer")}`
                  : tr("Matches the client's offer")}
              </Text>
              <View style={styles.compareDivider} />
              <Text style={styles.compareFootnote}>
                {tr('Compare inclusions before responding.')}
              </Text>
            </View>
          </View>

          {/* Side-by-Side Detail Boxes: Requested deliverables + Delivery requested */}
          <View style={styles.detailsGrid}>
            {/* Box 1: Requested deliverables */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Ionicons name="list-outline" size={16} color={colors.primary} />
                <Text style={styles.detailBoxTitle}>{tr('Requested deliverables')}</Text>
              </View>

              {(
                [
                  ['time-outline', tr('Coverage'), brief.coverageHoursLabel],
                  ['image-outline', tr('Edited photos'), brief.editedPhotosLabel],
                  ['videocam-outline', tr('Short videos'), brief.shortVideosLabel],
                  ['film-outline', tr('Long videos'), brief.longVideosLabel],
                  ['radio-outline', tr('Live stream'), brief.liveStreamLabel],
                  ['sparkles-outline', tr('Wishes & memories'), brief.instantWishesLabel],
                  ['book-outline', tr('Photo book'), brief.photoBookLabel],
                  ['images-outline', tr('Photo album'), brief.photoAlbumLabel],
                  ['easel-outline', tr('Wall portraits'), brief.wallPortraitsLabel],
                  ['flash-outline', tr('Instant updates'), brief.instantUpdatesLabel],
                ] as [keyof typeof Ionicons.glyphMap, string, string][]
              ).map(([icon, label, val]) => (
                <View key={label} style={styles.deliverableRow}>
                  <Ionicons name={icon} size={14} color={colors.textMuted} />
                  <Text style={styles.deliverableKey}>{label}</Text>
                  <Text style={styles.deliverableVal} numberOfLines={1}>
                    {val}
                  </Text>
                </View>
              ))}
            </View>

            {/* Box 2: Delivery requested */}
            <View style={styles.detailBox}>
              <View style={styles.detailBoxHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.detailBoxTitle}>{tr('Delivery requested')}</Text>
              </View>

              <View style={styles.deliverableRow}>
                <Ionicons name="cloud-outline" size={14} color={colors.textMuted} />
                <Text style={styles.deliverableKey}>{tr('Digital')}</Text>
                <Text style={styles.deliverableVal}>{brief.digitalDeliveryLabel}</Text>
              </View>

              <View style={styles.deliverableRow}>
                <Ionicons name="print-outline" size={14} color={colors.textMuted} />
                <Text style={styles.deliverableKey}>{tr('Print products')}</Text>
                <Text style={styles.deliverableVal}>{brief.printDeliveryLabel}</Text>
              </View>

              <View style={styles.compareDivider} />

              <Pressable
                onPress={() => setShowVenueDetails((v) => !v)}
                style={styles.venueLinkRow}
                accessibilityRole="button"
              >
                <Ionicons name="location-outline" size={15} color={colors.info} />
                <Text style={styles.venueLinkText}>
                  {tr('View venue, schedule & references')}
                </Text>
                <Ionicons
                  name={showVenueDetails ? 'chevron-up' : 'chevron-forward'}
                  size={15}
                  color={colors.info}
                />
              </Pressable>

              {showVenueDetails ? (
                <View style={styles.venueExpandedBox}>
                  <Text style={styles.venueExpandedTitle}>{opportunity.eventTitle}</Text>
                  <Text style={styles.venueExpandedMeta}>
                    {formattedDate} • {opportunity.startTime?.slice(0, 5)}
                    {opportunity.endTime ? `–${opportunity.endTime.slice(0, 5)}` : ''} (
                    {brief.coverageHoursLabel})
                  </Text>
                  <Text style={styles.venueExpandedMeta}>
                    {opportunity.venue || opportunity.city || tr('Location shared on booking')}
                    {opportunity.distanceLabel ? ` • ${opportunity.distanceLabel}` : ''}
                  </Text>
                  {brief.styleLabel ? (
                    <Text style={styles.venueExpandedMeta}>
                      {tr('Style & Usage')}: {brief.styleLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* 3 Interactive Bottom Rows (Matches uploaded_media_2) */}
          <View style={{ gap: spacing.xs }}>
            <Pressable
              onPress={() => toggleSection('coordinator')}
              style={styles.expandRow}
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={18} color={colors.accent} />
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
                size={16}
                color={colors.textMuted}
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
              <Ionicons name="document-text-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expandRowTitle}>{tr('Check availability & team')}</Text>
              </View>
              <Ionicons
                name={expandedSection === 'availability' ? 'chevron-up' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
            {expandedSection === 'availability' ? (
              <View style={styles.expandContent}>
                <Text style={styles.expandContentText}>
                  {formattedDate} • {opportunity.startTime?.slice(0, 5)}
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
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expandRowTitle}>{tr('Review policies and exclusions')}</Text>
              </View>
              <Ionicons
                name={expandedSection === 'policies' ? 'chevron-up' : 'chevron-forward'}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
            {expandedSection === 'policies' ? (
              <View style={styles.expandContent}>
                <Text style={styles.expandContentText}>
                  {tr(
                    'Escrow payment is held securely by Connekyt until digital and print deliverables are handed over according to the agreed schedule.',
                  )}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

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
  scrollContent: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  requestedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  requestedBannerText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  requestedEventType: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.semibold,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  compareCard: {
    flex: 1,
    minWidth: 155,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    gap: 4,
  },
  clientOfferCard: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  uploadedPkgCard: {
    backgroundColor: c.card,
    borderColor: c.borderSoft,
  },
  compareEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compareEyebrow: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.7,
    color: c.textSoft,
  },
  clientOfferAmount: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  uploadedPkgAmount: {
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  compareSubtitle: {
    fontSize: 11.5,
    color: c.textSoft,
  },
  diffHighlight: {
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
    color: c.accent,
  },
  compareDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.borderSoft,
    marginVertical: 4,
  },
  compareFootnote: {
    fontSize: 11,
    color: c.textMuted,
  },
  detailsGrid: {
    gap: spacing.sm,
  },
  detailBox: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
    padding: spacing.md,
    gap: 7,
  },
  detailBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  detailBoxTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliverableKey: {
    fontSize: 11.5,
    color: c.textMuted,
    width: 105,
  },
  deliverableVal: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  venueLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  venueLinkText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: fontWeight.bold,
    color: c.info,
    textDecorationLine: 'underline',
  },
  venueExpandedBox: {
    marginTop: 4,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    gap: 2,
  },
  venueExpandedTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  venueExpandedMeta: {
    fontSize: 11,
    color: c.textSoft,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  expandRowTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  expandRowSub: {
    fontSize: 11,
    color: c.textMuted,
  },
  expandContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  expandContentText: {
    fontSize: 11.5,
    color: c.textSoft,
    lineHeight: 16,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  declineBtn: {
    flex: 1,
    height: 50,
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
    fontSize: 13.5,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  acceptBtn: {
    flex: 1.5,
    height: 50,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    fontWeight: fontWeight.bold,
    color: c.textOnPrimary,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
}));
