import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { ListRow } from '@/features/client/studio';
import { ActionButton, Card, EmptyNote, ErrorNotice, MetricCard, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
import { getClient, listFavoriteClientIds, toggleFavoriteClient } from '@/features/clients/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useModeration } from '@/features/moderation/useModeration';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

export default function ClientDetailScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getClient(id, isCoordinator), [id, isCoordinator]),
  );

  const [favorite, setFavorite] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  useEffect(() => {
    let active = true;
    listFavoriteClientIds()
      .then((ids) => active && setFavorite(ids.includes(id)))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id]);

  const [reportOpen, setReportOpen] = useState(false);
  const blocked = useModeration((s) => s.blockedIds.has(id));
  const block = useModeration((s) => s.block);
  const unblock = useModeration((s) => s.unblock);
  const loadModeration = useModeration((s) => s.load);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const onBlock = () => {
    Alert.alert(
      t('b2_clientBlockConfirmTitle').replace('{name}', data?.name ?? t('b2_clientThisUser')),
      t('b2_clientBlockConfirmMsg'),
      [
        { text: t('b2_clientCancel'), style: 'cancel' },
        {
          text: t('b2_clientBlock'),
          style: 'destructive',
          onPress: async () => {
            try {
              await block(id);
            } catch (e) {
              Alert.alert(t('b2_clientBlockErrorTitle'), isApiError(e) ? e.message : t('b2_clientTryAgain'));
            }
          },
        },
      ],
    );
  };

  const onUnblock = async () => {
    try {
      await unblock(id);
    } catch (e) {
      Alert.alert(t('b2_clientUnblockErrorTitle'), isApiError(e) ? e.message : t('b2_clientTryAgain'));
    }
  };

  const onMoreActions = () => {
    Alert.alert(data?.name ?? t('b2_clientActionsTitle'), undefined, [
      { text: t('b2_clientReportUser'), style: 'destructive', onPress: () => setReportOpen(true) },
      blocked
        ? { text: t('b2_clientUnblockUser'), onPress: () => void onUnblock() }
        : { text: t('b2_clientBlockUser'), style: 'destructive' as const, onPress: onBlock },
      { text: t('b2_clientCancel'), style: 'cancel' },
    ]);
  };

  const submitUserReport = (reason: string, description: string) =>
    reportContent('USER', id, reason, description);

  const onToggleFavorite = async () => {
    setFavBusy(true);
    const optimistic = !favorite;
    setFavorite(optimistic);
    try {
      const next = await toggleFavoriteClient(id);
      if (typeof next === 'boolean') setFavorite(next);
    } catch {
      setFavorite(!optimistic); // revert
    } finally {
      setFavBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen padded={false}>
        <View style={styles.scroll} accessibilityLabel="Loading client">
          <SkeletonCard height={200} />
          <SkeletonCard height={90} />
          <SkeletonCard height={72} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false}>
        <View style={styles.scroll}>
          <ErrorNotice flush message={error} onRetry={refresh} />
        </View>
      </Screen>
    );
  }

  const initials = (data?.name?.[0] ?? '?').toUpperCase();
  const bookingCount = data?.bookings ?? data?.events.length;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.headerCard}>
          {data?.avatar ? (
            <Image source={{ uri: data.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name} accessibilityRole="header">
            {data?.name}
          </Text>
          {data?.email ? <Text style={styles.meta}>{data.email}</Text> : null}
          {data?.phone ? <Text style={styles.meta}>{data.phone}</Text> : null}
          {data?.location ? <Text style={styles.meta}>{data.location}</Text> : null}

          <View style={styles.headerActions}>
            <ActionButton
              variant="primary"
              compact
              icon="chatbubble-ellipses-outline"
              label={t('b2_clientMessageBtn')}
              onPress={() =>
                router.push(`/conversation/${id}?name=${encodeURIComponent(data?.name ?? 'Client')}` as Href)
              }
              style={styles.headerAction}
            />
            <ActionButton
              variant="secondary"
              compact
              icon={favorite ? 'star' : 'star-outline'}
              label={favorite ? t('b2_clientFavorite') : t('b2_clientAddToFavorites')}
              disabled={favBusy}
              onPress={onToggleFavorite}
              style={styles.headerAction}
            />
            <ActionButton
              variant="secondary"
              compact
              icon="ellipsis-horizontal"
              label="More"
              onPress={onMoreActions}
              style={styles.headerAction}
            />
          </View>

          {blocked ? <Text style={styles.blockedNote}>{t('b2_clientBlockedNote')}</Text> : null}
        </Card>

        <View style={styles.stats}>
          <MetricCard
            style={styles.stat}
            icon="calendar-outline"
            tone="accent"
            label={t('b2_clientBookings')}
            value={bookingCount == null ? 'N/A' : String(bookingCount)}
          />
          {data?.totalSpent != null ? (
            <MetricCard
              style={styles.stat}
              icon="wallet-outline"
              label={t('b2_clientTotalSpent')}
              value={formatPrice(data.totalSpent, data.currency)}
            />
          ) : null}
        </View>

        <SectionHeader flush title={t('b2_clientEvents')} />
        {data?.events.length ? (
          <Card style={styles.list}>
            {data.events.map((e, i, arr) => (
              <ListRow
                key={e.id}
                icon="calendar-outline"
                title={e.title}
                meta={e.date ? formatDate(e.date) : undefined}
                trailing={e.status ? <StatusPill status={e.status} /> : undefined}
                onPress={() => router.push(`/event/${e.id}` as Href)}
                divider={i < arr.length - 1}
              />
            ))}
          </Card>
        ) : (
          <EmptyNote compact icon="calendar-outline" title={t('b2_clientEmptyEvents')} />
        )}
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="USER"
        subject={data?.name}
        submit={submitUserReport}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.lg },
  headerCard: { alignItems: 'center', gap: spacing.xs, marginHorizontal: 0 },
  avatar: { width: 88, height: 88, borderRadius: radii.full, backgroundColor: c.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  initials: { color: c.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text, marginTop: spacing.sm, textAlign: 'center' },
  meta: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  headerAction: { flexGrow: 1 },
  blockedNote: { fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, marginHorizontal: 0 },
  list: { marginHorizontal: 0, padding: 0, overflow: 'hidden' },
}));
