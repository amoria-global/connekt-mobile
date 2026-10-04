import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import type { CandidateSummary, RecommendationTier } from './types';

type Props = {
  candidate: CandidateSummary;
  onSelect: (candidate: CandidateSummary) => void;
  onViewProfile?: (candidate: CandidateSummary) => void;
  selecting?: boolean;
};

const TIER_CONFIG: Record<
  RecommendationTier,
  { label: string; icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string; border: string }
> = {
  TOP_MATCH: {
    label: 'TOP MATCH',
    icon: 'sparkles',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#059669',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  STRONG_MATCH: {
    label: 'STRONG MATCH',
    icon: 'star',
    bg: 'rgba(8, 58, 133, 0.12)',
    fg: '#083A85',
    border: 'rgba(8, 58, 133, 0.3)',
  },
  GOOD_MATCH: {
    label: 'GOOD MATCH',
    icon: 'thumbs-up',
    bg: 'rgba(245, 158, 11, 0.12)',
    fg: '#D97706',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  ELIGIBLE: {
    label: 'ELIGIBLE',
    icon: 'checkmark-circle-outline',
    bg: 'rgba(100, 116, 139, 0.1)',
    fg: '#475569',
    border: 'rgba(100, 116, 139, 0.25)',
  },
  HIGH: {
    label: 'TOP MATCH',
    icon: 'sparkles',
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: '#059669',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  MEDIUM: {
    label: 'GOOD FIT',
    icon: 'star',
    bg: 'rgba(245, 158, 11, 0.12)',
    fg: '#D97706',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  LOW: {
    label: 'AVAILABLE',
    icon: 'checkmark-circle-outline',
    bg: 'rgba(100, 116, 139, 0.1)',
    fg: '#475569',
    border: 'rgba(100, 116, 139, 0.25)',
  },
};

export function CandidateCard({ candidate, onSelect, onViewProfile, selecting }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const tier = TIER_CONFIG[candidate.recommendationTier] || TIER_CONFIG.LOW;
  const rankLabel = candidate.rank ? `#${candidate.rank} ${tier.label}` : tier.label;
  const featuredPackage = candidate.packages?.[0];

  return (
    <View style={styles.card}>
      {/* Top Header Row with Avatar & Badges */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <Image
            source={{
              uri: candidate.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(candidate.name),
            }}
            style={styles.avatar}
            contentFit="cover"
          />
          {/* Verified Creator Badge */}
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {candidate.name}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg, borderColor: tier.border }]}>
              <Ionicons name={tier.icon} size={10} color={tier.fg} style={{ marginRight: 3 }} />
              <Text style={[styles.tierText, { color: tier.fg }]}>{rankLabel}</Text>
            </View>
          </View>

          <View style={styles.subRow}>
            <View style={styles.typeBadge}>
              <Ionicons
                name={candidate.photographerType === 'STUDIO' ? 'business-outline' : 'person-outline'}
                size={11}
                color={colors.primary}
              />
              <Text style={styles.typeText}>
                {candidate.photographerType === 'STUDIO' ? 'Studio & Agency' : 'Independent Pro'}
              </Text>
            </View>

            {candidate.distanceKm != null && (
              <View style={styles.distanceBadge}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.metaText}>{candidate.distanceKm.toFixed(1)} km away</Text>
              </View>
            )}
          </View>

          <View style={styles.ratingsRow}>
            <View style={styles.starRatingPill}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {candidate.rating ? candidate.rating.toFixed(1) : '5.0'}
              </Text>
            </View>
            <Text style={styles.reviewCount}>
              ({candidate.reviewCount || 0} verified reviews)
            </Text>
          </View>
        </View>
      </View>

      {/* Portfolio Preview Strip if available */}
      {Array.isArray(candidate.portfolioImages) && candidate.portfolioImages.length > 0 && (
        <View style={styles.portfolioRow}>
          {candidate.portfolioImages.slice(0, 3).map((imgUri, idx) => (
            <Image
              key={`${candidate.candidateId}-thumb-${idx}`}
              source={{ uri: imgUri }}
              style={styles.portfolioThumb}
              contentFit="cover"
            />
          ))}
        </View>
      )}

      {/* Details Box: Price Range & Social */}
      <View style={styles.detailsRow}>
        <View style={styles.priceContainer}>
          <Text style={styles.detailLabel}>
            {featuredPackage ? featuredPackage.name.toUpperCase() : 'TYPICAL RATE'}
          </Text>
          <Text style={styles.priceValue}>
            {featuredPackage
              ? `${featuredPackage.currency} ${featuredPackage.price.toLocaleString()}`
              : candidate.typicalPriceRange || 'Custom Quote'}
          </Text>
        </View>

        {candidate.instagram?.handle ? (
          <View style={styles.instagramBadge}>
            <Ionicons name="logo-instagram" size={14} color="#E1306C" />
            <Text style={styles.instagramHandle}>@{candidate.instagram.handle}</Text>
            {candidate.instagram.followersCount ? (
              <Text style={styles.followerCount}>
                ({candidate.instagram.followersCount > 999
                  ? `${(candidate.instagram.followersCount / 1000).toFixed(1)}k`
                  : candidate.instagram.followersCount})
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.availabilityPill}>
            <Ionicons name="calendar-sharp" size={12} color="#10B981" />
            <Text style={styles.availabilityText}>Confirmed Available</Text>
          </View>
        )}
      </View>

      {/* Trust & Escrow Assurance Banner */}
      <View style={styles.escrowTrustRow}>
        <Ionicons name="shield-checkmark" size={13} color="#10B981" />
        <Text style={styles.escrowTrustText}>
          Escrow Protected • 50% deposit held safely until shoot completion
        </Text>
      </View>

      {/* Action Buttons: Solid Colors, No Gradients */}
      <View style={styles.actionsRow}>
        {onViewProfile && (
          <Pressable
            style={({ pressed }) => [styles.profileBtn, pressed && styles.btnPressed]}
            onPress={() => onViewProfile(candidate)}
            accessibilityRole="button"
            accessibilityLabel={`View ${candidate.name}'s profile`}
          >
            <Ionicons name="eye-outline" size={15} color={colors.text} style={{ marginRight: 4 }} />
            <Text style={styles.profileBtnText}>View Portfolio</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.selectBtn,
            pressed && styles.btnPressed,
            selecting && styles.btnDisabled,
          ]}
          onPress={() => onSelect(candidate)}
          disabled={selecting}
          accessibilityRole="button"
          accessibilityLabel={`Select and book ${candidate.name}`}
        >
          <Ionicons name="lock-closed" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.selectBtnText}>
            {selecting ? 'Locking Date...' : 'Select & Book'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 3 }} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#083A85',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surface,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
    flex: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  tierText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  typeText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.primary,
    fontWeight: fontWeight.medium,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  starRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  ratingText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#B45309',
  },
  reviewCount: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  portfolioRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: -2,
  },
  portfolioThumb: {
    flex: 1,
    height: 72,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.lg,
    flexWrap: 'wrap',
    gap: 8,
  },
  priceContainer: {},
  detailLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.bold,
    color: c.primary,
    marginTop: 1,
  },
  instagramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  instagramHandle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  followerCount: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },
  availabilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  availabilityText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#059669',
  },
  escrowTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  escrowTrustText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textSoft,
    flex: 1,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: 2,
  },
  profileBtn: {
    flex: 1,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  selectBtn: {
    flex: 1.35,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: '#083A85',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#083A85',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  selectBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs + 1,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
}));

