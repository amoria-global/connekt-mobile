/**
 * Clients: the people a photographer or coordinator works for, one row each with what they have booked and spent.
 * A failed read is an error with a retry, never "no clients"; the spend is shown in the currency the feed names.
 */
import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ListRow } from '@/features/client/studio';
import { Card, EmptyNote, ErrorNotice, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
import { listClients } from '@/features/clients/api';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';
import { spacing, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { selectIsShared, useWorkspace } from '@/store/workspace';

export default function ClientsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { isCoordinator } = useRole();
  // Chat is not part of a shared workspace (messages would go out as the owner), so the message button is not offered.
  const isShared = useWorkspace(selectIsShared);
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listClients(isCoordinator), [isCoordinator]),
  );
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  const failed = !!error && !data;
  const showSkeleton = loading && !data && !error;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <UserHeaderBand
          flush
          duplicatesHeader
          title={t('b2_clientsTitle')}
          subtitle={isCoordinator ? t('b2_clientsSubtitleCoord') : t('b2_clientsSubtitlePhotog')}
        />
        {failed ? <ErrorNotice flush message={error as string} onRetry={refresh} /> : null}
        {showSkeleton ? (
          <View style={styles.group}>
            <SkeletonCard height={72} />
            <SkeletonCard height={72} />
            <SkeletonCard height={72} />
          </View>
        ) : null}
        {data && data.length === 0 ? (
          <View style={styles.flushNote}>
            <EmptyNote compact icon="people-outline" title={t('b2_clientsEmptyTitle')} body={t('b2_clientsEmptyMessage')} />
          </View>
        ) : null}
        {data && data.length > 0 ? (
          <>
            <SectionHeader flush title={`${data.length} ${data.length === 1 ? 'client' : 'clients'}`} />
            <Card style={styles.card}>
              {data.map((item, index) => {
                const bookings =
                  item.bookings != null
                    ? (item.bookings === 1 ? t('b2_clientsBookingsOne') : t('b2_clientsBookingsOther')).replace('{count}', String(item.bookings))
                    : undefined;
                return (
                  <ListRow
                    key={item.id}
                    divider={index < data.length - 1}
                    title={item.name}
                    titleLines={4}
                    metaLines={5}
                    meta={[item.email, bookings].filter(Boolean).join('\n') || undefined}
                    onPress={() => router.push(`/client/${item.id}` as Href)}
                    leading={
                      item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, styles.avatarFallback]}>
                          <Text style={styles.avatarText}>{(item.name[0] ?? '?').toUpperCase()}</Text>
                        </View>
                      )
                    }
                    trailing={
                      <View style={styles.trailing}>
                        {item.totalSpent != null ? (
                          <Text style={styles.spent} maxFontSizeMultiplier={1.6}>
                            {formatPrice(item.totalSpent, item.currency)}
                          </Text>
                        ) : null}
                        {isShared ? null : <Pressable
                          hitSlop={8}
                          style={styles.chatAction}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/conversation/${item.id}?name=${encodeURIComponent(item.name)}` as Href);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t('b2_clientsMessageA11y').replace('{name}', item.name)}
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.primary} />
                        </Pressable>}
                      </View>
                    }
                  />
                );
              })}
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
  flushNote: { marginHorizontal: -spacing.lg },
  card: { marginHorizontal: 0, padding: 0 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  avatarText: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spent: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.primary },
  chatAction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
}));
