import { Image, Text, View } from 'react-native';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import type { Conversation } from './api';

function formatInstagramTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 52) return `${diffWeeks}w`;

    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * What a screen reader hears for one conversation. The unread state is in the words, not only in the dot.
 * No last message reads "No messages yet" rather than an invented "Sent a message".
 */
export function conversationLabel(c: Pick<Conversation, 'name' | 'lastMessage' | 'unreadCount' | 'timestamp'>): string {
  const when = formatInstagramTimestamp(c.timestamp);
  return [c.name, c.unreadCount > 0 ? `${c.unreadCount} unread` : null, c.lastMessage || 'No messages yet', when || null].filter(Boolean).join(', ');
}

export function ConversationRow({
  conversation,
  accent = false,
}: {
  conversation: Conversation;
  /** Unread dot, count and time in the brand pink (the client inbox). The default keeps the original blue. */
  accent?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const initials = (conversation.name?.[0] ?? '?').toUpperCase();
  const hasUnread = conversation.unreadCount > 0;
  const timeStr = formatInstagramTimestamp(conversation.timestamp);

  return (
    <View style={[styles.row, hasUnread && styles.rowUnread]} accessible accessibilityLabel={conversationLabel(conversation)}>
      {/* Avatar with Instagram-style Online indicator & unread ring */}
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarRing, hasUnread && styles.avatarRingActive]}>
          {conversation.avatar ? (
            <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Main Conversation Text Body */}
      <View style={styles.body}>
        <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={2}>
          {conversation.name}
        </Text>

        <View style={styles.subtitleRow}>
          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={3}
          >
            {conversation.lastMessage || 'No messages yet'}
          </Text>
          {timeStr ? (
            <>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={[styles.timestamp, hasUnread && styles.timestampUnread, hasUnread && accent && { color: colors.accent }]}>
                {timeStr}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Trailing: the unread dot or count. A read conversation has nothing here. */}
      {hasUnread ? (
        <View style={styles.trailing}>
          {conversation.unreadCount > 1 ? (
            <View style={[styles.unreadBadge, accent && { backgroundColor: colors.accent }]}>
              <Text style={styles.unreadBadgeText}>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</Text>
            </View>
          ) : (
            <View style={[styles.unreadDot, accent && { backgroundColor: colors.accent }]} />
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'transparent',
    gap: 14,
  },
  rowUnread: {
    backgroundColor: 'transparent',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    padding: 1.5,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarRingActive: {
    borderColor: c.primary,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: c.surfaceMuted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
    letterSpacing: -0.2,
  },
  nameUnread: {
    fontWeight: '700',
    color: c.text,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  preview: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.textMuted,
    flexShrink: 1,
  },
  previewUnread: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: c.text,
  },
  dotSeparator: {
    fontSize: 12,
    color: c.textMuted,
  },
  timestamp: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: c.textMuted,
  },
  timestampUnread: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: c.primary,
  },
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#0095F6', // Instagram's iconic direct message unread blue
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fonts.bold,
    fontWeight: '700',
  },
}));
