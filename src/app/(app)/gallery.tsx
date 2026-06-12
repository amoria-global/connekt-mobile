import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Fab } from '@/components/ui/Fab';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRole } from '@/features/auth/role';
import { listGalleries } from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function GalleryScreen() {
  const router = useRouter();
  const { isPhotographer } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listGalleries(isPhotographer), [isPhotographer]),
  );

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={isPhotographer ? 'My Albums' : 'Galleries'}
        subtitle={isPhotographer ? 'Your photo collections' : 'Photos from your events'}
      />
      {!isPhotographer ? (
        <Pressable style={styles.photobookLink} onPress={() => router.push('/photobooks' as Href)}>
          <Ionicons name="book-outline" size={20} color={colors.primary} />
          <Text style={styles.photobookText}>Photobooks</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push(`/album/${item.id}`)}
          >
            {item.coverPhoto ? (
              <Image source={{ uri: item.coverPhoto }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="images-outline" size={28} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.photoCount != null ? `${item.photoCount} photos` : 'Album'}
                {item.locked ? ' · 🔒 Locked' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        emptyIcon="images-outline"
        emptyTitle={isPhotographer ? 'No albums yet' : 'No galleries yet'}
        emptyMessage={
          isPhotographer
            ? 'Tap + to create a paid album and sell your photo collections.'
            : 'Photos from your events will appear here once a photographer shares them.'
        }
      />
      {isPhotographer ? <Fab icon="add" onPress={() => router.push('/album/new')} /> : null}
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
  photobookLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  photobookText: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  cover: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
});
