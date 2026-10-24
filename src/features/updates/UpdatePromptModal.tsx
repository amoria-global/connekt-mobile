/**
 * Mandatory full-screen update prompt.
 *
 * Every update the check finds is required. The prompt covers the full screen
 * in Connekyt's brand aesthetic and has one action, "Update now". It cannot be
 * dismissed: no close button, no tap outside, and the hardware back button
 * does nothing. A failed download or restart shows the reason in the same
 * screen and the same button retries.
 */
import React, { useContext, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  GlassBackdrop,
  GlassSurface,
  glassTile,
  useGlassEdge,
} from '@/components/ui/GlassCard';
import { spacing, radii, fonts, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { UpdateGlyph } from './UpdateGlyph';
import { updateNow, useAppUpdates, useUpdateChecks } from './useAppUpdates';

const LOGO = require('../../../assets/images/logo.png');

type DevPreviewState = {
  label: string;
  updateReady: boolean;
  isDownloading: boolean;
  isChecking: boolean;
  downloadProgress: number;
  errorMessage: string | null;
};

const DEV_PREVIEW_STATES: DevPreviewState[] = [
  {
    label: '1/4 Ready',
    updateReady: true,
    isDownloading: false,
    isChecking: false,
    downloadProgress: 1,
    errorMessage: null,
  },
  {
    label: '2/4 Downloading (65%)',
    updateReady: false,
    isDownloading: true,
    isChecking: false,
    downloadProgress: 0.65,
    errorMessage: null,
  },
  {
    label: '3/4 Preparing (0%)',
    updateReady: false,
    isDownloading: true,
    isChecking: false,
    downloadProgress: 0,
    errorMessage: null,
  },
  {
    label: '4/4 Failed',
    updateReady: false,
    isDownloading: false,
    isChecking: false,
    downloadProgress: 0,
    errorMessage: 'Network request failed.',
  },
];

function BrandDownloadIcon({
  failed,
  primaryColor,
  accentColor,
}: {
  failed: boolean;
  primaryColor: string;
  accentColor: string;
}) {
  if (failed) {
    return (
      <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
        <Path
          d="M32 14V36"
          stroke={accentColor}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M32 46.5V47"
          stroke={accentColor}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Path
          d="M12 40V46C12 50.4183 15.5817 54 20 54H44C48.4183 54 52 50.4183 52 46V40"
          stroke={primaryColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // The glowing arrow-into-tray: mint-to-cyan arrow, blue tray, soft glow (see UpdateGlyph).
  return <UpdateGlyph size={88} />;
}

export function UpdatePromptModal() {
  const store = useAppUpdates();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const glassEdge = useGlassEdge();
  const { tr } = useSharedT();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 48, bottom: 28, left: 0, right: 0 };
  const blurTargetRef = useRef<View | null>(null);
  const [working, setWorking] = useState(false);
  const [devPreviewIndex, setDevPreviewIndex] = useState(0);

  // Launch and foreground-resume checks run here, once, for the whole app.
  useUpdateChecks();

  const isPreviewing = Boolean(__DEV__) && Boolean(store.devPreviewOpen) && !store.blocking;
  const activePreview = isPreviewing ? DEV_PREVIEW_STATES[devPreviewIndex] : null;

  const blocking = store.blocking || isPreviewing;
  const isDownloading = activePreview ? activePreview.isDownloading : store.isDownloading;
  const isChecking = activePreview ? activePreview.isChecking : store.isChecking;
  const downloadProgress = activePreview ? activePreview.downloadProgress : store.downloadProgress;
  const errorMessage = activePreview ? activePreview.errorMessage : store.errorMessage;

  if (!blocking) return null;

  const failed = !!errorMessage && !isDownloading && !isChecking;
  const busy = working || isDownloading || isChecking;

  const handleUpdate = async () => {
    if (busy) return;
    if (isPreviewing) {
      setDevPreviewIndex((i) => (i + 1) % DEV_PREVIEW_STATES.length);
      return;
    }
    setWorking(true);
    try {
      await updateNow();
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back must not close a mandatory update.
      onRequestClose={() => {}}
    >
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 36) + spacing.lg,
            paddingBottom: Math.max(insets.bottom, 24) + spacing.lg,
          },
        ]}
        accessibilityViewIsModal
      >
        {/* Full-screen frosted glass backdrop */}
        <GlassBackdrop ref={blurTargetRef} variant="aurora" />
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={[StyleSheet.absoluteFill, styles.frostTint]} pointerEvents="none" />

        {/* Top Brand Header: Logo + Connekyt wordmark (no box/pill wrapper) */}
        <View style={styles.header}>
          <Image
            source={LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.brandWordmark} numberOfLines={1} accessibilityRole="header">
            Connekyt
          </Text>
        </View>

        {/* Center Hero: Clean download icon + title + body (no box wrapper) */}
        <View style={styles.centerContent}>
          <View style={styles.iconWrapper}>
            <BrandDownloadIcon
              failed={failed}
              primaryColor={colors.primary}
              accentColor={colors.accent}
            />
          </View>

          <Text style={styles.title}>
            {tr(failed ? 'Update did not finish' : 'New version available')}
          </Text>

          <Text style={styles.body}>
            {failed
              ? `${errorMessage} ${tr('Check your connection and try again.')}`
              : isDownloading
                ? tr('Downloading the latest version of Connekyt. This only takes a moment.')
                : tr('Update Connekyt to enjoy the latest improvements and features.')}
          </Text>

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(10, Math.round((downloadProgress || 0) * 100)))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {downloadProgress > 0
                  ? `${tr('Downloading…')} ${Math.round(downloadProgress * 100)}%`
                  : tr('Preparing update…')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              glassEdge,
              pressed && styles.pressed,
              busy && styles.btnDisabled,
            ]}
            onPress={handleUpdate}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Update now"
            accessibilityState={{ disabled: busy, busy }}
          >
            <GlassSurface
              strength="thin"
              blurTarget={blurTargetRef}
              style={styles.btnGlassSheen}
            />
            <View style={[StyleSheet.absoluteFill, styles.btnBrandTint]} pointerEvents="none" />
            {busy ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>{tr('Update now')}</Text>
            )}
          </Pressable>
        </View>

        {isPreviewing && activePreview ? (
          <View style={[styles.devBar, { top: Math.max(insets.top, 20) + 4 }]}>
            <Pressable
              onPress={() => setDevPreviewIndex((i) => (i + 1) % DEV_PREVIEW_STATES.length)}
              style={styles.devPill}
            >
              <Text style={styles.devPillText}>State: {activePreview.label} ›</Text>
            </Pressable>
            <Pressable onPress={() => store.setDevPreviewOpen?.(false)} style={styles.devPill}>
              <Text style={styles.devPillText}>Close ✕</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  frostTint: {
    backgroundColor: c.background,
    opacity: 0.72,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 4,
    paddingTop: spacing.xs,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandWordmark: {
    fontSize: fontSize.xl,
    fontFamily: fonts.bold,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.2,
  },
  centerContent: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.xl,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: c.text,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: spacing.sm + 2,
  },
  body: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: spacing.xs,
  },
  progressContainer: {
    width: '100%',
    marginTop: spacing.xl,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: radii.full,
    borderWidth: 1,
    ...glassTile(c),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs + 2,
  },
  footer: {
    width: '100%',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  btnGlassSheen: {
    borderRadius: radii.full,
  },
  btnBrandTint: {
    backgroundColor: c.primary,
    opacity: 0.82,
    borderRadius: radii.full,
  },
  primaryBtnText: {
    color: c.textOnPrimary,
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  devBar: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  devPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.border,
  },
  devPillText: {
    color: c.text,
    fontSize: 12,
    fontFamily: fonts.bold,
  },
}));
