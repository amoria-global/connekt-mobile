/**
 * The balance card at the top of the Withdraw form.
 *
 * A balance is shown as a number only when the backend reported one. When it reported no withdrawable source at all,
 * the card says so instead of showing "$0.00": an empty answer is not a confirmed zero, and a zero on a money screen
 * reads as "you have nothing" when the truth is "we were not told". A source that reports 0 still shows $0.00.
 */
import { StyleSheet, Text, View } from 'react-native';
import { formatDisplay, floorTo, usdToDisplay, type DisplayCurrency, type WithdrawSource } from './model';
import { fonts, fontSize, fontWeight, makeStyles, radii, spacing } from '@/theme';

export function BalanceHero({
  source,
  currency,
  usd,
}: {
  source: WithdrawSource | null;
  currency: DisplayCurrency;
  /** The USD display currency, for the second line when the main amount is in another currency. */
  usd: DisplayCurrency;
}) {
  const styles = useStyles();
  if (!source) {
    return (
      <View style={styles.hero} accessible accessibilityLabel="Available balance, not reported">
        <Text style={styles.label}>Available balance</Text>
        <Text style={styles.amount}>N/A</Text>
        <Text style={styles.sub}>No withdrawable balance was reported. Reopen this screen to check again.</Text>
      </View>
    );
  }
  const shown = floorTo(usdToDisplay(source.availableBalance, currency), currency.decimals);
  return (
    <View style={styles.hero}>
      <Text style={styles.label}>{source.label}</Text>
      <Text style={styles.amount}>{formatDisplay(shown, currency)}</Text>
      {currency.code !== 'USD' ? <Text style={styles.sub}>{formatDisplay(source.availableBalance, usd)}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    hero: { backgroundColor: c.primary, borderRadius: radii.xl, padding: spacing.xl, gap: 4 },
    label: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    amount: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
    sub: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm },
  }),
);
