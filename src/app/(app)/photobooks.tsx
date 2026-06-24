import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { useRole } from '@/features/auth/role';
import { listPhotobooks } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function PhotobooksScreen() {
  const router = useRouter();
  const { isPhotographer, isCoordinator } = useRole();
  const canCreate = isPhotographer || isCoordinator;
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

      {/*
       * "+ New photobook" — Photographer / Coordinator only (web parity:
       * the /customer/events/photobook authoring endpoint is gated on
       * those roles). Clients consume photobooks; they don't author them.
       */}
      {canCreate ? (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => router.push('/photobook/new' as Href)}
          accessibilityRole="button"
          accessibilityLabel="New photobook"
        >
          <Ionicons name="add" size={26} color={colors.textOnPrimary} />
        </Pressable>
      ) : null}
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
