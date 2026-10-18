import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { PRIVACY_SECTIONS } from '@/content/privacyPolicy';
import { useLanguage } from '@/hooks/useLanguage';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function PrivacyPolicyScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('b4_privacyTitle')}</Text>
          <Text style={styles.subtitle}>{t('b4_privacySubtitle')}</Text>
          <Text style={styles.updated}>{t('b4_amoriaCompany')}</Text>
        </View>

        {PRIVACY_SECTIONS.map((section, idx) => (
          <View key={section.id ?? idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.bodyText}>{section.content}</Text>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  header: { marginBottom: spacing.xxl, alignItems: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: c.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: { fontSize: fontSize.md, color: c.primary, fontWeight: '600', textAlign: 'center' },
  updated: { fontSize: fontSize.xs, color: c.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: c.text,
    marginBottom: spacing.md,
  },
  bodyText: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 24 },
}));
