/**
 * Browse Photos (stock library) — mobile port of knockout/app/pages/
 * browse-photos.tsx. Grid + lightbox preview, a cart, and the SAME
 * multi-album purchase flow the find-my-photos page uses: each cart slice
 * is grouped by gallery (= albumId) so the right photographer is credited,
 * then XentriPay → poll status → record → per-photo download.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchBrowsePhotos,
  getPhotoDownloadUrl,
  type BrowseRow,
  type MultiAlbumPurchaseItem,
} from '@/features/photos/api';
import { PhotoCheckoutSheet } from '@/features/photos/PhotoCheckoutSheet';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { spacing } from '@/theme';

function sym(code?: string | null) {
  return code === 'USD' ? '$' : code === 'EUR' ? '€' : code === 'GBP' ? '£' : `${code ?? ''} `;
}

export default function BrowsePhotosScreen() {
  const [items, setItems] = useState<BrowseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState<BrowseRow | null>(null);
  const [reporting, setReporting] = useState<BrowseRow | null>(null);

  // Cart keyed by imageId.
  const [cart, setCart] = useState<Record<string, BrowseRow>>({});
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + Number(i.buyerPrice || 0), 0),
    [cartItems],
  );

  // Checkout + purchase state.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [purchased, setPurchased] = useState<BrowseRow[] | null>(null);
  const [purchaseRefid, setPurchaseRefid] = useState<string | null>(null);
  const [unlockCode, setUnlockCode] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const numColumns = width > 600 ? 3 : 2;
  const gap = spacing.sm;
  const contentPadding = spacing.md;
  const cellWidth = (width - contentPadding * 2 - gap * (numColumns - 1)) / numColumns;

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setItems(await fetchBrowsePhotos(0, 50));
      } catch (err) {
        console.error('Failed to load browse photos', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inCart = (id: string) => !!cart[id];
  const toggleCart = (row: BrowseRow) =>
    setCart((prev) => {
      const next = { ...prev };
      if (next[row.imageId]) delete next[row.imageId];
      else next[row.imageId] = row;
      return next;
    });

  // Group the cart by gallery → one MultiAlbumPurchaseItem per photographer,
  // each in its native listing currency (web parity: exact photographer
  // credit; backend converts each slice to RWF for the gateway charge).
  const multiAlbumItems: MultiAlbumPurchaseItem[] = useMemo(() => {
    const groups = new Map<string, { ids: string[]; total: number; currency: string }>();
    for (const it of cartItems) {
      const g = groups.get(it.galleryId) || { ids: [], total: 0, currency: it.listingCurrency || 'USD' };
      g.ids.push(it.imageId);
      g.total += Number(it.listingPrice || 0);
      groups.set(it.galleryId, g);
    }
    return Array.from(groups.entries()).map(([galleryId, g]) => ({
      albumId: galleryId,
      photoIds: g.ids,
      amount: g.total,
      currencyId: g.currency,
    }));
  }, [cartItems]);

  const startCheckout = (row?: BrowseRow) => {
    if (row && !inCart(row.imageId)) setCart((prev) => ({ ...prev, [row.imageId]: row }));
    setPreviewing(null);
    setCheckoutOpen(true);
  };

  // The checkout sheet drives the whole payment (email → method → gateway
  // → poll → record) and hands us back the refid + unlock code. We snapshot
  // the cart here so the download grid shows exactly what was paid for, then
  // clear it.
  const onPaymentSuccess = (refid: string, code: string | null) => {
    setPurchased([...cartItems]);
    setPurchaseRefid(refid);
    setUnlockCode(code);
    setCheckoutOpen(false);
    setCart({});
  };

  // The report sheet is itself a Modal, so the lightbox has to close first —
  // stacked Modals don't render reliably on iOS.
  const openReport = (row: BrowseRow) => {
    setPreviewing(null);
    setReporting(row);
  };

  const submitPhotoReport = async (reason: string, description: string) => {
    if (!reporting) throw { status: 400, message: 'Nothing to report.' };
    return reportContent('PHOTO', reporting.imageId, reason, description);
  };

  const downloadPhoto = (row: BrowseRow) => {
    if (!purchaseRefid) return;
    const url = getPhotoDownloadUrl(row.galleryId, row.imageId, { refid: purchaseRefid });
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: BrowseRow }) => {
    const selected = inCart(item.imageId);
    return (
      <Pressable
        style={[styles.card, { width: cellWidth, height: cellWidth * 1.2, marginBottom: gap }]}
        onPress={() => setPreviewing(item)}
      >
        <Image source={{ uri: item.fileUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.gradient} />
        {digitalPurchasesEnabled ? (
          <Pressable
            style={[styles.cartToggle, selected && styles.cartToggleOn]}
            onPress={() => toggleCart(item)}
            hitSlop={8}
          >
            <Ionicons name={selected ? 'checkmark' : 'add'} size={16} color="#fff" />
          </Pressable>
        ) : null}
        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.photographerName}</Text>
          <Text style={styles.cardPrice}>{sym(item.buyerCurrency)}{item.buyerPrice}</Text>
        </View>
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>PREVIEW</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <LinearGradient colors={['#052047', '#052047', '#103E83']} style={StyleSheet.absoluteFillObject} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.imageId}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom + spacing.xl, 100) + (cartItems.length ? 64 : 0),
            paddingHorizontal: contentPadding,
          }}
          columnWrapperStyle={numColumns > 1 ? { gap } : undefined}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="images-outline" size={48} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>No photos found.</Text>
            </View>
          }
        />
      )}

      {/* Cart checkout bar */}
      {cartItems.length > 0 && digitalPurchasesEnabled ? (
        <View style={[styles.cartBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartBarCount}>
              {cartItems.length} photo{cartItems.length === 1 ? '' : 's'}
            </Text>
            <Text style={styles.cartBarTotal}>
              {sym(cartItems[0]?.buyerCurrency)}{cartTotal.toFixed(2)}
            </Text>
          </View>
          <Pressable style={styles.cartBarBtn} onPress={() => startCheckout()}>
            <Text style={styles.cartBarBtnText}>Checkout</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Lightbox preview */}
      <Modal visible={!!previewing} transparent animationType="fade">
        <View style={styles.lightboxContainer}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewing(null)} />
          <View style={[styles.lightboxContent, { marginTop: insets.top, marginBottom: insets.bottom }]}>
            <View style={styles.lightboxHeader}>
              <Pressable
                onPress={() => previewing && openReport(previewing)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Report photo"
                hitSlop={8}
              >
                <Ionicons name="flag-outline" size={22} color="#FFF" />
              </Pressable>
              <Pressable onPress={() => setPreviewing(null)} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#FFF" />
              </Pressable>
            </View>

            {previewing && (
              <View style={styles.lightboxImageContainer}>
                <Image source={{ uri: previewing.fileUrl }} style={styles.lightboxImage} contentFit="contain" />
                <View style={styles.lightboxWatermarkBand}>
                  <Text style={styles.lightboxWatermarkText}>
                    PREVIEW · {previewing.photographerName.toUpperCase()}
                  </Text>
                </View>
              </View>
            )}

            {previewing && (
              <View style={styles.lightboxFooter}>
                <Text style={styles.lightboxTitle} numberOfLines={2}>{previewing.title || 'Untitled'}</Text>
                <Text style={styles.lightboxPhotographer}>By {previewing.photographerName}</Text>
                {/* Without a checkout path the cart is a dead end, so the whole
                    buying funnel goes away rather than just the Buy button. */}
                {digitalPurchasesEnabled ? (
                  <View style={styles.lightboxActions}>
                    <Pressable
                      style={[styles.lbBtn, styles.lbBtnGhost]}
                      onPress={() => previewing && toggleCart(previewing)}
                    >
                      <Ionicons
                        name={inCart(previewing.imageId) ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color="#fff"
                      />
                      <Text style={styles.lbBtnText}>{inCart(previewing.imageId) ? 'In cart' : 'Add to cart'}</Text>
                    </Pressable>
                    <Pressable style={[styles.lbBtn, styles.lbBtnPrimary]} onPress={() => startCheckout(previewing)}>
                      <Text style={styles.lbBtnText}>
                        Buy · {sym(previewing.buyerCurrency)}{previewing.buyerPrice}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Checkout — full web-parity payment sheet (method tiles, geo
          blocking lines, phone/card, validity-gated pay). */}
      <PhotoCheckoutSheet
        visible={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={multiAlbumItems}
        photoCount={cartItems.length}
        photographerCount={multiAlbumItems.length}
        currencySym={sym(cartItems[0]?.buyerCurrency)}
        total={cartTotal}
        onSuccess={onPaymentSuccess}
      />

      {/* Purchase success → downloads */}
      <Modal visible={!!purchased} transparent animationType="slide" onRequestClose={() => setPurchased(null)}>
        <View style={styles.successContainer}>
          <View style={[styles.successCard, { marginTop: insets.top + 20, marginBottom: insets.bottom + 20 }]}>
            <View style={styles.successHead}>
              <Ionicons name="checkmark-circle" size={28} color="#10B981" />
              <Text style={styles.successTitle}>Purchase complete</Text>
              <Pressable onPress={() => setPurchased(null)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            {unlockCode ? (
              <Text style={styles.unlockCode}>Unlock code: {unlockCode}</Text>
            ) : null}
            <Text style={styles.sheetHint}>Tap a photo to download the full-resolution file.</Text>
            <FlatList
              data={purchased ?? []}
              keyExtractor={(it) => it.imageId}
              numColumns={3}
              contentContainerStyle={{ gap: 6, paddingVertical: 12 }}
              columnWrapperStyle={{ gap: 6 }}
              renderItem={({ item }) => (
                <Pressable style={styles.successThumb} onPress={() => downloadPhoto(item)}>
                  <Image source={{ uri: item.fileUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                  <View style={styles.successThumbOverlay}>
                    <Ionicons name="download" size={18} color="#fff" />
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Report a photo (flag button in the lightbox). */}
      <ReportSheet
        visible={!!reporting}
        onClose={() => setReporting(null)}
        targetType="PHOTO"
        subject={reporting?.title || reporting?.photographerName}
        submit={submitPhotoReport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#052047' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  cartToggle: {
    position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  cartToggleOn: { backgroundColor: '#F20C8F', borderColor: '#F20C8F' },
  cardFooter: { position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardTitle: { color: '#FFF', fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  cardPrice: { color: '#FFF', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  watermark: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  watermarkText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: 'rgba(255,255,255,0.7)', marginTop: 16, fontSize: 15 },

  cartBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.lg, paddingTop: 12,
    backgroundColor: 'rgba(5,32,71,0.96)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)',
  },
  cartBarCount: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cartBarTotal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cartBarBtn: { backgroundColor: '#F20C8F', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  cartBarBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  lightboxContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  lightboxContent: { flex: 1 },
  lightboxHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, zIndex: 10 },
  closeButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  lightboxImageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxWatermarkBand: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, paddingHorizontal: 100, transform: [{ rotate: '-45deg' }], borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  lightboxWatermarkText: { color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  lightboxFooter: { padding: spacing.xl },
  lightboxTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  lightboxPhotographer: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 20 },
  lightboxActions: { flexDirection: 'row', gap: 10 },
  lbBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12 },
  lbBtnGhost: { backgroundColor: 'rgba(255,255,255,0.12)' },
  lbBtnPrimary: { backgroundColor: '#F20C8F' },
  lbBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  sheetHint: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 19 },

  successContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  successCard: { backgroundColor: '#0B2A57', borderRadius: 20, padding: spacing.xl, maxHeight: '80%' },
  successHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  successTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800' },
  unlockCode: { color: '#FBBF24', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  successThumb: { flex: 1, maxWidth: '32%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)' },
  successThumbOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
});
