/**
 * Terms & Conditions — shown ONCE on first install (persisted via
 * onboarding.termsAccepted). The user must scroll and accept before the
 * app routes anywhere else. The root route guard forces this screen while
 * `termsAccepted === false`.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { useOnboarding } from '@/store/onboarding';
import { useLanguage, type TranslationKey } from '@/store/language';
import { spacing, fonts, makeStyles } from '@/theme';

const SECTIONS: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: 'b1_termsSec1Title', bodyKey: 'b1_termsSec1Body' },
  { titleKey: 'b1_termsSec2Title', bodyKey: 'b1_termsSec2Body' },
  { titleKey: 'b1_termsSec3Title', bodyKey: 'b1_termsSec3Body' },
  { titleKey: 'b1_termsSec4Title', bodyKey: 'b1_termsSec4Body' },
  { titleKey: 'b1_termsSec5Title', bodyKey: 'b1_termsSec5Body' },
  { titleKey: 'b1_termsSec6Title', bodyKey: 'b1_termsSec6Body' },
  { titleKey: 'b1_termsSec7Title', bodyKey: 'b1_termsSec7Body' },
];

export default function TermsScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const router = useRouter();
  const acceptTerms = useOnboarding((s) => s.acceptTerms);

  const onAccept = async () => {
    await acceptTerms();
    // Onboarding still runs each launch — head to the splash/intro next.
    router.replace('/splash');
  };

  return (
    <AuthGlassLayout
      title={t('b1_termsTitle')}
      subtitle={t('b1_termsSubtitle')}
      bandRatio={0.24}
      eyebrow={<Text style={styles.eyebrow}>{t('b1_termsEyebrow')}</Text>}
      footer={
        // Last on the sheet: accepting comes after the terms, not beside them.
        <Button title={t('b1_termsAcceptBtn')} onPress={onAccept} style={styles.accept} />
      }
    >
      <View style={styles.sections}>
        {SECTIONS.map((s, i) => (
          <View key={s.titleKey} style={[styles.section, i > 0 && styles.sectionRule]}>
            <Text style={styles.sectionTitle}>{t(s.titleKey)}</Text>
            <Text style={styles.sectionBody}>{t(s.bodyKey)}</Text>
          </View>
        ))}
      </View>
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  sections: { gap: spacing.md },
  section: { gap: 4 },
  sectionRule: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  sectionBody: { fontFamily: fonts.regular, fontSize: 14, color: c.textSoft, lineHeight: 21 },
  accept: { alignSelf: 'stretch', marginTop: spacing.sm },
}));
