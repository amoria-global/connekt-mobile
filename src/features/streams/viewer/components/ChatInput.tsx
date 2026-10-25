import { memo, type Ref } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { V } from '../viewerTheme';
import type { ReplyTarget } from '../types';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  reply: ReplyTarget | null;
  onCancelReply: () => void;
  inputRef?: Ref<TextInput>;
  /** Translucent variant for use over video. */
  overlay?: boolean;
  bottomInset?: number;
};

export const ChatInput = memo(function ChatInput(p: Props) {
  const canSend = !p.sending && p.value.trim().length > 0;
  return (
    <View style={[styles.wrap, p.overlay && styles.wrapOverlay, { paddingBottom: 8 + (p.bottomInset ?? 0) }]}>
      {p.reply ? (
        <View style={styles.replyBar}>
          <Ionicons name="arrow-undo" size={13} color={V.primary} />
          <Text style={styles.replyText} numberOfLines={1}>
            Replying to <Text style={styles.replyTarget}>@{p.reply.sender}</Text>
          </Text>
          <Pressable
            onPress={p.onCancelReply}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
          >
            <Ionicons name="close" size={18} color={V.textMuted} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        <TextInput
          ref={p.inputRef}
          value={p.value}
          onChangeText={p.onChange}
          placeholder="Say something..."
          placeholderTextColor={V.textMuted}
          style={styles.input}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={p.onSend}
          editable={!p.sending}
          accessibilityLabel="Chat message"
          maxFontSizeMultiplier={1.3}
        />
        <Pressable
          onPress={p.onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          style={[styles.send, !canSend && styles.sendOff]}
        >
          {p.sending ? (
            <ActivityIndicator size="small" color={onFill} />
          ) : (
            <Ionicons name="send" size={18} color={onFill} />
          )}
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: V.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: V.border,
    gap: 6,
  },
  wrapOverlay: { backgroundColor: 'transparent', borderTopWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: V.hit,
    paddingHorizontal: 16,
    borderRadius: V.hit / 2,
    backgroundColor: V.surfaceRaised,
    color: V.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  send: {
    width: V.hit,
    height: V.hit,
    borderRadius: V.hit / 2,
    backgroundColor: V.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  replyText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: V.textMuted },
  replyTarget: { fontFamily: fonts.bold, color: V.primary },
});
