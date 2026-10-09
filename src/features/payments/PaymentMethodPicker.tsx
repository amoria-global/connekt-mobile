/**
 * Payment method picker shared by every payment sheet in the app.
 *
 * Two choices, "Mobile Money" and "Cards". Mobile Money opens the networks
 * the buyer's country supports (with their logos); Cards selects card at
 * once. A country selector sits on top so a buyer abroad can switch the
 * operator list, as on the web checkout.
 *
 * Presentation only. It reports the same ids the old flat tiles did ("card"
 * or the lowercased operator id) and never talks to the backend; each host
 * keeps its own state, polling and payload.
 */
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { PAYMENT_COUNTRY_LIST, paymentCountryName } from '@/features/payments/countries';
import { CARDS_LOGO, MOMO_LOGO, operatorLogo } from '@/features/payments/operatorLogos';
import type { PaymentOperator } from '@/features/reference/api';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

type Props = {
  operators: PaymentOperator[];
  supportsCard: boolean;
  /** "card", a lowercased operator id, or null when nothing is chosen yet. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Omit onCountryChange to hide the selector (host already has one). */
  country?: string;
  onCountryChange?: (iso2: string) => void;
  disableMobileMoney?: boolean;
  disableCards?: boolean;
  /** Lock while a payment is starting. */
  disabled?: boolean;
};

function Logo({ source, label, size }: { source: ReturnType<typeof operatorLogo>; label: string; size: number }) {
  const styles = useStyles();
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={[styles.logoBox, { width: size, height: size }]}>
      {source ? (
        <Image source={source} style={styles.logoImg} resizeMode="contain" accessible={false} />
      ) : (
        <Text style={styles.logoInitials}>{initials}</Text>
      )}
    </View>
  );
}

export function PaymentMethodPicker({
  operators,
  supportsCard,
  selectedId,
  onSelect,
  country,
  onCountryChange,
  disableMobileMoney = false,
  disableCards = false,
  disabled = false,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const selectedOperator = operators.find((o) => o.id.toLowerCase() === selectedId) ?? null;
  const cardSelected = selectedId === 'card';
  const [open, setOpen] = useState(!!selectedOperator);
  const [countryOpen, setCountryOpen] = useState(false);
  const [query, setQuery] = useState('');

  const momoOff = disabled || disableMobileMoney || operators.length === 0;
  const cardOff = disabled || disableCards;
  const momoActive = (open || !!selectedOperator) && !momoOff;

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAYMENT_COUNTRY_LIST;
    return PAYMENT_COUNTRY_LIST.filter(
      (c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q || c.dial.includes(q.replace(/^\+/, '')),
    );
  }, [query]);

  const pickCountry = (iso2: string) => {
    setCountryOpen(false);
    setQuery('');
    if (iso2 !== (country || '').toUpperCase()) {
      setOpen(false);
      onCountryChange?.(iso2);
    }
  };

  return (
    <View style={styles.wrap}>
      {onCountryChange ? (
        <Pressable
          style={styles.countryPill}
          onPress={() => setCountryOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Payment country ${paymentCountryName(country)}. Tap to change.`}
        >
          <Text style={styles.flag}>{flagEmoji(country)}</Text>
          <Text style={styles.countryName} numberOfLines={1}>{paymentCountryName(country)}</Text>
          <Text style={styles.countryChange}>Change</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.mainRow}>
        <View style={styles.tiles}>
        <Pressable
          style={[styles.main, momoActive && styles.mainActive, momoOff && styles.off]}
          onPress={() => setOpen((o) => !o)}
          disabled={momoOff}
          accessibilityRole="button"
          accessibilityState={{ expanded: momoActive, disabled: momoOff }}
          accessibilityLabel="Mobile Money"
        >
          <Logo source={MOMO_LOGO} label="Mobile Money" size={44} />
          <View style={styles.mainText}>
            <Text style={[styles.mainTitle, momoActive && styles.mainTitleActive]}>Mobile Money</Text>
            <Text style={styles.mainSub} numberOfLines={2}>
              {selectedOperator
                ? selectedOperator.name
                : disableMobileMoney || operators.length === 0
                  ? 'Unavailable here'
                  : 'Choose your network'}
            </Text>
          </View>
          <Ionicons name={momoActive ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={styles.tileIcon} />
        </Pressable>

        {supportsCard ? (
          <Pressable
            style={[styles.main, cardSelected && styles.mainActive, cardOff && styles.off]}
            onPress={() => {
              setOpen(false);
              onSelect('card');
            }}
            disabled={cardOff}
            accessibilityRole="radio"
            accessibilityState={{ selected: cardSelected, disabled: cardOff }}
            accessibilityLabel="Cards, Visa and Mastercard"
          >
            <Logo source={CARDS_LOGO} label="Cards" size={44} />
            <View style={styles.mainText}>
              <Text style={[styles.mainTitle, cardSelected && styles.mainTitleActive]}>Cards</Text>
              <Text style={styles.mainSub} numberOfLines={2}>
                {disableCards ? 'Unavailable here' : 'Visa & Mastercard'}
              </Text>
            </View>
            {cardSelected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} style={styles.tileIcon} /> : null}
          </Pressable>
        ) : null}
        </View>

        {momoActive ? (
          <View style={styles.panel} accessibilityRole="radiogroup">
            {operators.map((op) => {
              const id = op.id.toLowerCase();
              const active = id === selectedId;
              return (
                <Pressable
                  key={op.id}
                  style={[styles.op, active && styles.opActive]}
                  onPress={() => onSelect(id)}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, disabled }}
                  accessibilityLabel={op.name}
                >
                  <Logo source={operatorLogo(op.id)} label={op.name} size={36} />
                  <Text style={[styles.opName, active && styles.opNameActive]} numberOfLines={2}>
                    {op.name}
                  </Text>
                  {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

      </View>

      {onCountryChange ? (
        <Modal visible={countryOpen} animationType="slide" onRequestClose={() => setCountryOpen(false)}>
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Select country</Text>
              <Pressable onPress={() => setCountryOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search country or dial code"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={countries}
              keyExtractor={(c) => c.iso2}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No matching country.</Text>}
              renderItem={({ item }) => {
                const active = item.iso2 === (country || '').toUpperCase();
                return (
                  <Pressable style={[styles.countryRow, active && styles.opActive]} onPress={() => pickCountry(item.iso2)}>
                    <Text style={styles.flag}>{flagEmoji(item.iso2)}</Text>
                    <Text style={styles.countryRowName}>{item.name}</Text>
                    <Text style={styles.dial}>+{item.dial}</Text>
                    {active ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  flag: { fontSize: 18 },
  countryName: { flex: 1, color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  countryChange: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  mainRow: { gap: spacing.sm },
  // Mobile Money and Cards sit side by side; the network list opens full width below.
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tileIcon: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  main: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: 112,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  mainActive: { borderColor: c.primary, backgroundColor: c.tint },
  off: { opacity: 0.45 },
  mainText: { alignSelf: 'stretch' },
  mainTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
  mainTitleActive: { color: c.primary },
  mainSub: { color: c.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  logoBox: {
    borderRadius: radii.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: c.border,
  },
  logoImg: { width: '100%', height: '100%' },
  logoInitials: { color: '#083A85', fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  panel: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.tint,
  },
  op: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  opActive: { borderColor: c.primary, backgroundColor: c.tint },
  opName: { flex: 1, color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  opNameActive: { color: c.primary, fontWeight: fontWeight.bold },
  modal: { flex: 1, backgroundColor: c.surface },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  modalTitle: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  searchInput: { flex: 1, color: c.text, fontSize: fontSize.md },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  countryRowName: { flex: 1, color: c.text, fontSize: fontSize.md },
  dial: { color: c.textMuted, fontSize: fontSize.sm },
  empty: { textAlign: 'center', color: c.textMuted, padding: spacing.lg },
}));
