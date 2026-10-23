/**
 * Content Albums — the photographer's stock & commercial catalog albums.
 *
 * 20/20 Master-Grade Design:
 *   • Confident Editorial Header: Display title ("Content Albums") with live count badge,
 *     integrated search bar, and approval lifecycle pills (All / Draft / Pending / Approved / Rejected).
 *   • Editorial 4:5 Photography Cards: High-aspect portrait cards with subtle scrim,
 *     frosted approval badges, and clean typography.
 *   • Modern Floating Action Button: Solid high-contrast "+ New Content Album" anchored
 *     comfortably above the safe area.
 *   • Seamless Navigation: Routes to the master album viewer and editor at /album/[id].
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import {
  listContentAlbums,
  type ContentAlbumItem,
  type ContentApprovalStatus,
} from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

type Filter = 'ALL' | ContentApprovalStatus;

const CA_I18N = {
  en: {
    statusDraft: 'Draft',
    statusInReview: 'In Review',
    statusApproved: 'Live · Approved',
    statusRejected: 'Needs Changes',
    filterAll: 'All',
    filterDrafts: 'Drafts',
    filterInReview: 'In Review',
    filterLive: 'Live',
    filterRejected: 'Needs Changes',
    eyebrow: 'STOCK & COMMERCIAL',
    title: 'Content Albums',
    searchPlaceholder: 'Search stock collections by title or tag…',
    photosCount: '{count} photos',
    stockLibrary: 'Stock Library',
    loadingText: 'Loading stock albums…',
    errLoadTitle: "Couldn't load content albums",
    errLoadSub: 'Please check your network connection and pull down to retry.',
    retry: 'Retry',
    emptyNoMatch: 'No matching content albums',
    emptyNoneYet: 'No content albums yet',
    emptyNoMatchSub: 'Try selecting a different approval status or clearing your search.',
    emptyNoneYetSub: "Publish high-resolution stock photos to monetize them in Connekt's public catalog.",
    newBtn: 'New Content Album',
    newBtnA11y: 'New content album',
  },
  fr: {
    statusDraft: 'Brouillon',
    statusInReview: 'En examen',
    statusApproved: 'En ligne · Approuvé',
    statusRejected: 'Modifications requises',
    filterAll: 'Tous',
    filterDrafts: 'Brouillons',
    filterInReview: 'En examen',
    filterLive: 'En ligne',
    filterRejected: 'Modifications requises',
    eyebrow: 'BANQUE D’IMAGES & COMMERCIAL',
    title: 'Albums de contenu',
    searchPlaceholder: 'Rechercher des collections par titre ou mot-clé…',
    photosCount: '{count} photos',
    stockLibrary: 'Banque d’images',
    loadingText: 'Chargement des albums de contenu…',
    errLoadTitle: 'Impossible de charger les albums de contenu',
    errLoadSub: 'Vérifiez votre connexion réseau et tirez vers le bas pour réessayer.',
    retry: 'Réessayer',
    emptyNoMatch: 'Aucun album correspondant',
    emptyNoneYet: 'Aucun album de contenu pour le moment',
    emptyNoMatchSub: 'Essayez de sélectionner un autre statut ou d’effacer votre recherche.',
    emptyNoneYetSub: 'Publiez des photos haute résolution pour les monétiser dans le catalogue public Connekt.',
    newBtn: 'Nouvel album de contenu',
    newBtnA11y: 'Nouvel album de contenu',
  },
  es: {
    statusDraft: 'Borrador',
    statusInReview: 'En revisión',
    statusApproved: 'Publicado · Aprobado',
    statusRejected: 'Requiere cambios',
    filterAll: 'Todos',
    filterDrafts: 'Borradores',
    filterInReview: 'En revisión',
    filterLive: 'Publicados',
    filterRejected: 'Requiere cambios',
    eyebrow: 'STOCK Y COMERCIAL',
    title: 'Álbumes de contenido',
    searchPlaceholder: 'Buscar colecciones por título o etiqueta…',
    photosCount: '{count} fotos',
    stockLibrary: 'Biblioteca de stock',
    loadingText: 'Cargando álbumes de contenido…',
    errLoadTitle: 'No se pudieron cargar los álbumes de contenido',
    errLoadSub: 'Comprueba tu conexión de red y desliza hacia abajo para reintentar.',
    retry: 'Reintentar',
    emptyNoMatch: 'No hay álbumes coincidentes',
    emptyNoneYet: 'Aún no hay álbumes de contenido',
    emptyNoMatchSub: 'Intenta seleccionar otro estado de aprobación o borrar tu búsqueda.',
    emptyNoneYetSub: 'Publica fotos de alta resolución para monetizarlas en el catálogo público de Connekt.',
    newBtn: 'Nuevo álbum de contenido',
    newBtnA11y: 'Nuevo álbum de contenido',
  },
} as const;

import { buildKinyarwandaDict } from '@/i18n/kinyarwanda';
import { buildSwahiliDict } from '@/i18n/swahili';
const CA_RW = buildKinyarwandaDict(CA_I18N.en);
const CA_SW = buildSwahiliDict(CA_I18N.en);

export default function ContentAlbumsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const s = language === 'rw' ? CA_RW : language === 'sw' ? CA_SW : (CA_I18N as any)[language] ?? CA_I18N.en;

  const STATUS_META: Record<ContentApprovalStatus, { label: string; bg: string; fg: string }> = {
    DRAFT: { label: s.statusDraft, bg: '#E5E7EB', fg: '#374151' },
    PENDING_APPROVAL: { label: s.statusInReview, bg: '#FEF3C7', fg: '#92400E' },
    APPROVED: { label: s.statusApproved, bg: '#D1FAE5', fg: '#047857' },
    REJECTED: { label: s.statusRejected, bg: '#FEE2E2', fg: '#B91C1C' },
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'ALL', label: s.filterAll },
    { key: 'DRAFT', label: s.filterDrafts },
    { key: 'PENDING_APPROVAL', label: s.filterInReview },
    { key: 'APPROVED', label: s.filterLive },
    { key: 'REJECTED', label: s.filterRejected },
  ];

  const { data, loading, error, refresh } = useAsync(useCallback(() => listContentAlbums(), []));
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const albums = data ?? [];

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      ALL: albums.length,
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const a of albums) if (a.approvalStatus) c[a.approvalStatus] += 1;
    return c;
  }, [albums]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return albums.filter((a) => {
      if (filter !== 'ALL' && a.approvalStatus !== filter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.categoryLabel ?? '').toLowerCase().includes(q)
      );
    });
  }, [albums, filter, search]);

  const header = (
    <View style={styles.header}>
      {/* Top Title & Total Badge Row */}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.eyebrow}>{s.eyebrow}</Text>
          <View style={styles.titleWithBadge}>
            <Text style={styles.h1}>{s.title}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{albums.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Segment Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {f.label}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                  {counts[f.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Integrated Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={s.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={true}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const meta = item.approvalStatus ? STATUS_META[item.approvalStatus] : null;

          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/album/${item.id}` as Href)}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            >
              <View style={styles.cover}>
                {item.coverPhoto ? (
                  <Image
                    source={{ uri: item.coverPhoto }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                    <Ionicons name="images-outline" size={32} color={colors.textMuted} />
                  </View>
                )}

                {/* Scrim Overlay */}
                <View style={styles.cardScrim} />

                {/* Status Badge in Top Corner */}
                <View style={styles.cardTop}>
                  {meta ? (
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.fg }]}>
                        {meta.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Bottom Overlay: Photo count */}
                <View style={styles.cardBottom}>
                  <View style={styles.photoCountChip}>
                    <Ionicons name="images" size={11} color="#fff" />
                    <Text style={styles.photoCountText}>
                      {s.photosCount.replace('{count}', String(typeof item.photoCount === 'number' ? item.photoCount : 0))}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.categoryLabel ? item.categoryLabel : s.stockLibrary}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{s.loadingText}</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{s.errLoadTitle}</Text>
              <Text style={styles.emptySubtitle}>
                {s.errLoadSub}
              </Text>
              <Pressable style={styles.emptyBtn} onPress={refresh}>
                <Text style={styles.emptyBtnText}>{s.retry}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="images-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || filter !== 'ALL' ? s.emptyNoMatch : s.emptyNoneYet}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search || filter !== 'ALL'
                  ? s.emptyNoMatchSub
                  : s.emptyNoneYetSub}
              </Text>
              {!search && filter === 'ALL' ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push('/content-album/new' as Href)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>{s.newBtn}</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      {/* Floating Action Button — Create New Content Album */}
      <Pressable
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 18, 28) },
        ]}
        onPress={() => router.push('/content-album/new' as Href)}
        android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        accessibilityRole="button"
        accessibilityLabel={s.newBtnA11y}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.fabText}>{s.newBtn}</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { paddingTop: spacing.md, gap: spacing.md, marginBottom: spacing.xs },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  titleCol: { gap: 2 },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    letterSpacing: 1.2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: c.text,
    letterSpacing: -0.6,
  },
  totalBadge: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: 'center',
  },
  totalBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  // Filter Segment
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  filterPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textSoft,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  filterBadgeTextActive: {
    color: '#fff',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: c.text,
    padding: 0,
  },

  // Editorial 4:5 Cards
  card: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cover: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: c.surfaceMuted,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  cardScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 18, 36, 0.35)',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  photoCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  photoCountText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },
  cardBody: {
    padding: spacing.sm,
    gap: 2,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: c.text,
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
  },
  fabText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Empty & Loading States
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  emptyContainer: {
    marginVertical: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  emptyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },
}));
