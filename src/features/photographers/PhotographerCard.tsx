import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, fontSize, fontWeight, radii, spacing } from '@/theme';
import type { Photographer } from './api';
import { PHOTOGRAPHER_COVER_PLACEHOLDER } from "@/utils/placeholders";

export function PhotographerCard({ photographer }: { photographer: Photographer }) {
  const initials = (photographer.name?.[0] ?? '?').toUpperCase();
  const ratingText = photographer.rating ? photographer.rating.toFixed(1) : 'New';
  const reviewsCount = photographer.reviewCount ?? 0;
  
  // Use a fallback cover image if none is provided
  const coverSource = photographer.coverImage
    ? { uri: photographer.coverImage }
    : PHOTOGRAPHER_COVER_PLACEHOLDER;

  return (
    <View style={styles.card}>
      {/* Cover Image Section */}
      <View style={styles.coverContainer}>
        <Image source={coverSource} style={styles.coverImage} />
        
        {/* Top Left: Available Badge */}
        <View style={styles.badgeTopLeft}>
          <View style={styles.dotAvailable} />
          <Text style={styles.textAvailable}>AVAILABLE</Text>
        </View>

        {/* Top Right: Rating Badge */}
        <View style={styles.badgeTopRight}>
          <Ionicons name="star" size={12} color="#FBBF24" />
          <Text style={styles.textRating}>
            {ratingText} <Text style={styles.textReviewsCount}>({reviewsCount})</Text>
          </Text>
        </View>

        {/* Bottom Right: Bookmark Button */}
        <View style={styles.badgeBottomRight}>
          <Ionicons name="bookmark-outline" size={16} color={colors.textMuted} />
        </View>
        
        {/* Bottom Left: Avatar overlapping */}
        <View style={styles.avatarContainer}>
          {photographer.avatar ? (
            <Image source={{ uri: photographer.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {/* Optional verified checkmark on bottom right of avatar */}
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#3B82F6" style={{ backgroundColor: 'white', borderRadius: 10, overflow: 'hidden' }} />
          </View>
        </View>
      </View>

      {/* Details Section */}
      <View style={styles.detailsContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {photographer.name}
        </Text>
        {photographer.category ? (
          <Text style={styles.category} numberOfLines={1}>
            {photographer.category}
          </Text>
        ) : null}
        
        <View style={styles.metaRow}>
          {photographer.location ? (
            <View style={styles.location}>
              <Ionicons name="location-outline" size={13} color={colors.textMuted} />
              <Text style={styles.locationText} numberOfLines={1}>
                {photographer.location}
              </Text>
            </View>
          ) : null}
          
          <View style={styles.priceRow}>
            {photographer.startingPrice !== undefined ? (
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
                  From <Text style={styles.priceValue}>${photographer.startingPrice}</Text>
                </Text>
              </View>
            ) : (
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>Pricing</Text>
                <Text style={styles.priceValue}>On request</Text>
              </View>
            )}
            
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText}>Get in touch</Text>
              <Ionicons name="arrow-forward" size={12} color="white" />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    margin: spacing.xs, // small margin for grid gap
  },
  coverContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.surfaceMuted,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badgeTopLeft: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  dotAvailable: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981', // green
  },
  textAvailable: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  badgeTopRight: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
  },
  textRating: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
  },
  textReviewsCount: {
    fontWeight: '400',
    color: colors.textMuted,
  },
  badgeBottomRight: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -16, // Half overlap
    left: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white', // For the border effect
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: colors.textOnPrimary,
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  detailsContainer: {
    padding: spacing.md,
    paddingTop: 24, // Space for overlapping avatar
    gap: 4,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  category: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'column',
    gap: 6,
    marginTop: 4,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  locationText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceContainer: {
    flex: 1,
  },
  priceText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  priceValue: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  ctaText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
});
