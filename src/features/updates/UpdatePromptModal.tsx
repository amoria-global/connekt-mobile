/**
 * Mandatory update prompt.
 *
 * Every update the check finds is required. The prompt blocks the app and has
 * one action, "Update now". It cannot be dismissed: no close button, no tap
 * outside, and the hardware back button does nothing. A failed download or
 * restart shows the reason in the same prompt and the same button retries.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { updateNow, useAppUpdates, useUpdateChecks } from './useAppUpdates';

export function UpdatePromptModal() {
  const { blocking, updateReady, isDownloading, isChecking, downloadProgress, errorMessage, currentVersion } =
    useAppUpdates();
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  const [working, setWorking] = useState(false);

  // Launch and foreground-resume checks run here, once, for the whole app.
  useUpdateChecks();

  if (!blocking) return null;

  const failed = !!errorMessage && !isDownloading && !isChecking;
  const busy = working || isDownloading || isChecking;

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
      transparent
      animationType="fade"
      statusBarTranslucent
      // Android back must not close a mandatory update.
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <View style={styles.iconCircle}>
            <Ionicons
              name={failed ? 'alert-circle' : updateReady ? 'sparkles' : 'cloud-download'}
              size={28}
              color={failed ? colors.error : colors.primary}
            />
          </View>

          <Text style={styles.title}>
            {tr(failed ? 'Update did not finish' : 'Update required')}
          </Text>

          <Text style={styles.body}>
            {failed
              ? `${errorMessage} ${tr('Check your connection and try again.')}`
              : isDownloading
                ? tr('Downloading the latest version of Connekyt. This only takes a moment.')
                : `${tr('A new version of Connekyt is ready')}${currentVersion ? ` (current v${currentVersion})` : ''}. ${tr('Update now to keep using the app.')}`}
          </Text>

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
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    ...e(4),
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pillBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    marginBottom: spacing.xs + 2,
  },
  pillBadgeText: {
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
    color: c.primary,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: c.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  progressContainer: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  buttonRow: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  secondaryBtn: {
    width: '100%',
    height: 42,
    borderRadius: radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: c.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
}));
