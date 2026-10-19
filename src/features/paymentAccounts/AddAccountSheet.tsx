/**
 * Add a payment account: Mobile Money (MTN MoMo or Airtel Money) or a bank account.
 * The two top choices match every payment sheet: Mobile Money opens the networks.
 *
 * Same steps as the web's "Add account" modal (preferences.tsx):
 *   - mobile money: a valid phone number, then a XentriPay name lookup; when
 *     the typed holder name differs from the registered one, confirm before
 *     saving under the registered name;
 *   - bank: bank, account number and holder name, no lookup (the backend
 *     skips validation for banks too).
 * The first account saved becomes the default.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import type { Role } from '@/features/auth/role';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { MOMO_LOGO, operatorLogo } from '@/features/payments/operatorLogos';
import { useSharedT } from '@/i18n/sharedStrings';
import { CountrySelectModal } from '@/features/payments/CountrySelectModal';
import { paymentCountryName } from '@/features/payments/countries';
import { usePaymentEligibility } from '@/features/payments/usePaymentEligibility';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { addPaymentAccount, listBanks, validateMobileAccount, type Bank } from './api';
import { MOBILE_PROVIDER, resolveMobileName, type AccountKind, type PaymentAccount } from './model';

type Props = {
  visible: boolean;
  role: Role | undefined;
  /** Whether the user already has accounts; the first one saved becomes default. */
  hasAccounts: boolean;
  defaultPhoneIso2?: string;
  onClose: () => void;
  onSaved: (account: PaymentAccount) => void;
};

/** Networks listed under the single "Mobile Money" choice. */
const NETWORKS: { key: Exclude<AccountKind, 'bank'>; label: string }[] = [
  { key: 'mtn', label: 'MTN MoMo' },
  { key: 'airtel', label: 'Airtel Money' },
];

export function AddAccountSheet({ visible, role, hasAccounts, defaultPhoneIso2 = 'RW', onClose, onSaved }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { tr } = useSharedT();

  // The payout networks and the name lookup below are Rwandan (MOBILE_PROVIDER ids), so
  // Mobile Money is offered only when the country is Rwanda. Banks stay for everyone.
  const eligibility = usePaymentEligibility(visible);
  const [countryOpen, setCountryOpen] = useState(false);
  const checkingCountry = eligibility.mobileMoney === 'loading';
  const mobileOk = eligibility.country === 'RW';
  const [pickedKind, setKind] = useState<AccountKind>('mtn');
  // Derived, so a stale Mobile Money choice can never be saved for another country.
  const kind: AccountKind = mobileOk || pickedKind === 'bank' ? pickedKind : 'bank';
  const [phone, setPhone] = useState<PhoneValue | null>(null);
  const [phoneKey, setPhoneKey] = useState(0);
  const [holderName, setHolderName] = useState('');
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankNumber, setBankNumber] = useState('');
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [pickingBank, setPickingBank] = useState(false);
  const [bankQuery, setBankQuery] = useState('');
  const [busy, setBusy] = useState<'validating' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKind('mtn');
    setPhone(null);
    setPhoneKey((k) => k + 1);
    setHolderName('');
    setBank(null);
    setBankNumber('');
    setPickingBank(false);
    setBankQuery('');
    setBusy(null);
    setError(null);
  };

  useEffect(() => {
    if (!visible || banks) return;
    listBanks()
      .then((list) => {
        setBanksError(null);
        setBanks(list);
      })
      .catch((e) => setBanksError(isApiError(e) ? e.message : 'Could not load the list of banks.'));
  }, [visible, banks]);

  const filteredBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    return (banks ?? []).filter((b) => !q || b.name.toLowerCase().includes(q));
  }, [banks, bankQuery]);

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const save = async (input: Parameters<typeof addPaymentAccount>[1]) => {
    setBusy('saving');
    try {
      const saved = await addPaymentAccount(role, input);
      reset();
      onSaved(saved);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not save this account. Please try again.');
      setBusy(null);
    }
  };

  const onSubmit = async () => {
    setError(null);
    const isDefault = !hasAccounts;

    if (kind === 'bank') {
      if (!bank) return setError('Choose your bank.');
      if (!bankNumber.trim()) return setError('Enter your account number.');
      if (!holderName.trim()) return setError('Enter the account holder name.');
      return save({
        methodType: 'BANK_TRANSFER',
        accountName: holderName.trim(),
        accountNumber: bankNumber.replace(/\s+/g, ''),
        bankName: bank.name,
        isDefault,
        country: 'RW',
      });
    }

    if (!phone?.digits || !phone.isValid) return setError('Enter a valid phone number.');
    const provider = MOBILE_PROVIDER[kind];

    setBusy('validating');
    let registered: string;
    try {
      registered = await validateMobileAccount(phone.digits, provider.bankId);
    } catch (e) {
      setBusy(null);
      return setError(
        isApiError(e) ? e.message : 'We could not verify this number. Check it and try again.',
      );
    }

    const { name, needsConfirm } = resolveMobileName(holderName, registered);
    if (!name) {
      setBusy(null);
      return setError('Enter the account holder name.');
    }
    const input = {
      methodType: 'MOBILE_MONEY' as const,
      accountName: name,
      accountNumber: phone.digits,
      bankName: provider.bankName,
      isDefault,
      country: phone.iso2 || 'RW',
    };

    if (!needsConfirm) return save(input);

    setBusy(null);
    Alert.alert(
      'Different name on this number',
      `This number is registered to ${registered}, not ${holderName.trim()}. Payouts go to the registered name, so the account will be saved as ${registered}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Save as ${registered}`, onPress: () => save(input) },
      ],
    );
  };

  const isMobile = kind !== 'bank';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.headRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{tr('Add payment account')}</Text>
              <Text style={styles.subtitle}>{tr('Where should we send your withdrawals?')}</Text>
            </View>
            <Pressable onPress={close} hitSlop={12} style={styles.closeBtn} accessibilityLabel={tr('Close')}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {pickingBank ? (
            <View style={styles.pickerWrap}>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={bankQuery}
                  onChangeText={setBankQuery}
                  placeholder={tr('Search banks')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoFocus
                />
              </View>
              {banks === null && !banksError ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
              ) : banksError ? (
                <Text style={styles.error}>{banksError}</Text>
              ) : (
                <FlatList
                  data={filteredBanks}
                  keyExtractor={(b) => `${b.id}-${b.name}`}
                  keyboardShouldPersistTaps="handled"
                  style={{ maxHeight: 360 }}
                  ListEmptyComponent={<Text style={styles.muted}>No bank matches “{bankQuery}”.</Text>}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.bankRow, pressed && { backgroundColor: colors.tint }]}
                      onPress={() => {
                        setBank(item);
                        setPickingBank(false);
                        setBankQuery('');
                      }}
                    >
                      <Text style={styles.bankName}>{item.name}</Text>
                      {bank?.name === item.name ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  )}
                />
              )}
              <Button title="Back" variant="ghost" onPress={() => setPickingBank(false)} />
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              <Pressable
                style={styles.countryPill}
                onPress={() => setCountryOpen(true)}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={`Country ${eligibility.country ? paymentCountryName(eligibility.country) : 'not set'}. Tap to change.`}
              >
                <Text style={styles.countryFlag}>{flagEmoji(eligibility.country)}</Text>
                <Text style={styles.countryName} numberOfLines={1}>
                  {checkingCountry ? 'Checking your country...' : eligibility.country ? paymentCountryName(eligibility.country) : 'Choose your country'}
                </Text>
                <Text style={styles.countryChange}>Change</Text>
              </Pressable>

              <View style={styles.kindRow} accessibilityRole="radiogroup">
                {mobileOk ? (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isMobile, expanded: isMobile }}
                  onPress={() => {
                    if (!isMobile) setKind('mtn');
                    setError(null);
                  }}
                  style={[styles.kind, isMobile && styles.kindActive]}
                >
                  <Image source={MOMO_LOGO} style={styles.kindLogo} resizeMode="cover" accessible={false} />
                  <Text style={[styles.kindLabel, isMobile && styles.kindLabelActive]}>{tr('Mobile Money')}</Text>
                  <Text style={styles.kindHint}>{isMobile ? NETWORKS.find((n) => n.key === kind)?.label : 'Choose your network'}</Text>
                </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !isMobile }}
                  onPress={() => {
                    setKind('bank');
                    setError(null);
                  }}
                  style={[styles.kind, !isMobile && styles.kindActive]}
                >
                  <View style={[styles.kindIcon, { backgroundColor: '#3B82F61F' }]}>
                    <Ionicons name="business-outline" size={22} color="#3B82F6" />
                  </View>
                  <Text style={[styles.kindLabel, !isMobile && styles.kindLabelActive]}>{tr('Bank')}</Text>
                  <Text style={styles.kindHint}>{tr('Bank transfer')}</Text>
                </Pressable>
              </View>
              {!mobileOk && !checkingCountry ? (
                <Text style={styles.muted}>
                  {eligibility.country
                    ? `Mobile money payouts are not available in ${paymentCountryName(eligibility.country)}. You can add a bank account.`
                    : 'We could not confirm your country. Choose it to see mobile money, or add a bank account.'}
                </Text>
              ) : null}

              {isMobile ? (
                <View style={styles.networkPanel} accessibilityRole="radiogroup" accessibilityLabel="Mobile money network">
                  {NETWORKS.map((n) => {
                    const active = kind === n.key;
                    return (
                      <Pressable
                        key={n.key}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setKind(n.key);
                          setError(null);
                        }}
                        style={[styles.network, active && styles.networkActive]}
                      >
                        <Image source={operatorLogo(n.key) ?? MOMO_LOGO} style={styles.networkLogo} resizeMode="contain" accessible={false} />
                        <Text style={[styles.networkLabel, active && styles.kindLabelActive]} numberOfLines={1}>{n.label}</Text>
                        {active ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {isMobile ? (
                <>
                  <PhoneInput
                    key={phoneKey}
                    label="Mobile money number"
                    defaultIso2={eligibility.country ?? defaultPhoneIso2}
                    onChange={setPhone}
                  />
                  <Input
                    label="Account holder name (optional)"
                    placeholder="As registered with your network"
                    value={holderName}
                    onChangeText={setHolderName}
                    autoCapitalize="words"
                  />
                  <View style={styles.note}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                    <Text style={styles.noteText}>
                      We check the number with your network and save it under the name registered to it.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={styles.fieldLabel}>Bank</Text>
                    <Pressable
                      style={styles.select}
                      onPress={() => setPickingBank(true)}
                      accessibilityRole="button"
                      accessibilityLabel={bank ? `Bank, ${bank.name}` : 'Choose your bank'}
                    >
                      <Text style={[styles.selectText, !bank && { color: colors.textMuted }]} numberOfLines={1}>
                        {bank?.name ?? 'Choose your bank'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Input
                    label="Account number"
                    placeholder="Your bank account number"
                    value={bankNumber}
                    onChangeText={setBankNumber}
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Account holder name"
                    placeholder="Name on the bank account"
                    value={holderName}
                    onChangeText={setHolderName}
                    autoCapitalize="words"
                  />
                </>
              )}

              {error ? (
                <View style={styles.errorBox} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button
                title={busy === 'validating' ? 'Checking number…' : busy === 'saving' ? 'Saving…' : 'Save account'}
                onPress={onSubmit}
                loading={busy !== null}
                disabled={busy !== null}
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
      <CountrySelectModal
        visible={countryOpen}
        selected={eligibility.country}
        onClose={() => setCountryOpen(false)}
        onSelect={(iso2) => {
          setCountryOpen(false);
          setError(null);
          void eligibility.changeCountry(iso2);
        }}
      />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '92%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.md,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  body: { gap: spacing.lg, paddingBottom: spacing.sm },
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
  countryFlag: { fontSize: 18 },
  countryName: { flex: 1, color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  countryChange: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  kindRow: { flexDirection: 'row', gap: spacing.sm },
  kind: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  kindActive: { borderColor: c.primary, backgroundColor: c.tint },
  kindIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kindLogo: { width: 44, height: 44, borderRadius: 12, marginBottom: 4 },
  networkPanel: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.lg, backgroundColor: c.surfaceMuted },
  network: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  networkActive: { borderColor: c.primary, backgroundColor: c.tint },
  networkLogo: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF' },
  networkLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  kindLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  kindLabelActive: { color: c.primary },
  kindHint: { fontSize: fontSize.xs, color: c.textMuted },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  selectText: { flex: 1, fontSize: fontSize.md, color: c.text },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.infoBg,
  },
  noteText: { flex: 1, fontSize: fontSize.xs, color: c.textSoft, lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.errorBg,
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: c.error },
  error: { fontSize: fontSize.sm, color: c.error, textAlign: 'center', marginVertical: spacing.lg },
  muted: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  pickerWrap: { gap: spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: fontSize.md, color: c.text },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  bankName: { flex: 1, fontSize: fontSize.md, color: c.text },
}));
