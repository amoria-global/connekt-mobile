/**
 * Payment accounts: the mobile money and bank accounts withdrawals are paid
 * out to. Parity with the web dashboard's Preferences > Payment Accounts tab,
 * on the same withdrawal-methods endpoints (see features/paymentAccounts).
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRole } from '@/features/auth/role';
import { AddAccountSheet } from '@/features/paymentAccounts/AddAccountSheet';
import {
  deletePaymentAccount,
  listPaymentAccounts,
  setDefaultPaymentAccount,
} from '@/features/paymentAccounts/api';
import { maskAccountNumber, type PaymentAccount } from '@/features/paymentAccounts/model';
import { useAsync } from '@/hooks/useAsync';
import { parsePhone } from '@/lib/phoneKit';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

const KIND_STYLE: Record<PaymentAccount['kind'], { icon: 'phone-portrait-outline' | 'business-outline'; tint: string }> = {
  mtn: { icon: 'phone-portrait-outline', tint: '#F59E0B' },
  airtel: { icon: 'phone-portrait-outline', tint: '#ED1C24' },
  bank: { icon: 'business-outline', tint: '#3B82F6' },
};

export default function PaymentAccountsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { role } = useRole();
  const userPhone = useAuth((s) => s.user?.phone);
  const accounts = useAsync(useCallback(() => listPaymentAccounts(role), [role]));

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = accounts.data ?? [];

  const onMakeDefault = async (a: PaymentAccount) => {
    setBusyId(a.id);
    try {
      await setDefaultPaymentAccount(role, a);
      await accounts.refresh();
    } catch (e) {
      Alert.alert('Could not update', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = (a: PaymentAccount) => {
    Alert.alert(
      'Remove this account?',
      `${a.label} ${maskAccountNumber(a.accountNumber)} will no longer be available for withdrawals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyId(a.id);
            try {
              await deletePaymentAccount(role, a.id);
              await accounts.refresh();
            } catch (e) {
              Alert.alert('Could not remove', isApiError(e) ? e.message : 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={accounts.refresh} tintColor={colors.primary} />
        }
      >
        <ScreenHeader title="Payment accounts" subtitle="Manage the accounts you use for payments and withdrawals." />

        <View style={styles.body}>
          {accounts.loading && !accounts.data ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>Loading your accounts…</Text>
            </View>
          ) : accounts.error ? (
            <View style={styles.stateCard}>
              <View style={[styles.stateIcon, { backgroundColor: colors.errorBg }]}>
                <Ionicons name="cloud-offline-outline" size={26} color={colors.error} />
              </View>
              <Text style={styles.stateTitle}>Could not load your accounts</Text>
              <Text style={styles.stateText}>{accounts.error}</Text>
              <Button title="Try again" variant="outline" onPress={accounts.refresh} style={styles.stateBtn} />
            </View>
          ) : list.length === 0 ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIcon}>
                <Ionicons name="card-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.stateTitle}>No payment accounts saved</Text>
              <Text style={styles.stateText}>
                Add a mobile money or bank account to enable payments and withdrawals.
              </Text>
              <Button title="Add account" onPress={() => setAdding(true)} style={styles.stateBtn} />
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>
                {list.length === 1 ? '1 saved account' : `${list.length} saved accounts`}
              </Text>
              {list.map((a) => {
                const k = KIND_STYLE[a.kind];
                const busy = busyId === a.id;
                return (
                  <View key={a.id} style={[styles.card, a.isDefault && styles.cardDefault]}>
                    <View style={styles.cardTop}>
                      <View style={[styles.kindIcon, { backgroundColor: `${k.tint}1F` }]}>
                        <Ionicons name={k.icon} size={20} color={k.tint} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={styles.labelRow}>
                          <Text style={styles.cardLabel} numberOfLines={1}>{a.label}</Text>
                          {a.isDefault ? (
                            <View style={styles.defaultPill}>
                              <Text style={styles.defaultText}>Default</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.cardNumber}>{maskAccountNumber(a.accountNumber)}</Text>
                        {a.accountName ? (
                          <Text style={styles.cardName} numberOfLines={1}>{a.accountName}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.actions}>
                      {busy ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <>
                          {!a.isDefault ? (
                            <Pressable
                              style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
                              onPress={() => onMakeDefault(a)}
                              accessibilityRole="button"
                              accessibilityLabel={`Make ${a.label} your default account`}
                            >
                              <Ionicons name="star-outline" size={15} color={colors.primary} />
                              <Text style={styles.actionText}>Make default</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
                            onPress={() => onRemove(a)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${a.label}`}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.error} />
                            <Text style={[styles.actionText, { color: colors.error }]}>Remove</Text>
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
              <Button title="Add another account" variant="outline" onPress={() => setAdding(true)} />
            </>
          )}
        </View>
      </ScrollView>

      <AddAccountSheet
        visible={adding}
        role={role}
        hasAccounts={list.length > 0}
        defaultPhoneIso2={parsePhone(userPhone ?? '').country?.iso2 ?? 'RW'}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          accounts.refresh();
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { paddingBottom: spacing['3xl'] },
  body: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingTop: spacing.sm },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] },
  muted: { fontSize: fontSize.sm, color: c.textMuted },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stateCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    paddingVertical: spacing['2xl'],
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  stateIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tintAccent,
    marginBottom: spacing.xs,
  },
  stateTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  stateText: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
  stateBtn: { marginTop: spacing.md, alignSelf: 'stretch' },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  cardDefault: { borderColor: c.primary },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  kindIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardLabel: { flexShrink: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  defaultPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  defaultText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primary },
  cardNumber: { fontSize: fontSize.sm, color: c.textSoft, letterSpacing: 0.5 },
  cardName: { fontSize: fontSize.sm, color: c.textMuted },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    minHeight: 36,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: spacing.xs },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.primary },
}));
