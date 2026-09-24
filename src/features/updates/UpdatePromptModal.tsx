/**
 * In-app Update Prompt Modal.
 *
 * Appears when an OTA update has finished downloading or is downloading,
 * allowing the user to update Connekyt directly with a single tap.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { useAppUpdates } from './useAppUpdates';

export function UpdatePromptModal() {
  const {
    isModalVisible,
    updateReady,
    isDownloading,
    downloadProgress,
    currentVersion,
    applyUpdate,
    closeModal,
  } = useAppUpdates();
  const { colors } = useTheme();
  const styles = useStyles();
  const [reloading, setReloading] = useState(false);

  // Only show if modal is requested and there's something to show (ready or downloading)
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

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeModal}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Top Badge Icon */}
          <View style={styles.iconCircle}>
            <Ionicons
              name={updateReady ? 'sparkles' : 'cloud-download'}
              size={28}
              color={colors.primary}
            />
          </View>

          {/* Pill status */}
          <View style={styles.pillBadge}>
            <Text style={styles.pillBadgeText}>
              {updateReady ? 'UPDATE READY' : 'DOWNLOADING UPDATE'}
            </Text>
          </View>

          {/* Title & Body */}
          <Text style={styles.title}>
            {updateReady ? 'Update Ready to Install' : 'Downloading Update'}
          </Text>

          <Text style={styles.body}>
            {updateReady
              ? `A new version of Connekyt (v${currentVersion}) is ready. Restart now to get the latest features, improvements, and bug fixes.`
              : 'Fetching the latest updates in the background. You can keep using Connekyt while it downloads.'}
          </Text>

          {/* Download progress bar */}
          {isDownloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.max(10, Math.round((downloadProgress || 0) * 100)),
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>
                {downloadProgress > 0
                  ? `Downloading… ${Math.round(downloadProgress * 100)}%`
                  : 'Preparing update…'}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.buttonRow}>
            {updateReady && (
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                  reloading && styles.btnDisabled,
                ]}
                onPress={handleApply}
                disabled={reloading}
              >
                {reloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Restart & Update</Text>
                  </>
                )}
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.pressed,
              ]}
              onPress={closeModal}
            >
              <Text style={styles.secondaryBtnText}>
                {updateReady ? 'Not Now' : 'Dismiss'}
              </Text>
            </Pressable>
          </View>
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
