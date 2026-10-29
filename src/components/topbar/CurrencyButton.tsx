import { useState } from 'react';
import { CurrencyFlag } from '@/features/currency/CurrencyFlag';
import { Image } from 'expo-image';
import { Pressable, Text } from 'react-native';
import { CurrencySelectorSheet } from '@/components/CurrencySelectorSheet';
import { useCurrency } from '@/store/currency';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing } from '@/theme';


/**
 * Display-currency selector button. A compact flag + code chip opens the
 * CurrencySelectorSheet listing all available currencies.
 */
export function CurrencyButton({ compact, bar, inPill }: { compact?: boolean; bar?: boolean; inPill?: boolean } = {}) {
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
          inPill ? styles.half : styles.chip,
          !inPill && compact && styles.chipCompact,
          !inPill && bar && styles.chipBar,
          pressed && styles.pressed,
        ]}
      >
        {current && !inPill ? <CurrencyFlag code={current.code} width={18} /> : null}
        <Text style={[styles.code, inPill && styles.codePill]}>{currency}</Text>
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
  /** One half of the top bar's "RWF · EN" glass pill. */
  half: { minHeight: 44, minWidth: 40, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  codePill: { fontFamily: fonts.semibold, fontSize: 13, fontWeight: undefined, letterSpacing: 0.4 },
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
