import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PublicStreamChat } from '@/features/streams/api';
import { fonts } from '@/theme';
import { chatSender, isHostChat } from './chatUtils';
import { S } from './theme';

const VISIBLE = 5;

type Props = {
  chats: PublicStreamChat[];
  hostCustomerId?: string | number | null;
  bottom: number;
  /** Leave room for the action rail on the right. */
  rightGutter: number;
  maxHeight: number;
  onPressComment: (c: PublicStreamChat) => void;
};

const Row = memo(function Row({
  chat,
  hostCustomerId,
  onPress,
}: {
  chat: PublicStreamChat;
  hostCustomerId?: string | number | null;
  onPress: (c: PublicStreamChat) => void;
}) {
  const sender = chatSender(chat);
  const host = isHostChat(chat, hostCustomerId);
  return (
    <Pressable
      onPress={() => onPress(chat)}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${sender}: ${chat.message}. Tap to reply.`}
    >
      <Text style={styles.text} numberOfLines={3}>
        <Text style={[styles.name, host && styles.nameHost]}>
          {sender}
          {host ? ' · HOST' : ''}
          {'  '}
        </Text>
        {chat.message}
      </Text>
    </Pressable>
  );
});

/**
 * Lightweight floating comment feed: the last few messages over a soft
 * gradient near the bottom of the video. Tap a message to reply from the
 * comments sheet. No ScrollView / no timers, just the tail of the list the
 * existing poller already maintains.
 */
function CommentsOverlayBase({ chats, hostCustomerId, bottom, rightGutter, maxHeight, onPressComment }: Props) {
  const insets = useSafeAreaInsets();
  const tail = useMemo(() => chats.slice(-VISIBLE), [chats]);
  if (tail.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, left: insets.left, right: rightGutter, maxHeight }]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.list, { paddingLeft: 12 }]} pointerEvents="box-none">
        {tail.map((c) => (
          <Row key={c.id} chat={c} hostCustomerId={hostCustomerId} onPress={onPressComment} />
        ))}
      </View>
    </View>
  );
}

export const CommentsOverlay = memo(CommentsOverlayBase);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', justifyContent: 'flex-end', zIndex: 8, paddingTop: 36, maxWidth: 440 },
  list: { gap: 5, alignItems: 'flex-start', paddingBottom: 6, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  name: { fontFamily: fonts.bold, color: 'rgba(255,255,255,0.78)', fontSize: 15 },
  nameHost: { color: '#FCD34D' },
  text: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 16, color: S.text, lineHeight: 20 },
});
