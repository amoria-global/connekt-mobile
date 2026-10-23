/**
 * Mandatory update prompt, with the release notes in front of the button.
 *
 * Every update the check finds is required. The prompt blocks the app and has one action, "Update now". It cannot be
 * dismissed: no close button, no tap outside, and the hardware back button does nothing. A failed download or restart
 * shows the reason in the same prompt and the same button retries.
 *
 * Styling follows the brand's dark gradient update screen: near black, a blue glow top left, a teal glow bottom right, and
 * a blue to mint "Update now" button. The colours are fixed (not themed) so the screen looks the same in light and dark.
 *
 * It is a full screen, not a small card. The update is already downloaded when this opens, so the notes it carries (see
 * releaseNotes.ts) are listed in full above the pinned button: each release since the version this phone runs, each
 * change with a title and a plain description. An update published without notes says so rather than implying detail.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fonts } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { countItems, type Release } from './releaseNotes';
import { updateNow, useAppUpdates, useUpdateChecks } from './useAppUpdates';

type IconName = keyof typeof Ionicons.glyphMap;
const DEFAULT_ICON: IconName = 'sparkles-outline';

// The gradient palette of the update screen.
const BG = '#02050B';
const BLUE = '#0B5BFF';
const CYAN = '#2BD9F0';
const MINT = '#A6F7D2';
const TEXT = '#FFFFFF';
const MUTED = '#A6ADB8';
const LINE = 'rgba(255,255,255,0.10)';
const BUTTON_GRADIENT = [BLUE, '#18E0D0', MINT] as const;

/** Two soft glows on the dark ground: blue from the top left corner, teal from the bottom right. */
function Glows() {
  const { width, height } = useWindowDimensions();
  const r = Math.max(width, height) * 0.62;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glowBlue" cx={0} cy={0} r={r} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0A3CFF" stopOpacity={0.55} />
          <Stop offset="1" stopColor="#0A3CFF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowTeal" cx={width} cy={height * 0.8} r={r * 0.75} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#12D9B0" stopOpacity={0.4} />
          <Stop offset="1" stopColor="#12D9B0" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowBlue)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowTeal)" />
    </Svg>
  );
}
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

export function UpdatePromptModal() {
  const { blocking, updateReady, isDownloading, isChecking, downloadProgress, errorMessage, currentVersion, releases } =
    useAppUpdates();
  const { tr } = useSharedT();
  const insets = useSafeAreaInsets();
  const [working, setWorking] = useState(false);

  // Launch and foreground-resume checks run here, once, for the whole app.
  useUpdateChecks();

  if (!blocking) return null;

  const failed = !!errorMessage && !isDownloading && !isChecking;
  const busy = working || isDownloading || isChecking;
  const changes = countItems(releases);

  const handleUpdate = async () => {
    if (busy) return;
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
      animationType="slide"
      statusBarTranslucent
      // Android back must not close a mandatory update.
      onRequestClose={() => {}}
    >
      <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.lg) }]}>
        <Glows />
        <Text style={styles.brand} accessibilityRole="header">
          CONNE<Text style={styles.brandAccent}>KYT</Text>
        </Text>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={failed ? 'alert-circle' : updateReady ? 'sparkles' : 'cloud-download'}
              size={30}
              color={failed ? '#FF6B6B' : CYAN}
            />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {tr(failed ? 'Update did not finish' : 'Update required')}
          </Text>
          <Text style={styles.subtitle}>
            {failed
              ? `${errorMessage} ${tr('Check your connection and try again.')}`
              : changes > 0
                ? `${changes === 1 ? '1 change' : `${changes} changes`} to read before you update${currentVersion ? ` (you have v${currentVersion})` : ''}.`
                : `${tr('A new version of Connekyt is ready')}${currentVersion ? ` (current v${currentVersion})` : ''}.`}
          </Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
          {releases.length > 0 ? (
            releases.map((release: Release, ri) => (
              <View key={release.id} style={styles.release}>
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
                {release.items.map((item) => (
                  <View key={item.title} style={styles.item}>
                    <View style={styles.itemIcon}>
                      <Ionicons name={iconFor(item.icon)} size={20} color={CYAN} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemBody}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.item}>
              <View style={styles.itemIcon}>
                <Ionicons name="build-outline" size={20} color={CYAN} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>Improvements and fixes</Text>
                <Text style={styles.itemBody}>
                  This update has no written notes. It is a required update to keep Connekyt working with the latest services.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          {isDownloading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={BUTTON_GRADIENT}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, Math.max(10, Math.round((downloadProgress || 0) * 100)))}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {downloadProgress > 0 ? `${tr('Downloading…')} ${Math.round(downloadProgress * 100)}%` : tr('Preparing update…')}
              </Text>
            </View>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.primaryWrap, pressed && styles.pressed, busy && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Update now"
            accessibilityState={{ disabled: busy, busy }}
          >
            <LinearGradient colors={BUTTON_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.primaryBtn}>
              {busy ? (
                <ActivityIndicator size="small" color={BG} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={BG} />
                  <Text style={styles.primaryBtnText}>{tr('Update now')}</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
          <Text style={styles.footnote}>The app restarts to apply the update. Your account and data stay as they are.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  brand: { fontSize: 18, fontFamily: fonts.bold, color: TEXT, letterSpacing: 6, textAlign: 'center', marginTop: spacing.sm },
  brandAccent: { color: CYAN },
  header: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(43,217,240,0.12)', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontFamily: fonts.bold, color: TEXT, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: MUTED, textAlign: 'center', lineHeight: 20 },
  scroll: { flex: 1, borderTopWidth: 1, borderTopColor: LINE },
  scrollContent: { padding: spacing.lg, gap: spacing.xl },
  release: { gap: spacing.md },
  releaseHead: { gap: spacing.xs },
  releaseTitle: { fontSize: 18, fontFamily: fonts.bold, color: TEXT },
  releaseMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newPill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, backgroundColor: CYAN, borderRadius: radii.full },
  newPillText: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.6, color: BG },
  releaseDate: { fontSize: 13, fontFamily: fonts.regular, color: MUTED },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: LINE,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(43,217,240,0.12)', justifyContent: 'center', alignItems: 'center' },
  itemText: { flex: 1, minWidth: 0, gap: 4 },
  itemTitle: { fontSize: 15, fontFamily: fonts.bold, color: TEXT },
  itemBody: { fontSize: 14, fontFamily: fonts.regular, color: MUTED, lineHeight: 21 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: LINE },
  progressContainer: { width: '100%' },
  progressTrack: { width: '100%', height: 6, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full },
  progressLabel: { fontSize: 12, fontFamily: fonts.regular, color: MUTED, textAlign: 'center', marginTop: spacing.xs },
  primaryWrap: { width: '100%', borderRadius: radii.full, shadowColor: BLUE, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  primaryBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.full,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
  },
  primaryBtnText: { color: BG, fontSize: 16, fontFamily: fonts.bold },
  footnote: { fontSize: 12, fontFamily: fonts.regular, color: MUTED, textAlign: 'center', lineHeight: 17 },
  btnDisabled: { opacity: 0.7 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
