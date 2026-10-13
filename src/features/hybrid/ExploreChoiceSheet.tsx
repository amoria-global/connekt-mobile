/**
 * What "Explore events" opens: two clear choices instead of going straight to
 * the public feed.
 *
 *   Post my event        create the event and get the best recommended
 *                        photographer (Post My Event).
 *   Explore and watch    browse public events and live streams.
 *
 * A guest who picks the first has the intent remembered (pendingPostEvent)
 * and is asked to sign in by the host screen; the wizard opens on the home
 * screen once they are in.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { MODE_META } from './hybridUi';
import { pendingPostEvent, postChoiceTarget } from './postEventIntent';

export { pendingPostEvent };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Whether someone is signed in (as a client or coordinator who can post). */
  signedIn: boolean;
  /** Open the wizard in place instead of navigating to its screen. */
  onPostEvent?: () => void;
  /**
   * A guest chose to post. The sign-in screen hosts this sheet, so pushing
   * /login from here lands on the same screen and nothing happens; the host
   * asks for sign-in itself instead. Without it, the guest is sent to /login.
   */
  onSignInRequired?: () => void;
};

export function ExploreChoiceSheet({ visible, onClose, signedIn, onPostEvent, onSignInRequired }: Props) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const post = () => {
    onClose();
    const target = postChoiceTarget({ signedIn, canAskSignIn: !!onSignInRequired, canOpenInPlace: !!onPostEvent });
    if (!signedIn) pendingPostEvent.set();
    setTimeout(() => {
      if (target === 'ask-sign-in-here') onSignInRequired?.();
      else if (target === 'login-screen') router.push('/login' as never);
      else if (target === 'wizard-in-place') onPostEvent?.();
      else router.push('/event/hybrid-wizard' as never);
    }, 150);
  };

  const explore = () => {
    onClose();
    setTimeout(() => router.push('/explore-events' as never), 150);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close">
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Grab Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title} accessibilityRole="header">Explore Events</Text>
              <Text style={styles.subtitle}>Post an event to find a photographer, or watch public live streams.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.textSoft} />
            </Pressable>
          </View>

          {/* Option 1: Post My Event (Smart Matching) */}
          <Pressable
            onPress={post}
            style={({ pressed }) => [
              styles.card,
              styles.cardFeatured,
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Post your event and get matched with available photographers"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(242, 12, 143, 0.16)' : 'rgba(242, 12, 143, 0.08)' }]}>
                <Ionicons name="calendar" size={20} color="#F20C8F" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>Post Your Event</Text>
                  <View style={[styles.typePill, styles.typePillFeatured]}>
                    <Ionicons name="flash" size={8} color="#F20C8F" />
                    <Text style={[styles.typePillText, { color: '#F20C8F' }]}>Faster</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>
                  Share your event date, location, and budget. Photographers who are free will reply, and you choose who you like.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="notifications-outline" size={14} color={colors.textMuted} />
                <Text style={styles.featureText}>Photographers who are actually free respond to you</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.featureText}>Only creators available for your date can accept</Text>
              </View>
              {!signedIn ? (
                <View style={styles.featureItem}>
                  <Ionicons name="log-in-outline" size={14} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.primary, fontWeight: fontWeight.semibold }]}>Quick sign-in to get started</Text>
                </View>
              ) : null}
            </View>
          </Pressable>

          {/* Option 2: Explore Public Events & Streams */}
          <Pressable
            onPress={explore}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Explore and watch public events"
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.08)' }]}>
                <Ionicons name="videocam" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>Explore & Watch</Text>
                  <View style={[styles.typePill, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <View style={styles.liveDot} />
                    <Text style={[styles.typePillText, { color: '#EF4444' }]}>Live & public</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc}>
                  Browse public community celebrations, view photo galleries, and join active live streams.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Ionicons name="play-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.featureText}>Watch live photography streams in real time</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="compass-outline" size={14} color={colors.textMuted} />
                <Text style={styles.featureText}>Discover public events and celebrations across Rwanda</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  scrim: {
    flex: 1,
    backgroundColor: c.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(3),
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: c.borderSoft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.card,
    ...e(1),
  },
  cardFeatured: {
    borderColor: 'rgba(242, 12, 143, 0.28)',
    backgroundColor: c.card,
    ...e(1),
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  typePillFeatured: {
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderColor: 'rgba(242, 12, 143, 0.22)',
  },
  typePillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: fontWeight.bold,
    color: c.text,
    letterSpacing: -0.3,
  },
  cardDesc: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18.5,
    marginTop: 2,
  },
  featureList: {
    gap: 7,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12.5,
    color: c.textSoft,
  },
}));
