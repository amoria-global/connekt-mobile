/**
 * In-app Update screen.
 *
 * A full-page, glassmorphic takeover shown when an OTA update is downloading
 * or ready, letting the user update Connekyt with a single tap.
 *
 *   ┌──────────────────────┐
 *   │   [logo Connekyt]    │  glass brand pill
 *   │                      │
 *   │      ( logo )        │  glass orb with the transparent mark
 *   │ New version available│
 *   │  Update Connekyt to… │
 *   │                      │
 *   │    [ Update Now ]    │  pinned to the bottom
 *   └──────────────────────┘
 *
 * The aurora lives INSIDE the modal (via GlassScene), so the glass gets a real
 * blur on Android too: a Modal is its own window and cannot blur the screen
 * behind it.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard, GlassScene } from '@/components/ui/GlassCard';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { useAppUpdates } from './useAppUpdates';

/** The brand mark on a transparent background (no tile behind it). */
const LOGO = require('../../../assets/images/logo.png');

export function UpdatePromptModal() {
  const { isModalVisible, updateReady, isDownloading, downloadProgress, applyUpdate, closeModal } =
    useAppUpdates();
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();
  const [reloading, setReloading] = useState(false);

  // Only show if requested and there's something to show (ready or downloading).
  if (!isModalVisible || (!updateReady && !isDownloading)) {
    return null;
  }

  const handleApply = async () => {
    try {
      setReloading(true);
      await applyUpdate();
    } catch {
      setReloading(false);
    }
  };

  const busy = reloading || !updateReady;
  const progressPct = Math.round((downloadProgress || 0) * 100);

  return (
    <Modal
      visible={isModalVisible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closeModal}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <GlassScene bleedTop={false}>
          <View
            style={[
              styles.page,
              { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            {/* Top: the usual Connekyt brand pill, frosted. */}
            <View style={styles.top}>
              <GlassCard strength="thin" style={styles.brandPill}>
                <Image source={LOGO} style={styles.brandMark} contentFit="contain" />
                <Text style={styles.brandText}>Connekyt</Text>
              </GlassCard>
            </View>

            {/* Middle: the mark and the message, centred. */}
            <View style={styles.center}>
              <GlassCard strength="regular" elevated style={styles.orb}>
                <Image
                  source={LOGO}
                  style={styles.orbMark}
                  contentFit="contain"
                  accessibilityIgnoresInvertColors
                />
              </GlassCard>

              <Text style={styles.title} accessibilityRole="header">
                {tr('New version available')}
              </Text>
              <Text style={styles.subtitle}>
                {tr('Update Connekyt to enjoy the latest improvements and features.')}
              </Text>

              {isDownloading && !updateReady ? (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(8, progressPct)}%` }]} />
                  </View>
                </View>
              ) : null}
            </View>

            {/* Bottom: the one action. */}
            <View style={styles.bottom}>
              <Pressable
                onPress={handleApply}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy }}
                style={({ pressed }) => [
                  styles.cta,
                  busy && styles.ctaBusy,
                  pressed && !busy && styles.pressed,
                ]}
              >
                {reloading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.ctaText}>
                    {updateReady
                      ? tr('Update Now')
                      : progressPct > 0
                        ? `${tr('Downloading…')} ${progressPct}%`
                        : tr('Downloading…')}
                  </Text>
                )}
              </Pressable>

              <Pressable onPress={closeModal} hitSlop={8} style={styles.later} accessibilityRole="button">
                <Text style={styles.laterText}>{tr('Not now')}</Text>
              </Pressable>
            </View>
          </View>
        </GlassScene>
      </View>
    </Modal>
  );
}

const ORB = 148;

const useStyles = makeStyles((c) => ({
  root: { flex: 1 },
  page: { flex: 1, paddingHorizontal: spacing.xl },

  top: { alignItems: 'center' },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
  },
  brandMark: { width: 24, height: 24 },
  brandText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.2,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  orbMark: { width: ORB * 0.66, height: ORB * 0.66 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: c.textSoft,
    textAlign: 'center',
    maxWidth: 320,
  },
  progressWrap: { width: '70%', marginTop: spacing.sm },
  progressTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(127,127,127,0.2)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: c.primary },

  bottom: { gap: spacing.sm },
  cta: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBusy: { opacity: 0.7 },
  ctaText: {
    color: c.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  later: { alignSelf: 'center', paddingVertical: spacing.xs },
  laterText: { color: c.textSoft, fontFamily: fonts.regular, fontSize: fontSize.sm },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
}));
