import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import type { Conversation } from './api';

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const initials = (conversation.name?.[0] ?? '?').toUpperCase();
  const hasUnread = conversation.unreadCount > 0;

  return (
    <View style={styles.row}>
      {conversation.avatar ? (
        <Image source={{ uri: conversation.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {conversation.name}
        </Text>
        {conversation.lastMessage ? (
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {conversation.lastMessage}
          </Text>
        ) : null}
      </View>

      {hasUnread ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  avatar: { width: 48, height: 48, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: colors.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  preview: { fontSize: fontSize.sm, color: colors.textMuted },
  previewUnread: { color: colors.text, fontWeight: fontWeight.semibold },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
});
