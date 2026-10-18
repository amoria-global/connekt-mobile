/**
 * Donations screen.
 *
 * The app no longer collects donation payment details (amount entry,
 * phone numbers, telecom / card pickers) or polls the gateway. It shows
 * suggested tiers and the user's donation history, and hands the actual
 * donation off to the connekyt.com donations page.
 */
import { useCallback, useRef } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { getDonationTiers, listDonations, type Donation } from '@/features/donations/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

const FALLBACK_TIERS = [1000, 5000, 10000, 25000];

export default function DonationsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useStyles();
  const history = useAsync(useCallback(() => listDonations(), []));
  const tiersAsync = useAsync(useCallback(() => getDonationTiers(), []));
  const tiers = tiersAsync.data?.length ? tiersAsync.data.map((tier) => tier.amount) : FALLBACK_TIERS;

  const router = useRouter();
  // The donate screen completes the payment in the app; refresh the history
  // when coming back so a completed donation shows up below.
  const skipFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (skipFirstFocus.current) {
        skipFirstFocus.current = false;
        return;
      }
      void history.refresh();
    }, [history]),
  );

  const onDonate = () => router.push('/(public)/donate' as unknown as Href);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('b2_donationsTitle')} subtitle={t('b2_donationsSubtitle')} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.section}>{t('b2_donationsSuggestedAmounts')}</Text>
        <View style={styles.tierRow}>
          {tiers.map((tier) => (
            <View key={tier} style={styles.tier}>
              <Text style={styles.tierText}>{formatPrice(tier, 'RWF')}</Text>
            </View>
          ))}
        </View>

        <Button
          title={t('b2_donationsButton')}
          onPress={onDonate}
        />

        <Text style={styles.historyTitle}>{t('b2_donationsHistoryTitle')}</Text>
        {history.loading && !history.data ? (
          <ActivityIndicator color={colors.primary} />
        ) : history.data?.length ? (
          history.data.map((d) => <DonationRow key={d.id} donation={d} fallbackLabel={t('b2_donationsFallbackRow')} />)
        ) : (
          <Text style={styles.muted}>{t('b2_donationsEmpty')}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function DonationRow({ donation, fallbackLabel }: { donation: Donation; fallbackLabel: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowMsg} numberOfLines={1}>
          {donation.message || fallbackLabel}
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
