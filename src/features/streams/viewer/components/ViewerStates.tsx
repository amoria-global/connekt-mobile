import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme';
import { V, VIDEO_ASPECT } from '../viewerTheme';

/** Static skeleton: video, title, creator, chat. No animation loop (cheap on low-end devices). */
export const ViewerSkeleton = memo(function ViewerSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root} accessibilityLabel="Loading live stream" accessibilityLiveRegion="polite">
      <View style={{ paddingTop: insets.top, backgroundColor: '#000' }}>
        <View style={styles.video}>
          <Text style={styles.connecting}>Connecting to live stream…</Text>
        </View>
      </View>
      <View style={styles.pad}>
        <View style={[styles.bar, { width: '78%', height: 18 }]} />
        <View style={styles.row}>
          <View style={styles.avatar} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={[styles.bar, { width: '40%' }]} />
            <View style={[styles.bar, { width: '28%', height: 10 }]} />
          </View>
        </View>
        {[0.8, 0.55, 0.7, 0.45].map((w, i) => (
          <View key={i} style={styles.row}>
            <View style={[styles.avatar, { width: 28, height: 28, borderRadius: 14 }]} />
            <View style={[styles.bar, { width: `${w * 85}%` }]} />
          </View>
        ))}
      </View>
    </View>
  );
});

export function ViewerError({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
      <Ionicons name="cloud-offline-outline" size={44} color={V.textMuted} />
      <Text style={styles.title}>{message}</Text>
      <Pressable style={styles.primary} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.primaryText}>Try Again</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.ghostText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  video: { aspectRatio: VIDEO_ASPECT, backgroundColor: '#14171E', alignItems: 'center', justifyContent: 'center' },
  connecting: { fontFamily: fonts.regular, fontSize: 14, color: V.textMuted },
  pad: { padding: 14, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: V.surfaceRaised },
  bar: { height: 12, borderRadius: 6, backgroundColor: V.surfaceRaised },
  title: { fontFamily: fonts.bold, fontSize: 17, color: V.text, textAlign: 'center', maxWidth: 300 },
  primary: {
    minHeight: V.hit,
    minWidth: 160,
    borderRadius: 22,
    backgroundColor: V.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
  ghost: { minHeight: V.hit, justifyContent: 'center', paddingHorizontal: 16 },
  ghostText: { fontFamily: fonts.bold, fontSize: 15, color: V.textSoft },
});
