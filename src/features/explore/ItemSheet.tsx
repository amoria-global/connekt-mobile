/**
 * One item in detail: the photo preview, or the clip's 15 second watermarked preview with an end card. Store builds
 * show no price and no Buy (see layout.capabilities); web builds can buy through the shared checkout sheet.
 */
import { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Sheet } from '@/components/ui/Sheet';
import { GhostButton, PrimaryButton } from '@/components/ui/Button';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { PhotoCheckoutSheet } from '@/features/photos/PhotoCheckoutSheet';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { fetchQuote, type ExploreItem, type Quote } from './api';
import { capabilities, clock } from './layout';
import { OwnedSheet } from './OwnedSheet';

export function ItemSheet({ item, saved, onSave, onClose }: { item: ExploreItem; saved: boolean; onSave: () => void; onClose: () => void }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const caps = capabilities(digitalPurchasesEnabled);
  const video = item.mediaType === 'VIDEO' && !!item.previewVideoUrl;
  const [ended, setEnded] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlockCode, setUnlockCode] = useState<string | null>(null);

  const buy = async () => {
    setBusy(true);
    try { setQuote(await fetchQuote([item.id], item.priceCurrency)); } finally { setBusy(false); }
  };
  const share = () => { void Share.share({ message: `${item.title || 'Connekyt'} https://connekyt.com/explore?item=${item.id}` }); };

  return (
    <Sheet title={item.title || (video ? t('explore_clip') : t('explore_photo'))} subtitle={`${t('explore_by').replace('{name}', item.creatorName)}${item.categoryLabel ? ` · ${item.categoryLabel}` : ''}`} onClose={onClose}
      footer={caps.canBuy ? <PrimaryButton title={video ? t('explore_buyFull') : t('explore_buyNow')} loading={busy} onPress={() => void buy()} /> : undefined}>
      <View style={[styles.stage, { aspectRatio: video ? 16 / 9 : Math.max(0.75, Math.min(1.6, item.aspectRatio)) }]}>
        {video ? <Clip url={item.previewVideoUrl as string} onEnd={() => setEnded(true)} replayKey={ended ? 1 : 0} />
          : item.previewUrl ? <Image source={{ uri: item.previewUrl }} style={styles.fill} contentFit="contain" transition={160} accessibilityLabel={item.title} /> : null}
        {video && ended && (
          <View style={styles.end} accessibilityRole="alert">
            <Text style={styles.endTitle}>{t('explore_previewEnds')}</Text>
            {caps.canBuy && <Text style={styles.endBody}>{t('explore_buyFullHint').replace('{s}', clock(item.durationSeconds))}</Text>}
            <GhostButton title={t('explore_preview')} onPress={() => setEnded(false)} />
          </View>
        )}
      </View>
      <View style={styles.row}>
        {caps.showPrices && item.priceAmount != null && <Text style={styles.price}>{formatPrice(item.priceAmount, item.priceCurrency)}</Text>}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSave} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? t('explore_saved') : t('explore_save')} style={styles.icon}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? colors.accent : colors.text} />
        </Pressable>
        <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('explore_share')} style={styles.icon}>
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </Pressable>
      </View>
      {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.map(g => `#${g}`).join('  ')}</Text>}
      {caps.showLicence && <Text style={styles.licence}>{t('explore_licenceLine')}</Text>}

      {quote && (
        <PhotoCheckoutSheet visible onClose={() => setQuote(null)} items={quote.groups} photoCount={1} photographerCount={quote.groups.length}
          currencySym={`${quote.currency} `} total={quote.total}
          onSuccess={(_refid, code) => { setQuote(null); if (code) setUnlockCode(code); }} />
      )}
      {unlockCode && <OwnedSheet initialCode={unlockCode} onClose={() => setUnlockCode(null)} />}
    </Sheet>
  );
}

function Clip({ url, onEnd, replayKey }: { url: string; onEnd: () => void; replayKey: number }) {
  const styles = useStyles();
  const player = useVideoPlayer(url, p => { p.muted = true; p.play(); });
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);
  useEffect(() => { if (replayKey === 0) { player.currentTime = 0; player.play(); } }, [replayKey, player]);
  return <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls />;
}

const useStyles = makeStyles((c) => ({
  stage: { width: '100%', borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  fill: { flex: 1, width: '100%' },
  end: { ...({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const), alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, backgroundColor: c.scrim },
  endTitle: { color: c.textOnPrimary, fontFamily: fonts.bold, fontSize: fontSize.lg, textAlign: 'center' },
  endBody: { color: c.textOnPrimary, fontFamily: fonts.regular, fontSize: fontSize.sm, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  price: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.xl },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tags: { color: c.link, fontFamily: fonts.medium, fontSize: fontSize.sm, marginTop: spacing.sm },
  licence: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs, marginTop: spacing.sm },
}));
