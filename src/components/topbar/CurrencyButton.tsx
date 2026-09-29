import { useState } from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '@/store/currency';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const flagUri = (flag: string) => `https://flagcdn.com/w40/${flag}.png`;

/**
 * Display-currency selector, the mobile twin of the web topbar's currency
 * dropdown. A compact flag + code chip opens a bottom sheet listing the
 * currencies; the choice is persisted and re-prices every converted amount.
 */
export function CurrencyButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const currency = useCurrency((s) => s.currency);
  const currencies = useCurrency((s) => s.currencies);
  const setCurrency = useCurrency((s) => s.setCurrency);
  const current = currencies.find((c) => c.code === currency);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Display currency ${currency}. Change currency`}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        {current ? <Image source={{ uri: flagUri(current.flag) }} style={styles.flag} contentFit="cover" /> : null}
        <Text style={styles.code}>{currency}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close currency list"
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.md }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Display currency</Text>
          <Text style={styles.hint}>Amounts are shown converted to this currency.</Text>
          {currencies.map((c) => {
            const selected = c.code === currency;
            return (
              <Pressable
                key={c.code}
                onPress={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${c.code}, ${c.name}`}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <Image source={{ uri: flagUri(c.flag) }} style={styles.rowFlag} contentFit="cover" />
                <Text style={styles.rowCode}>{c.code}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
                {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  chip: {
    height: 46,
    minWidth: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...e(2),
  },
  pressed: { opacity: 0.85 },
  flag: { width: 18, height: 13, borderRadius: 2 },
  code: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.text },
  backdrop: { flex: 1, backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.border,
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  hint: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 2, marginBottom: spacing.md },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowSelected: { backgroundColor: c.tint },
  rowFlag: { width: 24, height: 18, borderRadius: 3 },
  rowCode: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text, width: 44 },
  rowName: { flex: 1, fontSize: fontSize.sm, color: c.textSoft },
}));
