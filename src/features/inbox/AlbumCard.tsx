import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { Skeleton } from '@/components/ui/Skeleton';
import { env } from '@/config/env';
import { browsePhotosUrl } from '@/features/payments/webCheckout';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { getAlbumCard, type AlbumCardData } from './api';

const BADGE_TONE: Record<'PAID' | 'PRIVATE' | 'FREE', ChipTone> = { PAID: 'primary', PRIVATE: 'pending', FREE: 'success' };

/** Where the album opens for the client: the same page and access rules as any shared link. */
export function albumShareUrl(slug: string): string {
  return `${env.webBaseUrl}${browsePhotosUrl(slug)}`;
}

/**
 * One shared album inside a chat bubble. The data is fetched when the card shows, so a renamed, archived or removed
 * album is always current. Opening never grants anything: the owner opens their own album, anyone else lands on the
 * album's normal page, where a paid or private album asks for payment or the access code as usual.
 */
export function AlbumCard(props: { albumId: string; mine: boolean }) {
  // Keyed by album, so a different album starts from a clean loading state.
  return <AlbumCardBody key={props.albumId} {...props} />;
}

function AlbumCardBody({ albumId, mine }: { albumId: string; mine: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [card, setCard] = useState<AlbumCardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getAlbumCard(albumId)
      .then((c) => live && setCard(c))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [albumId]);

  if (failed || (card && !card.available)) {
    return (
      <View style={[styles.card, styles.gone]} accessible accessibilityLabel={t('chat_card_unavailable')}>
        <Ionicons name="images-outline" size={18} color={colors.textMuted} />
        <Text style={styles.goneText}>{t('chat_card_unavailable')}</Text>
      </View>
    );
  }

  if (!card) {
    return (
      <View style={styles.card} accessibilityLabel={t('chat_loading_card')}>
        <Skeleton height={120} radius={0} />
        <View style={styles.body}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
    );
  }

  const open = () => {
    if (mine) router.push({ pathname: '/album/[id]', params: { id: albumId } });
    else if (card.shareSlug) void Linking.openURL(albumShareUrl(card.shareSlug));
  };
  const thumbs = card.thumbnails.length >= 3 ? card.thumbnails.slice(0, 3) : [];
  const photos = card.photoCount === 1 ? t('chat_photo_one') : t('chat_photos', { n: card.photoCount });

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}, ${photos}. ${t('chat_card_view')}`}
      style={styles.card}
    >
      <View style={styles.cover}>
        {thumbs.length === 3 ? (
          <View style={styles.collage}>
            <Image source={{ uri: thumbs[0] }} style={styles.collageMain} />
            <View style={styles.collageSide}>
              <Image source={{ uri: thumbs[1] }} style={styles.collageSmall} />
              <Image source={{ uri: thumbs[2] }} style={styles.collageSmall} />
            </View>
          </View>
        ) : card.coverImage ? (
          <Image source={{ uri: card.coverImage }} style={styles.coverImg} />
        ) : (
          <View style={[styles.coverImg, styles.noCover]}>
            <Ionicons name="images-outline" size={28} color={colors.textMuted} />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {card.title}
          </Text>
          <StatusChip
            label={t(card.badge === 'PAID' ? 'chat_badge_paid' : card.badge === 'PRIVATE' ? 'chat_badge_private' : 'chat_badge_free')}
            tone={BADGE_TONE[card.badge]}
            compact
          />
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {photos}
          {card.photographerName ? ` · ${t('chat_card_by', { name: card.photographerName })}` : ''}
        </Text>
        {card.badge === 'PRIVATE' && !mine ? <Text style={styles.note}>{t('chat_card_private_note')}</Text> : null}
        <View style={styles.view}>
          <Text style={styles.viewText}>{t('chat_card_view')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.link} />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    width: 248,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  gone: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  goneText: { flex: 1, color: c.textMuted, fontSize: fontSize.sm, fontFamily: fonts.regular },
  cover: { height: 124, backgroundColor: c.surfaceMuted },
  coverImg: { width: '100%', height: 124 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  collage: { flexDirection: 'row', height: 124, gap: 2 },
  collageMain: { flex: 2, height: 124 },
  collageSide: { flex: 1, gap: 2 },
  collageSmall: { flex: 1, width: '100%' },
  body: { padding: spacing.md, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: c.text, fontSize: fontSize.md, fontFamily: fonts.semibold },
  meta: { color: c.textMuted, fontSize: 12, fontFamily: fonts.regular },
  note: { color: c.pending, fontSize: 12, fontFamily: fonts.medium },
  view: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4, minHeight: 28 },
  viewText: { color: c.link, fontSize: fontSize.sm, fontFamily: fonts.semibold },
}));
