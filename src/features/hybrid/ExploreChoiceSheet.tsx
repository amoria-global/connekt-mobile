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
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkPalette, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  GlassSurface,
  glassScrim,
  glassTile,
  sheetGlassRadius,
  useGlassEdge,
} from '@/components/ui/GlassCard';
import { pendingPostEvent, postChoiceTarget } from './postEventIntent';
import { useSharedT } from '@/i18n/sharedStrings';

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
  const { t, tr } = useSharedT();
  const glassEdge = useGlassEdge();
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
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={tr('Close')}>
        {/* Blur the screen behind, so only the sheet reads. Android cannot blur
            across a modal window, so the scrim colour does the work there. */}
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable
          style={[styles.sheet, glassEdge, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <GlassSurface detached strength="thick" style={sheetGlassRadius(radii['2xl'])} />
          {/* Grab Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">{t('exploreSheetTitle')}</Text>
              <Text style={styles.subtitle}>{t('exploreSheetSubtitle')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('Close')} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.textSoft} />
            </Pressable>
          </View>

          <View style={styles.options}>
            {/* Post My Event (smart matching): brand duotone, the featured choice */}
            <Pressable
              onPress={post}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('explorePostYourEvent')}
            >
              {/* Mirrored so the camera sits clear of the words, on the right. */}
              <Image
                source={POST_IMAGE}
                style={[styles.cover, styles.mirror]}
                contentFit="cover"
                contentPosition={{ left: '50%', top: '38%' }}
              />
              <CardCopy
                chip={
                  <View style={styles.chip}>
                    <Ionicons name="flash" size={10} color="#FFFFFF" />
                    <Text style={styles.chipText}>{t('exploreFastMatch')}</Text>
                  </View>
                }
                title={t('explorePostYourEvent')}
                // One line: sign-in, when needed, is asked for right after the tap.
                subtitle={t('exploreFreePhotographersReply')}
              />
            </Pressable>

            {/* Explore public events & live streams */}
            <Pressable
              onPress={explore}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('exploreWatchAndExplore')}
            >
              <Image source={LIVE_IMAGE} style={styles.cover} contentFit="cover" contentPosition={{ left: '62%', top: '45%' }} />
              <CardCopy
                chip={
                  <View style={[styles.chip, styles.chipLive]}>
                    <View style={styles.liveDot} />
                    <Text style={styles.chipText}>{t('exploreLiveAndPublic')}</Text>
                  </View>
                }
                title={t('exploreWatchAndExplore')}
                subtitle={t('exploreLiveStreamsAndPublic')}
              />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Both from Unsplash, free under the Unsplash License:
// a photographer at work by Joshua Hanson (unsplash.com/photos/eWMgNhI_Czw),
// a concert filmed on a phone by Adam Bentley (unsplash.com/photos/JNuKyKXLh8U).
const POST_IMAGE = require('../../../assets/images/explore-post.jpg');
const LIVE_IMAGE = require('../../../assets/images/explore-live.jpg');

/** A card's words: chip, title and one line on a left-to-right fade, plus the arrow. */
function CardCopy({ chip, title, subtitle }: { chip: React.ReactNode; title: string; subtitle: string }) {
  const styles = useStyles();
  return (
    <>
      <LinearGradient
        colors={['rgba(4,10,26,0.82)', 'rgba(4,10,26,0.45)', 'rgba(4,10,26,0)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.cardBody}>
        {chip}
        {/* Words and arrow share one baseline. */}
        <View style={styles.cardFooter}>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{subtitle}</Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  scrim: {
    flex: 1,
    backgroundColor: glassScrim(c),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'transparent',
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
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  headerText: { flex: 1, gap: 2 },
  title: {
    fontSize: 24,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: fontSize.sm, color: c.textSoft },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    ...glassTile(c),
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { gap: spacing.md, paddingTop: spacing.xs },

  // ── Picture cards ────────────────────────────────────────────────────
  card: {
    height: 136,
    borderRadius: radii.xl,
    overflow: 'hidden',
    // No fill: the gradient or photo covers the card, and a dark fill showed
    // as a navy line along the anti-aliased corners.
    // A barely-there edge: enough to hold the picture, never a stroke.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c === darkPalette ? 'rgba(255,255,255,0.14)' : 'rgba(15,18,23,0.08)',
  },
  cardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  // Explicit size as well as absoluteFill: react-native-web otherwise lays
  // images out at their intrinsic size.
  cover: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  mirror: { transform: [{ scaleX: -1 }] },
  cardBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(242,12,143,0.9)',
  },
  chipLive: { backgroundColor: 'rgba(220,38,38,0.9)' },
  chipText: { color: '#FFFFFF', fontSize: 10, fontWeight: fontWeight.extrabold, letterSpacing: 0.8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: fontWeight.extrabold, letterSpacing: -0.3 },
  cardSub: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, lineHeight: 17 },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // A frosted circle; too small for a real blur to read.
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
}));
