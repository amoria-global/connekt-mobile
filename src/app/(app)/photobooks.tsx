/**
 * Photobooks — curated photo collections from events.
 *
 * Design matches the photographer "Events & albums" dashboard and the
 * Albums tab: LIBRARY eyebrow header, Pragati Narrow type, and image-led
 * cards with a status badge. A "+ New photobook" FAB authors a photobook
 * (photographers / coordinators only).
 */
import { useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
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
import { listPhotobooks, type Photobook } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  PUBLISHED: { bg: '#D1FAE5', fg: '#047857' },
  DRAFT: { bg: '#E5E7EB', fg: '#374151' },
  PENDING: { bg: '#FEF3C7', fg: '#92400E' },
  SENT: { bg: '#DBEAFE', fg: '#1D4ED8' },
};

export default function PhotobooksScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isPhotographer, isCoordinator } = useRole();
  const canCreate = isPhotographer || isCoordinator;
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotobooks(), []));

  return (
    <Screen padded={false}>
      <FlatList<Photobook>
        data={data ?? []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>LIBRARY</Text>
            <Text style={styles.h1}>Photobooks</Text>
            <Text style={styles.subtitle}>Curated photo collections from your events.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const tone = item.status ? STATUS_TONE[item.status.toUpperCase()] : undefined;
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/photobook/${item.id}` as Href)}
              android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
            >
              <View style={styles.cover}>
                {item.coverImage ? (
                  <Image source={{ uri: item.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                    <Ionicons name="book-outline" size={26} color={colors.textMuted} />
                  </View>
                )}
                {tone ? (
                  <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: tone.fg }]}>{item.status}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.mediaCount != null ? `${item.mediaCount} photos` : 'Photobook'}
                  {item.photographerName ? ` · ${item.photographerName}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} size="large" color={colors.primary} />
          ) : error ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title="Couldn't load photobooks" message="Pull to refresh and try again." />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon="book-outline"
                title="No photobooks yet"
                message="Photobooks curated from your event photos will appear here."
              />
            </View>
          )
        }
      />

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
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusBadgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },
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
