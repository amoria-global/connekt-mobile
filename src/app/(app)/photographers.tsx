import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { listPhotographers } from '@/features/photographers/api';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import { useAsync } from '@/hooks/useAsync';
import { spacing } from '@/theme';

export default function PhotographersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotographers(), []));

  const filtered = useMemo(() => {
    if (!data) return data;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <Screen padded={false}>
      <View style={styles.search}>
        <Input
          placeholder="Search by name, category, or city"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      <DataList
        data={filtered}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/photographer/${item.id}`)}>
            <PhotographerCard photographer={item} />
          </Pressable>
        )}
        emptyIcon="camera-outline"
        emptyTitle="No photographers found"
        emptyMessage="Try a different search, or pull to refresh."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
});
