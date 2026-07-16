import { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listMessages, sendMessage, type Message } from '@/features/inbox/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useModeration } from '@/features/moderation/useModeration';
import { useAsync } from '@/hooks/useAsync';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, radii, spacing } from '@/theme';

export default function ConversationScreen() {
  // The inbox routes by partner customer id, so `id` is both the thread key
  // and the person a report or block points at.
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const myId = useAuth((s) => s.user?.customerId);
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listMessages(id), [id]),
  );

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const blockAccount = useModeration((s) => s.block);
  const loadModeration = useModeration((s) => s.load);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const partnerLabel = name || 'this user';

  const onBlock = useCallback(() => {
    Alert.alert(
      `Block ${partnerLabel}?`,
      'They will no longer be able to message you, and this conversation disappears from your inbox.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockAccount(id);
              router.back();
            } catch (e) {
              Alert.alert('Could not block', isApiError(e) ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  }, [blockAccount, id, partnerLabel, router]);

  const onHeaderMenu = useCallback(() => {
    Alert.alert(partnerLabel, undefined, [
      { text: 'Report user', style: 'destructive', onPress: () => setReportUserOpen(true) },
      { text: 'Block user', style: 'destructive', onPress: onBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [onBlock, partnerLabel]);

  const onLongPressMessage = useCallback((message: Message) => {
    Alert.alert('Message', message.text, [
      { text: 'Report message', style: 'destructive', onPress: () => setReportMessage(message) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const submitUserReport = useCallback(
    (reason: string, description: string) => reportContent('USER', id, reason, description),
    [id],
  );

  const submitMessageReport = useCallback(
    async (reason: string, description: string) => {
      if (!reportMessage) throw { status: 400, message: 'Nothing to report.' };
      return reportContent('DIRECT_MESSAGE', reportMessage.id, reason, description);
    },
    [reportMessage],
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(id, text);
      setDraft('');
      await refresh();
    } catch (e) {
      // The draft survives so the user can retry, but they need to know why it
      // didn't send — a block (403) and the content filter (400) both land here
      // and are otherwise indistinguishable from a dead Send button.
      Alert.alert(
        'Message not sent',
        isApiError(e) ? e.message : 'Please check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: name || 'Chat',
          headerRight: () => (
            <Pressable
              onPress={onHeaderMenu}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Conversation options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textOnPrimary} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error && !data ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => {
              const mine = !!myId && item.senderId === myId;
              return (
                <Bubble
                  message={item}
                  mine={mine}
                  onLongPress={mine ? undefined : () => onLongPressMessage(item)}
                />
              );
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello 👋</Text>}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendDisabled]}
          >
            <Ionicons name="send" size={18} color={colors.textOnPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ReportSheet
        visible={reportUserOpen}
        onClose={() => setReportUserOpen(false)}
        targetType="USER"
        subject={name || undefined}
        submit={submitUserReport}
      />

      {/* Report one message (long-press a message from the other person). */}
      <ReportSheet
        visible={!!reportMessage}
        onClose={() => setReportMessage(null)}
        targetType="DIRECT_MESSAGE"
        subject={name || undefined}
        submit={submitMessageReport}
      />
    </SafeAreaView>
  );
}

function Bubble({
  message,
  mine,
  onLongPress,
}: {
  message: Message;
  mine: boolean;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      disabled={!onLongPress}
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
    >
      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing['2xl'] },
  bubble: { maxWidth: '78%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.lg },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.borderSoft },
  bubbleText: { fontSize: fontSize.md, color: colors.text },
  bubbleTextMine: { color: colors.textOnPrimary },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.5 },
});
