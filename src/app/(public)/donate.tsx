/**
 * Public donation flow (guest, no auth).
 *
 * The app no longer collects donation payment details (amount entry,
 * donor info, phone numbers, telecom / card pickers) or polls the
 * gateway. It shows the cause + suggested tiers and hands the user off
 * to the connekyt.com donations page, where the whole flow completes.
 *
 * When `eventId` is in the query it is passed through so the web page
 * preselects the cause.
 */
import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { getDonationTiers } from '@/features/donations/api';
import { donationUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const FALLBACK_TIERS: { amount: number }[] = [
  { amount: 1000 },
  { amount: 5000 },
  { amount: 10000 },
  { amount: 25000 },
];

export default function PublicDonateScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const tiers = useAsync(useCallback(() => getDonationTiers(), []));
  const presetTiers = tiers.data?.length ? tiers.data : FALLBACK_TIERS;

  const [opening, setOpening] = useState(false);

  const onDonate = async () => {
    if (opening) return;
    setOpening(true);
    try {
      await openWebCheckout(donationUrl(eventId));
    } catch {
      Alert.alert('Could not open the donations page', 'Please try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="heart" size={28} color={colors.accent} />
          <Text style={styles.heroTitle}>Support a Connekyt creator</Text>
          <Text style={styles.heroSub}>
            100% of every donation reaches the people behind the stream — no platform cut.
          </Text>
        </View>

        <Text style={styles.h2}>Suggested amounts</Text>
        <View style={styles.tiers}>
          {presetTiers.map((t) => (
            <View key={t.amount} style={styles.tier}>
              <Text style={styles.tierAmount}>{t.amount.toLocaleString()}</Text>
              <Text style={styles.tierCurrency}>RWF</Text>
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },
  hero: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  heroTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  heroSub: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tierAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  tierCurrency: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold, marginTop: 2 },

  webHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
  },
  webHintText: { flex: 1, color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, lineHeight: 18 },
});
