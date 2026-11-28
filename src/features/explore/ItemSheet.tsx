/**
 * One item as a full page: the watermarked preview edge to edge with Back, Share and Save, the creator, the title, the
 * original file's specs, the price with its RWF equivalent, "More like this", and a fixed Cart + Buy bar. A clip plays
 * its 15 second watermarked preview inline and ends on a card with Buy full clip, Add to cart and Replay.
 *
 * Store builds show no price, no Buy and no cart (see layout.capabilities); web builds buy through the shared checkout.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScene } from '@/components/ui/GlassCard';
import { PrimaryButton } from '@/components/ui/Button';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { PhotoCheckoutSheet } from '@/features/photos/PhotoCheckoutSheet';
import { useLanguage } from '@/store/language';
import { convertAndFormat, useCurrency } from '@/store/currency';
import { fonts, fontSize, makeStyles, onMedia, radii, spacing, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { fetchQuote, type ExploreItem, type Quote } from './api';
import { useCart } from './cart';
import { capabilities, clock } from './layout';
import { OwnedSheet } from './OwnedSheet';

export function ItemSheet({ item, saved, onSave, onClose, more = [], onOpenOther }: {
  item: ExploreItem; saved: boolean; onSave: () => void; onClose: () => void; more?: ExploreItem[]; onOpenOther?: (i: ExploreItem) => void;
}) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const caps = capabilities(digitalPurchasesEnabled);
  const cart = useCart();
  const currencies = useCurrency(s => s.currencies);
  const video = item.mediaType === 'VIDEO' && !!item.previewVideoUrl;
  const [ended, setEnded] = useState(false);
  const [replay, setReplay] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlockCode, setUnlockCode] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const inCart = cart.has(item.id);

  const buy = async () => {
    setBusy(true);
    try { setQuote(await fetchQuote([item.id], item.priceCurrency)); } finally { setBusy(false); }
  };
  const share = () => { void Share.share({ message: `${item.title || 'Connekyt'} https://connekyt.com/explore?item=${item.id}` }); };

  const title = item.title || (video ? t('explore_clip') : t('explore_photo'));
  const price = item.priceAmount != null ? formatPrice(item.priceAmount, item.priceCurrency) : '';
  const rwf = item.priceAmount != null && item.priceCurrency !== 'RWF' ? convertAndFormat(item.priceAmount, item.priceCurrency, 'RWF', currencies) : null;
  const w = item.width ?? 0;
  const h = item.height ?? 0;
  const specs = [
    ...(w > 0 && h > 0 ? [`${w} × ${h} px`, `${Math.max(1, Math.round((w * h) / 1e6))} MP`] : []),
    ...(video && item.durationSeconds ? [clock(item.durationSeconds)] : []),
    ...(caps.showLicence ? [t('explore_licenceName')] : []),
  ];
  const buyLabel = (video ? t('explore_buyFullPrice') : t('explore_buyPrice')).replace('{p}', price);
  const bar = caps.canBuy ? 76 + insets.bottom : 0;

  return (
    <View style={styles.page}>
      <GlassScene>
        <ScrollView contentContainerStyle={{ paddingBottom: bar + spacing.xl }} showsVerticalScrollIndicator={false}>
          <View style={[styles.stage, { aspectRatio: video ? 16 / 9 : Math.max(0.75, Math.min(1.5, item.aspectRatio)) }]}>
            {video ? <Clip url={item.previewVideoUrl as string} onEnd={() => setEnded(true)} replayKey={replay} />
              : item.previewUrl ? <Image source={{ uri: item.previewUrl }} style={styles.fill} contentFit="cover" transition={160} accessibilityLabel={title} /> : null}
            {video && ended && (
              <View style={styles.end} accessibilityRole="alert">
                <Text style={styles.endTitle}>{t('explore_previewEnded')}</Text>
                {caps.canBuy && <PrimaryButton title={buyLabel} loading={busy} onPress={() => void buy()} />}
                {caps.canBuy && (
                  <Pressable onPress={() => cart.toggle(item)} accessibilityRole="button" hitSlop={8} style={styles.endLink}>
                    <Text style={styles.endLinkText}>{inCart ? t('explore_removeFromCart') : t('explore_addToCart')}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setEnded(false); setReplay(n => n + 1); }} accessibilityRole="button" hitSlop={8} style={styles.endLink}>
                  <Text style={styles.endLinkText}>{t('explore_replay')}</Text>
                </Pressable>
              </View>
            )}
            <View style={styles.topRow} pointerEvents="box-none">
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('explore_back')} hitSlop={4} style={styles.circle}>
                <Ionicons name="chevron-back" size={20} color={onMedia.text} />
              </Pressable>
              <View style={styles.topRight}>
                <Pressable onPress={share} accessibilityRole="button" accessibilityLabel={t('explore_share')} hitSlop={4} style={styles.circle}>
                  <Ionicons name="share-outline" size={19} color={onMedia.text} />
                </Pressable>
                <Pressable onPress={onSave} accessibilityRole="button" accessibilityLabel={saved ? t('explore_saved') : t('explore_save')} hitSlop={4} style={[styles.circle, saved && styles.circleOn]}>
                  <Ionicons name={saved ? 'heart' : 'heart-outline'} size={19} color={onMedia.text} />
                </Pressable>
              </View>
            </View>
            {!video && (
              <Pressable onPress={() => setFull(true)} accessibilityRole="button" accessibilityLabel={t('explore_fullscreen')} hitSlop={4} style={[styles.circle, styles.fullBtn]}>
                <Ionicons name="expand-outline" size={18} color={onMedia.text} />
              </Pressable>
            )}
          </View>

          <View style={styles.body}>
            <View style={styles.creatorRow}>
              <View style={styles.avatar}>
                {item.creatorLogo ? <Image source={{ uri: item.creatorLogo }} style={styles.fill} contentFit="cover" /> : <Text style={styles.avatarText}>{item.creatorName.slice(0, 1).toUpperCase()}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorName} numberOfLines={1}>{item.creatorName}</Text>
                {item.categoryLabel ? <Text style={styles.muted} numberOfLines={1}>{item.categoryLabel}</Text> : null}
              </View>
            </View>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {specs.length > 0 && (
              <View style={styles.chips}>{specs.map(s => <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>)}</View>
            )}
            {item.tags.length > 0 && <Text style={styles.tags}>{item.tags.map(g => `#${g}`).join('  ')}</Text>}
            {caps.showPrices && item.priceAmount != null && (
              <View style={styles.priceRow}>
                <Text style={styles.price}>{price}</Text>
                {rwf && <Text style={styles.muted}>{`≈ ${rwf}`}</Text>}
              </View>
            )}

            {more.length > 0 && (
              <>
                <Text style={styles.section}>{t('explore_moreLike')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moreRow}>
                  {more.map(m => (
                    <Pressable key={m.id} onPress={() => onOpenOther?.(m)} accessibilityRole="button" accessibilityLabel={m.title || m.creatorName} style={styles.moreTile}>
                      {m.thumbnailUrl && <Image source={{ uri: m.thumbnailUrl }} style={styles.fill} contentFit="cover" />}
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </ScrollView>

        {caps.canBuy && (
          <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable onPress={() => cart.toggle(item)} accessibilityRole="button" accessibilityState={{ selected: inCart }}
              accessibilityLabel={inCart ? t('explore_removeFromCart') : t('explore_addToCart')} style={[styles.cartBtn, inCart && styles.cartBtnOn]}>
              <Ionicons name={inCart ? 'bag-check' : 'bag-add-outline'} size={20} color={inCart ? colors.textOnPrimary : colors.text} />
            </Pressable>
            <View style={{ flex: 1 }}><PrimaryButton title={buyLabel} loading={busy} onPress={() => void buy()} /></View>
          </View>
        )}

        {full && (
          <View style={styles.fullPage}>
            <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.fullScroll}>
              {item.previewUrl && <Image source={{ uri: item.previewUrl }} style={styles.fullImg} contentFit="contain" accessibilityLabel={title} />}
            </ScrollView>
            <Pressable onPress={() => setFull(false)} accessibilityRole="button" accessibilityLabel={t('explore_close')} hitSlop={4} style={[styles.circle, styles.fullClose, { top: insets.top + spacing.sm }]}>
              <Ionicons name="close" size={20} color={onMedia.text} />
            </Pressable>
          </View>
        )}
      </GlassScene>

      {quote && (
        <PhotoCheckoutSheet visible onClose={() => setQuote(null)} items={quote.groups} photoCount={1} photographerCount={quote.groups.length}
          currencySym={`${quote.currency} `} total={quote.total}
          onSuccess={(_refid, code) => { setQuote(null); if (code) setUnlockCode(code); }} />
      )}
      {unlockCode && <OwnedSheet initialCode={unlockCode} onClose={() => setUnlockCode(null)} />}
    </View>
  );
}

function Clip({ url, onEnd, replayKey }: { url: string; onEnd: () => void; replayKey: number }) {
  const styles = useStyles();
  const player = useVideoPlayer(url, p => { p.muted = true; p.play(); });
  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player, onEnd]);
  useEffect(() => { if (replayKey > 0) { player.currentTime = 0; player.play(); } }, [replayKey, player]);
  return <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls />;
}

const abs = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

const useStyles = makeStyles((c) => ({
  page: { ...abs, zIndex: 20 },
  stage: { width: '100%', backgroundColor: c.surfaceMuted },
  fill: { flex: 1, width: '100%' },
  topRow: { position: 'absolute', left: spacing.lg, right: spacing.lg, top: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', gap: spacing.sm },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: onMedia.smoke },
  circleOn: { backgroundColor: c.accent },
  fullBtn: { position: 'absolute', right: spacing.lg, bottom: spacing.lg },
  end: { ...abs, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: onMedia.ground },
  endTitle: { color: onMedia.text, fontFamily: fonts.bold, fontSize: fontSize.lg, textAlign: 'center' },
  endLink: { minHeight: 44, justifyContent: 'center' },
  endLinkText: { color: onMedia.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  avatarText: { color: c.textOnPrimary, fontFamily: fonts.bold, fontSize: fontSize.sm },
  creatorName: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.md },
  muted: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  title: { color: c.text, fontFamily: fonts.display, fontSize: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: radii.full, justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  chipText: { color: c.text, fontFamily: fonts.medium, fontSize: fontSize.xs },
  tags: { color: c.link, fontFamily: fonts.medium, fontSize: fontSize.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  price: { color: c.text, fontFamily: fonts.display, fontSize: 30 },
  section: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.md, marginTop: spacing.sm },
  moreRow: { gap: spacing.md },
  moreTile: { width: 104, height: 104, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: c.glassSolid, borderTopWidth: 1, borderTopColor: c.borderSoft },
  cartBtn: { width: 52, height: 52, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint, borderWidth: 1, borderColor: c.borderSoft },
  cartBtnOn: { backgroundColor: c.primary, borderColor: c.primary },
  fullPage: { ...abs, backgroundColor: onMedia.ground },
  fullScroll: { flexGrow: 1, justifyContent: 'center' },
  fullImg: { width: '100%', height: '100%', minHeight: 400 },
  fullClose: { position: 'absolute', right: spacing.lg },
}));
