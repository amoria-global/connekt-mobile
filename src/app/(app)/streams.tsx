import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { listStreams } from '@/features/streams/api';
import { StreamCard } from '@/features/streams/StreamCard';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';

export default function StreamsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listStreams(isCoordinator), [isCoordinator]),
  );

  return (
    <Screen padded={false}>
      <ScreenHeader duplicatesHeader title={t('b2_streamsTitle')} subtitle={t('b2_streamsSubtitle')} />
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/stream/${item.id}`)}>
            <StreamCard stream={item} />
          </Pressable>
        )}
        emptyIcon="videocam-outline"
        emptyTitle={t('b2_streamsEmptyTitle')}
        emptyMessage={t('b2_streamsEmptyMessage')}
      />
    </Screen>
  );
}
