import { useCallback, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { getAlbum, unlockAlbum, type AlbumImage } from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getAlbum(id), [id]));
  const [unlocking, setUnlocking] = useState(false);

  const gap = spacing.sm;
  const cols = 3;
  const cell = (width - spacing.lg * 2 - gap * (cols - 1)) / cols;

  const onUnlock = async () => {
    setUnlocking(true);
    try {
      await unlockAlbum(id);
      await refresh();
    } catch (err) {
      Alert.alert('Unlock failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const locked = data?.locked && data.images.length === 0;

  return (
    <Screen padded={false}>
      <FlatList
        data={locked ? [] : data?.images ?? []}
        keyExtractor={(img) => img.id}
        numColumns={cols}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{data?.name}</Text>
            <Text style={styles.meta}>
              {data?.photoCount != null ? `${data.photoCount} photos` : ''}
              {data?.photographer ? ` · ${data.photographer}` : ''}
            </Text>
            {locked ? (
              <View style={styles.lockedCard}>
                <Ionicons name="lock-closed" size={28} color={colors.primary} />
                <Text style={styles.lockedTitle}>This album is locked</Text>
                <Text style={styles.lockedMsg}>
                  Unlock to view and download all {data?.photoCount ?? ''} photos.
                </Text>
                <Button
                  title={data?.amountDue ? `Unlock for ${formatMoney(data.amountDue, data.currency)}` : 'Unlock album'}
                  onPress={onUnlock}
                  loading={unlocking}
                />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <PhotoCell image={item} size={cell} />}
        ListEmptyComponent={
          locked ? null : (
            <EmptyState icon="images-outline" title="No photos" message="This album has no photos yet." />
          )
        }
      />
    </Screen>
  );
}

function PhotoCell({ image, size }: { image: AlbumImage; size: number }) {
  const open = () => {
    if (image.url) WebBrowser.openBrowserAsync(image.url);
  };
  return (
    <Pressable onPress={open} style={[styles.cell, { width: size, height: size }]}>
      <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: 2, marginBottom: spacing.md },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  lockedCard: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
  },
  lockedTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  lockedMsg: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  cell: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm },
});
