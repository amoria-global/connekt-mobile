import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { StreamChat } from '@/features/streams/api';
import { fonts } from '@/theme';
import { V } from '../viewerTheme';
import { isGiftChat } from '../utils';

/** Translucent latest-messages feed shown over the video in fullscreen. */
export const ChatOverlayFeed = memo(function ChatOverlayFeed({
  chats,
  left,
  bottom,
}: {
  chats: StreamChat[];
  left: number;
  bottom: number;
}) {
  const recent = chats.slice(-5);
  if (recent.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { left, bottom }]} importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} />
      {recent.map((c) => (
        <Text key={c.id} style={styles.line} numberOfLines={2}>
          <Text style={styles.name}>{c.sender || 'Viewer'} </Text>
          {isGiftChat(c) ? '🎁 sent a gift' : c.message}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: '46%', padding: 8, borderRadius: 12, gap: 3 },
  line: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: '#fff' },
  name: { fontFamily: fonts.bold, color: V.textSoft },
});
