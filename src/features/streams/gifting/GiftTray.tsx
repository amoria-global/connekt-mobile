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
import { CurrencyLabel } from '@/features/currency/CurrencyFlag';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGiftCatalog, type GiftCatalogItem } from '@/features/streams/api';
import { useCurrency } from '@/store/currency';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, useTheme, makeStyles, darkPalette } from '@/theme';
import { formatGiftUsd, formatGiftUsdBase } from './GiftOverlay';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';
import { glassTile } from '@/components/ui/GlassCard';

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
  const s = useS();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<Tier>('POPULAR');
  const [selected, setSelected] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState<string | null>(null);

  const [gifts, setGifts] = useState<GiftCatalogItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One display currency for the whole app (the top-bar selector). The pills
  // here set that same selection, so the tile, the confirm sheet, the checkout
  // sheet, the banners and the chat all show one currency. Charging is always
  // the exact USD catalog price, so the USD line stays visible when converted.
  const currency = useCurrency((st) => st.currency);
  const currencies = useCurrency((st) => st.currencies);
  const setCurrency = useCurrency((st) => st.setCurrency);
  const converted = currency !== 'USD';

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
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <GlassSheetHost style={[s.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <SheetCornerClose onPress={onClose} />
        <View style={s.grab} />
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>Send a gift</Text>
          <Text style={s.sheetHint}>Paid securely in the app</Text>
        </View>

        {/* "View in" currency pills — display-only conversion, mirrors the
            web gift modal's currency switcher. Only currencies with a
            usable rate are offered (USD always). */}
        <View style={s.viewRow}>
          <Text style={s.viewLabel}>View in</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.viewPills}>
            {currencies.map((ci) => ci.code).map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === c }}
                accessibilityLabel={`View prices in ${c}`}
                onPress={() => setCurrency(c)}
                style={[s.viewPill, currency === c && s.viewPillOn]}
                hitSlop={6}
              >
                <CurrencyLabel code={c} width={16} textStyle={[s.viewPillText, currency === c && s.viewPillTextOn]} />
              </Pressable>
            ))}
          </ScrollView>
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
                ? `No ${tab === 'POPULAR' ? 'popular' : 'premium'} gifts right now. Try the other tab.`
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
                  <Text
                    style={s.tilePrice}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatGiftUsd(g.amountUsd)}
                  </Text>
                  {isSel ? (
                    // A short fixed label: the price is already on the tile, so the pill never
                    // has to fit "Send USh 7,999" and the tile keeps the same height selected or not.
                    <View style={s.tileSend}>
                      {isSending ? (
                        <ActivityIndicator size="small" color={colors.textOnPrimary} />
                      ) : (
                        <Text style={s.tileSendText} numberOfLines={1} allowFontScaling={false}>
                          Send
                        </Text>
                      )}
                    </View>
                  ) : converted ? (
                    <Text style={s.tileLocal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {formatGiftUsdBase(g.amountUsd)} USD
                    </Text>
                  ) : (
                    <View style={s.tileSpacer} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

// Glass sheet over the live video, in the app's shared glass look; every colour is a theme token so it reads in light and dark.
const useS = makeStyles((c) => ({
  scrim: { flex: 1 },
  sheet: {},
  grab: {
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.border,
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
  sheetTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
  sheetHint: { color: c.textMuted, fontSize: fontSize.xs },

  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  viewLabel: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  viewPills: { flexDirection: 'row', gap: spacing.xs },
  viewPill: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    ...glassTile(c),
    borderWidth: 1,
  },
  viewPillOn: {
    backgroundColor: 'rgba(242,12,143,0.16)',
    borderColor: 'rgba(242,12,143,0.55)',
  },
  viewPillText: { color: c.textSoft, fontSize: 11, fontWeight: fontWeight.bold },
  viewPillTextOn: { color: c.text },

  tabs: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  tab: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.lg, borderRadius: radii.full },
  tabOn: {
    backgroundColor: 'rgba(242,12,143,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.55)',
  },
  tabText: { color: c.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  tabTextOn: { color: c.text },

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
    ...glassTile(c),
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    minHeight: 118,
    borderWidth: 1,
  },
  tileSel: { borderColor: c.accent, backgroundColor: 'rgba(242,12,143,0.14)' },
  tileEmoji: { fontSize: 30, lineHeight: 34 },
  tileName: { color: c.textSoft, fontSize: 11, fontWeight: fontWeight.semibold, alignSelf: 'stretch', textAlign: 'center' },
  tilePrice: { color: c === darkPalette ? darkPalette.pending : c.pending, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold, alignSelf: 'stretch', textAlign: 'center' },
  tileLocal: { color: c.textMuted, fontSize: 9, fontWeight: fontWeight.semibold, alignSelf: 'stretch', textAlign: 'center' },
  tileSend: {
    backgroundColor: c.accent,
    borderRadius: radii.full,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 2,
    height: 26,
    justifyContent: 'center',
  },
  tileSendText: { color: c.textOnPrimary, fontSize: 12, fontWeight: fontWeight.extrabold, textAlign: 'center' },
  tileSpacer: { height: 26, marginTop: 2 },

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
    color: c.textSoft,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing.xs,
    backgroundColor: c.accent,
    borderRadius: radii.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    minHeight: 40,
    justifyContent: 'center',
  },
  retryText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
}));
