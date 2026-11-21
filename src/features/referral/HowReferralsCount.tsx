/**
 * "How referrals count": the three numbered steps of the qualifying rule, worded from the shared copy so the app, the
 * dashboard, the policy page and the emails say the same thing. Shown as a card on the Milestones screen and as a
 * sheet from the Home card, the invite sheet and the sign-up field.
 */
import { Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { formatPrice } from '@/utils/format';
import { fonts, makeStyles, radii, spacing } from '@/theme';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy } from './referral';

export function HowItCountsCard({ minUsd = 5 }: { minUsd?: number }) {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const steps = [m.step1, m.step2, fillCopy(m.step3, { min: formatPrice(minUsd) })];
  return (
    <View style={styles.card} testID="how-it-counts">
      <Text style={styles.title} accessibilityRole="header">{m.howTitle}</Text>
      {steps.map((text, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
          <Text style={styles.stepText}>{text}</Text>
        </View>
      ))}
      <Text style={styles.footer}>{m.stepsFooter}</Text>
    </View>
  );
}

export function HowItCountsSheet({ visible, onClose, minUsd }: { visible: boolean; onClose: () => void; minUsd?: number }) {
  const m = useMilestoneCopy();
  return (
    <Sheet visible={visible} title={m.howTitle} onClose={onClose}>
      <HowItCountsCard minUsd={minUsd} />
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  title: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: c.text },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
  numText: { fontSize: 12.5, fontWeight: '800', color: c.textOnPrimary },
  stepText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: c.text },
  footer: { fontSize: 12.5, lineHeight: 18, color: c.textMuted },
}));
