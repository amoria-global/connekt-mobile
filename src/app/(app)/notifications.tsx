import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRole } from '@/features/auth/role';
import { listNotifications, markAllRead, markRead } from '@/features/notifications/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate } from '@/utils/format';

export default function NotificationsScreen() {
  const { role } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listNotifications(role), [role]),
  );
  const [working, setWorking] = useState(false);

  const onTap = async (id: string, alreadyRead: boolean) => {
    if (alreadyRead) return;
    try {
      await markRead(role, id);
      await refresh();
    } catch {
      // ignore
    }
  };

  const onMarkAll = async () => {
    setWorking(true);
    try {
      await markAllRead(role);
      await refresh();
    } catch {
      // ignore
    } finally {
      setWorking(false);
    }
  };

  const hasUnread = !!data?.some((n) => !n.read);

  return (
    <Screen padded={false}>
      <View style={styles.headerRow}>
        <ScreenHeader title="Notifications" />
        {hasUnread ? (
          <Pressable onPress={onMarkAll} disabled={working} style={styles.markAll}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onTap(item.id, item.read)}
            style={[styles.card, !item.read && styles.unread]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read ? <View style={styles.dot} /> : null}
            </View>
            {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
            {item.createdAt ? <Text style={styles.time}>{formatDate(item.createdAt)}</Text> : null}
          </Pressable>
        )}
        emptyIcon="notifications-outline"
        emptyTitle="You're all caught up"
        emptyMessage="Notifications about bookings, payments, and messages will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  markAll: { paddingHorizontal: spacing.xl },
  markAllText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  unread: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  dot: { width: 9, height: 9, borderRadius: radii.full, backgroundColor: colors.accent },
  body: { fontSize: fontSize.sm, color: colors.textSoft },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
});
