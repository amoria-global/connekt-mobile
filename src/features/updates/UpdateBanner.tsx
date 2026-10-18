/**
 * A slim floating banner shown when an OTA update has finished downloading. Tapping
 * "Restart" reloads the app into the new version. Non-blocking — the user
 * can keep using the app and the update also applies on the next cold start.
 */
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fonts, makeStyles } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { useAppUpdates } from './useAppUpdates';

export function UpdateBanner() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();
  const {
    updateReady,
    isModalVisible,
    openModal,
    applyUpdate,
  } = useAppUpdates();
  const [reloading, setReloading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // If update is not ready, or modal is already covering the screen, or user dismissed banner: hide
  if (!updateReady || isModalVisible || bannerDismissed) {
    return null;
  }

  const handleRestart = async () => {
    try {
      setReloading(true);
      await applyUpdate();
    } catch {
      setReloading(false);
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom + 8, spacing.md) },
      ]}
    >
      <Pressable
        style={styles.banner}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel={tr('Update Ready')}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{tr('Update Ready')}</Text>
          <Text style={styles.subtitle}>{tr('Tap to review or restart now')}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.btn,
            pressed && styles.btnPressed,
            reloading && styles.btnDisabled,
          ]}
          onPress={handleRestart}
          disabled={reloading}
        >
          {reloading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>{tr('Restart')}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.closeBtn}
          onPress={() => setBannerDismissed(true)}
          hitSlop={8}
          accessibilityLabel={tr('Close')}
        >
          <Ionicons name="close" size={16} color="rgba(255, 255, 255, 0.75)" />
        </Pressable>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...e(4),
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  btn: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },
  closeBtn: {
    padding: 2,
    marginLeft: 2,
  },
}));
