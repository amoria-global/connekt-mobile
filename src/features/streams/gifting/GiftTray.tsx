/**
 * GiftTray — catalog-driven gift picker bottom sheet (TikTok-style).
 *
 * Phase-2 integration of `src/_design-sandbox/LiveGifting.preview.tsx`,
 * preserving its visual design: dark-glass sheet, Popular/Premium tabs,
 * price-on-tile grid, and the two-tap arm-then-send interaction
 * (first tap selects, second tap on the pink "Send $X" pill sends).
 *
 * The mock catalog is swapped for GET /public/gift-catalog
 * (getGiftCatalog, skipAuth) with designed loading / error / empty states.
 *
 * NO payment happens here. Sending hands the chosen gift to `onSendGift`
 * and the host screen decides what that means — on mobile it opens the
 * web checkout with the gift preselected (liveGiftUrl(..., gift.code)).
 * The button that opens this tray is policy-gated (digitalPurchasesEnabled),
 * so the tray itself never appears on Android.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGiftCatalog, type GiftCatalogItem } from '@/features/streams/api';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatGiftUsd } from './GiftOverlay';

type Tier = 'POPULAR' | 'PREMIUM';

export function GiftTray({
  visible,
  onClose,
  onSendGift,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called with the chosen gift; the host screen decides the handoff. */
  onSendGift: (gift: GiftCatalogItem) => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<Tier>('POPULAR');
  const [selected, setSelected] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState<string | null>(null);

  const [gifts, setGifts] = useState<GiftCatalogItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await getGiftCatalog();
      setGifts(catalog.gifts);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load gifts. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on first open; the catalog is stable enough to cache for the
  // session. Retry after an error re-runs the fetch explicitly.
  useEffect(() => {
    if (visible && gifts === null && !loading && !error) void load();
  }, [visible, gifts, loading, error, load]);

  // Re-arm cleanly every time the sheet reopens.
  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setSendingCode(null);
    }
  }, [visible]);

  const tileW = (Math.min(width, 460) - spacing.lg * 2 - spacing.sm * 3) / 4;
  const inTab = (gifts ?? []).filter((g) => g.tier === tab);

  const handlePress = async (g: GiftCatalogItem) => {
    if (selected !== g.code) {
      setSelected(g.code);
      return;
    }
    if (sendingCode) return; // a send is already in flight
    setSendingCode(g.code);
    try {
      await onSendGift(g);
    } finally {
      setSendingCode(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={s.scrim}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close gift tray"
      />
      <View style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={s.grab} />
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>Send a gift</Text>
          <Text style={s.sheetHint}>Paid securely on connekyt.com</Text>
        </View>

        <View style={s.tabs}>
          {(['POPULAR', 'PREMIUM'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[s.tab, tab === t && s.tabOn]}
              hitSlop={4}
            >
              <Text style={[s.tabText, tab === t && s.tabTextOn]}>
                {t === 'POPULAR' ? 'Popular' : 'Premium'}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={s.stateBox}>
            <ActivityIndicator color={colors.accent} />
            <Text style={s.stateText}>Loading gifts…</Text>
          </View>
        ) : error ? (
          <View style={s.stateBox}>
            <Text style={s.stateEmoji}>😕</Text>
            <Text style={s.stateText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading gifts"
            >
              <Text style={s.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : inTab.length === 0 ? (
          <View style={s.stateBox}>
            <Text style={s.stateEmoji}>🎁</Text>
            <Text style={s.stateText}>
              {gifts && gifts.length > 0
                ? `No ${tab === 'POPULAR' ? 'popular' : 'premium'} gifts right now — try the other tab.`
                : 'No gifts available right now. Please check back soon.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={s.grid}>
            {inTab.map((g) => {
              const isSel = selected === g.code;
              const isSending = sendingCode === g.code;
              return (
                <Pressable
                  key={g.code}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name}, ${formatGiftUsd(g.amountUsd)}`}
                  accessibilityHint={isSel ? 'Tap again to send this gift' : 'Tap to select this gift'}
                  onPress={() => void handlePress(g)}
                  style={({ pressed }) => [
                    s.tile,
                    { width: tileW },
                    isSel && s.tileSel,
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <Text style={[s.tileEmoji, isSel && { transform: [{ scale: 1.2 }] }]}>
                    {g.emoji}
                  </Text>
                  <Text style={s.tileName} numberOfLines={1}>
                    {g.name}
                  </Text>
                  {isSel ? (
                    <View style={s.tileSend}>
                      {isSending ? (
                        <ActivityIndicator size="small" color={colors.textOnPrimary} />
                      ) : (
                        <Text style={s.tileSendText}>Send {formatGiftUsd(g.amountUsd)}</Text>
                      )}
                    </View>
                  ) : (
                    <Text style={s.tilePrice}>{formatGiftUsd(g.amountUsd)}</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// Dark-glass sheet over the live video — fixed dark surface by design
// (matches the live screens), not a light/dark theme surface.
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: 'rgba(18,21,30,0.98)',
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  grab: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sheetTitle: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
  sheetHint: { color: 'rgba(255,255,255,0.55)', fontSize: fontSize.xs },

  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  tab: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.lg, borderRadius: radii.full },
  tabOn: {
    backgroundColor: 'rgba(242,12,143,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.55)',
  },
  tabText: { color: 'rgba(255,255,255,0.65)', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  tabTextOn: { color: colors.textOnPrimary },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tile: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tileSel: { borderColor: colors.accent, backgroundColor: 'rgba(242,12,143,0.14)' },
  tileEmoji: { fontSize: 30, lineHeight: 34 },
  tileName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: fontWeight.semibold },
  tilePrice: { color: '#ffd166', fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  tileSend: {
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 5,
    marginTop: 2,
    minHeight: 24,
    justifyContent: 'center',
  },
  tileSendText: { color: colors.textOnPrimary, fontSize: 11, fontWeight: fontWeight.extrabold },

  stateBox: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  stateEmoji: { fontSize: 30 },
  stateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    minHeight: 40,
    justifyContent: 'center',
  },
  retryText: { color: colors.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
});
