import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StreamChat } from '@/features/streams/api';
import { formatGiftUsd, parseGiftMeta } from '@/features/streams/gifting/GiftOverlay';
import { fonts, onFill } from '@/theme';
import { V } from '../viewerTheme';
import { getGiftIconName, isGiftChat, isHostSender } from '../utils';

type Props = {
  chat: StreamChat;
  creatorName: string;
  onReply: (c: StreamChat) => void;
};

/** One compact chat line. Tapping a message starts a reply (existing @mention flow). */
export const ChatMessage = memo(function ChatMessage({ chat, creatorName, onReply }: Props) {
  const sender = chat.sender || 'Viewer';

  if (isGiftChat(chat)) {
    const gift = parseGiftMeta(chat.giftMeta);
    return (
      <View style={styles.gift} accessible accessibilityLabel={`${sender} sent a ${gift?.name || 'gift'}`}>
        <Ionicons name={getGiftIconName(gift?.code)} size={16} color={V.accent} />
        <Text style={styles.giftText} numberOfLines={2}>
          <Text style={styles.name}>{sender}</Text> sent {gift?.name || 'a gift'}
          {gift ? ` · ${formatGiftUsd(gift.amountUsd)}` : ''}
        </Text>
      </View>
    );
  }

  const host = isHostSender(chat.sender, creatorName);
  return (
    <Pressable
      onPress={() => onReply(chat)}
      accessibilityRole="button"
      accessibilityLabel={`${sender}${host ? ', host' : ''}: ${chat.message}. Double tap to reply.`}
      style={styles.row}
    >
      <View style={[styles.avatar, host && styles.avatarHost]}>
        <Text style={styles.avatarText}>{sender.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.body}>
        <Text style={[styles.name, host && styles.nameHost]}>{sender}</Text>
        {host ? '  ' : ' '}
        {host ? <Text style={styles.badge}> HOST </Text> : null}
        {host ? '  ' : ''}
        <Text style={styles.msg}>{chat.message}</Text>
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5, paddingHorizontal: 14 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: V.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  avatarHost: { backgroundColor: V.primary },
  avatarText: { fontFamily: fonts.bold, fontSize: 13, color: V.text },
  body: { flex: 1, fontSize: 15, lineHeight: 20 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: V.textMuted },
  nameHost: { color: '#8FB0FF' },
  badge: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: onFill,
    backgroundColor: V.primary,
    letterSpacing: 0.4,
  },
  msg: { fontFamily: fonts.regular, fontSize: 15, color: V.text },
  gift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginVertical: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(242,12,143,0.14)',
  },
  giftText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: V.text },
});
