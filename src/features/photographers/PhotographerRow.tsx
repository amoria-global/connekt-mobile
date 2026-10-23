/**
 * A compact photographer row for the directory: portrait at the left, the facts at the right, a bookmark at the top
 * and the price with one action at the bottom. About a third of the height of the old tall card, so a screen shows
 * three or four people instead of one.
 *
 * Honesty: a rating is drawn only when the API has one (otherwise nothing, never a "New" star), the review count is
 * the API's own, the price carries the currency of its package, and "Available" or "Booked" is the API's status.
 */
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSharedT } from '@/i18n/sharedStrings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import type { Photographer } from './api';
import { startingPriceText } from './pricing';

function PhotographerRowImpl({
  photographer: p,
  isBookmarked,
  onOpen,
  onToggleBookmark,
}: {
  photographer: Photographer;
  isBookmarked: boolean;
  onOpen: () => void;
  onToggleBookmark: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const portrait = p.avatar || p.coverImage || p.images?.[0];
  const rating = typeof p.rating === 'number' && p.rating > 0 ? p.rating : null;
  const reviews = p.reviewCount ?? 0;
  const booked = p.currentStatus === 'booked';
  const tags = (p.specialties?.length ? p.specialties : p.category ? [p.category] : []).slice(0, 2);
  const more = (p.specialties?.length ?? 0) - 2;
  const price = startingPriceText(p);
  const summary = [p.name, rating ? `${rating.toFixed(1)} stars` : null, p.location, price, booked ? 'Booked' : 'Available'].filter(Boolean).join(', ');

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${summary}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {portrait ? (
          <Image source={{ uri: portrait }} style={styles.portrait} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.portrait, styles.portraitEmpty]}>
            <Text style={styles.initial}>{(p.name[0] ?? 'P').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {p.name}
            </Text>
            {p.isVerified ? <Ionicons name="checkmark-circle" size={16} color={colors.link} accessibilityLabel="Verified" /> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {[p.category ? tr(p.category) : null, p.location].filter(Boolean).join(' · ') || tr('Photographer')}
          </Text>
          <View style={styles.factsRow}>
            {rating ? (
              <View style={styles.fact}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={styles.factText}>
                  {rating.toFixed(1)}
                  {reviews > 0 ? ` (${reviews})` : ''}
                </Text>
              </View>
            ) : null}
            <View style={[styles.status, { backgroundColor: booked ? colors.warningBg : colors.successBg }]}>
              <View style={[styles.dot, { backgroundColor: booked ? colors.warning : colors.success }]} />
              <Text style={[styles.statusText, { color: booked ? colors.warning : colors.success }]}>{booked ? tr('Booked') : tr('Available')}</Text>
            </View>
          </View>
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {tr(t)}
                  </Text>
                </View>
              ))}
              {more > 0 ? (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>+{more}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.bottom}>
            <Text style={styles.price} maxFontSizeMultiplier={1.25}>
              {tr(price)}
            </Text>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>{tr('View profile')}</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.textOnPrimary} />
            </View>
          </View>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleBookmark}
        accessibilityRole="button"
        accessibilityLabel={isBookmarked ? `Remove ${p.name} from saved photographers` : `Save ${p.name}`}
        accessibilityState={{ selected: isBookmarked }}
        hitSlop={6}
        style={({ pressed }) => [styles.bookmark, pressed && styles.pressed]}
      >
        <Ionicons name={isBookmarked ? 'bookmark' : 'bookmark-outline'} size={18} color={isBookmarked ? colors.accent : colors.textMuted} />
      </Pressable>
    </View>
  );
}

export const PhotographerRow = memo(PhotographerRowImpl);

const useStyles = makeStyles((c, e) => ({
  card: { backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, ...e(1) },
  pressed: { opacity: 0.88 },
  main: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, paddingRight: spacing.md + 36 },
  portrait: { width: 88, height: 116, borderRadius: radii.md },
  portraitEmpty: { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  initial: { color: c.link, fontSize: 30, fontWeight: '800' },
  body: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { flexShrink: 1, color: c.text, fontSize: 16, fontWeight: '800' },
  meta: { color: c.textMuted, fontSize: 13 },
  factsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: 2 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  factText: { color: c.textSoft, fontSize: 13, fontWeight: '700' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full, backgroundColor: c.surfaceMuted, maxWidth: '100%' },
  tagText: { color: c.textSoft, fontSize: 12 },
  // Wraps at large text so the price is shown in full and the action drops to its own line, never "Fro...".
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.xs },
  price: { color: c.text, fontSize: 14, fontWeight: '800' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: spacing.md, borderRadius: radii.full, backgroundColor: c.primary },
  ctaText: { color: c.textOnPrimary, fontSize: 13, fontWeight: '700' },
  bookmark: { position: 'absolute', top: 4, right: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
