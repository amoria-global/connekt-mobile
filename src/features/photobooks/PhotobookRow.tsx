/**
 * A photobook on the shelf: one compact row (never a stretched card). A cover mosaic of up to three photos (or a
 * "No photos" tile), the title, who it went to and when, the real status chip, a chip per photo source and the photo
 * count. Nothing is invented: a missing count shows nothing, a missing name shows nothing.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { makeStyles, radii, spacing, useTheme, fonts } from '@/theme';
import { StatusChip } from '@/components/ui/StatusChip';
import { Skeleton } from '@/features/photographer/kit';
import { albumDateText } from '@/features/gallery/albumFacts';
import { useLanguage } from '@/store/language';
import type { Photobook } from './api';
import { pbCopy, photoCountLabel, type CopyKey } from './copy';
import { SOURCE_TONE, sourcesOf, statusInfo, type Shelf } from './model';

/** "To Joseph M. · 27 Mar 2026", "From Aline U. · …", or just the date. */
export function bookByline(b: Pick<Photobook, 'toName' | 'senderName' | 'createdAt' | 'sentAt'>, shelf: Shelf, lang?: string): string | undefined {
  const date = albumDateText(b.sentAt ?? b.createdAt);
  const who = shelf === 'received' ? (b.senderName ? pbCopy(lang, 'from_who', { name: b.senderName }) : undefined) : b.toName ? pbCopy(lang, 'to_who', { name: b.toName }) : undefined;
  return [who, date].filter(Boolean).join(' · ') || undefined;
}

export function Mosaic({ previews, size = 'row' }: { previews?: string[]; size?: 'row' | 'hero' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const hero = size === 'hero';
  if (!previews || previews.length === 0) {
    return (
      <View style={[styles.mosaic, hero && styles.mosaicHero, styles.empty]} accessibilityLabel={pbCopy(language, 'no_photos')}>
        <Ionicons name="image-outline" size={hero ? 34 : 22} color={colors.textMuted} />
        <Text style={styles.emptyText}>{pbCopy(language, 'no_photos')}</Text>
      </View>
    );
  }
  const [a, b, c] = previews;
  const img = (u: string | undefined, style: object) =>
    u ? <Image source={{ uri: u }} style={style} contentFit="cover" transition={120} recyclingKey={u} accessibilityIgnoresInvertColors /> : <View style={[style, styles.fill]} />;
  return (
    <View style={[styles.mosaic, hero && styles.mosaicHero]}>
      <View style={styles.big}>{img(a, StyleSheet.absoluteFill)}</View>
      <View style={styles.stack}>
        <View style={styles.small}>{img(b, StyleSheet.absoluteFill)}</View>
        <View style={styles.small}>{img(c, StyleSheet.absoluteFill)}</View>
      </View>
    </View>
  );
}

function PhotobookRowImpl({ book, shelf, onOpen }: { book: Photobook; shelf: Shelf; onOpen: (id: string, received: boolean) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { language } = useLanguage();
  const info = statusInfo(book, shelf);
  const statusLabel = info.raw ? info.raw : pbCopy(language, info.key as CopyKey);
  const by = bookByline(book, shelf, language);
  const count = photoCountLabel(language, book.mediaCount);
  const sources = sourcesOf(book);
  return (
    <Pressable
      onPress={() => onOpen(book.id, shelf === 'received')}
      accessibilityRole="button"
      accessibilityLabel={[book.name, statusLabel, count, by].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Mosaic previews={book.previews} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {book.name}
        </Text>
        {by ? (
          <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            {by}
          </Text>
        ) : null}
        <View style={styles.chips}>
          <StatusChip label={statusLabel} tone={info.tone} compact />
          {sources.map((s) => (
            <StatusChip key={s} label={pbCopy(language, `src_${s}` as CopyKey)} tone={SOURCE_TONE[s]} compact />
          ))}
        </View>
        {count ? (
          <View style={styles.countRow}>
            <Ionicons name="images-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta} maxFontSizeMultiplier={1.6}>
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}
export const PhotobookRow = memo(PhotobookRowImpl);

export function PhotobookListSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel="Loading photobooks" style={styles.skel}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.mosaic, styles.fill]}>
            <Skeleton height={9999} radius={0} />
          </View>
          <View style={styles.body}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={11} width="45%" />
            <Skeleton height={20} width="60%" />
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pressed: { opacity: 0.88 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  mosaic: { width: 96, height: 84, flexDirection: 'row', gap: 2, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  mosaicHero: { width: '100%', height: 190, borderRadius: radii.lg },
  empty: { alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, borderWidth: 1, borderColor: c.border },
  emptyText: { color: c.textMuted, fontSize: 11, fontFamily: fonts.medium },
  fill: { backgroundColor: c.surfaceMuted },
  big: { flex: 1.7, overflow: 'hidden' },
  stack: { flex: 1, gap: 2 },
  small: { flex: 1, overflow: 'hidden' },
  body: { flex: 1, gap: 4 },
  title: { color: c.text, fontSize: 15, fontFamily: fonts.bold, letterSpacing: -0.2 },
  meta: { color: c.textMuted, fontSize: 12.5, fontFamily: fonts.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skel: { gap: spacing.sm },
}));
