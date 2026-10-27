import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { V } from '@/features/streams/viewer/viewerTheme';

/** Section 1: back, the event name, and share. Same props on web (EventHeader in lib/live/sections). */
export const EventHeader = memo(function EventHeader({
  title,
  onBack,
  onShare,
  topInset = 0,
}: {
  title: string;
  onBack: () => void;
  onShare: () => void;
  topInset?: number;
}) {
  return (
    <View style={[s.root, { paddingTop: topInset + 4 }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={s.icon}>
        <Ionicons name="chevron-back" size={22} color={V.text} />
      </Pressable>
      <Text style={s.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Share event" style={s.icon}>
        <Ionicons name="share-social-outline" size={20} color={V.text} />
      </Pressable>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 4, backgroundColor: V.bg },
  icon: { width: V.hit, height: V.hit, borderRadius: V.hit / 2, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: V.text },
});
