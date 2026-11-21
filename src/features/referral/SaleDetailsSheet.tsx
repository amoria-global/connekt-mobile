/**
 * Wallet sale details: "You earned RWF 7,500 · 75% of a RWF 10,000 photo sale" with the selling price, the rate at
 * the moment of sale, the platform share and the confirmed time. The split is the one stored on the sale, so a later
 * rate change never rewrites it.
 *
 * BACKEND GAP: wallet movements do not carry the stored split yet. The backend keeps it on fee_rate_snapshots
 * (selling_price_usd, applied_pct, platform_usd, photographer_usd, confirmed_at) and needs to expose it on a photo sale
 * movement as `sale`. Until then `saleOf` returns null and no sheet opens.
 */
import { Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { formatMoney } from '@/utils/format';
import { fonts, makeStyles, spacing } from '@/theme';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy } from './referral';

export interface SaleSplit {
  currency: string;
  earned: number;
  sellingPrice: number;
  ratePercent: number;
  platformShare: number;
  confirmedAt: string;
  title?: string;
}

/** The split carried by a movement, when the backend sends one. */
export function saleOf(movement: { sale?: Partial<SaleSplit> | null; currency?: string; amount: number }): SaleSplit | null {
  const s = movement.sale;
  if (!s || s.sellingPrice == null || s.ratePercent == null || s.platformShare == null || !s.confirmedAt) return null;
  return {
    currency: s.currency ?? movement.currency ?? '',
    earned: movement.amount,
    sellingPrice: s.sellingPrice,
    ratePercent: s.ratePercent,
    platformShare: s.platformShare,
    confirmedAt: s.confirmedAt,
    title: s.title,
  };
}

export function SaleDetailsSheet({ sale, onClose }: { sale: SaleSplit | null; onClose: () => void }) {
  const m = useMilestoneCopy();
  const styles = useStyles();
  if (!sale) return null;
  const money = (n: number) => formatMoney(n, sale.currency);
  const rows: Array<[string, string]> = [
    [m.saleSellingPrice, money(sale.sellingPrice)],
    [m.saleRateAtSale, `${sale.ratePercent}%`],
    [m.salePlatformShare, money(sale.platformShare)],
    [m.saleConfirmed, new Date(sale.confirmedAt).toLocaleString()],
  ];
  return (
    <Sheet visible title={m.saleYouEarned} onClose={onClose}>
      <View style={styles.wrap} testID="sale-details">
        <Text style={styles.earned}>{money(sale.earned)}</Text>
        <Text style={styles.line}>
          {fillCopy(m.saleLine, { rate: sale.ratePercent, sale: money(sale.sellingPrice) })}
          {sale.title ? ` · ${sale.title}` : ''}
        </Text>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v}</Text>
          </View>
        ))}
        <Text style={styles.foot}>{m.saleFootnote}</Text>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.sm },
  earned: { fontFamily: fonts.display, fontSize: 30, fontWeight: '800', color: c.text },
  line: { fontSize: 13.5, color: c.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
  k: { fontSize: 13.5, color: c.textMuted },
  v: { fontSize: 13.5, fontWeight: '700', color: c.text },
  foot: { fontSize: 12, color: c.textMuted, marginTop: spacing.sm },
}));
