/**
 * The referral program policy (the in-app Help article), built only from the shared copy: the tier table, the 3-step
 * qualifying rule worded exactly as in the explainer, fraud review, the 40 cap, permanence, scope, earlier lower fees
 * and contact. The landing page and the dashboard read the same file, so all of them say the same thing.
 */
import { Text, View } from 'react-native';
import { fonts, fontSize, makeStyles, radii, spacing } from '@/theme';
import { HowItCountsCard } from './HowReferralsCount';
import { TIERS } from './milestoneModel';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy } from './referral';

export function ReferralPolicyBody() {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const sections: Array<[string, string]> = [
    [m.policyFraudTitle, m.policyFraud],
    [m.policyCapTitle, m.policyCap],
    [m.policyPermanenceTitle, m.policyPermanence],
    [m.policyScopeTitle, m.policyScope],
    [m.policyGrandfatherTitle, m.policyGrandfather],
    [m.policyContactTitle, m.policyContact],
  ];
  return (
    <View testID="referral-policy">
      <Text style={styles.title} accessibilityRole="header">{m.policyTitle}</Text>
      <Text style={styles.intro}>{m.policyIntro}</Text>

      <Text style={styles.h2} accessibilityRole="header">{m.policyTiersTitle}</Text>
      <View style={styles.table}>
        {TIERS.map((t, i) => (
          <View key={t.share} style={[styles.tr, i === 0 && styles.trFirst]}>
            <Text style={[styles.cell, styles.strong]}>
              {t.from === t.to ? fillCopy(m.tierExact, { n: t.from }) : fillCopy(m.tierRange, { from: t.from, to: t.to })}
            </Text>
            <Text style={[styles.cell, styles.strong]}>{t.share}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h2} accessibilityRole="header">{m.policyRulesTitle}</Text>
      <HowItCountsCard />

      {sections.map(([h, p]) => (
        <View key={h}>
          <Text style={styles.h2} accessibilityRole="header">{h}</Text>
          <Text style={styles.body}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  title: { fontFamily: fonts.display, fontSize: fontSize.xxl, fontWeight: '800', color: c.text },
  intro: { fontSize: fontSize.md, color: c.text, marginTop: spacing.lg, lineHeight: 22 },
  h2: { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginTop: spacing.xl, marginBottom: spacing.sm },
  body: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22 },
  table: { borderWidth: 1, borderColor: c.border, borderRadius: radii.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border },
  trFirst: { borderTopWidth: 0 },
  cell: { flex: 1, padding: spacing.md, fontSize: fontSize.md, color: c.text },
  strong: { fontWeight: '700' },
}));
