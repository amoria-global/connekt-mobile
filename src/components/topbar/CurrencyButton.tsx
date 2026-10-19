import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text } from 'react-native';
import { CurrencySelectorSheet } from '@/components/CurrencySelectorSheet';
import { useCurrency } from '@/store/currency';
import { fontSize, fontWeight, makeStyles, radii, spacing } from '@/theme';

const flagUri = (flag: string) => `https://flagcdn.com/w40/${flag}.png`;

/**
 * Display-currency selector button. A compact flag + code chip opens the
 * CurrencySelectorSheet listing all available currencies.
 */
export function CurrencyButton({ compact, bar }: { compact?: boolean; bar?: boolean } = {}) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const currency = useCurrency((s) => s.currency);
  const currencies = useCurrency((s) => s.currencies);
  const current = currencies.find((c) => c.code === currency);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Display currency ${currency}. Change currency`}
        style={({ pressed }) => [
          styles.chip,
          compact && styles.chipCompact,
          bar && styles.chipBar,
          pressed && styles.pressed,
        ]}
      >
        {current ? (
          <Image
            source={{ uri: flagUri(current.flag) }}
            style={styles.flag}
            contentFit="cover"
          />
        ) : null}
        <Text style={styles.code}>{currency}</Text>
      </Pressable>

      <CurrencySelectorSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  chip: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: spacing.xs + 4,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    ...e(2),
  },
  chipCompact: {
    height: 34,
    minWidth: 34,
    paddingHorizontal: spacing.xs + 2,
  },
  chipBar: {
    height: 40,
    minWidth: 40,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  flag: {
    width: 16,
    height: 12,
    borderRadius: 2,
  },
  code: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
}));
