import { ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useLanguage } from '@/hooks/useLanguage';
import { referralStrings } from '@/features/referral/referral';
import { spacing, fontSize, makeStyles } from '@/theme';

/** The Photographer Referral Program policy, the Help article, in the app's language (English where missing). */
export default function ReferralProgramScreen() {
  const styles = useStyles();
  const { language } = useLanguage();
  const p = referralStrings(language).policy;
  const rows: Array<[string, string]> = [
    [p.rowDefault, p.rowDefaultFee],
    [p.rowFive, '25%'],
    [p.rowStep, p.rowStepFee],
    [p.rowMax, '10%'],
  ];
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">{p.title}</Text>
        <Text style={styles.updated}>{p.updated}</Text>
        <Text style={styles.intro}>{p.intro}</Text>

        <Text style={styles.h2} accessibilityRole="header">{p.tableTitle}</Text>
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            <Text style={[styles.cell, styles.head]}>{p.colRefs}</Text>
            <Text style={[styles.cell, styles.head]}>{p.colFee}</Text>
          </View>
          {rows.map(([a, b]) => (
            <View key={a} style={styles.tr}>
              <Text style={[styles.cell, styles.strong]}>{a}</Text>
              <Text style={styles.cell}>{b}</Text>
            </View>
          ))}
        </View>

        {p.sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.h2} accessibilityRole="header">{`${i + 1}. ${s.h}`}</Text>
            {s.p.map((para, j) => (
              <Text key={j} style={styles.body}>{para}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: c.text },
  updated: { fontSize: fontSize.sm, color: c.textMuted, marginTop: spacing.xs },
  intro: { fontSize: fontSize.md, color: c.text, marginTop: spacing.lg, lineHeight: 22 },
  h2: { fontSize: fontSize.lg, fontWeight: '700', color: c.text, marginTop: spacing.xl },
  section: { marginTop: spacing.xs },
  body: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22, marginTop: spacing.sm },
  table: { borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden', marginTop: spacing.sm },
  tr: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.border },
  th: { borderTopWidth: 0, backgroundColor: c.surfaceMuted },
  cell: { flex: 1, padding: spacing.md, fontSize: fontSize.md, color: c.text },
  head: { fontWeight: '700' },
  strong: { fontWeight: '700' },
}));
