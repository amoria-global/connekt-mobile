/**
 * A slim banner shown when an OTA update has finished downloading. Tapping
 * "Restart" reloads the app into the new version. Non-blocking — the user
 * can keep using the app and the update also applies on the next cold start.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, spacing } from '@/theme';
import { useAppUpdates } from './useAppUpdates';

export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { updateReady, applyUpdate } = useAppUpdates();

  if (!updateReady) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.banner}>
        <Ionicons name="cloud-download-outline" size={18} color="#fff" />
        <Text style={styles.text}>A new version is ready.</Text>
        <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} onPress={applyUpdate}>
          <Text style={styles.btnText}>Restart</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, zIndex: 999 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  btn: { backgroundColor: '#fff', paddingHorizontal: 14, height: 34, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
