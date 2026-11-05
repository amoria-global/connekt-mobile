/**
 * Asks for the price per photo and its currency before an event album goes live on Find My Photos, as the dashboard does:
 * an event album has no price of its own until it is published, and buyers cannot pay for a photo with none.
 */
import { MoneyInput, useMoneyCurrency } from '@/components/ui/MoneyInput';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { useAsync } from '@/hooks/useAsync';
import { listCurrencies } from '@/features/reference/api';
import type { PaymentLimit } from '@/features/payments/paymentLimits';
import { priceOk, usePaymentLimit } from '@/features/payments/paymentLimits';
import { compactSheet, fontSize, fontWeight, lightPalette, onFill, radii, spacing, useTheme } from '@/theme';

/** The price is valid when it is a positive amount and a currency is chosen. The minimum is judged per currency. */
export function validPublishPrice(price: string, currencyId: string, limit: PaymentLimit | null = null, code?: string): boolean {
  return !!currencyId && priceOk(price, code, limit);
}

export function PublishPriceSheet({
  visible,
  onClose,
  onPublish,
  title,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  onPublish: (price: string, currencyId: string) => void;
  title: string;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currencies = useAsync(useCallback(() => listCurrencies(), []));
  const [price, setPrice] = useState('');
  // The last currency this device used, else the account's own, chosen inside the price field.
  const list = currencies.data ?? [];
  const [currencyId, setCurrencyId] = useMoneyCurrency(currencies.data);

  const code = list.find((c) => c.id === currencyId)?.code;
  const limit = usePaymentLimit(code);
  const ok = validPublishPrice(price, currencyId, limit, code);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GlassScrim onPress={onClose} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <GlassSheetHost style={[styles.sheet, { backgroundColor: colors.elevated, paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">Set a price to publish</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={2}>{title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Attendees find their photos with a selfie and pay this much for each one they download.
          </Text>
          {currencies.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <MoneyInput
              label="PRICE PER IMAGE"
              value={price}
              onChangeText={setPrice}
              currencyId={currencyId}
              onCurrencyChange={setCurrencyId}
              currencies={list}
              placeholder="Enter price per photo"
              disabled={busy}
              testID="publish-price"
            />
          )}
          <Pressable
            onPress={() => onPublish(price, currencyId)}
            disabled={!ok || busy}
            style={[styles.btn, { backgroundColor: lightPalette.primary, opacity: !ok || busy ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Publish to Find My Photos"
          >
            <Ionicons name="scan-outline" size={18} color={onFill} />
            <Text style={styles.btnText}>{busy ? 'Publishing…' : 'Publish to Find My Photos'}</Text>
          </Pressable>
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

const styles = compactSheet({
  sheet: { padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sub: { fontSize: fontSize.sm },
  label: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.8, marginTop: spacing.xs },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: fontSize.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 36, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  btnText: { color: onFill, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
