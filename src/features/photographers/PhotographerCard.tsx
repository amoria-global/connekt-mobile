import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import type { Photographer } from './api';
import { PHOTOGRAPHER_COVER_PLACEHOLDER } from '@/utils/placeholders';

import { VerifiedAvatar } from '@/components/ui/VerifiedAvatar';
import { useSharedT } from '@/i18n/sharedStrings';

import { CoverCarousel } from './CoverCarousel';
import { startingPriceText } from './pricing';

export function PhotographerCard({
  photographer,
  isBookmarked = false,
  onToggleBookmark,
  coverHeight = 136,
}: {
  photographer: Photographer;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  coverHeight?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const [coverWidth, setCoverWidth] = useState(175);

  const rating = photographer.rating ?? 0;
  const ratingText = rating > 0 ? rating.toFixed(1) : tr('New');
  const reviewsCount = photographer.reviewCount ?? 0;
  const completedJobs = photographer.completedJobs ?? 0;
  const isBooked = photographer.currentStatus === 'booked';
  const specialties = photographer.specialties ?? [];

  const carouselImages = useMemo(() => {
    if (photographer.images && photographer.images.length > 0) {
      return photographer.images;
    }
    if (photographer.coverImage) {
      return [photographer.coverImage];
    }
    return [];
  }, [photographer.images, photographer.coverImage]);

  return (
    <View style={styles.card}>
      {/* COVER SECTION */}
      <View
        style={[styles.coverContainer, coverHeight != null && { height: coverHeight }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setCoverWidth(w);
        }}
      >
        <CoverCarousel images={carouselImages} width={coverWidth} />

        {/* Top-Left: Availability Status Pill */}
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, isBooked && styles.statusDotBooked]} />
          <Text style={[styles.statusText, isBooked && styles.statusTextBooked]}>
            {isBooked ? tr('Booked') : tr('Available')}
          </Text>
        </View>

        {/* Top-Right: Rating Pill */}
        {rating > 0 && (
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {ratingText}
              {reviewsCount > 0 ? (
                <Text style={styles.ratingCount}> ({reviewsCount})</Text>
              ) : null}
            </Text>
          </View>
        )}

        {/* Top-Right Below Rating: Bookmark Action Button */}
        <Pressable
          style={styles.bookmarkBtn}
          onPress={onToggleBookmark}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            isBookmarked
              ? `Remove ${photographer.name} from saved photographers`
              : `Save ${photographer.name}`
          }
          accessibilityState={{ selected: isBookmarked }}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={13}
            color={isBookmarked ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* Avatar - Straddles the boundary between Cover & Body */}
      <View style={[styles.avatarContainer, { top: (coverHeight ?? 136) - 24 }]}>
        <VerifiedAvatar
          uri={photographer.avatar}
          name={photographer.name}
          size={48}
          verified={photographer.isVerified !== false}
        />
      </View>

      {/* CARD BODY */}
      <View style={styles.detailsContainer}>
        {/* Name & Headline */}
        <Text style={styles.name} numberOfLines={1}>
          {photographer.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.headline} numberOfLines={1}>
            {photographer.category || tr('Photographer')}
          </Text>
          {photographer.location ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons name="location-sharp" size={10} color={colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {photographer.location}
              </Text>
            </>
          ) : null}
        </View>

        {/* Stats Strip: Completed shoots & reviews count */}
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <Ionicons name="videocam" size={11} color={colors.primary} />
            <Text style={styles.statNum}>{completedJobs}</Text>
            <Text style={styles.statLabel}>{tr('shoots')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-ellipses" size={11} color={colors.primary} />
            <Text style={styles.statNum}>{reviewsCount}</Text>
            <Text style={styles.statLabel}>{tr('reviews')}</Text>
          </View>
        </View>

        {/* Specialty Micro Chips */}
        {specialties.length > 0 ? (
          <View style={styles.chipsRow}>
            {specialties.slice(0, 2).map((s, idx) => (
              <View key={idx} style={styles.specialtyChip}>
                <Text style={styles.specialtyChipText} numberOfLines={1}>
                  {s}
                </Text>
              </View>
            ))}
            {specialties.length > 2 && (
              <View style={[styles.specialtyChip, styles.specialtyChipMore]}>
                <Text style={styles.specialtyChipMoreText}>
                  +{specialties.length - 2}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Bottom CTA Row: Pricing (On Request) + "Get in touch" Button */}
        <View style={styles.ctaRow}>
          <View style={styles.priceWrap}>
            <Text style={styles.priceLabel}>{tr('PRICING')}</Text>
            <Text style={styles.priceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {tr(startingPriceText(photographer))}
            </Text>
          </View>

          <View style={styles.getInTouchBtn}>
            <Text style={styles.getInTouchText}>{tr('Get in touch')}</Text>
            <Ionicons name="arrow-forward" size={11} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  card: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(1),
  },
  coverContainer: {
    height: 142,
    width: '100%',
    position: 'relative',
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  hiddenPreloadContainer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenPreloadImage: {
    width: 1,
    height: 1,
  },

  // Status Pill (Available / Booked)
  statusPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    gap: 4.5,
    zIndex: 2,
    ...e(1),
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.success,
  },
  statusDotBooked: {
    backgroundColor: c.error,
  },
  statusText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: c.success,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusTextBooked: {
    color: c.error,
  },

  // Rating Pill
  ratingPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    gap: 3.5,
    zIndex: 2,
    ...e(1),
  },
  ratingText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: c.text,
  },
  ratingCount: {
    fontFamily: fonts.regular,
    color: c.textMuted,
    fontSize: 9.5,
  },

  // Bookmark Button on Cover
  bookmarkBtn: {
    position: 'absolute',
    top: 42,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...e(1),
  },

  // Avatar Straddling Boundary. Ring, seal and fallback live in VerifiedAvatar.
  avatarContainer: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 10,
    elevation: 10,
  },

  // Details
  detailsContainer: {
    padding: spacing.md,
    paddingTop: 24,
    gap: 3,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headline: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    maxWidth: 160,
    flexShrink: 1,
  },
  metaDot: {
    fontSize: 10,
    color: c.borderSoft,
  },
  locationText: {
    fontSize: 10.5,
    fontFamily: fonts.regular,
    color: c.textMuted,
    flex: 1,
  },

  // Stats Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.text,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.textMuted,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: c.borderSoft,
  },

  // Specialty Chips
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  specialtyChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  specialtyChipText: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: c.text,
    maxWidth: 70,
  },
  specialtyChipMore: {
    backgroundColor: c.tint,
    borderColor: c.primary + '30',
  },
  specialtyChipMoreText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
  },

  // CTA Row: Pricing (On request) + Get in touch
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    gap: 6,
  },
  priceWrap: {
    flexShrink: 1,
    minWidth: 50,
    marginRight: 4,
  },
  priceLabel: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  priceValue: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.text,
  },
  getInTouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    flexShrink: 0,
    ...e(1),
  },
  getInTouchText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
}));
