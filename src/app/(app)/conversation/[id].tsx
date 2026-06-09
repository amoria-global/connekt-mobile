import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { colors, fontSize, radii, spacing } from '@/theme';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const myId = useAuth((s) => s.user?.customerId);
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listMessages(id), [id]),
  );

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(id, text);
      setDraft('');
      await refresh();
    } catch {
      // keep the draft so the user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
            renderItem={({ item }) => <Bubble message={item} mine={!!myId && item.senderId === myId} />}
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
    </SafeAreaView>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
    </View>
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
