/**
 * Donations screen.
 *
 * The app no longer collects donation payment details (amount entry,
 * phone numbers, telecom / card pickers) or polls the gateway. It shows
 * suggested tiers and the user's donation history, and hands the actual
 * donation off to the connekyt.com donations page.
 */
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { getDonationTiers, listDonations, type Donation } from '@/features/donations/api';
import { donationUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

const FALLBACK_TIERS = [1000, 5000, 10000, 25000];

export default function DonationsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const history = useAsync(useCallback(() => listDonations(), []));
  const tiersAsync = useAsync(useCallback(() => getDonationTiers(), []));
  const tiers = tiersAsync.data?.length ? tiersAsync.data.map((t) => t.amount) : FALLBACK_TIERS;

  const [opening, setOpening] = useState(false);

  const onDonate = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openWebCheckout(donationUrl());
      // Refresh once the browser is dismissed so a completed donation
      // shows up in the history below.
      await history.refresh();
    } catch {
      Alert.alert('Could not open the donations page', 'Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Donate" subtitle="Support the Connekyt community" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>Suggested amounts</Text>
        <View style={styles.tierRow}>
          {tiers.map((t) => (
            <View key={t} style={styles.tier}>
              <Text style={styles.tierText}>{t.toLocaleString()} RWF</Text>
            </View>
          ))}
        </View>

        <View style={styles.webHint}>
          <Ionicons name="globe-outline" size={16} color={colors.info} />
          <Text style={styles.webHintText}>
            You&apos;ll choose your amount and payment method on the connekyt.com secure
            donations page.
          </Text>
        </View>

        <Button
          title="Donate on connekyt.com"
          onPress={onDonate}
          loading={opening}
          disabled={opening}
        />

        <Text style={styles.historyTitle}>Your donations</Text>
        {history.loading && !history.data ? (
          <ActivityIndicator color={colors.primary} />
        ) : history.data?.length ? (
          history.data.map((d) => <DonationRow key={d.id} donation={d} />)
        ) : (
          <Text style={styles.muted}>You haven&apos;t donated yet.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function DonationRow({ donation }: { donation: Donation }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowMsg} numberOfLines={1}>
          {donation.message || 'Donation'}
        </Text>
        {donation.createdAt ? <Text style={styles.rowDate}>{formatDate(donation.createdAt)}</Text> : null}
      </View>
      <Text style={styles.rowAmount}>{formatPrice(donation.amount, donation.currency)}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  section: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.textSoft },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  tierText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },

  webHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: c.infoBg,
    borderRadius: radii.md,
  },
  webHintText: {
    flex: 1,
    color: c.info,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },

  historyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text, marginTop: spacing.md },
  muted: { color: c.textMuted, fontSize: fontSize.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  rowMsg: { fontSize: fontSize.md, color: c.text, fontWeight: fontWeight.semibold },
  rowDate: { fontSize: fontSize.xs, color: c.textMuted },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
}));
