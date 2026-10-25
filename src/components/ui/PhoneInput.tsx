/**
 * PhoneInput — international phone field (integrated from
 * src/_design-sandbox/PhoneInput.preview.tsx, wired to @/lib/phoneKit).
 *
 * Layout: [emoji-flag + dial code button][tel input "+250 788 123 456"] with
 * a live ✓/✕ state icon, a hint line underneath, and a searchable
 * bottom-sheet country picker.
 *
 * Behavior:
 *  - The dial code LIVES IN the editable value. Deleting or retyping it
 *    re-detects the country via matchDialCode (longest-prefix).
 *  - Picking from the sheet keeps the national digits already typed.
 *  - Trunk '0' is stripped ("+250 0788…" → nsn "788…").
 *  - Flags are emoji derived from ISO2 regional-indicator codepoints —
 *    no remote images.
 *
 * Emits `PhoneValue` on every change (including mount). Submit
 * `value.digits` (dial + nsn, no '+') — the backend wire format for every
 * phone field.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FALLBACK_NSN_MAX,
  PHONE_COUNTRIES,
  type PhoneCountry,
  formatInternational,
  formatNsn,
  getPlaceholderForCountry,
  matchDialCode,
  nsnMaxLen,
  onlyDigits,
  phoneCountryFor,
  validateNsn,
} from '@/lib/phoneKit';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme , type Palette as ThemePalette, onFill } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { glassTile } from './GlassCard';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

/** Emitted on every change. `digits` is the backend wire format. */
export interface PhoneValue {
  /** ISO2 country code ('' while the typed prefix is unknown). */
  iso2: string;
  /** Dial code, digits only ('' while unknown). */
  dial: string;
  /** National significant number (trunk 0 removed). */
  nsn: string;
  /** "+250788123456" ('' until a country and digits exist). */
  e164: string;
  /** "250788123456" — dial + nsn, no '+' (submit this to the backend). */
  digits: string;
  /** "0788123456" — trunk-prefixed national form. */
  national0: string;
  isValid: boolean;
}

/** 🇷🇼 from "RW" via regional-indicator codepoints — no remote images. */
export function flagEmoji(iso2: string | null | undefined): string {
  if (!iso2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🌐';
  const up = iso2.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + up.charCodeAt(0) - 65,
    0x1f1e6 + up.charCodeAt(1) - 65,
  );
}

function buildValue(country: PhoneCountry | null, nsn: string): PhoneValue {
  if (!country) {
    return { iso2: '', dial: '', nsn, e164: '', digits: nsn, national0: nsn, isValid: false };
  }
  const { isValid } = validateNsn(country, nsn);
  return {
    iso2: country.iso2,
    dial: country.dial,
    nsn,
    e164: nsn ? `+${country.dial}${nsn}` : '',
    digits: nsn ? `${country.dial}${nsn}` : '',
    national0: nsn ? `${country.trunkPrefix ?? ''}${nsn}` : '',
    isValid,
  };
}

// ── Variant palettes (from the sandbox) ─────────────────────────────────────

type Palette = {
  text: string;
  label: string;
  muted: string;
  rowBg: string;
  border: string;
  divider: string;
  focus: string;
  ok: string;
  err: string;
  sheetBg: string;
  searchBg: string;
  itemSelected: string;
  itemPressed: string;
};

/**
 * Built from the ACTIVE palette rather than the static light one, so the
 * default (non-`dark`) variant follows the system theme. `DARK` below stays
 * fixed on purpose — it is the stream-overlay/dark-sheet variant selected by
 * the `dark` prop, which is independent of the system colour scheme.
 */
const makeLight = (c: ThemePalette): Palette => ({
  text: c.text,
  label: c.textSoft,
  muted: c.textMuted,
  rowBg: c.surface,
  border: c.border,
  divider: c.borderSoft,
  focus: c.primary,
  ok: '#059669',
  err: '#DC2626',
  sheetBg: c.surface,
  searchBg: c.background,
  itemSelected: c.infoBg,
  itemPressed: '#F1F5FB',
});

/** The themed variant on a glass panel: the field frosts instead of sitting solid. */
const makeGlass = (c: ThemePalette): Palette => {
  const tile = glassTile(c);
  return { ...makeLight(c), rowBg: tile.backgroundColor, border: tile.borderColor };
};

const DARK: Palette = {
  text: onFill,
  label: 'rgba(255,255,255,0.82)',
  muted: 'rgba(255,255,255,0.55)',
  rowBg: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.22)',
  divider: 'rgba(255,255,255,0.15)',
  focus: '#5B8AD9',
  ok: '#34D399',
  err: '#F87171',
  sheetBg: '#161B28',
  searchBg: 'rgba(255,255,255,0.08)',
  itemSelected: 'rgba(8,58,133,0.5)',
  itemPressed: 'rgba(255,255,255,0.08)',
};

export type PhoneInputProps = {
  /** Country pre-selected on mount (ISO2, e.g. "RW"). Default "RW". */
  defaultIso2?: string;
  /** National digits to seed the field with (a leading trunk 0 is tolerated). */
  initialNsn?: string;
  /** Fires on every change, including once on mount with the seeded value. */
  onChange: (value: PhoneValue) => void;
  /** Dark surfaces for stream overlays / dark sheets. */
  dark?: boolean;
  /** Translucent field for a glass panel; see `Input`'s `glass`. Ignored with `dark`. */
  glass?: boolean;
  label?: string;
  /** External error (form-level validation) — overrides the built-in hint. */
  error?: string;
  placeholder?: string;
};

export function PhoneInput({
  defaultIso2 = 'RW',
  initialNsn,
  onChange,
  dark = false,
  glass = false,
  label,
  error,
  placeholder,
}: PhoneInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const ui = dark ? DARK : glass ? makeGlass(colors) : makeLight(colors);

  const [country, setCountry] = useState<PhoneCountry | null>(
    () => phoneCountryFor(defaultIso2) ?? phoneCountryFor('RW'),
  );
  const [nsn, setNsn] = useState<string>(() => {
    const c = phoneCountryFor(defaultIso2) ?? phoneCountryFor('RW');
    let d = onlyDigits(initialNsn ?? '');
    if (c?.trunkPrefix && d.startsWith(c.trunkPrefix)) d = d.slice(c.trunkPrefix.length);
    return d.slice(0, nsnMaxLen(c) + 2);
  });
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Emit on every country/nsn change (and once on mount with the seed) so
  // the parent always holds a current PhoneValue without touching the field.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current(buildValue(country, nsn));
  }, [country, nsn]);

  const validation = validateNsn(country, nsn);
  const isValid = !!country && validation.isValid;
  const maxLen = nsnMaxLen(country);
  const complete = nsn.length >= maxLen;

  /**
   * The field shows ONLY the national number — the dial code is displayed once,
   * in the flag chip beside it. This used to be `+${dial} ${nsn}`, which put the
   * code inside the editable value and rendered as "🇷🇼 +250 ⌄ | +250" on an
   * empty field. (The web component fixed the same bug; see
   * knockout/app/components/phone/InternationalPhoneInput.tsx.)
   */
  const display = country ? (nsn ? formatNsn(country, nsn) : '') : nsn;


  const handleText = (t: string) => {
    const d = onlyDigits(t);
    if (!d) {
      setNsn('');
      return;
    }

    /**
     * Now that the value carries no dial code, plain typing must NOT be read as
     * one — otherwise a leading "7" would flip the country mid-entry. Dial-code
     * matching therefore runs only when the input actually looks international:
     * it contains a '+', or it overflows the national plan. Mirrors the web
     * component's `looksInternational` guard.
     */
    const looksInternational =
      t.includes('+') || (country != null && d.length > nsnMaxLen(country) + 1);

    if (looksInternational) {
      const m = matchDialCode(d, country?.iso2 ?? defaultIso2);
      if (m) {
        let rest = d.slice(m.dial.length);
        if (m.trunkPrefix && rest.startsWith(m.trunkPrefix)) rest = rest.slice(m.trunkPrefix.length);
        setCountry(m);
        setNsn(rest.slice(0, nsnMaxLen(m) + 2));
        return;
      }
    }

    // Plain national entry. A pasted trunk prefix ("0788…") is stripped, which
    // is what users copy off a local contact card.
    let rest = d;
    if (country?.trunkPrefix && rest.startsWith(country.trunkPrefix)) {
      rest = rest.slice(country.trunkPrefix.length);
    }
    setNsn(rest.slice(0, country ? nsnMaxLen(country) + 2 : FALLBACK_NSN_MAX + 4));
  };

  const selectCountry = (c: PhoneCountry) => {
    // Keep the national digits across a country switch (trunk 0 stripped).
    let d = nsn;
    if (c.trunkPrefix && d.startsWith(c.trunkPrefix)) d = d.slice(c.trunkPrefix.length);
    setCountry(c);
    setNsn(d.slice(0, nsnMaxLen(c)));
    setPickerOpen(false);
  };

  const showErr = Boolean(error);
  const borderColor = showErr ? ui.err : focused ? ui.focus : ui.border;
  const activePlaceholder = placeholder ?? getPlaceholderForCountry(country);

  const query = search.trim().toLowerCase();
  const qDigits = onlyDigits(query);
  const results = useMemo(
    () =>
      !query
        ? PHONE_COUNTRIES
        : PHONE_COUNTRIES.filter(
            (c) =>
              c.name.toLowerCase().includes(query) ||
              c.iso2.toLowerCase() === query ||
              (!!qDigits && c.dial.startsWith(qDigits)),
          ),
    [query, qDigits],
  );

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: ui.label }]}>{tr(label)}</Text> : null}
      <View style={[styles.row, { backgroundColor: ui.rowBg, borderColor }]}>
        <Pressable
          onPress={() => {
            setSearch('');
            setPickerOpen(true);
          }}
          style={({ pressed }) => [
            styles.countryBtn,
            { borderRightColor: ui.divider },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            country
              ? `Country ${country.name}, dial code +${country.dial}. Change country`
              : 'Choose country'
          }
        >
          <Text style={styles.flag} allowFontScaling={false}>
            {flagEmoji(country?.iso2)}
          </Text>
          {country ? (
            <Text style={[styles.dialText, { color: ui.text }]}>+{country.dial}</Text>
          ) : null}
          <Ionicons name="chevron-down" size={12} color={ui.muted} />
        </Pressable>
        <TextInput
          style={[styles.input, { color: ui.text }]}
          value={display}
          onChangeText={handleText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel={label ?? 'Phone number'}
          placeholder={placeholder ? tr(placeholder) : activePlaceholder}
          placeholderTextColor={ui.muted}
        />
        {showErr ? (
          <Ionicons name="close-circle" size={18} color={ui.err} style={styles.stateIcon} />
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.hint, { color: ui.err }]} numberOfLines={2}>
          {tr(error)}
        </Text>
      ) : null}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <GlassScrim style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <GlassSheetHost
            style={[styles.sheet, { backgroundColor: ui.sheetBg }]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: ui.divider }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: ui.text }]}>{tr('Choose country')}</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close country picker"
              >
                <Ionicons name="close" size={22} color={ui.muted} />
              </Pressable>
            </View>
            <View
              style={[styles.searchRow, { backgroundColor: ui.searchBg, borderColor: ui.divider }]}
            >
              <Ionicons name="search" size={16} color={ui.muted} />
              <TextInput
                style={[styles.searchInput, { color: ui.text }]}
                value={search}
                onChangeText={setSearch}
                placeholder={tr('Search country or code')}
                placeholderTextColor={ui.muted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search country or dial code"
              />
            </View>
            <FlatList
              data={results}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const selected = item.iso2 === country?.iso2;
                return (
                  <Pressable
                    onPress={() => selectCountry(item)}
                    style={({ pressed }) => [
                      styles.item,
                      selected && { backgroundColor: ui.itemSelected },
                      pressed && { backgroundColor: ui.itemPressed },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, dial code +${item.dial}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.itemFlag} allowFontScaling={false}>
                      {flagEmoji(item.iso2)}
                    </Text>
                    <Text style={[styles.itemName, { color: ui.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemDial, { color: ui.muted }]}>+{item.dial}</Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: ui.muted }]}>
                  No country matches “{search.trim()}”
                </Text>
              }
            />
          </GlassSheetHost>
        </GlassScrim>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radii.md,
    minHeight: 52,
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    alignSelf: 'stretch',
    borderRightWidth: 1.5,
    minWidth: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  flag: { fontSize: 18 },
  dialText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    letterSpacing: 0.3,
  },
  stateIcon: { marginRight: spacing.md },
  hint: { fontSize: fontSize.xs, minHeight: 16, lineHeight: 16 },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    maxHeight: '82%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.full,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: fontSize.sm },
  list: { flexGrow: 0, flexShrink: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    minHeight: 48,
  },
  itemFlag: { fontSize: 20 },
  itemName: { flex: 1, fontSize: fontSize.sm },
  itemDial: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  emptyText: { textAlign: 'center', paddingVertical: spacing.xl, fontSize: fontSize.sm },
}));
