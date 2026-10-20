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
import { ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { HeroActionCard, ListRow } from '@/features/client/studio';
import { Card, EmptyNote, ErrorNotice, SectionHeader, SkeletonCard } from '@/features/photographer/kit';
import { getDonationTiers, listDonations, type Donation } from '@/features/donations/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

const FALLBACK_TIERS = [1000, 5000, 10000, 25000];

export default function DonationsScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <UserHeaderBand flush eyebrow="GIVING" title={t('b2_donationsTitle')} subtitle={t('b2_donationsSubtitle')} duplicatesHeader />

        <HeroActionCard title={t('b2_donationsButton')} subtitle={t('b2_donationsSubtitle')} icon="heart" onPress={onDonate} />

        <SectionHeader flush title={t('b2_donationsSuggestedAmounts')} />
        <View style={styles.tierRow}>
          {tiers.map((tier) => (
            <View key={tier} style={styles.tier}>
              <Text style={styles.tierText} maxFontSizeMultiplier={1.3}>{formatPrice(tier, 'RWF')}</Text>
            </View>
          ))}
        </View>

        <SectionHeader flush title={t('b2_donationsHistoryTitle')} />
        {history.loading && !history.data ? (
          <View style={styles.group}>
            <SkeletonCard height={64} />
            <SkeletonCard height={64} />
          </View>
        ) : history.error && !history.data ? (
          <ErrorNotice flush message={history.error} onRetry={history.refresh} />
        ) : history.data?.length ? (
          <Card style={styles.card}>
            {history.data.map((d, index) => (
              <ListRow
                key={d.id}
                icon="heart-outline"
                tone="accent"
                divider={index < history.data!.length - 1}
                title={d.message || t('b2_donationsFallbackRow')}
                meta={d.createdAt ? formatDate(d.createdAt) : undefined}
                trailing={<Text style={styles.rowAmount}>{formatPrice(d.amount, d.currency)}</Text>}
              />
            ))}
          </Card>
        ) : (
          <View style={styles.flushNote}>
            <EmptyNote compact icon="heart-outline" title={t('b2_donationsEmpty')} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 },
  group: { gap: spacing.sm },
  flushNote: { marginHorizontal: -spacing.lg },
  card: { marginHorizontal: 0, padding: 0 },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexGrow: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  tierText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
}));
