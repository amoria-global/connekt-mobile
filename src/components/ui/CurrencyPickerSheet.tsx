import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { CurrencyFlag } from '@/features/currency/CurrencyFlag';
import { flagCountryFor } from '@/features/currency/flagCountry';
import { filterCurrencies, sortAtoZ, type PickerCurrency } from '@/features/money/moneyLogic';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

/** A country's English name from its two-letter code, where the runtime can say it. Used only for searching. */
function countryNameFor(code: string): string | undefined {
  const cc = flagCountryFor(code);
  if (!cc) return undefined;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc.toUpperCase());
  } catch {
    return undefined;
  }
}

/**
 * The currency list for a MoneyInput: search by code, name or country, a "Suggested" section, then every currency A to
 * Z with a check on the selected one. Only the currencies it is given are shown (the server decides which).
 */
export function CurrencyPickerSheet({
  visible,
  onClose,
  currencies,
  suggested,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currencies: PickerCurrency[];
  /** Codes for the Suggested section, in order. Hidden while searching. */
  suggested: string[];
  selectedId: string;
  onSelect: (currency: PickerCurrency) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const sorted = useMemo(() => sortAtoZ(currencies), [currencies]);
  const matches = useMemo(() => filterCurrencies(sorted, query, countryNameFor), [sorted, query]);
  const suggestedList = useMemo(
    () => suggested.map((code) => sorted.find((c) => c.code === code)).filter((c): c is PickerCurrency => !!c),
    [suggested, sorted],
  );
  const searching = query.trim().length > 0;

  const close = () => {
    setQuery('');
    onClose();
  };
  const pick = (c: PickerCurrency) => {
    setQuery('');
    onSelect(c);
  };

  const row = (c: PickerCurrency, note?: string) => {
    const selected = c.id === selectedId;
    return (
      <Pressable
        key={`${note ?? 'all'}-${c.id}`}
        onPress={() => pick(c)}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${c.code}`}
        accessibilityState={{ selected }}
        style={[styles.row, selected && styles.rowSelected]}
      >
        <CurrencyFlag code={c.code} width={26} />
        <Text style={styles.code}>{c.code}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {c.name}
          {note ? ` · ${note}` : ''}
        </Text>
        {selected ? <Ionicons name="checkmark" size={18} color={colors.primaryLight} /> : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} title="Choose currency" onClose={close}>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search code, name or country"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search currencies"
          returnKeyType="search"
        />
      </View>

      {!searching && suggestedList.length > 0 ? (
        <>
          <Text style={styles.section} accessibilityRole="header">SUGGESTED</Text>
          <View style={styles.group}>{suggestedList.map((c) => row(c))}</View>
        </>
      ) : null}

      <Text style={styles.section} accessibilityRole="header">{searching ? 'RESULTS' : 'ALL CURRENCIES · A–Z'}</Text>
      {matches.length === 0 ? (
        <Text style={styles.empty}>No currency matches that. Try a code like USD or a country name.</Text>
      ) : (
        <View style={styles.group}>{matches.map((c) => row(c))}</View>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.stroke,
    backgroundColor: c.well,
  },
  searchInput: { flex: 1, minHeight: 44, color: c.text, fontSize: fontSize.md, fontFamily: fonts.regular },
  section: { color: c.textMuted, fontSize: fontSize.xs, fontFamily: fonts.semibold, fontWeight: fontWeight.semibold, letterSpacing: 0.8 },
  group: { borderRadius: radii.md, borderWidth: 1, borderColor: c.stroke, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  rowSelected: { backgroundColor: c.well },
  code: { width: 44, color: c.text, fontSize: fontSize.md, fontFamily: fonts.bold, fontWeight: fontWeight.bold },
  name: { flex: 1, color: c.textMuted, fontSize: fontSize.sm, fontFamily: fonts.regular },
  empty: { color: c.textMuted, fontSize: fontSize.sm, paddingVertical: spacing.md },
}));
