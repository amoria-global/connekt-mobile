import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  listMessages,
  markConversationRead,
  sendMessage,
  type Message,
} from '@/features/inbox/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useModeration } from '@/features/moderation/useModeration';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { colors, spacing, radii, fontSize, makeStyles, useTheme } from '@/theme';

function formatMessageTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ConversationScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
  // `id` is the partner's customerId (UUID) used for chat history and sending
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const myId = useAuth((s) => s.user?.customerId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);

  const blockAccount = useModeration((s) => s.block);
  const loadModeration = useModeration((s) => s.load);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);

  const partnerLabel = name || t('b3_conv_creator');

  // Fetch messages from backend
  const fetchMessages = useCallback(
    async (isInitial = false) => {
      if (!id) return;
      if (isInitial) setLoading(true);
      try {
        const msgs = await listMessages(id);
        setMessages(msgs);
        setError(null);
      } catch (e) {
        if (isInitial) {
          setError(isApiError(e) ? e.message : t('b3_conv_load_failed'));
        }
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [id, t],
  );

  // Initial load + mark read
  useEffect(() => {
    loadModeration();
    if (id) {
      void fetchMessages(true);
      void markConversationRead(id);
    }
  }, [id, fetchMessages, loadModeration]);

  // Live polling: poll every 4 seconds (web parity) to sync real-time exchanges
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      void fetchMessages(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [id, fetchMessages]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const onBlock = useCallback(() => {
    Alert.alert(
      t('b3_conv_block_title', { name: partnerLabel }),
      t('b3_conv_block_msg'),
      [
        { text: t('b3_conv_cancel'), style: 'cancel' },
        {
          text: t('b3_conv_block'),
          style: 'destructive',
          onPress: async () => {
            try {
              await blockAccount(id);
              router.back();
            } catch (e) {
              Alert.alert(t('b3_conv_could_not_block'), isApiError(e) ? e.message : t('b3_conv_try_again'));
            }
          },
        },
      ],
    );
  }, [blockAccount, id, partnerLabel, router, t]);

  const onHeaderMenu = useCallback(() => {
    Alert.alert(partnerLabel, undefined, [
      { text: t('b3_conv_report_user'), style: 'destructive', onPress: () => setReportUserOpen(true) },
      { text: t('b3_conv_block_user'), style: 'destructive', onPress: onBlock },
      { text: t('b3_conv_cancel'), style: 'cancel' },
    ]);
  }, [onBlock, partnerLabel, t]);

  const onLongPressMessage = useCallback((message: Message) => {
    Alert.alert(t('b3_conv_message'), message.text, [
      { text: t('b3_conv_report_message'), style: 'destructive', onPress: () => setReportMessage(message) },
      { text: t('b3_conv_cancel'), style: 'cancel' },
    ]);
  }, [t]);

  const submitUserReport = useCallback(
    (reason: string, description: string) => reportContent('USER', id, reason, description),
    [id],
  );

  const submitMessageReport = useCallback(
    async (reason: string, description: string) => {
      if (!reportMessage) throw { status: 400, message: t('b3_conv_nothing_to_report') };
      return reportContent('DIRECT_MESSAGE', reportMessage.id, reason, description);
    },
    [reportMessage, t],
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending || !id) return;
    setSending(true);
    setDraft('');

    // Optimistic local update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      text,
      senderId: myId,
      isMine: true,
      isRead: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      await sendMessage(id, text);
      await fetchMessages(false);
    } catch (e) {
      // Revert optimistic message and restore draft on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      Alert.alert(
        t('b3_conv_not_sent_title'),
        isApiError(e) ? e.message : t('b3_conv_not_sent_msg'),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Stack.Screen
        options={{
          title: partnerLabel,
          headerRight: () => (
            <Pressable
              onPress={onHeaderMenu}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('b3_conv_options_a11y')}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textOnPrimary} />
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.textMuted} />
            <Text style={styles.muted}>{error}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => void fetchMessages(true)}
            >
              <Text style={styles.retryText}>{t('b3_conv_retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={({ item }) => {
              const cleanMyId = myId ? String(myId).toLowerCase().trim() : '';
              const cleanSenderId = item.senderId ? String(item.senderId).toLowerCase().trim() : '';
              const mine =
                item.isMine === true ||
                (!!cleanMyId && !!cleanSenderId && cleanSenderId === cleanMyId);

              return (
                <Bubble
                  message={item}
                  mine={mine}
                  onLongPress={mine ? undefined : () => onLongPressMessage(item)}
                />
              );
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textMuted} />
                <Text style={styles.empty}>{t('b3_conv_empty', { name: partnerLabel })}</Text>
              </View>
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={t('b3_conv_placeholder')}
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendDisabled]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Ionicons name="send" size={17} color={colors.textOnPrimary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ReportSheet
        visible={reportUserOpen}
        onClose={() => setReportUserOpen(false)}
        targetType="USER"
        subject={partnerLabel}
        submit={submitUserReport}
      />

      {/* Report one message (long-press a message from the other person). */}
      <ReportSheet
        visible={!!reportMessage}
        onClose={() => setReportMessage(null)}
        targetType="DIRECT_MESSAGE"
        subject={partnerLabel}
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
  const styles = useStyles();
  const timeStr = formatMessageTime(message.timestamp);

  return (
    <Pressable
      onLongPress={onLongPress}
      disabled={!onLongPress}
      style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}
    >
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
        {timeStr ? (
          <Text style={[styles.timeText, mine && styles.timeTextMine]}>{timeStr}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: c.primary,
    borderRadius: radii.full,
  },
  retryText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '600' },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['3xl'], gap: spacing.sm },
  empty: { textAlign: 'center', color: c.textMuted, fontSize: fontSize.sm },
  bubbleWrap: { maxWidth: '80%', marginVertical: 2 },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radii.lg },
  bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: c.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.borderSoft },
  bubbleText: { fontSize: 15, lineHeight: 21, color: c.text },
  bubbleTextMine: { color: c.textOnPrimary },
  timeText: { fontSize: 10, color: c.textMuted, alignSelf: 'flex-end', marginTop: 3 },
  timeTextMine: { color: 'rgba(255, 255, 255, 0.75)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.background,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
}));
