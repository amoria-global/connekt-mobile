/**
 * Asks for the price per photo and its currency before an event album goes live on Find My Photos, as the dashboard does:
 * an event album has no price of its own until it is published, and buyers cannot pay for a photo with none.
 */
import { CurrencyLabel } from '@/features/currency/CurrencyFlag';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { useAsync } from '@/hooks/useAsync';
import { listCurrencies } from '@/features/reference/api';
import { compactSheet, fontSize, fontWeight, lightPalette, onFill, radii, spacing, useTheme } from '@/theme';

/** The price is valid when it is a whole number of at least 1 and a currency is chosen. */
export function validPublishPrice(price: string, currencyId: string): boolean {
  return /^[0-9]+$/.test(price) && parseInt(price, 10) >= 1 && !!currencyId;
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
  const [picked, setPicked] = useState('');
  // Default to RWF, or the first currency, like the create screen.
  const list = currencies.data ?? [];
  const currencyId = picked || (list.find((c) => c.code === 'RWF') ?? list[0])?.id || '';

  const ok = validPublishPrice(price, currencyId);

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
          <Text style={[styles.label, { color: colors.textMuted }]}>PRICE PER IMAGE</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.stroke, backgroundColor: colors.surface }]}
            value={price}
            onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))}
            placeholder="Enter price per photo"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            accessibilityLabel="Price per image"
          />
          <Text style={[styles.label, { color: colors.textMuted }]}>CURRENCY</Text>
          {currencies.loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.chips}>
              {(currencies.data ?? []).map((c) => {
                const active = currencyId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setPicked(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, { borderColor: active ? lightPalette.primary : colors.stroke, backgroundColor: active ? lightPalette.primary : 'transparent' }]}
                  >
                    <CurrencyLabel code={c.code} textStyle={{ color: active ? onFill : colors.text, fontWeight: fontWeight.bold, fontSize: fontSize.sm }} />
                  </Pressable>
                );
              })}
            </View>
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
