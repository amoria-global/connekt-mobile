/**
 * A photobook on the shelf: a portrait cover with a spine edge, the API's own status as a chip, the real photo count
 * and the photographer or the date it was made. Nothing is invented: a book with no cover shows a book glyph, a book
 * with no count shows no count, and the line under the title is blank rather than "Event Collection".
 */
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, radii, spacing, useTheme, onFill, swatch, type SwatchTone } from '@/theme';
import { Skeleton } from '@/features/photographer/kit';
import { albumDateText, photoCountText } from '@/features/gallery/albumFacts';
import { useSharedT } from '@/i18n/sharedStrings';
import type { Photobook } from './api';
import { chipColors } from './statusChip';

export const STATUS_META: Record<string, { label: string; tone: SwatchTone; }> = {
  PUBLISHED: { label: 'Published', tone: 'success' as const },
  DRAFT: { label: 'Draft', tone: 'neutral' as const },
  PENDING: { label: 'Pending', tone: 'pending' as const },
  SENT: { label: 'Delivered', tone: 'info' as const },
  // Photobooks a client sent to the photographer (web: received photobooks).
  SENT_TO_PHOTOGRAPHER: { label: 'To edit', tone: 'pending' as const },
  PHOTOGRAPHER_EDITING: { label: 'Editing', tone: 'info' as const },
  RESUBMITTED: { label: 'Resubmitted', tone: 'info' as const },
  COMPLETED: { label: 'Completed', tone: 'success' as const },
};

const SCRIM = ['rgba(5,12,24,0)', 'rgba(5,12,24,0.88)'] as const;

/** "By Jean", else the day it was made, else nothing. */
export function bookByline(b: Pick<Photobook, 'photographerName' | 'createdAt'>): string | undefined {
  if (b.photographerName) return `By ${b.photographerName}`;
  return albumDateText(b.createdAt);
}

function PhotobookCardImpl({ book, received, onOpen }: { book: Photobook; received: boolean; onOpen: (id: string, received: boolean) => void }) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const { tr } = useSharedT();
  const base = STATUS_META[(book.status ?? '').toUpperCase()] ?? { label: book.status || 'Book', bg: 'rgba(0,0,0,0.55)', fg: onFill };
  const tone = { ...base, ...chipColors(base, isDark, colors) };
  const count = photoCountText(book.mediaCount);
  const by = bookByline(book);
  return (
    <Pressable
      onPress={() => onOpen(book.id, received)}
      accessibilityRole="button"
      accessibilityLabel={[book.name, tone.label, count, by].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cover}>
        {book.coverImage ? (
          <Image source={{ uri: book.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={book.coverImage} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverEmpty]}>
            <Ionicons name="book-outline" size={34} color={colors.textMuted} />
          </View>
        )}
        <LinearGradient colors={SCRIM} style={styles.scrim} pointerEvents="none" />
        <View style={styles.spine} pointerEvents="none" />
        <View style={styles.top}>
          <View style={[styles.status, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusText, { color: tone.fg }]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {tone.label}
            </Text>
          </View>
        </View>
        {count ? (
          <View style={styles.bottom}>
            <View style={styles.count}>
              <Ionicons name="images" size={11} color={onFill} />
              <Text style={styles.countText} maxFontSizeMultiplier={1.6}>
                {tr(count)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={3} maxFontSizeMultiplier={1.6}>
          {book.name}
        </Text>
        {by ? (
          <Text style={styles.meta} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {tr(by)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
export const PhotobookCard = memo(PhotobookCardImpl);

export function PhotobookGridSkeleton({ rows = 2 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel="Loading photobooks" style={styles.skel}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={styles.skelRow}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.skelCard}>
              <View style={styles.skelCover}>
                <Skeleton height={9999} radius={0} />
              </View>
              <View style={styles.body}>
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
  card: { flex: 1, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden', ...e(1) },
  cover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: c.surfaceMuted, justifyContent: 'space-between', padding: spacing.sm },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: 'rgba(5,12,24,0.38)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.18)' },
  top: { flexDirection: 'row', paddingLeft: 6 },
  status: { flexShrink: 1, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  bottom: { flexDirection: 'row', paddingLeft: 6 },
  count: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(5,12,24,0.62)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  countText: { color: c.textOnPrimary, fontSize: 11, fontWeight: '700' },
  body: { padding: spacing.sm, gap: 3 },
  title: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  meta: { color: c.textMuted, fontSize: 12.5 },
  skel: { gap: spacing.md },
  skelRow: { flexDirection: 'row', gap: spacing.md },
  skelCard: { flex: 1, borderRadius: radii.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  skelCover: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden', backgroundColor: c.surfaceMuted },
}));
