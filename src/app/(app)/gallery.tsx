/**
 * Albums (Gallery) — the photographer's event & personal photo albums,
 * OR (for clients/coordinators) the albums photographers have shared.
 *
 * Content-library albums are intentionally excluded here — they live in
 * the Content tab (`/content-albums`). We use `listAlbums`, which filters
 * out any album carrying a `contentApprovalStatus`.
 *
 * Design matches the photographer "Events & albums" dashboard: LIBRARY
 * eyebrow header, Pragati Narrow type, and image-led cards with a clean
 * white footer. A "+ New album" FAB creates a normal album (photographers
 * only).
 */
import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
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
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { useRole } from '@/features/auth/role';
import { listAlbums, type GalleryItem } from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

export default function GalleryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isPhotographer } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listAlbums(isPhotographer), [isPhotographer]),
  );

  return (
    <Screen padded={false}>
      <FlatList<GalleryItem>
        data={data ?? []}
        keyExtractor={(g) => g.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <UserHeaderBand
            eyebrow="LIBRARY"
            title="Albums"
            subtitle={
              isPhotographer
                ? 'Your event and personal photo albums.'
                : "Albums shared by photographers you've worked with."
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/album/${item.id}` as Href)}
            android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
          >
            <View style={styles.cover}>
              {item.coverPhoto ? (
                <Image source={{ uri: item.coverPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                  <Ionicons name="images-outline" size={26} color={colors.textMuted} />
                </View>
              )}
              {item.locked ? (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color="#fff" />
                  <Text style={styles.lockText}>LOCKED</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
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
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} size="large" color={colors.primary} />
          ) : error ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title="Couldn't load albums" message="Pull to refresh and try again." />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon="images-outline"
                title={isPhotographer ? 'No albums yet' : 'No galleries yet'}
                message={
                  isPhotographer
                    ? 'Tap the + button to create your first album.'
                    : 'When a photographer shares an album with you, it lands here.'
                }
              />
            </View>
          )
        }
      />

      {isPhotographer ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/album/new' as Href)}
          accessibilityRole="button"
          accessibilityLabel="New album"
        >
          <Ionicons name="add" size={26} color={colors.textOnPrimary} />
        </Pressable>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },

  header: { paddingTop: spacing.md, marginBottom: spacing.xs },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, marginTop: 2, lineHeight: 20 },

  card: { flex: 1, marginBottom: spacing.md },
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  lockText: { color: '#fff', fontSize: 9, fontFamily: fonts.bold, letterSpacing: 0.5 },
  cardBody: { paddingTop: 6 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  cardMeta: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, marginTop: 1 },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
