/**
 * Photo checkout sheet — web-checkout handoff.
 *
 * The app no longer collects buyer details or payment methods for photo
 * purchases. The sheet keeps the cart summary (photo count, photographer
 * count, total) and offers a single (policy-gated) "Complete purchase on
 * connekyt.com" button that opens the public browse-photos page, where
 * the full checkout (email, method, gateway) happens.
 *
 * The cart items only carry gallery ids (no public gallery slug), so the
 * redirect lands on the marketplace root rather than a specific gallery's
 * checkout — see browsePhotosUrl().
 *
 * The `onSuccess` prop is kept for API compatibility with callers, but the
 * app can no longer observe the purchase settle (it completes on the web),
 * so it is never called; buyers re-download via their emailed unlock code.
 */
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { browsePhotosUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { type MultiAlbumPurchaseItem } from '@/features/photos/api';

export function PhotoCheckoutSheet({
  visible,
  onClose,
  items,
  photoCount,
  photographerCount,
  currencySym,
  total,
}: {
  visible: boolean;
  onClose: () => void;
  items: MultiAlbumPurchaseItem[];
  photoCount: number;
  photographerCount: number;
  currencySym: string;
  total: number;
  /** Legacy callback from the in-app payment flow — no longer invoked. */
  onSuccess?: (refid: string, unlockCode: string | null) => void;
}) {
  const insets = useSafeAreaInsets();

  const onCompleteOnWeb = () => {
    // Callers don't open this sheet on Android, but the purchase path is
    // gated here too so no future caller can reintroduce a digital-goods
    // purchase (or a steering link) there.
    if (!digitalPurchasesEnabled) return;
    void openWebCheckout(browsePhotosUrl());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>Checkout</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          {/* Amount summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>TOTAL</Text>
            <Text style={styles.summaryAmount}>
              {currencySym}
              {total.toFixed(2)}
            </Text>
            <Text style={styles.summarySub}>
              {photoCount} photo{photoCount === 1 ? '' : 's'} from {photographerCount} photographer
              {photographerCount === 1 ? '' : 's'}
            </Text>
          </View>

          {digitalPurchasesEnabled ? (
            <>
              <View style={styles.notice}>
                <Ionicons name="information-circle" size={16} color="#93C5FD" />
                <Text style={styles.noticeText}>
                  Payment is completed securely on connekyt.com. Your receipt and an
                  unlock code to re-download anytime are emailed to you.
                </Text>
              </View>

              <Pressable
                style={[styles.payBtn, items.length === 0 && styles.payBtnDisabled]}
                onPress={onCompleteOnWeb}
                disabled={items.length === 0}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={styles.payBtnText}>Complete purchase on connekyt.com</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B2A57',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },

  summary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    gap: 2,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryAmount: { color: '#fff', fontSize: 28, fontWeight: '800' },
  summarySub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(147,197,253,0.4)',
  },
  noticeText: { flex: 1, color: '#BFDBFE', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F20C8F',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  payBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.10)' },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
