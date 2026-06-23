/**
 * Gallery / album index.
 *
 * Lists the signed-in user's albums via the role-aware
 * `listGalleries(isPhotographer)` helper:
 *   • Client / Coordinator → GET /customer/albums (their event galleries)
 *   • Photographer         → GET /photographer/albums (the albums they own)
 *
 * A floating "+ New album" CTA only renders for Photographers — clients
 * consume galleries, they don't author them (web parity: only the
 * /photographer/albums/content endpoint accepts a create). The button
 * routes to the existing /album/new sheet which already wires the
 * multipart upload through `createContentAlbum`.
 *
 * Cells are responsive: useGridColumns picks 2 → 3 → 4 columns based on
 * viewport (small phones → tablets / web), so a hub of albums looks
 * right at every width.
 */
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { listGalleries, type GalleryItem } from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { useGridColumns, useResponsive } from '@/hooks/useResponsive';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600&q=70';

export default function GalleryScreen() {
  const router = useRouter();
  const { isPhotographer } = useRole();
  const { width } = useResponsive();
  const columns = useGridColumns({ itemMinWidth: 160, min: 2, max: 4 });

  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listGalleries(isPhotographer), [isPhotographer]),
  );

  // Cell size = (viewport − screen padding − gaps) / columns.
  const padding = spacing.xl * 2;
  const gaps = spacing.md * (columns - 1);
  const cellSize = Math.floor((width - padding - gaps) / columns);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Gallery</Text>
        <Text style={styles.subtitle}>
          {isPhotographer
            ? 'Your albums and content collections.'
            : "Albums shared by photographers you've worked with."}
        </Text>
      </View>

      {loading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList<GalleryItem>
          // FlatList's `numColumns` MUST stay constant per mount, so
          // remount via `key` whenever the column count changes.
          key={`gallery-${columns}`}
          data={data ?? []}
          keyExtractor={(g) => g.id}
          numColumns={columns}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns > 1 ? styles.columnGap : undefined}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { width: cellSize },
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(`/album/${item.id}` as never)}
            >
              <Image
                source={{ uri: item.coverPhoto || COVER_FALLBACK }}
                style={[styles.cover, { width: cellSize, height: cellSize }]}
                contentFit="cover"
                transition={200}
              />
              {item.locked ? (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={11} color="#fff" />
                  <Text style={styles.lockText}>LOCKED</Text>
                </View>
              ) : null}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.photoCount != null ? (
                  <Text style={styles.cardMeta}>
                    {item.photoCount} photo{item.photoCount === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            error ? (
              <View style={styles.centered}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
                <Text style={styles.muted}>{error}</Text>
              </View>
            ) : (
              <View style={styles.centered}>
                <EmptyState
                  icon="images-outline"
                  title={isPhotographer ? 'No albums yet' : 'No galleries yet'}
                  message={
                    isPhotographer
                      ? 'Tap the + button to create your first content album.'
                      : 'When a photographer shares an album with you, it lands here.'
                  }
                />
              </View>
            )
          }
        />
      )}

      {/*
       * "+ New album" — Photographer only (web parity: only
       * /photographer/albums/content accepts a create). The button
       * routes to the existing album/new sheet so we don't duplicate
       * the form.
       */}
      {isPhotographer ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/album/new' as never)}
          accessibilityRole="button"
          accessibilityLabel="New album"
        >
          <Ionicons name="add" size={26} color={colors.textOnPrimary} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: 4 },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginBottom: spacing.md },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  list: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  columnGap: { gap: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.85 },
  cover: { backgroundColor: colors.surfaceMuted },
  cardBody: { padding: spacing.sm, gap: 2 },
  cardTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  cardMeta: { fontSize: fontSize.xs, color: colors.textMuted },

  lockBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  lockText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
