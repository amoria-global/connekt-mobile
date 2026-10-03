import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import type { CandidateSummary, RecommendationTier } from './types';

type Props = {
  candidate: CandidateSummary;
  onSelect: (candidate: CandidateSummary) => void;
  onViewProfile?: (candidate: CandidateSummary) => void;
  selecting?: boolean;
};

const TIER_CONFIG: Record<RecommendationTier, { label: string; bg: string; fg: string }> = {
  HIGH: { label: 'HIGH MATCH', bg: '#DCFCE7', fg: '#15803D' },
  MEDIUM: { label: 'GOOD MATCH', bg: '#FEF3C7', fg: '#B45309' },
  LOW: { label: 'ELIGIBLE', bg: '#F3F4F6', fg: '#4B5563' },
};

export function CandidateCard({ candidate, onSelect, onViewProfile, selecting }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const tier = TIER_CONFIG[candidate.recommendationTier] || TIER_CONFIG.LOW;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Image
          source={{ uri: candidate.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(candidate.name) }}
          style={styles.avatar}
          contentFit="cover"
        />

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {candidate.name}
            </Text>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
              <Text style={[styles.tierText, { color: tier.fg }]}>{tier.label}</Text>
            </View>
          </View>

          <View style={styles.subRow}>
            <Text style={styles.typeText}>
              {candidate.photographerType === 'STUDIO' ? 'Company / Studio' : 'Freelancer'}
            </Text>
            {candidate.distanceKm != null && (
              <>
                <Text style={styles.dot}>•</Text>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={styles.metaText}>{candidate.distanceKm.toFixed(1)} km</Text>
              </>
            )}
          </View>

          <View style={styles.ratingsRow}>
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {candidate.rating ? candidate.rating.toFixed(1) : '5.0'}
            </Text>
            <Text style={styles.reviewCount}>({candidate.reviewCount || 0} reviews)</Text>
          </View>
        </View>
      </View>

      <View style={styles.detailsRow}>
        {candidate.typicalPriceRange ? (
          <View style={styles.priceContainer}>
            <Text style={styles.detailLabel}>Typical Range</Text>
            <Text style={styles.priceValue}>{candidate.typicalPriceRange}</Text>
          </View>
        ) : null}

        {candidate.instagram?.handle ? (
          <View style={styles.instagramBadge}>
            <Ionicons name="logo-instagram" size={13} color="#E1306C" />
            <Text style={styles.instagramHandle}>@{candidate.instagram.handle}</Text>
            {candidate.instagram.followersCount ? (
              <Text style={styles.followerCount}>
                ({(candidate.instagram.followersCount > 999
                  ? `${(candidate.instagram.followersCount / 1000).toFixed(1)}k`
                  : candidate.instagram.followersCount)})
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        {onViewProfile && (
          <Pressable
            style={({ pressed }) => [styles.profileBtn, pressed && styles.btnPressed]}
            onPress={() => onViewProfile(candidate)}
          >
            <Text style={styles.profileBtnText}>View Profile</Text>
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
        >
          <Text style={styles.selectBtnText}>
            {selecting ? 'Locking...' : 'Select & Book'}
          </Text>
          <Ionicons name="arrow-forward" size={15} color="#FFFFFF" style={{ marginLeft: 4 }} />
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
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceMuted,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  tierText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.3,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  dot: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  reviewCount: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    flexWrap: 'wrap',
    gap: 8,
  },
  priceContainer: {},
  detailLabel: {
    fontSize: 10,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  priceValue: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  instagramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instagramHandle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  followerCount: {
    fontSize: 11,
    color: c.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileBtn: {
    flex: 1,
    height: 42,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  selectBtn: {
    flex: 1.2,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
}));
