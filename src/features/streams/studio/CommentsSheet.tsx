import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PublicStreamChat } from '@/features/streams/api';
import { fonts } from '@/theme';
import { BottomSheet } from './BottomSheet';
import {
  chatSender,
  isHostChat,
} from './chatUtils';
import { S } from './theme';

export type ReplyTarget = { id: string; sender: string; text?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  chats: PublicStreamChat[];
  hostCustomerId?: string | number | null;
  draft: string;
  onDraftChange: (v: string) => void;
  replyingTo: ReplyTarget | null;
  onReply: (c: PublicStreamChat) => void;
  onCancelReply: () => void;
  sending: boolean;
  onSend: () => void;
};

/**
 * Larger comment panel. Uses the SAME `chats` list the existing poller feeds
 * (no second realtime/polling connection) and the existing send handler.
 * Tap any message to reply to it.
 */
export function CommentsSheet({
  visible,
  onClose,
  chats,
  hostCustomerId,
  draft,
  onDraftChange,
  replyingTo,
  onReply,
  onCancelReply,
  sending,
  onSend,
}: Props) {
  const listRef = useRef<FlatList<PublicStreamChat>>(null);
  const inputRef = useRef<TextInput>(null);

  // Focus the composer when a reply target is picked.
  useEffect(() => {
    if (visible && replyingTo) {
      const t = setTimeout(() => inputRef.current?.focus(), 280);
      return () => clearTimeout(t);
    }
  }, [visible, replyingTo]);

  const renderItem = useCallback(
    ({ item }: { item: PublicStreamChat }) => {
      const sender = chatSender(item);
      const host = isHostChat(item, hostCustomerId);
      return (
        <Pressable
          onPress={host ? undefined : () => onReply(item)}
          style={styles.msgRow}
          accessibilityRole={host ? 'text' : 'button'}
          accessibilityLabel={`${sender}${host ? ', host' : ''}: ${item.message}${host ? '' : '. Tap to reply.'}`}
        >
          <View style={[styles.avatar, host && styles.avatarHost]}>
            {host ? (
              <Ionicons name="sparkles" size={13} color="#FCD34D" />
            ) : (
              <Text style={styles.avatarText}>{sender.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, host && styles.nameHost]} numberOfLines={1}>
              {sender}
              {host ? ' · HOST' : ''}
            </Text>
            <Text style={styles.msg}>{item.message}</Text>
          </View>
          {!host ? <Ionicons name="arrow-undo-outline" size={16} color={S.textFaint} /> : null}
        </Pressable>
      );
    },
    [hostCustomerId, onReply],
  );

  const canSend = draft.trim().length > 0 && !sending;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Live comments"
      fixedHeightRatio={0.72}
      avoidKeyboard
      scroll={false}
    >
      <FlatList
        ref={listRef}
        data={chats}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        initialNumToRender={12}
        windowSize={7}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color={S.textFaint} />
            <Text style={styles.emptyTitle}>
              No comments yet
            </Text>
            <Text style={styles.emptySub}>
              Viewer comments will stream in here.
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        {replyingTo ? (
          <View style={styles.replyBar}>
            <Ionicons name="arrow-undo" size={13} color={S.go} />
            <Text style={styles.replyText} numberOfLines={1}>
              Replying to @{replyingTo.sender}
              {replyingTo.text ? `: ${replyingTo.text}` : ''}
            </Text>
            <Pressable
              onPress={onCancelReply}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
            >
              <Ionicons name="close-circle" size={18} color={S.textDim} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={draft}
            onChangeText={onDraftChange}
            placeholder={replyingTo ? `Reply to @${replyingTo.sender}…` : 'Message your audience…'}
            placeholderTextColor={S.textFaint}
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={onSend}
            editable={!sending}
            accessibilityLabel="Message your audience"
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendOff]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend, busy: sending }}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 4, flexGrow: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 48 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  avatarHost: { backgroundColor: 'rgba(252,211,77,0.18)' },
  avatarText: { fontFamily: fonts.bold, fontSize: 15, color: S.text },
  name: { fontFamily: fonts.bold, fontSize: 15, color: S.textDim },
  nameHost: { color: '#FCD34D' },
  msg: { fontFamily: fonts.regular, fontSize: 17, color: S.text, lineHeight: 21 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: S.text },
  emptySub: { fontFamily: fonts.regular, fontSize: 15, color: S.textFaint, textAlign: 'center' },
  composer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: S.sheetLine,
  },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: S.textDim },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 23,
    backgroundColor: S.sheetRow,
    color: S.text,
    fontFamily: fonts.regular,
    fontSize: 17,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: S.go,
  },
  sendOff: { opacity: 0.4 },
});
