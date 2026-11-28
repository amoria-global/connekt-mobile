/**
 * The Explore cart. One item or several go through the same PhotoCheckoutSheet that Find My Photos uses; the server
 * prices the cart (fetchQuote), so the total shown here is only a guide until the checkout opens.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton } from '@/components/ui/Button';
import { PhotoCheckoutSheet } from '@/features/photos/PhotoCheckoutSheet';
import { useLanguage } from '@/store/language';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { fetchQuote, type Quote } from './api';
import { useCart } from './cart';
import { OwnedSheet } from './OwnedSheet';

export function CartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const { items, remove, clear } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const guide = items.reduce((s, i) => s + (i.priceAmount ?? 0), 0);

  const checkout = async () => {
    setBusy(true);
    try { setQuote(await fetchQuote(items.map(i => i.id), items[0]?.priceCurrency ?? 'USD')); } finally { setBusy(false); }
  };

  return (
    <Sheet title={t('explore_cart')} onClose={onClose}
      footer={items.length ? <PrimaryButton title={`${t('explore_checkout')} · ${formatPrice(guide, items[0]?.priceCurrency)}`} loading={busy} onPress={() => void checkout()} /> : undefined}>
      {items.length === 0 && <Text style={styles.empty}>{t('explore_cartEmpty')}</Text>}
      {items.map(i => (
        <View key={i.id} style={styles.row}>
          <View style={styles.thumb}>{i.thumbnailUrl && <Image source={{ uri: i.thumbnailUrl }} style={styles.fill} contentFit="cover" />}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{i.title || (i.mediaType === 'VIDEO' ? t('explore_clip') : t('explore_photo'))}</Text>
            <Text style={styles.sub} numberOfLines={1}>{i.creatorName}</Text>
          </View>
          {i.priceAmount != null && <Text style={styles.price}>{formatPrice(i.priceAmount, i.priceCurrency)}</Text>}
          <Pressable onPress={() => remove(i.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('explore_removeFromCart')} style={styles.x}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
      {quote && (
        <PhotoCheckoutSheet visible onClose={() => setQuote(null)} items={quote.groups} photoCount={items.length} photographerCount={quote.groups.length}
          currencySym={`${quote.currency} `} total={quote.total}
          onSuccess={(_refid, c) => { setQuote(null); clear(); if (c) setCode(c); }} />
      )}
      {code && <OwnedSheet initialCode={code} onClose={() => { setCode(null); onClose(); }} />}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  empty: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.sm, paddingVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  thumb: { width: 48, height: 48, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  fill: { flex: 1 },
  title: { color: c.text, fontFamily: fonts.semibold, fontSize: fontSize.sm },
  sub: { color: c.textMuted, fontFamily: fonts.regular, fontSize: fontSize.xs },
  price: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.sm },
  x: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
