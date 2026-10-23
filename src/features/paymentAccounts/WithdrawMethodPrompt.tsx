/**
 * The "add a withdrawal method" prompt on the Wallet screen.
 *
 * A photographer or coordinator with no saved withdrawal method cannot withdraw, and used to find that out only after
 * trying. Every time the Wallet comes into view, their saved methods are read, and when there are none this sheet opens
 * at once: why it matters, the three steps, and two choices, "Add withdrawal method" (opens Payment accounts) or
 * "Do it later" (closes it until the next visit). The list is re-read on every visit, so it stops as soon as a method
 * has been added. A failed read shows nothing, because "could not check" is not "has none".
 */
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import type { Role } from '@/features/auth/role';
import { ActionButton } from '@/features/photographer/kit';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { listPaymentAccounts } from './api';

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'card-outline', title: 'Choose a type', body: 'Mobile money or a bank account.' },
  { icon: 'create-outline', title: 'Enter the details', body: 'The account number and the name on it.' },
  { icon: 'checkmark-circle-outline', title: 'Save it', body: 'Then you can withdraw whenever you like.' },
];

export function WithdrawMethodPrompt({ role }: { role: Role | undefined }) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      listPaymentAccounts(role)
        .then((accounts) => {
          if (live) setOpen(accounts.length === 0);
        })
        .catch(() => {
          if (live) setOpen(false);
        });
      return () => {
        live = false;
      };
    }, [role]),
  );

  if (!open) return null;

  const later = () => setOpen(false);
  const add = () => {
    setOpen(false);
    router.push('/payment-accounts' as Href);
  };

  return (
    <Sheet
      title="Add a withdrawal method"
      subtitle="You cannot withdraw your funds yet."
      onClose={later}
      footer={
        <View style={styles.actions}>
          <ActionButton label="Add withdrawal method" icon="add-circle-outline" variant="primary" onPress={add} />
          <ActionButton label="Do it later" variant="tertiary" onPress={later} />
        </View>
      }
    >
      <Text style={[styles.lead, { color: colors.textMuted }]}>
        Tell us where to send your money. Until you add a withdrawal method, your balance stays in your wallet and cannot be paid out.
      </Text>
      {STEPS.map((s, i) => (
        <View key={s.title} style={styles.step}>
          <View style={styles.num}>
            <Ionicons name={s.icon} size={20} color={colors.primary} />
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{`${i + 1}. ${s.title}`}</Text>
            <Text style={[styles.stepBody, { color: colors.textMuted }]}>{s.body}</Text>
          </View>
        </View>
      ))}
      <Text style={[styles.foot, { color: colors.textMuted }]}>
        It takes about a minute. If you do it later, you will find it under Payment accounts, and we will remind you whenever you open your wallet.
      </Text>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  lead: { fontSize: 15, lineHeight: 22 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  num: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, minWidth: 0, gap: 2 },
  stepTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  stepBody: { fontSize: 14, lineHeight: 20 },
  foot: { fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.sm, paddingBottom: spacing.sm },
}));
