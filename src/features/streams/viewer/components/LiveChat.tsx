import { memo, useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StreamChat } from '@/features/streams/api';
import { fonts, onFill } from '@/theme';
import { V } from '../viewerTheme';
import type { ChatConnection, ChatMode, ReplyTarget } from '../types';
import { formatCount } from '../utils';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';

/* ── Mode selector ("Live Chat" / "Gifts"), presentation of the existing filter ── */
export const ChatModeSelector = memo(function ChatModeSelector({
  mode,
  onChange,
  giftCount,
}: {
  mode: ChatMode;
  onChange: (m: ChatMode) => void;
  giftCount: number;
}) {
  const opts: { key: ChatMode; label: string }[] = [
    { key: 'all', label: 'Live Chat' },
    { key: 'gifts', label: giftCount > 0 ? `Gifts ${giftCount}` : 'Gifts' },
  ];
  return (
    <View style={styles.modes} accessibilityRole="tablist">
      {opts.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === o.key }}
          style={[styles.mode, mode === o.key && styles.modeOn]}
        >
          <Text style={[styles.modeText, mode === o.key && styles.modeTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
});

type Props = {
  chats: StreamChat[];
  totalCount: number;
  mode: ChatMode;
  onModeChange: (m: ChatMode) => void;
  giftCount: number;
  connection: ChatConnection;
  onRetryConnection: () => void;
  creatorName: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  reply: ReplyTarget | null;
  onReply: (c: StreamChat) => void;
  onCancelReply: () => void;
  inputRef: React.RefObject<TextInput | null>;
  bottomInset: number;
};

const keyOf = (c: StreamChat) => c.id;

export const LiveChat = memo(function LiveChat(p: Props) {
  const listRef = useRef<FlatList<StreamChat>>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
    stick.current = atBottom;
    setAway((prev) => (prev === !atBottom ? prev : !atBottom));
  }, []);

  const onContentSizeChange = useCallback(() => {
    if (stick.current) listRef.current?.scrollToEnd({ animated: false });
  }, []);

  const jump = useCallback(() => {
    stick.current = true;
    setAway(false);
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: StreamChat }) => (
      <ChatMessage chat={item} creatorName={p.creatorName} onReply={p.onReply} />
    ),
    [p.creatorName, p.onReply],
  );

  const last = p.chats.length > 0 ? p.chats[p.chats.length - 1] : null;

  return (
    <View style={styles.root}>
      <Pressable
        onPress={p.onToggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={p.collapsed ? 'Expand live chat' : 'Collapse live chat'}
        accessibilityState={{ expanded: !p.collapsed }}
        style={styles.header}
      >
        <Ionicons name="chatbubbles-outline" size={18} color={V.text} />
        <Text style={styles.headerTitle}>Live Chat</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{formatCount(p.totalCount)}</Text>
        </View>
        {p.collapsed && last ? (
          <Text style={styles.preview} numberOfLines={1}>
            {last.sender ? `${last.sender}: ` : ''}
            {last.message}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Ionicons name={p.collapsed ? 'chevron-up' : 'chevron-down'} size={20} color={V.textMuted} />
      </Pressable>

      {p.collapsed ? null : (
        <>
          <View style={styles.subHeader}>
            <ChatModeSelector mode={p.mode} onChange={p.onModeChange} giftCount={p.giftCount} />
          </View>

          {p.connection === 'reconnecting' || p.connection === 'unavailable' ? (
            <View style={styles.banner} accessibilityLiveRegion="polite">
              <Ionicons
                name={p.connection === 'unavailable' ? 'cloud-offline-outline' : 'sync-outline'}
                size={15}
                color={V.warning}
              />
              <Text style={styles.bannerText} numberOfLines={1}>
                {p.connection === 'unavailable' ? 'Chat is temporarily unavailable.' : 'Chat reconnecting…'}
              </Text>
              {p.connection === 'unavailable' ? (
                <Pressable
                  onPress={p.onRetryConnection}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Retry chat connection"
                >
                  <Text style={styles.bannerAction}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.listWrap}>
            {p.chats.length === 0 ? (
              p.connection === 'connecting' ? (
                <ChatSkeleton />
              ) : (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>
                    {p.mode === 'gifts' ? 'No gifts yet.' : 'No messages yet.'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {p.mode === 'gifts'
                      ? 'Be the first to support this creator 🎁'
                      : 'Be the first to say something 👋'}
                  </Text>
                </View>
              )
            ) : (
              <FlatList
                ref={listRef}
                data={p.chats}
                keyExtractor={keyOf}
                renderItem={renderItem}
                onScroll={onScroll}
                scrollEventThrottle={100}
                onContentSizeChange={onContentSizeChange}
                initialNumToRender={20}
                maxToRenderPerBatch={12}
                windowSize={7}
                removeClippedSubviews
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            )}
            {away && p.chats.length > 0 ? (
              <Pressable
                onPress={jump}
                style={styles.jump}
                accessibilityRole="button"
                accessibilityLabel="Jump to latest messages"
              >
                <Ionicons name="arrow-down" size={14} color={onFill} />
                <Text style={styles.jumpText}>New messages</Text>
              </Pressable>
            ) : null}
          </View>

          <ChatInput
            value={p.draft}
            onChange={p.onDraftChange}
            onSend={p.onSend}
            sending={p.sending}
            reply={p.reply}
            onCancelReply={p.onCancelReply}
            inputRef={p.inputRef}
            bottomInset={p.bottomInset}
          />
        </>
      )}
    </View>
  );
});

function ChatSkeleton() {
  return (
    <View style={{ paddingTop: 8 }} accessibilityLabel="Loading chat">
      {[0.7, 0.5, 0.82, 0.6].map((w, i) => (
        <View key={i} style={styles.skRow}>
          <View style={styles.skAvatar} />
          <View style={[styles.skLine, { width: `${w * 100}%` }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V.border,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: V.text },
  count: { paddingHorizontal: 8, height: 20, borderRadius: 10, backgroundColor: V.surfaceRaised, justifyContent: 'center' },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: V.textSoft },
  preview: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: V.textMuted, marginLeft: 4 },
  subHeader: { paddingHorizontal: 12, paddingVertical: 8 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: V.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: { backgroundColor: V.text },
  modeText: { fontFamily: fonts.bold, fontSize: 14, color: V.textSoft },
  modeTextOn: { color: V.bg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,177,61,0.12)',
  },
  bannerText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: V.warning },
  bannerAction: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  listWrap: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 24 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: V.text },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: V.textMuted, textAlign: 'center' },
  jump: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: V.primary,
  },
  jumpText: { fontFamily: fonts.bold, fontSize: 13, color: onFill },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  skAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: V.surfaceRaised },
  skLine: { height: 12, borderRadius: 6, backgroundColor: V.surfaceRaised },
});
