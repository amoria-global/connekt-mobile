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
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { CountrySelectModal } from '@/features/payments/CountrySelectModal';
import { paymentCountryName } from '@/features/payments/countries';
import { CARDS_LOGO, MOMO_LOGO, operatorLogo } from '@/features/payments/operatorLogos';
import type { MobileMoneyState } from '@/features/payments/eligibility';
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
  /** From usePaymentEligibility: 'loading' while checking, 'unavailable' when the country has no mobile money. */
  mobileMoneyState?: MobileMoneyState;
  /** Offered when mobile money could not be confirmed, so a failed lookup is not final. */
  onRetry?: () => void;
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
  mobileMoneyState,
  onRetry,
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

  const momoOff = disabled || disableMobileMoney || operators.length === 0;
  const cardOff = disabled || disableCards;
  const momoActive = (open || !!selectedOperator) && !momoOff;
  // A disabled Mobile Money tile is noise: show it only while checking or when there are networks.
  const showMomo = mobileMoneyState === 'loading' || (operators.length > 0 && !disableMobileMoney);
  const momoMissing = !showMomo;

  const pickCountry = (iso2: string) => {
    setCountryOpen(false);
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
          accessibilityLabel={`Payment country ${country ? paymentCountryName(country) : 'not set'}. Tap to change.`}
        >
          <Text style={styles.flag}>{flagEmoji(country)}</Text>
          <Text style={styles.countryName} numberOfLines={1}>{country ? paymentCountryName(country) : 'Choose your country'}</Text>
          <Text style={styles.countryChange}>Change</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.mainRow}>
        <View style={styles.tiles}>
        {showMomo ? (
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
                : mobileMoneyState === 'loading'
                  ? 'Checking your country...'
                  : disableMobileMoney || operators.length === 0
                  ? 'Not available in your country'
                  : 'Choose your network'}
            </Text>
          </View>
          <Ionicons name={momoActive ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} style={styles.tileIcon} />
        </Pressable>
        ) : null}

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

        {momoMissing && mobileMoneyState === 'unavailable' ? (
          <Text style={styles.unavailable}>
            {country
              ? 'Mobile money is not available in this country. You can pay by card.'
              : 'We could not confirm your country. You can pay by card, or choose your country to see mobile money.'}
          </Text>
        ) : null}

        {mobileMoneyState === 'unavailable' && onRetry ? (
          <Pressable
            onPress={onRetry}
            disabled={disabled}
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Check mobile money for my country again"
          >
            <Ionicons name="refresh" size={14} color={colors.primary} />
            <Text style={styles.retryText}>Check again</Text>
          </Pressable>
        ) : null}

      </View>

      {onCountryChange ? (
        <CountrySelectModal
          visible={countryOpen}
          selected={country}
          onClose={() => setCountryOpen(false)}
          onSelect={pickCountry}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm },
  unavailable: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  retryText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
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
  countryChange: { color: c.primary, fontSize: 12, fontWeight: fontWeight.bold },
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
  mainSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
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
