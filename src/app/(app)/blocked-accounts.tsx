/**
 * Blocked accounts — review and undo blocks made from chat, messages or
 * profiles. Blocking is account-wide: a blocked user's messages are hidden
 * and neither party can message the other until the block is lifted.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { useModeration } from '@/features/moderation/useModeration';
import type { BlockedUser } from '@/features/moderation/api';
import { isApiError } from '@/store/auth';
import { colors, fonts, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function BlockedAccountsScreen() {
  const blocked = useModeration((s) => s.blocked);
  const loading = useModeration((s) => s.loading);
  const refresh = useModeration((s) => s.refresh);
  const unblock = useModeration((s) => s.unblock);

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await refresh();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load your blocked accounts.');
    }
  }, [refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const onUnblock = (user: BlockedUser) => {
    Alert.alert(
      `Unblock ${user.name}?`,
      'You will see their messages again, and they will be able to message you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await unblock(user.id);
            } catch (e) {
              Alert.alert(
                'Could not unblock',
                isApiError(e) ? e.message : 'Please try again.',
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <DataList
        data={blocked}
        loading={loading}
        error={error}
        onRefresh={load}
        title="Blocked accounts"
        subtitle="People you've blocked can't message you, and you won't see their messages."
        keyExtractor={(u) => u.id}
        emptyIcon="shield-checkmark-outline"
        emptyTitle="No blocked accounts"
        emptyMessage="When you block someone from a chat or profile, they'll show up here."
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.profilePicture ? (
              <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>
                  {(item.name?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.unblock, pressed && { opacity: 0.7 }]}
              onPress={() => onUnblock(item)}
              disabled={busyId === item.id}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.unblockText}>
                {busyId === item.id ? 'Working…' : 'Unblock'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
  name: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.text },
  unblock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unblockText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.xs },
});
