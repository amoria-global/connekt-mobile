import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { EventCard } from '@/features/events/EventCard';
import { listPublicEvents } from '@/features/events/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, spacing } from '@/theme';

export default function ExploreEventsScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPublicEvents(), []));

  return (
    <Screen padded={false}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Browse what&apos;s happening — sign in to book or see full details.</Text>
      </View>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.replace('/login')}>
            <EventCard event={item} />
          </Pressable>
        )}
        emptyIcon="calendar-outline"
        emptyTitle="No events yet"
        emptyMessage="Published events will appear here. Check back soon."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  bannerText: { fontSize: fontSize.sm, color: colors.textMuted },
});
