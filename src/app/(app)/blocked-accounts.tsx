/**
 * Blocked accounts — review and undo blocks made from chat, messages or
 * profiles. Blocking is account-wide: a blocked user's messages are hidden
 * and neither party can message the other until the block is lifted.
 */
import { useCallback, useEffect, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ListRow } from '@/features/client/studio';
import { ActionButton, Card, EmptyNote, ErrorNotice, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
import { Screen } from '@/components/ui/Screen';
import { useModeration } from '@/features/moderation/useModeration';
import type { BlockedUser } from '@/features/moderation/api';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function BlockedAccountsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { t } = useLanguage();
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
      setError(isApiError(e) ? e.message : t('b1_blockedLoadErr'));
    }
  }, [refresh, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onUnblock = (user: BlockedUser) => {
    Alert.alert(
      t('b1_blockedUnblockTitle', { name: user.name }),
      t('b1_blockedUnblockBody'),
      [
        { text: t('b1_blockedCancel'), style: 'cancel' },
        {
          text: t('b1_blockedUnblock'),
          onPress: async () => {
            setBusyId(user.id);
            try {
              await unblock(user.id);
            } catch (e) {
              Alert.alert(
                t('b1_blockedUnblockErrTitle'),
                isApiError(e) ? e.message : t('b1_blockedTryAgain'),
              );
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const showSkeleton = loading && blocked.length === 0 && !error;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading && blocked.length > 0} onRefresh={load} tintColor={colors.accent} />}
      >
        <UserHeaderBand title={t('b1_blockedTitle')} subtitle={t('b1_blockedSubtitle')} duplicatesHeader />
        {error ? <ErrorNotice message={error} onRetry={load} /> : null}
        {showSkeleton ? (
          <View style={styles.group}>
            <SkeletonCard height={64} />
            <SkeletonCard height={64} />
          </View>
        ) : null}
        {!error && !showSkeleton && blocked.length === 0 ? (
          <EmptyNote compact icon="shield-checkmark-outline" title={t('b1_blockedEmptyTitle')} body={t('b1_blockedEmptyBody')} />
        ) : null}
        {blocked.length > 0 ? (
          <>
            <SectionHeader title={t('b1_blockedTitle')} subtitle={String(blocked.length)} />
            <Card style={styles.card}>
              {blocked.map((item, index) => (
                <ListRow
                  key={item.id}
                  divider={index < blocked.length - 1}
                  title={item.name}
                  leading={
                    item.profilePicture ? (
                      <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarText}>{(item.name?.[0] ?? '?').toUpperCase()}</Text>
                      </View>
                    )
                  }
                  trailing={
                    <ActionButton
                      compact
                      variant="secondary"
                      icon="close-circle-outline"
                      label={busyId === item.id ? t('b1_blockedWorking') : t('b1_blockedUnblock')}
                      disabled={busyId === item.id}
                      onPress={() => onUnblock(item)}
                    />
                  }
                />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.sm },
  card: { padding: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.primary, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
}));
