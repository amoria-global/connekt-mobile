import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '../viewerTheme';
import type { ViewerModel } from '../types';
import { formatCount } from '../utils';

type Props = {
  model: ViewerModel;
  live: boolean;
  onShare: () => void;
};

/** Title + compact creator identity + actions. (Follow isn't offered by the existing API.) */
export const StreamHeader = memo(function StreamHeader({ model, live, onShare }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
        {model.title}
      </Text>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{model.creatorInitial}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {model.creatorName}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {live ? 'Live now' : 'Offline'}
            {model.viewerCount != null ? ` · ${formatCount(model.viewerCount)} watching` : ''}
          </Text>
        </View>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel="Share stream"
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="share-social-outline" size={18} color={V.text} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 23, color: V.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: V.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 17, color: '#fff' },
  meta: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: V.text },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: V.textMuted },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: V.hit,
    paddingHorizontal: 16,
    borderRadius: V.hit / 2,
    backgroundColor: V.surfaceRaised,
  },
  actionText: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
});
