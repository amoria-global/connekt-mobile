/**
 * Mandatory update prompt, with the release notes in front of the button.
 *
 * Every update the check finds is required. The prompt blocks the app and has one action, "Update now". It cannot be
 * dismissed: no close button, no tap outside, and the hardware back button does nothing. A failed download or restart
 * shows the reason in the same prompt and the same button retries.
 *
 * It is a full screen, not a small card. The update is already downloaded when this opens, so the notes it carries (see
 * releaseNotes.ts) are listed in full above the pinned button: each release since the version this phone runs, each
 * change with a title and a plain description. An update published without notes says so rather than implying detail.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { countItems, type Release } from './releaseNotes';
import { updateNow, useAppUpdates, useUpdateChecks } from './useAppUpdates';

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

export function UpdatePromptModal() {
  const { blocking, updateReady, isDownloading, isChecking, downloadProgress, errorMessage, currentVersion, releases } =
    useAppUpdates();
  const { colors } = useTheme();
  const styles = useStyles();
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
      <View style={[styles.root, { paddingTop: Math.max(insets.top, spacing.lg) }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={failed ? 'alert-circle' : updateReady ? 'sparkles' : 'cloud-download'}
              size={30}
              color={failed ? colors.error : colors.primary}
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
                      <Ionicons name={iconFor(item.icon)} size={20} color={colors.primary} />
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
                <Ionicons name="build-outline" size={20} color={colors.primary} />
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
                <View
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
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Update now"
            accessibilityState={{ disabled: busy, busy }}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>{tr('Update now')}</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.footnote}>The app restarts to apply the update. Your account and data stay as they are.</Text>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.background },
  header: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.tint, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontFamily: fonts.bold, color: c.text, textAlign: 'center' },
  subtitle: { fontSize: 14, fontFamily: fonts.regular, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  scroll: { flex: 1, borderTopWidth: 1, borderTopColor: c.borderSoft },
  scrollContent: { padding: spacing.lg, gap: spacing.xl },
  release: { gap: spacing.md },
  releaseHead: { gap: spacing.xs },
  releaseTitle: { fontSize: 18, fontFamily: fonts.bold, color: c.text },
  releaseMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newPill: { paddingHorizontal: spacing.sm + 2, paddingVertical: 3, backgroundColor: c.accent, borderRadius: radii.full },
  newPillText: { fontSize: 11, fontFamily: fonts.bold, letterSpacing: 0.6, color: '#fff' },
  releaseDate: { fontSize: 13, fontFamily: fonts.regular, color: c.textMuted },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.tint, justifyContent: 'center', alignItems: 'center' },
  itemText: { flex: 1, minWidth: 0, gap: 4 },
  itemTitle: { fontSize: 15, fontFamily: fonts.bold, color: c.text },
  itemBody: { fontSize: 14, fontFamily: fonts.regular, color: c.textMuted, lineHeight: 21 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft, backgroundColor: c.background },
  progressContainer: { width: '100%' },
  progressTrack: { width: '100%', height: 6, borderRadius: radii.full, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: c.primary },
  progressLabel: { fontSize: 12, fontFamily: fonts.regular, color: c.textMuted, textAlign: 'center', marginTop: spacing.xs },
  primaryBtn: {
    width: '100%',
    minHeight: 52,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: fonts.bold },
  footnote: { fontSize: 12, fontFamily: fonts.regular, color: c.textMuted, textAlign: 'center', lineHeight: 17 },
  btnDisabled: { opacity: 0.7 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
}));
