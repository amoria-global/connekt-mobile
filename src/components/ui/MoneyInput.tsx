import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CurrencyPickerSheet } from '@/components/ui/CurrencyPickerSheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { CurrencyFlag } from '@/features/currency/CurrencyFlag';
import {
  approxLabel,
  defaultCurrencyCode,
  displayAmount,
  minimumLabel,
  quickPickCodes,
  rawFromInput,
  suggestedCodes,
} from '@/features/money/moneyLogic';
import { useCurrencyUsage, useRates } from '@/features/money/useMoney';
import { isWholeNumberCurrency, priceError, usePaymentLimitState } from '@/features/payments/paymentLimits';
import type { Currency } from '@/features/reference/api';
import { useCurrency } from '@/store/currency';
import { darkPalette, fonts, fontSize, fontWeight, makeStyles, radii, shadows, spacing, useTheme } from '@/theme';

/**
 * The currency a money form starts on: the last one this device used, else the account's own currency, else RWF.
 * Returns the id and its setter, so a form keeps the same `currencyId` state it had before.
 */
export function useMoneyCurrency(currencies: Currency[] | null | undefined, initialId?: string): [string, (id: string) => void] {
  const usage = useCurrencyUsage((s) => s.usage);
  const loadUsage = useCurrencyUsage((s) => s.load);
  const accountCode = useCurrency((s) => s.currency);
  const [picked, setPicked] = useState(initialId ?? '');
  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);
  const list = currencies ?? [];
  const fallback = useMemo(() => {
    const code = defaultCurrencyCode(list.map((c) => c.code), usage, accountCode);
    return list.find((c) => c.code === code)?.id ?? '';
  }, [list, usage, accountCode]);
  return [picked || fallback, setPicked];
}

/**
 * Price and currency as ONE field: the currency is a button inside the field, the amount sits beside it, and the
 * minimum and conversion show right under the number so the error is prevented rather than reported.
 *
 * The amount is held as plain digits ("1234.5", never "1,234.5"); thousands separators are display only, so the value a
 * form sends is the same amount and currency code it always sent. The server still judges every price on submit.
 */
export function MoneyInput({
  label,
  required,
  value,
  onChangeText,
  currencyId,
  onCurrencyChange,
  currencies,
  placeholder = '0',
  disabled,
  showQuickPick = true,
  showLimits = true,
  error: formError,
  onFocus,
  wholeNumbersOnly,
  testID,
}: {
  label: string;
  required?: boolean;
  /** The amount as plain digits and at most one decimal point. */
  value: string;
  onChangeText: (raw: string) => void;
  currencyId: string;
  onCurrencyChange: (id: string) => void;
  /** The currencies the server lists for this context. Never hardcoded in the client. */
  currencies: Currency[];
  placeholder?: string;
  disabled?: boolean;
  showQuickPick?: boolean;
  /**
   * Show the minimum, the below-minimum error and the old-rate note. Turn off where the server does not hold the price
   * to the listing minimum (packages, donations, withdrawals), so the field never promises a rule nothing enforces.
   */
  showLimits?: boolean;
  /** An error from the form itself (a required field, say), shown when the amount has no error of its own. */
  error?: string;
  onFocus?: () => void;
  /** Force whole numbers whatever the currency (a flow that only ever handles whole amounts, like donations). */
  wholeNumbersOnly?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const usage = useCurrencyUsage((s) => s.usage);
  const loadUsage = useCurrencyUsage((s) => s.load);
  const recordUse = useCurrencyUsage((s) => s.record);
  const accountCode = useCurrency((s) => s.currency);
  const rates = useRates();
  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const selected = currencies.find((c) => c.id === currencyId);
  const code = selected?.code;
  const { limit, loading } = usePaymentLimitState(code);
  const whole = wholeNumbersOnly ?? (limit ? limit.wholeNumbersOnly : isWholeNumberCurrency(code));

  const error = (showLimits ? priceError(value, code, limit) : null) ?? formError ?? null;
  const minimum = showLimits ? minimumLabel(limit) : null;
  const approx = approxLabel(value, code, accountCode, rates);
  const codes = useMemo(() => currencies.map((c) => c.code), [currencies]);
  const quick = useMemo(() => quickPickCodes(codes, usage, accountCode, code), [codes, usage, accountCode, code]);
  const suggested = useMemo(() => suggestedCodes(codes, usage, accountCode), [codes, usage, accountCode]);

  const choose = (c: Currency) => {
    if (c.id !== currencyId) {
      recordUse(c.code);
      onCurrencyChange(c.id);
      // The amount is kept; only digits a zero-decimal currency cannot carry are dropped.
      if (value) onChangeText(rawFromInput(value, c.code));
    }
    setPickerOpen(false);
  };

  const helperId = error ?? minimum ?? '';
  const borderColor = error ? colors.error : focused ? colors.primaryLight : colors.stroke;

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>

      <View style={[styles.field, { borderColor }, disabled && styles.disabled]}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
          hitSlop={{ top: 4, bottom: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Currency, ${selected?.name ?? 'none chosen'}, change`}
          accessibilityState={{ disabled: !!disabled }}
          style={styles.currencyBtn}
          testID={testID ? `${testID}-currency` : undefined}
        >
          <CurrencyFlag code={code} width={22} />
          <Text style={styles.currencyCode}>{code ?? 'Pick'}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={displayAmount(value)}
          onChangeText={(t) => onChangeText(rawFromInput(t, code, whole))}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={whole ? 'number-pad' : 'decimal-pad'}
          editable={!disabled}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => setFocused(false)}
          style={styles.amount}
          accessibilityLabel={label}
          accessibilityHint={helperId}
          testID={testID ? `${testID}-amount` : undefined}
        />
      </View>

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <View style={styles.helperRow}>
          {showLimits && loading ? (
            <Skeleton width={140} height={12} />
          ) : (
            <Text style={styles.helper} testID={testID ? `${testID}-minimum` : undefined}>
              {minimum ?? ''}
            </Text>
          )}
          {approx ? <Text style={styles.helperRight}>{approx}</Text> : null}
        </View>
      )}

      {showLimits && limit?.rateStale ? (
        <View style={styles.stale} accessibilityRole="text">
          <Ionicons name="time-outline" size={14} color={colors.pending} />
          <Text style={styles.staleText}>The exchange rate is more than 24 hours old, so the minimum and the conversion may be slightly off.</Text>
        </View>
      ) : null}

      {showQuickPick && currencies.length > 1 ? (
        <View style={styles.quickRow}>
          <Text style={styles.quickLabel}>QUICK PICK</Text>
          <View style={styles.chips}>
            {quick.map((q) => {
              const c = currencies.find((x) => x.code === q);
              if (!c) return null;
              const active = c.id === currencyId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => choose(c)}
                  disabled={disabled}
                  hitSlop={{ top: 6, bottom: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${c.name}`}
                  accessibilityState={{ selected: active }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <CurrencyFlag code={c.code} width={18} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.code}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={disabled}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel="More currencies"
              style={styles.chip}
            >
              <Text style={styles.chipText}>More...</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <CurrencyPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currencies={currencies}
        suggested={suggested}
        selectedId={currencyId}
        onSelect={(c) => {
          const full = currencies.find((x) => x.id === c.id);
          if (full) choose(full);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.xs, fontFamily: fonts.semibold, fontWeight: fontWeight.semibold, color: c.textSoft, letterSpacing: 0.8 },
  // One border and one focus ring around both halves, like the inset field it replaces.
  field: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radii.md,
    backgroundColor: c.well,
    overflow: 'hidden',
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
  },
  disabled: { opacity: 0.6 },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 96,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRightWidth: 1,
    borderRightColor: c.borderSoft,
  },
  currencyCode: { color: c.text, fontSize: fontSize.md, fontFamily: fonts.bold, fontWeight: fontWeight.bold },
  amount: { flex: 1, minHeight: 52, paddingHorizontal: spacing.lg, color: c.text, fontSize: fontSize.lg, fontFamily: fonts.display },
  helperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, minHeight: 16 },
  helper: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.regular, flexShrink: 1 },
  helperRight: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.medium },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  error: { flex: 1, color: c.error, fontSize: fontSize.xs, fontFamily: fonts.medium },
  stale: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.warningLine,
    backgroundColor: c.pendingBg,
  },
  staleText: { flex: 1, color: c.pending, fontSize: fontSize.xs, fontFamily: fonts.regular },
  quickRow: { gap: spacing.xs, marginTop: spacing.xs },
  quickLabel: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.semibold, letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.stroke,
  },
  chipActive: { borderColor: c.primaryLight, backgroundColor: c.well },
  chipText: { color: c.textSoft, fontSize: fontSize.sm, fontFamily: fonts.semibold },
  chipTextActive: { color: c.text },
}));
