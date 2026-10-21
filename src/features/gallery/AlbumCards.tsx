/**
 * Album surfaces for the Gallery screen: a hero for the latest delivery, a two-column card, a list row and a
 * skeleton grid. Every figure is the API's own (see albumFacts): a missing count, date or photographer is simply not
 * drawn. Cards are memoised so a 100-album shelf scrolls without re-rendering rows that did not change.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FallbackImage } from './FallbackImage';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { Skeleton } from '@/features/photographer/kit';
import type { GalleryItem } from './api';
import { albumSubtitle, photoCountText } from './albumFacts';

const SCRIM = ['rgba(5,12,24,0)', 'rgba(5,12,24,0.88)'] as const;

function badgeFor(kind?: string): string {
  const k = (kind ?? '').trim().toUpperCase();
  if (k === 'EVENT') return 'EVENT';
  if (k.includes('PAID')) return 'PAID';
  if (k.includes('FREE')) return 'FREE';
  return 'ALBUM';
}

function a11yLabel(a: GalleryItem, subtitle?: string): string {
  return [a.name, photoCountText(a.photoCount), subtitle, a.locked ? 'Locked' : null].filter(Boolean).join(', ');
}

function Cover({ uri, full, icon, size }: { uri?: string; full?: string; icon: number; size?: 'fill' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  void size;
  return uri ? (
    <FallbackImage uri={uri} fallbackUri={full} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}>
      <Ionicons name="images-outline" size={icon} color={colors.textMuted} />
    </View>
  );
}

function CountChip({ count }: { count?: number }) {
  const styles = useStyles();
  const text = photoCountText(count);
  if (!text) return null;
  return (
    <View style={styles.chip}>
      <Ionicons name="images" size={11} color="#fff" />
      <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>
        {text}
      </Text>
    </View>
  );
}

function LockBadge() {
  const styles = useStyles();
  return (
    <View style={styles.lock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name="lock-closed" size={11} color="#fff" />
    </View>
  );
}

/** The one gradient hero of the screen: the newest unlocked album with a cover. Client and coordinator only. */
function AlbumHeroImpl({ album, showPhotographer, onOpen }: { album: GalleryItem; showPhotographer: boolean; onOpen: () => void }) {
  const styles = useStyles();
  const sub = albumSubtitle(album, showPhotographer);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open latest album, ${a11yLabel(album, sub)}`} style={({ pressed }) => [styles.hero, pressed && styles.pressed]}>
      <Cover uri={album.coverPhoto} full={album.coverFull} icon={40} />
      <LinearGradient colors={SCRIM} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.heroTop}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrowText}>LATEST DELIVERY</Text>
        </View>
      </View>
      <View style={styles.heroBottom}>
        <Text style={styles.heroTitle} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {album.name}
        </Text>
        <View style={styles.heroMeta}>
          <CountChip count={album.photoCount} />
          {sub ? (
            <Text style={styles.heroSub} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
export const AlbumHero = memo(AlbumHeroImpl);

function AlbumGridCardImpl({ album, showPhotographer, onOpen }: { album: GalleryItem; showPhotographer: boolean; onOpen: (id: string) => void }) {
  const styles = useStyles();
  const sub = albumSubtitle(album, showPhotographer);
  return (
    <Pressable
      onPress={() => onOpen(album.id)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel(album, sub)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardCover}>
        <Cover uri={album.coverPhoto} full={album.coverFull} icon={30} />
        <LinearGradient colors={SCRIM} style={styles.cardScrim} pointerEvents="none" />
        <View style={styles.cardTop}>
          <View style={styles.kind}>
            <Text style={styles.kindText}>{badgeFor(album.kind)}</Text>
          </View>
          {album.locked ? <LockBadge /> : null}
        </View>
        <View style={styles.cardBottom}>
          <CountChip count={album.photoCount} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={3} maxFontSizeMultiplier={1.6}>
          {album.name}
        </Text>
        {sub ? (
          <Text style={styles.cardSub} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
export const AlbumGridCard = memo(AlbumGridCardImpl);

function AlbumListRowImpl({ album, showPhotographer, onOpen }: { album: GalleryItem; showPhotographer: boolean; onOpen: (id: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const sub = albumSubtitle(album, showPhotographer);
  return (
    <Pressable
      onPress={() => onOpen(album.id)}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel(album, sub)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowThumb}>
        <Cover uri={album.coverPhoto} full={album.coverFull} icon={22} />
        {album.locked ? (
          <View style={styles.rowLock}>
            <LockBadge />
          </View>
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTags}>
          <View style={styles.kindSoft}>
            <Text style={styles.kindSoftText}>{badgeFor(album.kind)}</Text>
          </View>
          {photoCountText(album.photoCount) ? <Text style={styles.rowCount}>{photoCountText(album.photoCount)}</Text> : null}
        </View>
        <Text style={styles.rowTitle} numberOfLines={3} maxFontSizeMultiplier={1.6}>
          {album.name}
        </Text>
        {sub ? (
          <Text style={styles.cardSub} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
export const AlbumListRow = memo(AlbumListRowImpl);

/** Placeholder shelf with the footprint of two rows of cards, so nothing jumps when the albums arrive. */
export function AlbumGridSkeleton({ rows = 2 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel="Loading albums" style={styles.skel}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.skelRow}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skelCard}>
              <View style={styles.skelCover}>
                <Skeleton height={9999} radius={0} />
              </View>
              <View style={styles.cardBody}>
                <Skeleton height={14} width="70%" />
                <Skeleton height={11} width="45%" />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  pressed: { opacity: 0.88 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(5,12,24,0.62)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  lock: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(5,12,24,0.7)', alignItems: 'center', justifyContent: 'center' },

  hero: { marginTop: spacing.sm, height: 196, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'space-between', padding: spacing.md, ...e(2) },
  heroTop: { flexDirection: 'row' },
  eyebrowPill: { backgroundColor: c.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  eyebrowText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  heroBottom: { gap: spacing.xs },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  heroSub: { color: 'rgba(255,255,255,0.86)', fontSize: 13, flexShrink: 1 },

  card: { flex: 1, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden', ...e(1) },
  cardCover: { width: '100%', aspectRatio: 4 / 5, backgroundColor: c.surfaceMuted, justifyContent: 'space-between', padding: spacing.sm },
  cardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBottom: { flexDirection: 'row' },
  kind: { backgroundColor: 'rgba(5,12,24,0.62)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  kindText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  cardBody: { padding: spacing.sm, gap: 3 },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { color: c.textMuted, fontSize: 12.5 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  rowThumb: { width: 88, height: 66, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  rowLock: { position: 'absolute', top: 4, right: 4 },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  kindSoft: { backgroundColor: c.tint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  kindSoftText: { color: c.link, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  rowCount: { color: c.textSoft, fontSize: 12.5, fontWeight: '600' },
  rowTitle: { color: c.text, fontSize: 15.5, fontWeight: '800', letterSpacing: -0.2 },

  skel: { gap: spacing.md },
  skelRow: { flexDirection: 'row', gap: spacing.md },
  skelCard: { flex: 1, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  skelCover: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', backgroundColor: c.surfaceMuted },
}));
