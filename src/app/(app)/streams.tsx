import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { listStreams } from '@/features/streams/api';
import { StreamCard } from '@/features/streams/StreamCard';
import { useAsync } from '@/hooks/useAsync';

export default function StreamsScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listStreams(), []));

  return (
    <Screen padded={false}>
      <ScreenHeader title="Live Streams" subtitle="Watch and support creators" />
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
        emptyTitle="No live streams"
        emptyMessage="When creators go live, their streams will show up here. Pull to refresh."
      />
    </Screen>
  );
}
