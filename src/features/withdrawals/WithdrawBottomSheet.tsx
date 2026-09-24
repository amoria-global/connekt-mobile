import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listWithdrawalMethods,
  listWithdrawals,
  requestWithdrawal,
  type Withdrawal,
  type WithdrawalMethod,
} from '@/features/withdrawals/api';
import { StatusPill } from '@/components/ui/StatusPill';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

interface WithdrawBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  availableBalance: number;
  currency?: string;
}

export function WithdrawBottomSheet({
  visible,
  onClose,
  onSuccess,
  availableBalance,
  currency = 'USD',
}: WithdrawBottomSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [methods, setMethods] = useState<WithdrawMethodWithDetails[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load methods when opened
  const loadMethods = useCallback(async () => {
    setLoadingMethods(true);
    try {
      const data = await listWithdrawalMethods();
      setMethods(data as WithdrawMethodWithDetails[]);
      if (data.length > 0 && !selectedMethodId) {
        setSelectedMethodId(data[0].id);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMethods(false);
    }
  }, [selectedMethodId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await listWithdrawals();
      setHistory(data);
    } catch {
      // Fallback
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setError(null);
      setIsSuccess(false);
      setAmount('');
      loadMethods();
      loadHistory();
    }
  }, [visible, loadMethods, loadHistory]);

  const handleQuickPreset = (percent: number) => {
    setError(null);
    if (availableBalance <= 0) return;
    const computed = percent === 100 ? availableBalance : Math.round(availableBalance * (percent / 100));
    setAmount(String(computed));
  };

  const handleSubmit = async () => {
    setError(null);
    const num = Number(amount);
    if (!amount.trim() || Number.isNaN(num) || num <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }
    if (availableBalance > 0 && num > availableBalance) {
      setError(`Amount exceeds your available balance of ${formatMoney(availableBalance, currency)}.`);
      return;
    }
    if (!selectedMethodId) {
      setError('Please select a payout method.');
      return;
    }

    setSubmitting(true);
    try {
      await requestWithdrawal({ amount: num, withdrawalMethodId: selectedMethodId });
      setIsSuccess(true);
      onSuccess?.();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: string }).message)
          : 'Failed to submit withdrawal request. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setIsSuccess(false);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetOverlay}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          {/* Top Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Withdraw funds</Text>
              <Text style={styles.headerSubtitle}>
                Available: {formatMoney(availableBalance, currency)}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          {isSuccess ? (
            /* Success State */
            <View style={styles.successBox}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={54} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Request Submitted</Text>
              <Text style={styles.successDesc}>
                Your request to withdraw{' '}
                <Text style={{ fontFamily: fonts.bold, color: colors.text }}>
                  {formatMoney(Number(amount), currency)}
                </Text>{' '}
                has been received. Funds will be deposited to your selected payout account.
              </Text>

              <Pressable style={styles.primaryActionBtn} onPress={handleClose}>
                <Text style={styles.primaryActionBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            /* Withdrawal Form */
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Available Balance Box */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceCardLeft}>
                  <View style={styles.balanceIconWrap}>
                    <Ionicons name="wallet-outline" size={18} color="#083A85" />
                  </View>
                  <View>
                    <Text style={styles.balanceLabel}>Available balance</Text>
                    <Text style={styles.balanceValue}>
                      {formatMoney(availableBalance, currency)}
                    </Text>
                  </View>
                </View>
                <View style={styles.currencyBadge}>
                  <Text style={styles.currencyBadgeText}>{currency}</Text>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Withdrawal amount</Text>
                <View style={[styles.amountInputRow, !!error && styles.amountInputError]}>
                  <Text style={styles.currencyPrefix}>{currency}</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={amount}
                    onChangeText={(txt) => {
                      setError(null);
                      setAmount(txt.replace(/[^0-9.]/g, ''));
                    }}
                    keyboardType="decimal-pad"
                    autoFocus={false}
                  />
                  {amount.length > 0 && (
                    <Pressable onPress={() => setAmount('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>

                {/* Quick Presets */}
                <View style={styles.presetBar}>
                  {[25, 50, 75, 100].map((pct) => (
                    <Pressable
                      key={pct}
                      style={styles.presetChip}
                      onPress={() => handleQuickPreset(pct)}
                    >
                      <Text style={styles.presetChipText}>
                        {pct === 100 ? 'Max (100%)' : `${pct}%`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Payout Methods */}
              <View style={styles.methodSection}>
                <View style={styles.methodHeaderRow}>
                  <Text style={styles.inputLabel}>Payout account</Text>
                  <Text style={styles.methodCount}>
                    {methods.length} saved
                  </Text>
                </View>

                {loadingMethods ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : methods.length === 0 ? (
                  <View style={styles.emptyMethodBox}>
                    <Ionicons name="card-outline" size={24} color={colors.textMuted} />
                    <Text style={styles.emptyMethodTitle}>No payout accounts found</Text>
                    <Text style={styles.emptyMethodSubtitle}>
                      Add a Mobile Money (MTN / Airtel) or Bank account in your web dashboard preferences to withdraw.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.methodListGroup}>
                    {methods.map((m, idx) => {
                      const isSelected = selectedMethodId === m.id;
                      const isLast = idx === methods.length - 1;
                      const isMomo =
                        m.name?.toLowerCase().includes('mtn') ||
                        m.name?.toLowerCase().includes('airtel') ||
                        m.name?.toLowerCase().includes('momo') ||
                        m.name?.toLowerCase().includes('mobile');

                      return (
                        <Pressable
                          key={m.id}
                          style={({ pressed }) => [
                            styles.methodItemRow,
                            !isLast && styles.methodItemDivider,
                            isSelected && styles.methodItemSelected,
                            pressed && styles.methodItemPressed,
                          ]}
                          onPress={() => {
                            setError(null);
                            setSelectedMethodId(m.id);
                          }}
                        >
                          <View
                            style={[
                              styles.methodIconBox,
                              { backgroundColor: isMomo ? 'rgba(245, 158, 11, 0.12)' : 'rgba(8, 58, 133, 0.10)' },
                            ]}
                          >
                            <Ionicons
                              name={isMomo ? 'phone-portrait-outline' : 'business-outline'}
                              size={18}
                              color={isMomo ? '#F59E0B' : '#083A85'}
                            />
                          </View>

                          <View style={styles.methodInfoCol}>
                            <Text style={styles.methodNameText}>{m.name}</Text>
                            {m.accountNumber ? (
                              <Text style={styles.methodAccountText}>
                                •••• {m.accountNumber.slice(-4)}
                              </Text>
                            ) : null}
                          </View>

                          <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                            size={20}
                            color={isSelected ? colors.primary : colors.borderSoft}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Submit CTA Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  submitting && { opacity: 0.7 },
                  pressed && { opacity: 0.88 },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="cash-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Confirm Withdrawal</Text>
                  </>
                )}
              </Pressable>

              {/* Recent Requests Section (Collapsible) */}
              <View style={styles.historySection}>
                <Pressable
                  style={styles.historyToggleRow}
                  onPress={() => setShowHistory(!showHistory)}
                  hitSlop={6}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.historyToggleText}>Recent withdrawal requests</Text>
                  </View>
                  <Ionicons
                    name={showHistory ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>

                {showHistory && (
                  <View style={styles.historyCardGroup}>
                    {loadingHistory ? (
                      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                      </View>
                    ) : history.length === 0 ? (
                      <View style={{ padding: spacing.md, alignItems: 'center' }}>
                        <Text style={styles.emptyHistoryText}>No past withdrawal requests</Text>
                      </View>
                    ) : (
                      history.slice(0, 5).map((w, idx) => (
                        <View
                          key={w.id}
                          style={[
                            styles.historyRow,
                            idx < Math.min(history.length, 5) - 1 && styles.historyRowDivider,
                          ]}
                        >
                          <View>
                            <Text style={styles.historyRowAmount}>
                              {formatMoney(w.amount, w.currency || currency)}
                            </Text>
                            {w.requestedAt ? (
                              <Text style={styles.historyRowDate}>{formatDate(w.requestedAt)}</Text>
                            ) : null}
                          </View>
                          <StatusPill status={w.status} />
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type WithdrawMethodWithDetails = WithdrawalMethod & {
  type?: string;
  accountName?: string;
};

const useStyles = makeStyles((c) => ({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    maxHeight: '92%',
    gap: spacing.md,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerTitleWrap: { gap: 2 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 19, color: c.text, letterSpacing: -0.3 },
  headerSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
  closeBtn: { padding: 4 },

  scrollContent: { gap: spacing.lg, paddingBottom: spacing.lg },

  // Balance Card
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.infoBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  balanceCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  balanceIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: { fontFamily: fonts.bold, fontSize: 20, color: c.text, letterSpacing: -0.3 },
  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  currencyBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },

  // Input Section
  inputSection: { gap: 8 },
  inputLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    height: 52,
    gap: 8,
  },
  amountInputError: { borderColor: '#DC2626' },
  currencyPrefix: { fontFamily: fonts.bold, fontSize: 16, color: c.textMuted },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: c.text,
    letterSpacing: -0.3,
  },

  presetBar: { flexDirection: 'row', gap: 8, marginTop: 2 },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    borderRadius: radii.md,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  presetChipText: { fontFamily: fonts.bold, fontSize: 11, color: c.textMuted },

  // Methods
  methodSection: { gap: 8 },
  methodHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  methodCount: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  loadingBox: { padding: spacing.xl, alignItems: 'center' },
  emptyMethodBox: {
    backgroundColor: c.background,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyMethodTitle: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  emptyMethodSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  methodListGroup: {
    backgroundColor: c.background,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  methodItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  methodItemDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  methodItemSelected: { backgroundColor: c.infoBg },
  methodItemPressed: { opacity: 0.85 },
  methodIconBox: {
    width: 36,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfoCol: { flex: 1, gap: 2 },
  methodNameText: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  methodAccountText: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radii.md,
    padding: 10,
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: '#991B1B' },

  // Primary Action Button
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: c.primary,
    gap: 8,
    marginTop: 4,
  },
  primaryActionBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#ffffff' },

  // History Section
  historySection: { gap: 8, marginTop: 4 },
  historyToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  historyToggleText: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted },
  historyCardGroup: {
    backgroundColor: c.background,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  emptyHistoryText: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  historyRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  historyRowAmount: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  historyRowDate: { fontFamily: fonts.regular, fontSize: 11, color: c.textMuted },

  // Success Box
  successBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: 12,
  },
  successIconWrap: { marginBottom: 4 },
  successTitle: { fontFamily: fonts.bold, fontSize: 20, color: c.text },
  successDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
}));
