import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRole } from '@/features/auth/role';
import {
  listMessages,
  markConversationRead,
  sendMessage,
  type Message,
} from '@/features/inbox/api';
import { AlbumCard } from '@/features/inbox/AlbumCard';
import { AlbumPickerSheet, AttachSheet } from '@/features/inbox/AlbumPicker';
import { buildTimeline, type TimelineItem } from '@/features/inbox/albumShare';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useModeration } from '@/features/moderation/useModeration';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

// One horizontal gutter and one vertical rhythm for the whole thread.
const SIDE = 14;
const GAP = 6;

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

/** The bottom gap under the composer: the home-indicator inset plus 10pt, or just 10pt while the keyboard covers it. */
export function composerBottomPadding(insetBottom: number, keyboardOpen: boolean): number {
  return (keyboardOpen ? 0 : Math.max(insetBottom, 0)) + 10;
}

export default function ConversationScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t, language } = useLanguage();
  // `id` is the partner's customerId (UUID) used for chat history and sending
  const { id, name, avatar } = useLocalSearchParams<{ id: string; name?: string; avatar?: string }>();
  const router = useRouter();
  const myId = useAuth((s) => s.user?.customerId);
  const { isPhotographer, isCollaboratorWorkspace, isCollaboratorLogin } = useRole();
  // Albums belong to the photographer. A workspace session acts for the owner, so it never offers the "+".
  const canShareAlbums = isPhotographer && !isCollaboratorWorkspace && !isCollaboratorLogin;

  const insets = useSafeAreaInsets();
  // The offset the keyboard view needs is how far its top sits below the screen top (the native header), measured, never guessed.
  const kavRef = useRef<View>(null);
  const [kavOffset, setKavOffset] = useState(0);
  const measureOffset = useCallback(() => {
    kavRef.current?.measureInWindow((_x, y) => setKavOffset(Math.max(0, Math.round(y))));
  }, []);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const flatListRef = useRef<FlatList<TimelineItem<Message>>>(null);

  const blockAccount = useModeration((s) => s.block);
  const loadModeration = useModeration((s) => s.load);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);

  const partnerLabel = name || t('b3_conv_creator');

  // Keyboard open/closed drives the bottom gap, and keeps the newest message in view above it.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardOpen(true);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  const timeline = useMemo(
    () =>
      buildTimeline(messages, new Date(), { today: t('chat_today'), yesterday: t('chat_yesterday') }, language),
    [messages, t, language],
  );

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
      type: 'text',
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

  const isMine = (item: Message) => {
    const cleanMyId = myId ? String(myId).toLowerCase().trim() : '';
    const cleanSenderId = item.senderId ? String(item.senderId).toLowerCase().trim() : '';
    return item.isMine === true || (!!cleanMyId && !!cleanSenderId && cleanSenderId === cleanMyId);
  };

  const viewProfile = () => {
    const path = isPhotographer ? `/client/${id}` : `/photographer/${id}`;
    router.push(path as Href);
  };

  const intro = (
    <View style={styles.intro}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.introAvatar} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.introAvatar, styles.introInitial]}>
          <Text style={styles.introLetter}>{partnerLabel.trim().charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.introName} numberOfLines={1}>
        {partnerLabel}
      </Text>
      <Text style={styles.introRole}>{isPhotographer ? t('chat_role_client') : t('chat_role_photographer')}</Text>
      <Text style={styles.introStart}>{t('chat_intro_start', { name: partnerLabel })}</Text>
      <Pressable
        onPress={viewProfile}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={`${t('chat_intro_view_profile')}: ${partnerLabel}`}
        style={styles.introLink}
      >
        <Text style={styles.introLinkText}>{t('chat_intro_view_profile')}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.link} />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.safe}>
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
      <View ref={kavRef} onLayout={measureOffset} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={kavOffset}>
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
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryText}>{t('b3_conv_retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={timeline}
            keyExtractor={(i) => i.key}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            renderItem={({ item }) =>
              item.kind === 'date' ? (
                <View style={styles.dateWrap}>
                  <Text style={styles.dateText}>{item.label}</Text>
                </View>
              ) : (
                <Bubble
                  message={item.message}
                  mine={isMine(item.message)}
                  onLongPress={
                    isMine(item.message) || item.message.type !== 'text'
                      ? undefined
                      : () => onLongPressMessage(item.message)
                  }
                />
              )
            }
            // The intro sits directly above the first message, and a short thread hugs the composer.
            ListHeaderComponent={intro}
            contentContainerStyle={styles.list}
          />
        )}

        <View style={[styles.composer, { paddingBottom: composerBottomPadding(insets.bottom, keyboardOpen) }]}>
          {canShareAlbums ? (
            <Pressable
              onPress={() => setAttachOpen(true)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t('chat_plus_a11y')}
              style={styles.plusBtn}
            >
              <Ionicons name="add" size={24} color={colors.link} />
            </Pressable>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={t('b3_conv_placeholder')}
            accessibilityLabel="Message"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel={sending ? 'Sending message' : 'Send message'}
            accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
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
      </View>

      {canShareAlbums ? (
        <>
          <AttachSheet
            visible={attachOpen}
            name={partnerLabel}
            onClose={() => setAttachOpen(false)}
            onShareAlbum={() => {
              setAttachOpen(false);
              setPickerOpen(true);
            }}
          />
          <AlbumPickerSheet
            visible={pickerOpen}
            partnerId={id}
            name={partnerLabel}
            onClose={() => setPickerOpen(false)}
            onSent={() => void fetchMessages(false)}
          />
        </>
      ) : null}

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
    </View>
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
  const { t } = useLanguage();
  const timeStr = formatMessageTime(message.timestamp);
  const side = [styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs];

  if (message.type === 'removed') {
    return (
      <View style={side} accessible accessibilityLabel={t('chat_removed')}>
        <View style={[styles.bubble, styles.bubbleRemoved]}>
          <Text style={styles.removedText}>{t('chat_removed')}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'album_share' && message.albumShare) {
    const { albumIds, note } = message.albumShare;
    return (
      <View style={[...side, styles.albumWrap]}>
        {albumIds.map((albumId) => (
          <AlbumCard key={albumId} albumId={albumId} mine={mine} />
        ))}
        {note ? (
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{note}</Text>
          </View>
        ) : null}
        {timeStr ? <Text style={[styles.timeText, styles.albumTime]}>{timeStr}</Text> : null}
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      disabled={!onLongPress}
      accessible
      accessibilityLabel={`${mine ? 'You' : 'They'}: ${message.text}${timeStr ? `, ${timeStr}` : ''}`}
      accessibilityHint={onLongPress ? 'Long press to report this message' : undefined}
      style={side}
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
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: c.primary,
    borderRadius: radii.full,
  },
  retryText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontWeight: '600' },
  // flexGrow + flex-end: a short thread sits on the composer, a long one scrolls from the end.
  list: { paddingHorizontal: SIDE, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: GAP, flexGrow: 1, justifyContent: 'flex-end' },
  intro: { alignItems: 'center', gap: 4, paddingTop: spacing.lg, paddingBottom: spacing.lg },
  introAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceMuted },
  introInitial: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  introLetter: { color: c.link, fontSize: 26, fontFamily: fonts.display },
  introName: { color: c.text, fontSize: fontSize.lg, fontFamily: fonts.display, marginTop: 6 },
  introRole: { color: c.textMuted, fontSize: 12, fontFamily: fonts.medium },
  introStart: { color: c.textMuted, fontSize: 12, fontFamily: fonts.regular, marginTop: 6, textAlign: 'center' },
  introLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 36 },
  introLinkText: { color: c.link, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  dateWrap: { alignItems: 'center', paddingVertical: 6 },
  dateText: { color: c.textMuted, fontSize: 12, fontFamily: fonts.medium },
  bubbleWrap: { maxWidth: '82%' },
  bubbleWrapMine: { alignSelf: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start' },
  albumWrap: { gap: GAP, maxWidth: '100%' },
  albumTime: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radii.lg },
  bubbleMine: { backgroundColor: c.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: c.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: c.borderSoft },
  bubbleRemoved: { borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: 'transparent' },
  removedText: { fontSize: 14, fontStyle: 'italic', color: c.textMuted },
  bubbleText: { fontSize: 15, lineHeight: 21, color: c.text },
  bubbleTextMine: { color: c.textOnPrimary },
  timeText: { fontSize: 12, color: c.textMuted, alignSelf: 'flex-end', marginTop: 3 },
  timeTextMine: { color: 'rgba(255, 255, 255, 0.75)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: SIDE - 2,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.tint,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 11 : 9,
    paddingBottom: Platform.OS === 'ios' ? 11 : 9,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.background,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
}));
