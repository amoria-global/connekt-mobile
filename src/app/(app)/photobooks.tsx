import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { listPhotobooks } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function PhotobooksScreen() {
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotobooks(), []));

  return (
    <Screen padded={false}>
      <ScreenHeader title="Photobooks" subtitle="Curated photo collections from your events" />
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push(`/photobook/${item.id}` as Href)}
          >
            {item.coverImage ? (
              <Image source={{ uri: item.coverImage }} style={styles.cover} contentFit="cover" />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="book-outline" size={26} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.mediaCount != null ? `${item.mediaCount} photos` : 'Photobook'}
                {item.photographerName ? ` · ${item.photographerName}` : ''}
              </Text>
            </View>
            {item.status ? <StatusPill status={item.status} /> : null}
          </Pressable>
        )}
        emptyIcon="book-outline"
        emptyTitle="No photobooks yet"
        emptyMessage="Photobooks curated from your event photos will appear here."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  pressed: { opacity: 0.85 },
  cover: { width: 56, height: 56, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
});
