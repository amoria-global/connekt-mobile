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
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { GlassBackdrop, GlassSurface, glassTile, useGlassEdge } from '@/components/ui/GlassCard';
import { alpha, spacing, radii, fonts, fontSize, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { UpdateGlyph } from './UpdateGlyph';
import { countItems, type Release } from './releaseNotes';
import { updateNow, useAppUpdates, useUpdateChecks } from './useAppUpdates';

const LOGO = require('../../../assets/images/logo.png');

type IconName = keyof typeof Ionicons.glyphMap;
const DEFAULT_ICON: IconName = 'sparkles-outline';
const iconFor = (name?: string): IconName => (name && name in Ionicons.glyphMap ? (name as IconName) : DEFAULT_ICON);

/** "21 Oct 2026" for an ISO date, or the text as given when it is not one. */
export function releaseDate(d?: string): string | undefined {
  if (!d) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  try {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

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
  const releases = isPreviewing ? [] : store.releases;
  const changes = countItems(releases);

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

        {/* Top brand header: the app logo, the spaced wordmark and the "new update" pill */}
        <View style={styles.header}>
          <Image source={LOGO} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="Connekyt" accessibilityIgnoresInvertColors />
          <Text style={styles.brandWordmark} numberOfLines={1} accessibilityRole="header">
            CONNEKYT
          </Text>
          {!failed ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{tr('New update available')}</Text>
            </View>
          ) : null}
        </View>

        {/* Hero: glowing icon, "Good news!" and a two-line promise */}
        <View style={styles.hero}>
          <View style={[styles.iconWrapper, changes > 0 && styles.iconWrapperSmall]}>
            <BrandDownloadIcon
              failed={failed}
              primaryColor={colors.primary}
              accentColor={colors.accent}
            />
          </View>

          <Text style={styles.title}>{tr(failed ? 'Update did not finish' : 'Good news!')}</Text>

          <Text style={styles.body}>
            {failed
              ? `${errorMessage} ${tr('Check your connection and try again.')}`
              : isDownloading
                ? tr('Downloading the latest version of Connekyt. This only takes a moment.')
                : `${tr('You asked. We listened.')}\n${tr('Using Connekyt just got easier.')}`}
          </Text>
        </View>

        {/* What is new: every release newer than the one this phone runs, above the pinned button */}
        {changes > 0 ? (
          <ScrollView
            style={styles.notes}
            contentContainerStyle={styles.notesContent}
            showsVerticalScrollIndicator
            testID="update-whats-new"
          >
            <Text style={styles.notesHeading} accessibilityRole="header">
              {tr("What's new")}
            </Text>
            {releases.map((release: Release, ri) => (
              <View key={release.id} style={styles.release}>
                {releases.length > 1 ? (
                  <View style={styles.releaseHead}>
                    <Text style={styles.releaseTitle}>{release.title}</Text>
                    <View style={styles.releaseMeta}>
                      {ri === 0 ? (
                        <View style={styles.newPill}>
                          <Text style={styles.newPillText}>NEW</Text>
                        </View>
                      ) : null}
                      {releaseDate(release.date) ? <Text style={styles.releaseDate}>{releaseDate(release.date)}</Text> : null}
                    </View>
                  </View>
                ) : null}
                {release.items.map((item, ii) => (
                  <View key={item.title} style={[styles.item, ii > 0 && styles.itemDivider]}>
                    <View style={styles.itemIcon}>
                      <Ionicons name={iconFor(item.icon)} size={22} color={colors.active} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemBody}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.notes} />
        )}

        {/* Bottom CTA Button */}
        <View style={styles.footer}>
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
            <GlassSurface strength="thin" blurTarget={blurTargetRef} style={styles.btnSheen} />
            <LinearGradient
              colors={[colors.primary, colors.active]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: spacing.md,
    paddingTop: spacing.xs,
  },
  brandLogo: {
    width: 52,
    height: 52,
  },
  brandWordmark: {
    fontSize: fontSize.md,
    fontFamily: fonts.bold,
    color: c.text,
    letterSpacing: 8,
    width: '100%',
    textAlign: 'center',
  },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: alpha(c.active, 0.45),
    backgroundColor: alpha(c.active, 0.08),
  },
  pillText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: c.active,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  hero: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  notes: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    marginVertical: spacing.md,
  },
  notesContent: { gap: spacing.md, paddingVertical: spacing.xs },
  notesHeading: { fontSize: 24, fontFamily: fonts.bold, color: c.text, marginBottom: spacing.xs },
  release: { gap: spacing.sm },
  releaseHead: { gap: 4 },
  releaseTitle: { fontSize: 17, fontFamily: fonts.bold, color: c.text },
  releaseMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newPill: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: c.accent, borderRadius: radii.full },
  newPillText: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.6, color: c.textOnPrimary },
  releaseDate: { fontSize: 12, fontFamily: fonts.regular, color: c.textMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: alpha(c.active, 0.4),
    backgroundColor: alpha(c.active, 0.08),
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: 14.5, fontFamily: fonts.bold, color: c.text },
  itemBody: { fontSize: 13.5, lineHeight: 19, fontFamily: fonts.regular, color: c.textMuted },
  iconWrapper: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconWrapperSmall: {
    width: 64,
    height: 64,
    marginBottom: spacing.md,
    transform: [{ scale: 0.72 }],
  },
  title: {
    fontSize: 38,
    fontFamily: fonts.bold,
    color: c.text,
    textAlign: 'center',
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
    marginBottom: spacing.md,
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
  primaryBtnText: {
    color: c.textOnPrimary,
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
  btnSheen: { borderRadius: radii.full },
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
