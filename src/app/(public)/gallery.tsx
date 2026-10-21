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
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function GalleryScreen() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isPhotographer } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listGalleries(isPhotographer), [isPhotographer]),
  );

  return (
    <Screen padded={false} edges={[]}>
      <ScreenHeader
        title={isPhotographer ? t('b4_myAlbums') : t('b4_galleries')}
        subtitle={isPhotographer ? t('b4_yourPhotoCollections') : t('b4_photosFromYourEvents')}
      />
      {!isPhotographer ? (
        <Pressable style={styles.photobookLink} onPress={() => router.push('/photobooks' as Href)}>
          <Ionicons name="book-outline" size={20} color={colors.primary} />
          <Text style={styles.photobookText}>{t('b4_photobooks')}</Text>
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
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                {item.photoCount != null ? t('b4_photoCount', { count: item.photoCount }) : t('b4_album')}
                {item.locked ? t('b4_lockedSuffix') : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        emptyIcon="images-outline"
        emptyTitle={isPhotographer ? t('b4_noAlbumsYet') : t('b4_noGalleriesYet')}
        emptyMessage={
          isPhotographer
            ? t('b4_emptyAlbumsPhotographer')
            : t('b4_emptyGalleriesClient')
        }
      />
      {isPhotographer ? <Fab icon="add" onPress={() => router.push('/album/new')} /> : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  pressed: { opacity: 0.85 },
  photobookLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  photobookText: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  cover: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  meta: { fontSize: fontSize.sm, color: c.textMuted },
}));
