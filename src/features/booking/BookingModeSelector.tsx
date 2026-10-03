/**
 * BookingModeSelector — Component per Figma Slide 02/03.
 *
 * Prompts the client with the dual-entry booking fork:
 *   01. Find a Photographer (DIRECT): Browse, filter, and book directly.
 *   02. Post My Event (HYBRID): Create event first and let matching engine surface candidates.
 *
 * Converges downstream into the shared booking + escrow service.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

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
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const handleDirect = () => {
    onClose();
    if (onSelectDirect) {
      onSelectDirect();
    } else {
      router.push('/photographers' as never);
    }
  };

  const handleHybrid = () => {
    onClose();
    if (onSelectHybrid) {
      onSelectHybrid();
    } else {
      router.push('/event/hybrid-wizard' as never);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={12} color={colors.primary} />
              <Text style={styles.badgeText}>NEW BOOKING</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.title}>How do you want to find your photographer?</Text>
          <Text style={styles.subtitle}>
            Choose between direct browsing or posting your brief for automated matches.
          </Text>

          <View style={styles.optionsList}>
            {/* 01. DIRECT BOOKING */}
            <Pressable
              style={({ pressed }) => [styles.optionCard, pressed && styles.cardPressed]}
              onPress={handleDirect}
            >
              <View style={[styles.optionIconBox, { backgroundColor: colors.tint }]}>
                <Ionicons name="search" size={22} color={colors.primary} />
              </View>
              <View style={styles.optionContent}>
                <View style={styles.optionHeaderRow}>
                  <Text style={styles.optionTitle}>Find a Photographer</Text>
                  <View style={styles.modeTag}>
                    <Text style={styles.modeTagText}>DIRECT</Text>
                  </View>
                </View>
                <Text style={styles.optionDesc}>
                  Browse, filter and book directly from the vetted photographer marketplace.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            {/* 02. HYBRID MATCHING */}
            <Pressable
              style={({ pressed }) => [
                styles.optionCard,
                styles.hybridOptionCard,
                pressed && styles.cardPressed,
              ]}
              onPress={handleHybrid}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="sparkles" size={22} color="#7C3AED" />
              </View>
              <View style={styles.optionContent}>
                <View style={styles.optionHeaderRow}>
                  <Text style={styles.optionTitle}>Post My Event</Text>
                  <View style={[styles.modeTag, { backgroundColor: '#EDE9FE' }]}>
                    <Text style={[styles.modeTagText, { color: '#7C3AED' }]}>HYBRID</Text>
                  </View>
                </View>
                <Text style={styles.optionDesc}>
                  Create the event first and let Connekyt surface matching nearby photographers.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.footerNoteText}>
              Shared downstream booking, secure escrow payment & event lifecycle.
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
    letterSpacing: 0.8,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
    marginTop: -4,
  },
  optionsList: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  hybridOptionCard: {
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    gap: 3,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  modeTag: {
    backgroundColor: c.tint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  modeTagText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.primary,
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 16,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  footerNoteText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
}));
