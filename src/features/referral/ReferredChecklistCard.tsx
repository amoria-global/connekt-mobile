/**
 * Home card for a photographer who came through a referral: "Help Jane D. unlock rewards" with the three steps ticked
 * as they happen. It disappears once the referral qualifies (or is revoked). Only the referrer's display name is shown.
 */
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { fillCopy } from './referralCopy';
import { useMilestoneCopy, type MyReferral } from './referral';

export function checklistVisible(r: MyReferral | null): r is MyReferral {
  return !!r && r.status !== 'qualified' && r.status !== 'revoked';
}

export function ReferredChecklistCard({ referral }: { referral: MyReferral | null }) {
  const m = useMilestoneCopy();
  const styles = useStyles();
  const { colors } = useTheme();
  if (!checklistVisible(referral)) return null;
  const steps = [
    { label: m.checkSignedUp, done: true },
    { label: m.checkVerified, done: referral.verifiedPublished },
    { label: m.checkFirstSale, done: referral.firstSale },
  ];
  return (
    <View style={styles.card} testID="referred-checklist">
      <Text style={styles.title}>{fillCopy(m.referredCardTitle, { referrer: referral.referrerName ?? '' })}</Text>
      <Text style={styles.sub}>{m.referredCardSteps}</Text>
      <View style={styles.steps}>
        {steps.map((s) => (
          <View key={s.label} style={styles.step} accessibilityLabel={`${s.label}: ${s.done ? '✓' : '…'}`}>
            <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={s.done ? colors.success : colors.textMuted} />
            <Text style={[styles.stepText, s.done && styles.done]}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: c.primary, backgroundColor: c.surface },
  title: { fontFamily: fonts.display, fontSize: 15, fontWeight: '700', color: c.text },
  sub: { fontSize: 12.5, lineHeight: 17, color: c.textMuted },
  steps: { gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepText: { fontSize: 13.5, color: c.textMuted },
  done: { color: c.text, fontWeight: '700' },
}));
