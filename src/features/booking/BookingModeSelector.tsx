/**
 * BookingModeSelector — Component per Figma Slide 02/03.
 *
 * Prompts the client with the dual-entry booking fork:
 *   01. Find a Photographer (DIRECT): Browse, filter, and book directly.
 *   02. Post My Event (HYBRID): Create event first and let matching engine surface candidates.
 *
 * Converges downstream into the shared booking + escrow service.
 * Redesigned to pro-grade standards with BlurView backdrop, spring physics,
 * tactile drag handle, explicit action buttons, and micro-features.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

export type BookingModeSelectorProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional custom navigation callback */
  onSelectDirect?: () => void;
  onSelectHybrid?: () => void;
};

export function BookingModeSelector({
  visible,
  onClose,
  onSelectDirect,
  onSelectHybrid,
}: BookingModeSelectorProps) {
  const { colors, gradients, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mounted, setMounted] = useState(visible);
  const animFade = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(350)).current;

  // Animate in and out smoothly
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(animY, {
          toValue: 0,
          tension: 70,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(animFade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animY, {
          toValue: 350,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible, mounted, animFade, animY]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(animFade, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(animY, {
        toValue: 350,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      onClose();
    });
  };

  const handleDirect = () => {
    handleDismiss();
    setTimeout(() => {
      if (onSelectDirect) {
        onSelectDirect();
      } else {
        router.push('/photographers' as never);
      }
    }, 180);
  };

  const handleHybrid = () => {
    handleDismiss();
    setTimeout(() => {
      if (onSelectHybrid) {
        onSelectHybrid();
      } else {
        router.push('/event/hybrid-wizard' as never);
      }
    }, 180);
  };

  // Drag down gesture responder on handle area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          animY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 0.75) {
          handleDismiss();
        } else {
          Animated.spring(animY, {
            toValue: 0,
            tension: 75,
            friction: 11,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Blur + Scrim Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: animFade }]}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 28 : 45}
            tint={isDark ? 'dark' : 'regular'}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close booking mode selector"
          />
        </Animated.View>

        {/* Animated Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs,
              transform: [{ translateY: animY }],
            },
          ]}
        >
          {/* Draggable Handle */}
          <View {...panResponder.panHandlers} style={styles.dragArea}>
            <View style={styles.sheetHandle} />
          </View>

          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={11.5} color={colors.primary} />
              <Text style={styles.badgeText}>CONNEKYT BOOKING</Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              hitSlop={12}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.title}>How do you want to find your photographer?</Text>
          <Text style={styles.subtitle}>
            Choose direct marketplace discovery or let Connekyt match your brief with nearby vetted talent.
          </Text>

          <View style={styles.optionsList}>
            {/* 01. DIRECT BOOKING */}
            <Pressable
              style={({ pressed }) => [styles.optionCard, pressed && styles.cardPressed]}
              onPress={handleDirect}
              accessibilityRole="button"
              accessibilityLabel="Find a Photographer via Direct Marketplace"
            >
              {/* Kicker Row */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.indexPill}>
                  <Text style={styles.indexPillText}>01 · DIRECT</Text>
                </View>
                <View style={styles.marketplaceTag}>
                  <Ionicons name="people-outline" size={11} color={colors.primary} />
                  <Text style={styles.marketplaceTagText}>MARKETPLACE</Text>
                </View>
              </View>

              {/* Main Content */}
              <View style={styles.cardBodyRow}>
                <View style={styles.directIconBox}>
                  <Ionicons name="camera-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.optionTitle}>Find a Photographer</Text>
                  <Text style={styles.optionDesc}>
                    Browse, filter, and book directly from Rwanda&apos;s verified creator profiles.
                  </Text>
                </View>
              </View>

              {/* Feature Pills */}
              <View style={styles.featurePillsRow}>
                <View style={styles.featurePill}>
                  <Ionicons name="images-outline" size={11} color={colors.primary} />
                  <Text style={styles.featurePillText}>Instant portfolios</Text>
                </View>
                <View style={styles.featurePill}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <Text style={styles.featurePillText}>Verified reviews</Text>
                </View>
                <View style={styles.featurePill}>
                  <Ionicons name="chatbubbles-outline" size={10} color={colors.primary} />
                  <Text style={styles.featurePillText}>Direct chat</Text>
                </View>
              </View>

              {/* Explicit Action Button CTA */}
              <View style={styles.directCtaBtn}>
                <Text style={styles.directCtaText}>Browse Marketplace</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.primary} />
              </View>
            </Pressable>

            {/* 02. HYBRID MATCHING (RECOMMENDED) */}
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                styles.hybridOptionCard,
                isDark && styles.hybridOptionCardDark,
                pressed && styles.cardPressed,
              ]}
              onPress={handleHybrid}
              accessibilityRole="button"
              accessibilityLabel="Post My Event for Smart Matching"
            >
              {/* Kicker Row */}
              <View style={styles.cardHeaderRow}>
                <View style={[styles.hybridIndexPill, isDark && styles.hybridIndexPillDark]}>
                  <Ionicons name="sparkles" size={11} color={colors.accent} />
                  <Text style={styles.hybridIndexPillText}>02 · RECOMMENDED</Text>
                </View>
                <View style={[styles.hybridTag, isDark && styles.hybridTagDark]}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.hybridTagText}>SMART MATCH</Text>
                </View>
              </View>

              {/* Main Content */}
              <View style={styles.cardBodyRow}>
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.hybridIconBox}
                >
                  <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.optionTitle}>Post My Event</Text>
                  <Text style={styles.optionDesc}>
                    Submit your shoot brief once. Nearby vetted creators ring in real-time to match.
                  </Text>
                </View>
              </View>

              {/* Feature Pills */}
              <View style={styles.featurePillsRow}>
                <View
                  style={[
                    styles.featurePill,
                    styles.hybridFeaturePill,
                    isDark && styles.hybridFeaturePillDark,
                  ]}
                >
                  <Ionicons name="call-outline" size={11} color={colors.accent} />
                  <Text
                    style={[
                      styles.featurePillText,
                      styles.hybridFeatureText,
                      isDark && styles.hybridFeatureTextDark,
                    ]}
                  >
                    Live ringing alert
                  </Text>
                </View>
                <View
                  style={[
                    styles.featurePill,
                    styles.hybridFeaturePill,
                    isDark && styles.hybridFeaturePillDark,
                  ]}
                >
                  <Ionicons name="location-outline" size={10} color={colors.accent} />
                  <Text
                    style={[
                      styles.featurePillText,
                      styles.hybridFeatureText,
                      isDark && styles.hybridFeatureTextDark,
                    ]}
                  >
                    Nearest creators
                  </Text>
                </View>
                <View
                  style={[
                    styles.featurePill,
                    styles.hybridFeaturePill,
                    isDark && styles.hybridFeaturePillDark,
                  ]}
                >
                  <Ionicons name="timer-outline" size={10} color={colors.accent} />
                  <Text
                    style={[
                      styles.featurePillText,
                      styles.hybridFeatureText,
                      isDark && styles.hybridFeatureTextDark,
                    ]}
                  >
                    Under 5 mins
                  </Text>
                </View>
              </View>

              {/* Explicit Action Button CTA with Brand Gradient */}
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.hybridCtaBtn}
              >
                <Text style={styles.hybridCtaText}>Post Brief & Match Talent</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer Security / Escrow Guarantee */}
          <View style={[styles.footerNote, isDark && styles.footerNoteDark]}>
            <View style={styles.shieldBox}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
            </View>
            <Text style={styles.footerNoteText}>
              <Text style={styles.footerHighlight}>Connekyt Escrow Protection: </Text>
              Funds are held securely and released only after you approve photo delivery.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
    ...e(4),
  },
  dragArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: c.border,
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginTop: -4,
  },
  optionsList: {
    gap: spacing.sm + 2,
    marginTop: 4,
  },
  optionCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs + 3,
    ...e(1),
  },
  hybridOptionCard: {
    borderColor: 'rgba(242, 12, 143, 0.32)',
    backgroundColor: 'rgba(242, 12, 143, 0.04)',
    ...e(2),
  },
  hybridOptionCardDark: {
    borderColor: 'rgba(242, 12, 143, 0.45)',
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indexPill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.15)',
  },
  indexPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
    letterSpacing: 0.6,
  },
  marketplaceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
    backgroundColor: c.tint,
  },
  marketplaceTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
    letterSpacing: 0.5,
  },
  hybridIndexPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
    paddingHorizontal: 8.5,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  hybridIndexPillDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.22)',
  },
  hybridIndexPillText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.accent,
    letterSpacing: 0.6,
  },
  hybridTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 7.5,
    paddingVertical: 2.5,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(242, 12, 143, 0.10)',
  },
  hybridTagDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.20)',
  },
  hybridTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.accent,
    letterSpacing: 0.5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  directIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hybridIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(2),
  },
  cardTextWrap: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.2,
  },
  optionDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16.5,
  },
  featurePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 1,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 0.5,
    borderColor: c.borderSoft,
  },
  featurePillText: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },
  hybridFeaturePill: {
    backgroundColor: 'rgba(242, 12, 143, 0.06)',
    borderColor: 'rgba(242, 12, 143, 0.20)',
  },
  hybridFeaturePillDark: {
    backgroundColor: 'rgba(242, 12, 143, 0.16)',
    borderColor: 'rgba(242, 12, 143, 0.30)',
  },
  hybridFeatureText: {
    color: c.accent,
  },
  hybridFeatureTextDark: {
    color: c.accentLight,
  },
  directCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.20)',
    paddingVertical: 8.5,
    borderRadius: radii.full,
    marginTop: 2,
  },
  directCtaText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: c.primary,
  },
  hybridCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9.5,
    borderRadius: radii.full,
    marginTop: 2,
    ...e(2),
  },
  hybridCtaText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginTop: 4,
  },
  footerNoteDark: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  shieldBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerNoteText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 15,
  },
  footerHighlight: {
    fontFamily: fonts.bold,
    color: c.text,
  },
}));
